// --- TIMEZONE & DATE UTILS (Strictly PKT - Asia/Karachi) ---
function getPktDateObj() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
}

function formatToYMD(dateObj) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(dateObj);
}

function getDaysInCurrentMonth() {
    const now = getPktDateObj();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// --- LIVE CLOCK ---
function startClock() {
    const monthEl = document.getElementById('current-month');
    const timerEl = document.getElementById('live-timer');

    // Set Month Label once
    const now = getPktDateObj();
    const monthStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', month: 'long', year: 'numeric' }).format(now);
    if(monthEl) monthEl.innerText = monthStr;

    setInterval(() => {
        const timeNow = getPktDateObj();
        const timeString = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Karachi',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(timeNow);
        if(timerEl) timerEl.innerText = timeString;
    }, 1000);
}

// --- DATA FETCHING ---
async function fetchOasisData() {
    try {
        const response = await fetch('http://localhost:3000/api/habits/matrix');
        const data = await response.json();
        renderMatrix(data.habits);
    } catch (error) {
        console.error("Oasis API offline:", error);
        document.getElementById('tracker-container').innerHTML = '<div style="padding: 20px; color: #a35d5d;">Backend offline. Is server.js running?</div>';
    }
}

// --- RENDER ENGINE ---
function renderMatrix(habits) {
    const container = document.getElementById('tracker-container');
    const daysInMonth = getDaysInCurrentMonth();
    const currentPktDate = getPktDateObj();
    const year = currentPktDate.getFullYear();
    const month = currentPktDate.getMonth(); // 0-indexed
    const todayDay = currentPktDate.getDate(); // Gets the current day (e.g., 10)

    if (habits.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No habits added yet. Start building your Oasis.</div>';
        updateProgress(0, 0);
        return;
    }

    let html = '';

// 1. Build Header Row (Days 1 - End of Month)
    html += `<div class="matrix-row header-row" style="display: flex; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">`;
    html += `<div class="matrix-label" style="flex: 0 0 200px; font-weight: 600; color: #555;">Habit</div>`;
    html += `<div class="matrix-days" style="display: flex; flex: 1; justify-content: space-between;">`;
    for (let d = 1; d <= daysInMonth; d++) {
        // Highlight today's number in the header
        const isToday = (d === todayDay);
        const dayStyle = isToday ? `color: #cf795c; font-weight: 700;` : `color: #888;`;
        html += `<div class="day-number" style="width: 24px; text-align: center; font-size: 0.8rem; ${dayStyle}">${d}</div>`;
    }
    html += `</div></div>`;

    let totalPossibleChecks = habits.length * daysInMonth;
    let totalActualChecks = 0;



    

// 2. Build Habit Rows
    // Add 'index' here to count the rows dynamically
    habits.forEach((habit, index) => {
        html += `<div class="matrix-row" style="display: flex; align-items: center; margin-bottom: 12px;">`;
        
        // Replace ${habit.id} with ${index + 1} for the visual number
        html += `<div class="matrix-label" style="flex: 0 0 200px; display: flex; align-items: center; justify-content: space-between; font-weight: 500; font-size: 0.95rem; padding-right: 15px;">
            <div><span style="color: #bbb; margin-right: 8px; font-size: 0.8rem; font-weight: 400;">${index + 1}.</span>${habit.name}</div>
            <span class="delete-btn" data-id="${habit.id}" style="color: #ddd; cursor: pointer; font-size: 1.2rem; line-height: 1; transition: color 0.2s ease;">×</span>
        </div>`;
        
        html += `<div class="matrix-days" style="display: flex; flex: 1; justify-content: space-between;">`;
        for (let d = 1; d <= daysInMonth; d++) {
            const cellDateObj = new Date(year, month, d);
            const dateString = formatToYMD(cellDateObj);
            
            const isCompleted = habit.completedDates.includes(dateString);
            const isToday = (d === todayDay);

            if (isCompleted) totalActualChecks++;

            let circleStyle = `border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: all 0.2s ease;`;
            
            if (isCompleted) {
                circleStyle += ` background-color: #f7ede2; border: 1.5px solid #d9a05b; color: #d9a05b;`;
            } else {
                circleStyle += ` background-color: transparent; border: 1.5px solid #e0e0e0;`;
            }

            // ONLY make it clickable and pop out if it is today
            if (isToday) {
                circleStyle += ` cursor: pointer; box-shadow: 0 0 8px rgba(217, 160, 91, 0.3); transform: scale(1.1);`;
                html += `<div class="day-circle clickable" style="${circleStyle}" data-habit="${habit.id}" data-date="${dateString}">${isCompleted ? '✓' : ''}</div>`;
            } else {
                circleStyle += ` cursor: not-allowed; opacity: 0.4;`;
                html += `<div class="day-circle disabled" style="${circleStyle}">${isCompleted ? '✓' : ''}</div>`;
            }
        }
        html += `</div></div>`;
    });

    container.innerHTML = html;
    updateProgress(totalActualChecks, totalPossibleChecks);
}

function updateProgress(actual, total) {
    const percentage = total === 0 ? 0 : Math.round((actual / total) * 100);
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    
    if (progressText) progressText.innerText = percentage;
    if (progressBar) progressBar.style.width = `${percentage}%`;
}

// --- INTERACTION ACTIONS ---
async function toggleLog(habitId, date) {
    try {
        await fetch('http://localhost:3000/api/logs/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habitId, date })
        });
        // The WebSocket broadcast will trigger a re-render automatically
    } catch (error) { console.error("Failed to toggle log:", error); }
}

