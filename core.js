/* Fridge Clear-Out — core logic
 * Pure functions, no DOM, so it can be tested straight from Node.
 * Exposed as window.FridgeCore (browser) or module.exports (Node).
 */
(function (root) {
  'use strict';

  var UNITS = ['pcs', 'stalk', 'head', 'bunch', 'clove', 'slice', 'tbsp', 'g', 'ml'];

  var PRESET_INGREDIENTS = [
    { name: 'Tomato', unit: 'pcs', category: 'Vegetable', flavor: 'Sweet & sour', color: 'Red', stock: 3 },
    { name: 'Cucumber', unit: 'stalk', category: 'Vegetable', flavor: 'Fresh', color: 'Green', stock: 2 },
    { name: 'Eggplant', unit: 'pcs', category: 'Vegetable', flavor: 'Mild', color: 'Purple', stock: 2 },
    { name: 'Potato', unit: 'pcs', category: 'Vegetable', flavor: 'Mild', color: 'Yellow', stock: 4 },
    { name: 'Carrot', unit: 'stalk', category: 'Vegetable', flavor: 'Sweet', color: 'Orange', stock: 2 },
    { name: 'Onion', unit: 'pcs', category: 'Vegetable', flavor: 'Pungent', color: 'Purple', stock: 1 },
    { name: 'Green pepper', unit: 'pcs', category: 'Vegetable', flavor: 'Fresh', color: 'Green', stock: 2 },
    { name: 'Napa cabbage', unit: 'head', category: 'Vegetable', flavor: 'Mild', color: 'Pale green', stock: 1 },
    { name: 'Spinach', unit: 'bunch', category: 'Vegetable', flavor: 'Sweet', color: 'Green', stock: 1 },
    { name: 'Apple', unit: 'pcs', category: 'Fruit', flavor: 'Sweet', color: 'Red', stock: 3 },
    { name: 'Banana', unit: 'stalk', category: 'Fruit', flavor: 'Sweet', color: 'Yellow', stock: 4 },
    { name: 'Orange', unit: 'pcs', category: 'Fruit', flavor: 'Sweet & sour', color: 'Orange', stock: 2 },
    { name: 'Egg', unit: 'pcs', category: 'Dairy & eggs', flavor: 'Rich', color: 'White', stock: 6 },
    { name: 'Milk', unit: 'ml', category: 'Dairy & eggs', flavor: 'Creamy', color: 'White', stock: 500 },
    { name: 'Pork', unit: 'g', category: 'Meat', flavor: 'Savory', color: 'Red', stock: 300 },
    { name: 'Chicken', unit: 'g', category: 'Meat', flavor: 'Savory', color: 'White', stock: 0 },
    { name: 'Rice', unit: 'tbsp', category: 'Staple', flavor: 'Mild', color: 'White', stock: 6 },
    { name: 'Noodles', unit: 'g', category: 'Staple', flavor: 'Mild', color: 'Yellow', stock: 200 },
    { name: 'Flour', unit: 'g', category: 'Staple', flavor: 'Mild', color: 'White', stock: 500 },
    { name: 'Salt', unit: 'tbsp', category: 'Seasoning', flavor: 'Salty', color: 'White', stock: 10 },
    { name: 'Soy sauce', unit: 'tbsp', category: 'Seasoning', flavor: 'Salty', color: 'Black', stock: 8 },
    { name: 'Cooking oil', unit: 'tbsp', category: 'Seasoning', flavor: 'Fragrant', color: 'Yellow', stock: 9 },
    { name: 'Garlic', unit: 'clove', category: 'Seasoning', flavor: 'Pungent', color: 'White', stock: 5 },
    { name: 'Ginger', unit: 'slice', category: 'Seasoning', flavor: 'Pungent', color: 'Yellow', stock: 4 },
    { name: 'Scallion', unit: 'stalk', category: 'Seasoning', flavor: 'Fresh', color: 'Green', stock: 2 }
  ];

  var PRESET_RECIPES = [
    { name: 'Tomato & egg stir-fry', items: [['Tomato', 2], ['Egg', 3], ['Cooking oil', 1], ['Salt', 1]] },
    { name: 'Pepper & potato stir-fry', items: [['Potato', 2], ['Green pepper', 1], ['Garlic', 2], ['Cooking oil', 1], ['Salt', 1]] },
    { name: 'Egg fried rice', items: [['Rice', 2], ['Egg', 2], ['Scallion', 1], ['Cooking oil', 1], ['Salt', 1]] },
    { name: 'Vinegar cabbage', items: [['Napa cabbage', 1], ['Garlic', 2], ['Cooking oil', 1], ['Salt', 1]] }
  ];

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  function round(n) {
    return Math.round(n * 1000) / 1000;
  }

  function defaultState() {
    var state = { ingredients: [], recipes: [] };
    PRESET_INGREDIENTS.forEach(function (p) {
      state.ingredients.push({
        id: uid('ing'),
        name: p.name,
        unit: p.unit,
        category: p.category,
        flavor: p.flavor,
        color: p.color,
        stock: p.stock
      });
    });
    var byName = {};
    state.ingredients.forEach(function (i) { byName[i.name] = i.id; });
    PRESET_RECIPES.forEach(function (r) {
      state.recipes.push({
        id: uid('rec'),
        name: r.name,
        items: r.items
          .filter(function (it) { return byName[it[0]]; })
          .map(function (it) { return { ingredientId: byName[it[0]], qty: it[1] }; })
      });
    });
    return state;
  }

  function findIngredient(state, id) {
    for (var i = 0; i < state.ingredients.length; i++) {
      if (state.ingredients[i].id === id) return state.ingredients[i];
    }
    return null;
  }

  function findRecipe(state, id) {
    for (var i = 0; i < state.recipes.length; i++) {
      if (state.recipes[i].id === id) return state.recipes[i];
    }
    return null;
  }

  /* Expand a recipe into "what it needs, what you have, what's missing".
   * Duplicate lines for the same ingredient are merged first, otherwise two
   * lines of two tomatoes each would both pass against a stock of three.
   * A recipe pointing at a deleted ingredient is marked broken and blocks cooking. */
  function requirementRows(state, recipe) {
    var order = [];
    var map = {};
    (recipe.items || []).forEach(function (item) {
      var key = item.ingredientId;
      if (!map[key]) {
        map[key] = { ingredientId: key, qty: 0 };
        order.push(key);
      }
      map[key].qty = round(map[key].qty + num(item.qty));
    });

    return order.map(function (key) {
      var need = map[key].qty;
      var ing = findIngredient(state, key);
      if (!ing) {
        return {
          ingredientId: key,
          name: '(deleted ingredient)',
          unit: '',
          need: need,
          have: 0,
          short: need,
          ok: false,
          broken: true
        };
      }
      var have = num(ing.stock);
      return {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        need: need,
        have: have,
        short: round(Math.max(0, need - have)),
        ok: have >= need,
        broken: false
      };
    });
  }

  function canCook(state, recipe) {
    var rows = requirementRows(state, recipe);
    return {
      ok: rows.length > 0 && rows.every(function (r) { return r.ok; }),
      empty: rows.length === 0,
      rows: rows
    };
  }

  /* Cook: validate the whole recipe first, deduct only if everything is in stock.
   * Returns { ok, reason, rows }; when ok is false the state is untouched. */
  function cook(state, recipeId) {
    var recipe = findRecipe(state, recipeId);
    if (!recipe) return { ok: false, reason: 'Recipe not found', rows: [] };
    var check = canCook(state, recipe);
    if (check.empty) return { ok: false, reason: 'This recipe has no ingredients yet', rows: [] };
    if (!check.ok) return { ok: false, reason: 'Not enough ingredients to cook this', rows: check.rows };

    check.rows.forEach(function (row) {
      var ing = findIngredient(state, row.ingredientId);
      ing.stock = round(num(ing.stock) - row.need);
    });
    return { ok: true, reason: '', rows: check.rows };
  }

  function addStock(state, ingredientId, delta) {
    var ing = findIngredient(state, ingredientId);
    if (!ing) return false;
    ing.stock = round(Math.max(0, num(ing.stock) + num(delta)));
    return true;
  }

  function setStock(state, ingredientId, value) {
    var ing = findIngredient(state, ingredientId);
    if (!ing) return false;
    ing.stock = round(Math.max(0, num(value)));
    return true;
  }

  function upsertIngredient(state, data) {
    var ing = data.id ? findIngredient(state, data.id) : null;
    if (ing) {
      ing.name = String(data.name || ing.name).trim() || ing.name;
      ing.unit = String(data.unit || ing.unit);
      ing.category = String(data.category || '').trim();
      ing.flavor = String(data.flavor || '').trim();
      ing.color = String(data.color || '').trim();
      if (data.stock !== undefined) ing.stock = round(Math.max(0, num(data.stock, ing.stock)));
      return ing;
    }
    var created = {
      id: uid('ing'),
      name: String(data.name || '').trim(),
      unit: String(data.unit || 'pcs'),
      category: String(data.category || '').trim(),
      flavor: String(data.flavor || '').trim(),
      color: String(data.color || '').trim(),
      stock: round(Math.max(0, num(data.stock, 0)))
    };
    if (!created.name) return null;
    state.ingredients.push(created);
    return created;
  }

  /* Deleting an ingredient also removes it from every recipe that used it */
  function removeIngredient(state, ingredientId) {
    var before = state.ingredients.length;
    state.ingredients = state.ingredients.filter(function (i) { return i.id !== ingredientId; });
    if (state.ingredients.length === before) return false;
    state.recipes.forEach(function (r) {
      r.items = (r.items || []).filter(function (it) { return it.ingredientId !== ingredientId; });
    });
    return true;
  }

  function upsertRecipe(state, data) {
    var items = (data.items || [])
      .filter(function (it) {
        return it.ingredientId && num(it.qty) > 0 && findIngredient(state, it.ingredientId);
      })
      .map(function (it) { return { ingredientId: it.ingredientId, qty: round(num(it.qty)) }; });

    var rec = data.id ? findRecipe(state, data.id) : null;
    var name = String(data.name || '').trim();
    if (rec) {
      if (name) rec.name = name;
      rec.items = items;
      return rec;
    }
    if (!name) return null;
    var created = { id: uid('rec'), name: name, items: items };
    state.recipes.push(created);
    return created;
  }

  function removeRecipe(state, recipeId) {
    var before = state.recipes.length;
    state.recipes = state.recipes.filter(function (r) { return r.id !== recipeId; });
    return state.recipes.length !== before;
  }

  /* Distinct values already in use, for type-ahead suggestions */
  function tagOptions(state, field) {
    var seen = {};
    state.ingredients.forEach(function (i) {
      var v = i[field];
      if (v) seen[v] = true;
    });
    return Object.keys(seen).sort();
  }

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.ingredients) || !Array.isArray(raw.recipes)) return null;
    var state = { ingredients: [], recipes: [] };
    raw.ingredients.forEach(function (i) {
      if (!i || !i.id || !i.name) return;
      state.ingredients.push({
        id: String(i.id),
        name: String(i.name),
        unit: String(i.unit || 'pcs'),
        category: String(i.category || ''),
        flavor: String(i.flavor || ''),
        color: String(i.color || ''),
        stock: round(Math.max(0, num(i.stock)))
      });
    });
    var ids = {};
    state.ingredients.forEach(function (i) { ids[i.id] = true; });
    raw.recipes.forEach(function (r) {
      if (!r || !r.id || !r.name) return;
      state.recipes.push({
        id: String(r.id),
        name: String(r.name),
        items: (Array.isArray(r.items) ? r.items : [])
          .filter(function (it) { return it && ids[it.ingredientId] && num(it.qty) > 0; })
          .map(function (it) { return { ingredientId: String(it.ingredientId), qty: round(num(it.qty)) }; })
      });
    });
    return state;
  }

  var api = {
    UNITS: UNITS,
    defaultState: defaultState,
    findIngredient: findIngredient,
    findRecipe: findRecipe,
    requirementRows: requirementRows,
    canCook: canCook,
    cook: cook,
    addStock: addStock,
    setStock: setStock,
    upsertIngredient: upsertIngredient,
    removeIngredient: removeIngredient,
    upsertRecipe: upsertRecipe,
    removeRecipe: removeRecipe,
    tagOptions: tagOptions,
    sanitize: sanitize,
    round: round
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FridgeCore = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
