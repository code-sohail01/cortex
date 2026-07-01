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
    // 1. Render Habits
    const habitsDiv = document.getElementById('habits-container');
    if (data.habits.length === 0) {
        habitsDiv.innerHTML = '<div class="empty">No active habits.</div>';
    } else {
        habitsDiv.innerHTML = data.habits.map(h => 
            `<div class="item"><span class="name">${h.name}</span> <span class="badge">Streak: ${h.streak}</span></div>`
        ).join('');
    }

    // 2. Render Tasks
    const tasksDiv = document.getElementById('tasks-container');
    if (data.tasks.length === 0) {
        tasksDiv.innerHTML = '<div class="empty">Clear skies. No pending tasks.</div>';
    } else {
        tasksDiv.innerHTML = data.tasks.map(t => 
            `<div class="item task">• ${t.content}</div>`
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

// Live Clock UI
setInterval(() => {
    document.getElementById('clock').innerText = new Date().toLocaleTimeString('en-US', { hour12: false });
}, 1000);

// Initialize
fetchCortexData();