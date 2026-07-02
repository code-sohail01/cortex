// Function to pull data from your local backend
async function fetchCortexData() {
    try {
        const response = await fetch('http://localhost:3000/api/dashboard');
        const data = await response.json();
        renderDashboard(data);
    } catch (error) {
        console.error("Cortex API unreachable:", error);
        document.getElementById('tasks-container').innerHTML = '<div class="error">API Offline. Ensure server.js is running.</div>';
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
            const box = isDoneToday ? '☑️' : '🔲';
            const textStyle = isDoneToday ? 'text-decoration: line-through; opacity: 0.5;' : 'cursor: pointer; transition: 0.2s;';
            
            // REMOVED inline onclick, ADDED data-habit attribute and interactive classes
            const interactiveClass = isDoneToday ? '' : 'clickable-habit hover-active';
            
            return `<div class="item ${interactiveClass}" style="${textStyle}" data-habit="${h.name}">
                <span class="name">${box} ${h.name}</span> 
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
            // Added clickable-task class, hover effect, cursor styling, and data-task attribute
            `<div class="item task clickable-task hover-active" style="cursor: pointer; transition: 0.2s;" data-task="${t.content}">
                <span>• ${t.content}</span>
            </div>`
        ).join('');
    }

    // 3. Render Projects
    const projectsDiv = document.getElementById('projects-container');
    if (data.projects.length === 0) {
        projectsDiv.innerHTML = '<div class="empty">No active projects.</div>';
    } else {
        projectsDiv.innerHTML = data.projects.map(p => 
            `<div class="item project">📁 ${p.name}</div>`
        ).join('');
    }
}





// Sends task completion data to the local server
async function markTaskDone(taskContent) {
    try {
        await fetch('http://localhost:3000/api/tasks/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: taskContent })
        });
        fetchCortexData(); // Instantly refresh the UI to remove the task
    } catch (error) {
        console.error("Failed to complete task via UI:", error);
    }
}




// Analog Clock Logic
setInterval(() => {
    const now = new Date();
    
    // Calculate rotation angles
    const sec = now.getSeconds() * 6; // 360deg / 60s
    const min = now.getMinutes() * 6 + now.getSeconds() * 0.1;
    const hr = now.getHours() * 30 + now.getMinutes() * 0.5;

    // Apply rotations
    document.getElementById('sec-hand').style.transform = `translateX(-50%) rotate(${sec}deg)`;
    document.getElementById('min-hand').style.transform = `translateX(-50%) rotate(${min}deg)`;
    document.getElementById('hr-hand').style.transform = `translateX(-50%) rotate(${hr}deg)`;
}, 1000);




// Bulletproof Event Listener with Tracers
document.addEventListener('click', function(event) {
    console.log("🖱️ Mouse Click Detected on:", event.target);

    // 1. Check if a Habit was clicked
    const habitElement = event.target.closest('.clickable-habit');
    if (habitElement) {
        const habitName = habitElement.getAttribute('data-habit');
        console.log("🎯 Habit Click Triggered:", habitName);
        markHabitDone(habitName);
        return; // Stop looking for tasks
    }

    // 2. Check if a Task was clicked
    const taskElement = event.target.closest('.clickable-task');
    if (taskElement) {
        const taskContent = taskElement.getAttribute('data-task');
        console.log("🎯 Task Click Triggered:", taskContent);
        markTaskDone(taskContent);
        return;
    }
});

// Initialize
fetchCortexData();