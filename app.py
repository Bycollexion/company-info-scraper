from flask import Flask, render_template, request, jsonify
from bs4 import BeautifulSoup
import requests
import re
import concurrent.futures
import os
from dotenv import load_dotenv

app = Flask(__name__)
load_dotenv()

def clean_number(text):
    if not text:
        return None
    matches = re.findall(r'[\d,]+', text)
    if matches:
        return int(matches[0].replace(',', ''))
    return None

def scrape_website(company_name):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Google search
        search_url = f"https://www.google.com/search?q={company_name}+singapore+employees+linkedin"
        response = requests.get(search_url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to find employee count in search results
        employee_count = None
        text_content = soup.get_text()
        
        # Look for LinkedIn results
        linkedin_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*)\s*employees', re.IGNORECASE)
        linkedin_matches = linkedin_pattern.findall(text_content)
        
        if linkedin_matches:
            employee_count = clean_number(linkedin_matches[0])
        
        # Try company website
        company_url = f"https://www.google.com/search?q={company_name}+singapore+official+website"
        response = requests.get(company_url, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract first result as company website
        company_website = None
        for link in soup.find_all('a'):
            href = link.get('href', '')
            if 'url?q=' in href and not any(x in href for x in ['google.com', 'youtube.com', 'facebook.com']):
                company_website = href.split('url?q=')[1].split('&')[0]
                break
        
        return {
            'company_name': company_name,
            'employee_count': employee_count,
            'company_website': company_website,
            'sources': ['Google Search', 'LinkedIn', 'Company Website']
        }
    except Exception as e:
        return {
            'company_name': company_name,
            'error': str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    data = request.get_json()
    companies = data.get('companies', [])
    
    # Use ThreadPoolExecutor to scrape multiple companies concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(scrape_website, companies))
    
    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)
