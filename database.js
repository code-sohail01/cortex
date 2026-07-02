const Database = require('better-sqlite3');
const path = require('path');



// 1. Initialize the SQLite database file path
const dbPath = path.join(__dirname, 'dashboard.sqlite');
const db = new Database(dbPath);



// Enable Write-Ahead Logging (WAL) mode for lightning-fast performance
db.pragma('journal_mode = WAL');




/**
 * Initializes the database tables if they do not exist yet.
 */
function initDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            streak INTEGER DEFAULT 0,
            last_completed DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log("[Database] Persistence layer and tables checked/initialized.");
}




// 2. Future-Proofed Data Modification Functions (Isolated from business logic)

function insertProject(name) {
    const stmt = db.prepare('INSERT INTO projects (name) VALUES (?)');
    const info = stmt.run(name);
    return { id: info.lastInsertRowid, name, status: 'active' };
}





function insertTask(content, projectId = null) {
    const stmt = db.prepare('INSERT INTO tasks (content, project_id) VALUES (?, ?)');
    const info = stmt.run(content, projectId);
    return { id: info.lastInsertRowid, content, project_id: projectId, status: 'pending' };
}





function completeTask(targetText) {
    // We use % wildcards so if you say "battery", it finds "Buy a new battery"
    const stmt = db.prepare(`UPDATE tasks SET status = 'completed' WHERE content LIKE ? AND status = 'pending'`);
    const info = stmt.run(`%${targetText}%`);
    
    // Returns how many rows were actually updated
    return info.changes; 
}




function completeHabit(targetText) {
    const today = new Date().toISOString().split('T')[0]; // Gets YYYY-MM-DD
    
    // 1. Find the habit matching the text
    const habit = db.prepare(`SELECT * FROM habits WHERE name LIKE ?`).get(`%${targetText}%`);
    
    if (!habit) return 0; // Habit not found

    // 2. Check if it was already done today
    const isDoneToday = habit.last_completed && habit.last_completed.startsWith(today);
    if (isDoneToday) return 0; // Prevent double-clicking the streak

    // 3. Update the streak and timestamp
    const stmt = db.prepare(`
        UPDATE habits 
        SET streak = streak + 1, last_completed = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    const info = stmt.run(habit.id);
    return info.changes;
}






function insertHabit(name) {
    const stmt = db.prepare('INSERT INTO habits (name) VALUES (?)');
    const info = stmt.run(name);
    return { id: info.lastInsertRowid, name, streak: 0 };
}




// Automatically trigger initialization when the script is loaded
initDB();




// Export database client and basic operations for app.js integration
module.exports = {
    db,
    insertProject,
    insertTask,
    insertHabit,
    completeTask,
    completeHabit
};

