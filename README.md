# kselect.js

A modern, accessible select replacement - single file, no dependencies.

Demo at https://kastrack.github.io/kselect.js/

kselect.js progressively enhances native `<select>` elements with live search, multi-select tags, collapsible optgroups, selection limits, HTML option labels, and a mobile bottom-sheet modal. It writes all changes back to the original `<select>`, so it works seamlessly with any form or framework.

---

## Features

- **Searchable** - live filtering as you type; optgroups auto-expand on match
- **Remote search** - with `load`, search a list too large to load on the server as the user types; picked results become real `<option>`s, with the server's colours and groups
- **Create from the search box** - with `create`, a query nothing matches is offered as a new option (tags, labels), created on your server and selected
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
- **Custom events** - `kselect:change`, `kselect:open`, `kselect:close`, `kselect:create`
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
  selectAllGroupLabel: 'Select all in {group}',
  clearText:         'Clear selection',
  closeText:         'Close',
  removeTagText:     'Remove {label}',
  nativeOnMobile:    false,
  mobileModal:       true,
  maxSelect:         null,
  maxSelectText:     'Max {n} items',
  allowHtml:         false,
  showEmptyOptGroups: true,
  copyClassName:     true,
  revealSelection:   true,
  dropdownParent:    null,
  load:              null,
  loadDelay:         250,
  loadMinChars:      1,
  loadingText:       'Searching…',
});
```

`placeholder` and `searchPlaceholder` can also be set via `data-` attributes on the `<select>` element:

```html
<select data-placeholder="Pick a country…" data-search-placeholder="Find a country…">…</select>
```

Precedence, highest first: per-instance options → `data-` attributes → [`Kselect.defaults`](#translating-kselect) → built-in defaults.

### Full options reference

| Option | Type | Default | Description |
|---|---|---|---|
| `placeholder` | string | `'Select an option…'` | Text shown when nothing is selected |
| `searchPlaceholder` | string | `'Search…'` | Placeholder inside the search input |
| `noResultsText` | string | `'No results found'` | Shown when search returns nothing |
| `maxHeight` | number | `300` | Maximum height of the dropdown in px |
| `searchable` | boolean | `true` | Show or hide the search input. `false` also adds `.ks-no-search` to the wrapper, dropdown and mobile sheet |
| `allowClear` | boolean | `true` | Show a clear (×) button |
| `closeOnSelect` | boolean | `true` | Close after picking in single mode |
| `collapseGroups` | boolean | `false` | Start optgroups collapsed |
| `selectAll` | boolean | `false` | Show a global "Select all" row (multi only) |
| `selectAllText` | string | `'Select all'` | Label for the global select-all row |
| `selectAllGroups` | boolean | `false` | Show a select-all checkbox in each optgroup header (multi only) |
| `selectAllGroupText` | string | `'Select all'` | Unused — it never reached the button. Superseded by `selectAllGroupLabel` |
| `selectAllGroupLabel` | string | `'Select all in {group}'` | Accessible name of each optgroup's select-all button; `{group}` = the optgroup label |
| `clearText` | string | `'Clear selection'` | Accessible name of the clear (×) button |
| `closeText` | string | `'Close'` | Accessible name of the mobile sheet's close button |
| `removeTagText` | string | `'Remove {label}'` | Accessible name of each tag's remove button; `{label}` = the option's plain text (never HTML, even with `allowHtml`) |
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
| `revealSelection` | boolean | `true` | Open the list already scrolled to the current selection (the first selected option in multi mode), centred if it would otherwise be off-screen. Nothing selected, or a selection inside a collapsed group, opens at the top. `false` always opens at the top |
| `dropdownParent` | `null`\|`'wrapper'`\|Element\|string\|function | `null` | Where the dropdown (and the mobile sheet) is mounted. `null` = `<body>`, which escapes every overflow ancestor; `'wrapper'` = inside the widget's own `.ks-wrapper`; an element, a CSS selector (resolved in the select's own root, so it may name an element inside a Shadow DOM) or `function(select, wrapper)` returning one. See [Mounting the dropdown elsewhere](#mounting-the-dropdown-elsewhere-shadow-dom) |
| `load` | function\|null | `null` | Remote source: `function(query, signal)` returning an array, or a promise of one, of `{ value, label, detail }`. Called (debounced) as the user types in either search box; its answer replaces the offered rows. See [Remote search](#remote-search-load) |
| `loadDelay` | number | `250` | Debounce, in ms, before `load()` is called (with `load`, the search boxes use this instead of their 100 ms filter delay) |
| `loadMinChars` | number | `1` | Queries shorter than this filter the select's own options locally instead of calling `load()`. An empty box always shows the select's own options |
| `loadingText` | string | `'Searching…'` | Shown in the dropdown and the mobile sheet while `load()` is pending |
| `create` | function\|null | `null` | Offer the typed query as a new option: `function(query)` returning a value, a `{ value, label, detail, className, color }` record, or a promise of either. See [Creating options](#creating-options-create) |
| `createText` | string | `'Create “{query}”'` | The create row; `{query}` = the trimmed query, always plain text (never HTML, even with `allowHtml`) |
| `createMatch` | function\|null | `null` | `function(query, label)` → `true` when an offered row already equals the query (no create row then). Default: equal ignoring case, accents and extra spaces, by the page language's rules |
| `createPosition` | `'end'`\|`'start'` | `'end'` | Where the create row goes in the list |
| `creatingText` | string | `'Creating “{query}”…'` | The create row while `create()` is pending |
| `createErrorText` | string | `'Couldn’t create “{query}”'` | Shown when `create()` fails without a message of its own |
| `resultsText` | string\|function | `'{n} results'` | The result count screen readers hear after a search. A string with `{n}`, or `function(n)` returning one, for languages with other plural rules |
| `resultText` | string | `'1 result'` | The count when it is exactly 1 (unused when `resultsText` is a function) |
| `resultsCreateText` | string | `'{results}, or create “{query}”'` | Announced when there are results and a create row; `{results}` = the count above |
| `createOnlyText` | string | `'No results; create “{query}”'` | Announced when the create row is all there is |

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
| `Kselect.defaults` | Page-wide option defaults, merged under every new instance's options — see [Translating kselect](#translating-kselect) |

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
| `kselect:create` | The create row was picked, before `create()` is called. `event.detail.query` is the query; `preventDefault()` stops kselect there, so you can take over (see [Creating options](#creating-options-create)) |
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

### `lang` and `dir`

`lang` and `dir` are carried too, so per-option language marking (WCAG 3.1.2, Language of Parts) survives enhancement — a screen reader reads each label in its own language's voice:

```html
<select name="lang" id="f-lang">
  <option value="en" lang="en" selected>English</option>
  <option value="sv" lang="sv">Svenska</option>
  <option value="zh" lang="zh-Hans">中文（简体）</option>
