document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const startScrapingBtn = document.getElementById('startScrapingBtn');
    const statusContainer = document.getElementById('statusContainer');
    const statusMessage = document.getElementById('statusMessage');
    const progressBar = document.getElementById('progressBar');
    const resultsContainer = document.getElementById('resultsContainer');
    const totalFound = document.getElementById('totalFound');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const searchInput = document.getElementById('searchInput');
    const paginationControls = document.getElementById('paginationControls');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');

    let ws;
    let allResults = [];
    let currentPage = 1;
    const rowsPerPage = 100;

    /**
     * Safely extract a string value from an item, trying multiple field names.
     */
    function getField(item, ...fieldNames) {
        for (const name of fieldNames) {
            const val = item[name];
            if (val !== undefined && val !== null && val !== '') {
                return val;
            }
        }
        return '';
    }

    /**
     * Normalize a company item to a consistent shape.
     * Handles all field name variations from the backend.
     */
    function normalizeCompanyItem(item) {
        // --- Company Name ---
        const companyName = getField(item, 'companyName', 'name', 'title') || 'N/A';

        // --- Website URL ---
        const companyUrl = getField(item, 'companyUrl', 'websiteUrl', 'website', 'url') || '';

        // --- Email ---
        const companyEmail = (() => {
            const raw = getField(item, 'companyEmail', 'email');
            if (raw) return raw;
            if (Array.isArray(item.emails) && item.emails.length > 0) {
                return item.emails.join(', ');
            }
            return '';
        })();

        // --- Phone ---
        const companyPhone = (() => {
            const raw = getField(item, 'companyPhone', 'phone', 'phoneNumber');
            if (raw) return raw;
            if (Array.isArray(item.phoneNumbers) && item.phoneNumbers.length > 0) {
                return item.phoneNumbers.join(', ');
            }
            return '';
        })();

        // --- Services (detectedServices) ---
        const services = (() => {
            // Try detectedServices first (from analyzer)
            if (Array.isArray(item.detectedServices) && item.detectedServices.length > 0) {
                return item.detectedServices.filter(s => s && s !== 'No Services');
            }
            // Try services array
            if (Array.isArray(item.services) && item.services.length > 0) {
                return item.services.filter(s => s && s !== 'No Services');
            }
            // Try service string
            if (typeof item.service === 'string' && item.service && item.service !== 'No Services') {
                return [item.service];
            }
            return [];
        })();

        // --- Technologies (tech stack) ---
        const technologies = (() => {
            if (Array.isArray(item.technologies) && item.technologies.length > 0) {
                return item.technologies;
            }
            if (Array.isArray(item.techStack) && item.techStack.length > 0) {
                return item.techStack;
            }
            if (typeof item.techStack === 'string' && item.techStack) {
                return [item.techStack];
            }
            return [];
        })();

        return {
            ...item,
            companyName,
            companyUrl,
            companyEmail,
            companyPhone,
            services,
            technologies,
        };
    }

    // --- Dark Mode ---
    const applyTheme = (isDark) => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            document.documentElement.classList.remove('dark');
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    };

    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    applyTheme(isDarkMode);

    darkModeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('darkMode', isDark);
        applyTheme(isDark);
    });

    // --- WebSocket Logic ---
    function connectWebSocket(onOpenCallback) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (ws && ws.readyState !== WebSocket.CLOSED) {
            ws.close();
        }
        ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            console.log('WebSocket connected');
            if (onOpenCallback) onOpenCallback();
        };
        ws.onclose = () => console.log('WebSocket disconnected');
        ws.onerror = (error) => console.error('WebSocket error:', error);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
    }

    function handleWebSocketMessage(data) {
        switch (data.type) {
            case 'STATUS_UPDATE':
                statusMessage.textContent = data.message;
                break;
            case 'PROGRESS_UPDATE':
                progressBar.style.width = `${data.progress}%`;
                statusMessage.textContent = data.message;
                break;
            case 'TOTAL_COMPANIES':
                totalFound.textContent = `0 / ${data.total}`;
                break;
            case 'DATA_UPDATE':
                allResults.push(data.company);
                totalFound.textContent = `${allResults.length} / ${parseInt(totalFound.textContent.split('/')[1], 10) || allResults.length}`;
                renderTable();
                enableExportButtons();
                break;
            case 'EXPORT_READY':
                setupExportLinks(data.exportFiles);
                enableExportButtons();
                if (data.count) {
                    statusMessage.textContent = `${data.count} companies ready — you can Export Excel anytime`;
                }
                break;
            case 'SCRAPING_COMPLETE':
                statusMessage.textContent = data.message;
                startScrapingBtn.disabled = false;
                progressBar.style.width = '100%';
                progressBar.classList.remove('bg-blue-600');
                progressBar.classList.add('bg-green-600');
                setupExportLinks(data.exportFiles);
                enableExportButtons();
                break;
            case 'ERROR':
                statusMessage.textContent = `Error: ${data.message}`;
                statusMessage.classList.add('text-red-500');
                startScrapingBtn.disabled = false;
                enableExportButtons();
                break;
        }
    }

    function enableExportButtons() {
        const hasRows = allResults.length > 0;
        exportCsvBtn.disabled = !hasRows;
        exportExcelBtn.disabled = !hasRows;
        exportJsonBtn.disabled = !hasRows;
        if (hasRows) {
            exportExcelBtn.textContent = `Export Excel (${allResults.length})`;
            exportCsvBtn.textContent = `Export CSV (${allResults.length})`;
            exportJsonBtn.textContent = `Export JSON (${allResults.length})`;
        }
    }

    async function downloadCurrentExport(format) {
        if (!allResults.length) {
            alert('No scraped details yet. Wait until at least one company appears.');
            return;
        }
        const btn = format === 'csv' ? exportCsvBtn : format === 'json' ? exportJsonBtn : exportExcelBtn;
        const prev = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Preparing file...';
        try {
            const response = await fetch('/api/export-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ results: allResults, format }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Export failed (${response.status})`);
            }
            const blob = await response.blob();
            const ext = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'xlsx';
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `scrape-results-${allResults.length}-${stamp}.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch (error) {
            console.error(error);
            alert(error.message || 'Could not export file.');
        } finally {
            enableExportButtons();
            if (!allResults.length) {
                btn.textContent = prev;
            }
        }
    }

    function setupExportLinks(files) {
        enableExportButtons();
        exportCsvBtn.onclick = () => downloadCurrentExport('csv');
        exportExcelBtn.onclick = () => downloadCurrentExport('excel');
        exportJsonBtn.onclick = () => downloadCurrentExport('json');
        if (files && files.excel) {
            exportExcelBtn.dataset.serverFile = files.excel;
        }
    }

    async function downloadCompanyDetails(sourceIndex, format, buttonEl) {
        const company = allResults[sourceIndex];
        if (!company) {
            alert('Company details are not available yet.');
            return;
        }
        const prev = buttonEl ? buttonEl.textContent : '';
        if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.textContent = '...';
        }
        try {
            const response = await fetch('/api/export-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ results: [company], format }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Export failed (${response.status})`);
            }
            const blob = await response.blob();
            const normalized = normalizeCompanyItem(company);
            const safeName = String(normalized.companyName || 'company')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 60) || 'company';
            const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'xlsx';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${safeName}-details.${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch (error) {
            console.error(error);
            alert(error.message || 'Could not download this company.');
        } finally {
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.textContent = prev;
            }
        }
    }

    // --- UI Logic ---
    startScrapingBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a Google Search URL.');
            return;
        }

        // Reset UI
        startScrapingBtn.disabled = true;
        statusContainer.classList.remove('hidden');
        resultsContainer.classList.remove('hidden');
        resultsTableBody.innerHTML = '';
        allResults = [];
        totalFound.textContent = '0 / 0'; // Reset total found display
        currentPage = 1;
        statusMessage.classList.remove('text-red-500');
        progressBar.style.width = '0%';
        progressBar.classList.remove('bg-green-600');
        progressBar.classList.add('bg-blue-600');
        exportCsvBtn.textContent = 'Export CSV';
        exportExcelBtn.textContent = 'Export Excel';
        exportJsonBtn.textContent = 'Export JSON';
        exportCsvBtn.disabled = true;
        exportExcelBtn.disabled = true;
        exportJsonBtn.disabled = true;
        setupExportLinks({});

        const startScraping = () => {
            ws.send(JSON.stringify({ type: 'START_SCRAPING', url }));
            statusMessage.textContent = 'Scraping started...'; // Update status after sending
        };

        if (ws && ws.readyState === WebSocket.OPEN) {
            startScraping();
        } else {
            // If not open, connect and then send the message once connected
            connectWebSocket(startScraping);
        }
    });

    // --- Table & Pagination ---
    function renderTable() {
        const query = searchInput.value.toLowerCase();
        const normalizedResults = allResults.map((item, index) => ({
            ...normalizeCompanyItem(item),
            _sourceIndex: index,
        }));
        const filteredResults = normalizedResults.filter(item => {
            if (!query) return true;
            const searchText = [
                item.companyName,
                item.companyUrl,
                item.companyEmail,
                item.companyPhone,
                ...(Array.isArray(item.services) ? item.services : []),
                ...(Array.isArray(item.technologies) ? item.technologies : []),
            ].filter(Boolean).join(' ').toLowerCase();
            return searchText.includes(query);
        });

        resultsTableBody.innerHTML = '';
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedResults = filteredResults.slice(startIndex, endIndex);

        paginatedResults.forEach(item => {
            const row = document.createElement('tr');

            const services = Array.isArray(item.services) ? item.services : [];
            const technologies = Array.isArray(item.technologies) ? item.technologies : [];

            row.innerHTML = `
                <td class="table-cell font-medium">${escapeHtml(item.companyName)}</td>
                <td class="table-cell">
                    ${item.companyUrl
                    ? `<a href="${escapeHtml(item.companyUrl)}" target="_blank" class="text-blue-500 hover:underline truncate block max-w-xs">${escapeHtml(item.companyUrl)}</a>`
                    : '<span style="color:#9ca3af">N/A</span>'
                }
                </td>
                <td class="table-cell">${item.companyEmail ? escapeHtml(item.companyEmail) : '<span style="color:#9ca3af">N/A</span>'}</td>
                <td class="table-cell">${item.companyPhone ? escapeHtml(item.companyPhone) : '<span style="color:#9ca3af">N/A</span>'}</td>
                <td class="table-cell">
                    ${services.length > 0
                    ? services.slice(0, 5).map(s =>
                        `<span style="display:inline-block;margin:1px 2px;padding:2px 7px;border-radius:9999px;font-size:11px;background:#fce7f3;color:#9d174d;">${escapeHtml(s)}</span>`
                    ).join('')
                    : '<span style="color:#9ca3af">N/A</span>'
                }
                    ${services.length > 5 ? `<span style="font-size:11px;color:#9ca3af">+${services.length - 5} more</span>` : ''}
                </td>
                <td class="table-cell">
                    ${technologies.length > 0
                    ? technologies.slice(0, 5).map(t =>
                        `<span style="display:inline-block;margin:1px 2px;padding:2px 7px;border-radius:9999px;font-size:11px;background:#dbeafe;color:#1e40af;">${escapeHtml(t)}</span>`
                    ).join('')
                    : '<span style="color:#9ca3af">N/A</span>'
                }
                    ${technologies.length > 5 ? `<span style="font-size:11px;color:#9ca3af">+${technologies.length - 5} more</span>` : ''}
                </td>
                <td class="table-cell">
                    <div class="flex flex-col gap-1 min-w-[110px]">
                        <button type="button" class="download-company-btn" data-index="${item._sourceIndex}" data-format="excel">Excel</button>
                        <button type="button" class="download-company-btn download-company-btn-secondary" data-index="${item._sourceIndex}" data-format="json">JSON</button>
                    </div>
                </td>
            `;
            resultsTableBody.appendChild(row);
        });

        renderPagination(filteredResults.length);
    }

    /**
     * Escape HTML special characters to prevent XSS.
     */
    function escapeHtml(str) {
        if (typeof str !== 'string') return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderPagination(totalItems) {
        paginationControls.innerHTML = '';
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        if (totalPages <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.className = 'pagination-btn';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.className = 'pagination-btn';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        pageInfo.className = 'text-sm text-gray-600 dark:text-gray-400';

        paginationControls.appendChild(prevButton);
        paginationControls.appendChild(pageInfo);
        paginationControls.appendChild(nextButton);
    }

    searchInput.addEventListener('input', () => {
        currentPage = 1;
        renderTable();
    });

    resultsTableBody.addEventListener('click', (event) => {
        const btn = event.target.closest('.download-company-btn');
        if (!btn) return;
        const index = Number(btn.dataset.index);
        const format = btn.dataset.format || 'excel';
        downloadCompanyDetails(index, format, btn);
    });

    setupExportLinks({});

    // Initial connection
    connectWebSocket();
});