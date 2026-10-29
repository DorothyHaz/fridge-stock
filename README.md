# fridge-stock
It can help you keep track of what’s in your fridge. 冷蔵庫に何が入っているかを記録できます。 可以帮你记录冰箱里有什么
Fridge Clear-Out
Write down what's in the fridge, then see what you can cook tonight.
A single-page app with no backend, no account and no network calls. Everything lives in the browser's `localStorage`, and you can export it as JSON.
Live: https://dorothyhaz.github.io/fridge-stock/
Why this
Most recipe apps work backwards: pick a dish, then go shopping. Meanwhile things quietly rot at the back of the fridge, because at the moment you decide what to eat you don't actually know what you have.
This app flips the order. Record the stock first, and let the list tell you what's possible right now.
What it does
Stock — count every ingredient, with a unit that fits it (pcs, stalk, clove, slice, tbsp, g, ml) and three tags: category / flavor / color. Tags are free text, with suggestions drawn from what you already use.
Recipes — your own, not someone else's. Each one lists what it needs per ingredient.
Can I cook it? Every recipe card computes need / have / short live. Anything short turns red and the Cook button is disabled.
Cooking — one click deducts the stock. If any single ingredient is short, the whole recipe is refused and nothing is deducted.
Out of stock — zero-count ingredients are flagged in the list, so the shopping list writes itself.
Backup — export / import JSON, plus a one-click reset to the 25 starter ingredients and 4 recipes.
Running it
Open `index.html` in a browser. That's it — no build step, no dependencies.