</select>
```

The row, the single-value span and the tag all get `lang="sv"` for Svenska. An option without its own `lang`/`dir` takes its `<optgroup>`'s, as it does natively. The `<select>`'s own `lang` is not copied — the widget inherits the page's language like the native control. Remove the attribute from the option and the widget drops it on the next `refresh()` (automatic with `autoSync`).

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

## Translating kselect

Every string kselect shows or announces is an option. A page in one language sets them once in `Kselect.defaults`, before the first `init`:

```js
// Swedish page
Object.assign(Kselect.defaults, {
  placeholder:           'Välj…',
  searchPlaceholder:     'Sök…',
  noResultsText:         'Inga träffar',
  selectAllText:         'Markera alla',
  selectAllGroupLabel:   'Markera alla i {group}',
  maxSelectText:         'Högst {n} val',
  summarizeSelectedText: '{n} valda',
  removeTagText:         'Ta bort {label}',
  clearText:             'Rensa val',
  closeText:             'Stäng',
  loadingText:           'Söker…',
  resultsText:           '{n} träffar',
  resultText:            '1 träff',
  createText:            'Skapa ”{query}”',
  creatingText:          'Skapar ”{query}”…',
  createErrorText:       'Det gick inte att skapa ”{query}”',
  resultsCreateText:     '{results}, eller skapa ”{query}”',
  createOnlyText:        'Inga träffar; skapa ”{query}”',
});

Kselect.init('select');
```

`{label}`, `{group}`, `{n}`, `{query}` and `{results}` can sit anywhere in the template, for languages that order words differently (`'{label} 移除'`, `'创建“{query}”'`).

The result count is the one string with a plural. `resultText` covers exactly one and `resultsText` the rest, which suits English, Swedish and Chinese (`'{n} 个结果'` for both). For a language with more plural forms, make `resultsText` a function: `resultsText: n => n + ' ' + plural(n, 'результат', 'результата', 'результатов')`. If you translate `resultsText` but leave `resultText` at its English default, your `resultsText` is used for one result too. Per-instance options and `data-placeholder` / `data-search-placeholder` still win over `Kselect.defaults`.

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

## Remote search (`load`)

For a list too large to put in the `<select>` (thousands of records), give kselect a `load` function and it searches your server as the user types, in the dropdown and in the mobile sheet alike:

```js
Kselect.init('#assignee', {
  load: function (query, signal) {
    return fetch('/api/people?q=' + encodeURIComponent(query), { signal })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => j.results.map(r => ({ value: r.id, label: r.name, detail: r.team })));
  },
  loadDelay: 250,          // debounce, ms
  loadMinChars: 1,         // shorter queries filter the select's own options instead
  loadingText: 'Searching…',
});
```

```html
<!-- The select holds what is already picked, plus a first page if you like -->
<select id="assignee" name="assignee" multiple>
  <option value="42" selected data-ks-detail="Accounts">Ada Smith</option>
  <option value="7" data-ks-detail="Sales">Jon Jones</option>
