const hourHand = document.querySelector('#hourHand');
const minuteHand = document.querySelector('#minuteHand');
const secondHand = document.querySelector('#secondHand');
const digitalTime = document.querySelector('#digitalTime');
const dateText = document.querySelector('#dateText');
const enableButton = document.querySelector('#enableButton');
const testButton = document.querySelector('#testButton');
const installButton = document.querySelector('#installButton');
const statusText = document.querySelector('#status');
const volumeInput = document.querySelector('#volume');
const nightModeInput = document.querySelector('#nightMode');
const nightStartInput = document.querySelector('#nightStart');
const nightEndInput = document.querySelector('#nightEnd');
const hourBell = document.querySelector('#hourBell');
const quarterBell = document.querySelector('#quarterBell');

let bellsEnabled = localStorage.getItem('bellsEnabled') === 'true';
let lastChimeKey = '';
let deferredInstallPrompt = null;
let wakeLock = null;

function updateClock() {
  const now = new Date();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;

  secondHand.style.transform = `rotate(${seconds * 6}deg)`;
  minuteHand.style.transform = `rotate(${minutes * 6}deg)`;
  hourHand.style.transform = `rotate(${hours * 30}deg)`;
  digitalTime.textContent = now.toLocaleTimeString('it-IT');
  dateText.textContent = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  maybeChime(now);
  requestAnimationFrame(updateClock);
}

function minutesOfDay(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function isNightTime(now) {
  if (!nightModeInput.checked) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesOfDay(nightStartInput.value);
  const end = minutesOfDay(nightEndInput.value);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function maybeChime(now) {
  if (!bellsEnabled || isNightTime(now)) return;
  const minute = now.getMinutes();
  if (![0, 15, 30, 45].includes(minute) || now.getSeconds() > 2) return;
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${minute}`;
  if (key === lastChimeKey) return;
  lastChimeKey = key;
  const hourCount = now.getHours() % 12 || 12;
  const quarterCount = minute / 15;
  playSequence(hourCount, quarterCount);
}

function createBellClone(source) {
  const bell = source.cloneNode();
  bell.volume = Number(volumeInput.value);
  return bell;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function playHits(source, count, spacing) {
  for (let i = 0; i < count; i++) {
    const bell = createBellClone(source);
    bell.play().catch(() => {});
    if (i < count - 1) await sleep(spacing);
  }
}

async function playSequence(hourCount, quarterCount) {
  statusText.textContent = `Rintocchi: ${hourCount} ore${quarterCount ? ` + ${quarterCount} quarti` : ''}`;
  await playHits(hourBell, hourCount, 1620);
  if (quarterCount > 0) {
    await sleep(2450);
    await playHits(quarterBell, quarterCount, 2290);
  }
  statusText.textContent = 'Campane attive';
}

async function enableAudio() {
  hourBell.volume = 0;
  quarterBell.volume = 0;
  await Promise.allSettled([hourBell.play(), quarterBell.play()]);
  hourBell.pause(); quarterBell.pause();
  hourBell.currentTime = 0; quarterBell.currentTime = 0;
  hourBell.volume = Number(volumeInput.value);
  quarterBell.volume = Number(volumeInput.value);
}

async function toggleBells() {
  bellsEnabled = !bellsEnabled;
  if (bellsEnabled) {
    await enableAudio();
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (_) {}
  } else if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  localStorage.setItem('bellsEnabled', String(bellsEnabled));
  renderState();
}

function renderState() {
  enableButton.textContent = bellsEnabled ? '🔕 Disattiva campane' : '🔔 Attiva campane';
  enableButton.classList.toggle('primary', !bellsEnabled);
  statusText.textContent = bellsEnabled ? 'Campane attive' : 'Campane non attive';
}

enableButton.addEventListener('click', toggleBells);
testButton.addEventListener('click', async () => {
  await enableAudio();
  playSequence(4, 3);
});

for (const element of [volumeInput, nightModeInput, nightStartInput, nightEndInput]) {
  const key = element.id;
  const stored = localStorage.getItem(key);
  if (stored !== null) element.type === 'checkbox' ? element.checked = stored === 'true' : element.value = stored;
  element.addEventListener('change', () => localStorage.setItem(key, element.type === 'checkbox' ? String(element.checked) : element.value));
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && bellsEnabled && 'wakeLock' in navigator) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

renderState();
updateClock();
