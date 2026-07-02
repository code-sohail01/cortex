// Function to pull data from your local backend
async function fetchCortexData() {
    try {
        const response = await fetch('http://localhost:3000/api/dashboard');
        const data = await response.json();
        renderDashboard(data);
    } catch (error) {
        console.error("Cortex API unreachable:", error);
        document.getElementById('tasks-container').innerHTML = '<div class="empty error">API Offline. Ensure server.js is running.</div>';
    }
}

// Function to inject the data into the DOM
function renderDashboard(data) {
    const today = new Date().toISOString().split('T')[0]; 

    // 1. Render Habits
    const habitsDiv = document.getElementById('habits-container');
    if (data.habits.length === 0) {
        habitsDiv.innerHTML = '<div class="empty">No active habits.</div>';
    } else {
        habitsDiv.innerHTML = data.habits.map(h => {
            const isDoneToday = h.last_completed && h.last_completed.startsWith(today);
            const stateClass = isDoneToday ? 'completed' : '';
            const interactiveClass = isDoneToday ? '' : 'clickable-habit';
            
            return `<div class="item ${interactiveClass} ${stateClass}" data-habit="${h.name}">
                <div class="ui-checkbox"></div>
                <span class="item-content">${h.name}</span> 
                <span class="badge">🔥 ${h.streak}</span>
            </div>`;
        }).join('');
    }

    // 2. Render Tasks
    const tasksDiv = document.getElementById('tasks-container');
    if (data.tasks.length === 0) {
        tasksDiv.innerHTML = '<div class="empty">Clear skies. No pending tasks.</div>';
    } else {
        tasksDiv.innerHTML = data.tasks.map(t => 
            `<div class="item task clickable-task" data-task="${t.content}">
                <span class="task-bullet">•</span>
                <span class="item-content">${t.content}</span>
            </div>`
        ).join('');
    }

    // 3. Render Projects
    const projectsDiv = document.getElementById('projects-container');
    if (data.projects.length === 0) {
        projectsDiv.innerHTML = '<div class="empty">No active projects.</div>';
    } else {
        projectsDiv.innerHTML = data.projects.map(p => 
            `<div class="item project">
                <span class="project-icon">📂</span>
                <span class="item-content">${p.name}</span>
            </div>`
        ).join('');
    }
}





// Sends click data to the local server
async function markHabitDone(habitName) {
    try {
        await fetch('http://localhost:3000/api/habits/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: habitName })
        });
        fetchCortexData(); 
    } catch (error) { console.error("Failed to complete habit:", error); }
}

async function markTaskDone(taskContent) {
    try {
        await fetch('http://localhost:3000/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: taskContent })
        });
        fetchCortexData(); 
    } catch (error) { console.error("Failed to complete task:", error); }
}




// Bulletproof Event Listener (Event Delegation)
document.addEventListener('click', function(event) {
    const habitElement = event.target.closest('.clickable-habit');
    if (habitElement) { markHabitDone(habitElement.getAttribute('data-habit')); return; }

    const taskElement = event.target.closest('.clickable-task');
    if (taskElement) { markTaskDone(taskElement.getAttribute('data-task')); return; }
});




// Analog Clock Logic
setInterval(() => {
    const now = new Date();
    const sec = now.getSeconds() * 6;
    const min = now.getMinutes() * 6 + now.getSeconds() * 0.1;
    const hr = now.getHours() * 30 + now.getMinutes() * 0.5;

    document.getElementById('sec-hand').style.transform = `translateX(-50%) rotate(${sec}deg)`;
    document.getElementById('min-hand').style.transform = `translateX(-50%) rotate(${min}deg)`;
    document.getElementById('hr-hand').style.transform = `translateX(-50%) rotate(${hr}deg)`;
}, 1000);






// --- REAL-TIME WEBSOCKET REFRESH LOOP ---
function connectRealTimeSync() {
    // Open a persistent websocket pipeline back to our local running server
    const socket = new WebSocket('ws://localhost:3000');

    socket.onopen = () => {
        console.log("⚡ Cortex Live Real-Time Pipeline Connected");
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === 'REFRESH') {
                console.log("🔄 Real-time update signal caught. Rerendering workspace...");
                fetchCortexData(); // Refreshes the elements without page reloads
            }
        } catch (err) {
            console.error("Failed to parse incoming WebSocket transmission:", err);
        }
    };

    // Auto-reconnect safety loop if the local server process restarts
    socket.onclose = () => {
        console.log("🔌 Live Sync lost. Retrying link in 3 seconds...");
        setTimeout(connectRealTimeSync, 3000);
    };

    socket.onerror = (error) => {
        console.error("Sync pipeline encountered an operational fault:", error);
        socket.close();
    };
}

// Fire up the real-time background socket link
connectRealTimeSync();

// Initialize
fetchCortexData();