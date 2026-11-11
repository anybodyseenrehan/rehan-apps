const planSkills = [
  {
    "id": "stay",
    "title": "Stay",
    "cue": "Stay → Free",
    "steps": [
      "Ask for Sit, then say Stay once. Wait one second, mark and feed while she stays. Release with Free.",
      "Build a few seconds beside her, then separately add one step away and back. Always return to reward.",
      "If she gets up, reset with an easier attempt."
    ]
  },
  {
    "id": "alone",
    "title": "Comfortable alone",
    "cue": "Comfort before duration",
    "steps": [
      "With toilet needs met, use a safe familiar area and a camera. Step away and return before worry.",
      "Later briefly disappear, initially under a second if needed. Repeat easy attempts with full relaxation between them.",
      "Add tiny amounts only while comfortable. If whining, scratching or tension starts, return and shorten the next attempt. Never wait for silence.",
      "Arrange care beyond her comfortable limit. Nine hours alone is not the December goal. Persistent distress, panic or injury risk needs veterinary advice."
    ]
  },
  {
    "id": "place",
    "title": "Place / bed",
    "cue": "Place or Bed → Free",
    "steps": [
      "Reward paws stepping onto a mat, then all four paws. Toss a reset treat away and reward her return.",
      "Add Place just before predictable entry. Ask for Down, reward briefly staying there, then Free.",
      "Build time before movement or distractions. Later teach Bed at her bed the same way."
    ]
  },
  {
    "id": "leave",
    "title": "Leave it",
    "cue": "Leave it",
    "steps": [
      "Hold kibble in a closed hand. When she looks or moves away, mark and reward from the OTHER hand.",
      "Once predictable, add Leave it before presenting the hand.",
      "Progress to an open hand, then a protected safe item on the floor. If she struggles, cover it and simplify."
    ]
  },
  {
    "id": "drop",
    "title": "Drop it",
    "cue": "Drop",
    "steps": [
      "Offer a low-interest toy, then a tasty food trade. As she releases, mark, feed and return the toy when safe.",
      "Add Drop before offering food once releases are predictable. Later reward from your pocket.",
      "Practise different safe toys. Do not chase or forcibly remove items as practice."
    ]
  },
  {
    "id": "recall",
    "title": "Recall / come",
    "cue": "Zuri, Come",
    "steps": [
      "Indoors, from 1–2 metres away, say Zuri, Come once and step backwards.",
      "Mark arrival within reach and give several tiny rewards. Often release her back to play.",
      "Build distance, then distractions. Outdoors use a harness and held long line. If ignored, move closer. Never punish her return."
    ]
  },
  {
    "id": "positions",
    "title": "Sit, down and stand",
    "cue": "Sit / Down / Stand → Free",
    "steps": [
      "Sit: reward her known cue. If needed, lure slightly up and back.",
      "Down: guide food from nose toward floor, then slightly forward. Reward elbows down.",
      "Stand: from sit, lure forward at nose height. Reward four feet standing.",
      "Add each cue when predictable, fade to an empty-hand gesture, then Free."
    ]
  },
  {
    "id": "wait",
    "title": "Wait",
    "cue": "Wait → Free",
    "steps": [
      "At a secured door with her on lead, say Wait, touch the handle and reward a brief pause.",
      "Gradually crack the door open. If she advances, gently close before she reaches the gap and reset with less movement.",
      "Release with Free to walk through together. Never let the door hit her."
    ]
  },
  {
    "id": "harness",
    "title": "Harness and lead comfort",
    "cue": "Voluntary steps",
    "steps": [
      "Show the harness and reward calm interest. Reward voluntarily putting her nose through. Never force it on.",
      "Build brief fastening, reward and removal. Once comfortable, clip the lead on and reward a few voluntary steps.",
      "If she freezes, simplify. Remove equipment before unattended pen/crate time."
    ]
  },
  {
    "id": "walking",
    "title": "Loose-lead walking",
    "cue": "Slack lead",
    "steps": [
      "Indoors, reward standing beside your chosen leg with slack lead.",
      "Take one step. Mark and feed beside your leg if she follows. Build several steps.",
      "If the lead tightens, pause without jerking, invite her back and resume with slack.",
      "Start quiet outdoor practice only after vet clearance. Include sniff breaks."
    ]
  },
  {
    "id": "greetings",
    "title": "Polite greetings",
    "cue": "Four paws down",
    "steps": [
      "With a calm helper and a gate or slack lead, reward four paws down. Allow a brief greeting if she wants contact.",
      "If she jumps, the helper pauses attention and creates space. Reward feet down and retry calmly.",
      "Build toward visitors gradually. Allow distance if worried. Do not force contact."
    ]
  }
];

