(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const { dayKey, cues, range, total } = Meditation;
  const KEY = 'meditation.sessions.v1', SETTINGS = 'meditation.settings.v1';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const length = seconds => {
    const minutes = Math.round(seconds / 60 * 10) / 10;
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes/60)}h${minutes%60 ? ` ${Math.round(minutes%60)}m` : ''}`;
  };
  const dateLabel = date => date.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
  const dateFromKey = key => new Date(...key.split('-').map((v,i) => +v-(i===1?1:0)));
  let sessions = [], readError = false, session = null, pendingRecord = null;
  let audio, voices = [], wakeLock, ticker, starting = false;
  let selectedDay = dayKey(new Date()), month = new Date(new Date().getFullYear(),new Date().getMonth(),1), periodDate = new Date();

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const data = raw === null ? { version:1, sessions:[] } : JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.sessions) || data.sessions.some(s => !s || typeof s.id !== 'string' || !Number.isFinite(new Date(s.startedAt).getTime()) || !Number.isFinite(s.seconds) || s.seconds <= 0)) throw Error();
      sessions = data.sessions;
      readError = false;
      return true;
    } catch {
      readError = true;
      $('#status').textContent = 'Could not read your meditation history. Reload to try again; existing data has not been changed.';
      return false;
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS));
    if (saved) for (const name of ['warmup','duration','interval']) {
      const value = name === 'warmup' && saved.warmupUnit !== 'seconds' ? saved[name]*60 : saved[name];
      const validStep = name === 'warmup' ? Number.isInteger(value) : value*2===Math.round(value*2);
      if (Number.isFinite(value) && value >= (name==='duration' ? 0.5 : 0) && value <= (name==='warmup' ? 3600 : 240) && validStep) $('#'+name).value = value;
    }
  } catch { /* Defaults remain usable if settings are unavailable. */ }

  async function unlockAudio() {
    // iPhone otherwise treats Web Audio as a sound effect and can mute it with
    // the Ring/Silent switch. Request media playback before opening the context.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
    if (!audio || audio.state === 'closed') {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error('Audio unavailable');
      audio = new Audio();
      audio.onstatechange = () => {
        if (session && !session.paused && audio.state !== 'running') {
          session.elapsed = elapsed(); session.paused = true;
          stopSounds(); releaseWake(); $('#pause').textContent = 'Resume'; tick();
          $('#status').textContent = 'Sound was interrupted. Tap Resume to continue with bells.';
        }
      };
    }
    // Both actions happen directly inside the tap, before awaiting a promise.
    const resumed = audio.resume();
    const primer = audio.createBufferSource();
    primer.buffer = audio.createBuffer(1, 1, audio.sampleRate);
    primer.connect(audio.destination);
    primer.onended = () => primer.disconnect();
    primer.start(0);
    await resumed;
    if (audio.state !== 'running') throw Error('Audio unavailable');
  }
  // Inharmonic partials and long decays create two distinct, gentle struck-metal sounds.
  function strike(kind, when = audio.currentTime) {
    const gong = kind === 'gong', base = gong ? 196 : 330;
    const partials = gong ? [1,1.48,2.03,2.62,3.91,5.42] : [1,2.2,3.6];
    partials.forEach((ratio,i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(base*ratio,when);
      const decay = gong ? 8/(1+i*.23) : 4/(1+i*.3);
      gain.gain.setValueAtTime(0,when);
      gain.gain.linearRampToValueAtTime((gong ? .23 : .20)/(1+i*1.5),when+.018);
      gain.gain.exponentialRampToValueAtTime(.0001,when+decay);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(when); oscillator.stop(when+decay+.05);
      const voice = { oscillator, gain };
      voices.push(voice);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices = voices.filter(v => v !== voice); };
    });
  }
  function stopSounds() {
    for (const {oscillator} of voices) { try { oscillator.stop(); } catch {} }
  }
  async function keepAwake() {
    try {
      if (!document.hidden && navigator.wakeLock && session && !session.paused) {
        const lock = await navigator.wakeLock.request('screen');
        if (!session || session.paused) await lock.release();
        else { if (wakeLock) await wakeLock.release(); wakeLock = lock; }
      }
    } catch { /* Timer still works when screen wake lock is unavailable. */ }
  }
  function releaseWake() { if (wakeLock) { wakeLock.release().catch(()=>{}); wakeLock = null; } }
  function elapsed() { return session.elapsed + (session.paused ? 0 : (Date.now()-session.anchor)/1000); }
  function schedule(initial = false) {
    stopSounds();
    const seconds = elapsed();
    const audioNow = audio.currentTime;
    // Schedule on the audio clock so bells do not depend on UI timer callbacks.
    for (const cue of session.cues) {
      if (cue.at >= seconds || (initial && cue.at === 0)) {
        strike(cue.kind,audioNow+Math.max(0,cue.at-seconds)+.03);
      }
    }
  }
  function tick() {
    if (!session) return;
    const seconds = elapsed(), warming = seconds < session.warmup;
    const remaining = Math.max(0, (warming ? session.warmup : session.warmup+session.duration)-seconds);
    $('#phase').textContent = `${session.paused ? 'Paused · ' : ''}${warming ? 'Warmup' : 'Meditation'}`;
    $('#remaining').textContent = `${Math.floor(Math.ceil(remaining)/60)}:${String(Math.ceil(remaining)%60).padStart(2,'0')}`;
    if (seconds >= session.warmup+session.duration) finish(true);
  }
  function savePending() {
    if (!pendingRecord) return true;
    if (!read()) return false;
    try {
      const next = sessions.some(s => s.id===pendingRecord.id) ? sessions : [...sessions,pendingRecord];
      localStorage.setItem(KEY,JSON.stringify({version:1,sessions:next}));
      sessions = next; pendingRecord = null;
      $('#status').textContent = ''; $('#retrySave').hidden = true; $('#again').disabled = false;
      renderHistory();
      return true;
    } catch {
      $('#status').textContent = 'Could not save this session. Keep this page open and retry saving.';
      return false;
    }
  }
  function finish(complete) {
    const current = session;
    const seconds = Math.min(current.duration, Math.max(0, elapsed()-current.warmup));
    if (!complete) stopSounds(); // Let the scheduled final gong ring out on completion.
    clearInterval(ticker); releaseWake(); session = null;
    $('#running').hidden = true; $('#result').hidden = false;
    $('#resultTitle').textContent = complete ? 'Session complete' : 'Session ended';
    $('#resultText').textContent = seconds >= 1 ? `${length(seconds)} of meditation${complete ? '' : ' · partial session'}.` : 'Warmup only · no meditation time logged.';
    if (seconds >= 1) {
      pendingRecord = {id:current.id, startedAt:current.startedAt, endedAt:new Date().toISOString(), seconds:Math.round(seconds), completed:complete};
      if (!savePending()) { $('#retrySave').hidden = false; $('#again').disabled = true; }
    }
  }
  $('#setup').addEventListener('submit',async event => {
    event.preventDefault();
    if (starting || session || !$('#setup').reportValidity()) return;
    if (!read()) return;
    starting = true;
    try { await unlockAudio(); } catch {
      $('#status').textContent = 'Sound could not start. Check your sound settings and try again.';
      starting = false; return;
    }
    const settings = Object.fromEntries(['warmup','duration','interval'].map(name => [name,Number($('#'+name).value)]));
    try { localStorage.setItem(SETTINGS,JSON.stringify({...settings,warmupUnit:'seconds'})); } catch {}
    const warmup = settings.warmup, duration = settings.duration*60;
    session = {id:crypto.randomUUID(), startedAt:new Date(Date.now()+warmup*1000).toISOString(), warmup, duration, elapsed:0, anchor:Date.now(), paused:false, cues:cues(warmup,duration,settings.interval*60)};
    // startedAt is updated when a paused warmup actually finishes.
    session.meditationStarted = false;
    $('#status').textContent = '';
    $('#setup').hidden = true; $('#result').hidden = true; $('#running').hidden = false;
    $('#pause').textContent = 'Pause';
    $('#sessionInfo').textContent = `${length(duration)} meditation${settings.interval ? ` · bell every ${length(settings.interval*60)}` : ' · no interval bells'}`;
    schedule(true); keepAwake(); tick(); ticker = setInterval(update,200);
    starting = false;
  });
  function update() {
    if (session && !session.meditationStarted && elapsed() >= session.warmup) {
      session.startedAt = new Date(Date.now()-(elapsed()-session.warmup)*1000).toISOString();
      session.meditationStarted = true;
    }
    tick();
  }
  $('#pause').addEventListener('click',async () => {
    if (!session || starting) return;
    update(); if (!session) return;
    if (!session.paused) {
      session.elapsed = elapsed(); session.paused = true;
      stopSounds(); releaseWake(); $('#pause').textContent = 'Resume';
    } else {
      starting = true;
      try { await unlockAudio(); } catch {
        $('#status').textContent = 'Sound could not resume. Check sound settings and try again.';
        starting = false; return;
      }
      if (!session) { starting = false; return; }
      session.anchor = Date.now(); session.paused = false;
      schedule(); keepAwake(); $('#pause').textContent = 'Pause'; $('#status').textContent = '';
      starting = false;
    }
    tick();
  });
  $('#finish').addEventListener('click',() => { if (session) { update(); if (session) finish(false); } });
  $('#again').addEventListener('click',() => { $('#setup').hidden = false; $('#result').hidden = true; });
  $('#retrySave').addEventListener('click',savePending);
  for (const kind of ['Gong','Bell']) $('#preview'+kind).addEventListener('click',async () => {
    if (session || starting) return;
    try { await unlockAudio(); stopSounds(); strike(kind.toLowerCase(),audio.currentTime+.03); $('#status').textContent = ''; } catch { $('#status').textContent = 'Sound is unavailable. Check your sound settings.'; }
  });

  function renderCalendar() {
    const today = dayKey(new Date());
    $('#calendarMonth').textContent = month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    const records = sessions.filter(s => dayKey(new Date(s.startedAt))===selectedDay);
    $('#dayTitle').textContent = dateLabel(dateFromKey(selectedDay));
    $('#daySessions').innerHTML = records.length ? records.map(s => `<div class="session-row"><span>${length(s.seconds)}${s.completed ? '' : ' <small>· partial</small>'}</span><time datetime="${esc(s.startedAt)}">${esc(new Date(s.startedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}</time></div>`).join('') : '<p>No meditation sessions.</p>';
    $('#calendarGrid').innerHTML = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<span class="weekday">${d}</span>`).join('') + '<span></span>'.repeat((month.getDay()+6)%7) + Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i) => {
      const date = new Date(month.getFullYear(),month.getMonth(),i+1), key = dayKey(date);
      const seconds = sessions.filter(s=>dayKey(new Date(s.startedAt))===key).reduce((sum,s)=>sum+s.seconds,0);
      return `<button class="calendar-day${key===today?' today':''}" data-day="${key}" aria-pressed="${key===selectedDay}"${key===today?' aria-current="date"':''} aria-label="${esc(dateLabel(date))}: ${seconds ? length(seconds) : 'No sessions'}"><strong>${i+1}</strong>${seconds ? `<span class="completed-day">${length(seconds)}</span>`:''}</button>`;
    }).join('');
  }
  function renderTracker() {
    for (const p of ['week','month','year']) {
      const {start,end} = range(p,new Date());
      $('#'+p+'Total').textContent = length(total(sessions,start,end));
    }
    const p = $('#period').value, {start,end} = range(p,periodDate);
    const last = new Date(end); last.setDate(last.getDate()-1);
    $('#periodTitle').textContent = p==='year' ? String(start.getFullYear()) : p==='month' ? start.toLocaleDateString(undefined,{month:'long',year:'numeric'}) : `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} – ${last.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`;
    const records = sessions.filter(s => new Date(s.startedAt)>=start && new Date(s.startedAt)<end);
    $('#periodTotal').textContent = length(total(records,start,end));
    $('#periodCount').textContent = `${records.length} session${records.length===1?'':'s'} · ${new Set(records.map(s=>dayKey(new Date(s.startedAt)))).size} days`;
    const buckets = [];
    for (let cursor = new Date(start); cursor < end;) {
      const from = new Date(cursor);
      if (p==='year') cursor.setMonth(cursor.getMonth()+1); else cursor.setDate(cursor.getDate()+1);
      buckets.push({label:from.toLocaleDateString(undefined,p==='year'?{month:'short'}:p==='week'?{weekday:'short'}:{month:'short',day:'numeric'}), seconds:total(records,from,cursor)});
    }
    const max = Math.max(1,...buckets.map(b=>b.seconds));
    $('#breakdown').innerHTML = buckets.map(b=>`<div class="bar-row"><span>${esc(b.label)}</span><div class="bar-track"><span class="bar-fill" style="width:${b.seconds/max*100}%"></span></div><span>${length(b.seconds)}</span></div>`).join('');
  }
  function renderSessions() {
    const records = [...sessions].sort((a,b) => new Date(b.startedAt)-new Date(a.startedAt));
    $('#historyList').innerHTML = records.length ? records.map(record => {
      const date = new Date(record.startedAt);
      const label = `${dateLabel(date)} at ${date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`;
      return `<li class="card history-session"><div><strong>${length(record.seconds)}</strong>${record.completed ? '' : ' <small>· partial</small>'}<time datetime="${esc(record.startedAt)}">${esc(label)}</time></div><button class="delete-session" data-delete="${esc(record.id)}" aria-label="${esc('Delete '+length(record.seconds)+' session on '+label)}"${readError ? ' disabled' : ''}>Delete</button></li>`;
    }).join('') : '<li class="card history-empty">No meditation sessions yet.</li>';
  }
  function renderHistory() { renderCalendar(); renderTracker(); renderSessions(); }
  $('#historyList').addEventListener('click',event => {
    const button = event.target.closest('[data-delete]');
    if (!button || !read()) return;
    const record = sessions.find(s => s.id===button.dataset.delete);
    if (!record) { renderHistory(); return; }
    if (!window.confirm(`Delete this ${length(record.seconds)} session from ${dateLabel(new Date(record.startedAt))}?`)) return;
    // Read again after confirmation so changes from other tabs are preserved.
    if (!read()) return;
    const next = sessions.filter(s => s.id!==record.id);
    try {
      localStorage.setItem(KEY,JSON.stringify({version:1,sessions:next}));
      sessions = next;
      $('#status').textContent = pendingRecord ? 'Your new session still needs saving. Return to Timer and retry saving.' : 'Session deleted.';
      renderHistory();
      $('#historyTitle').focus();
    } catch {
      $('#status').textContent = 'Could not delete this session. Your saved history has not been changed. Please try again.';
      renderHistory();
    }
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => {
    document.querySelectorAll('[data-view]').forEach(tab => {
      const active = tab===button; tab.setAttribute('aria-pressed',String(active)); $('#'+tab.dataset.view+'View').hidden = !active;
    });
    read(); renderHistory();
  }));
  function changeMonth(delta) {
    month = new Date(month.getFullYear(),month.getMonth()+delta,1); selectedDay = dayKey(month); renderCalendar();
  }
  $('#monthPrev').addEventListener('click',()=>changeMonth(-1));
  $('#monthNext').addEventListener('click',()=>changeMonth(1));
  $('#calendarToday').addEventListener('click',()=> { const now = new Date(); month = new Date(now.getFullYear(),now.getMonth(),1); selectedDay = dayKey(now); read(); renderCalendar(); });
  $('#calendarGrid').addEventListener('click',event=> {
    const button = event.target.closest('[data-day]'); if (!button) return;
    selectedDay = button.dataset.day;
    renderCalendar(); $(`[data-day="${selectedDay}"]`).focus();
  });
  function changePeriod(delta) {
    const p = $('#period').value, {start} = range(p,periodDate);
    if (p==='week') start.setDate(start.getDate()+7*delta);
    if (p==='month') start.setMonth(start.getMonth()+delta);
    if (p==='year') start.setFullYear(start.getFullYear()+delta);
    periodDate = start; renderTracker();
  }
  $('#periodPrev').addEventListener('click',()=>changePeriod(-1));
  $('#periodNext').addEventListener('click',()=>changePeriod(1));
  $('#period').addEventListener('change',()=> { periodDate = new Date(); renderTracker(); });
  document.addEventListener('visibilitychange',()=> {
    if (!document.hidden) {
      update(); keepAwake(); read(); renderHistory();
      if (session && !session.paused && audio.state !== 'running') {
        session.elapsed = elapsed(); session.paused = true; stopSounds(); releaseWake();
        $('#pause').textContent = 'Resume'; tick();
        $('#status').textContent = 'Sound was interrupted. Tap Resume to continue with bells.';
      }
    }
  });
  window.addEventListener('storage',event=> { if (event.key===KEY || event.key===null) { read(); renderHistory(); } });
  window.addEventListener('beforeunload',event=> { if (session || pendingRecord) { event.preventDefault(); event.returnValue=''; } });
  read(); renderHistory();
})();