async function addHabit(name) {
    if (!name) return;
    try {
        const response = await fetch('http://localhost:3000/api/habits/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (response.ok) {
            document.getElementById('new-habit-input').value = '';
        } else {
            const data = await response.json();
            alert(data.error || "Failed to add habit.");
        }
    } catch (error) { console.error("Error adding habit:", error); }
}

// --- EVENT DELEGATION ---
document.addEventListener('click', function(event) {
    // 1. Check if clicked on a day circle
    const circle = event.target.closest('.day-circle.clickable');
    if (circle) {
        const habitId = circle.getAttribute('data-habit');
        const date = circle.getAttribute('data-date');
        toggleLog(habitId, date);
        return;
    }

    // 2. Check if clicked on a Delete button
    const deleteBtn = event.target.closest('.delete-btn');
    if (deleteBtn) {
        const habitId = deleteBtn.getAttribute('data-id');
        // Double-check before wiping data
        if (confirm("Are you sure you want to delete this habit and all its history?")) {
            fetch(`http://localhost:3000/api/habits/${habitId}`, { method: 'DELETE' })
                .catch(err => console.error("Failed to delete:", err));
        }
        return;
    }

    // 3. Check if clicked Add button
    if (event.target.id === 'add-btn') {
        const input = document.getElementById('new-habit-input');
        addHabit(input.value.trim());
    }
});

// Allow hitting Enter on the input box
const habitInput = document.getElementById('new-habit-input');
if (habitInput) {
    habitInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            addHabit(this.value.trim());
        }
    });
}

// --- REAL-TIME WEBSOCKET SYNC ---
function connectRealTimeSync() {
    const socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => console.log("⚡ Oasis Live Matrix Connected");

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === 'REFRESH') {
                console.log("🔄 Update signal received. Redrawing matrix...");
                fetchOasisData(); 
            }
        } catch (err) { console.error("WebSocket parse error:", err); }
    };

    socket.onclose = () => {
        console.log("🔌 Sync lost. Retrying in 3 seconds...");
        setTimeout(connectRealTimeSync, 3000);
    };

    socket.onerror = (error) => socket.close();
}

// --- BOOT SEQUENCE ---
startClock();
connectRealTimeSync();
fetchOasisData();