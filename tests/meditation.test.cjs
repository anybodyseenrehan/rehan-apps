const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('apps/meditation/core.js','utf8'),context);
const {cues,range,total,dayKey} = context.module.exports;

test('gong cues include warmup, midpoint and finish without overlapping interval bells',()=>{
  const plan = JSON.parse(JSON.stringify(cues(60,600,120)));
  assert.deepEqual(plan,[{at:60,kind:'gong'},{at:180,kind:'bell'},{at:300,kind:'bell'},{at:360,kind:'gong'},{at:420,kind:'bell'},{at:540,kind:'bell'},{at:660,kind:'gong'}]);
  assert.equal(cues(0,600,300).length,3);
  assert.equal(cues(0,600,0).length,3);
  assert.equal(cues(0,600,900).length,3);
});
test('weeks start Monday across year boundaries and months include leap day',()=>{
  const week = range('week',new Date(2027,0,1));
  assert.equal(dayKey(week.start),'2026-12-28');
  assert.equal(dayKey(week.end),'2027-01-04');
  const month = range('month',new Date(2028,1,29));
  assert.equal(dayKey(month.start),'2028-02-01');
  assert.equal(dayKey(month.end),'2028-03-01');
  const year = range('year',new Date(2026,10,10));
  assert.equal(dayKey(year.end),'2027-01-01');
});
test('totals include partial sessions, multiple sessions per day, and only selected period',()=>{
  const {start,end} = range('month',new Date(2026,10,10));
  const sessions = [
    {startedAt:new Date(2026,10,1).toISOString(),seconds:600},
    {startedAt:new Date(2026,10,1,12).toISOString(),seconds:145},
    {startedAt:new Date(2026,9,31).toISOString(),seconds:900},
    {startedAt:new Date(2026,11,1).toISOString(),seconds:900}
  ];
  assert.equal(total(sessions,start,end),745);
});

function app({saved=null,failWrite=false,settings=null,audioSession={},clockStep=0,confirmDelete=true,wakeLock}={}) {
  const nodes = new Map(), events = {}, timers = [];
  const storage = new Map(saved===null?[]:[['meditation.sessions.v1',saved]]);
  if (settings) storage.set('meditation.settings.v1',JSON.stringify(settings));
  const played = [], audioEvents = [], scheduled = [];
  let audioInstance;
  let now = new Date(2026,10,10,12).getTime();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector,{
      value:selector==='#period'?'week':selector==='#warmup'?'60':selector==='#duration'?'10':selector==='#interval'?'2':'',
      textContent:'',innerHTML:'',hidden:false,listeners:{},attrs:{},
      addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},reportValidity:()=>true,focus(){}
    });
    return nodes.get(selector);
  };
  class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){const value=now; now+=clockStep; return value;} }
  class Audio {
    constructor(){this.currentTime=0;this.state='suspended';this.destination={};this.sampleRate=44100;audioInstance=this;audioEvents.push('create');}
    async resume(){audioEvents.push('resume');this.state='running';}
    createBuffer(){return {getChannelData:()=>new Float32Array(32)};}
    createBufferSource(){return {connect(){},disconnect(){},start(){audioEvents.push('prime');},stop(){audioEvents.push('stop');}};}
    createOscillator(){let frequency;return {frequency:{setValueAtTime(value){frequency=value;}},connect(){},disconnect(){},start(at){played.push(at);scheduled.push({frequency,at});},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  }
  const sandbox = {
    Date:Clock, Meditation:context.module.exports, crypto:{randomUUID:()=>String(now)}, navigator:{audioSession,wakeLock},
    localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(failWrite)throw Error();storage.set(k,v);}},
    document:{querySelector:get,querySelectorAll:()=>[],hidden:false,addEventListener:(k,fn)=>events[k]=fn},
    window:{AudioContext:Audio,confirm:()=>confirmDelete,addEventListener:(k,fn)=>events[k]=fn},
    setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){}
  };
  vm.runInNewContext(fs.readFileSync('apps/meditation/app.js','utf8'),sandbox);
  return {get,events,storage,played,scheduled,audioEvents,audioSession,audio:()=>audioInstance,advance:seconds=>{now+=seconds*1000;timers.at(-1)();},
    start:()=>get('#setup').listeners.submit({preventDefault(){}}),click:selector=>get(selector).listeners.click(),
    records:()=>JSON.parse(storage.get('meditation.sessions.v1')||'{"sessions":[]}').sessions};
}
test('warmup and pauses excluded, partial time saved once, reload shows calendar and totals',async()=>{
  const a=app(); await a.start();
  a.advance(60); a.advance(90);
  await a.click('#pause'); a.advance(300);
  assert.equal(a.get('#remaining').textContent,'8:30');
  await a.click('#pause'); a.advance(30); a.click('#finish');
  assert.equal(a.records().length,1); assert.equal(a.records()[0].seconds,120);
  assert.equal(a.records()[0].completed,false);
  assert.equal(a.get('#weekTotal').textContent,'2 min');
  const b=app({saved:a.storage.get('meditation.sessions.v1')});
  assert.match(b.get('#calendarGrid').innerHTML,/2 min/);
  assert.match(b.get('#daySessions').innerHTML,/partial/);
});
test('warmup pauses shift actual start and complete sessions cannot be duplicated',async()=>{
  const a=app(); await a.start(); a.advance(30); await a.click('#pause');
  a.advance(120); await a.click('#pause'); a.advance(30); a.advance(600); a.advance(20);
  assert.equal(a.records().length,1); assert.equal(a.records()[0].seconds,600);
  assert.equal(a.records()[0].completed,true);
  assert.equal(new Date(a.records()[0].startedAt).getMinutes(),3);
});
test('ending warmup does not log meditation; corrupt and failed storage never overwrite history',async()=>{
  const a=app(); await a.start(); a.advance(20); a.click('#finish'); assert.equal(a.records().length,0);
  const b=app({saved:'{broken'}); await b.start(); assert.equal(b.storage.get('meditation.sessions.v1'),'{broken');
  assert.match(b.get('#status').textContent,/Could not read/);
  const c=app({failWrite:true}); await c.start(); c.advance(660);
  assert.equal(c.records().length,0); assert.equal(c.get('#again').disabled,true);
  assert.equal(c.get('#retrySave').hidden,false);
  assert.match(c.get('#status').textContent,/retry saving/);
});

