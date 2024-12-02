from flask import Flask, render_template, request, jsonify
from bs4 import BeautifulSoup
import requests
import re
import concurrent.futures
import os
import logging
from dotenv import load_dotenv
import time
import random

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

def get_random_delay():
    return random.uniform(1, 3)

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
            time.sleep(get_random_delay())  # Add delay between requests
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logger.error(f"Request failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
            if attempt == max_retries - 1:
                raise
            time.sleep(get_random_delay())
    return None

def scrape_website(company_name):
    try:
        logger.info(f"Starting scrape for company: {company_name}")
        
        # Google search for LinkedIn
        search_url = f"https://www.google.com/search?q={company_name}+singapore+employees+linkedin"
        html_content = make_request(search_url)
        
        if not html_content:
            raise Exception("Failed to fetch search results")
            
        soup = BeautifulSoup(html_content, 'html.parser')
        employee_count = None
        text_content = soup.get_text()
        
        # Look for LinkedIn results
        linkedin_patterns = [
            r'(\d{1,3}(?:,\d{3})*)\s*employees',
            r'(\d{1,3}(?:,\d{3})*)\s*workers',
            r'(\d{1,3}(?:,\d{3})*)\s*staff'
        ]
        
        for pattern in linkedin_patterns:
            matches = re.findall(pattern, text_content, re.IGNORECASE)
            if matches:
                employee_count = clean_number(matches[0])
                break
        
        # Try company website
        company_url = f"https://www.google.com/search?q={company_name}+singapore+official+website"
        html_content = make_request(company_url)
        
        if not html_content:
            raise Exception("Failed to fetch company website results")
            
        soup = BeautifulSoup(html_content, 'html.parser')
        company_website = None
        
        # Extract first result as company website
        for link in soup.find_all('a'):
            href = link.get('href', '')
            if 'url?q=' in href and not any(x in href for x in ['google.com', 'youtube.com', 'facebook.com']):
                company_website = href.split('url?q=')[1].split('&')[0]
                break
        
        logger.info(f"Completed scrape for {company_name}: Found {employee_count} employees")
        
        return {
            'company_name': company_name,
            'employee_count': employee_count,
            'company_website': company_website,
            'sources': ['Google Search', 'LinkedIn', 'Company Website']
        }
    except Exception as e:
        logger.error(f"Error scraping {company_name}: {str(e)}")
        return {
            'company_name': company_name,
            'error': f"Failed to fetch company information: {str(e)}"
        }

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
            
        logger.info(f"Received search request for companies: {companies}")
        
        # Use ThreadPoolExecutor to scrape multiple companies concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            results = list(executor.map(scrape_website, companies))
        
        logger.info("Search completed successfully")
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Search endpoint error: {str(e)}")
        return jsonify({'error': f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
