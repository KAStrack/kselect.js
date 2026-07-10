# Changelog

All notable changes to kselect.js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
