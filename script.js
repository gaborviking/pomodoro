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
    // currentTime-ot úgyis újraszámoljuk vagy megtartjuk a módtól függően
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
// FIX: álló módban (isRunning=false) semmit ne léptessen!
function recomputeFromClock(now = Date.now()) {
  if (!isRunning) return; // <<<<< fontos védelem

  let mode = currentMode;
  let pCount = pomodoroCount;

  // Visszamenőleg kiszámoljuk, mennyi ideje fut ez a szakasz
  let elapsedMs = now - phaseStartTs;

  while (true) {
    const durSec = mode === 'pomodoro'
      ? pomodoroDuration
      : (mode === 'short' ? shortBreakDuration : longBreakDuration);
    const durMs = durSec * 1000;

    if (elapsedMs < durMs) {
      // még ebben a szakaszban vagyunk
      currentMode = mode;
      pomodoroCount = pCount;
      currentTime = Math.max(0, Math.ceil((durMs - elapsedMs) / 1000));
      endTimestamp = now + (durMs - elapsedMs);
      break;
    }

    // továbblépünk a következő szakaszra
    elapsedMs -= durMs;

    if (mode === 'pomodoro') {
      // 4. pomodoro után hosszú szünet, különben rövid
      if (pCount % 4 === 0) {
        mode = 'long';
      } else {
        mode = 'short';
      }
    } else {
      // bármely szünet után új pomodoro
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

  // Ha valamiért csúszás történt (throttling/fagyasztás), kérjük újra a teljes állapotot
  if (!endTimestamp || now > endTimestamp + 2000) {
    // nagyobb a csúszás, számoljuk újra az egészet a fenti szimulációval
    recomputeFromClock(now);
  } else {
    // normál futás: sima hátralévő
    currentTime = Math.max(0, Math.ceil((endTimestamp - now) / 1000));
  }

  // Kijelző + progress
  updateDisplay();
  const totalDuration = getTotalDurationForMode();
  const elapsedInPhase = totalDuration - currentTime;
  const progressPercent = (elapsedInPhase / totalDuration) * 100;
  setProgress(progressPercent);

  // Szakasz vége?
  if (currentTime <= 0) {
    try { audio.play(); } catch(e) {}
    notify('Pomodoro', currentMode === 'pomodoro' ? 'Idő lejárt! Szünet következik.' : 'Szünet vége! Dolgozzunk tovább.');
    // Új szakaszra lépés és azonnali újraszámolás
    advanceToNextPhase(now);
    // új endTimestamp beállítása
    endTimestamp = Date.now() + getTotalDurationForMode() * 1000;
    saveState();
  }
}

function startTimer() {
  ensureNotificationPermission();

  if (!isRunning) {
    const now = Date.now();

    if (endTimestamp && now > endTimestamp + 2000) {
      // ha nagyon elcsúszott, csak ekkor catch-upolunk
      recomputeFromClock(now);
    } else if (!endTimestamp) {
      // PAUSE-ból vagy friss indulás: építsük újra a határidőt a megmaradt időből
      const totalMs = getTotalDurationForMode() * 1000;
      const remainingMs = currentTime * 1000;
      endTimestamp = now + remainingMs;
      // olyan phaseStartTs, mintha a szakasz a „total - remaining” idővel ezelőtt indult volna
      phaseStartTs = now - (totalMs - remainingMs);
    } else {
      // normál eset: igazítjuk a currentTime-ot
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

    // Fagyasztott állapot: állapítsuk be úgy, hogy a CURRENT állapotból ne „haladjon tovább”
    phaseStartTs = now - elapsedMs; // csak konzisztenciához
    endTimestamp = null;            // <<<<< nagyon fontos: amíg áll, ne legyen élő célidő!

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
  endTimestamp = null; // reset után álló állapotban nincs élő célidő

  setProgress(0); // induláskor 0% kész
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
    // indulás előtt csak akkor igazítunk „valódi idő” alapján, ha kell
    // (startTimer kezeli a szükséges eseteket)
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
// Kezdő kijelzés / visszatöltés
// =======================
if (!loadState()) {
  // első betöltés
  refreshSettingUI();
  phaseStartTs = Date.now();
  currentMode = 'pomodoro';
  currentTime = pomodoroDuration;
  endTimestamp = null; // álló állapot
  setProgress(0);
  updateDisplay();
  saveState();
} else {
  refreshSettingUI();

  if (isRunning) {
    // Csak futás közben catch-up
    recomputeFromClock(Date.now());
  } else {
    // PAUSE: tartsuk meg a fagyasztott hátralévőt
    endTimestamp = null; // jelezzük, hogy nincs élő „vége időpont”
  }

  const total = getTotalDurationForMode();
  const progressPercent = ((total - currentTime) / total) * 100;
  setProgress(progressPercent);
  updateDisplay();
}
