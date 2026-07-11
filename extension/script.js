let isToggling = false;

// --- TIME TRAVEL STATE ---
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

// Set initial view state to real current PKT time
const bootDate = getPktDateObj();
let viewYear = bootDate.getFullYear();
let viewMonth = bootDate.getMonth() + 1; // 1 to 12

// --- LIVE CLOCK ---
function startClock() {
    const timerEl = document.getElementById('live-timer');
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

// --- DATA FETCHING & TIME TRAVEL ---
async function loadMatrixForViewMonth() {
    // 1. Update UI Text
    const monthEl = document.getElementById('current-month');
    if (monthEl) monthEl.innerText = `${monthNames[viewMonth - 1]} ${viewYear}`;

    // 2. Fetch Data
    try {
        const response = await fetch(`http://localhost:3000/api/habits/matrix?year=${viewYear}&month=${viewMonth}`);
        const data = await response.json();
        renderMatrix(data.habits, viewYear, viewMonth);
    } catch (error) {
        console.error("Oasis API offline:", error);
        document.getElementById('tracker-container').innerHTML = '<div style="padding: 20px; color: #a35d5d;">Backend offline. Is server.js running?</div>';
    }
}

// --- RENDER ENGINE ---
function renderMatrix(habits, renderYear, renderMonth) {
    const container = document.getElementById('tracker-container');
    const daysInViewMonth = new Date(renderYear, renderMonth, 0).getDate();
    
    // Real time data to check if we are rendering "Today"
    const currentPktDate = getPktDateObj();
    const realYear = currentPktDate.getFullYear();
    const realMonth = currentPktDate.getMonth() + 1;
    const realTodayDay = currentPktDate.getDate(); 

    const isViewingCurrentMonth = (renderYear === realYear && renderMonth === realMonth);

    if (habits.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No habits added yet. Start building your Oasis.</div>';
        updateProgress(0, 0);
        return;
    }

    let html = '';

    // 1. Build Header Row 
    html += `<div class="matrix-row header-row" style="display: flex; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 10px;">`;
    html += `<div class="matrix-label" style="flex: 0 0 200px; font-weight: 600; color: #555;">Habit</div>`;
    html += `<div class="matrix-days" style="display: flex; flex: 1; justify-content: space-between;">`;
    for (let d = 1; d <= daysInViewMonth; d++) {
        const isRealToday = isViewingCurrentMonth && (d === realTodayDay);
        const dayStyle = isRealToday ? `color: #cf795c; font-weight: 700;` : `color: #888;`;
        html += `<div class="day-number" style="width: 24px; text-align: center; font-size: 0.8rem; ${dayStyle}">${d}</div>`;
    }
    html += `</div></div>`;

    let totalPossibleChecks = habits.length * daysInViewMonth;
    let totalActualChecks = 0;

    // 2. Build Habit Rows
    habits.forEach((habit, index) => {
        html += `<div class="matrix-row" style="display: flex; align-items: center; margin-bottom: 12px;">`;
        html += `<div class="matrix-label" style="flex: 0 0 200px; display: flex; align-items: center; justify-content: space-between; font-weight: 500; font-size: 0.95rem; padding-right: 15px;">
            <div><span style="color: #bbb; margin-right: 8px; font-size: 0.8rem; font-weight: 400;">${index + 1}.</span>${habit.name}</div>
            <span class="delete-btn" data-id="${habit.id}" style="color: #ddd; cursor: pointer; font-size: 1.2rem; line-height: 1; transition: color 0.2s ease;">×</span>
        </div>`;
        
        html += `<div class="matrix-days" style="display: flex; flex: 1; justify-content: space-between;">`;
        for (let d = 1; d <= daysInViewMonth; d++) {
            // Note: Date object uses 0-indexed months, so we subtract 1 from renderMonth
            const cellDateObj = new Date(renderYear, renderMonth - 1, d);
            const dateString = formatToYMD(cellDateObj);
            
            const isCompleted = habit.completedDates.includes(dateString);
            const isRealToday = isViewingCurrentMonth && (d === realTodayDay);

            if (isCompleted) totalActualChecks++;

            let circleStyle = `border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: all 0.2s ease;`;
            
            if (isCompleted) {
                circleStyle += ` background-color: #f7ede2; border: 1.5px solid #d9a05b; color: #d9a05b;`;
            } else {
                circleStyle += ` background-color: transparent; border: 1.5px solid #e0e0e0;`;
            }

            // ONLY make it clickable if viewing the actual current day
            if (isRealToday) {
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
    if (isToggling) return; // Shield engaged
    isToggling = true;

    try {
        await fetch('http://localhost:3000/api/logs/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habitId, date })
        });
    } catch (error) { 
        console.error("Failed to toggle log:", error); 
    } finally {
        // Drop the shield after 500ms
        setTimeout(() => { isToggling = false; }, 500);
    }
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
    // TIME TRAVEL CONTROLS
    if (event.target.id === 'prev-month') {
        viewMonth--;
        if (viewMonth < 1) { viewMonth = 12; viewYear--; }
        loadMatrixForViewMonth();
        return;
    }

    if (event.target.id === 'next-month') {
        const checkDate = getPktDateObj();
        // Prevent traveling into the future
        if (viewYear === checkDate.getFullYear() && viewMonth === (checkDate.getMonth() + 1)) return; 
        
        viewMonth++;
        if (viewMonth > 12) { viewMonth = 1; viewYear++; }
        loadMatrixForViewMonth();
        return;
    }

    // TOGGLE LOG
    const circle = event.target.closest('.day-circle.clickable');
    if (circle) {
        toggleLog(circle.getAttribute('data-habit'), circle.getAttribute('data-date'));
        return;
    }

    // DELETE HABIT
    const deleteBtn = event.target.closest('.delete-btn');
    if (deleteBtn) {
        if (confirm("Are you sure you want to delete this habit and all its history?")) {
            fetch(`http://localhost:3000/api/habits/${deleteBtn.getAttribute('data-id')}`, { method: 'DELETE' })
                .catch(err => console.error("Failed to delete:", err));
        }
        return;
    }

    // ADD HABIT BUTTON
    if (event.target.id === 'add-btn') {
        addHabit(document.getElementById('new-habit-input').value.trim());
    }
});

// ENTER KEY LISTENER
const habitInput = document.getElementById('new-habit-input');
if (habitInput) {
    habitInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addHabit(this.value.trim());
    });
}

// --- REAL-TIME WEBSOCKET SYNC ---
function connectRealTimeSync() {
    const socket = new WebSocket('ws://localhost:3000');
    socket.onopen = () => console.log("⚡ Oasis Live Matrix Connected");
    socket.onmessage = (event) => {
        try {
            if (JSON.parse(event.data).type === 'REFRESH') loadMatrixForViewMonth(); 
        } catch (err) {}
    };
    socket.onclose = () => setTimeout(connectRealTimeSync, 3000);
}

// --- BOOT SEQUENCE ---
startClock();
connectRealTimeSync();
loadMatrixForViewMonth();