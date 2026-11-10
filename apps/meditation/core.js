/* Shared timer and calendar calculations; no dependency on the browser clock. */
(function (root) {
  'use strict';
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function cues(warmup, duration, interval) {
    const events = [{ at: warmup, kind: 'gong' }, { at: warmup + duration / 2, kind: 'gong' }, { at: warmup + duration, kind: 'gong' }];
    if (interval > 0) for (let at = interval; at < duration; at += interval) {
      if (Math.abs(at - duration / 2) > 0.01) events.push({ at: warmup + at, kind: 'bell' });
    }
    return events.sort((a,b) => a.at-b.at);
  }
  function range(period, date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (period === 'week') start.setDate(start.getDate() - (start.getDay()+6)%7);
    if (period === 'month') start.setDate(1);
    if (period === 'year') start.setMonth(0,1);
    const end = new Date(start);
    if (period === 'week') end.setDate(end.getDate()+7);
    if (period === 'month') end.setMonth(end.getMonth()+1);
    if (period === 'year') end.setFullYear(end.getFullYear()+1);
    return { start, end };
  }
  function total(sessions, start, end) {
    return sessions.filter(s => new Date(s.startedAt) >= start && new Date(s.startedAt) < end).reduce((sum,s) => sum+s.seconds,0);
  }
  const api = { dayKey, cues, range, total };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Meditation = api;
})(globalThis);
