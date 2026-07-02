const express = require('express');
const cors = require('cors');



// 1. FIXED IMPORT: We must explicitly pull in the completeHabit function alongside db
const { db, completeHabit , completeTask } = require('./database'); 

const app = express();
const PORT = 3000;



app.use(cors());
app.use(express.json());





/**
 * THE DASHBOARD ENDPOINT
 */
app.get('/api/dashboard', (req, res) => {
    try {
        const projects = db.prepare("SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC").all();
        const tasks = db.prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC").all();
        const habits = db.prepare("SELECT * FROM habits ORDER BY created_at DESC").all();

        res.json({ projects, tasks, habits });
    } catch (error) {
        console.error("[API Error] Failed to fetch dashboard data:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});





/**
 * THE HABIT COMPLETION ENDPOINT
 */
app.post('/api/habits/complete', (req, res) => {
    const { name } = req.body;
    try {
        // 2. FIXED CALL: Call the function directly, not as a method of 'db'
        const changes = completeHabit(name); 
        
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






/**
 * THE TASK COMPLETION ENDPOINT
 * Triggered when you click a task on the New Tab page.
 */
app.post('/api/tasks/complete', (req, res) => {
    const { content } = req.body;
    try {
        const changes = completeTask(content); 
        
        if (changes > 0) {
            res.json({ success: true, message: "Task marked as done!" });
        } else {
            res.json({ success: false, message: "Task not found." });
        }
    } catch (error) {
        console.error("[API Error] Failed to complete task:", error.message);
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