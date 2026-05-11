# kselect.js

A modern, accessible select replacement - single file, no dependencies.

Demo at https://kastrack.github.io/kselect.js/

kselect.js progressively enhances native `<select>` elements with live search, multi-select tags, collapsible optgroups, selection limits, HTML option labels, and a mobile bottom-sheet modal. It writes all changes back to the original `<select>`, so it works seamlessly with any form or framework.

---

## Features

- **Searchable** - live filtering as you type; optgroups auto-expand on match
- **Single & multi select** - both modes supported, auto-detected from the `<select>` element
- **Tag-style multi select** - selected values appear as removable inline pills
- **Checkbox list** - dropdown items show checkboxes in multi-select mode
- **Collapsible optgroups** - click a group header to collapse or expand it
- **Select all** - global and per-group "select all" controls in multi-select mode
- **Selection limit** - cap how many items can be selected with `maxSelect`
- **HTML option labels** - render rich markup inside option labels with `allowHtml`
- **Mobile bottom-sheet** - on phones, opens a full-screen bottom-sheet modal instead of a dropdown
- **Native picker fallback** - optionally use the OS picker on touch devices with `nativeOnMobile`
- **Syncs the native `<select>`** - all selections are reflected back to the real element
- **Native `change` event** - fires on the original `<select>` so existing listeners and frameworks work without changes
- **Custom events** - `kselect:change`, `kselect:open`, `kselect:close`
- **Keyboard accessible** - Arrow keys, Enter, Escape, and Tab navigation fully supported
- **Screen reader friendly** - WCAG 2.1 AA compliant with full ARIA attributes
- **Themeable** - ~40 CSS custom properties; 20 ready-made themes included
- **Lightweight** - single `.js` + single `.css`, minified versions included, zero dependencies

---

## Installation

Download `kselect.min.js` and `kselect.min.css` (or the unminified versions) and add them to your page:

```html
<link rel="stylesheet" href="kselect.min.css">
<script src="kselect.min.js"></script>
```

kselect.js also supports CommonJS:

```js
const Kselect = require('./kselect.js');
```

---

## Quick Start

```html
<select id="my-select">
  <option value="js">JavaScript</option>
  <option value="py">Python</option>
  <option value="go">Go</option>
</select>

<script>
  const [ks] = Kselect.init('#my-select');
</script>
```

That's it. kselect hides the original `<select>` and inserts its own widget immediately after it. Your form submission, validation, and any existing event listeners continue to work unchanged.

---

## Usage

### Initialise one element

```js
const [ks] = Kselect.init('#my-select');
// or:
const ks = Kselect.init('#my-select')[0];
```

### Initialise multiple elements at once

```js
const all = Kselect.init('select');
const all = Kselect.init('.my-selects');
```

`Kselect.init` always returns an array of instances. Use `[0]` or destructuring to get a single instance.

### Retrieve an existing instance

```js
const ks = Kselect.getInstance(document.getElementById('my-select'));
```

---

## Options

```js
Kselect.init('#my-select', {
  placeholder:       'Choose an option…',
  searchPlaceholder: 'Search…',
  noResultsText:     'No results found',
  maxHeight:         300,
  searchable:        true,
  allowClear:        true,
  closeOnSelect:     true,
  collapseGroups:    false,
  selectAll:         false,
  selectAllText:     'Select all',
  selectAllGroups:   false,
  nativeOnMobile:    false,
  mobileModal:       true,
  maxSelect:         null,
  maxSelectText:     'Max {n} items',
  allowHtml:         true,
});
```

Options can also be set via `data-` attributes on the `<select>` element:

```html
<select data-placeholder="Pick a country…" data-max-height="400">…</select>
```

### Full options reference

