document.addEventListener("DOMContentLoaded", () => {
    loadStoredTasks();
    startReminderCheck();
    requestNotificationPermission();
    setupThemeSwitcher();
});

let tasks = [];
let editIndex = null;

const savedTheme = localStorage.getItem("theme") || "default";
document.body.setAttribute("data-theme", savedTheme);
themeSelect.value = savedTheme;

themeSelect.addEventListener("change", () => {
    const selectedTheme = themeSelect.value;
    document.body.setAttribute("data-theme", selectedTheme);
    localStorage.setItem("theme", selectedTheme);
});

const loadStoredTasks = () => {
    const storedTasks = JSON.parse(localStorage.getItem("tasks"));
    if (storedTasks) {
        tasks = storedTasks;
        updateTasksList();
        updateStats();
    }
};

const saveTasks = () => localStorage.setItem("tasks", JSON.stringify(tasks));

const addOrEditTask = () => {
    const taskInput = document.getElementById("taskInput");
    const reminderInput = document.getElementById("reminderInput");
    const repeatCheckbox = document.getElementById("repeatCheckbox");
    const repeatFrequency = document.getElementById("repeatFrequency");

    const taskText = taskInput.value.trim();
    const reminderTime = reminderInput.value;
    const isRepeating = repeatCheckbox.checked;
    const frequency = isRepeating ? repeatFrequency.value : null;

    if (!taskText) return;

    const newTask = {
        text: taskText,
        completed: false,
        reminderTime,
        isRepeating,
        frequency
    };

    if (editIndex !== null) {
        tasks[editIndex] = newTask;
        editIndex = null;
    } else {
        tasks.push(newTask);
    }

    clearInputs();
    updateTasksList();
    updateStats();
    saveTasks();
};

const clearInputs = () => {
    const taskInput = document.getElementById("taskInput");
    const reminderInput = document.getElementById("reminderInput");
    const repeatCheckbox = document.getElementById("repeatCheckbox");
    const repeatFrequency = document.getElementById("repeatFrequency");

    if (taskInput) taskInput.value = "";
    if (reminderInput) reminderInput.value = "";
    if (repeatCheckbox) repeatCheckbox.checked = false;
    if (repeatFrequency) {
        repeatFrequency.style.display = "none";
        repeatFrequency.value = "daily";
    }
};


const editTask = index => {
    document.getElementById("taskInput").value = tasks[index].text;
    document.getElementById("reminderInput").value = tasks[index].reminderTime;
    editIndex = index;
};

const toggleTaskComplete = (index) => {
    const task = tasks[index];
    task.completed = !task.completed;

    if (task.completed && task.isRepeating) {
        rescheduleTask(task);
        task.completed = false;  // Set back to incomplete for the new occurrence
    }

    updateTasksList();
    updateStats();
    saveTasks();
};

const deleteTask = index => {
    tasks.splice(index, 1);
    updateTasksList();
    updateStats();
    saveTasks();
};

const updateStats = () => {
    const completedTasks = tasks.filter(task => task.completed).length;
    const totalTasks = tasks.length;
    const progress = totalTasks ? (completedTasks / totalTasks) * 100 : 0;
    document.getElementById("progress").style.width = `${progress}%`;
    document.getElementById("numbers").innerText = `${completedTasks} / ${totalTasks}`;
    updateStatusMessage(completedTasks, totalTasks);

    if (totalTasks > 0 && completedTasks === totalTasks) {
        blastConfetti();
    }
};

const updateStatusMessage = (completedTasks, totalTasks) => {
    const statusMessage = document.getElementById("statusMessage");
    if (totalTasks === 0) {
        statusMessage.innerText = "Please add tasks";
    } else if (completedTasks === totalTasks) {
        statusMessage.innerText = "All tasks completed!";
    } else if (completedTasks >= totalTasks / 2) {
        statusMessage.innerText = "Good job! Keep going!";
    } else {
        statusMessage.innerText = "Keep working on your tasks";
    }
};
const updateTasksList = () => {
    const taskList = document.getElementById("task-list");
    taskList.innerHTML = "";

    tasks.forEach((task, index) => {
        const listItem = document.createElement("li");
        listItem.className = "taskItem";

        const { timeLeftText, timeLeftClass, iconPath } = calculateTimeLeft(task.reminderTime);

        // Show repeat frequency if task is set to repeat
        const repeatInfo = task.isRepeating ? `<small>Repeats: ${task.frequency}</small>` : "";

        listItem.innerHTML = `
            <div class="task ${task.completed ? 'completed' : ''}">
                <input type="checkbox" class="checkbox" ${task.completed ? "checked" : ""} />
                <p>${task.text}</p>
                <div class="time-left ${timeLeftClass}">
                    <img src="${iconPath}" alt="Time status icon" class="time-icon">
                    <small>${timeLeftText}</small>
                </div>
                ${repeatInfo}
            </div>
            <div class="icons">
                <img src="edit.png" onclick="editTask(${index})" />
                <img src="bin.png" onclick="deleteTask(${index})" />
            </div>
        `;

        listItem.querySelector(".checkbox").addEventListener("change", () => toggleTaskComplete(index));
        taskList.append(listItem);
    });
};
const revealTask = (index) => {
    const userPassword = prompt("Enter password to reveal task:");

    if (userPassword === tasks[index].password) {
        tasks[index].revealed = true;
        updateTasksList();
        saveTasks();
    } else {
        alert("Incorrect password!");
    }
};

