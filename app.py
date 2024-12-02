from flask import Flask, request, jsonify, render_template
from bs4 import BeautifulSoup
import requests
import random
import json
import re
import os
import time
from urllib.parse import quote_plus
import concurrent.futures
import threading

app = Flask(__name__)

# Thread-local storage for session
thread_local = threading.local()

def get_session():
    if not hasattr(thread_local, "session"):
        thread_local.session = requests.Session()
    return thread_local.session

def get_random_user_agent():
    return random.choice([
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    ])

def make_request(url, retries=3):
    session = get_session()
    headers = {
        'User-Agent': get_random_user_agent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
    }
    
    for i in range(retries):
        try:
            response = session.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.text
            elif response.status_code == 429:  # Too Many Requests
                wait_time = (i + 1) * 2
                time.sleep(wait_time)
                continue
            else:
                response.raise_for_status()
        except Exception as e:
            if i < retries - 1:
                time.sleep(2)
                continue
    return None

def extract_employee_count(text):
    try:
        # Look for Singapore-specific employee counts
        sg_patterns = [
            r'(\d{1,3}(?:,\d{3})*)\s*employees? in Singapore',
            r'Singapore[^.]*?(\d{1,3}(?:,\d{3})*)\s*employees?',
            r'(\d{1,3}(?:,\d{3})*)\s*staff in Singapore',
            r'Singapore[^.]*?(\d{1,3}(?:,\d{3})*)\s*staff'
        ]
        
        for pattern in sg_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                count = match.group(1).replace(',', '')
                return int(count), 'Singapore specific'
        
        # General employee count patterns as fallback
        patterns = [
            r'(\d{1,3}(?:,\d{3})*)\s*employees?',
            r'(\d{1,3}(?:,\d{3})*)\s*staff',
            r'(\d{1,3}(?:,\d{3})*)\s*people',
            r'(\d{1,3}(?:,\d{3})*)\s*workers'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                count = match.group(1).replace(',', '')
                return int(count), 'Global'
                
    except Exception as e:
        print(f"Error extracting employee count: {str(e)}")
    return None, None

def sanitize_input(text):
    if not text or not isinstance(text, str):
        return ""
    return re.sub(r'[<>\'";]', '', text)

def search_single_company(company_name):
    try:
        # Only search LinkedIn for speed
        search_url = f"https://www.google.com/search?q={quote_plus(f'{company_name} singapore site:linkedin.com/company')}"
        
        html_content = make_request(search_url)
        if not html_content:
            return {
                'name': company_name,
                'error': 'No results found'
            }
        
        soup = BeautifulSoup(html_content, 'html.parser')
        first_result = soup.select_one('div.g')
        
        if not first_result:
            return {
                'name': company_name,
                'error': 'No results found'
            }
            
        title_elem = first_result.select_one('h3')
        link_elem = first_result.select_one('a')
        snippet_elem = first_result.select_one('div.VwiC3b')
        
        if not all([title_elem, link_elem, snippet_elem]):
            return {
                'name': company_name,
                'error': 'Incomplete result'
            }
        
        title = re.sub(r'\s*\|\s*LinkedIn$', '', title_elem.get_text().strip())
        link = link_elem['href']
        snippet = snippet_elem.get_text().strip()
        
        employee_count, count_source = extract_employee_count(snippet)
        
        # Try to get more details from LinkedIn page
        if 'linkedin.com' in link.lower():
            try:
                page_content = make_request(link)
                if page_content:
                    page_soup = BeautifulSoup(page_content, 'html.parser')
                    page_text = page_soup.get_text()
                    page_count, page_source = extract_employee_count(page_text)
                    if page_count and (not employee_count or page_source == 'Singapore specific'):
                        employee_count = page_count
                        count_source = page_source
            except:
                pass
        
        return {
            'name': company_name,
            'found_name': title,
            'employee_count': employee_count,
            'count_source': count_source,
            'source': 'LinkedIn',
            'url': link
        }
        
    except Exception as e:
        return {
            'name': company_name,
            'error': str(e)
        }

# In-memory leaderboard
leaderboard = []

@app.route('/submit-score', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'score' not in data:
            return jsonify({'error': 'Invalid data'}), 400
        
        name = sanitize_input(data['name'])
        score = int(data['score'])
        
        if not name or score < 1:
            return jsonify({'error': 'Invalid data'}), 400
        
        # Add score to leaderboard
        leaderboard.append({
            'name': name,
            'score': score,
            'date': time.strftime('%Y-%m-%d %H:%M')
        })
        
        # Sort leaderboard by score (lower is better)
        leaderboard.sort(key=lambda x: x['score'])
        
        # Keep only top 10 scores
        while len(leaderboard) > 10:
            leaderboard.pop()
            
        return jsonify({'success': True, 'leaderboard': leaderboard})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    return jsonify(leaderboard)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.get_json()
        if not data:
            return jsonify([]), 200
        
        companies = data.get('companies', [])
        if not companies:
            return jsonify([]), 200
        
        # Remove duplicates and empty strings
        companies = list(set(filter(None, [c.strip() for c in companies])))
        
        # Limit to 50 companies at once
        companies = companies[:50]
        
        # Use ThreadPoolExecutor for concurrent processing
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(search_single_company, companies))
        
        return jsonify(results)
        
    except Exception as e:
        print(f"Search error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(host='0.0.0.0', port=port)
