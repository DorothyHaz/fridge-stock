/* Fridge Clear-Out — interface layer
 * Depends on core.js (window.FridgeCore). State is persisted in localStorage.
 */
(function () {
  'use strict';

  var C = window.FridgeCore;
  /* Browsers share one localStorage across every file:// page, so the English
   * build gets its own key — otherwise it would load the Chinese build's data.
   * (The Chinese build meanwhile keeps using 'fridge-stock/v1'.) */
  var STORAGE_KEY = 'fridge-clearout/v1';

  var state = loadState();
  var ui = { tab: 'pantry', search: '' };
  var modal = { onSave: null, onDelete: null };

  var el = {
    pantryBody: document.getElementById('pantry-body'),
    pantryEmpty: document.getElementById('pantry-empty'),
    pantrySearch: document.getElementById('pantry-search'),
    recipes: document.getElementById('recipe-grid'),
    recipesEmpty: document.getElementById('recipes-empty'),
    countPantry: document.getElementById('count-pantry'),
    countRecipes: document.getElementById('count-recipes'),
    panelPantry: document.getElementById('panel-pantry'),
    panelRecipes: document.getElementById('panel-recipes'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalSave: document.getElementById('modal-save'),
    modalCancel: document.getElementById('modal-cancel'),
    modalClose: document.getElementById('modal-close'),
    modalDelete: document.getElementById('modal-delete'),
    toast: document.getElementById('toast'),
    fileImport: document.getElementById('file-import')
  };

  /* ---------------- storage ---------------- */

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return C.defaultState();
      var parsed = C.sanitize(JSON.parse(raw));
      return parsed || C.defaultState();
    } catch (e) {
      return C.defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('Could not save — browser storage may be full', 'warn');
    }
  }

  /* ---------------- helpers ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(n) {
    return String(C.round(Number(n) || 0));
  }

  var toastTimer = null;
  function toast(message, kind) {
    el.toast.textContent = message;
    el.toast.className = 'toast' + (kind ? ' ' + kind : '');
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 2600);
  }

  function sortedIngredients() {
    return state.ingredients.slice().sort(function (a, b) {
      var ca = a.category || '', cb = b.category || '';
      if (ca !== cb) return ca.localeCompare(cb);
      return a.name.localeCompare(b.name);
    });
  }

  /* ---------------- rendering ---------------- */

  function render() {
    renderCounts();
    renderPantry();
    renderRecipes();
  }

  function renderCounts() {
    el.countPantry.textContent = state.ingredients.length;
    el.countRecipes.textContent = state.recipes.length;
  }

  function chipsFor(ing) {
    var out = [];
    if (ing.category) out.push('<span class="chip cat">' + esc(ing.category) + '</span>');
    if (ing.flavor) out.push('<span class="chip fla">' + esc(ing.flavor) + '</span>');
    if (ing.color) out.push('<span class="chip col">' + esc(ing.color) + '</span>');
    return out.length ? '<div class="chips">' + out.join('') + '</div>' : '<span class="value">—</span>';
  }

  function matchQuery(ing, q) {
    if (!q) return true;
    var hay = [ing.name, ing.category, ing.flavor, ing.color, ing.unit].join(' ').toLowerCase();
    return hay.indexOf(q.toLowerCase()) !== -1;
  }

  function renderPantry() {
    var q = ui.search.trim();
    var rows = sortedIngredients().filter(function (i) { return matchQuery(i, q); });

    el.pantryBody.innerHTML = rows.map(function (ing) {
      var out = Number(ing.stock) <= 0;
      return '' +
        '<tr data-id="' + esc(ing.id) + '"' + (out ? ' class="is-empty-stock"' : '') + '>' +
          '<td class="col-name"><span class="ing-name">' + esc(ing.name) + '</span>' +
            (out ? '<span class="flag">Out of stock</span>' : '') +
          '</td>' +
          '<td class="col-tags">' + chipsFor(ing) + '</td>' +
          '<td class="col-stock">' +
            '<div class="stock-line"><span class="stock-value">' + fmt(ing.stock) + '</span>' +
            '<span class="stock-unit">' + esc(ing.unit) + '</span></div>' +
          '</td>' +
          '<td class="col-actions">' +
            '<button class="btn-mini" data-act="minus" type="button" title="Remove one">−1</button> ' +
            '<button class="btn-mini plus" data-act="plus" type="button" title="Add one">+1</button> ' +
            '<button class="btn-mini" data-act="edit" type="button">Edit</button>' +
          '</td>' +
        '</tr>';
    }).join('');

    el.pantryEmpty.hidden = rows.length !== 0;
    el.pantryEmpty.textContent = state.ingredients.length === 0
      ? 'Nothing here yet. Use “Add ingredient” to put something in.'
      : 'No ingredients match “' + q + '”.';
  }

  function renderRecipes() {
    var cards = state.recipes.map(function (rec) {
      var check = C.canCook(state, rec);
      var shortCount = check.rows.filter(function (r) { return !r.ok; }).length;
      var flag = check.empty
        ? '<span class="flag">Empty recipe</span>'
        : (check.ok
          ? '<span class="flag ok">Ready to cook</span>'
          : '<span class="flag">Missing ' + shortCount + '</span>');

      var items = check.rows.map(function (row) {
        return '' +
          '<div class="recipe-item' + (row.ok ? '' : ' short') + '">' +
            '<span>' + esc(row.name) + '</span>' +
            '<span class="value' + (row.ok ? '' : ' short') + '">' +
              'need <strong>' + fmt(row.need) + '</strong> ' + esc(row.unit) +
              ' · have <strong>' + fmt(row.have) + '</strong>' +
              (row.ok ? '' : ' · short ' + fmt(row.short)) +
            '</span>' +
          '</div>';
      }).join('');

      return '' +
        '<article class="recipe-card' + (check.ok ? ' can' : '') + '" data-id="' + esc(rec.id) + '">' +
          '<div class="recipe-head"><h3>' + esc(rec.name) + '</h3><span class="spacer"></span>' + flag + '</div>' +
          '<div class="recipe-items">' + (items || '<div class="recipe-item"><span class="value">No ingredients yet</span></div>') + '</div>' +
          '<div class="recipe-foot">' +
            '<div class="recipe-actions">' +
              '<button class="btn btn-primary" data-act="cook" type="button"' + (check.ok ? '' : ' disabled') + '>Cook</button>' +
            '</div>' +
            '<div class="recipe-actions">' +
              '<button class="btn-mini wide" data-act="edit" type="button">Edit</button>' +
              '<button class="btn-mini wide" data-act="delete" type="button">Delete</button>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');

    el.recipes.innerHTML = cards;
    el.recipesEmpty.hidden = state.recipes.length !== 0;
  }

  /* ---------------- modal ---------------- */

  function openModal(opts) {
    modal.onSave = opts.onSave || null;
    modal.onDelete = opts.onDelete || null;
    el.modalTitle.textContent = opts.title || '';
    el.modalBody.innerHTML = opts.body || '';
    el.modalDelete.hidden = !opts.onDelete;
    el.modalDelete.textContent = opts.deleteLabel || 'Delete';
    el.modalSave.textContent = opts.saveLabel || 'Save';
    el.modal.hidden = false;
    var first = el.modalBody.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  function closeModal() {
    el.modal.hidden = true;
    el.modalBody.innerHTML = '';
    modal.onSave = null;
    modal.onDelete = null;
  }

  function modalOpen() { return !el.modal.hidden; }

  function tagField(id, label, value, options) {
    return '' +
      '<div class="field">' +
        '<label for="' + id + '">' + label + '</label>' +
        '<input class="input" id="' + id + '" list="dl-' + id + '" value="' + esc(value) + '" />' +
        '<datalist id="dl-' + id + '">' +
          options.map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join('') +
        '</datalist>' +
      '</div>';
  }

  function openIngredientModal(id) {
    var ing = id ? C.findIngredient(state, id) : null;
    var unitOptions = C.UNITS.map(function (u) {
      return '<option value="' + esc(u) + '"' + (ing && ing.unit === u ? ' selected' : '') + '>' + esc(u) + '</option>';
    }).join('');

    var body = '' +
      '<div class="field">' +
        '<label for="f-name">Name</label>' +
        '<input class="input" id="f-name" value="' + esc(ing ? ing.name : '') + '" placeholder="e.g. Tofu" />' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field">' +
          '<label for="f-unit">Unit</label>' +
          '<select class="select" id="f-unit">' + unitOptions + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="f-stock">In stock</label>' +
          '<input class="input" id="f-stock" type="number" min="0" step="any" value="' + (ing ? fmt(ing.stock) : '0') + '" />' +
        '</div>' +
      '</div>' +
      '<p class="hint">Tags come in three layers: category says what it is, flavor and color just describe it. Both can be left empty.</p>' +
      tagField('f-cat', 'Category', ing ? ing.category : '', C.tagOptions(state, 'category')) +
      tagField('f-fla', 'Flavor', ing ? ing.flavor : '', C.tagOptions(state, 'flavor')) +
      tagField('f-col', 'Color', ing ? ing.color : '', C.tagOptions(state, 'color'));

    openModal({
      title: ing ? 'Edit ingredient' : 'Add ingredient',
      body: body,
      saveLabel: ing ? 'Save changes' : 'Add',
      onDelete: ing ? function () {
        var used = state.recipes.filter(function (r) {
          return (r.items || []).some(function (it) { return it.ingredientId === ing.id; });
        });
        var msg = 'Delete “' + ing.name + '”?';
        if (used.length) msg += '\nIt appears in ' + used.length + ' recipe(s), and those lines will be removed too.';
        if (!window.confirm(msg)) return;
        C.removeIngredient(state, ing.id);
        saveState();
        closeModal();
        render();
        toast('Deleted “' + ing.name + '”');
      } : null,
      onSave: function () {
        var name = document.getElementById('f-name').value.trim();
        if (!name) { toast('Name cannot be empty', 'warn'); return false; }
        var dup = state.ingredients.some(function (i) {
          return i.name.toLowerCase() === name.toLowerCase() && (!ing || i.id !== ing.id);
        });
        if (dup) { toast('There is already an ingredient called “' + name + '”', 'warn'); return false; }
        C.upsertIngredient(state, {
          id: ing ? ing.id : null,
          name: name,
          unit: document.getElementById('f-unit').value,
          stock: document.getElementById('f-stock').value,
          category: document.getElementById('f-cat').value,
          flavor: document.getElementById('f-fla').value,
          color: document.getElementById('f-col').value
        });
        saveState();
        closeModal();
        render();
        toast(ing ? 'Saved' : 'Added “' + name + '”', 'ok');
      }
    });
  }

  function recipeRowHtml(item, index) {
    var options = sortedIngredients().map(function (ing) {
      var sel = item && item.ingredientId === ing.id ? ' selected' : '';
      var label = ing.name + ' (' + ing.unit + ')' + (ing.category ? ' · ' + ing.category : '');
      return '<option value="' + esc(ing.id) + '"' + sel + '>' + esc(label) + '</option>';
    }).join('');

    return '' +
      '<div class="editor-row" data-row="' + index + '">' +
        '<select class="select r-ing">' + options + '</select>' +
        '<input class="input r-qty" type="number" min="0" step="any" value="' + (item ? fmt(item.qty) : '1') + '" />' +
        '<button class="btn-mini" data-act="del-row" type="button" title="Remove this line">Remove</button>' +
      '</div>';
  }

  function openRecipeModal(id) {
    var rec = id ? C.findRecipe(state, id) : null;

    if (!state.ingredients.length) {
      toast('Add a few ingredients under Stock before writing a recipe', 'warn');
      return;
    }

    var items = rec ? rec.items.slice() : [{ ingredientId: sortedIngredients()[0].id, qty: 1 }];
    var body = '' +
      '<div class="field">' +
        '<label for="f-rname">Recipe name</label>' +
        '<input class="input" id="f-rname" value="' + esc(rec ? rec.name : '') + '" placeholder="e.g. Tomato & egg stir-fry" />' +
      '</div>' +
      '<div class="field">' +
        '<label>Ingredients needed</label>' +
        '<div class="recipe-editor" id="r-rows">' +
          items.map(recipeRowHtml).join('') +
        '</div>' +
        '<button class="btn btn-ghost" id="r-add-row" type="button">+ Add ingredient</button>' +
      '</div>';

    openModal({
      title: rec ? 'Edit recipe' : 'Add recipe',
      body: body,
      saveLabel: rec ? 'Save changes' : 'Add',
      onDelete: rec ? function () {
        if (!window.confirm('Delete the recipe “' + rec.name + '”?')) return;
        C.removeRecipe(state, rec.id);
        saveState();
        closeModal();
        render();
        toast('Recipe deleted');
      } : null,
      onSave: function () {
        var name = document.getElementById('f-rname').value.trim();
        if (!name) { toast('Recipe name cannot be empty', 'warn'); return false; }
        var rows = Array.prototype.map.call(el.modalBody.querySelectorAll('.editor-row'), function (row) {
          return {
            ingredientId: row.querySelector('.r-ing').value,
            qty: Number(row.querySelector('.r-qty').value)
          };
        }).filter(function (it) { return it.qty > 0; });
        if (!rows.length) { toast('Add at least one ingredient with a quantity', 'warn'); return false; }
        C.upsertRecipe(state, { id: rec ? rec.id : null, name: name, items: rows });
        saveState();
        closeModal();
        render();
        toast(rec ? 'Saved' : 'Added the recipe “' + name + '”', 'ok');
      }
    });

    document.getElementById('r-add-row').addEventListener('click', function () {
      var wrap = document.getElementById('r-rows');
      var index = wrap.querySelectorAll('.editor-row').length;
      var div = document.createElement('div');
      div.innerHTML = recipeRowHtml({ ingredientId: sortedIngredients()[0].id, qty: 1 }, index);
      var row = div.firstElementChild;
      wrap.appendChild(row);
      row.querySelector('.r-ing').focus();
    });
  }

  /* ---------------- events ---------------- */

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      ui.tab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(function (t) {
        t.classList.toggle('is-active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      el.panelPantry.hidden = ui.tab !== 'pantry';
      el.panelRecipes.hidden = ui.tab !== 'recipes';
    });
  });

  el.pantrySearch.addEventListener('input', function () {
    ui.search = el.pantrySearch.value;
    renderPantry();
  });

  document.getElementById('btn-add-ingredient').addEventListener('click', function () {
    openIngredientModal(null);
  });

  document.getElementById('btn-add-recipe').addEventListener('click', function () {
    openRecipeModal(null);
  });

  el.pantryBody.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var tr = btn.closest('tr');
    var id = tr.dataset.id;
    var act = btn.dataset.act;
    if (act === 'plus') { C.addStock(state, id, 1); saveState(); render(); }
    else if (act === 'minus') { C.addStock(state, id, -1); saveState(); render(); }
    else if (act === 'edit') { openIngredientModal(id); }
  });

  el.recipes.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var card = btn.closest('.recipe-card');
    var id = card.dataset.id;
    var act = btn.dataset.act;

    if (act === 'edit') { openRecipeModal(id); return; }
    if (act === 'delete') {
      var rec = C.findRecipe(state, id);
      if (!rec) return;
      if (!window.confirm('Delete the recipe “' + rec.name + '”?')) return;
      C.removeRecipe(state, id);
      saveState();
      render();
      toast('Recipe deleted');
      return;
    }
    if (act === 'cook') {
      var recipe = C.findRecipe(state, id);
      if (!recipe) return;
      var res = C.cook(state, id);
      if (!res.ok) {
        toast(res.reason || 'Not enough ingredients to cook this', 'warn');
        return;
      }
      saveState();
      render();
      toast('Cooked “' + recipe.name + '” — deducted ' + res.rows.length + ' ingredient(s)', 'ok');
    }
  });

  el.modalSave.addEventListener('click', function () {
    if (!modal.onSave) { closeModal(); return; }
    var keep = modal.onSave();
    if (keep === false) return;
  });
  el.modalDelete.addEventListener('click', function () {
    if (modal.onDelete) modal.onDelete();
  });
  el.modalCancel.addEventListener('click', closeModal);
  el.modalClose.addEventListener('click', closeModal);
  el.modal.addEventListener('click', function (ev) {
    if (ev.target === el.modal) closeModal();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && modalOpen()) closeModal();
  });

  document.getElementById('btn-export').addEventListener('click', function () {
    var data = JSON.stringify({
      app: 'fridge-stock',
      version: 1,
      savedAt: new Date().toISOString(),
      ingredients: state.ingredients,
      recipes: state.recipes
    }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'fridge-stock-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Exported — check your Downloads folder', 'ok');
  });

  document.getElementById('btn-import').addEventListener('click', function () {
    el.fileImport.value = '';
    el.fileImport.click();
  });

  el.fileImport.addEventListener('change', function () {
    var file = el.fileImport.files && el.fileImport.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = C.sanitize(JSON.parse(String(reader.result)));
        if (!parsed) { toast('That file is not a backup from this app', 'warn'); return; }
        if (!window.confirm('Importing replaces the current ' + state.ingredients.length + ' ingredients and ' + state.recipes.length + ' recipes. Continue?')) return;
        state = parsed;
        saveState();
        render();
        toast('Imported ' + state.ingredients.length + ' ingredients', 'ok');
      } catch (e) {
        toast('Could not read that file — is it JSON?', 'warn');
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    if (!window.confirm('Reset to the 25 starter ingredients and 4 recipes? Your current data will be gone.')) return;
    state = C.defaultState();
    saveState();
    render();
    toast('Preset data restored');
  });

  render();
})();
