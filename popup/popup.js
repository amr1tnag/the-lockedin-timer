const CIRCUMFERENCE = 2 * Math.PI * 80; // 502.65

let pollId = null;

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function modeLabel(mode) {
  return { focus: 'FOCUS', shortBreak: 'SHORT BREAK', longBreak: 'LONG BREAK' }[mode] || 'POMODORO';
}

function statusText(mode) {
  return {
    focus: '[ STATUS: ACTIVE ]',
    shortBreak: '[ STATUS: SHORT_BREAK ]',
    longBreak: '[ STATUS: LONG_BREAK ]'
  }[mode] || '[ STATUS: IDLE ]';
}

function setRing(remaining, total) {
  const progress = total > 0 ? remaining / total : 1;
  document.getElementById('ring-fill').style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

async function render() {
  const { timer, settings, sessions, blocklist } = await chrome.storage.local.get([
    'timer', 'settings', 'sessions', 'blocklist'
  ]);

  const t  = timer    || { mode: 'idle', startTime: null, duration: 0, pomodoroCount: 0 };
  const s  = settings || { focusDuration: 25, shortBreak: 5, longBreak: 15 };
  const bl = blocklist || ['facebook.com', 'youtube.com', 'reddit.com'];
  const sess = sessions || [];

  const defaultDuration = s.focusDuration * 60 * 1000;
  const remaining = (t.startTime && t.duration)
    ? Math.max(0, (t.startTime + t.duration) - Date.now())
    : defaultDuration;

  document.getElementById('time-display').textContent = fmt(remaining);
  document.getElementById('time-mode').textContent = modeLabel(t.mode);
  document.getElementById('status-pill').textContent = statusText(t.mode);
  setRing(remaining, t.duration || defaultDuration);

  // Action button
  const btn = document.getElementById('action-btn');
  if (t.mode === 'focus') {
    btn.innerHTML = '&#9632;&nbsp;&nbsp;STOP_SESSION';
    btn.classList.add('stop');
  } else if (t.mode === 'shortBreak' || t.mode === 'longBreak') {
    btn.innerHTML = '&#9632;&nbsp;&nbsp;END_BREAK';
    btn.classList.add('stop');
  } else {
    btn.innerHTML = '&#9654;&nbsp;&nbsp;START_FOCUS';
    btn.classList.remove('stop');
  }

  // Mini blocklist
  document.getElementById('mini-list').innerHTML = bl.slice(0, 7).map((d, i) => `
    <li>
      <span class="num">${String(i + 1).padStart(2, '0')}.</span>
      <span class="domain">${d}</span>
    </li>
  `).join('');

  // Data stats
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const todaySess  = sess.filter(s => new Date(s.date) >= todayStart);
  const weekSess   = sess.filter(s => new Date(s.date) >= weekStart);
  const totalMins  = sess.reduce((a, s) => a + (s.duration || 0), 0);

  document.getElementById('d-today').textContent = todaySess.length;
  document.getElementById('d-week').textContent  = weekSess.length;
  document.getElementById('d-total').textContent = sess.length;
  document.getElementById('d-count').textContent = t.pomodoroCount || 0;
  document.getElementById('d-hours').textContent = `${Math.floor(totalMins / 60)}H ${totalMins % 60}M`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await render();
  pollId = setInterval(render, 1000);

  document.getElementById('action-btn').addEventListener('click', async () => {
    const { timer } = await chrome.storage.local.get(['timer']);
    const t = timer || { mode: 'idle' };
    await chrome.runtime.sendMessage({ type: t.mode === 'idle' ? 'START_FOCUS' : 'STOP' });
    await render();
  });

  document.getElementById('btn-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.getElementById('btn-manage-block').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pane = btn.dataset.pane;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`pane-${pane}`).classList.add('active');
      render();
    });
  });
});

window.addEventListener('unload', () => clearInterval(pollId));
