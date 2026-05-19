# Changelog

All notable changes to kselect.js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
