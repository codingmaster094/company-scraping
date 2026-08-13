const express = require('express');
const router = express.Router();
const { getExportedFile, exportNow } = require('./scrapeController');

// Note: The main scraping logic is initiated via WebSocket, not a standard HTTP route.
router.post('/export-now', exportNow);
router.get('/download/:file', getExportedFile);

module.exports = router;