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
    insertHabit
};