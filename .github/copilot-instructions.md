# Copilot instructions for `my-first-app`

## Project shape

This is a dependency-free, client-/moside HTML5 canvas game named **NEON RUNNER**. There is no build system, package manager, module bundler, backend, or generated output. Keep the app runnable as static files in a browser.

- `index.html` is the page shell and accessibility/UI layer. It provides the HUD elements, canvas, game-over/win message, restart button, and control hints.
- `style.css` contains the visual system and responsive layout for the page and overlays. The game canvas is sized by CSS and rendered at device-pixel-ratio resolution by JavaScript.
- `game.js` owns all game state and behavior: level geometry, player physics, keyboard input, collisions, scoring, camera scrolling, particles, canvas drawing, HUD synchronization, and the animation loop.
- `README.md` is currently only a short Japanese placeholder; do not assume it documents additional workflows.

## Run, test, and lint

There are no repository-defined build, test, or lint commands and no automated test suite. For local browser testing, serve the repository root over HTTP (rather than opening `index.html` from `file://`, which can differ from normal browser hosting):

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. For a focused manual check, exercise the relevant game flow in the browser: movement with `A`/`D` or arrow keys, jumping with `W`, `Up`, or `Space`, coin collection and score/progress updates, enemy defeat/collision, falling, reaching the goal, and restarting from either end-state overlay. Resize the viewport to check the responsive layout and canvas scaling.

## Architecture and data flow

`game` is the single mutable runtime state object. `resetGame()` creates the player, camera, score, coin list, enemy list, particles, timer, and `"playing"` state, then hides the message overlay and refreshes the HUD. Static platform geometry is held separately in `levelPlatforms`; the world coordinate system is 4200 pixels wide.

The browser animation frame calls `update()` and then `draw()` continuously. `update()` reads the `keys` map, applies acceleration/friction and gravity, resolves downward platform landings, handles coins and enemies, advances the camera and particles, and transitions to `"won"`/`"lost"` through `endGame()`. `draw()` renders a fixed-height logical scene scaled to the CSS canvas size, draws the parallax backdrop and world objects after translating by `game.camera`, and leaves the DOM overlay/HUD to HTML/CSS. `updateHud()` is the only place that formats score, coin count, and progress for the DOM.

The game uses world coordinates for all gameplay entities and screen coordinates only for canvas rendering. When adding or moving level content, update the corresponding world data and keep drawing/collision dimensions aligned. The canvas context is reset for device-pixel-ratio rendering in `resize()`, while drawing uses a logical 430px scene height.

## Codebase-specific conventions

- Keep the app as plain browser JavaScript and CSS; use the existing classic `<script src="game.js">` entry point and DOM IDs/classes instead of introducing a framework or build step.
- Add new gameplay state inside `game` and initialize it in `resetGame()` so restarting fully resets it. Avoid module-level mutable state for per-run values.
- Use `endGame(won, title, body)` for terminal states so the state flag and localized message overlay stay synchronized. The main update path should stop gameplay when `game.state !== "playing"`.
- Keep gameplay constants and level layout near the top of `game.js`. Platforms are `[x, y, width, height]` data normalized into objects; coins use world `x`/`y` positions and carry run-specific `collected`/`phase` data; enemies carry patrol bounds and velocity.
- Preserve the existing input model: `keydown` prevents scrolling for arrows/Space, `keyup` clears keys, and Space is consumed after a jump check so it does not repeatedly trigger jumps.
- Keep DOM updates in `updateHud()` and rendering in `draw()`/the `draw*` helpers. Do not mix canvas drawing into HTML event handlers.
- Match the current visual language when changing UI: CSS custom properties in `:root`, dark navy panels, cyan/yellow/pink accents, the imported Barlow Condensed/Noto Sans JP fonts, and the existing responsive breakpoint at 620px.
- 画面に表示する説明文や案内文は、日本語で表示する。
- User-facing strings are currently written directly in Japanese or English in the HTML and JavaScript. Preserve that mixed-language product style and update both the visible control hints and behavior when changing controls.
- Preserve the existing accessible hooks: meaningful canvas `aria-label`, game-section label, status-role message, and a real button for restart actions.