test('warmup seconds count down directly and legacy minute settings retain their duration',async()=>{
  const a=app(); a.get('#warmup').value='15'; await a.start();
  a.advance(10); assert.equal(a.get('#remaining').textContent,'0:05');
  a.advance(5); assert.equal(a.get('#phase').textContent,'Meditation');
  assert.equal(JSON.parse(a.storage.get('meditation.settings.v1')).warmupUnit,'seconds');
  const b=app({settings:{warmup:0.5,duration:10,interval:2}});
  assert.equal(b.get('#warmup').value,30);
  const c=app({settings:{warmup:15,warmupUnit:'seconds',duration:10,interval:2}});
  assert.equal(c.get('#warmup').value,15);
});
test('audio uses playback mode, primes during the tap, and previews schedule audible voices',async()=>{
  const a=app();
  await a.click('#previewBell');
  assert.equal(a.audioSession.type,'playback');
  assert.deepEqual(a.audioEvents,['create','resume','prime']);
  assert.equal(a.played.length,3);
  assert.ok(a.played.every(at=>at>=0.03));
  await a.click('#previewGong'); assert.equal(a.played.length,9);
});
test('zero warmup still rings the opening gong when setup takes a few milliseconds',async()=>{
  const a=app({clockStep:5}); a.get('#warmup').value='0'; await a.start();
  assert.ok(a.played.some(at=>at===0.03));
  assert.equal(a.played.length,30); // Three six-part gongs and four three-part bells.
});
test('audio interruptions immediately pause the timer until an explicit resume',async()=>{
  const a=app(); await a.start(); a.advance(90);
  a.audio().state='interrupted'; a.audio().onstatechange();
  assert.equal(a.get('#pause').textContent,'Resume');
  a.advance(120); assert.equal(a.get('#remaining').textContent,'9:30');
  await a.click('#pause'); a.advance(30); a.click('#finish');
  assert.equal(a.records()[0].seconds,60);
});

