document.addEventListener('DOMContentLoaded', () => {
    // Initialize game
    let targetNumber;
    let attempts;
    let gameActive = false;

    function initGame() {
        targetNumber = Math.floor(Math.random() * 100) + 1;
        attempts = 0;
        gameActive = true;
        document.getElementById('message').textContent = '';
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('guessInput').value = '';
        showNotification('New game started!', 'success');
    }

    // Switch between tabs
    window.switchTab = function(tabName) {
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        contents.forEach(content => {
            if (content.id === tabName) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }

    // Handle guess submission
    window.makeGuess = function() {
        if (!gameActive) {
            initGame();
            return;
        }
        
        const guessInput = document.getElementById('guessInput');
        const guess = parseInt(guessInput.value);
        const messageEl = document.getElementById('message');
        
        if (isNaN(guess) || guess < 1 || guess > 100) {
            showNotification('Please enter a valid number between 1 and 100', 'error');
            return;
        }
        
        attempts++;
        
        if (guess === targetNumber) {
            gameActive = false;
            messageEl.textContent = `Congratulations! You found the number in ${attempts} attempts!`;
            document.getElementById('gameOver').classList.remove('hidden');
            showNotification('🎉 You won!', 'success');
        } else {
            const hint = guess < targetNumber ? 'higher' : 'lower';
            messageEl.textContent = `Try ${hint}! Attempts: ${attempts}`;
            guessInput.value = '';
            guessInput.focus();
        }
    }

    // Submit score
    window.submitScore = async function() {
        const nameInput = document.getElementById('nameInput');
        const name = nameInput.value.trim();
        
        if (!name) {
            showNotification('Please enter your name', 'error');
            return;
        }
        
        try {
            const response = await fetch('/submit-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score: attempts })
            });
            
            if (response.ok) {
                const data = await response.json();
                showNotification('Score submitted successfully!', 'success');
                nameInput.value = '';
                document.getElementById('gameOver').classList.add('hidden');
                updateLeaderboard(data.leaderboard);
                initGame();
            } else {
                throw new Error('Failed to submit score');
            }
        } catch (error) {
            showNotification('Error submitting score', 'error');
            console.error('Error:', error);
        }
    }

    // Company search
    window.searchCompany = async function() {
        const input = document.getElementById('searchInput');
        const query = input.value.trim();
        
        if (!query) {
            showNotification('Please enter a company name', 'error');
            return;
        }
        
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        
        loading.classList.remove('hidden');
        results.innerHTML = '';
        
        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                displayResults(data);
            } else {
                throw new Error(data.error || 'Search failed');
            }
        } catch (error) {
            showNotification(error.message, 'error');
            console.error('Error:', error);
        } finally {
            loading.classList.add('hidden');
        }
    }

    // Dynamic textarea behavior
    const textarea = document.getElementById('companyInput');
    const searchButton = document.getElementById('searchButton');
    const searchContainer = document.querySelector('.search-container');

    // Auto-expand textarea
    function autoExpand() {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
        
        // Add expanded class if there are multiple lines
        if (textarea.value.split('\n').length > 1) {
            textarea.classList.add('expanded');
        } else {
            textarea.classList.remove('expanded');
        }
    }

    // Handle input events
    textarea.addEventListener('input', autoExpand);
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter triggers search
                e.preventDefault();
                searchCompanies();
            }
            // Regular Enter adds new line and expands textarea
            autoExpand();
        }
    });

    // Focus effect
    textarea.addEventListener('focus', function() {
        searchContainer.style.transform = 'scale(1.01)';
    });

    textarea.addEventListener('blur', function() {
        searchContainer.style.transform = 'scale(1)';
    });

    // Batch company search
    window.searchCompanies = async function() {
        const textarea = document.getElementById('companyInput');
        const searchContainer = document.querySelector('.search-container');
        const companiesText = textarea.value.trim();
        
        if (!companiesText) {
            showNotification('Please enter at least one company name', 'error');
            return;
        }

        // Split by newlines and filter empty lines
        const companies = companiesText.split('\n')
            .map(company => company.trim())
            .filter(company => company.length > 0);

        if (companies.length === 0) {
            showNotification('Please enter at least one company name', 'error');
            return;
        }

        if (companies.length > 50) {
            showNotification('Please enter no more than 50 companies at once', 'error');
            return;
        }

        // Show loading state
        document.getElementById('loading').style.display = 'block';
        document.getElementById('results').style.display = 'none';
        document.getElementById('noResults').style.display = 'none';
        document.getElementById('searchButton').disabled = true;
        searchContainer.classList.add('searching');

        // Make API request
        fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ companies: companies })
        })
        .then(response => response.json())
        .then(data => {
            displayResults(data);
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred while searching. Please try again.', 'error');
        })
        .finally(() => {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('searchButton').disabled = false;
            searchContainer.classList.remove('searching');
        });
    }

    // Display search results
    function displayResults(companies) {
        const results = document.getElementById('results');
        const resultsTable = document.getElementById('resultsTable');
        const noResults = document.getElementById('noResults');
        
        results.innerHTML = '';
        
        if (!companies || companies.length === 0) {
            resultsTable.classList.add('hidden');
            noResults.classList.remove('hidden');
            return;
        }
        
        resultsTable.classList.remove('hidden');
        noResults.classList.add('hidden');
        
        // Group results by company name
        const groupedResults = {};
        companies.forEach(company => {
            if (!groupedResults[company.name]) {
                groupedResults[company.name] = [];
            }
            groupedResults[company.name].push(company);
        });
        
        // Display each company's results
        Object.entries(groupedResults).forEach(([companyName, sources]) => {
            // Add company header
            const headerRow = document.createElement('tr');
            headerRow.className = 'company-header';
            headerRow.innerHTML = `
                <td colspan="5">
                    <h3>${escapeHtml(companyName)}</h3>
                </td>
            `;
            results.appendChild(headerRow);
            
            // Add each source's data
            sources.forEach(data => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="source">
                            <span class="source-icon">📊</span>
                            ${escapeHtml(data.source || 'Unknown')}
                        </div>
                    </td>
                    <td>
                        ${data.employee_count ? 
                            `<div class="employee-count">
                                ${data.employee_count.toLocaleString()}
                                <span class="count-type">${data.count_source === 'Singapore specific' ? '(SG)' : '(Global)'}</span>
                             </div>` : 
                            'Not specified'}
                    </td>
                    <td>${escapeHtml(data.location || 'Unknown')}</td>
                    <td>${new Date().toLocaleDateString()}</td>
                    <td>
                        <a href="${data.website}" target="_blank" class="view-link">
                            View Source <span class="arrow">→</span>
                        </a>
                    </td>
                `;
                results.appendChild(row);
            });
        });
    }

    // Display batch search results
    function displayResults(results) {
        const resultsBody = document.getElementById('resultsBody');
        resultsBody.innerHTML = '';

        if (!results || results.length === 0) {
            document.getElementById('results').style.display = 'none';
            document.getElementById('noResults').style.display = 'block';
            return;
        }

        results.forEach(result => {
            const row = document.createElement('tr');
            
            // Company name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = result.error ? 
                `${result.name} (Error: ${result.error})` : 
                result.found_name || result.name;
            row.appendChild(nameCell);
            
            // Employee count cell
            const countCell = document.createElement('td');
            if (result.employee_count) {
                const countSpan = document.createElement('span');
                countSpan.className = 'badge ' + 
                    (result.count_source === 'Singapore specific' ? 'sg-badge' : 'global-badge');
                countSpan.textContent = `${result.employee_count} (${result.count_source})`;
                countCell.appendChild(countSpan);
            } else {
                countCell.textContent = 'N/A';
            }
            row.appendChild(countCell);
            
            // Source cell
            const sourceCell = document.createElement('td');
            sourceCell.textContent = result.source || 'N/A';
            row.appendChild(sourceCell);
            
            // Link cell
            const linkCell = document.createElement('td');
            if (result.url) {
                const link = document.createElement('a');
                link.href = result.url;
                link.target = '_blank';
                link.textContent = 'View';
                linkCell.appendChild(link);
            } else {
                linkCell.textContent = 'N/A';
            }
            row.appendChild(linkCell);
            
            resultsBody.appendChild(row);
        });

        document.getElementById('results').style.display = 'block';
        document.getElementById('noResults').style.display = 'none';
    }

    // Update leaderboard
    function updateLeaderboard(scores) {
        const leaderboard = document.getElementById('leaderboard');
        leaderboard.innerHTML = '';
        
        scores.forEach((score, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(score.name)}</td>
                <td>${score.score} attempts</td>
            `;
            leaderboard.appendChild(row);
        });
    }

    // Typing effect for console messages
    function typeText(element, text, speed = 50) {
        let i = 0;
        element.textContent = '';
        return new Promise(resolve => {
            function type() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                } else {
                    resolve();
                }
            }
            type();
        });
    }

    // Show notification with typing effect
    window.showNotification = async function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '> ';
        
        const text = document.createElement('span');
        text.className = 'message';
        
        notification.appendChild(prompt);
        notification.appendChild(text);
        document.body.appendChild(notification);
        
        await typeText(text, message, 30);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };

    async function searchCompanies() {
        const textarea = document.getElementById('companyInput');
        const companies = textarea.value.trim();
        
        if (!companies) {
            showNotification('Please enter at least one company name', 'error');
            return;
        }

        const searchButton = document.getElementById('searchButton');
        const loadingDiv = document.getElementById('loading');
        const resultsDiv = document.getElementById('results');
        const noResultsDiv = document.getElementById('noResults');
        const resultsBody = document.getElementById('resultsBody');

        // Disable search
        searchButton.disabled = true;
        textarea.disabled = true;

        // Show loading with typing effect
        loadingDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        noResultsDiv.style.display = 'none';
        
        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companies: companies.split('\n').filter(c => c.trim()) })
            });

            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            
            // Clear previous results
            resultsBody.innerHTML = '';
            
            if (data.length === 0) {
                noResultsDiv.style.display = 'block';
            } else {
                // Add new results with typing effect
                data.forEach((result, index) => {
                    setTimeout(() => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${result.company}</td>
                            <td>${result.employee_count}</td>
                            <td>
                                <span class="badge ${result.is_sg ? 'sg-badge' : 'global-badge'}">
                                    ${result.is_sg ? 'SG' : 'Global'}
                                </span>
                            </td>
                            <td>
                                <a href="${result.url}" target="_blank" rel="noopener noreferrer">
                                    View Source
                                </a>
                            </td>
                        `;
                        resultsBody.appendChild(row);
                        row.style.animation = 'fadeIn 0.3s ease forwards';
                    }, index * 100);
                });
                
                resultsDiv.style.display = 'block';
            }
        } catch (error) {
            showNotification('An error occurred while searching. Please try again.', 'error');
        } finally {
            // Re-enable search
            searchButton.disabled = false;
            textarea.disabled = false;
            loadingDiv.style.display = 'none';
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize game on load
    initGame();
});