const trainingKey = 'zuri.training.v1';
let editingSkill = null;
const noteDrafts = new Map();

function readTraining() {
  const data = JSON.parse(localStorage.getItem(trainingKey) || '{"custom":[],"progress":{}}');
  if (!Array.isArray(data.custom) || !data.progress || typeof data.progress !== 'object' || Array.isArray(data.progress)) {
    throw new Error('Invalid saved training data');
  }
  return data;
}

function updateTraining(change) {
  try {
    const data = readTraining();
    change(data);
    localStorage.setItem(trainingKey, JSON.stringify(data));
    document.getElementById('training-status').textContent = '';
    return true;
  } catch {
    document.getElementById('training-status').textContent = 'Couldn’t save training. Please try again.';
    return false;
  }
}

function trainingDay() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

function skillElement(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderTraining() {
  const list = document.getElementById('skills-list');
  const open = new Set([...list.querySelectorAll('details[open]')].map(item => item.dataset.skill));
  let data;
  try {
    data = readTraining();
  } catch {
    document.getElementById('training-status').textContent = 'Saved training couldn’t be read. Reload and try again.';
    return;
  }
  const skills = [...planSkills, ...data.custom];
  const learned = skills.filter(skill => data.progress[skill.id]?.learned).length;
  document.getElementById('training-progress').textContent = learned + ' of ' + skills.length + ' skills learned';
  const meter = document.getElementById('learned-progress');
  meter.max = skills.length;
  meter.value = learned;
  list.replaceChildren();
  const filter = document.getElementById('skill-filter').value;
  for (const skill of skills) {
    const progress = data.progress[skill.id] || {};
    if (filter === 'learned' && !progress.learned || filter === 'practising' && progress.learned) continue;
    const card = skillElement('details', undefined, 'skill-card');
    card.dataset.skill = skill.id;
    card.open = open.has(skill.id);
    const summary = skillElement('summary');
    const heading = skillElement('span', undefined, 'skill-heading');
    heading.append(skillElement('strong', skill.title), skillElement('small', progress.learned ? 'Learned' : 'Practising'));
    const arrow = skillElement('span', '+', 'skill-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    summary.append(heading, arrow);
    card.append(summary);
    const body = skillElement('div', undefined, 'skill-body');
    if (skill.cue) body.append(skillElement('p', skill.cue, 'skill-cue'));
    const steps = skillElement('ol');
    for (const step of skill.steps) steps.append(skillElement('li', step));
    body.append(steps);
    const learnedLabel = skillElement('label', undefined, 'learned-check');
    const checkbox = skillElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(progress.learned);
    const checkText = skillElement('span', 'Learned this skill');
    learnedLabel.append(checkbox, checkText);
    checkbox.onchange = () => {
      const success = updateTraining(state => {
        const current = state.progress[skill.id] ||= {};
        current.learned = checkbox.checked;
        current.learnedAt = checkbox.checked ? Date.now() : null;
      });
      if (success) {
        renderTraining();
        const replacement = [...list.querySelectorAll('details')].find(item => item.dataset.skill === skill.id);
        (replacement?.querySelector('input[type=checkbox]') || document.getElementById('skill-filter')).focus();
      } else checkbox.checked = Boolean(progress.learned);
    };
    body.append(learnedLabel);
    if (progress.learnedAt && progress.learned) {
      body.append(skillElement('p', 'Marked learned on ' + new Date(progress.learnedAt).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}), 'skill-meta'));
    }
    const practiced = (progress.practiceDays || []).includes(trainingDay());
    const practice = skillElement('button', practiced ? '✓ Practised today' : 'Mark practised today', 'practice-button');
    practice.type = 'button';
    practice.setAttribute('aria-pressed', String(practiced));
    practice.onclick = () => {
      if (updateTraining(state => {
        const current = state.progress[skill.id] ||= {};
        const today = trainingDay();
        const days = new Set(current.practiceDays || []);
        if (days.has(today)) days.delete(today);
        else days.add(today);
        current.practiceDays = [...days].sort();
      })) {
        renderTraining();
        [...list.querySelectorAll('details')].find(item => item.dataset.skill === skill.id)?.querySelector('.practice-button').focus();
      }
    };
    body.append(practice);
    const days = progress.practiceDays || [];
    if (days.length) {
      const last = new Date(days[days.length - 1] + 'T12:00:00');
      body.append(skillElement('p', days.length + (days.length === 1 ? ' practice day' : ' practice days') + ' · Last ' + last.toLocaleDateString(undefined, {month:'short', day:'numeric'}), 'skill-meta'));
    }
    const form = skillElement('form', undefined, 'skill-notes');
    const noteLabel = skillElement('label', 'Practice notes');
    const notes = skillElement('textarea');
    notes.rows = 3;
    notes.value = noteDrafts.get(skill.id) ?? progress.notes ?? '';
    notes.oninput = () => { noteDrafts.set(skill.id, notes.value); feedback.textContent = ''; };
    notes.placeholder = 'What worked? What should we try next?';
    noteLabel.append(notes);
    const save = skillElement('button', 'Save notes');
    save.type = 'submit';
    const feedback = skillElement('span', '', 'skill-meta');
    feedback.setAttribute('role', 'status');
    form.append(noteLabel, save, feedback);
    form.onsubmit = event => {
      event.preventDefault();
      if (updateTraining(state => {
        const current = state.progress[skill.id] ||= {};
        current.notes = notes.value.trim();
      })) {
        noteDrafts.delete(skill.id);
        feedback.textContent = 'Saved';
      }
    };
    body.append(form);
    if (data.custom.some(item => item.id === skill.id)) {
      const controls = skillElement('div', undefined, 'custom-controls');
      const edit = skillElement('button', 'Edit skill');
      edit.type = 'button';
      edit.onclick = () => openSkillEditor(skill);
      const remove = skillElement('button', 'Delete skill');
      remove.type = 'button';
      remove.onclick = () => {
        if (!confirm('Delete “' + skill.title + '” and its training progress?')) return;
        if (updateTraining(state => {
          state.custom = state.custom.filter(item => item.id !== skill.id);
          delete state.progress[skill.id];
        })) renderTraining();
      };
      controls.append(edit, remove);
      body.append(controls);
    }
    card.append(body);
    list.append(card);
  }
  if (!list.children.length) list.append(skillElement('p', filter === 'learned' ? 'Check off a skill to see it here.' : 'All skills are marked learned.', 'skill-empty'));
}

