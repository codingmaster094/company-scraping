const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const scrapeRoutes = require('./scrapeRoutes');
const { handleWebSocketConnection } = require('./scrapeController');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const DEFAULT_PORT = Number(process.env.PORT) || 3001;

function startServer(port) {
    server.removeAllListeners('error');
    server.once('error', (error) => {
        if (error && error.code === 'EADDRINUSE') {
            const nextPort = port + 1;
            console.warn(`Port ${port} is already in use. Trying ${nextPort}...`);
            startServer(nextPort);
            return;
        }
        throw error;
    });

    server.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

    app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
app.use('/exports', express.static(path.join(__dirname, 'exports')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname));

app.get('/', (req, res) => {
    res.render('index', { title: 'Web Scraping Tool' });
});

app.get('/v2', (req, res) => {
    res.render('index', { title: 'Web Scraping Tool' });
});

app.use('/api', scrapeRoutes);
wss.on('connection', handleWebSocketConnection);

startServer(DEFAULT_PORT);
