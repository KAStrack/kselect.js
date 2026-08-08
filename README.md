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
- **HTML option labels** - opt in with `allowHtml: true` to render rich markup inside option labels
- **Mobile bottom-sheet** - on phones, opens a full-screen bottom-sheet modal instead of a dropdown
- **Native picker fallback** - optionally use the OS picker on touch devices with `nativeOnMobile`
- **Syncs the native `<select>`** - all selections are reflected back to the real element
- **Native `change` event** - fires on the original `<select>` so existing listeners and frameworks work without changes
- **Custom events** - `kselect:change`, `kselect:open`, `kselect:close`
- **Keyboard accessible** - Arrow keys, Enter, Escape, and Tab navigation fully supported, plus native-style arrow stepping and first-letter type-ahead on a closed single select
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

`init` is idempotent per element: calling it again on a `<select>` that already has a kselect attached returns the **existing** instance rather than building a second widget on top of the first. If you initialise inside re-entrant UI (e.g. a modal that runs `init` every time it opens), this is safe — but if you want to reconfigure with new options, call `destroy()` first, then `init()` again. To reuse the current instance, prefer `Kselect.getInstance(el)`.

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
  allowHtml:         false,
  showEmptyOptGroups: true,
  copyClassName:     true,
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
| `allowHtml` | boolean | `false` | Render HTML markup in option labels (see below). Off by default — opt in only when option text is trusted |
| `summarizeSelected` | `'auto'`\|`'off'`\|`false`\|number | `'auto'` | Multi only. `'auto'` = collapse to a "{n} selected" summary when tags would wrap to a second line; `'off'` or `false` = always show all tags; number `n` = collapse when count exceeds `n` |
| `summarizeSelectedText` | string | `'{n} selected'` | Template for the collapsed-summary text; `{n}` = the count of selected items |
| `autoSync` | boolean | `true` | Watch the underlying `<select>` for external mutations and re-render automatically. Set `false` to manage syncing yourself via `refresh()` / `kselect:sync` |
| `showEmptyOptGroups` | boolean | `true` | Whether empty `<optgroup>` headers (groups with no `<option>` children) appear in the dropdown. `true` always shows the header; `false` omits the optgroup entirely |
| `copyClassName` | boolean | `true` | Copy the source `<select>`'s `class` onto the wrapper `<div>`. Set `false` when that class styles the *native* control. Also disables class *mirroring* on `refresh()` — see [Form-framework classes](#form-framework-classes-on-the-select) |

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
| `refresh()` | Rebuild the option list from the native `<select>` DOM, and re-read its `disabled` state, `class`, and validation ARIA |
| `destroy()` | Remove the widget and restore the original `<select>` |

### Static methods

| Method | Description |
|---|---|
| `Kselect.init(selector, options)` | Enhance matching `<select>` elements; always returns an array |
| `Kselect.getInstance(selectEl)` | Retrieve the instance attached to an element |
| `Kselect.destroyAll(root)` | Destroy every instance inside `root` (default: the whole document); returns the number destroyed |
| `Kselect.version` | The version string of the loaded build |

`destroyAll()` matters if your app tears down DOM subtrees:

```js
Kselect.destroyAll(container);   // before, not after
container.innerHTML = '';
```

Each widget's dropdown lives in `<body>`, not inside the wrapper, so wiping a container leaves the dropdown behind along with the instance's window listeners and observers. Destroying first releases all of it.

---

## Events

kselect fires events on the original `<select>` element.

| Event | When |
|---|---|
| `input` | A selection changes (native event, fired immediately before `change` — matching native `<select>` behaviour) |
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

### Per-row colours under a strict Content-Security-Policy

A `style` **attribute** is blocked outright by `style-src 'self'`, and a CSP nonce cannot whitelist one — nonces apply to `<style>` elements only. If your app enforces a strict CSP, carry the colour as data instead:

```html
<option value="rock" data-ks-color="#b53f5c">Rock</option>
<optgroup label="Rock" data-ks-group-color="#b53f5c">…</optgroup>
```

