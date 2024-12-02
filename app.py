from flask import Flask, request, jsonify, render_template
from bs4 import BeautifulSoup
import requests
import random
import json
import time
import logging
from urllib.parse import quote_plus
import re
import os
from datetime import datetime, timedelta
from collections import defaultdict
import threading

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('security.log'),
        logging.StreamHandler()
    ]
)
security_logger = logging.getLogger('security')

# Security monitoring
class SecurityMonitor:
    def __init__(self):
        self.ip_requests = defaultdict(list)
        self.blocked_ips = set()
        self.suspicious_activities = []
        self.lock = threading.Lock()
        
        # Start cleanup thread
        self.cleanup_thread = threading.Thread(target=self._cleanup_old_data, daemon=True)
        self.cleanup_thread.start()
    
    def _cleanup_old_data(self):
        while True:
            time.sleep(3600)  # Run every hour
            self.cleanup()
    
    def cleanup(self):
        with self.lock:
            current_time = datetime.now()
            # Clean up requests older than 1 hour
            for ip in list(self.ip_requests.keys()):
                self.ip_requests[ip] = [
                    req for req in self.ip_requests[ip]
                    if current_time - req['timestamp'] < timedelta(hours=1)
                ]
                if not self.ip_requests[ip]:
                    del self.ip_requests[ip]
            
            # Clean up old suspicious activities (keep last 1000)
            if len(self.suspicious_activities) > 1000:
                self.suspicious_activities = self.suspicious_activities[-1000:]
    
    def log_request(self, ip, endpoint, status_code):
        with self.lock:
            if ip in self.blocked_ips:
                return False
            
            current_time = datetime.now()
            self.ip_requests[ip].append({
                'timestamp': current_time,
                'endpoint': endpoint,
                'status_code': status_code
            })
            
            # Check for suspicious patterns
            return self._check_suspicious_activity(ip, endpoint)
    
    def _check_suspicious_activity(self, ip, endpoint):
        requests = self.ip_requests[ip]
        current_time = datetime.now()
        recent_requests = [
            req for req in requests
            if current_time - req['timestamp'] < timedelta(minutes=1)
        ]
        
        # Check rate limiting (more than 60 requests per minute)
        if len(recent_requests) > 60:
            self._log_suspicious("Rate limit exceeded", ip, endpoint)
            self.blocked_ips.add(ip)
            return False
        
        # Check for repeated errors
        error_requests = [
            req for req in recent_requests
            if req['status_code'] >= 400
        ]
        if len(error_requests) > 10:
            self._log_suspicious("Multiple errors", ip, endpoint)
            return False
        
        # Check for suspicious patterns in endpoints
        if endpoint == '/search':
            search_requests = [
                req for req in recent_requests
                if req['endpoint'] == '/search'
            ]
            if len(search_requests) > 20:
                self._log_suspicious("Excessive search requests", ip, endpoint)
                return False
        
        return True
    
    def _log_suspicious(self, reason, ip, endpoint):
        event = {
            'timestamp': datetime.now(),
            'reason': reason,
            'ip': ip,
            'endpoint': endpoint
        }
        self.suspicious_activities.append(event)
        security_logger.warning(f"Suspicious activity: {reason} from IP {ip} on {endpoint}")

# Initialize security monitor
security_monitor = SecurityMonitor()

@app.before_request
def monitor_request():
    ip = request.remote_addr
    endpoint = request.endpoint
    
    if not security_monitor.log_request(ip, endpoint, 200):
        security_logger.warning(f"Blocked request from IP {ip} to {endpoint}")
        return jsonify({'error': 'Too many requests'}), 429

# Security Headers
@app.after_request
def add_security_headers(response):
    # Prevent clickjacking attacks
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    # Enable XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Content Security Policy
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    # HSTS (uncomment if you have HTTPS)
    # response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

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

def sanitize_input(text):
    if not text or not isinstance(text, str):
        return ""
    # Remove any potentially dangerous characters
    return re.sub(r'[<>\'";]', '', text)

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

# Load leaderboard from file or create empty one
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
LEADERBOARD_FILE = os.path.join(DATA_DIR, 'leaderboard.json')
leaderboard = []