| Option | Type | Default | Description |
|---|---|---|---|
| `placeholder` | string | `'Select an option…'` | Text shown when nothing is selected |
| `searchPlaceholder` | string | `'Search…'` | Placeholder inside the search input |
| `noResultsText` | string | `'No results found'` | Shown when search returns nothing |
| `maxHeight` | number | `300` | Maximum height of the dropdown in px |
| `searchable` | boolean | `true` | Show or hide the search input |
| `allowClear` | boolean | `true` | Show a clear (×) button |
| `closeOnSelect` | boolean | `true` | Close after picking in single mode |
| `collapseGroups` | boolean | `false` | Start optgroups collapsed |
| `selectAll` | boolean | `false` | Show a global "Select all" row (multi only) |
| `selectAllText` | string | `'Select all'` | Label for the global select-all row |
| `selectAllGroups` | boolean | `false` | Show a select-all checkbox in each optgroup header (multi only) |
| `selectAllGroupText` | string | `'Select all'` | Accessible label for per-group select-all buttons |
| `nativeOnMobile` | boolean | `false` | Use the native OS picker on coarse-pointer (touch) devices |
| `mobileModal` | boolean | `true` | Show a bottom-sheet modal on phones instead of a dropdown |
| `maxSelect` | number\|null | `null` | Maximum items selectable (multi only; `null` = unlimited) |
| `maxSelectText` | string | `'Max {n} items'` | Notice text when the selection limit is reached; `{n}` = the limit |
| `allowHtml` | boolean | `true` | Render HTML markup in option labels (see below) |
| `summarizeSelected` | `'auto'`\|`'off'`\|`false`\|number | `'auto'` | Multi only. `'auto'` = collapse to a "{n} selected" summary when tags would wrap to a second line; `'off'` or `false` = always show all tags; number `n` = collapse when count exceeds `n` |
| `summarizeSelectedText` | string | `'{n} selected'` | Template for the collapsed-summary text; `{n}` = the count of selected items |
| `autoSync` | boolean | `true` | Watch the underlying `<select>` for external mutations and re-render automatically. Set `false` to manage syncing yourself via `refresh()` / `kselect:sync` |

---

## Instance API

| Method | Description |
|---|---|
| `getValue()` | Returns the current value - string (single) or string array (multi) |
| `setValue(v)` | Set selection by value string or array; fires `change` |
| `clear()` | Deselect all; fires `change` |
| `open()` | Open the dropdown |
| `close()` | Close the dropdown |
| `enable()` | Enable the control |
| `disable()` | Disable the control |
| `refresh()` | Rebuild option list from the native `<select>` DOM |
| `destroy()` | Remove the widget and restore the original `<select>` |

---

## Events

kselect fires events on the original `<select>` element.

| Event | When |
|---|---|
| `change` | A selection changes (native event) |
| `kselect:change` | A selection changes (custom event) |
| `kselect:open` | The dropdown opens |
| `kselect:close` | The dropdown closes |
| `kselect:sync` | **Dispatch this** to force kselect to re-read the `<select>` DOM |

```js
const selectEl = document.getElementById('my-select');

selectEl.addEventListener('change', () => {
  console.log('Value:', ks.getValue());
});
```

Every event kselect dispatches itself carries an `event.kselect === true` flag, so listeners can tell its events apart from external mutations of the same `<select>`:

```js
selectEl.addEventListener('change', (e) => {
  if (e.kselect) return; // ignore kselect's own changes
  // …handle external change
});
```

### Auto-sync with the underlying `<select>`

With the default `autoSync: true`, kselect watches the underlying `<select>` for external mutations (options added/removed, attribute or label edits, programmatic `value` assignment) and re-renders automatically — you do not need to call `refresh()` or dispatch `kselect:sync` after typical updates:

```js
// Add an option after init — kselect picks it up on its own
const opt = document.createElement('option');
opt.text = 'Rust';
selectEl.appendChild(opt);

// Set the value programmatically — kselect picks it up too, provided the change
// is dispatched as a native event
selectEl.value = 'ts';
selectEl.dispatchEvent(new Event('change'));
```

`refresh()` and `kselect:sync` are still available for `autoSync: false` setups and for forcing an immediate resync.

### jQuery `.trigger("change")` caveat

