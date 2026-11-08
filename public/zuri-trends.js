const noteTopics = [
  ['Sleep / waking', /\b(naps?|napped|napping|woke|woken|wake|wakes|waking|sleep|sleeping|slept|awoke)\b/i],
  ['Food / meals', /\b(ate|eaten|eat|eats|eating|fed|food|meals?|breakfast|lunch|dinner|supper|kibble)\b/i],
  ['Unplanned outing', /\b(random(ly)?|unplanned|spontaneous(ly)?|on a whim|just in case)\b/i]
];

function summarizeBreaks(entries, now, period) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Number(period) || 1) + 1);
  const hours = Array.from({length: 12}, () => [0, 0]);
  const contexts = noteTopics.map(() => [0, 0]);
  let breaks = 0, withNotes = 0, matched = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.at) || entry.at > now || (period !== 'all' && entry.at < start)) continue;
    const pee = Number(entry.kind === 'Pee' || entry.kind === 'Both');
    const poop = Number(entry.kind === 'Poop' || entry.kind === 'Both');
    if (!pee && !poop) continue;
    breaks++;
    const bucket = hours[Math.floor(new Date(entry.at).getHours() / 2)];
    bucket[0] += pee;
    bucket[1] += poop;
    if (!entry.note?.trim()) continue;
    withNotes++;
    let found = false;
    noteTopics.forEach(([, pattern], index) => {
      if (pattern.test(entry.note)) {
        contexts[index][0] += pee;
        contexts[index][1] += poop;
        found = true;
      }
    });
    if (found) matched++;
  }
  return {hours, contexts, breaks, withNotes, matched};
}

function fillTrendTable(id, labels, counts) {
  const body = document.getElementById(id);
  body.replaceChildren();
  counts.forEach(([pee, poop], index) => {
    if (!pee && !poop) return;
    const row = body.insertRow();
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = labels[index];
    row.append(label);
    row.insertCell().textContent = pee;
    row.insertCell().textContent = poop;
  });
}

function renderTrends(entries, now) {
  const stats = summarizeBreaks(entries, now, get('trend-period').value);
  get('trend-summary').textContent = stats.breaks
    ? stats.breaks + (stats.breaks === 1 ? ' logged break' : ' logged breaks')
    : 'No breaks logged in this period.';
  get('trend-results').hidden = !stats.breaks;
  const clock = hour => (hour % 12 || 12) + (hour % 24 < 12 ? ' am' : ' pm');
  const windows = stats.hours.map((_, i) => clock(i * 2) + ' – ' + clock(i * 2 + 2));
  const peaks = get('peak-times');
  peaks.replaceChildren();
  ['Pee', 'Poop'].forEach((kind, column) => {
    const counts = stats.hours.map(bucket => bucket[column]);
    const highest = Math.max(...counts);
    if (highest < 2 || counts.indexOf(highest) !== counts.lastIndexOf(highest)) return;
    const item = document.createElement('li');
    item.textContent = kind + ' was most often logged from ' + windows[counts.indexOf(highest)]
      + ' (' + highest + ' of ' + counts.reduce((sum, value) => sum + value, 0) + ').';
    peaks.append(item);
  });
  fillTrendTable('time-counts', windows, stats.hours);
  fillTrendTable('note-counts', noteTopics.map(([label]) => label), stats.contexts);
  get('note-table').hidden = !stats.matched;
  get('note-summary').textContent = stats.withNotes
    ? 'Matched routine keywords in ' + stats.matched + ' of ' + stats.withNotes + ' notes. One note can mention multiple routines.'
    : 'Add a note to a break, such as “woke up from a nap”, “just ate”, or “randomly took her out”.';
}
