const CIRCUMFERENCE = 2 * Math.PI * 90; // 565.49

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function fmtLong(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

async function update() {
  const { timer } = await chrome.storage.local.get(['timer']);
  const t = timer;

  if (!t || t.mode !== 'focus' || !t.startTime || !t.duration) {
    document.getElementById('time-display').textContent = '--:--';
    document.getElementById('term-text').textContent = 'SESSION_TERMINATION_IN: --';
    document.getElementById('ring-fill').style.strokeDashoffset = 0;
    return;
  }

  const remaining = Math.max(0, (t.startTime + t.duration) - Date.now());
  const progress = remaining / t.duration;

  document.getElementById('time-display').textContent = fmt(remaining);
  document.getElementById('term-text').textContent = `SESSION_TERMINATION_IN: ${fmtLong(remaining)}`;
  document.getElementById('ring-fill').style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

document.getElementById('return-btn').addEventListener('click', () => {
  if (window.history.length > 1) {
    history.back();
  } else {
    window.close();
  }
});

update();
setInterval(update, 1000);
