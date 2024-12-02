document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and its content
            btn.classList.add('active');
            const content = document.getElementById(`${btn.dataset.tab}-content`);
            if (content) {
                content.classList.add('active');
            }
        });
    });

    // Game state
    let targetNumber;
    let attempts;
    let gameActive = false;

    // Initialize the game
    function initGame() {
        targetNumber = Math.floor(Math.random() * 100) + 1;
        attempts = 0;
        gameActive = true;
        document.getElementById('message').textContent = '';
        document.getElementById('gameOver').classList.add('hidden');
        document.getElementById('guessInput').value = '';
        showNotification('New game started!', 'success');
    }

    // Switch between tabs with animation
    function switchTab(tabName) {
        const tabs = ['search', 'game'];
        const buttons = document.querySelectorAll('.tab-btn');
        
        tabs.forEach(tab => {
            const content = document.getElementById(tab);
            const isActive = tab === tabName;
            
            if (isActive) {
                content.style.display = 'block';
                setTimeout(() => {
                    content.classList.add('active');
                }, 50);
            } else {
                content.classList.remove('active');
                setTimeout(() => {
                    content.style.display = 'none';
                }, 300);
            }
        });
        
        buttons.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tabName)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Handle guess submission with animations
    function makeGuess() {
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
        messageEl.classList.remove('animate-fadeIn');
        
        setTimeout(() => {
            messageEl.classList.add('animate-fadeIn');
            
            if (guess === targetNumber) {
                gameActive = false;
                messageEl.textContent = `Congratulations! You found the number in ${attempts} attempts!`;
                messageEl.style.color = '#059669';
                document.getElementById('gameOver').classList.remove('hidden');
                showNotification('🎉 You won!', 'success');
            } else {
                const hint = guess < targetNumber ? 'higher' : 'lower';
                messageEl.textContent = `Try ${hint}! Attempts: ${attempts}`;
                messageEl.style.color = '#4F46E5';
                guessInput.value = '';
                guessInput.focus();
            }
        }, 50);
    }

    // Submit score with animation
    async function submitScore() {
        const nameInput = document.getElementById('nameInput');
        const name = nameInput.value.trim();
        
        if (!name) {
            showNotification('Please enter your name', 'error');
            return;
        }
        
        try {
            const response = await fetch('/submit_score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score: attempts })
            });
            
            if (response.ok) {
                showNotification('Score submitted successfully!', 'success');
                nameInput.value = '';
                document.getElementById('gameOver').classList.add('hidden');
                await updateLeaderboard();
                initGame();
            } else {
                throw new Error('Failed to submit score');
            }
        } catch (error) {
            showNotification('Error submitting score', 'error');
            console.error('Error:', error);
        }
    }

    // Company search with loading animation
    async function searchCompany() {
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
                if (data.length === 0) {
                    showNotification('No results found', 'info');
                }
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

    // Display search results with animation
    function displayResults(companies) {
        const results = document.getElementById('results');
        results.innerHTML = '';
        
        companies.forEach((company, index) => {
            const card = document.createElement('div');
            card.className = 'result-card animate-fadeIn';
            card.style.animationDelay = `${index * 100}ms`;
            
            card.innerHTML = `
                <h3 class="text-xl font-semibold mb-2">${escapeHtml(company.name)}</h3>
                <p class="text-gray-600 mb-2">${escapeHtml(company.description || 'No description available')}</p>
                ${company.website ? `<a href="${escapeHtml(company.website)}" target="_blank" class="text-indigo-600 hover:text-indigo-800">Visit Website</a>` : ''}
            `;
            
            results.appendChild(card);
        });
    }

    // Update leaderboard with animation
    async function updateLeaderboard() {
        try {
            const response = await fetch('/leaderboard');
            const data = await response.json();
            
            const leaderboard = document.getElementById('leaderboard');
            leaderboard.innerHTML = '';
            
            data.forEach((entry, index) => {
                const row = document.createElement('tr');
                row.className = 'leaderboard-card animate-slideIn';
                row.style.animationDelay = `${index * 100}ms`;
                
                row.innerHTML = `
                    <td class="px-6 py-4">${index + 1}</td>
                    <td class="px-6 py-4">${escapeHtml(entry.name)}</td>
                    <td class="px-6 py-4">${entry.score} attempts</td>
                `;
                
                leaderboard.appendChild(row);
            });
        } catch (error) {
            console.error('Error updating leaderboard:', error);
        }
    }

    // Show notification with animation
    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
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

    // Game Elements
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const gameMessage = document.getElementById('gameMessage');
    const guessList = document.getElementById('guessList');
    const playerNameInput = document.getElementById('playerName');
    const leaderboardBody = document.getElementById('leaderboardBody');

    // Initialize game
    initGame();
    updateLeaderboard();

    // Game Event Listeners
    guessBtn.addEventListener('click', makeGuess);

    guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') makeGuess();
    });

    // Company Info Scraper Logic with Enhanced UI
    const companiesTextarea = document.getElementById('companies');
    const searchBtn = document.getElementById('searchBtn');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const progressDiv = document.createElement('div');
    const resultsTable = document.getElementById('resultsTable');
    const resultsTableBody = document.getElementById('resultsTableBody');

    progressDiv.className = 'text-center mb-4 hidden';
    loadingDiv.parentNode.insertBefore(progressDiv, loadingDiv.nextSibling);

    function updateProgress(processed, total) {
        const percentage = (processed/total * 100).toFixed(1);
        progressDiv.innerHTML = `
            <div class="mb-3 text-gray-600">Processing Companies...</div>
            <div class="text-lg font-semibold mb-2">${processed} of ${total} companies</div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" style="width: ${percentage}%"></div>
            </div>
        `;
    }

    function createTableRow(result) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors duration-150';
        
        // Company Name with animation
        const nameCell = document.createElement('td');
        nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
        nameCell.textContent = result.company_name;
        
        // Employee Count with badge
        const countCell = document.createElement('td');
        countCell.className = 'px-6 py-4 whitespace-nowrap text-sm';
        if (result.employee_count) {
            countCell.innerHTML = `
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ${result.employee_count}
                </span>
            `;
        } else {
            countCell.innerHTML = `
                <span class="text-gray-500">Not found</span>
            `;
        }
        
        // Website with hover effect
        const websiteCell = document.createElement('td');
        websiteCell.className = 'px-6 py-4 whitespace-nowrap text-sm';
        if (result.company_website) {
            const link = document.createElement('a');
            link.href = result.company_website;
            link.textContent = result.company_website;
            link.className = 'text-indigo-600 hover:text-indigo-900 transition-colors duration-150';
            link.target = '_blank';
            websiteCell.appendChild(link);
        } else {
            websiteCell.innerHTML = `<span class="text-gray-500">Not found</span>`;
        }
        
        // Sources with modern badges
        const sourcesCell = document.createElement('td');
        sourcesCell.className = 'px-6 py-4 whitespace-nowrap text-sm';
        if (result.sources && result.sources.length > 0) {
            sourcesCell.innerHTML = result.sources.map(source => 
                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-1 mb-1">
                    ${source}
                </span>`
            ).join('');
        }
        
        // Details with organized layout
        const detailsCell = document.createElement('td');
        detailsCell.className = 'px-6 py-4 whitespace-nowrap text-sm';
        if (result.all_counts) {
            detailsCell.innerHTML = Object.entries(result.all_counts).map(([source, count]) =>
                `<div class="flex items-center space-x-2 mb-1">
                    <span class="font-medium text-gray-700">${source}:</span>
                    <span class="text-gray-600">${count}</span>
                </div>`
            ).join('');
        }
        
        row.append(nameCell, countCell, websiteCell, sourcesCell, detailsCell);
        return row;
    }

    searchBtn.addEventListener('click', async () => {
        const companies = companiesTextarea.value
            .split('\n')
            .map(company => company.trim())
            .filter(company => company.length > 0);

        if (companies.length === 0) {
            showNotification('Please enter at least one company name', 'error');
            return;
        }

        // Clear previous results and show loading
        resultsTableBody.innerHTML = '';
        loadingDiv.classList.remove('hidden');
        progressDiv.classList.remove('hidden');
        searchBtn.disabled = true;
        searchBtn.classList.add('opacity-50', 'cursor-not-allowed');
        resultsTable.classList.remove('hidden');

        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companies })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            
            results.forEach((result, index) => {
                updateProgress(index + 1, results.length);
                const row = createTableRow(result);
                row.style.opacity = '0';
                row.style.transform = 'translateY(20px)';
                resultsTableBody.appendChild(row);
                
                // Animate row entrance
                setTimeout(() => {
                    row.style.transition = 'all 0.5s ease';
                    row.style.opacity = '1';
                    row.style.transform = 'translateY(0)';
                }, index * 100);
            });

        } catch (error) {
            console.error('Error:', error);
            showNotification('An error occurred while fetching the results. Please try again.', 'error');
        } finally {
            loadingDiv.classList.add('hidden');
            searchBtn.disabled = false;
            searchBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            progressDiv.classList.add('hidden');
        }
    });
});
