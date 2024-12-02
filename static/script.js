document.addEventListener('DOMContentLoaded', () => {
    const companiesTextarea = document.getElementById('companies');
    const searchBtn = document.getElementById('searchBtn');
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');

    searchBtn.addEventListener('click', async () => {
        const companies = companiesTextarea.value
            .split('\n')
            .map(company => company.trim())
            .filter(company => company.length > 0);

        if (companies.length === 0) {
            alert('Please enter at least one company name');
            return;
        }

        // Show loading state
        loadingDiv.classList.remove('hidden');
        resultsDiv.innerHTML = '';
        searchBtn.disabled = true;

        try {
            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ companies }),
            });

            const data = await response.json();
            
            // Create results cards
            data.forEach(result => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-lg shadow-lg p-6';
                
                let content = `
                    <h2 class="text-xl font-bold mb-4">${result.company_name}</h2>
                `;

                if (result.error) {
                    content += `
                        <p class="text-red-500">Error: ${result.error}</p>
                    `;
                } else {
                    content += `
                        <div class="space-y-2">
                            <p><span class="font-semibold">Employee Count:</span> ${result.employee_count || 'Not found'}</p>
                            <p><span class="font-semibold">Company Website:</span> ${result.company_website ? `<a href="${result.company_website}" target="_blank" class="text-blue-500 hover:underline">${result.company_website}</a>` : 'Not found'}</p>
                            <p><span class="font-semibold">Sources:</span> ${result.sources.join(', ')}</p>
                        </div>
                    `;
                }

                card.innerHTML = content;
                resultsDiv.appendChild(card);
            });
        } catch (error) {
            console.error('Error:', error);
            resultsDiv.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    An error occurred while fetching the results. Please try again.
                </div>
            `;
        } finally {
            // Hide loading state
            loadingDiv.classList.add('hidden');
            searchBtn.disabled = false;
        }
    });
});