function historyRecords() {
  return {version:1,sessions:[
    {id:'older',startedAt:new Date(2026,10,9,9).toISOString(),seconds:600,completed:true},
    {id:'newer',startedAt:new Date(2026,10,10,12).toISOString(),seconds:120,completed:false}
  ]};
}
function deleteSession(a,id) {
  a.get('#historyList').listeners.click({target:{closest:()=>({dataset:{delete:id}})}});
}
test('history lists newest first and deletion persists and updates calendar and totals',()=>{
  const a=app({saved:JSON.stringify(historyRecords())});
  const html=a.get('#historyList').innerHTML;
  assert.ok(html.indexOf('data-delete="newer"')<html.indexOf('data-delete="older"'));
  assert.match(html,/partial/); assert.match(html,/12:00/);
  deleteSession(a,'newer');
  assert.deepEqual(a.records().map(s=>s.id),['older']);
  assert.equal(a.get('#weekTotal').textContent,'10 min');
  assert.match(a.get('#daySessions').innerHTML,/No meditation sessions/);
  assert.doesNotMatch(a.get('#historyList').innerHTML,/data-delete="newer"/);
  const b=app({saved:a.storage.get('meditation.sessions.v1')});
  deleteSession(b,'older');
  assert.match(b.get('#historyList').innerHTML,/No meditation sessions yet/);
  assert.equal(b.get('#weekTotal').textContent,'0 min');
});
test('cancelled deletions and storage failures preserve all saved sessions',()=>{
  const saved=JSON.stringify(historyRecords());
  const a=app({saved,confirmDelete:false}); deleteSession(a,'newer');
  assert.equal(a.storage.get('meditation.sessions.v1'),saved);
  const b=app({saved,failWrite:true}); deleteSession(b,'newer');
  assert.equal(b.storage.get('meditation.sessions.v1'),saved);
  assert.match(b.get('#status').textContent,/Could not delete/);
  assert.match(b.get('#historyList').innerHTML,/data-delete="newer"/);
});
test('deleting history preserves active timer and incorporates other tabs latest records',async()=>{
  const a=app({saved:JSON.stringify(historyRecords())}); await a.start();
  a.advance(90);
  const changed=historyRecords(); changed.sessions.push({id:'other-tab',startedAt:new Date(2026,10,10,11).toISOString(),seconds:60,completed:true});
  a.storage.set('meditation.sessions.v1',JSON.stringify(changed));
  deleteSession(a,'newer');
  assert.deepEqual(a.records().map(s=>s.id),['older','other-tab']);
  a.advance(30); a.click('#finish');
  assert.equal(a.records().length,3);
  assert.equal(a.records().at(-1).seconds,60);
});

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function wakeHarness() {
  const locks=[];
  return {locks,async request(){
    const lock={released:false,listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},async release(){this.released=true;this.listeners.release?.();}};
    locks.push(lock); return lock;
  }};
}
test('screen lock is held without duplicate requests, restored after release, and released on pause/end',async()=>{
  const wake=wakeHarness(), a=app({wakeLock:wake}); await a.start(); await flush();
  assert.equal(wake.locks.length,1);
  a.advance(12); await flush(); assert.equal(wake.locks.length,1);
  await wake.locks[0].release(); a.advance(1); await flush();
  assert.equal(wake.locks.length,2);
  assert.match(a.get('#wakeStatus').textContent,/Screen stays on/);
  await a.click('#pause'); assert.equal(wake.locks[1].released,true);
  await a.click('#pause'); await flush(); assert.equal(wake.locks.length,3);
  a.click('#finish'); assert.equal(wake.locks[2].released,true);
});
test('a rejected wake lock is visible and can be retried',async()=>{
  const wake=wakeHarness(); let reject=true;
  const a=app({wakeLock:{request:()=>reject?Promise.reject(Error('Denied')):wake.request()}});
  await a.start(); await flush();
  assert.match(a.get('#wakeStatus').textContent,/Could not keep/);
  assert.equal(a.get('#retryWake').hidden,false);
  reject=false; await a.click('#retryWake');
  assert.match(a.get('#wakeStatus').textContent,/Screen stays on/);
});
test('audio stays live between interval bells and releases the keepalive on pause and finish',async()=>{
  const a=app(); a.get('#warmup').value='15'; a.get('#duration').value='2'; a.get('#interval').value='0.5'; await a.start();
  assert.equal(a.audioEvents.filter(e=>e==='prime').length,2); // Tap primer + looping keepalive.
  const bells=a.scheduled.filter(s=>s.frequency===330);
  assert.deepEqual(bells.map(s=>Math.round(s.at)),[45,105]);
  assert.deepEqual(a.scheduled.filter(s=>s.frequency===196).map(s=>Math.round(s.at)),[15,75,135]);
  await a.click('#pause'); assert.ok(a.audioEvents.includes('stop'));
  await a.click('#pause'); assert.equal(a.audioEvents.filter(e=>e==='prime').length,4);
  a.advance(135); assert.equal(a.audioEvents.filter(e=>e==='stop').length,2);
});
