# Changelog

All notable changes to kselect.js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.11.1] — 2026-10-29

Accessibility of the open list. axe reported `aria-required-children` on every open dropdown, and `nested-interactive` with `selectAll` or `selectAllGroups`; all of it is fixed, verified in Chromium, Firefox and WebKit, desktop and the mobile sheet. Nothing about the options or events changes. Two things look different, both only with the options named: `selectAll` with search puts the search box on a row of its own, and a group header is no longer a Tab stop.

### Fixed

- **The listbox held things a listbox may not** (axe `aria-required-children`): the live region, the limit and no-results notices, and each group's header button were inside the `role="listbox"` dropdown. The listbox is now the options `<ul>` itself (`id="ks-listbox-<id>"`), holding only options and groups of options; the notices sit beside it in the dropdown. The control's and both search boxes' `aria-controls` / `aria-owns` point at it, it carries `aria-multiselectable` and `aria-busy`, and it moves into the mobile sheet with the options, so there is one listbox, desktop or sheet. The sheet's options area is a plain scroller again (1.11.0 made it the listbox).
- **A long list scrolled a box around the listbox, not the listbox** (axe `scrollable-region-focusable`, once the listbox moved): a scrolling region has to be the combobox's own popup, or reachable by keyboard. The options `<ul>` now scrolls, inside the dropdown (a flex column, shown with `display: flex`) and inside the sheet's options area, which are frames. Revealing the selection on open, the arrow keys' scrolling, the reset after a remote answer and the sheet's touch scroll-chaining guard all follow the list. A short list still sits at the bottom of the sheet.
- **The listbox had no accessible name.** It is now named as the control is: by the same `<label for>`, or the same `aria-label`.
- **Groups were not groups.** Each optgroup is a `role="group"` named by its label. Its header is the group's name, and the pointer still collapses it with a click; it is no longer a `<button>` (a control inside a listbox is unreachable or misreported), so it is not a Tab stop. Instead, **the arrow keys reach every option, and moving into a collapsed group opens it** — keyboard users could not reach a collapsed group's options at all without Tabbing out of the search box to a header.
- **`selectAllGroups` put a button inside a button** (axe `nested-interactive`): the group's select-all checkbox sat inside the header button. It is now an option of the group — "Select all in {group}" (`selectAllGroupLabel`) — drawn in the same place on the header row, reached by the arrow keys, toggled by Enter or a click, with `aria-selected` (it had `aria-pressed`). The header row is the new `.ks-group-head`; the header is a `div.ks-group-header`.
- **With `selectAll` and search, the search box was inside the "Select all" option** (axe `nested-interactive`), where a screen reader cannot reach it as a control. It now has a row of its own at the top of the dropdown, above the list, and stays put while the list scrolls; "Select all" is the list's first row. With no matches, select-all is hidden like any row (it had to stay while it held the search box).
- **Options greyed out at the `maxSelect` limit failed contrast** (2.7:1) because nothing said they were unavailable. They now carry `aria-disabled="true"` while the limit holds, which is also what they are.

---

## [1.11.0] — 2026-10-17

A release for pickers over lists too large to load whole — another table's records, thousands of rows — where the server has to do the searching. Nothing changes for a select without `load`, apart from three fixes to the mobile sheet.

### Added

- **`load` — search a remote source as the user types.** `load(query, signal)` is called (debounced by `loadDelay`, default 250 ms) from the dropdown's and the mobile sheet's search boxes alike, with the trimmed query, an `AbortSignal` and `this` set to the instance. It returns an array, or a promise of one, of `{ value, label, detail }`, and the answer replaces the offered rows. Why: a host whose `<select>` held only a first page had to reach into kselect's private search inputs, swap `<option>`s on each answer, and rely on the local filter still running over them — which hid any record the server had matched on a field other than the label.
  - The answer replaces the offered rows, not the selected ones: a picked option the answer lacks stays picked and is listed first.
  - Picking a row appends a real `<option>` (selected; `detail` carried as `data-ks-detail`) to the `<select>`, so the form posts it and `input` / `change` / `kselect:change` fire as for any pick, in single and multiple mode. Rows that are not picked never touch the select. The append is kselect's own, so the `autoSync` observer's record of it is dropped instead of rebuilding the list — keyboard focus survives an Enter-pick in multi mode.
  - The server is the filter: a remote answer is never re-filtered locally by the query. `noResultsText` shows only when the server answered with an empty array.
  - Each new search aborts the previous request through its signal, and an overtaken answer is discarded even if `load` ignores the signal. A throw, a rejection or a non-array answer leaves the list as it was and logs a `console.warn`; nothing is thrown into the page.
  - Loading state: `.ks-loading` on the wrapper, the dropdown and the mobile sheet, `aria-busy="true"` on the listbox, and a sticky `loadingText` line (default `'Searching…'`). `.ks-remote` marks a list showing a remote answer; the select-all row is hidden while it does.
  - `loadMinChars` (default 1): shorter queries filter the select's own options locally, as before. An empty box always shows the select's own options, and so does the next open.
  - Works with `dropdownParent` inside a Shadow DOM and under a `style-src` without `'unsafe-inline'`; the new states are classes only.
