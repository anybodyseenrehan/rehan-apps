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

function app({saved=null,failWrite=false}={}) {
  const nodes = new Map(), events = {}, timers = [];
  const storage = new Map(saved===null?[]:[['meditation.sessions.v1',saved]]);
  let now = new Date(2026,10,10,12).getTime();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector,{
      value:selector==='#period'?'week':selector==='#warmup'?'1':selector==='#duration'?'10':selector==='#interval'?'2':'',
      textContent:'',innerHTML:'',hidden:false,listeners:{},attrs:{},
      addEventListener(k,fn){this.listeners[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},reportValidity:()=>true,focus(){}
    });
    return nodes.get(selector);
  };
  class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
  class Audio {
    constructor(){this.currentTime=0;this.state='running';this.destination={};}
    async resume(){this.state='running';}
    createOscillator(){return {frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  }
  const sandbox = {
    Date:Clock, Meditation:context.module.exports, crypto:{randomUUID:()=>String(now)}, navigator:{},
    localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(failWrite)throw Error();storage.set(k,v);}},
    document:{querySelector:get,querySelectorAll:()=>[],hidden:false,addEventListener:(k,fn)=>events[k]=fn},
    window:{AudioContext:Audio,addEventListener:(k,fn)=>events[k]=fn},
    setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval(){}
  };
  vm.runInNewContext(fs.readFileSync('apps/meditation/app.js','utf8'),sandbox);
  return {get,events,storage,advance:seconds=>{now+=seconds*1000;timers.at(-1)();},
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