</select>
```

**The contract.** `load(query, signal)` is called with the trimmed query and an `AbortSignal`, with `this` set to the kselect instance (handy when one function in `Kselect.defaults` serves several selects). Return an array — or a promise of one — of `{ value, label, detail, className, color, group, disabled }`: `value` is required (coerced to a string; rows without one, and repeats, are dropped), `label` falls back to the value, and the rest are optional:

| Field | Becomes |
|---|---|
| `detail` | A plain-text second line under the label (`data-ks-detail`) |
| `className` | The option's `class`, carried to its row and its tag as a hand-written option's class is |
| `color` | `data-ks-color` — the [CSP-safe colour route](#per-row-colours-under-a-strict-content-security-policy), read in your CSS as `var(--chip-color)` on the row and the tag |
| `group` | A heading the row is listed under. Groups appear in the order the answer first mentions them, after the rows without a group. A plain heading (a named `role="group"`, like an optgroup's), with no collapsing and no select-all |
| `disabled` | `true` shows the row but it cannot be picked (an archived record, say) |

- **The answer replaces the offered rows, not the selected ones.** A picked option the answer lacks stays picked and is listed first, so it can still be unticked. The select's own options come back when the box is emptied, dropped below `loadMinChars`, or the list closes.
- **Picking a row adds a real `<option>`** (`selected`, with the label as its text, `detail` as `data-ks-detail`, `className` as its class and `color` as `data-ks-color`) to the `<select>`, so the form posts it, and `input` / `change` / `kselect:change` fire as for any pick, single or multiple. Unpicked rows never touch the select.
- **The server is the filter.** A remote answer is shown whole and never re-filtered locally by the query, so your endpoint may match on fields the label doesn't show. `noResultsText` appears only when the server answers with an empty array.
- **Stale answers lose.** Each new search aborts the previous request through its `signal`, and an overtaken answer is discarded even if your `load` ignores the signal.
- **Errors leave the list as it was.** A throw, a rejected promise or a non-array answer clears the loading state, keeps the current rows and logs a `console.warn`; nothing is thrown into your page.
- **Loading state:** `.ks-loading` on the wrapper, the dropdown and the mobile sheet, `aria-busy="true"` on the listbox, and the `loadingText` line. `.ks-remote` marks a list that is showing a remote answer; the select-all row is hidden while it does, since it would only tick the page the server chose to send.
- **Labels follow `allowHtml`** like any option text; `detail` is always plain text.
- Works with `dropdownParent` inside a Shadow DOM, and under a `style-src` without `'unsafe-inline'`: the loading and answer states are classes, and the few inline styles kselect sets elsewhere are CSSOM writes, which `style-src` does not govern. Ignored with `nativeOnMobile` on touch devices and with `searchable: false`.

### A detail line on any option

`data-ks-detail` on an `<option>` renders a second, plain-text line under its label (`.ks-option-detail`), with or without `load`. It takes the row's colour by default; set `--ks-color-option-detail` to soften it, and check its contrast on selected and hovered rows. Local search matches the label only.

---

## Creating options (`create`)

For a list people add to as they go — tags, labels, categories — give kselect a `create` function. When the search finds nothing that *is* the query, the list offers a row to create it:

```
  Finances          ← already exists: no create row for "finances"
  Fintech
+ Create “finnish”  ← for a query nothing equals
```

```js
const [ks] = Kselect.init('#tags', {
  // Search the shared tag list on the server…
  load: (query, signal) =>
    fetch('/api/tags?q=' + encodeURIComponent(query), { signal })
      .then(r => r.json())
      .then(tags => tags.map(t => ({
        value: t.id, label: t.name, color: t.colour,
        detail: t.uses + ' uses',
        group: t.similar ? 'Similar tags' : 'Other tags',
      }))),

  // …and create one when nothing matches.
  create: (query) =>
    fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: query }),
    }).then(async r => {
      const body = await r.json();
      // A message of your own is shown to the user as it is.
      if (!r.ok) throw new Error(body.message || 'That tag could not be saved');
      // An existing tag (a duplicate name) is fine: kselect selects it.
      return { value: body.id, label: body.name, color: body.colour };
    }),
});
```

```html
<select id="tags" name="tags" multiple>
  <option value="12" data-ks-color="#0a7a55" selected>Finances</option>
