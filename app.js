'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let hour = 8;
let minute = 0;
let isAm = true;

// Minimum effective clock-in: 7:30 AM → clocks out at 4:00 PM
const MIN_CLOCKIN_MINUTES = 7 * 60 + 30; // 450

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

// Press-and-hold to spin continuously
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
    // Commit any pending typed values first
    commitHour();
    commitMinute();

    const h24 = isAm
        ? (hour === 12 ? 0 : hour)
        : (hour === 12 ? 12 : hour + 12);

    let inMin = h24 * 60 + minute;

    // ── Early clamp rule ─────────────────────────────────────────────────────
    // If clock-in is earlier than 07:30 AM, treat it as 07:30 AM.
    // 07:30 + 8h 30m = 16:00 → 4:00 PM
    const isBefore730 = isAm && inMin < MIN_CLOCKIN_MINUTES;
    const effectiveIn = isBefore730 ? MIN_CLOCKIN_MINUTES : inMin;

    const outMin = effectiveIn + 8 * 60 + 30; // + 8h 30m

    const cinStr = fmt12(inMin);         // show actual clock-in
    const cinEff = fmt12(effectiveIn);   // effective (for note)
    const coutStr = fmt12(outMin);

    resultTime.textContent = coutStr;
    arrowIn.textContent = cinStr;
    arrowOut.textContent = coutStr;

    // Show an early-bird note if clamp applied
    const note = document.getElementById('earlyNote');
    if (isBefore730) {
        note.textContent = `Arrived before 07:30 AM — counted from ${cinEff}`;
        note.style.display = 'block';
    } else {
        note.style.display = 'none';
    }

    resultPanel.classList.remove('hidden');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ── Reset ─────────────────────────────────────────────────────────────────────
document.getElementById('resetBtn').addEventListener('click', () => {
    hour = 8; minute = 0;
    setAmPm(true);
    refreshDisplay();
    resultPanel.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
