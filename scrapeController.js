const path = require('path');
const { scrapeGooglePlacesAndWebsites } = require('./scrapeService');
const { exportData, exportsDir } = require('./exportHelper');

let clients = [];

const handleWebSocketConnection = (ws) => {
    console.log('Client connected');
    clients.push(ws);

    // Heartbeat to keep connections alive during long scrapes
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    const heartbeatInterval = setInterval(() => {
        try {
            if (!ws.isAlive) {
                console.log('Terminating dead WebSocket client');
                ws.terminate();
                clearInterval(heartbeatInterval);
                clients = clients.filter(client => client !== ws);
                return;
            }
            ws.isAlive = false;
            ws.ping(() => {});
        } catch (e) {
            // ignore
        }
    }, 30000); // ping every 30s

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'START_SCRAPING') {
                console.log('Received start scraping request for URL:', data.url);
                // Pass the WebSocket client to the service to send progress updates
                await scrapeGooglePlacesAndWebsites(data.url, ws);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid request format.' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients = clients.filter(client => client !== ws);
        clearInterval(heartbeatInterval);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
};

const getExportedFile = (req, res) => {
    const { file } = req.params;
    const safeName = path.basename(file || '');
    const filePath = path.join(exportsDir, safeName);
    res.download(filePath, (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(404).send('File not found.');
        }
    });
};

/**
 * Build Excel/CSV/JSON from whatever rows the UI has right now (1..N, including ~160).
 * Used when the user clicks Export at any time during or after scraping.
 */
const exportNow = async (req, res) => {
    try {
        const results = Array.isArray(req.body && req.body.results) ? req.body.results : [];
        if (results.length === 0) {
            return res.status(400).json({ error: 'No scraped details to export yet.' });
        }
        const format = String((req.body && req.body.format) || 'excel').toLowerCase();
        const single = results.length === 1;
        const companyLabel = String(
            results[0].companyName || results[0].name || results[0].title || 'company'
        )
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'company';
        const fileBase = single
            ? `company-${companyLabel}-${Date.now()}`
            : `scrape-export-${Date.now()}`;
        const files = await exportData(results, fileBase);
        const name = format === 'csv' ? files.csv : format === 'json' ? files.json : files.excel;
        return res.download(path.join(exportsDir, name), name);
    } catch (error) {
        console.error('Export now failed:', error);
        res.status(500).json({ error: 'Failed to create export file.' });
    }
};

module.exports = {
    handleWebSocketConnection,
    getExportedFile,
    exportNow,
};