const { startWhatsAppListener, registerPipeline, sendOutboundMessage } = require('./whatsapp');
const cron = require('node-cron');
const { db, toggleHabitLog, getPendingHabitsForTodayOrdered, getPktDateString, logHabitStrict } = require('./database');

// --- Global State Machine for Nightly Sync ---
let pendingSyncHabits = [];
let isAwaitingYNY = false;

// Helper to push real-time updates to the Oasis Chrome Tab
async function triggerDashboardRefresh() {
    try {
        await fetch('http://localhost:3000/api/sync/trigger', { method: 'POST' });
    } catch (err) {
        console.error("[Sync] Dashboard offline. (Is server.js running?)");
    }
}

// Helper to send messages back to WhatsApp
async function sendWhatsAppReply(message) {
    console.log(`\n💬 [WhatsApp Outbound Message]:\n${message}\n`);
    await sendOutboundMessage(message); // This actually fires it to your phone!
}

/**
 * THE OASIS INGESTION PIPELINE
 */
async function processMessagePipeline(rawText) {
    const text = rawText.trim();
    const lowerText = text.toLowerCase();


    // ---------------------------------------------------------
    // 1. QUICK-FIRE SHORTCUT (.d habit_name OR .d id)
    // ---------------------------------------------------------
    if (lowerText.startsWith('.d ')) {
        const queryArg = lowerText.substring(3).trim();
        let habit;
        
        // Check if the user typed a pure number (e.g., ".d 1")
        if (/^\d+$/.test(queryArg)) {
            habit = db.prepare(`SELECT id, name FROM habits WHERE id = ?`).get(parseInt(queryArg));
        } else {
            // User typed text (e.g., ".d gym"). 
            // We use queryArg + '%' so it strictly matches the START of the name, preventing the "g" bug.
            habit = db.prepare(`SELECT id, name FROM habits WHERE name LIKE ?`).get(`${queryArg}%`);
        }
        
    if(habit) {
            // Use the strict logger instead of the toggle
            const result = logHabitStrict(habit.id);
            
            if (result.action === 'already_logged') {
                console.log(`[Oasis] 🛡️ Blocked accidental untick for: ${habit.name}`);
                sendWhatsAppReply(`🛡️ Relax, you already logged "${habit.name}" for today!`);
            } else {
                console.log(`[Oasis] ✅ Quick-fire logged: ${habit.name}`);
                sendWhatsAppReply(`✅ Logged "${habit.name}" for today.`);
                
                if (isAwaitingYNY) {
                    pendingSyncHabits = pendingSyncHabits.filter(h => h.id !== habit.id);
                    if (pendingSyncHabits.length === 0) isAwaitingYNY = false;
                }

                await triggerDashboardRefresh();
            }
        } else {
            console.log(`[Oasis] ⚠️ Habit not found: ${queryArg}`);
            sendWhatsAppReply(`⚠️ Habit not found: ${queryArg}`);
        }
        return; 
    }

    // ---------------------------------------------------------
    // 2. THE 'YNY' NIGHTLY PARSER
    // ---------------------------------------------------------
    // Check if the message contains ONLY 'Y' and 'N' (case-insensitive)
    const isOnlyYNY = /^[ynYN]+$/.test(text);
    
    if (isOnlyYNY && isAwaitingYNY) {
        if (text.length !== pendingSyncHabits.length) {
            sendWhatsAppReply(`⚠️ Length mismatch. You have ${pendingSyncHabits.length} pending habits, but you sent ${text.length} letters. Try again.`);
            return;
        }

        const today = getPktDateString();
        let loggedCount = 0;

        // Loop through the YNY string and map it to the pending habits array
        for (let i = 0; i < text.length; i++) {
            const char = text[i].toUpperCase();
            if (char === 'Y') {
                const habitId = pendingSyncHabits[i].id;
                try {
                    // Force insert. We don't use toggle here so we don't accidentally untick something.
                    db.prepare(`INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)`).run(habitId, today);
                    loggedCount++;
                } catch (e) {
                    // Ignore UNIQUE constraint errors if it somehow got logged already
                }
            }
        }

        sendWhatsAppReply(`🌙 Nightly sync complete. Logged ${loggedCount} habits. Rest well!`);
        
        // Reset the state machine
        isAwaitingYNY = false;
        pendingSyncHabits = [];
        await triggerDashboardRefresh();
        return;
    }

    console.log(`[Oasis] 📥 Ignored unstructured message: "${text}"`);
}

// ---------------------------------------------------------
// 3. THE NIGHTLY CRON JOB (10:00 PM PKT)
// ---------------------------------------------------------


cron.schedule('0 22 * * *', () => {
    console.log("\n⏰ [Cron] Triggering 10:00 PM PKT Nightly Sync...");
    
    // Use the new ordered function
    const pending = getPendingHabitsForTodayOrdered(); 

    if (pending.length === 0) {
        sendWhatsAppReply("All clean for today! Zero habits remaining. 🌅");
        isAwaitingYNY = false;
    } else {
        pendingSyncHabits = pending;
        isAwaitingYNY = true;
        
        let msg = "Oasis Nightly Sync 🌅\nYou have " + pending.length + " habits remaining for today:\n\n";
        pending.forEach((h, i) => {
            // Now the list will perfectly match the IDs on your dashboard
            msg += `${i + 1}. ${h.name}\n`;
        });
        
        const example = "Y".repeat(pending.length);
        msg += `\nReply with Y or N for each (e.g., ${example})`;
        
        sendWhatsAppReply(msg);
    }
}, {
    scheduled: true,
    timezone: "Asia/Karachi"
});

// ---------------------------------------------------------
// BOOT SEQUENCE
// ---------------------------------------------------------
console.log("Starting Oasis Master Controller...");
registerPipeline(processMessagePipeline);
startWhatsAppListener().catch(err => {
    console.error("--- CRITICAL WHATSAPP RUNTIME ERROR ---");
    console.error(err);
});