const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function app(saved = {}, failWrite = false) {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.value = ''; }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    focus() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    reset() { for (const field of Object.values(this.elements)) field.value = ''; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      return all.filter(child => selector === '*' ||
        selector === 'details[open]' && child.tag === 'details' && child.open ||
        selector === 'details' && child.tag === 'details' ||
        selector === '.skill-card' && child.className === 'skill-card' ||
        selector === '.practice-button' && child.className === 'practice-button' ||
        selector === 'input[type=checkbox]' && child.type === 'checkbox' ||
        selector === child.tag);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
  }
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Element('div'));
    return nodes.get(id);
  };
  get('skill-filter').value = 'all';
  get('skill-form').elements = { title: new Element('input'), cue: new Element('input'), steps: new Element('textarea') };
  const storage = {...saved};
  const context = {
    document: {
      getElementById: get, createElement: tag => new Element(tag),
      querySelectorAll: selector => get('skills-list').querySelectorAll(selector)
    },
    localStorage: {getItem: key => storage[key] ?? null, setItem(key,value) {if (failWrite) throw Error('full'); storage[key] = value;}},
    crypto: {randomUUID: () => 'test-id'}, confirm: () => true
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps/zuri/training.js','utf8'), context);
  context.renderTraining();
  return {get, storage, context, card: () => get('skills-list').children[0], saved: () => JSON.parse(storage['zuri.training.v1'])};
}

test('learned status, practice days and notes persist; practice can be undone and potty data is preserved', () => {
  const a = app({'zuri.potty.v1':'[{"id":"old","kind":"Both","at":100}]'});
  const checkbox = a.card().querySelector('input[type=checkbox]');
  checkbox.checked = true;
  checkbox.onchange();
  a.card().querySelector('.practice-button').onclick();
  const form = a.card().querySelector('form');
  form.querySelector('textarea').value = 'One second, calm and comfortable';
  form.onsubmit({preventDefault(){}});
  assert.equal(a.saved().progress.stay.learned, true);
  assert.equal(a.saved().progress.stay.practiceDays.length, 1);
  const b = app(a.storage);
  assert.equal(b.card().querySelector('input[type=checkbox]').checked, true);
  assert.equal(b.card().querySelector('textarea').value, 'One second, calm and comfortable');
  b.card().querySelector('.practice-button').onclick();
  assert.equal(b.saved().progress.stay.practiceDays.length, 0);
  assert.equal(b.storage['zuri.potty.v1'], a.storage['zuri.potty.v1']);
});

test('custom skills retain multiline instructions and can be edited and removed', () => {
  const a = app();
  const form = a.get('skill-form');
  a.get('add-skill').onclick();
  form.elements.title.value = '<Fetch>';
  form.elements.steps.value = 'Offer toy\nReward return';
  form.onsubmit({preventDefault(){},currentTarget:form});
  assert.equal(a.saved().custom[0].steps.length,2);
  const skill = a.saved().custom[0];
  a.context.openSkillEditor(skill);
  form.elements.title.value = 'Fetch';
  form.onsubmit({preventDefault(){},currentTarget:form});
  assert.equal(a.saved().custom.length,1);
  const card = a.get('skills-list').children.at(-1);
  card.querySelectorAll('button').find(button => button.textContent === 'Delete skill').onclick();
  assert.equal(a.saved().custom.length,0);
});

test('failed writes and corrupt storage preserve saved values; filtering and note drafts survive progress changes', () => {
  const a = app({},true);
  const check = a.card().querySelector('input[type=checkbox]');
  check.checked=true;check.onchange();
  assert.equal(check.checked,false);
  assert.equal(a.storage['zuri.training.v1'],undefined);
  const b=app({'zuri.training.v1':'broken'});
  assert.match(b.get('training-status').textContent,/couldn’t be read/);
  assert.equal(b.context.updateTraining(state => state.custom.push({})),false);
  assert.equal(b.storage['zuri.training.v1'],'broken');
  const c=app();
  const draft=c.card().querySelector('textarea');
  draft.value='Draft';draft.oninput();
  c.card().querySelector('.practice-button').onclick();
  assert.equal(c.card().querySelector('textarea').value,'Draft');
  c.get('skill-filter').value='learned';c.get('skill-filter').onchange();
  assert.match(c.get('skills-list').children[0].textContent,/Check off/);
});

test('potty backdating targets its own details panel and all three navigation views are wired', () => {
  const source=fs.readFileSync('apps/zuri/app.js','utf8');
  assert.ok(!source.includes("querySelector('details')"));
  const html=fs.readFileSync('apps/zuri/index.html','utf8');
  for(const view of ['training','log','trends']) {
    assert.ok(html.includes('id="'+view+'-view"'));
    assert.ok(html.includes('id="'+view+'-link"'));
  }
});