jQuery's `.trigger("change")` does **not** dispatch a real DOM event — it walks jQuery's own handler queue and stops there. Native `addEventListener('change', …)` listeners (including kselect's auto-sync hook) are never called. Combined with jQuery's `.val(…)` and `.prop('selected', …)` — which mutate the `selected` IDL property, not the attribute, so a `MutationObserver` does not see them either — this means kselect can miss programmatic updates made entirely through jQuery.

If you are driving the `<select>` from jQuery, either dispatch a native event after the mutation, or call `refresh()` directly:

```js
$('#my-select').val('ts');
document.getElementById('my-select')
        .dispatchEvent(new Event('change'));   // native — kselect picks it up

// or
$('#my-select').val('ts');
ks.refresh();
```

---

## Per-row styling via `class` and `style`

Set `class` or `style` on any `<option>` or `<optgroup>` and kselect carries the attributes onto the rendered chrome — option rows, group wrappers/headers/lists, and selected-state tags (or the single-value span in single mode). This is the recommended way to attach per-row styling hooks without writing post-render mutation code.

Use `style` for values that vary per row and come from your data (DB-derived colours, count badges, dates) — `style="--chip-color: …"` is the idiomatic carrier, with project CSS reading `var(--chip-color)`. Use `class` for *enumerable* states known when the CSS is written (`is-premium`, `is-deprecated`).

```html
<select multiple>
  <optgroup label="Rock" style="--group-color: #b53f5c">
    <option value="rock" style="--chip-color: #b53f5c">Rock</option>
    <option value="punk" style="--chip-color: #d44a2a" class="is-recommended">Punk Rock</option>
  </optgroup>
  <optgroup label="Jazz" style="--group-color: #5a4cb5">
    <option value="jazz" style="--chip-color: #5a4cb5">Jazz</option>
  </optgroup>
</select>
```

```css
.ks-tag,
.ks-option {
  --chip-color: currentColor;
}
.ks-tag {
  background:   color-mix(in srgb, var(--chip-color) 18%, transparent);
  color:        var(--chip-color);
  border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
}
.ks-option { border-left: 3px solid var(--chip-color); }

.ks-group-header { color: var(--group-color); }

.ks-option.is-recommended { font-weight: 700; }
.ks-option.is-deprecated  { opacity: 0.5; text-decoration: line-through; }
```

Framework classes (`ks-option`, `ks-tag`, `ks-group-header`, …) are preserved — your classes are appended, not substituted. The carry-through does not apply in `nativeOnMobile: true` mode (the OS owns the native picker).

---

## Optgroups

kselect renders `<optgroup>` elements with collapsible headers. Groups auto-expand when a search query matches options within them.

```html
<select id="languages" multiple>
  <optgroup label="Frontend">
    <option value="js">JavaScript</option>
    <option value="ts">TypeScript</option>
  </optgroup>
  <optgroup label="Backend">
    <option value="go">Go</option>
    <option value="rust">Rust</option>
  </optgroup>
</select>
```

---

## Selection Limit

```js
Kselect.init('#toppings', {
  maxSelect:     3,
  maxSelectText: 'Max {n} toppings',
});
```

When the limit is reached, unselected options dim, an amber badge appears in the control, and a notice banner appears at the top of the dropdown.

---

## HTML Option Labels

With `allowHtml: true` (the default), escape your HTML as entities in the option text - kselect decodes and renders it:

```html
<option value="bold">&lt;strong&gt;Bold&lt;/strong&gt;</option>
<option value="status">Server &lt;span style="color:green"&gt;● online&lt;/span&gt;</option>
```

Set `allowHtml: false` to display tag characters literally - useful when content comes from untrusted sources.

---

## Mobile

On phones (coarse-pointer, ≤ 640 px wide), kselect opens a full-screen bottom-sheet modal by default. Disable with `mobileModal: false`.

For a full native OS picker fallback on all touch devices, use `nativeOnMobile: true`. The complete instance API still works in this mode.

---

## Theming

Override CSS custom properties on `.ks-wrapper`, a parent element, or `:root`:

```css
.my-theme {
  --ks-color-border-focus:       #10b981;
  --ks-color-option-selected:    #10b981;
  --ks-color-option-selected-bg: #ecfdf5;
  --ks-color-tag-bg:             #ecfdf5;
  --ks-color-tag-text:           #059669;
  --ks-color-checkbox-checked:   #10b981;
}
```

20 ready-made themes are included in the `themes/` directory.

---

## Accessibility

WCAG 2.1 AA compliant - `role="combobox"`, full ARIA labelling, `aria-live` announcements, `:focus-visible` outlines on all interactive elements, and contrast-checked default colours.

---

## Browser Support

Chrome / Edge 80+, Firefox 75+, Safari 13+, iOS Safari 13+, Chrome for Android. Internet Explorer is not supported.

---

## Contributing

Issues and pull requests are welcome. Please open an issue before starting significant work so we can discuss the approach.

---

## License

MIT - see [LICENSE](LICENSE) for details.