- **`data-ks-detail` — a second line under an option's label**, with or without `load`. Always plain text (whatever `allowHtml` says) and outside `.ks-option-text`, so local search still matches the label alone. The row gets `.ks-option-has-detail`; the line is `.ks-option-detail`. It takes the row's colour by default, so it is as legible as the label in every state; `--ks-color-option-detail` (undeclared) softens it.

### Fixed

- **The mobile sheet's search box was not tied to the list it filters.** It now has `aria-controls` (pointing at the sheet's options area) and `aria-autocomplete="list"`, as the dropdown's search box always has.
- **Options in the mobile sheet had no listbox parent** (axe `aria-required-parent`): the `<ul>` moves into the sheet's options area, which had no role. That area is now a `role="listbox"` with `aria-multiselectable`, named by the sheet's title.
- **The mobile sheet's "No results" message could be stale on reopen** — it was set only by the sheet's own search handler, so closing after a search with no matches and reopening showed it over the full list. Both no-results messages now follow every filter pass.

---

## [1.10.0] — 2026-10-15

A release for hosts that render kselect inside a Shadow DOM or under a theme scoped to one container. Nothing changes for a page that sets none of this: the dropdown still mounts in `<body>` with fixed positioning, and the stylesheet's `:root` tokens still win as before.

### Added

- **`dropdownParent` — mount the dropdown (and the mobile sheet) somewhere other than `<body>`.** `'wrapper'` puts it inside the widget's own `.ks-wrapper`; an element, a CSS selector (resolved in the select's own root, so it may name an element inside a shadow tree) or a `function(select, wrapper)` names any other parent. A mounted dropdown carries `.ks-mounted`, is positioned absolutely against the control inside the mount (the mount is given `position: relative` if it had none; `destroy()` restores it), and follows the control when the wrapper grows instead of scrolling the page. Why: a stylesheet adopted into a shadow root cannot style a dropdown that lives in `<body>`, and custom properties set on a container never reach one — so a form that themes its fields per container, or a web component, had a dropdown in the page's default look. The trade-off, clipping by an overflow ancestor between the control and the mount, is why `<body>` stays the default.

### Fixed

- **A click on the widget's own option inside a Shadow DOM closed the dropdown as an "outside" click.** The document-level listener sees an event from inside a shadow tree retargeted to the shadow host, so `wrapper.contains(target)` was false for every click on the widget. The handler now walks the event's composed path.
- **Inside a Shadow DOM the `<label for>` was not found and the focused element was misread.** Both were looked up on `document`, where a shadow tree's elements are not visible and `activeElement` is the host. Both now use the select's own root.
- **The stylesheet's `--ks-*` defaults did not apply inside a shadow root** — they were declared on `:root`, which a shadow tree has no match for. They are now declared on `:where(:root, :host)`, so a copy of `kselect.css` adopted into a shadow root carries its tokens; the zero specificity is unchanged, so host and theme overrides still win.

---

## [1.9.0] — 2026-10-13

An accessibility release for multilingual hosts. All three changes came out of a WCAG 2.2 audit (axe-core with the `wcag22aa` tags) of a page in English, Swedish and Chinese, and each was a defect in kselect itself, not in the host's markup.

### Added

