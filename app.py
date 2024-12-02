from flask import Flask, render_template, request, jsonify, Response
from bs4 import BeautifulSoup
import requests
import re
import concurrent.futures
import os
import logging
from dotenv import load_dotenv
import time
import random
import json
from urllib.parse import quote_plus
import asyncio
from functools import partial

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
load_dotenv()

# List of user agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
]

# Additional sources to search
SOURCES = {
    'linkedin': 'site:linkedin.com/company',
    'glassdoor': 'site:glassdoor.com',
    'jobstreet': 'site:jobstreet.com.sg',
    'indeed': 'site:indeed.com.sg',
    'bloomberg': 'site:bloomberg.com/profile',
    'crunchbase': 'site:crunchbase.com/organization',
}

def get_random_delay():
    return random.uniform(0.5, 1.5)

def clean_number(text):
    if not text:
        return None
    matches = re.findall(r'[\d,]+', text)
    if matches:
        return int(matches[0].replace(',', ''))
    return None

def make_request(url, max_retries=3):
    headers = {'User-Agent': random.choice(USER_AGENTS)}
    
    for attempt in range(max_retries):
        try:
            time.sleep(get_random_delay())
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logger.error(f"Request failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt == max_retries - 1:
                return None
            time.sleep(get_random_delay())
    return None

def search_source(company_name, source_type, source_query):
    try:
        search_url = f"https://www.google.com/search?q={quote_plus(f'{company_name} {source_query} singapore employees')}"
        html_content = make_request(search_url)
        
        if not html_content:
            return None
            
        soup = BeautifulSoup(html_content, 'html.parser')
        text_content = soup.get_text()
        
        # Different patterns for employee counts
        patterns = [
            r'(\d{1,3}(?:,\d{3})*)\s*(?:employees|workers|staff)',
            r'(?:company size|team size|employees).*?(\d{1,3}(?:,\d{3})*)',
            r'(?:approximately|about|over|more than)\s*(\d{1,3}(?:,\d{3})*)\s*(?:employees|people)',
            r'(?:workforce of|team of)\s*(\d{1,3}(?:,\d{3})*)',
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text_content, re.IGNORECASE)
            if matches:
                count = clean_number(matches[0])
                if count:
                    return {'source': source_type, 'count': count}
                    
        return None
    except Exception as e:
        logger.error(f"Error searching {source_type} for {company_name}: {str(e)}")
        return None

def get_company_website(company_name):
    try:
        search_url = f"https://www.google.com/search?q={quote_plus(f'{company_name} singapore official website')}"
        html_content = make_request(search_url)
        
        if not html_content:
            return None
            
        soup = BeautifulSoup(html_content, 'html.parser')
        
        for link in soup.find_all('a'):
            href = link.get('href', '')
            if 'url?q=' in href and not any(x in href for x in ['google.com', 'youtube.com', 'facebook.com']):
                return href.split('url?q=')[1].split('&')[0]
        
        return None
    except Exception as e:
        logger.error(f"Error getting website for {company_name}: {str(e)}")
        return None

def process_company_batch(companies):
    results = []
    
    for company in companies:
        try:
            logger.info(f"Processing company: {company}")
            
            # Get company website
            website = get_company_website(company)
            
            # Search all sources concurrently
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as executor:
                future_to_source = {
                    executor.submit(search_source, company, source_type, source_query): source_type
                    for source_type, source_query in SOURCES.items()
                }
                
                employee_counts = []
                for future in concurrent.futures.as_completed(future_to_source):
                    result = future.result()
                    if result:
                        employee_counts.append(result)
            
            # Determine most likely employee count
            if employee_counts:
                # Use the most common count or the median
                counts = [ec['count'] for ec in employee_counts]
                most_common = max(set(counts), key=counts.count)
                
                results.append({
                    'company_name': company,
                    'employee_count': most_common,
                    'company_website': website,
                    'sources': [ec['source'] for ec in employee_counts],
                    'all_counts': {ec['source']: ec['count'] for ec in employee_counts}
                })
            else:
                results.append({
                    'company_name': company,
                    'error': 'No employee count found'
                })
                
        except Exception as e:
            logger.error(f"Error processing {company}: {str(e)}")
            results.append({
                'company_name': company,
                'error': str(e)
            })
            
    return results

def stream_results(companies):
    batch_size = 10
    for i in range(0, len(companies), batch_size):
        batch = companies[i:i + batch_size]
        results = process_company_batch(batch)
        for result in results:
            yield f"data: {json.dumps(result)}\n\n"
            time.sleep(0.1)  # Small delay to prevent overwhelming the client

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.get_json()
        if not data or 'companies' not in data:
            return jsonify({'error': 'No companies provided'}), 400
            
        companies = data.get('companies', [])
        if not companies:
            return jsonify({'error': 'Empty company list'}), 400
            
        companies = [c.strip() for c in companies if c.strip()]
        logger.info(f"Received search request for {len(companies)} companies")
        
        # Return SSE stream for real-time updates
        return Response(
            stream_results(companies),
            mimetype='text/event-stream'
        )
        
    except Exception as e:
        logger.error(f"Search endpoint error: {str(e)}")
        return jsonify({'error': f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