const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
};

const calculateTimeLeft = (reminderTime) => {
    const now = new Date();
    const reminderDate = new Date(reminderTime);
    const timeDiff = reminderDate - now;

    let timeLeftText = "";
    let timeLeftClass = "";
    let iconPath = "";

    if (timeDiff <= 0) {
        timeLeftText = "Overdue";
        iconPath = "over.png";
        timeLeftClass = "overdue";
    } else if (timeDiff < 60 * 60 * 1000) {
        timeLeftText = "Less than 1 hour";
        iconPath = "due.png";
        timeLeftClass = "due-soon";
    } else if (timeDiff < 24 * 60 * 60 * 1000) {
        timeLeftText = `In ${Math.floor(timeDiff / (60 * 60 * 1000))} hours`;
        iconPath = "warning.png";
        timeLeftClass = "warning";
    } else {
        timeLeftText = "Plenty of time";
        iconPath = "attention.png";
        timeLeftClass = "attention";
    }

    return { timeLeftText, timeLeftClass, iconPath };
};


const getTimeLeftClass = reminderTime => {
    const timeDiff = new Date(reminderTime) - new Date();
    if (timeDiff <= 0) return "overdue";
    else if (timeDiff <= 30 * 60 * 1000) return "due-soon";
    else if (timeDiff <= 2 * 60 * 60 * 1000) return "warning";
    return "safe";
};

const getIconForTimeLeft = timeLeftClass => {
    switch (timeLeftClass) {
        case "overdue": return "./red-flag.png";
        case "due-soon": return "./orange-flag.png";
        case "warning": return "./green-flag.png";
        default: return "./blue-flag.png";
    }
};

const startReminderCheck = () => setInterval(() => tasks.forEach((task, index) => {
    if (!task.completed && task.reminderTime && new Date(task.reminderTime) <= new Date()) {
        new Notification(`Task Reminder: ${task.text}`);
        delete task.reminderTime;
        updateTasksList();
        saveTasks();
    }
}), 1000);

const requestNotificationPermission = () => {
    if (Notification.permission !== "granted") Notification.requestPermission();
};

const blastConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    const fire = (particleRatio, opts) => {
        confetti(Object.assign({}, defaults, opts, { particleCount: Math.floor(count * particleRatio) }));
    };

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
};
const setupThemeSwitcher = () => {
    const themeSelect = document.getElementById("themeSelect");
    const savedTheme = localStorage.getItem("theme") || "default";
    document.body.setAttribute("data-theme", savedTheme);
    themeSelect.value = savedTheme;

    themeSelect.addEventListener("change", () => {
        const selectedTheme = themeSelect.value;
        document.body.setAttribute("data-theme", selectedTheme);
        localStorage.setItem("theme", selectedTheme);
    });
};

document.querySelector("form").addEventListener("submit", e => { e.preventDefault(); addOrEditTask(); });
document.getElementById("secretCheckbox").addEventListener("change", function () {
    const taskPassword = document.getElementById("taskPassword");
    taskPassword.style.display = this.checked ? "block" : "none";
});
const repeatCheckbox = document.getElementById("repeatCheckbox");
const repeatFrequency = document.getElementById("repeatFrequency");

repeatCheckbox.addEventListener("change", () => {
    if (repeatCheckbox.checked) {
        repeatFrequency.style.display = "block";
    } else {
        repeatFrequency.style.display = "none";
    }
});
const rescheduleTask = (task) => {
    const reminderDate = new Date(task.reminderTime);

    switch (task.frequency) {
        case 'daily':
            reminderDate.setDate(reminderDate.getDate() + 1);
            break;
        case 'weekly':
            reminderDate.setDate(reminderDate.getDate() + 7);
            break;
        default:
            return;
    }

    task.reminderTime = reminderDate.toISOString();
};