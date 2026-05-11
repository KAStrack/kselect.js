# Changelog

All notable changes to kselect.js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-05-03

### Added

- Summarize Selected feature - shows "{n} selected" instead of the individual selections, and can be configured. Default is set to `auto` (which shows "{n} selected" if the selected items list would wrap to a second line.

### Fixed

- Dropdown now resizes to match the control when the wrapper's width changes while open (e.g. selected-tag pills pushing the control wider in a flex/grid layout).


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