- **`lang` and `dir` are carried from `<option>` / `<optgroup>` onto the rendered widget.** A language switcher whose labels are each written in their own language marks that per option (WCAG 3.1.2, Language of Parts). kselect hides the `<select>` and re-renders every label into its own chrome, and none of that chrome carried `lang`. Screen readers read "Svenska" and "中文" in the page language's voice, and hosts had to leave such selects native. `lang` and `dir` now travel the same route as `class` and `style`: option rows, group wrappers, headers and lists, tags (control and mobile sheet), and the single-value span. An option without its own value takes its optgroup's, as it does natively, so a tag rendered outside the group still gets it. A missing attribute is actively removed, so a rebuilt element can never keep a stale value, and `refresh()` / autoSync pick up runtime edits. The `<select>`'s own `lang` is deliberately not copied: the wrapper inherits the page language as the native control does. No option is needed, and a host that never sets these attributes sees no difference.
- **Translatable accessible names: `clearText`, `closeText`, `selectAllGroupLabel`, `removeTagText`.** kselect's visible strings were already options, but four accessible names were English literals, so a Swedish page announced "Remove Ledig" mid-sentence. They are now options with the same `{…}` templates as `maxSelectText`: `removeTagText: 'Remove {label}'` and `selectAllGroupLabel: 'Select all in {group}'`, with the placeholder allowed anywhere for languages that order words differently. `{label}` is the option's plain text, never HTML, even with `allowHtml`. The defaults are exactly the old English wording, so hosts and tests that match on "Remove …" are unaffected. Where a tag or group header carries an option's `lang`, its button is marked back to the page's language, so "Remove Svenska" isn't read with a Swedish voice.
- **`Kselect.defaults`: page-wide option defaults.** An object merged under every new instance's options, so a page sets its language's strings once instead of passing them to every `init`. Precedence, highest first: per-instance options, then `data-placeholder` / `data-search-placeholder`, then `Kselect.defaults`, then the built-in defaults. It is read at construction, so set it before the first `init`.
- **`--ks-target-size` token (default `24px`).** Sets the minimum hit area of the small targets. A theme can raise it (e.g. `44px` for touch-first apps) without overriding selectors.

### Fixed

- **kselect's small buttons were smaller than WCAG 2.2's 24 × 24 px minimum (SC 2.5.8, AA).** axe's `target-size` rule failed on every tag's remove button (18 × 18, with neighbouring tags too close for the spacing exception). The clear button (18 × 18), the optgroup select-all button (20 × 20) and the search input in the control (20 px tall) were also too small. Each now has a hit area of at least `--ks-target-size`. Only the button's box grows: the icons stay the same size and in the same place. Up to a few pixels of the larger box are pulled into the surrounding padding with negative margins, so tags, group headers and the control keep their exact size. Measured before and after: tag pills stay 73 × 24, group headers stay 30 px tall, and the control's height is unchanged open and closed. The mobile sheet's close button was already 32 px and now honours the token when it is larger.
- **`searchable: false` now hides the search box.** It only stopped the input taking focus. The stylesheet still showed the search box on open, so a non-searchable single select opened with an empty search box beside its value, and the mobile sheet kept its search bar. kselect now adds `.ks-no-search` to the wrapper, the dropdown and the mobile sheet, and the stylesheet hides every search box under it. Themes can rely on the class.

### Deprecated

- **`selectAllGroupText` never did anything.** It was documented as the per-group button's accessible label, but the label was hard-coded to `'Select all in ' + group`. Use `selectAllGroupLabel`. The option is still accepted, so existing configurations don't break.

---

## [1.8.0] — 2026-09-05

### Added

- **`revealSelection` option (default `true`): the dropdown opens at the current selection.** On a list longer than `maxHeight`, the dropdown opened at the top and the selected option could be hundreds of pixels below the fold — the user could not see what the field was set to at the moment they were deciding whether to change it, and scrolling to find it lost their place with no landmark to come back to. The list now opens already scrolled so the selected option (the first selected one in multi mode) is centred in the dropdown. The scroll offset is applied synchronously inside `open()`, after positioning and before the browser paints, so the dropdown *starts* at the selection rather than opening at the top and visibly scrolling. A selection that is already visible is left where it is. Nothing selected, an active search, or a selection inside a collapsed group opens at the top as before — a collapsed group is deliberately not expanded, since a consumer that collapses groups owns that decision. The same applies to the mobile bottom sheet. Set `revealSelection: false` to always open at the top.

### Changed

- **Keyboard focus starts on the selected option.** With the list opened at the selection, the first `↓` previously focused the *first* option and scrolled straight back to the top. `open()` now seeds `ks-option-focused` and `aria-activedescendant` on the selected row (when it is enabled and reachable), so arrow keys continue from the current value, as they do on a native `<select>`. Arrow handling itself is unchanged.
- The one thing this can break in a consumer is a browser test asserting `scrollTop === 0` on the dropdown after open; such tests should pass `revealSelection: false` or assert the selected row is visible instead.

---

