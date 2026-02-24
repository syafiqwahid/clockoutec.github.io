'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let hour = 8;
let minute = 0;
let isAm = true;

// Minimum effective clock-in: 7:30 AM → clocks out at 4:00 PM
const MIN_CLOCKIN_MINUTES = 7 * 60 + 30; // 450

// Current calculated result (null until calculated)
let currentResult = null;

// Alarm state
let alarmTimer = null;
let alarmCountdownTimer = null;
let alarmTargetMs = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const hourDisplay = document.getElementById('hourDisplay');
const minuteDisplay = document.getElementById('minuteDisplay');
const amBtn = document.getElementById('amBtn');
const pmBtn = document.getElementById('pmBtn');
const resultPanel = document.getElementById('resultPanel');
const resultTime = document.getElementById('resultTime');
const arrowIn = document.getElementById('arrowIn');
const arrowOut = document.getElementById('arrowOut');
const installBanner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const saveBtn = document.getElementById('saveBtn');
const setAlarmBtn = document.getElementById('setAlarmBtn');
const alarmStatus = document.getElementById('alarmStatus');
const alarmTimeLabel = document.getElementById('alarmTimeLabel');
const alarmCountdown = document.getElementById('alarmCountdown');
const cancelAlarmBtn = document.getElementById('cancelAlarmBtn');
const alarmOverlay = document.getElementById('alarmOverlay');
const alarmMsg = document.getElementById('alarmMsg');
const dismissAlarmBtn = document.getElementById('dismissAlarmBtn');
const saveToast = document.getElementById('saveToast');
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ── Helpers ──────────────────────────────────────────────────────────────────
function padTwo(n) { return String(n).padStart(2, '0'); }

function fmt12(totalMinutes) {
    const h24 = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    const ap = h24 < 12 ? 'AM' : 'PM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${padTwo(h12)}:${padTwo(m)} ${ap}`;
}

function refreshDisplay() {
    hourDisplay.value = padTwo(hour);
    minuteDisplay.value = padTwo(minute);
}

function setAmPm(am) {
    isAm = am;
    amBtn.classList.toggle('selected', am);
    pmBtn.classList.toggle('selected', !am);
}

// Validate and commit hour input (1–12)
function commitHour() {
    let v = parseInt(hourDisplay.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 12) v = 12;
    hour = v;
    hourDisplay.value = padTwo(hour);
}

// Validate and commit minute input (0–59)
function commitMinute() {
    let v = parseInt(minuteDisplay.value, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 59) v = 59;
    minute = v;
    minuteDisplay.value = padTwo(minute);
}

// ── Keyboard input ────────────────────────────────────────────────────────────
hourDisplay.addEventListener('focus', () => hourDisplay.select());
hourDisplay.addEventListener('blur', () => commitHour());
hourDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') { commitHour(); minuteDisplay.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); commitHour(); hour = hour >= 12 ? 1 : hour + 1; refreshDisplay(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); commitHour(); hour = hour <= 1 ? 12 : hour - 1; refreshDisplay(); }
});

minuteDisplay.addEventListener('focus', () => minuteDisplay.select());
minuteDisplay.addEventListener('blur', () => commitMinute());
minuteDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { commitMinute(); document.getElementById('calcBtn').click(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); commitMinute(); minute = minute >= 59 ? 0 : minute + 1; refreshDisplay(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); commitMinute(); minute = minute <= 0 ? 59 : minute - 1; refreshDisplay(); }
});

// ── Spinners ──────────────────────────────────────────────────────────────────
function doHourUp() { hour = hour >= 12 ? 1 : hour + 1; refreshDisplay(); }
function doHourDown() { hour = hour <= 1 ? 12 : hour - 1; refreshDisplay(); }
function doMinuteUp() { minute = minute >= 59 ? 0 : minute + 1; refreshDisplay(); }
function doMinuteDown() { minute = minute <= 0 ? 59 : minute - 1; refreshDisplay(); }

let holdTimer = null;
let holdInterval = null;

function startHold(action) {
    action();
    holdTimer = setTimeout(() => { holdInterval = setInterval(action, 80); }, 400);
}
function stopHold() { clearTimeout(holdTimer); clearInterval(holdInterval); }

const spinMap = { hourUp: doHourUp, hourDown: doHourDown, minuteUp: doMinuteUp, minuteDown: doMinuteDown };

Object.entries(spinMap).forEach(([id, action]) => {
    const btn = document.getElementById(id);
    btn.addEventListener('mousedown', () => startHold(action));
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(action); }, { passive: false });
    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);
    btn.addEventListener('touchend', stopHold);
});

// ── AM / PM ───────────────────────────────────────────────────────────────────
amBtn.addEventListener('click', () => setAmPm(true));
pmBtn.addEventListener('click', () => setAmPm(false));

