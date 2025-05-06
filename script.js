// DOM változók
const startButton = document.querySelector('.start-button');
const resetButton = document.querySelector('.reset-button');
const timeDisplay = document.querySelector('.pomodoro-time');
const pomodoroRound = document.querySelector('.pomodoro-round');
const settingsDuration = document.querySelector('.settings-duration');
const settingsShortBreak = document.querySelector('.settings-short-break');
const settingsLongBreak = document.querySelector('.settings-long-break');
const settingsDurationTime = document.querySelector('.settings-duration-time');
const settingsShortBreakTime = document.querySelector('.settings-short-break-time');
const settingsLongBreakTime = document.querySelector('.settings-long-break-time');
const plusDurationButton = document.querySelector('.settings-duration-box .pomodoro-plus');
const minusDurationButton = document.querySelector('.settings-duration-box .pomodoro-minus');
const plusShortBreakButton = document.querySelector('.settings-short-break-box .pomodoro-plus');
const minusShortBreakButton = document.querySelector('.settings-short-break-box .pomodoro-minus');
const plusLongBreakButton = document.querySelector('.settings-long-break-box .pomodoro-plus');
const minusLongBreakButton = document.querySelector('.settings-long-break-box .pomodoro-minus');
const audio = new Audio('resources/beep.mp3');
const progressCircle = document.querySelector('.progress-ring__circle');
const radius = progressCircle.r.baseVal.value;
const circumference = 2 * Math.PI * radius;

// Időértékek sec-ben
let pomodoroDuration = 25 * 60;
let shortBreakDuration = 5 * 60;
let longBreakDuration = 25 * 60;
let currentTime = pomodoroDuration;
let pomodoroCount = 1;
let timer = null;
let isRunning = false;
let currentMode = 'pomodoro';

// Idő formázása
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// Megjelenítés frissítése
function updateDisplay() {
    timeDisplay.textContent = formatTime(currentTime);
    if (currentMode === 'pomodoro') {
        pomodoroRound.textContent = `Pomodoro ${pomodoroCount}`;
    } else if (currentMode === 'short') {
        pomodoroRound.textContent = settingsShortBreak.textContent;
    } else if (currentMode === 'long') {
        pomodoroRound.textContent = settingsLongBreak.textContent;
    }
}

// Eredeti start gomb szöveg eltárolása
const originalStartText = startButton.textContent;

// Időzítő logika
function startTimer() {
    if (!isRunning) {
        timer = setInterval(() => {
            currentTime--;
            updateDisplay();
            let totalDuration;
            if (currentMode === 'pomodoro') {
                totalDuration = pomodoroDuration;
            } else if (currentMode === 'short') {
                totalDuration = shortBreakDuration;
            } else if (currentMode === 'long') {
                totalDuration = longBreakDuration;
            }
            const progressPercent = ((totalDuration - currentTime) / totalDuration) * 100;
            setProgress(progressPercent);
            if (currentTime <= 0) {
                clearInterval(timer);
                audio.play();
                nextSession();
            }
        }, 1000);
        isRunning = true;
        startButton.textContent = 'Megállít';
    } else {
        clearInterval(timer);
        isRunning = false;
        startButton.textContent = 'Folytatás';
    }
}

// Reset logika
function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    startButton.textContent = originalStartText;
    if (currentMode === 'pomodoro') {
        currentTime = pomodoroDuration;
    } else if (currentMode === 'short') {
        currentTime = shortBreakDuration;
    } else if (currentMode === 'long') {
        currentTime = longBreakDuration;
    }
    setProgress(100);
    updateDisplay();
}


// Következő szakasz logika
function nextSession() {
    if (currentMode === 'pomodoro') {
        if (pomodoroCount % 4 === 0) {
            currentMode = 'long';
            currentTime = longBreakDuration;
        } else {
            currentMode = 'short';
            currentTime = shortBreakDuration;
        }
    } else {
        currentMode = 'pomodoro';
        pomodoroCount++;
        currentTime = pomodoroDuration;
    }
    updateDisplay();
    isRunning = false;
    startTimer();
}


// Plusz gombok
plusDurationButton.addEventListener('click', () => {
    if (!isRunning) {
        pomodoroDuration += 60;
        settingsDurationTime.textContent = formatTime(pomodoroDuration);
        if (currentMode === 'pomodoro') {
            currentTime = pomodoroDuration;
            updateDisplay();
        }
    }
});

plusShortBreakButton.addEventListener('click', () => {
    if (!isRunning) {
        shortBreakDuration += 60;
        settingsShortBreakTime.textContent = formatTime(shortBreakDuration);
        if (currentMode === 'short') {
            currentTime = shortBreakDuration;
            updateDisplay();
        }
    }
});

plusLongBreakButton.addEventListener('click', () => {
    if (!isRunning) {
        longBreakDuration += 60;
        settingsLongBreakTime.textContent = formatTime(longBreakDuration);
        if (currentMode === 'long') {
            currentTime = longBreakDuration;
            updateDisplay();
        }
    }
});

// Minus gombok
minusDurationButton.addEventListener('click', () => {
    if (!isRunning && pomodoroDuration > 60) {
        pomodoroDuration -= 60;
        settingsDurationTime.textContent = formatTime(pomodoroDuration);
        if (currentMode === 'pomodoro') {
            currentTime = pomodoroDuration;
            updateDisplay();
        }
    }
});

minusShortBreakButton.addEventListener('click', () => {
    if (!isRunning && shortBreakDuration > 60) {
        shortBreakDuration -= 60;
        settingsShortBreakTime.textContent = formatTime(shortBreakDuration);
        if (currentMode === 'short') {
            currentTime = shortBreakDuration;
            updateDisplay();
        }
    }
});

minusLongBreakButton.addEventListener('click', () => {
    if (!isRunning && longBreakDuration > 60) {
        longBreakDuration -= 60;
        settingsLongBreakTime.textContent = formatTime(longBreakDuration);
        if (currentMode === 'long') {
            currentTime = longBreakDuration;
            updateDisplay();
        }
    }
});


// Eseménykezelők
startButton.addEventListener('click', startTimer);
resetButton.addEventListener('click', resetTimer);

// Kezdő kijelzés
updateDisplay();

// SVG animáció
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;
function setProgress(percent) {
    const offset = circumference - percent / 100 * circumference;
    progressCircle.style.strokeDashoffset = offset;
}
setProgress(100);
