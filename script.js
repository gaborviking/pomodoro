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
let longBreakDuration = 15 * 60; // jellemző érték

let currentTime = pomodoroDuration;
let pomodoroCount = 1;
let timer = null;
let isRunning = false;
let currentMode = 'pomodoro'; // 'pomodoro' | 'short' | 'long'

// Valódi időhöz kötött mérföldkövek
let phaseStartTs = Date.now(); // aktuális szakasz kezdete (ms)
let endTimestamp = null;       // aktuális szakasz vége (ms)

// =======================
// Perzisztencia (localStorage)
// =======================
const LS_KEY = 'pomodoro_state_v2';

// Minden reload-ra friss indulás (töröljük az előző állapotot):
try { localStorage.removeItem(LS_KEY); } catch (e) {}

function saveState() {
  const state = {
    pomodoroDuration,
    shortBreakDuration,
    longBreakDuration,
    currentTime,
    pomodoroCount,
    isRunning,
    currentMode,
    phaseStartTs,
    endTimestamp,
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e) {}
}

// (loadState megmarad, de a fenti törlés miatt reload után üres lesz.)
// Ha akarod, akár teljesen el is hagyhatod a loadState hívását.
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    pomodoroDuration = s.pomodoroDuration ?? pomodoroDuration;
    shortBreakDuration = s.shortBreakDuration ?? shortBreakDuration;
    longBreakDuration = s.longBreakDuration ?? longBreakDuration;
    pomodoroCount = s.pomodoroCount ?? pomodoroCount;
    currentMode = s.currentMode ?? currentMode;
    isRunning = s.isRunning ?? false;
    phaseStartTs = s.phaseStartTs ?? Date.now();
    endTimestamp = s.endTimestamp ?? null;
    currentTime = s.currentTime ?? currentTime;
    return true;
  } catch(e) { return false; }
}

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
  const p = Math.max(0, Math.min(100, percent));
  const offset = circumference - (p / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;
}

// Opcionális: Notification engedély kérése első kattintáskor
function ensureNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(()=>{});
  }
}
function notify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch(e) {}
  }
}

// =======================
// Idővonal-szimuláció (catch-up)
// =======================
// ÁLLÓ módban (isRunning=false) nem léptetünk!
function recomputeFromClock(now = Date.now()) {
  if (!isRunning) return;

  let mode = currentMode;
  let pCount = pomodoroCount;
  let elapsedMs = now - phaseStartTs;

  while (true) {
    const durSec = mode === 'pomodoro'
      ? pomodoroDuration
      : (mode === 'short' ? shortBreakDuration : longBreakDuration);
    const durMs = durSec * 1000;

    if (elapsedMs < durMs) {
      currentMode = mode;
      pomodoroCount = pCount;
      currentTime = Math.max(0, Math.ceil((durMs - elapsedMs) / 1000));
      endTimestamp = now + (durMs - elapsedMs);
      break;
    }

    elapsedMs -= durMs;

    if (mode === 'pomodoro') {
      mode = (pCount % 4 === 0) ? 'long' : 'short';
    } else {
      mode = 'pomodoro';
      pCount++;
    }
  }
}

// =======================
// Gomb feliratok
// =======================
const originalStartText = startButton.textContent;

// =======================
// Időzítő (END TIME + catch-up)
// =======================
function tick() {
  const now = Date.now();

  if (!endTimestamp || now > endTimestamp + 2000) {
    recomputeFromClock(now);
  } else {
    currentTime = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
  }

  updateDisplay();
  const totalDuration = getTotalDurationForMode();
  const elapsedInPhase = totalDuration - currentTime;
  const progressPercent = (elapsedInPhase / totalDuration) * 100;
  setProgress(progressPercent);

  if (currentTime <= 0) {
    try { audio.play(); } catch(e) {}
    notify('Pomodoro', currentMode === 'pomodoro' ? 'Idő lejárt! Szünet következik.' : 'Szünet vége! Dolgozzunk tovább.');
    advanceToNextPhase(now);
    endTimestamp = Date.now() + getTotalDurationForMode() * 1000;
    saveState();
  }
}

