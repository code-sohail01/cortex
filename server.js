const express = require('express');
const cors = require('cors');
const { db } = require('./database'); // Import your active database instance

const app = express();
const PORT = 3000;

// Enable CORS so your Chrome extension is allowed to fetch data from this server
app.use(cors());
app.use(express.json());

/**
 * THE DASHBOARD ENDPOINT
 * When your Chrome extension hits this URL, it gathers all your data and sends it back.
 */
app.get('/api/dashboard', (req, res) => {
    try {
        // Fetch all active projects
        const projects = db.prepare("SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC").all();
        
        // Fetch all pending tasks
        const tasks = db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC").all();
        
        // Fetch all habits
        const habits = db.prepare("SELECT * FROM habits ORDER BY created_at DESC").all();

        // Bundle everything into one clean payload
        const dashboardPayload = {
            projects,
            tasks,
            habits
        };

        res.json(dashboardPayload);
    } catch (error) {
        console.error("[API Error] Failed to fetch dashboard data:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * THE HABIT COMPLETION ENDPOINT
 * Triggered when you click a habit on the New Tab page.
 */
app.post('/api/habits/complete', (req, res) => {
    const { name } = req.body;
    try {
        const changes = db.completeHabit(name);
        if (changes > 0) {
            res.json({ success: true, message: "Habit completed for today!" });
        } else {
            res.json({ success: false, message: "Already completed or not found." });
        }
    } catch (error) {
        console.error("[API Error] Failed to update habit:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`📡 Cortex API is live and broadcasting!`);
    console.log(`🌐 Endpoint: http://localhost:${PORT}/api/dashboard`);
    console.log(`=========================================\n`);
});