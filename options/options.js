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

function barChart(data, labels, chartH) {
  const max = Math.max(1, ...data);
  const n = data.length;
  const barW = Math.max(5, Math.floor(480 / n) - 3);
  const svgW = n * (barW + 3) + 20;
  const svgH = chartH + 22;

  let bars = '', lbls = '';
  data.forEach((v, i) => {
    const bh = Math.max(v > 0 ? 2 : 0, Math.round((v / max) * chartH));
    const x = 10 + i * (barW + 3);
    const y = chartH - bh;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${v > 0 ? '#fff' : '#1a1a1a'}" rx="1"/>`;
    if (labels[i]) {
      lbls += `<text x="${x + barW / 2}" y="${svgH - 3}" text-anchor="middle" font-size="7" fill="#777" font-family="Courier New,monospace">${labels[i]}</text>`;
    }
  });

  return `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="display:block;height:${svgH}px">${bars}${lbls}</svg>`;
}

function renderInsights(sessions) {
  const now = new Date();

  const startOf = (unit) => {
    const d = new Date(now);
    if (unit === 'day')   { d.setHours(0,0,0,0); return d; }
    if (unit === 'week')  { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }
    if (unit === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
    if (unit === 'year')  return new Date(d.getFullYear(), 0, 1);
  };

  const minsIn = (start) => sessions
    .filter(s => new Date(s.date) >= start)
    .reduce((a, s) => a + (s.duration || 0), 0);

  const fmtHM = (m) => `${Math.floor(m / 60)}H ${m % 60}M`;

  document.getElementById('ins-h-today').textContent = fmtHM(minsIn(startOf('day')));
  document.getElementById('ins-h-week').textContent  = fmtHM(minsIn(startOf('week')));
  document.getElementById('ins-h-month').textContent = fmtHM(minsIn(startOf('month')));
  document.getElementById('ins-h-year').textContent  = fmtHM(minsIn(startOf('year')));
  document.getElementById('ins-date').textContent    = now.toLocaleDateString('en-GB').replace(/\//g, '-');

  // ── Heatmap ──────────────────────────────────────────
  const CELL = 13, GAP = 3, STEP = CELL + GAP, WEEKS = 26;
  const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const OX = 34, OY = 24;

  const byDate = {};
  sessions.forEach(s => {
    const d = new Date(s.date);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    byDate[k] = (byDate[k] || 0) + 1;
  });
  const maxDay = Math.max(1, ...Object.values(byDate));

  // Start from the Sunday 26 weeks back
  const hStart = new Date(now);
  hStart.setDate(now.getDate() - now.getDay() - (WEEKS - 1) * 7);
  hStart.setHours(0,0,0,0);

  let cellsSvg = '', monthSvg = '';
  const seenMonths = new Set();

  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(hStart);
      date.setDate(hStart.getDate() + w * 7 + d);
      if (date > now) continue;

      const k = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const count = byDate[k] || 0;
      const ratio = count / maxDay;
      const fill = count === 0 ? '#111'
        : ratio < 0.25 ? '#2d2d2d'
        : ratio < 0.5  ? '#555'
        : ratio < 0.75 ? '#888'
        : '#fff';

      const x = OX + w * STEP;
      const y = OY + d * STEP;
      cellsSvg += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${fill}" rx="2"/>`;

      if (d === 0 && !seenMonths.has(date.getMonth())) {
        seenMonths.add(date.getMonth());
        monthSvg += `<text x="${x}" y="${OY - 7}" font-size="8" fill="#666" font-family="Courier New,monospace">${MONTH_NAMES[date.getMonth()]}</text>`;
      }
    }
  }

  let dayLblSvg = '';
  [[1,'MON'],[3,'WED'],[5,'FRI']].forEach(([d, lbl]) => {
    const y = OY + d * STEP + CELL * 0.8;
    dayLblSvg += `<text x="${OX - 4}" y="${y}" text-anchor="end" font-size="7" fill="#666" font-family="Courier New,monospace">${lbl}</text>`;
  });

  const svgW = OX + WEEKS * STEP + 8;
  const svgH = OY + 7 * STEP + 8;

  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const totalInPeriod = sessions.filter(s => new Date(s.date) >= sixMonthsAgo).length;
  document.getElementById('ins-heatmap-title').textContent = `${totalInPeriod} POMODOROS IN THE LAST 6 MONTHS`;

  document.getElementById('heatmap-wrap').innerHTML = `
    <div style="overflow-x:auto;padding-bottom:4px">
      <svg width="${svgW}" height="${svgH}" style="display:block">${monthSvg}${dayLblSvg}${cellsSvg}</svg>
    </div>
    <div class="heat-legend">
      LESS
      <span class="heat-cell" style="background:#111"></span>
      <span class="heat-cell" style="background:#2d2d2d"></span>
      <span class="heat-cell" style="background:#555"></span>
      <span class="heat-cell" style="background:#888"></span>
      <span class="heat-cell" style="background:#fff"></span>
      MORE
    </div>`;

  // ── Weekly bar chart ─────────────────────────────────
  const DAY_LBLS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const weekData = Array(7).fill(0);
  sessions.filter(s => new Date(s.date) >= startOf('week')).forEach(s => {
    weekData[new Date(s.date).getDay()] += s.duration || 0;
  });
  document.getElementById('chart-week').innerHTML = barChart(weekData, DAY_LBLS, 120);

  // ── Monthly bar chart ────────────────────────────────
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthData = Array(daysInMonth).fill(0);
  sessions.filter(s => new Date(s.date) >= startOf('month')).forEach(s => {
    const d = new Date(s.date).getDate() - 1;
    if (d < daysInMonth) monthData[d] += s.duration || 0;
  });
  const monthLbls = Array.from({length: daysInMonth}, (_, i) => (i + 1) % 5 === 1 ? String(i + 1) : '');
  document.getElementById('chart-month').innerHTML = barChart(monthData, monthLbls, 120);

  // ── Recent sessions ──────────────────────────────────
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
  renderInsights(data.sessions || []);
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
    await chrome.storage.local.set({ blocklist, settings });
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
    document.getElementById(slId).addEventListener('input', async e => {
      const v = parseInt(e.target.value);
      settings[key] = v;
      document.getElementById(valId).textContent = asMins ? minsDisplay(v) : v;
      await chrome.storage.local.set({ settings });
    });
  });

  document.getElementById('toggle-hardcore').addEventListener('change', async e => {
    settings.hardcoreMode = e.target.checked;
    await chrome.storage.local.set({ settings });
  });

  document.getElementById('sl-interval').addEventListener('input', async e => {
    settings.longBreakInterval = parseInt(e.target.value);
    document.getElementById('val-interval').textContent = e.target.value;
    await chrome.storage.local.set({ settings });
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
      renderInsights(data.sessions || []);
    }
  });
});
