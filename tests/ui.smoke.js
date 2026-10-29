/* UI smoke test — runs ui.js against a minimal DOM stub.
 * node tests/ui.smoke.js
 *
 * Why this exists: the build machine cannot start a headless browser
 * (child processes are denied named pipes), so nothing here takes a screenshot.
 * What it does prove: the render path runs without throwing, and the markup it
 * produces contains the rows, tags, flags and shortfall numbers we expect.
 */
const assert = require('assert');

class El {
  constructor(tag, id) {
    this.tagName = tag;
    this.id = id || '';
    this._html = '';
    this.hidden = false;
    this.value = '';
    this.className = '';
    this.textContent = '';
    this.dataset = {};
    this.listeners = {};
    this.files = null;
    this.style = {};
    this.classList = { toggle() {}, add() {}, remove() {} };
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener() {}
  querySelectorAll(sel) {
    if (sel === '.editor-row') return this._rows || [];
    return [];
  }
  querySelector() { return null; }
  closest() { return null; }
  setAttribute(k, v) { this[k] = v; }
  getAttribute(k) { return this[k]; }
  appendChild(node) { (this.children = this.children || []).push(node); }
  removeChild() {}
  remove() {}
  focus() {}
  click() {}
  get firstElementChild() { return new El('div'); }
}

const registry = new Map();
function el(id) {
  if (!registry.has(id)) registry.set(id, new El('div', id));
  return registry.get(id);
}

const tabs = ['pantry', 'recipes'].map((name) => {
  const t = new El('button');
  t.dataset.tab = name;
  return t;
});

global.document = {
  getElementById: (id) => el(id),
  querySelectorAll: (sel) => (sel === '.tab' ? tabs : []),
  querySelector: () => null,
  addEventListener() {},
  createElement: (tag) => new El(tag),
  body: new El('body')
};

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

global.window = { FridgeCore: require('../core.js'), confirm: () => true };
global.Blob = class {};
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.FileReader = class {};

require('../ui.js');

const pantry = el('pantry-body').innerHTML;
const recipes = el('recipe-grid').innerHTML;

function check(name, fn) {
  try {
    fn();
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('FAIL  ' + name + '\n      ' + e.message);
    process.exitCode = 1;
  }
}

check('initial render does not throw and lists 25 ingredients', () => {
  const rows = (pantry.match(/<tr data-id=/g) || []).length;
  assert.strictEqual(rows, 25);
});

check('names and all three tag layers are rendered', () => {
  assert.ok(pantry.includes('Tomato'));
  assert.ok(pantry.includes('class="chip cat">Vegetable<'));
  assert.ok(pantry.includes('class="chip fla">Sweet &amp; sour<'));
  assert.ok(pantry.includes('class="chip col">Red<'));
});

check('zero stock is flagged as out of stock', () => {
  const chickenRow = pantry.split('<tr').find((r) => r.includes('Chicken'));
  assert.ok(chickenRow, 'the Chicken row should be rendered');
  assert.ok(chickenRow.includes('is-empty-stock'), 'zero stock should add the is-empty-stock class');
  assert.ok(chickenRow.includes('class="flag">Out of stock<'));
});

check('four recipe cards render with cook state and a cook button', () => {
  const cards = (recipes.match(/<article class="recipe-card/g) || []).length;
  assert.strictEqual(cards, 4);
  assert.ok(recipes.includes('Tomato &amp; egg stir-fry'));
  assert.ok(recipes.includes('Ready to cook'));
  assert.ok(recipes.includes('data-act="cook"'));
});

check('a short line is highlighted together with the gap', () => {
  const card = recipes.split('<article').find((c) => c.includes('Tomato &amp; egg stir-fry'));
  assert.ok(card.includes('need <strong>3</strong> pcs'));
  assert.ok(card.includes('have <strong>6</strong>'));
});

check('tab counters match the lists', () => {
  assert.strictEqual(el('count-pantry').textContent, 25);
  assert.strictEqual(el('count-recipes').textContent, 4);
});

check('one +1 click changes stock and persists to localStorage', () => {
  const firstId = (pantry.match(/<tr data-id="([^"]+)"/) || [])[1];
  assert.ok(firstId, 'should be able to read the first row id');
  const tr = { dataset: { id: firstId } };
  const btn = { dataset: { act: 'plus' }, closest: (sel) => (sel === 'tr' ? tr : null) };
  const ev = { target: { closest: () => btn } };
  el('pantry-body').listeners.click.forEach((fn) => fn(ev));

  assert.ok(store.has('fridge-clearout/v1'), 'a change should be persisted');
  const saved = JSON.parse(store.get('fridge-clearout/v1'));
  assert.strictEqual(saved.ingredients.length, 25);
  assert.ok(saved.ingredients.some((i) => i.id === firstId));
  assert.ok(el('pantry-body').innerHTML.includes('data-id="' + firstId + '"'), 'the list should re-render');
});

console.log('\nUI smoke test finished' + (process.exitCode ? ' — some checks failed' : ''));