## [1.7.0] — 2026-08-08

A host-integration release. Everything here came out of an audit of what a kselect widget actually looks and behaves like when it is embedded in a form framework that generates its own markup — the cases where kselect gave a host no supported way to do something ordinary, so hosts hand-rolled shims that reach into kselect's internals.

### Added

- **CSP-safe per-row colours via `data-ks-color` and `data-ks-group-color`.** Carrying a data-derived colour onto an option row previously required `style="--chip-color: …"` on the source `<option>` — and a `style` *attribute* is blocked outright by a strict `style-src 'self'`, with no escape hatch: a CSP nonce whitelists `<style>` *elements*, never style attributes. Setting `data-ks-color` (on an `<option>` or `<optgroup>`) or `data-ks-group-color` (on an `<optgroup>`) now applies `--chip-color` / `--group-color` via `element.style.setProperty()`, a CSSOM write that CSP does not govern, and adds a `ks-coloured` class so stylesheets can target coloured rows directly instead of using a brittle `[style*="--chip-color"]` attribute selector. Applied everywhere the existing `class`/`style` carry-through is: option rows, group wrappers/headers/lists, tags, the single-value span, and the mobile-sheet tags. The `style` route is unchanged and the two compose.
- **`copyClassName` option (default `true`).** kselect copies the source `<select>`'s class onto the wrapper `<div>`, which is what keeps sizing and layout utility classes working. But when that class is a form framework's field class — Bootstrap's `.form-select` / `.form-control`, or any class that sets border, padding, radius or background — the wrapper paints a second box around the already-bordered `.ks-control`, roughly doubling the control's height. Set `copyClassName: false` to leave the class on the native element only. The default is unchanged behaviour. Note that `false` also switches off the class *mirroring* added below — they are the same mechanism — so a host that toggles state classes (`is-invalid`, `is-dirty`) on the `<select>` should apply them to the wrapper itself. ARIA mirroring is unaffected either way.
- **`Kselect.destroyAll(root)`.** Destroys every instance inside `root` (default: the document) and returns the count. Tearing down a subtree with `innerHTML = ''` previously leaked, per widget, a body-level `.ks-dropdown` plus the instance's capturing scroll listener, resize/click/visualViewport listeners and two observers — because `destroy()` never ran.
- **First-letter type-ahead on a closed single select.** Typing a letter or digit while a closed single-mode control has focus jumps to the first option starting with it, matching a native `<select>`. Repeating the same key cycles through the matches; typing several different characters within a second matches the whole prefix. Disabled options are skipped, matching is case-insensitive, and each jump fires `input`, `change` and `kselect:change`. `Space` still opens the dropdown, and multi mode is unaffected. Completes the closed-control keyboard parity started by 1.6.0's arrow stepping.
- **`aria-describedby`, `aria-invalid` and `aria-required` are mirrored from the `<select>` onto `.ks-control`.** The source select is `display: none`, so help text, validation messages and required/invalid state wired to it by a form framework were stranded on an element no assistive technology could reach. `.ks-control` already carries `role="combobox"`, on which all three are valid. The native `required` attribute maps to `aria-required="true"` when no explicit `aria-required` is present. Re-mirrored on every `refresh()`, so the widget follows validation state as it changes.
- **Clicking a field's `<label>` now focuses the control.** The label's `for` still points at the hidden `<select>`, so clicking it focused nothing, where a native control would take focus. Clicks on interactive elements nested inside the label are left alone, and the listener is removed on `destroy()`.

### Changed

- **The CSS custom-property defaults are declared inside `:where(:root)` instead of `:root`.** At `:root`, a host that also declares `--ks-*` tokens on `:root` only won if its stylesheet happened to load *after* `kselect.css` — an order many hosts do not control, so themes silently lost to kselect's defaults and widgets rendered light-on-dark. `:where()` gives the defaults zero specificity, so any host or theme declaration wins regardless of order. This cannot regress an existing override: nothing anyone overrides with today is less specific than what they already have. It does raise the stylesheet's browser floor to Chrome 88 / Firefox 78 / Safari 14 (2021) — a browser without `:where()` support drops the defaults block entirely. The bundled themes are unchanged.
- **`refresh()` now re-reads the `<select>`'s runtime state, not just its options.** It rebuilt the option list and re-synced the value, but re-read neither `disabled` nor `class` — so a host doing the ordinary thing (`select.disabled = true` for a locked field, `select.classList.add('is-invalid')` after failed validation) saw nothing happen to the widget. The hook already existed: with the default `autoSync: true`, the MutationObserver watches `attributes` and calls `refresh()` on exactly these mutations. `refresh()` now routes `disabled` through the existing `enable()` / `disable()` and diffs the copied class onto the wrapper. The diff is deliberate rather than a wholesale rebuild — it preserves the runtime classes kselect owns (`ks-open`, `ks-dropup`, `ks-at-limit`) across a refresh taken while the dropdown is open.