def save_leaderboard():
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        temp_file = os.path.join(DATA_DIR, 'temp_leaderboard.json')
        
        # Write to temporary file first
        with open(temp_file, 'w') as f:
            json.dump(leaderboard, f, indent=2)
        
        # Then rename it to the actual file (atomic operation)
        os.replace(temp_file, LEADERBOARD_FILE)
        
        # Also create a backup
        backup_file = os.path.join(DATA_DIR, 'leaderboard_backup.json')
        with open(backup_file, 'w') as f:
            json.dump(leaderboard, f, indent=2)
            
    except Exception as e:
        app.logger.error(f"Error saving leaderboard: {e}")
        raise

def load_leaderboard():
    global leaderboard
    try:
        # Try loading the main file
        if os.path.exists(LEADERBOARD_FILE):
            with open(LEADERBOARD_FILE, 'r') as f:
                leaderboard = json.load(f)
        # If main file doesn't exist, try loading the backup
        elif os.path.exists(os.path.join(DATA_DIR, 'leaderboard_backup.json')):
            with open(os.path.join(DATA_DIR, 'leaderboard_backup.json'), 'r') as f:
                leaderboard = json.load(f)
        else:
            leaderboard = []
            
        # Ensure leaderboard is sorted
        leaderboard.sort(key=lambda x: x['guesses'])
        
        # Keep only top 10 scores
        while len(leaderboard) > 10:
            leaderboard.pop()
            
    except Exception as e:
        app.logger.error(f"Error loading leaderboard: {e}")
        leaderboard = []

# Load leaderboard on startup
load_leaderboard()

@app.route('/submit_score', methods=['POST'])
def submit_score():
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'guesses' not in data:
            return jsonify({'error': 'Invalid data'}), 400
        
        # Validate input
        name = sanitize_input(str(data['name']))[:50]  # Limit name length
        guesses = data['guesses']
        
        # Validate guesses
        if not isinstance(guesses, int) or guesses < 1 or guesses > 100:
            return jsonify({'error': 'Invalid guess count'}), 400
            
        score = {
            'name': name,
            'guesses': guesses,
            'date': time.strftime('%Y-%m-%d %H:%M')
        }
        
        leaderboard.append(score)
        leaderboard.sort(key=lambda x: x['guesses'])
        
        # Keep only top 10 scores
        while len(leaderboard) > 10:
            leaderboard.pop()
        
        # Save to file
        save_leaderboard()
        
        return jsonify({'success': True, 'leaderboard': leaderboard})
    except Exception as e:
        app.logger.error(f"Error in submit_score: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    try:
        # Reload leaderboard from file
        load_leaderboard()
        return jsonify(leaderboard)
    except Exception as e:
        app.logger.error(f"Error in get_leaderboard: {e}")
        return jsonify([])

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    try:
        data = request.get_json()
        if not data or 'companies' not in data:
            return jsonify({'error': 'No companies provided'}), 400

        companies = data['companies'].split('\n')
        results = []
        
        for company in companies[:10]:  # Limit to 10 companies
            company = sanitize_input(company.strip())
            if company:  # Skip empty lines
                try:
                    result = search_company(company)
                    results.append(result)
                except Exception as e:
                    app.logger.error(f"Error searching for {company}: {e}")
                    results.append({
                        'name': company,
                        'error': 'Failed to fetch data'
                    })
        
        return jsonify(results)
    except Exception as e:
        app.logger.error(f"Error in search: {e}")
        return jsonify({'error': 'Server error'}), 500

@app.route('/admin/security', methods=['GET'])
def security_dashboard():
    if request.remote_addr != '127.0.0.1':  # Only allow local access
        return jsonify({'error': 'Unauthorized'}), 403
        
    return jsonify({
        'blocked_ips': list(security_monitor.blocked_ips),
        'suspicious_activities': security_monitor.suspicious_activities,
        'active_ips': len(security_monitor.ip_requests),
        'total_blocked': len(security_monitor.blocked_ips)
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(host='0.0.0.0', port=port)
