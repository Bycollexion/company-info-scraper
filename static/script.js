document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active', 'border-blue-500', 'text-blue-600'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active', 'border-blue-500', 'text-blue-600');
            document.getElementById(`${btn.dataset.tab}-content`).classList.add('active');
        });
    });

    // Company Info Scraper Logic
    const companiesTextarea = document.getElementById('companies');
    const searchBtn = document.getElementById('searchBtn');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const progressDiv = document.createElement('div');
    const resultsTable = document.getElementById('resultsTable');
    const resultsTableBody = document.getElementById('resultsTableBody');

    progressDiv.className = 'text-center mb-4 hidden';
    loadingDiv.parentNode.insertBefore(progressDiv, loadingDiv.nextSibling);

    let eventSource = null;

    function updateProgress(processed, total) {
        progressDiv.innerHTML = `
            <div class="mb-2">Processed ${processed} of ${total} companies</div>
            <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${(processed/total * 100)}%"></div>
            </div>
        `;
    }

    function createTableRow(result) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        // Company Name
        const nameCell = document.createElement('td');
        nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
        nameCell.textContent = result.company_name;
        
        // Employee Count
        const countCell = document.createElement('td');
        countCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
        countCell.textContent = result.employee_count || 'Not found';
        
        // Website
        const websiteCell = document.createElement('td');
        websiteCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
        if (result.company_website) {
            const link = document.createElement('a');
            link.href = result.company_website;
            link.textContent = result.company_website;
            link.className = 'text-blue-600 hover:text-blue-800';
            link.target = '_blank';
            websiteCell.appendChild(link);
        } else {
            websiteCell.textContent = 'Not found';
        }
        
        // Sources
        const sourcesCell = document.createElement('td');
        sourcesCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
        if (result.sources && result.sources.length > 0) {
            sourcesCell.innerHTML = result.sources.map(source => 
                `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-1">
                    ${source}
                </span>`
            ).join('');
        }
        
        // Details
        const detailsCell = document.createElement('td');
        detailsCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
        if (result.all_counts) {
            detailsCell.innerHTML = Object.entries(result.all_counts).map(([source, count]) =>
                `<div class="text-xs">
                    <span class="font-medium">${source}:</span> ${count}
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
            alert('Please enter at least one company name');
            return;
        }

        // Clear previous results and show loading
        resultsTableBody.innerHTML = '';
        loadingDiv.classList.remove('hidden');
        progressDiv.classList.remove('hidden');
        searchBtn.disabled = true;
        resultsTable.classList.remove('hidden');

        // Close any existing EventSource
        if (eventSource) {
            eventSource.close();
        }

        let processedCount = 0;
        const totalCompanies = companies.length;

        try {
            eventSource = new EventSource('/search', {
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companies }),
                method: 'POST',
            });

            eventSource.onmessage = (event) => {
                const result = JSON.parse(event.data);
                processedCount++;
                updateProgress(processedCount, totalCompanies);
                
                const row = createTableRow(result);
                resultsTableBody.appendChild(row);
                
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                if (processedCount === totalCompanies) {
                    eventSource.close();
                    loadingDiv.classList.add('hidden');
                    searchBtn.disabled = false;
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                eventSource.close();
                loadingDiv.classList.add('hidden');
                searchBtn.disabled = false;
                progressDiv.classList.add('hidden');
                
                resultsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-4 text-center text-red-500">
                            An error occurred while fetching the results. Please try again.
                        </td>
                    </tr>
                `;
            };

        } catch (error) {
            console.error('Error:', error);
            loadingDiv.classList.add('hidden');
            searchBtn.disabled = false;
            progressDiv.classList.add('hidden');
            
            resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-red-500">
                        An error occurred while fetching the results. Please try again.
                    </td>
                </tr>
            `;
        }
    });

    // Number Guessing Game Logic
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const newGameBtn = document.getElementById('newGameBtn');
    const gameMessage = document.getElementById('gameMessage');
    const guessList = document.getElementById('guessList');

    let targetNumber = Math.floor(Math.random() * 100) + 1;
    let guesses = [];

    function updateGameMessage(message, type) {
        gameMessage.className = 'mt-4 p-4 rounded-md';
        gameMessage.classList.add(type === 'success' ? 'bg-green-100' : 'bg-yellow-100');
        gameMessage.textContent = message;
    }

    function updateGuessList() {
        guessList.innerHTML = guesses.map(guess => 
            `<span class="px-2 py-1 bg-gray-100 rounded-full text-sm">${guess}</span>`
        ).join('');
    }

    function startNewGame() {
        targetNumber = Math.floor(Math.random() * 100) + 1;
        guesses = [];
        guessInput.value = '';
        gameMessage.textContent = '';
        gameMessage.className = 'mt-4 p-4 rounded-md';
        updateGuessList();
    }

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
            guessBtn.disabled = true;
        } else {
            const message = guess < targetNumber ? 'Too low!' : 'Too high!';
            updateGameMessage(message, 'warning');
        }

        guessInput.value = '';
        guessInput.focus();
    });

    newGameBtn.addEventListener('click', () => {
        startNewGame();
        guessBtn.disabled = false;
    });

    guessInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !guessBtn.disabled) {
            guessBtn.click();
        }
    });
});
