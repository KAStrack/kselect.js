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

// Force a rebuild after external DOM changes
selectEl.innerHTML = newOptionsHtml;
selectEl.dispatchEvent(new Event('kselect:sync'));
```

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
