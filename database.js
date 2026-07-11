const Database = require('better-sqlite3');
const path = require('path');

// 1. Initialize the new single canonical database
const dbPath = path.join(__dirname, 'cortex.db');
const db = new Database(dbPath);

// Enable Write-Ahead Logging (WAL) mode for fast concurrent operations
db.pragma('journal_mode = WAL');

/**
 * HELPER: Always get the exact YYYY-MM-DD string for Pakistan Standard Time (PKT)
 */
function getPktDateString(dateObj = new Date()) {
    // 'en-CA' inherently formats as YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(dateObj);
}

/**
 * Initializes the database tables if they do not exist yet.
 */
function initDB() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS habit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER NOT NULL,
            date TEXT NOT NULL, -- Stored explicitly as 'YYYY-MM-DD'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
            UNIQUE(habit_id, date)
        );
    `);
    console.log("[Database] Oasis Habit Engine tables initialized.");
}

// ---------------------------------------------------------
// DATA OPERATIONS
// ---------------------------------------------------------

function addHabit(name) {
    try {
        const stmt = db.prepare('INSERT INTO habits (name) VALUES (?)');
        const info = stmt.run(name);
        return { success: true, id: info.lastInsertRowid, name };
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return { success: false, error: 'Habit already exists.' };
        }
        throw err;
    }
}

function toggleHabitLog(habitId, targetDate = null) {
    // Default to today's PKT date if none is provided
    const dateToLog = targetDate || getPktDateString();
    
    // Check if it's already logged for this date
    const existingLog = db.prepare(`SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?`).get(habitId, dateToLog);

    if (existingLog) {
        // If it exists, untick it (delete)
        db.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(existingLog.id);
        return { action: 'removed', date: dateToLog };
    } else {
        // If it doesn't exist, tick it (insert)
        db.prepare(`INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)`).run(habitId, dateToLog);
        return { action: 'added', date: dateToLog };
    }
}

function getPendingHabitsForToday() {
    const today = getPktDateString();
    // Select habits that do NOT have a log in the habit_logs table for today
    return db.prepare(`
        SELECT h.id, h.name 
        FROM habits h
        LEFT JOIN habit_logs l ON h.id = l.habit_id AND l.date = ?
        WHERE l.id IS NULL
    `).all(today);
}




// Fetches the matrix for a SPECIFIC month and year
function getMonthlyMatrix(queryYear, queryMonth) {
    const pktNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}));
    const targetYear = queryYear ? parseInt(queryYear) : pktNow.getFullYear();
    const targetMonth = queryMonth ? parseInt(queryMonth) : pktNow.getMonth() + 1;

    // Format for log searching (e.g., "2026-06-")
    const monthString = targetMonth.toString().padStart(2, '0');
    const datePrefix = `${targetYear}-${monthString}-`;

    // --- THE TIME TRAVEL FIX ---
    // We calculate the 1st day of the NEXT month. 
    // We will only load habits created BEFORE this exact date.
    let nextMonth = targetMonth + 1;
    let nextYear = targetYear;
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    const cutoffDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    // Only fetch habits created before the cutoff
    const habits = db.prepare('SELECT id, name FROM habits WHERE created_at < ? ORDER BY id ASC').all(cutoffDate);
    
    return habits.map(habit => {
        const logs = db.prepare(`
            SELECT date FROM habit_logs 
            WHERE habit_id = ? AND date LIKE ?
        `).all(habit.id, `${datePrefix}%`);
        
        return {
            id: habit.id,
            name: habit.name,
            completedDates: logs.map(l => l.date)
        };
    });
}


function getPendingHabitsForTodayOrdered() {
    const today = getPktDateString();
    // This order by h.id ASC matches the order used in getMonthlyMatrix()
    return db.prepare(`
        SELECT h.id, h.name 
        FROM habits h
        LEFT JOIN habit_logs l ON h.id = l.habit_id AND l.date = ?
        WHERE l.id IS NULL
        ORDER BY h.id ASC
    `).all(today);
}


// Strict logging for WhatsApp (prevents accidental unticking)
function logHabitStrict(habitId, date = getPktDateString()) {
    const existing = db.prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?').get(habitId, date);
    
    if (existing) {
        return { action: 'already_logged' }; // Tell the bot it was already done
    } else {
        db.prepare('INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)').run(habitId, date);
        return { action: 'logged' };
    }
}



// --- DELETE OPERATION ---
function deleteHabit(habitId) {
    // 1. Wipe all checkmarks associated with this habit
    db.prepare('DELETE FROM habit_logs WHERE habit_id = ?').run(habitId);
    // 2. Wipe the habit itself
    const info = db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);
    return { success: info.changes > 0 };
}


// Boot the DB
initDB();

module.exports = {
    db,
    getPktDateString,
    addHabit,
    toggleHabitLog,
    getPendingHabitsForToday,
    getMonthlyMatrix,
    getPendingHabitsForTodayOrdered,
    logHabitStrict,
    deleteHabit
};