kselect applies these with `element.style.setProperty()` — a CSSOM write, which CSP does not govern — setting `--chip-color` / `--group-color` exactly as the `style` route would, and additionally marking the element with `.ks-coloured` so your CSS can target coloured rows directly:

```css
.ks-option.ks-coloured::before {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: var(--chip-color);
}
```

Both routes work; use whichever suits your policy. They compose, so an element can carry a `style` attribute and a `data-ks-color` at once.

---

## Form-framework classes on the `<select>`

By default kselect copies the source `<select>`'s `class` onto the wrapper `<div>`, which is what keeps sizing and layout utility classes working after enhancement.

If that class styles the control itself — Bootstrap's `.form-select` / `.form-control`, or any class setting border, padding, radius or background — it will paint a *second* box around the already-bordered `.ks-control`. Turn the copy off:

```js
Kselect.init('.form-control', { copyClassName: false });
```

The wrapper then carries only kselect's own classes; the `<select>` keeps its class untouched.

> **If you toggle state classes on the `<select>`, apply them to the wrapper instead.**
> `copyClassName: false` turns off the copy *and* the mirroring — they are the same mechanism — so a class your form layer adds to the `<select>` later (`is-invalid`, `is-dirty`, …) will no longer reach the widget. Nothing errors; the styling just stops appearing. Put those classes on the wrapper yourself (`selectEl.nextElementSibling`) when the copy is off.
>
> This does **not** affect the ARIA mirroring described under [Accessibility](#accessibility). `aria-describedby`, `aria-invalid` and `aria-required` are mirrored onto `.ks-control` regardless of `copyClassName`, so validation state still reaches assistive technology either way.

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

By default, `allowHtml: false` — tag characters are shown literally so untrusted or arbitrary option text can't inject markup.

Set `allowHtml: true` to render markup. Escape your HTML as entities in the option text — kselect decodes and renders it:

```html
<option value="bold">&lt;strong&gt;Bold&lt;/strong&gt;</option>
<option value="status">Server &lt;span style="color:green"&gt;● online&lt;/span&gt;</option>
```

Only enable when the option text is trusted (authored by you, not derived from user input).

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

kselect declares its own defaults inside `:where(:root)`, which carries zero specificity — so **your overrides win regardless of stylesheet order**, even if `kselect.css` loads after yours. There is no need to raise specificity or control the load order.

---

## Accessibility

WCAG 2.1 AA compliant - `role="combobox"`, full ARIA labelling, `aria-live` announcements, `:focus-visible` outlines on all interactive elements, and contrast-checked default colours.

Because the original `<select>` is hidden, kselect mirrors what your form markup wires to it onto the visible `.ks-control`:

| On the `<select>` | On `.ks-control` |
|---|---|
| `label[for="…"]` | `aria-labelledby`, and clicking the label focuses the control |
| `aria-describedby` | `aria-describedby` — help text, validation messages |
| `aria-invalid` | `aria-invalid` |
| `aria-required`, or the native `required` attribute | `aria-required` |

These are re-read on every `refresh()` (which `autoSync: true` calls for you), so they track validation state as it changes:

```js
select.setAttribute('aria-invalid', 'true');
select.setAttribute('aria-describedby', 'email-error');
// the widget picks both up — no manual sync needed
```

The same applies to `disabled`: setting `select.disabled = true` disables the widget, greying the control and taking it out of the tab order.

---

## Browser Support

Chrome / Edge 88+, Firefox 78+, Safari 14+, iOS Safari 14+, Chrome for Android. Internet Explorer is not supported.

The floor is set by the stylesheet's `:where()` selector; the JavaScript itself runs further back.

Worth knowing before you set your own floor: the failure mode is all-or-nothing. A browser that does not understand `:where()` discards the whole selector, and with it **every** `--ks-*` default — so the widget renders completely unstyled rather than slightly off. If you must support below the versions above, serve a copy of `kselect.css` with `:where(:root)` rewritten to `:root` (you then lose the load-order independence, nothing else).

---

## Contributing

Issues and pull requests are welcome. Please open an issue before starting significant work so we can discuss the approach.

---

## License

MIT - see [LICENSE](LICENSE) for details.