function openSkillEditor(skill = null) {
  editingSkill = skill?.id || null;
  const form = document.getElementById('skill-form');
  form.reset();
  form.elements.title.value = skill?.title || '';
  form.elements.cue.value = skill?.cue || '';
  form.elements.steps.value = skill?.steps.join('\n') || '';
  document.getElementById('skill-form-error').textContent = '';
  document.getElementById('skill-dialog-title').textContent = skill ? 'Edit skill' : 'Add a skill';
  document.getElementById('skill-dialog').showModal();
  form.elements.title.focus();
}

document.getElementById('add-skill').onclick = () => openSkillEditor();
document.getElementById('cancel-skill').onclick = () => document.getElementById('skill-dialog').close();
document.getElementById('skill-filter').onchange = renderTraining;
document.getElementById('skill-form').onsubmit = event => {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.elements.title.value.trim();
  if (!title) {
    document.getElementById('skill-form-error').textContent = 'Enter a skill name.';
    form.elements.title.focus();
    return;
  }
  const skill = {
    id: editingSkill || 'custom-' + crypto.randomUUID(),
    title,
    cue: form.elements.cue.value.trim(),
    steps: form.elements.steps.value.split('\n').map(step => step.trim()).filter(Boolean)
  };
  if (!updateTraining(state => {
    const index = state.custom.findIndex(item => item.id === skill.id);
    if (index < 0) state.custom.push(skill);
    else state.custom[index] = skill;
  })) {
    document.getElementById('skill-form-error').textContent = 'Couldn’t save. Please try again.';
    return;
  }
  document.getElementById('skill-dialog').close();
  document.getElementById('skill-filter').value = 'all';
  renderTraining();
  const card = [...document.querySelectorAll('.skill-card')].find(item => item.dataset.skill === skill.id);
  card.open = true;
  card.querySelector('summary').focus();
};
