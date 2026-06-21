const CIRCUMFERENCE = 2 * Math.PI * 80; // 502.65

let blocklist = [];
let settings = { focusDuration: 25, shortBreak: 5, longBreak: 15, hardcoreMode: false, longBreakInterval: 4 };

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function minsDisplay(m) {
  return `${String(m).padStart(2, '0')}:00`;
}

function modeLabel(mode) {
  return { focus: 'FOCUS', shortBreak: 'SHORT BREAK', longBreak: 'LONG BREAK' }[mode] || 'POMODORO';
}

function sysMode(mode) {
  return { focus: '■ MODE: FOCUS', shortBreak: '■ MODE: BREAK', longBreak: '■ MODE: LONG BREAK' }[mode] || '■ MODE: IDLE';
}

function renderBlocklist() {
  document.getElementById('locked-count').textContent = `LOCKED: ${blocklist.length}`;
  document.getElementById('block-list').innerHTML = blocklist.map((domain, i) => `
    <li>
      <div class="entry-info">
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <span>
          <span class="domain">${domain}</span>
          <span class="ts">TS: ADDED</span>
        </span>
      </div>
      <button class="remove-btn" data-index="${i}">&times;</button>
    </li>
  `).join('');

  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      blocklist.splice(parseInt(btn.dataset.index), 1);
      renderBlocklist();
    });
  });
}

function renderSettings() {
  document.getElementById('sl-focus').value  = settings.focusDuration;
  document.getElementById('val-focus').textContent = minsDisplay(settings.focusDuration);
  document.getElementById('sl-short').value  = settings.shortBreak;
  document.getElementById('val-short').textContent = minsDisplay(settings.shortBreak);
  document.getElementById('sl-long').value   = settings.longBreak;
  document.getElementById('val-long').textContent  = minsDisplay(settings.longBreak);
  document.getElementById('toggle-hardcore').checked = !!settings.hardcoreMode;
  document.getElementById('sl-interval').value = settings.longBreakInterval || 4;
  document.getElementById('val-interval').textContent = settings.longBreakInterval || 4;
}

function renderInsights(sessions, timer) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);

  const todaySess = sessions.filter(s => new Date(s.date) >= todayStart);
  const weekSess  = sessions.filter(s => new Date(s.date) >= weekStart);
  const totalMins = sessions.reduce((a, s) => a + (s.duration || 0), 0);

  document.getElementById('ins-today').textContent = todaySess.length;
  document.getElementById('ins-week').textContent  = weekSess.length;
  document.getElementById('ins-total').textContent = sessions.length;
  document.getElementById('ins-hours').textContent = `${Math.floor(totalMins / 60)}H`;

  const list = document.getElementById('session-list');
  list.innerHTML = sessions.length
    ? sessions.slice(-15).reverse().map(s => {
        const d = new Date(s.date);
        return `<li><span>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span><span>${s.duration}MIN &#10003;</span></li>`;
      }).join('')
    : '<li><span style="color:#2a2a2a">NO_SESSIONS_RECORDED</span></li>';
}

function updateTimerDisplay(timer) {
  const t = timer || { mode: 'idle', startTime: null, duration: 0 };
  const remaining = (t.startTime && t.duration)
    ? Math.max(0, (t.startTime + t.duration) - Date.now())
    : settings.focusDuration * 60 * 1000;

  const el = document.getElementById('opt-time');
  if (el) el.textContent = fmt(remaining);
  const modeEl = document.getElementById('opt-mode');
  if (modeEl) modeEl.textContent = modeLabel(t.mode);

  const ring = document.getElementById('opt-ring');
  if (ring) {
    const progress = t.duration > 0 ? remaining / t.duration : 1;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  }

  const btn = document.getElementById('opt-action-btn');
  if (btn) {
    btn.innerHTML = t.mode === 'idle'
      ? '&#9654;&nbsp; START_FOCUS'
      : '&#9632;&nbsp; STOP_SESSION';
  }

  const modeDisplay = document.getElementById('sys-mode');
  if (modeDisplay) modeDisplay.textContent = sysMode(t.mode);
}

async function loadAll() {
  const data = await chrome.storage.local.get(['blocklist', 'settings', 'sessions', 'timer']);
  blocklist = data.blocklist || ['facebook.com', 'youtube.com', 'reddit.com'];
  settings  = data.settings  || { focusDuration: 25, shortBreak: 5, longBreak: 15, hardcoreMode: false, longBreakInterval: 4 };

  renderBlocklist();
  renderSettings();
  renderInsights(data.sessions || [], data.timer);
  updateTimerDisplay(data.timer);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();

  // Sidebar navigation
  document.querySelectorAll('.side-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`section-${btn.dataset.section}`).classList.remove('hidden');
    });
  });

  // Add to blocklist
  const addEntry = () => {
    const input = document.getElementById('url-input');
    let val = input.value.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '');
    if (val && !blocklist.includes(val)) {
      blocklist.push(val);
      renderBlocklist();
      input.value = '';
    }
  };

  document.getElementById('add-btn').addEventListener('click', addEntry);
  document.getElementById('url-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addEntry();
  });

  // Save blocklist
  document.getElementById('save-bl-btn').addEventListener('click', async () => {
    await chrome.storage.local.set({ blocklist });
    await chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKLIST', blocklist });
    const btn = document.getElementById('save-bl-btn');
    btn.textContent = 'SAVED ✓';
    setTimeout(() => btn.textContent = 'SAVE_CONFIGURATION', 2000);
  });

  // Sliders
  [['sl-focus', 'val-focus', 'focusDuration', true],
   ['sl-short', 'val-short', 'shortBreak',    true],
   ['sl-long',  'val-long',  'longBreak',      true]
  ].forEach(([slId, valId, key, asMins]) => {
    document.getElementById(slId).addEventListener('input', e => {
      const v = parseInt(e.target.value);
      settings[key] = v;
      document.getElementById(valId).textContent = asMins ? minsDisplay(v) : v;
    });
  });

  document.getElementById('toggle-hardcore').addEventListener('change', e => {
    settings.hardcoreMode = e.target.checked;
  });

  document.getElementById('sl-interval').addEventListener('input', e => {
    settings.longBreakInterval = parseInt(e.target.value);
    document.getElementById('val-interval').textContent = e.target.value;
  });

  // Save settings
  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    await chrome.storage.local.set({ settings });
    const btn = document.getElementById('save-settings-btn');
    btn.textContent = 'SAVED ✓';
    setTimeout(() => btn.textContent = 'SAVE_SETTINGS', 2000);
  });

  // Timer action button in 01. TIMER section
  document.getElementById('opt-action-btn').addEventListener('click', async () => {
    const { timer } = await chrome.storage.local.get(['timer']);
    const t = timer || { mode: 'idle' };
    await chrome.runtime.sendMessage({ type: t.mode === 'idle' ? 'START_FOCUS' : 'STOP' });
    const data = await chrome.storage.local.get(['timer']);
    updateTimerDisplay(data.timer);
  });

  // Poll timer
  setInterval(async () => {
    const { timer } = await chrome.storage.local.get(['timer']);
    updateTimerDisplay(timer);
  }, 1000);

  // React to storage changes (e.g. timer ends from alarm)
  chrome.storage.onChanged.addListener(async changes => {
    if (changes.timer || changes.sessions) {
      const data = await chrome.storage.local.get(['timer', 'sessions']);
      updateTimerDisplay(data.timer);
      renderInsights(data.sessions || [], data.timer);
    }
  });
});
