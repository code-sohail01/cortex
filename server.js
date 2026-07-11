const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { 
    getMonthlyMatrix, 
    toggleHabitLog, 
    addHabit 
} = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Create an HTTP server to bundle Express and WebSockets on the same port
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track open browser connections
let connectedClients = [];

wss.on('connection', (ws) => {
    connectedClients.push(ws);
    ws.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== ws);
    });
});

// Helper function to broadcast live refresh events to all open Chrome tabs
function broadcastRefresh() {
    console.log(`[WebSocket] 📡 Broadcasting real-time UI refresh signal...`);
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'REFRESH' }));
        }
    });
}

// ---------------------------------------------------------
// EXPRESS REST API ENDPOINTS
// ---------------------------------------------------------

// 1. Fetch the full Oasis Matrix for the dashboard
app.get('/api/habits/matrix', (req, res) => {
    try {
        const matrix = getMonthlyMatrix();
        res.json({ habits: matrix });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 2. Toggle a habit log (Used by dashboard clicks)
app.post('/api/logs/toggle', (req, res) => {
    const { habitId, date } = req.body;
    try {
        const result = toggleHabitLog(habitId, date);
        broadcastRefresh(); // Trigger real-time push event
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Add a new habit
app.post('/api/habits/add', (req, res) => {
    const { name } = req.body;
    try {
        const result = addHabit(name);
        if (result.success) {
            broadcastRefresh(); // Trigger real-time push event
            res.json(result);
        } else {
            res.status(400).json(result); // Habit already exists
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. EXTERNAL TRIGGER: Allows app.js (WhatsApp) to trigger a UI refresh
app.post('/api/sync/trigger', (req, res) => {
    broadcastRefresh();
    res.json({ success: true });
});

server.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`📡 Oasis Real-Time Server running on port ${PORT}`);
    console.log(`=========================================\n`);
});