const DEFAULTS = {
  settings: {
    focusDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    hardcoreMode: false,
    longBreakInterval: 4
  },
  blocklist: ['facebook.com', 'youtube.com', 'reddit.com'],
  timer: { mode: 'idle', startTime: null, duration: 0, pomodoroCount: 0 },
  sessions: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(null);
  const init = {};
  if (!data.settings)  init.settings  = DEFAULTS.settings;
  if (!data.blocklist) init.blocklist = DEFAULTS.blocklist;
  if (!data.timer)     init.timer     = DEFAULTS.timer;
  if (!data.sessions)  init.sessions  = DEFAULTS.sessions;
  if (Object.keys(init).length) await chrome.storage.local.set(init);
});

async function get(keys) {
  return chrome.storage.local.get(keys);
}

async function startFocus() {
  const { settings, blocklist, timer } = await get(['settings', 'blocklist', 'timer']);
  const s = settings || DEFAULTS.settings;
  const duration = s.focusDuration * 60 * 1000;
  const now = Date.now();

  await chrome.storage.local.set({
    timer: {
      mode: 'focus',
      startTime: now,
      duration,
      pomodoroCount: (timer || DEFAULTS.timer).pomodoroCount
    }
  });

  await chrome.alarms.clear('timerEnd');
  await chrome.alarms.create('timerEnd', { when: now + duration });
  await applyBlockRules(blocklist || DEFAULTS.blocklist);
}

async function startBreak(type) {
  const { settings, timer } = await get(['settings', 'timer']);
  const s = settings || DEFAULTS.settings;
  const mins = type === 'longBreak' ? s.longBreak : s.shortBreak;
  const duration = mins * 60 * 1000;
  const now = Date.now();

  await chrome.storage.local.set({
    timer: {
      mode: type,
      startTime: now,
      duration,
      pomodoroCount: (timer || DEFAULTS.timer).pomodoroCount
    }
  });

  await chrome.alarms.clear('timerEnd');
  await chrome.alarms.create('timerEnd', { when: now + duration });
  await removeBlockRules();
}

async function stopTimer() {
  const { timer } = await get(['timer']);
  await chrome.alarms.clear('timerEnd');
  await removeBlockRules();
  await chrome.storage.local.set({
    timer: {
      mode: 'idle',
      startTime: null,
      duration: 0,
      pomodoroCount: (timer || DEFAULTS.timer).pomodoroCount
    }
  });
}

async function applyBlockRules(blocklist) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  const addRules = blocklist.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { url: chrome.runtime.getURL('blocked/blocked.html') }
    },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ['main_frame']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function removeBlockRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);
  if (removeRuleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
}

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name !== 'timerEnd') return;

  const { timer, settings, sessions } = await get(['timer', 'settings', 'sessions']);
  const s = settings || DEFAULTS.settings;
  const t = timer || DEFAULTS.timer;

  if (t.mode === 'focus') {
    const newCount = t.pomodoroCount + 1;
    const isLong = newCount % (s.longBreakInterval || 4) === 0;

    const newSessions = [
      ...(sessions || []),
      { date: Date.now(), duration: s.focusDuration, completed: true }
    ];
    await chrome.storage.local.set({
      sessions: newSessions.slice(-500),
      timer: { ...t, pomodoroCount: newCount }
    });

    await startBreak(isLong ? 'longBreak' : 'shortBreak');
  } else {
    const { timer: t2 } = await get(['timer']);
    await chrome.storage.local.set({
      timer: { ...t2, mode: 'idle', startTime: null }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'START_FOCUS':
        await startFocus();
        break;
      case 'STOP':
        await stopTimer();
        break;
      case 'UPDATE_BLOCKLIST': {
        const { timer } = await get(['timer']);
        if (timer?.mode === 'focus') await applyBlockRules(msg.blocklist);
        break;
      }
    }
    sendResponse({ ok: true });
  })();
  return true;
});
