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

    // Game Elements
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const gameMessage = document.getElementById('gameMessage');
    const guessList = document.getElementById('guessList');
    const playerNameInput = document.getElementById('playerName');
    const leaderboardBody = document.getElementById('leaderboardBody');
    let targetNumber = null;
    let guesses = [];

    // Initialize game
    startNewGame();
    updateLeaderboard();

    // Game Functions
    function startNewGame() {
        targetNumber = Math.floor(Math.random() * 100) + 1;
        guesses = [];
        updateGuessList();
        updateGameMessage('Make your first guess!', 'info');
        guessInput.value = '';
        guessInput.focus();
    }

    function updateGameMessage(message, type = 'info') {
        gameMessage.textContent = message;
        gameMessage.className = `text-${type === 'error' ? 'red' : 'gray'}-600 font-medium text-center`;
    }

    function updateGuessList() {
        guessList.innerHTML = guesses
            .map((g, i) => `
                <div class="flex items-center space-x-2 animate-fadeIn">
                    <span class="text-gray-500">#${i + 1}:</span>
                    <span class="font-medium">${g}</span>
                </div>
            `)
            .join('');
    }

    async function submitScore(guessCount) {
        const playerName = playerNameInput.value.trim() || 'Anonymous';
        try {
            const response = await fetch('/submit_score', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    name: playerName, 
                    guesses: guessCount 
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                updateLeaderboard();
                showNotification(`Score submitted! You made it in ${guessCount} guesses!`, 'success');
            } else {
                throw new Error('Failed to submit score');
            }
        } catch (error) {
            console.error('Error submitting score:', error);
            showNotification('Error submitting score. Please try again.', 'error');
        }
    }

    async function updateLeaderboard() {
        try {
            const response = await fetch('/leaderboard');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const leaderboard = await response.json();
            leaderboardBody.innerHTML = leaderboard.map((entry, index) => `
                <tr class="hover:bg-gray-50 transition-all duration-200 leaderboard-card">
                    <td class="px-4 py-2 whitespace-nowrap text-sm">
                        ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1)}
                    </td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm font-medium">${escapeHtml(entry.name)}</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm">${entry.guesses} guesses</td>
                    <td class="px-4 py-2 whitespace-nowrap text-sm text-gray-500">${escapeHtml(entry.date)}</td>
                </tr>
            `).join('') || '<tr><td colspan="4" class="text-center py-4">No scores yet!</td></tr>';
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            showNotification('Error loading leaderboard', 'error');
        }
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-100 text-green-800',
            error: 'bg-red-100 text-red-800',
            info: 'bg-blue-100 text-blue-800'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${colors[type]}`;
        notification.textContent = escapeHtml(message);
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateY(10px)';
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    // Game Event Listeners
    guessBtn.addEventListener('click', () => {
        const guess = parseInt(guessInput.value);
        if (isNaN(guess) || guess < 1 || guess > 100) {
            updateGameMessage('Please enter a valid number between 1 and 100', 'error');
            return;
        }

        guesses.push(guess);
        updateGuessList();

        if (guess === targetNumber) {
            updateGameMessage(`Congratulations! You found the number in ${guesses.length} guesses!`, 'success');
            submitScore(guesses.length);
            setTimeout(startNewGame, 3000);
        } else {
            const hint = guess < targetNumber ? 'higher' : 'lower';
            updateGameMessage(`Try a ${hint} number!`, 'info');
        }

        guessInput.value = '';
        guessInput.focus();
    });

    guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            guessBtn.click();
        }
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