</select>
```

**When the row appears.** For a non-empty query that no offered row equals — the select's own options after filtering, or the remote answer. When nothing matches at all it replaces `noResultsText`. It is never shown while `load()` is pending (it would flicker between keystrokes) and comes back with the answer. "Equals" is `createMatch(query, label)`; by default that ignores case, accents and extra spaces using the page language's own rules, so "Finances", "finances" and "finançes" are one tag in English — while in Swedish "Öst" and "ost" stay two words, because å, ä and ö are letters of their own there. A row that equals the query is shown even if the ordinary search would have hidden it ("finançes" lists "Finances"). Pass your own `createMatch` if your server compares names differently.

**A real row.** It is an option of the list (`li.ks-option.ks-create`, `role="option"`): the arrow keys reach it, Enter, a click or a tap picks it, in the dropdown and the mobile sheet, single and multiple. `createPosition: 'start'` puts it first instead of last. Screen readers hear it with the count: "3 results, or create “finnish”" (`resultsCreateText`), or "No results; create “finnish”" (`createOnlyText`).

**What `create(query)` may return** (`this` is the instance):

| Answer | What happens |
|---|---|
| A value, or `{ value, label, detail, className, color }` (or a promise of one) | A real `<option>` is added to the `<select>` and selected, exactly as picking a remote row does: `input` / `change` / `kselect:change` fire, `maxSelect` is respected. `label` falls back to the query |
| A value the `<select>` already has | That option is selected; no second option with the same value is added |
| `null` / `undefined` | Nothing is created and nothing is reported — for a dialog the user dismissed. The query stays |
| A rejection or a throw | Nothing changes, the query and the list stay, and the reason is shown under the list (`.ks-create-error`) and announced. A message you chose (`new Error('That name is reserved')`, or a rejected string) is shown as it is; a JavaScript or network error (`TypeError: Failed to fetch`) shows `createErrorText` instead and is logged with `console.warn`. Nothing reaches your page as an uncaught error |

**While it is pending** the row reads `creatingText` with a spinner, carries `aria-busy="true"` and `.ks-create-pending` (and `.ks-creating` is on the wrapper, the dropdown and the sheet). Picking it again does nothing; one create runs at a time. You can keep typing: if a newer query is on screen when the answer arrives, the new option is still added and selected, but the old query is not searched again.

**Afterwards.** In multi mode the list stays open, the query is cleared and keyboard focus rests on the new option, ready for the next tag. In single mode the list closes as `closeOnSelect` says. If focus was lost meanwhile — your own dialog took it and dropped it on `<body>` — it comes back to the search box while the list is open, or to the control once it has closed; focus the user moved elsewhere is left alone.

At the `maxSelect` limit the row is still listed, unavailable (`aria-disabled`), with `maxSelectText` under it.

### Asking for more in a dialog

`create` can return any promise, so it can open your own dialog first — to choose the new tag's colour, say — and resolve when the user saves. kselect shows the pending row the whole time, and clicks inside your dialog do not close the list (they would, otherwise, count as clicks outside it):

```js
create: (query) => new Promise((resolve) => {
  const dialog = document.getElementById('new-tag-dialog');
  dialog.querySelector('[name=name]').value = query;
  dialog.showModal();
  dialog.onclose = () => {
    if (dialog.returnValue !== 'save') return resolve(null);   // dismissed: nothing happens
    resolve(saveTag(new FormData(dialog.querySelector('form'))));  // a promise of { value, label, color }
  };
}),
```

### Taking over with `kselect:create`

`kselect:create` fires on the `<select>` when the row is picked, before `create` is called, with the query in `event.detail.query`. Call `preventDefault()` and kselect stops there — no pending state, no `create()` call — and the rest is yours. To add what you made, put it in the `<select>` and select it:

```js
select.addEventListener('kselect:create', (event) => {
  event.preventDefault();
  ks.close();
  openTagEditor(event.detail.query).then((tag) => {     // your own flow
    if (!tag) return;
    select.add(new Option(tag.name, tag.id));            // autoSync picks it up
    ks.setValue([...ks.getValue(), String(tag.id)]);     // selects it; fires change
  });
});
```

Prefer returning a promise from `create` when all you need is a dialog: kselect then keeps the pending row, the focus handling and the error line for you.

Works with and without `load`, with optgroups, through `refresh()` and `autoSync`, inside a modal `<dialog>` (mount the dropdown in it with `dropdownParent`), and under a strict `style-src`. Ignored with `nativeOnMobile` on touch devices and with `searchable: false`.

---

## Mounting the dropdown elsewhere (Shadow DOM)

By default the dropdown is appended to `<body>` and positioned with `position: fixed`, so no `overflow: hidden` or `overflow: scroll` ancestor can clip it. Two situations want it somewhere else:

- **A Shadow DOM.** A stylesheet adopted into a shadow root does not reach `<body>`, so a dropdown mounted there renders unstyled.
- **A scoped theme.** A theme set as CSS custom properties on a container (`.my-form { --ks-color-accent: … }`) does not reach a dropdown outside that container.

```js
Kselect.init(shadowRoot.querySelector('select'), { dropdownParent: 'wrapper' });   // inside .ks-wrapper
Kselect.init('#country', { dropdownParent: '#form-root' });                       // a selector, resolved in the select's own root
Kselect.init('#country', { dropdownParent: (select, wrapper) => wrapper.closest('form') });
```

A mounted dropdown carries `.ks-mounted` and is positioned absolutely inside the mount, against the control (the mount is given `position: relative` if it had none; `destroy()` puts it back). The mobile sheet moves with it, so a shadow root's styles reach the sheet too. The trade-off: an overflow ancestor *between* the control and the mount can clip the list, which is exactly what the `<body>` default avoids — so leave the default unless one of the two situations above applies.

Inside a shadow root kselect also resolves the `<label for>` and the focused element in the select's own root, closes on outside clicks by the event's composed path (a click on an option is not "outside" even though the document sees the shadow host), and the stylesheet's `--ks-*` defaults are declared on `:host` as well as `:root`. Load `kselect.css` inside the shadow root (a `<link>` or an adopted sheet); kselect never injects styles.

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

### Target size

The small targets — tag remove, clear, optgroup select-all, the search input in the control, and the mobile sheet's close — have a hit area of at least `--ks-target-size` (default `24px`, the WCAG 2.2 SC 2.5.8 minimum). Only the button's box grows; the icons and the tag pill keep their size. Touch-first apps can raise it:

```css
:root { --ks-target-size: 44px; }   /* tags and group headers grow to fit */
```

### State hooks

`.ks-no-search` is set on the wrapper, the dropdown and the mobile sheet when `searchable: false`, and hides every search box.

With [`load`](#remote-search-load), `.ks-loading` is on the same three elements while a request is pending, and `.ks-remote` while a remote answer is shown; a remote answer's group headings are `.ks-group.ks-group-static`. Option rows with a `data-ks-detail` line carry `.ks-option-has-detail`.

With [`create`](#creating-options-create), the create row is `.ks-option.ks-create` (plus `.ks-create-start` when first, `.ks-create-pending` while `create()` runs, `.ks-option-at-limit` at `maxSelect`), `.ks-creating` is on the wrapper, the dropdown and the sheet while it runs, and a failure line is `.ks-create-error`. The row takes the option text colour; set `--ks-color-create-text` to give it an accent of your own (check it against `--ks-color-option-hover` too). The failure line uses `--ks-color-error-bg`, `--ks-color-error-text` and `--ks-color-error-border`.

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

Every small button has a hit area of at least 24 × 24 CSS px (WCAG 2.2 SC 2.5.8) — see [Target size](#target-size). Per-option `lang` / `dir` are carried onto the rendered labels (see [`lang` and `dir`](#lang-and-dir)), and kselect's own accessible names are translatable (see [Translating kselect](#translating-kselect)).

When the dropdown opens it starts at the current selection (see `revealSelection`), and keyboard focus starts there too — the first `↓` / `↑` moves from the selected option, as in a native `<select>`, rather than from the top of the list.

The list is a `role="listbox"` (the options `<ul>`, `ks-listbox-<id>`), named as the control is, holding only options and `role="group"`s named by their optgroup's label; the live region and the notices sit beside it. The control's and both search boxes' `aria-controls` point at it, on desktop and in the mobile sheet, where the same list moves. Group headers are names, not buttons: click one to collapse its group, and the arrow keys open a collapsed group when they move into it. A group's select-all (`selectAllGroups`) is an option of the group, "Select all in {group}", reached by the arrows and toggled by Enter. Options blocked by `maxSelect` are `aria-disabled` while the limit holds.

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