function startTimer() {
  ensureNotificationPermission();

  if (!isRunning) {
    const now = Date.now();

    if (endTimestamp && now > endTimestamp + 2000) {
      recomputeFromClock(now);
    } else if (!endTimestamp) {
      const totalMs = getTotalDurationForMode() * 1000;
      const remainingMs = currentTime * 1000;
      endTimestamp = now + remainingMs;
      phaseStartTs = now - (totalMs - remainingMs);
    } else {
      currentTime = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
    }

    timer = setInterval(tick, 500);
    isRunning = true;
    startButton.textContent = 'Megállít';
    saveState();
  } else {
    // PAUSE
    clearInterval(timer);
    timer = null;
    isRunning = false;

    const now = Date.now();
    const totalMs = getTotalDurationForMode() * 1000;
    const remainingMs = Math.max(0, (endTimestamp ?? now) - now);
    const elapsedMs = totalMs - remainingMs;

    phaseStartTs = now - elapsedMs; // konzisztencia
    endTimestamp = null;            // amíg áll, nincs élő célidő

    startButton.textContent = 'Folytatás';
    updateDisplay();
    saveState();
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

  phaseStartTs = Date.now();
  endTimestamp = null;

  setProgress(0);
  updateDisplay();
  saveState();
}

// Szakasz előreléptetése (logika központilag)
function advanceToNextPhase(fromNow = Date.now()) {
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
  phaseStartTs = fromNow;
  endTimestamp = fromNow + currentTime * 1000;
  updateDisplay();
}

// =======================
// Beállítás + / - gombok (álló állapotban módosítunk)
// =======================
function refreshSettingUI() {
  settingsDurationTime.textContent = formatTime(pomodoroDuration);
  settingsShortBreakTime.textContent = formatTime(shortBreakDuration);
  settingsLongBreakTime.textContent = formatTime(longBreakDuration);
}

plusDurationButton.addEventListener('click', () => {
  if (!isRunning) {
    pomodoroDuration += 60;
    refreshSettingUI();
    if (currentMode === 'pomodoro') {
      currentTime = pomodoroDuration;
      phaseStartTs = Date.now();
      endTimestamp = null;
      updateDisplay();
      setProgress(0);
      saveState();
    }
  }
});
minusDurationButton.addEventListener('click', () => {
  if (!isRunning && pomodoroDuration > 60) {
    pomodoroDuration -= 60;
    refreshSettingUI();
    if (currentMode === 'pomodoro') {
      currentTime = pomodoroDuration;
      phaseStartTs = Date.now();
      endTimestamp = null;
      updateDisplay();
      setProgress(0);
      saveState();
    }
  }
});

plusShortBreakButton.addEventListener('click', () => {
  if (!isRunning) {
    shortBreakDuration += 60;
    refreshSettingUI();
    if (currentMode === 'short') {
      currentTime = shortBreakDuration;
      phaseStartTs = Date.now();
      endTimestamp = null;
      updateDisplay();
      setProgress(0);
      saveState();
    }
  }
});
minusShortBreakButton.addEventListener('click', () => {
  if (!isRunning && shortBreakDuration > 60) {
    shortBreakDuration -= 60;
    refreshSettingUI();
    if (currentMode === 'short') {
      currentTime = shortBreakDuration;
      phaseStartTs = Date.now();
      endTimestamp = null;
      updateDisplay();
      setProgress(0);
      saveState();
    }
  }
});

plusLongBreakButton.addEventListener('click', () => {
  if (!isRunning) {
    longBreakDuration += 60;
    refreshSettingUI();
    if (currentMode === 'long') {
      currentTime = longBreakDuration;
      phaseStartTs = Date.now();
      endTimestamp = null;
      updateDisplay();
      setProgress(0);
      saveState();
    }
  }
});
minusLongBreakButton.addEventListener('click', () => {
  if (!isRunning && longBreakDuration > 60) {
    longBreakDuration -= 60;
    refreshSettingUI();
    if (currentMode === 'long') {
      currentTime = longBreakDuration;
      phaseStartTs = Date.now();
      endTimestamp = null;
      updateDisplay();
      setProgress(0);
      saveState();
    }
  }
});

// =======================
// Eseménykezelők
// =======================
startButton.addEventListener('click', () => {
  if (!isRunning) {
    // indulás előtt nem kell catch-up; startTimer kezeli
  }
  startTimer();
});
resetButton.addEventListener('click', resetTimer);

// A láthatóság változásakor csak futás közben „catch-up”
document.addEventListener('visibilitychange', () => {
  if (isRunning) {
    recomputeFromClock(Date.now());
  }
  updateDisplay();
  const total = getTotalDurationForMode();
  const progressPercent = ((total - currentTime) / total) * 100;
  setProgress(progressPercent);
  saveState();
});

// =======================
// Kezdő kijelzés – mindig tiszta indulás reload után
// =======================
(function initFresh() {
  isRunning = false;
  pomodoroCount = 1;
  currentMode = 'pomodoro';
  currentTime = pomodoroDuration;
  phaseStartTs = Date.now();
  endTimestamp = null;

  refreshSettingUI();
  setProgress(0);
  updateDisplay();

  // opcionális: mentjük a kiinduló állapotot
  saveState();
})();