// ── Calculate ─────────────────────────────────────────────────────────────────
document.getElementById('calcBtn').addEventListener('click', () => {
    commitHour();
    commitMinute();

    const h24 = isAm
        ? (hour === 12 ? 0 : hour)
        : (hour === 12 ? 12 : hour + 12);

    let inMin = h24 * 60 + minute;

    const isBefore730 = isAm && inMin < MIN_CLOCKIN_MINUTES;
    const effectiveIn = isBefore730 ? MIN_CLOCKIN_MINUTES : inMin;
    const outMin = effectiveIn + 8 * 60 + 30;

    const cinStr = fmt12(inMin);
    const cinEff = fmt12(effectiveIn);
    const coutStr = fmt12(outMin);

    resultTime.textContent = coutStr;
    arrowIn.textContent = cinStr;
    arrowOut.textContent = coutStr;

    const note = document.getElementById('earlyNote');
    if (isBefore730) {
        note.textContent = `Arrived before 07:30 AM — counted from ${cinEff}`;
        note.style.display = 'block';
    } else {
        note.style.display = 'none';
    }

    // Store current result for save / alarm
    currentResult = { clockIn: cinStr, clockOut: coutStr, outMin, date: new Date().toLocaleDateString() };

    resultPanel.classList.remove('hidden');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ── Reset ─────────────────────────────────────────────────────────────────────
document.getElementById('resetBtn').addEventListener('click', () => {
    hour = 8; minute = 0;
    setAmPm(true);
    refreshDisplay();
    resultPanel.classList.add('hidden');
    currentResult = null;
    cancelAlarm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Save Result (localStorage) ─────────────────────────────────────────────────
const STORAGE_KEY = 'puasa_clockin_history';

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function saveHistory(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function renderHistory() {
    const list = loadHistory();
    if (list.length === 0) {
        historySection.style.display = 'none';
        return;
    }
    historySection.style.display = 'block';
    historyList.innerHTML = '';
    // Show newest first
    [...list].reverse().forEach((entry, idx) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        li.innerHTML = `
            <div class="history-meta">${entry.date}</div>
            <div class="history-times">
                <span class="purple">${entry.clockIn}</span>
                <span class="arrow-icon" style="font-size:0.9rem;padding:0 6px">→</span>
                <span class="pink">${entry.clockOut}</span>
            </div>
            <button class="delete-entry-btn" data-idx="${list.length - 1 - idx}" title="Delete entry">✕</button>
        `;
        historyList.appendChild(li);
    });

    // Delete individual entries
    historyList.querySelectorAll('.delete-entry-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const entries = loadHistory();
            entries.splice(parseInt(btn.dataset.idx), 1);
            saveHistory(entries);
            renderHistory();
        });
    });
}

saveBtn.addEventListener('click', () => {
    if (!currentResult) return;
    const list = loadHistory();
    list.push({
        date: currentResult.date,
        clockIn: currentResult.clockIn,
        clockOut: currentResult.clockOut,
    });
    saveHistory(list);
    renderHistory();
    showToast();
});

clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
});

function showToast() {
    saveToast.classList.remove('hidden');
    setTimeout(() => saveToast.classList.add('hidden'), 2500);
}

// ── Alarm ─────────────────────────────────────────────────────────────────────

// Build silence AudioContext beep (fallback when Notification not available)
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playBeep() {
    try {
        const ctx = getAudioCtx();
        const freqs = [880, 1046, 1320]; // A5, C6, E6
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.4);
            osc.start(ctx.currentTime + i * 0.25);
            osc.stop(ctx.currentTime + i * 0.25 + 0.5);
        });
    } catch (err) { console.warn('Audio error:', err); }
}

function fireAlarm() {
    clearAlarmTimers();
    playBeep();

    // Notification
    if (Notification.permission === 'granted') {
        new Notification('⏰ Time to Clock-Out!', {
            body: `Your clock-out time (${currentResult?.clockOut ?? ''}) has arrived. Go home! 🏠`,
            icon: 'icons/icon-192.png',
            tag: 'clockout-alarm',
        });
    }

    // In-page overlay
    alarmMsg.textContent = `It's ${currentResult?.clockOut ?? 'clock-out time'}. Time to go home! 🏠`;
    alarmOverlay.classList.remove('hidden');

    // State reset
    alarmStatus.classList.add('hidden');
    alarmTargetMs = null;
    setAlarmBtn.disabled = false;
}

function clearAlarmTimers() {
    clearTimeout(alarmTimer);
    clearInterval(alarmCountdownTimer);
    alarmTimer = null;
    alarmCountdownTimer = null;
}

function cancelAlarm() {
    clearAlarmTimers();
    alarmTargetMs = null;
    alarmStatus.classList.add('hidden');
    setAlarmBtn.disabled = false;
}

function msUntilOut(outMin) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetMs = today.getTime() + outMin * 60 * 1000;
    return targetMs - now.getTime();
}

function startCountdown() {
    clearInterval(alarmCountdownTimer);
    alarmCountdownTimer = setInterval(() => {
        if (!alarmTargetMs) return;
        const diff = alarmTargetMs - Date.now();
        if (diff <= 0) { alarmCountdown.textContent = 'Now!'; return; }
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);
        alarmCountdown.textContent = h > 0
            ? `in ${h}h ${padTwo(m)}m ${padTwo(s)}s`
            : `in ${padTwo(m)}m ${padTwo(s)}s`;
    }, 1000);
}

setAlarmBtn.addEventListener('click', async () => {
    if (!currentResult) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }

    const delay = msUntilOut(currentResult.outMin);

    if (delay <= 0) {
        alert('Clock-out time has already passed today! Please recalculate.');
        return;
    }

    cancelAlarm(); // clear any existing

    alarmTargetMs = Date.now() + delay;
    alarmTimer = setTimeout(fireAlarm, delay);

    alarmTimeLabel.textContent = currentResult.clockOut;
    alarmStatus.classList.remove('hidden');
    startCountdown();
    setAlarmBtn.disabled = true;
});

cancelAlarmBtn.addEventListener('click', cancelAlarm);

dismissAlarmBtn.addEventListener('click', () => {
    alarmOverlay.classList.add('hidden');
});

// ── PWA Install ───────────────────────────────────────────────────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') installBanner.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
    installBanner.classList.add('hidden');
    deferredPrompt = null;
});

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.warn('SW registration failed:', err));
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderHistory();