---

## [1.6.0] — 2026-07-10

### Added

- **Closed-dropdown arrow-key selection in single mode, mirroring a closed native `<select>`.** When a single-mode kselect has focus and the dropdown is closed, `ArrowDown`/`ArrowUp` now step the selection to the next/previous enabled option — without opening the dropdown — starting from the currently selected option (or from the top/bottom of the list when nothing is selected). Disabled options are skipped and stepping stops at the list edges rather than wrapping, matching the native control. Each step fires the usual `input`, `change`, and `kselect:change` events. `Alt+Arrow` opens the dropdown (as native does), and `Enter`/`Space` still open it. In multi mode — which has no native "step" concept — both `ArrowDown` and `ArrowUp` open the dropdown (`ArrowUp` previously did nothing while closed).

### Fixed

- **Keyboard interaction no longer dies after a selection closes the dropdown.** Closing the desktop dropdown hides the search input; if it held focus (the default while the dropdown is open), the browser dropped focus to `<body>`, so further key presses went nowhere. `close()` now hands focus back to the control whenever focus was inside the dropdown or on the search input — so after picking an option with Enter (or a click) you can immediately keep arrowing through options on the closed control.
- **Mouse interaction inside the dropdown no longer steals focus.** Options are non-focusable `<li>`s, so the browser's `mousedown` default blurred the search input to `<body>` *before* the click handler ran — a click-select then closed the dropdown with focus already gone (so arrow keys went dead), and in multi mode every option click knocked focus out of the search input. The dropdown now cancels the `mousedown` default (the standard combobox pattern), keeping focus on the search input / control throughout; exemptions preserve click-to-focus on the in-dropdown search input (`selectAll` row layout) and scrollbar dragging in Firefox.

---

## [1.5.4] — 2026-07-10

### Fixed

- **Arrow-key navigation moved focus two options per keypress.** The search input lives inside the control element, and both had `keydown` listeners calling the same handler — so a key pressed while the search input was focused (the default after opening) was handled once by the input's listener and a second time when the event bubbled up to the control's. Every `ArrowDown`/`ArrowUp` skipped an option, and `Enter` in multi mode could toggle an option on and instantly off again. The control's listener now ignores events that originate from the search input. (The one configuration that *didn't* exhibit the bug was multi mode with `selectAll: true`, where the search input is relocated into the dropdown and the event never bubbled to the control.)

---

## [1.5.3] — 2026-07-10

### Fixed

- **The native `input` event is now dispatched (immediately before `change`) whenever the selection changes.** A native `<select>` fires `input` followed by `change` on every user selection, but kselect previously only fired `change` — so host code and form frameworks that bind to `input` (a common pattern, since `input` is the spec-recommended "value changed" event) never saw kselect-driven changes. `input` now fires from every path that fires `change`: option selection, tag removal, select-all, per-group select-all, `clear()`, and `setValue()`. Like all kselect-dispatched events, it is tagged with `event.kselect === true` (`e.originalEvent.kselect` from jQuery) so it can be distinguished from user-driven native events.

---

## [1.5.2] — 2026-07-02

### Fixed

- **Initialising the same `<select>` twice no longer stacks a second widget.** `Kselect.init()` (and a direct `new Kselect()`) now returns the *existing* instance when the element already has a live kselect attached, instead of building a second wrapper/dropdown on top of the first and hiding the select again. The old behaviour orphaned the first instance's DOM and event bindings — a common cause of a `change` / `kselect:change` handler appearing to "stop firing" when a modal (or other re-entrant UI) ran `init` again on every open. Re-init after `destroy()` still builds a fresh instance, and a cloned node carrying a stale `data-kselect-id` also initialises cleanly. To reconfigure an existing instance with new options, call `destroy()` first, then `init()`; or reuse the current one via `Kselect.getInstance(el)`.

---

## [1.5.1] — 2026-06-30

### Fixed

