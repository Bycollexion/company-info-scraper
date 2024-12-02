from flask import Flask, request, jsonify, render_template, Response
from bs4 import BeautifulSoup
import requests
import random
import json
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote_plus
import re
import os

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
]

def get_random_user_agent():
    return random.choice(USER_AGENTS)

def make_request(url, retries=3):
    headers = {'User-Agent': get_random_user_agent()}
    for i in range(retries):
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            if i == retries - 1:
                raise e
            time.sleep(random.uniform(1, 3))
    return None

def extract_employee_count(text):
    patterns = [
        r'(\d{1,3}(?:,\d{3})*(?:\+)?)\s*(?:employees?|staff|people|workers)',
        r'(?:employees?|staff|people|workers)[:\s]+(\d{1,3}(?:,\d{3})*(?:\+)?)',
        r'team of (\d{1,3}(?:,\d{3})*(?:\+)?)',
        r'(\d{1,3}(?:,\d{3})*(?:\+)?)\s*team members',
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, text.lower())
        counts = [match.group(1).replace(',', '') for match in matches]
        if counts:
            return max([int(count.replace('+', '')) for count in counts])
    return None

def search_company(company_name):
    try:
        search_query = f"{company_name} singapore company employees linkedin"
        search_url = f"https://www.google.com/search?q={quote_plus(search_query)}"
        
        html_content = make_request(search_url)
        if not html_content:
            return {
                'company_name': company_name,
                'error': 'Failed to fetch search results'
            }

        soup = BeautifulSoup(html_content, 'html.parser')
        search_results = soup.find_all('div', class_='g')
        
        employee_counts = []
        sources = set()
        company_website = None
        
        for result in search_results[:5]:
            try:
                link = result.find('a')['href']
                if not company_website and company_name.lower() in link.lower():
                    company_website = link

                snippet = result.get_text().lower()
                count = extract_employee_count(snippet)
                
                if count:
                    employee_counts.append(count)
                    source = re.search(r'(?:www\.|//)([\w-]+)\.', link)
                    if source:
                        sources.add(source.group(1).capitalize())
            except Exception as e:
                logging.warning(f"Error processing search result: {str(e)}")
                continue

        if not employee_counts:
            return {
                'company_name': company_name,
                'employee_count': None,
                'company_website': company_website,
                'sources': list(sources),
                'all_counts': {}
            }

        # Get the median count to avoid outliers
        employee_counts.sort()
        median_count = employee_counts[len(employee_counts)//2]
        
        all_counts = {}
        for count, source in zip(employee_counts, sources):
            all_counts[source] = count

        return {
            'company_name': company_name,
            'employee_count': median_count,
            'company_website': company_website,
            'sources': list(sources),
            'all_counts': all_counts
        }
    except Exception as e:
        logging.error(f"Error searching for {company_name}: {str(e)}")
        return {
            'company_name': company_name,
            'error': str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    def generate():
        companies = request.get_json().get('companies', [])
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_company = {
                executor.submit(search_company, company): company 
                for company in companies
            }
            
            for future in future_to_company:
                try:
                    result = future.result()
                    yield f"data: {json.dumps(result)}\n\n"
                    time.sleep(0.1)  # Small delay to prevent overwhelming the client
                except Exception as e:
                    error_result = {
                        'company_name': future_to_company[future],
                        'error': str(e)
                    }
                    yield f"data: {json.dumps(error_result)}\n\n"

    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    # Use environment variable for port with a default of 5002
    port = int(os.environ.get('PORT', 5002))
    # In production, don't use debug mode
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
