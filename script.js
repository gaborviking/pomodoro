// =======================
// DOM változók
// =======================
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

// =======================
// Állapot (sec-ben)
// =======================
let pomodoroDuration = 25 * 60;
let shortBreakDuration = 5 * 60;
let longBreakDuration = 25 * 60;

let currentTime = pomodoroDuration;
let pomodoroCount = 1;
let timer = null;
let isRunning = false;
let currentMode = 'pomodoro'; // 'pomodoro' | 'short' | 'long'

// ÚJ: a szakasz befejezési időpontja (ms since epoch)
let endTimestamp = null;

// =======================
// Segédfüggvények
// =======================
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function getTotalDurationForMode(mode = currentMode) {
  if (mode === 'pomodoro') return pomodoroDuration;
  if (mode === 'short') return shortBreakDuration;
  return longBreakDuration;
}

// Megjelenítés frissítése
function updateDisplay() {
  timeDisplay.textContent = formatTime(currentTime);

  if (currentMode === 'pomodoro') {
    pomodoroRound.textContent = `Pomodoro ${pomodoroCount}`;
  } else if (currentMode === 'short') {
    pomodoroRound.textContent = settingsShortBreak?.textContent || 'Rövid szünet';
  } else if (currentMode === 'long') {
    pomodoroRound.textContent = settingsLongBreak?.textContent || 'Hosszú szünet';
  }
}

// SVG progress kör
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

function setProgress(percent) {
  // percent: 0 -> üres, 100 -> tele (a jelenlegi képleted szerint)
  const p = Math.max(0, Math.min(100, percent));
  const offset = circumference - (p / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;
}

// =======================
// Gomb feliratok
// =======================
const originalStartText = startButton.textContent;

// =======================
// Időzítő logika (END TIME ALAPÚ)
// =======================
function tick() {
  const totalDuration = getTotalDurationForMode();
  const remaining = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));

  currentTime = remaining;
  updateDisplay();

  const progressPercent = ((totalDuration - remaining) / totalDuration) * 100;
  setProgress(progressPercent);

  if (remaining <= 0) {
    clearInterval(timer);
    timer = null;
    isRunning = false;
    endTimestamp = null;

    // Hang lejátszás (user interaction után működik a legtöbb böngészőben)
    try { audio.play(); } catch (e) {}

    nextSession(); // automatikus váltás és indulás
  }
}

function startTimer() {
  if (!isRunning) {
    // ha most indul/folytatódik, állítsuk be a célidőt az aktuális hátralévő alapján
    endTimestamp = Date.now() + currentTime * 1000;

    // rövidebb interval is elég, a pontoságot a Date.now() adja
    timer = setInterval(tick, 250);
    isRunning = true;
    startButton.textContent = 'Megállít';
  } else {
    // PAUSE: frissítsük a hátralévőt az aktuális idő alapján
    const remaining = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
    currentTime = remaining;

    clearInterval(timer);
    timer = null;
    isRunning = false;
    startButton.textContent = 'Folytatás';
    updateDisplay();
  }
}

function resetTimer() {
  clearInterval(timer);
  timer = null;
  isRunning = false;
  startButton.textContent = originalStartText;

  if (currentMode === 'pomodoro') currentTime = pomodoroDuration;
  else if (currentMode === 'short') currentTime = shortBreakDuration;
  else currentTime = longBreakDuration;

  endTimestamp = null;
  setProgress(100);
  updateDisplay();
}

// =======================
// Szakasz váltás
// =======================
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
  // Automatikus indulás a következő szakaszra:
  startTimer();
}

// =======================
// Beállítás + / - gombok
// (csak álló állapotban módosítunk, és ha az adott mód aktív, frissítjük a kijelzést+progresszt)
// =======================
plusDurationButton.addEventListener('click', () => {
  if (!isRunning) {
    pomodoroDuration += 60;
    settingsDurationTime.textContent = formatTime(pomodoroDuration);
    if (currentMode === 'pomodoro') {
      currentTime = pomodoroDuration;
      updateDisplay();
      setProgress(100);
    }
  }
});

minusDurationButton.addEventListener('click', () => {
  if (!isRunning && pomodoroDuration > 60) {
    pomodoroDuration -= 60;
    settingsDurationTime.textContent = formatTime(pomodoroDuration);
    if (currentMode === 'pomodoro') {
      currentTime = pomodoroDuration;
      updateDisplay();
      setProgress(100);
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
      setProgress(100);
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
      setProgress(100);
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
      setProgress(100);
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
      setProgress(100);
    }
  }
});

// =======================
// Eseménykezelők
// =======================
startButton.addEventListener('click', startTimer);
resetButton.addEventListener('click', resetTimer);

// =======================
// Kezdő kijelzés
// =======================
updateDisplay();
setProgress(100);

// (Opcionális) Láthatóság-váltás kezelése – nem szükséges a pontossághoz,
// de szebbé teheti az élményt, ha fókuszváltáskor azonnal frissítünk.
document.addEventListener('visibilitychange', () => {
  if (isRunning && endTimestamp) {
    // azonnali vizuális frissítés
    const remaining = Math.max(0, Math.ceil((endTimestamp - Date.now()) / 1000));
    currentTime = remaining;
    updateDisplay();
    const totalDuration = getTotalDurationForMode();
    const progressPercent = ((totalDuration - remaining) / totalDuration) * 100;
    setProgress(progressPercent);
  }
});
