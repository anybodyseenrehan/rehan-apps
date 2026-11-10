(() => {
  'use strict';

  const KEY = 'mobility.completions.v1';
  const $ = selector => document.querySelector(selector);
  const routines = [...document.querySelectorAll('[data-routine-id]')].map(card => ({
    id: card.dataset.routineId,
    title: card.dataset.routineTitle,
    calendarTitle: card.dataset.calendarTitle
  }));
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dayDate = key => new Date(...key.split('-').map((part, index) => Number(part) - (index === 1 ? 1 : 0)));
  const dateLabel = date => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let db, readError = false, today = dayKey(new Date()), selectedDay = today;
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let midnightTimer;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const saved = raw === null ? { schemaVersion: 1, completions: {} } : JSON.parse(raw);
      if (!saved || saved.schemaVersion !== 1 || !saved.completions || typeof saved.completions !== 'object' || Array.isArray(saved.completions)) throw Error('Invalid data');
      for (const [key, records] of Object.entries(saved.completions)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || dayKey(dayDate(key)) !== key || !Array.isArray(records) || records.some(record => !record || typeof record.routineId !== 'string' || typeof record.title !== 'string') || new Set(records.map(record => record.routineId)).size !== records.length) throw Error('Invalid data');
      }
      db = saved;
      readError = false;
      return true;
    } catch {
      db = { schemaVersion: 1, completions: {} };
      readError = true;
      $('#status').textContent = 'Your mobility history could not be read. Reload to try again. Saved data has not been changed.';
      return false;
    }
  }

  const completed = key => db.completions[key] || [];

  function updateRoutines() {
    for (const routine of routines) {
      const done = completed(today).some(record => record.routineId === routine.id);
      const checkbox = $(`[data-complete="${routine.id}"]`);
      checkbox.checked = done;
      checkbox.disabled = readError;
    }
  }

  function renderCalendar() {
    const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
    const offset = (calendarMonth.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    $('#calendarMonth').textContent = calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    $('#calendarGrid').innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `<span class="weekday">${day}</span>`).join('') +
      '<span aria-hidden="true"></span>'.repeat(offset) + Array.from({ length: days }, (_, index) => {
        const date = new Date(year, month, index + 1), key = dayKey(date), records = completed(key);
        const description = records.length ? records.map(record => record.title).join(', ') : 'No completed routines';
        return `<button type="button" class="calendar-day${key === today ? ' today' : ''}" data-day="${key}" aria-pressed="${key === selectedDay}"${key === today ? ' aria-current="date"' : ''} aria-label="${esc(dateLabel(date) + ': ' + description)}"><strong>${index + 1}</strong>${records.map(record => `<span class="completed-day">${esc(routines.find(routine => routine.id === record.routineId)?.calendarTitle || record.title)}</span>`).join('')}</button>`;
      }).join('');
    renderDay();
  }

  function renderDay() {
    $('#dayTitle').textContent = dateLabel(dayDate(selectedDay));
    const records = completed(selectedDay);
    $('#dayRoutines').innerHTML = records.length
      ? `<ul class="completed-routines">${records.map(record => {
        const timestamp = record.completedAt && new Date(record.completedAt);
        const time = timestamp && Number.isFinite(timestamp.getTime()) ? `<time datetime="${esc(record.completedAt)}">${esc(timestamp.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))}</time>` : '';
        return `<li><span class="completion-mark" aria-hidden="true">✓</span><span>${esc(record.title)}</span>${time}</li>`;
      }).join('')}</ul>`
      : '<p>No completed routines.</p>';
  }

  function refresh() {
    const currentDay = dayKey(new Date());
    if (today !== currentDay) {
      if (selectedDay === today) {
        selectedDay = currentDay;
        calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }
      today = currentDay;
    }
    read();
    updateRoutines();
    renderCalendar();
  }

  function scheduleMidnight() {
    clearTimeout(midnightTimer);
    const now = new Date();
    midnightTimer = setTimeout(() => {
      refresh();
      scheduleMidnight();
    }, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 100);
  }

  function showView(calendar) {
    refresh();
    $('#routinesView').hidden = calendar;
    $('#calendarView').hidden = !calendar;
    $('#routinesTab').setAttribute('aria-pressed', String(!calendar));
    $('#calendarTab').setAttribute('aria-pressed', String(calendar));
  }

  for (const routine of routines) {
    $(`[data-complete="${routine.id}"]`).addEventListener('change', event => {
      const checked = event.target.checked;
      refresh();
      if (readError) return;
      const next = JSON.parse(JSON.stringify(db));
      const records = completed(today).filter(record => record.routineId !== routine.id);
      if (checked) records.push({ routineId: routine.id, title: routine.title, completedAt: completed(today).find(record => record.routineId === routine.id)?.completedAt || new Date().toISOString() });
      if (records.length) next.completions[today] = records;
      else delete next.completions[today];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
        db = next;
        $('#status').textContent = '';
      } catch {
        $('#status').textContent = 'Could not save this completion. Please try again; your checkbox has been restored.';
      }
      updateRoutines();
      renderCalendar();
    });
  }

  $('#routinesTab').addEventListener('click', () => showView(false));
  $('#calendarTab').addEventListener('click', () => showView(true));
  $('#calendarGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    selectedDay = button.dataset.day;
    // Keep the clicked date focused for keyboard users.
    document.querySelectorAll('[data-day]').forEach(day => day.setAttribute('aria-pressed', String(day.dataset.day === selectedDay)));
    renderDay();
  });
  function changeMonth(offset) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
    selectedDay = dayKey(calendarMonth).slice(0, 7) === today.slice(0, 7) ? today : dayKey(calendarMonth);
    renderCalendar();
  }
  $('#monthPrev').addEventListener('click', () => changeMonth(-1));
  $('#monthNext').addEventListener('click', () => changeMonth(1));
  $('#calendarToday').addEventListener('click', () => {
    refresh();
    selectedDay = today;
    calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    renderCalendar();
  });
  window.addEventListener('focus', () => { refresh(); scheduleMidnight(); });
  window.addEventListener('pageshow', () => { refresh(); scheduleMidnight(); });
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) refresh(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { refresh(); scheduleMidnight(); }
  });
  refresh();
  scheduleMidnight();
})();
