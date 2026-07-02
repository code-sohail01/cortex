const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { db, completeHabit, completeTask } = require('./database');

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

/** Express Endpoints **/
app.get('/api/dashboard', (req, res) => {
    try {
        const projects = db.prepare("SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC").all();
        const tasks = db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC").all();
        const habits = db.prepare("SELECT * FROM habits ORDER BY created_at DESC").all();
        res.json({ projects, tasks, habits });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/api/habits/complete', (req, res) => {
    const { name } = req.body;
    try {
        const changes = completeHabit(name);
        if (changes > 0) {
            broadcastRefresh(); // Trigger real-time push event
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks/complete', (req, res) => {
    const { content } = req.body;
    try {
        const changes = completeTask(content);
        if (changes > 0) {
            broadcastRefresh(); // Trigger real-time push event
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW EXPOSED PUBLIC INTERFACE: Allows app.js to trigger a UI refresh when WhatsApp writes data
app.post('/api/sync/trigger', (req, res) => {
    broadcastRefresh();
    res.json({ success: true });
});

server.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`📡 Real-Time Hybrid Server running on port ${PORT}`);
    console.log(`=========================================\n`);
});