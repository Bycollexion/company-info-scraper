document.addEventListener('DOMContentLoaded', () => {
    const companiesTextarea = document.getElementById('companies');
    const searchBtn = document.getElementById('searchBtn');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const progressDiv = document.createElement('div');
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

    function createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-lg p-6 mb-4 transform transition-all duration-300 hover:shadow-xl';
        
        let content = `
            <h2 class="text-xl font-bold mb-4 text-gray-800">${result.company_name}</h2>
        `;

        if (result.error) {
            content += `
                <div class="text-red-500 mb-2">Error: ${result.error}</div>
            `;
        } else {
            content += `
                <div class="space-y-3">
                    <div class="flex items-center">
                        <span class="font-semibold text-gray-700 w-32">Employee Count:</span>
                        <span class="text-gray-800">${result.employee_count || 'Not found'}</span>
                    </div>
            `;

            if (result.company_website) {
                content += `
                    <div class="flex items-center">
                        <span class="font-semibold text-gray-700 w-32">Website:</span>
                        <a href="${result.company_website}" target="_blank" class="text-blue-500 hover:text-blue-700 truncate">${result.company_website}</a>
                    </div>
                `;
            }

            if (result.sources && result.sources.length > 0) {
                content += `
                    <div class="flex items-start">
                        <span class="font-semibold text-gray-700 w-32">Sources:</span>
                        <div class="flex flex-wrap gap-2">
                            ${result.sources.map(source => 
                                `<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${source}</span>`
                            ).join('')}
                        </div>
                    </div>
                `;
            }

            if (result.all_counts) {
                content += `
                    <div class="mt-4">
                        <div class="font-semibold text-gray-700 mb-2">Detailed Counts:</div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            ${Object.entries(result.all_counts).map(([source, count]) => `
                                <div class="flex items-center justify-between bg-gray-50 p-2 rounded">
                                    <span class="text-gray-600 capitalize">${source}:</span>
                                    <span class="font-medium">${count}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            content += '</div>';
        }

        card.innerHTML = content;
        return card;
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

        // Clear previous results
        resultsDiv.innerHTML = '';
        loadingDiv.classList.remove('hidden');
        progressDiv.classList.remove('hidden');
        searchBtn.disabled = true;

        // Close any existing EventSource
        if (eventSource) {
            eventSource.close();
        }

        let processedCount = 0;
        const totalCompanies = companies.length;

        try {
            // Create new EventSource for server-sent events
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
                
                const card = createResultCard(result);
                resultsDiv.appendChild(card);
                
                // Scroll the new card into view with smooth animation
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
                
                resultsDiv.innerHTML = `
                    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        An error occurred while fetching the results. Please try again.
                    </div>
                `;
            };

        } catch (error) {
            console.error('Error:', error);
            loadingDiv.classList.add('hidden');
            searchBtn.disabled = false;
            progressDiv.classList.add('hidden');
            
            resultsDiv.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    An error occurred while fetching the results. Please try again.
                </div>
            `;
        }
    });
});