- **Mobile bottom-sheet drag could scroll the page (or host iframe) away on iOS.** Dragging a finger that started on an *option* inside the bottom-sheet modal scrolled the underlying document instead of the options list — and on iPhone inside an iframe this carried the whole sheet off-screen with no way to scroll back. It happened specifically when the options list was **not scrollable** (few enough options to fit), so the gesture had nothing to consume and chained out. Two compounding causes are fixed:
  1. The scroll-lock relied on `overflow: hidden` / `touch-action: none` on `<body>`, both of which iOS Safari ignores for touch scrolling. The body is now genuinely pinned with `position: fixed` (offset by the saved scroll position so the page doesn't jump) while the sheet is open, and the previous scroll position is restored on close (and on `destroy()` if torn down while open).
  2. `position: fixed` on `<body>` only governs *this* frame — it cannot stop a touch gesture from propagating to a **parent** frame, which is what carried the sheet off-screen inside an iframe. A non-passive `touchmove` handler on the sheet now calls `preventDefault()` whenever the options list can't scroll in the drag direction (not scrollable at all, or already at the top/bottom edge), consuming the gesture so it never chains or propagates. Mid-list drags are untouched and scroll normally.

### Added

- `Kselect.version` (string) and a `<!-- kselect.js v… -->` HTML comment inside the mobile sheet overlay, so a cached build is easy to spot via *Inspect Element*.

---

## [1.5.0] — 2026-06-22

### Added

- **iframe-aware mobile bottom-sheet positioning.** When a kselect lives inside an iframe that is rendered taller than the parent window (e.g. a tall form in a full-bleed iframe on a phone), opening the mobile modal previously showed only the dark backdrop — the sheet itself was pinned to the bottom of the iframe's oversized layout viewport, far below the fold. The plugin now detects iframe context (`window.self !== window.top`) and, while in an iframe, tracks the slice of the iframe that is *actually visible* to the user with an `IntersectionObserver` (its implicit root is the top-level viewport, so the intersection is clipped across frame boundaries — including cross-origin ones). The mobile overlay is positioned to that visible slice, so the sheet pins to the bottom of the user's screen rather than the bottom of the iframe. Works with **no cooperation from the parent page** (no `postMessage`); same-origin parents additionally get a synchronous first-paint computation so the first open never flashes off-screen. Desktop dropdown positioning is unchanged.

  *Known limitation:* the modal cannot lock the parent page's scroll without parent cooperation, so if the user scrolls the parent page while the sheet is open, the sheet re-pins via the (throttled) IntersectionObserver callback and may lag slightly during an active scroll.

---

## [1.4.4] — 2026-05-22

### Fixed

- On mobile, the bottom-sheet modal could open taller than the visible viewport — pushing the header (and the × close button) above the top edge of the screen — when opened with the browser URL bar visible (typically at the top of a page, before any scroll). The sheet's `max-height` declarations were ordered `92dvh` then `92vh` with the latter labelled as a fallback, but CSS source-order means the second declaration wins wherever both are supported, so `92vh` was always the value used — `dvh` was dead. `vh` is fixed to the large viewport (URL-bar-collapsed size), so when the URL bar was actually visible the sheet was sized larger than the visible area. The order is now `92vh` (fallback) then `92dvh`, so modern browsers use the dynamic viewport and the sheet shrinks/grows in sync with the URL bar state.

---

## [1.4.3] — 2026-05-22

### Fixed

- The mobile bottom-sheet modal no longer opens pre-scrolled to the bottom of the options list when there are many options. The scrollable options wrap was using `justify-content: flex-end` to anchor sparse lists near the search bar; for lists tall enough to overflow, that flex anchoring also caused the initial scroll position to sit at the end of the content. The anchoring is now done with `margin-top: auto` on the `<ul>` instead — short lists still sit near the search bar, and long lists scroll from the top as expected.

---

## [1.4.2] — 2026-05-22

### Fixed

- An `<option>` with empty text (e.g. `<option value="">`) used as a blank/placeholder row no longer renders shorter than its neighbours. The `.ks-option-text` span collapses to a zero-height line box when its content is empty, so the row's height shrank to just the vertical padding. A `::before` pseudo-element with a non-breaking space now preserves the line box for empty labels, keeping the row at the same height as the rest. Search matching is unaffected (it reads `option.text`, not the rendered DOM).

---

## [1.4.1] — 2026-05-22

### Fixed

- The global "Select all" row no longer shows the option-hover background when the mouse passes over it. The row carries the `ks-option` class (so it can be reached by arrow-key navigation), which meant the `.ks-option:hover` styling fired across the whole row — including the search input when `selectAll` is enabled (search-in-row mode). The row itself has `cursor: default` (only the trigger is clickable), so the highlight was misleading. Mouse hover now leaves the row unstyled; keyboard focus (`.ks-option-focused`) still highlights it as before.

---

## [1.4.0] — 2026-05-20

### Added

- New `showEmptyOptGroups` option (default `true`) controls whether empty `<optgroup>` headers (groups with no `<option>` children) appear in the dropdown. When `true`, the header is always shown; when `false`, the optgroup is omitted entirely.

### Fixed

- Empty `<optgroup>` headers no longer disappear after the first time the dropdown is opened. Previously the post-close filter reset would mark groups with no visible children as hidden, so an empty optgroup was visible on first open but hidden on every subsequent open until the page reloaded.

---

## [1.3.6] — 2026-05-19

### Fixed

- The checkbox tick in multi-select dropdowns no longer follows `--ks-color-option-hover-text` on hover. Previously the inner `<path stroke="currentColor">` inherited the option row's `color`, so setting a hover text colour (e.g. white) made the tick disappear against the pale checkbox background. The checkbox now sets its own `color`, anchored to a new `--ks-color-checkbox-tick` variable, so the tick stays readable regardless of option text colour.

### Added

- New `--ks-color-checkbox-tick` CSS custom property controls the colour of the checkmark glyph inside multi-select checkboxes (and the dash glyph used for the indeterminate state on per-group "Select all" rows). Defaults to `var(--ks-color-option-selected-fg)` so existing rendering is unchanged; set it explicitly to give the tick a distinct colour.

---

## [1.3.5] — 2026-05-19

### Fixed

- Hovering a selected row in the dropdown now applies the hover background (`--ks-color-option-hover`) as well as the hover text colour (`--ks-color-option-hover-text`), instead of keeping the selected-row background while only changing the text. Hover styling is consistent across selected and non-selected rows. Themes that set `--ks-color-option-selected-row` to a colour distinct from `--ks-color-option-hover` will see selected rows take the hover colour while hovered, then return to the selected colour when the pointer moves away.

---

## [1.3.4] — 2026-05-19

### Added

- New `--ks-color-option-hover-text` CSS custom property controls the text colour of dropdown rows on hover and keyboard focus. Undeclared by default so existing rendering is unchanged (the underlying selected-row text colours still apply on hover); set it in a theme and the chosen colour wins in every state — single, multi, selected, unselected.

---

## [1.3.3] — 2026-05-18

### Fixed

- Restored the multi-mode indigo text tint on selected rows in the dropdown. The previous `.ks-multiple .ks-option.ks-option-selected` rule was a no-op because the dropdown (and mobile overlay) are appended to `<body>`, and `.ks-multiple` was only set on the wrapper — so the descendant selector never reached the option. The dropdown and mobile overlay now also carry `.ks-single` / `.ks-multiple`, matching the wrapper, and the rule reaches them as intended.

### Changed

- `--ks-color-option-selected-row-text` is no longer declared on `:root`. Its default is now provided via `var()` fallback at each use site: `inherit` in single mode, `var(--ks-color-option-selected-fg)` in multi mode. Setting the variable in a theme still overrides both modes. (This makes multi-mode's restored indigo default themable by a single variable, rather than forcing themers to also override `.ks-multiple .ks-option.ks-option-selected` directly.)

---

## [1.3.2] — 2026-05-18

### Added

- New `--ks-color-option-selected-row-text` CSS custom property controls the text colour of selected options in the dropdown. Defaults to `inherit` (so the text colour matches surrounding option text as before); set it explicitly to give selected rows a distinct text colour.

---

## [1.3.1] — 2026-05-18

### Added

- New `--ks-color-option-selected-row` CSS custom property controls the row-background colour of selected options in the dropdown, independently of the hover/keyboard-focus colour (`--ks-color-option-hover`). Defaults to `var(--ks-color-option-hover)` so existing themes are unchanged; set it explicitly to give selected rows a distinct colour.

---

## [1.3.0] — 2026-05-16

### Changed

- **`allowHtml` now defaults to `false`** (previously `true`). Tag characters in option text are shown literally by default, which is safer when option content may come from user input or other untrusted sources. **Migration:** if you were relying on the previous default to render markup, pass `allowHtml: true` explicitly when initialising — only do so when the option text is trusted.

### Fixed

- Global "Select all" and per-optgroup "Select all" now operate only on the currently visible (filter-matching) options when a search query is active. Previously they would silently toggle hidden options too. The checked / indeterminate visual state of each select-all row also tracks the visible scope while a filter is in effect.
- Search now matches only against option text. Previously a query that matched an optgroup's label would reveal *all* of that group's options regardless of their own text. Optgroups still appear in results — but only when at least one of their child options matches.

---

## [1.2.0] — 2026-05-11

### Added

- `class` and `style` attributes on the source `<option>` and `<optgroup>` are now propagated onto the rendered chrome — option `<li>`s, group `<li>`/header/options-list, and selected-state tags (multi) / single-value span (single). Lets consumers attach per-row styling hooks (e.g. `style="--chip-color: #b53f5c"` for DB-derived colours, or `class="is-recommended"` for enumerable states) directly on the source select markup and have them surface on the widget. Classes are appended to the framework's own classes (`ks-option`, `ks-tag`, etc.) rather than replacing them, so existing styling continues to work unchanged.
- `summarizeSelected: false` is now accepted as an alias for `'off'` — useful for callers that prefer a boolean disable.

### Changed

- (none)

---

## [1.1.0] — 2026-05-03

### Added

- Summarize Selected feature - shows "{n} selected" instead of the individual selections, and can be configured. Default is set to `auto` (which shows "{n} selected" if the selected items list would wrap to a second line.

### Added

- `autoSync` option (default `true`) — the widget now watches the underlying `<select>` for external mutations (options added/removed, attribute changes, label edits, programmatic `value` assignment followed by a `change` event) and stays in sync automatically. Manual `refresh()` and `kselect:sync` calls are no longer required for these cases. Set `autoSync: false` to opt out.
- All events dispatched by kselect (`change`, `kselect:change`, `kselect:open`, `kselect:close`) now carry an `event.kselect === true` flag so listeners can distinguish kselect-originated events from external mutations of the underlying `<select>`.

### Changed

- Selected options in the dropdown now carry the same row-background highlight used for hover, in both single- and multi-select modes. Previously single-mode selection was a loud solid-indigo / white-text pill, and multi-mode selection had no row background at all (only a tinted text colour) making selected items hard to spot at a glance.

### Fixed

- Dropdown now resizes to match the control when the wrapper's width changes while open (e.g. selected-tag pills pushing the control wider in a flex/grid layout).
- Active search filter is preserved across `refresh()` and `kselect:sync` so the visible-option list no longer resets when a host framework triggers a rebuild mid-search.


---

## [1.0.0] — 2026-04-30

Initial public release.

### Features

- Single and multi select modes, auto-detected from the `<select>` element
- Live search filtering with optgroup auto-expand on match
- Tag-style multi select — selected values as removable inline pills
- Checkbox indicators in the dropdown for multi select mode
- `<optgroup>` support with collapsible headers and per-group select-all controls
- Global "select all" row for multi select mode (`selectAll` option)
- Selection limit — cap how many items can be selected (`maxSelect` option)
- HTML option labels — render markup inside option labels (`allowHtml` option)
- Mobile bottom-sheet modal — full-screen sheet on phones instead of a dropdown (`mobileModal` option)
- Native OS picker fallback on touch devices (`nativeOnMobile` option)
- Fires native `change` event on the underlying `<select>` on every selection change
- Custom events: `kselect:change`, `kselect:open`, `kselect:close`
- `kselect:sync` event — dispatch on the `<select>` to force the widget to re-read the DOM
- Full keyboard navigation — Arrow keys, Enter, Escape, Tab
- WCAG 2.1 AA accessibility — full ARIA attributes, `aria-live` announcements, `:focus-visible` outlines, contrast-checked defaults
- Visual-viewport-aware dropdown positioning — stays anchored on iOS Safari when the keyboard appears
- ResizeObserver-based scroll compensation — keeps the dropdown flush with the control as multi-select tags wrap to new lines
- Automatic dropup when the dropdown would overflow the bottom of the viewport
- Instance API: `getValue()`, `setValue()`, `clear()`, `enable()`, `disable()`, `open()`, `close()`, `refresh()`, `destroy()`
- `Kselect.init(selector, options)` — initialise one or many selects; always returns an array
- `Kselect.getInstance(el)` — retrieve an existing instance from an element
- Full theming via ~40 CSS custom properties — no stylesheet edits required
- 20 ready-made themes in `themes/`
- Minified distribution files: `kselect.min.js`, `kselect.min.css`
- CommonJS module support alongside browser global
- Zero dependencies
