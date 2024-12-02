# Company Information Scraper

A web application that searches for company employee information across multiple sources including Google, LinkedIn, and company websites.

## Features
- Multi-company search support
- Concurrent processing for faster results
- Clean, modern UI using Tailwind CSS
- Mobile-responsive design

## Local Development
1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Visit `http://127.0.0.1:5000` in your browser

## Deployment
This application can be deployed to Render.com:

1. Create a new account on [Render](https://render.com)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Fill in the following details:
   - Name: company-info-scraper (or your preferred name)
   - Environment: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
5. Click "Create Web Service"

## Environment Variables
None required for basic functionality.
