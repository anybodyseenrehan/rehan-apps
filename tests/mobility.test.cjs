const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/mobility.js', 'utf8');
const KEY = 'mobility.completions.v1';

function app({ saved = null, now = '2026-11-09T12:00:00', failWrite = false } = {}) {
  const nodes = new Map(), events = {}, timers = [];
  let clock = new Date(now).getTime(), raw = saved;
  const node = () => ({ textContent: '', innerHTML: '', checked: false, disabled: false, hidden: false, attrs: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.listeners[k] = fn; } });
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); };
  const card = { dataset: { routineId: 'morning-hip-mobility', routineTitle: 'Morning hip mobility', calendarTitle: 'Hip mobility' } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const context = {
    Date: Clock,
    localStorage: { getItem: key => { assert.equal(key, KEY); return raw; }, setItem: (key, value) => { assert.equal(key, KEY); if (failWrite) throw Error('Storage full'); raw = value; } },
    document: { hidden: false, querySelector: get, querySelectorAll: selector => selector === '[data-routine-id]' ? [card] : [], addEventListener: (name, fn) => { events[name] = fn; } },
    window: { addEventListener: (name, fn) => { events[name] = fn; } },
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {}
  };
  vm.runInNewContext(source, context);
  return {
    get, events, timers, raw: () => raw,
    setTime: value => { clock = new Date(value).getTime(); },
    click: selector => get(selector).listeners.click(),
    complete: checked => { const checkbox = get('[data-complete="morning-hip-mobility"]'); checkbox.checked = checked; checkbox.listeners.change({ target: checkbox }); }
  };
}

test('completion persists once, appears on calendar and selected day, reloads, and can be undone', () => {
  const a = app();
  a.complete(true);
  a.complete(true);
  assert.equal(JSON.parse(a.raw()).completions['2026-11-09'].length, 1);
  assert.match(a.get('#calendarGrid').innerHTML, /class="completed-day">Hip mobility/);
  assert.match(a.get('#dayRoutines').innerHTML, /Morning hip mobility/);
  const b = app({ saved: a.raw() });
  assert.equal(b.get('[data-complete="morning-hip-mobility"]').checked, true);
  b.complete(false);
  assert.deepEqual(JSON.parse(b.raw()).completions, {});
  assert.doesNotMatch(b.get('#calendarGrid').innerHTML, /class="completed-day"/);
});

test('midnight and returning from phone sleep reset checkbox without losing prior days', () => {
  const a = app({ now: '2026-11-09T23:59:59' });
  a.complete(true);
  assert.equal(a.timers[0].delay, 1100);
  a.setTime('2026-11-10T00:00:01');
  a.timers[0].fn();
  assert.equal(a.get('[data-complete="morning-hip-mobility"]').checked, false);
  assert.equal(JSON.parse(a.raw()).completions['2026-11-09'].length, 1);
  a.complete(true);
  a.setTime('2026-11-12T09:00:00');
  a.events.visibilitychange();
  assert.equal(a.get('[data-complete="morning-hip-mobility"]').checked, false);
  assert.equal(Object.keys(JSON.parse(a.raw()).completions).length, 2);
});

test('date keys use the device local date and a stale checkbox logs the current day', () => {
  const a = app({ now: '2026-11-09T23:59:59' });
  a.setTime('2026-11-10T00:00:01');
  a.complete(true);
  assert.deepEqual(Object.keys(JSON.parse(a.raw()).completions), ['2026-11-10']);
});

test('month navigation handles year boundaries, leap years, selected-day details, and Today', () => {
  const a = app({ now: '2028-01-31T12:00:00' });
  a.click('#monthNext');
  assert.equal((a.get('#calendarGrid').innerHTML.match(/data-day=/g) || []).length, 29);
  assert.match(a.get('#dayTitle').textContent, /February 1, 2028/);
  a.click('#monthPrev');
  a.click('#monthPrev');
  assert.match(a.get('#calendarMonth').textContent, /December 2027/);
  a.click('#calendarToday');
  assert.match(a.get('#calendarMonth').textContent, /January 2028/);
  a.get('#calendarGrid').listeners.click({ target: { closest: () => ({ dataset: { day: '2028-01-15' } }) } });
  assert.match(a.get('#dayTitle').textContent, /January 15, 2028/);
});

test('failed writes restore checkbox and corrupt history is preserved without overwriting', () => {
  const a = app({ failWrite: true });
  a.complete(true);
  assert.equal(a.raw(), null);
  assert.equal(a.get('[data-complete="morning-hip-mobility"]').checked, false);
  assert.match(a.get('#status').textContent, /Could not save/);
  const b = app({ saved: '{broken' });
  assert.equal(b.get('[data-complete="morning-hip-mobility"]').disabled, true);
  b.complete(true);
  assert.equal(b.raw(), '{broken');
});

test('history titles are escaped and other routines survive completion changes', () => {
  const saved = JSON.stringify({ schemaVersion: 1, completions: { '2026-11-09': [{ routineId: 'other', title: '<img src=x>' }] } });
  const a = app({ saved });
  assert.match(a.get('#dayRoutines').innerHTML, /&lt;img src=x&gt;/);
  a.complete(true);
  a.complete(false);
  assert.equal(JSON.parse(a.raw()).completions['2026-11-09'][0].routineId, 'other');
});
