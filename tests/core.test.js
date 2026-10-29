/* Logic tests — node tests/core.test.js */
const assert = require('assert');
const C = require('../core.js');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    console.error('FAIL  ' + name + '\n      ' + e.message);
    process.exitCode = 1;
  }
}

function fresh() {
  return C.defaultState();
}

function idOf(state, name) {
  const ing = state.ingredients.find((i) => i.name === name);
  return ing ? ing.id : null;
}

function recipeOf(state, name) {
  return state.recipes.find((r) => r.name === name);
}

console.log('core.js');

test('default state ships 25 ingredients and 4 recipes', () => {
  const s = fresh();
  assert.strictEqual(s.ingredients.length, 25);
  assert.strictEqual(s.recipes.length, 4);
  assert.ok(s.ingredients.every((i) => i.id && i.name && i.unit));
});

test('every preset recipe line points at a real ingredient', () => {
  const s = fresh();
  s.recipes.forEach((r) => {
    r.items.forEach((it) => {
      assert.ok(C.findIngredient(s, it.ingredientId), r.name + ' references a missing ingredient');
    });
  });
});

test('findIngredient returns null for unknown ids', () => {
  assert.strictEqual(C.findIngredient(fresh(), 'nope'), null);
});

test('a recipe that is fully stocked reports can-cook', () => {
  const s = fresh();
  const check = C.canCook(s, recipeOf(s, 'Tomato & egg stir-fry'));
  assert.strictEqual(check.ok, true);
  assert.ok(check.rows.every((r) => r.ok));
});

test('a short ingredient is marked short with the right gap', () => {
  const s = fresh();
  C.setStock(s, idOf(s, 'Egg'), 1);
  const check = C.canCook(s, recipeOf(s, 'Tomato & egg stir-fry'));
  assert.strictEqual(check.ok, false);
  const egg = check.rows.find((r) => r.name === 'Egg');
  assert.strictEqual(egg.need, 3);
  assert.strictEqual(egg.have, 1);
  assert.strictEqual(egg.short, 2);
  assert.strictEqual(egg.ok, false);
});

test('duplicate lines for one ingredient are merged before checking', () => {
  const s = fresh();
  const tomatoId = idOf(s, 'Tomato');
  C.setStock(s, tomatoId, 3);
  const rec = C.upsertRecipe(s, {
    name: 'Double tomato',
    items: [
      { ingredientId: tomatoId, qty: 2 },
      { ingredientId: tomatoId, qty: 2 }
    ]
  });
  const rows = C.requirementRows(s, rec);
  assert.strictEqual(rows.length, 1, 'two lines should collapse into one requirement');
  assert.strictEqual(rows[0].need, 4);
  assert.strictEqual(C.canCook(s, rec).ok, false, '3 in stock cannot cover 4 needed');
});

test('cooking deducts exactly what the recipe needs', () => {
  const s = fresh();
  const tomatoId = idOf(s, 'Tomato');
  const eggId = idOf(s, 'Egg');
  const beforeTomato = C.findIngredient(s, tomatoId).stock;
  const beforeEgg = C.findIngredient(s, eggId).stock;
  const res = C.cook(s, recipeOf(s, 'Tomato & egg stir-fry').id);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(C.findIngredient(s, tomatoId).stock, beforeTomato - 2);
  assert.strictEqual(C.findIngredient(s, eggId).stock, beforeEgg - 3);
});

test('a failed cook leaves every stock value untouched', () => {
  const s = fresh();
  C.setStock(s, idOf(s, 'Chicken'), 0);
  const rec = C.upsertRecipe(s, {
    name: 'Chicken thing',
    items: [
      { ingredientId: idOf(s, 'Tomato'), qty: 1 },
      { ingredientId: idOf(s, 'Chicken'), qty: 100 }
    ]
  });
  const snapshot = JSON.stringify(s.ingredients.map((i) => [i.id, i.stock]));
  const res = C.cook(s, rec.id);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(JSON.stringify(s.ingredients.map((i) => [i.id, i.stock])), snapshot);
});

test('cooking a recipe with no ingredients is refused', () => {
  const s = fresh();
  const rec = C.upsertRecipe(s, { name: 'Air', items: [] });
  assert.strictEqual(C.cook(s, rec.id).ok, false);
  assert.strictEqual(C.canCook(s, rec).empty, true);
});

test('deleting an ingredient removes it from every recipe', () => {
  const s = fresh();
  const saltId = idOf(s, 'Salt');
  assert.strictEqual(C.removeIngredient(s, saltId), true);
  assert.strictEqual(C.findIngredient(s, saltId), null);
  s.recipes.forEach((r) => {
    assert.ok(!r.items.some((it) => it.ingredientId === saltId), r.name + ' still references the deleted ingredient');
  });
  assert.strictEqual(recipeOf(s, 'Vinegar cabbage').items.length, 3);
});

test('a recipe pointing at a missing ingredient is marked broken and blocks cooking', () => {
  const s = fresh();
  const rec = recipeOf(s, 'Tomato & egg stir-fry');
  rec.items.push({ ingredientId: 'ghost-id', qty: 1 });
  const check = C.canCook(s, rec);
  assert.strictEqual(check.ok, false);
  const broken = check.rows.find((r) => r.broken);
  assert.ok(broken, 'the ghost line should surface as a broken row');
  assert.strictEqual(broken.name, '(deleted ingredient)');
});

test('upsertRecipe drops lines with unknown ingredient ids or zero quantity', () => {
  const s = fresh();
  const rec = C.upsertRecipe(s, {
    name: 'Partly junk',
    items: [
      { ingredientId: idOf(s, 'Salt'), qty: 2 },
      { ingredientId: 'ghost', qty: 1 },
      { ingredientId: idOf(s, 'Salt'), qty: 0 }
    ]
  });
  assert.strictEqual(rec.items.length, 1);
  assert.strictEqual(rec.items[0].qty, 2);
});

test('stock never goes below zero', () => {
  const s = fresh();
  const tomatoId = idOf(s, 'Tomato');
  C.addStock(s, tomatoId, -999);
  assert.strictEqual(C.findIngredient(s, tomatoId).stock, 0);
  C.setStock(s, tomatoId, -5);
  assert.strictEqual(C.findIngredient(s, tomatoId).stock, 0);
});

test('sanitize rejects junk and drops broken references', () => {
  assert.strictEqual(C.sanitize(null), null);
  assert.strictEqual(C.sanitize({ ingredients: [] }), null);
  const cleaned = C.sanitize({
    ingredients: [
      { id: 'a', name: 'Tomato', unit: 'pcs', stock: 2 },
      { name: 'no id' }
    ],
    recipes: [
      { id: 'r1', name: 'Good', items: [{ ingredientId: 'a', qty: 1 }] },
      { id: 'r2', name: 'Bad', items: [{ ingredientId: 'ghost', qty: 1 }] }
    ]
  });
  assert.strictEqual(cleaned.ingredients.length, 1);
  assert.strictEqual(cleaned.recipes.length, 2);
  assert.strictEqual(cleaned.recipes[1].items.length, 0);
});

test('tagOptions returns distinct values already in use', () => {
  const s = fresh();
  const cats = C.tagOptions(s, 'category');
  assert.ok(cats.includes('Vegetable'));
  assert.ok(cats.includes('Seasoning'));
  assert.strictEqual(cats.length, new Set(cats).size);
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ' — some failed' : ''));
