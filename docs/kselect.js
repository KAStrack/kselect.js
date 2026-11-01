/*!
 * kselect.js - A modern, accessible select replacement
 * Version 1.12.0
 * Vanilla JavaScript, no dependencies
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Kselect = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Keep in sync with the banner comment above and docs/kselect.css. Exposed as
  // Kselect.version and embedded as an HTML comment in the mobile sheet so a
  // cached build is easy to spot via "Inspect Element".
  const KSELECT_VERSION = '1.12.0';

  // The live region's count strings, by default. _resultsText compares
  // against them to tell a translated resultsText from an untouched one.
  const DEFAULT_TEXTS = { resultsText: '{n} results', resultText: '1 result' };

  // ─── Utility helpers ────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Fills a text-option template: formatText('Remove {label}', 'label', 'Ledig').
  // The function replacer keeps `$&`, `$1` etc. in option text literal —
  // a string replacement would expand them.
  function formatText(template, key, value) {
    return String(template).replace('{' + key + '}', function () { return value; });
  }

  // Fills several placeholders in one pass: fillText('{results}, or create
  // “{query}”', { results: '3 results', query: 'x' }). One pass, so a value
  // that itself contains "{query}" (the user can type anything) is never
  // filled a second time; unknown keys are left as written.
  function fillText(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (all, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : all;
    });
  }

  // The fallback for createMatch's default when Intl.Collator is missing:
  // case-folded, diacritics removed, whitespace runs collapsed. \p{M} is built
  // at run time — as a literal it is a parse error in browsers without
  // Unicode property escapes (Firefox < 78), which would take the whole file
  // down; there the common combining blocks stand in for it.
  let COMBINING_MARKS;
  try {
    COMBINING_MARKS = new RegExp('\\p{M}', 'gu');
  } catch (e) {
    COMBINING_MARKS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;
  }
  function foldText(str) {
    let s = String(str);
    if (s.normalize) s = s.normalize('NFD');
    return s.replace(COMBINING_MARKS, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // An <option> built from a { value, label, detail, className, color,
  // disabled } record — a load() answer's row or create()'s result. Detail
  // and colour go where a hand-written option carries them (data-ks-detail,
  // data-ks-color), so _renderOption and _carryAttrs need nothing new.
  function optionFromItem(item, value, fallbackLabel) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = item.label === undefined || item.label === null ? fallbackLabel : String(item.label);
    if (item.detail !== undefined && item.detail !== null && item.detail !== '') {
      o.setAttribute('data-ks-detail', String(item.detail));
    }
    if (item.className) o.className = String(item.className);
    if (item.color !== undefined && item.color !== null && item.color !== '') {
      o.setAttribute('data-ks-color', String(item.color));
    }
    return o;
  }

  // A JavaScript or DOM error is a bug or a network failure, and its message
  // ("Failed to fetch", "x is undefined") is not for the user's eyes. Only a
  // message the host chose — a plain Error or a string — is shown.
  function isRuntimeError(err) {
    return err instanceof TypeError || err instanceof ReferenceError ||
      err instanceof SyntaxError || err instanceof RangeError ||
      (typeof DOMException !== 'undefined' && err instanceof DOMException);
  }

  function debounce(fn, delay) {
    let timer;
    const debounced = function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
    debounced.cancel = function () { clearTimeout(timer); };
    return debounced;
  }

  function uniqueId() {
    return 'ks-' + Math.random().toString(36).slice(2, 9);
  }

  // ─── Core Kselect class ─────────────────────────────────────────────────────

  // Detect "this is a phone or tablet, not a touchscreen laptop". The
  // (pointer: coarse) media query is the W3C-blessed signal for "the primary
  // input is a finger or stylus" — exactly the population for whom the iOS
  // and Android native pickers are a better experience than a custom widget
  // that has to fight the on-screen keyboard for screen real estate.
  // The element the widget's dropdown and mobile sheet are appended to.
  // null = <body>, which escapes every overflow ancestor (the default, and what
  // every version before 1.10 did). Anything else keeps the dropdown inside the
  // host's own tree — a Shadow DOM, a container carrying a scoped theme — at the
  // cost of being clipped by an overflow ancestor between the control and the
  // mount. A selector is resolved in the select's own root (a ShadowRoot or
  // the document), so it can name an element inside the shadow tree.
  function resolveMountParent(option, selectEl, wrapper) {
    if (option === null || option === undefined || option === false || option === 'body') return null;
    if (option === 'wrapper') return wrapper;
    if (typeof option === 'function') option = option(selectEl, wrapper);
    if (typeof option === 'string') {
      const root = selectEl.getRootNode ? selectEl.getRootNode() : document;
      option = (root && root.querySelector ? root : document).querySelector(option);
    }
    if (option && option.nodeType === 1) return option;
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('kselect: dropdownParent did not resolve to an element; mounting in <body>');
    }
    return null;
  }

  // The node whose querySelector / activeElement see the select: its ShadowRoot
  // when it lives in one, else the document.
  function rootOf(el) {
    const root = el && el.getRootNode ? el.getRootNode() : document;
    return root && root.querySelector ? root : document;
  }

  function isCoarsePointerDevice() {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches;
  }

  // Are we running inside a (possibly cross-origin) iframe? `position: fixed`
  // anchors to *this frame's* layout viewport, not the user's screen — so when
  // the iframe is rendered taller than the parent window (a tall form in a
  // full-bleed iframe), a bottom-pinned overlay can land far below the fold.
  // Comparing window.self to window.top is allowed across origins and doesn't
  // throw; the try/catch is belt-and-braces for locked-down embeds.
  function inIframe() {
    try {
      return window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  function Kselect(selectEl, userOptions) {
    if (!(this instanceof Kselect)) return new Kselect(selectEl, userOptions);
    if (!selectEl || selectEl.tagName !== 'SELECT') {
      throw new Error('Kselect: first argument must be a <select> element.');
    }

    // Double-init guard. If this <select> already has a live kselect instance,
    // return it instead of building a second widget on top of the first — re-init
    // would hide the (already-hidden) select again and orphan the first instance's
    // wrapper, dropdown, and event bindings, a common cause of "my change handler
    // stopped firing" when a modal re-runs init on every open. Returning an object
    // from a constructor overrides the `new` result, so both Kselect.init(el)
    // (which calls `new Kselect`) and a direct `new Kselect(el)` yield the existing
    // instance. destroy() clears data-kselect-id and the _instances entry, so
    // re-init after destroy() still builds fresh; a cloned node carrying a stale
    // data-kselect-id not present in _instances also falls through to a fresh build
    // (and overwrites the stale attribute below).
    const existingId = selectEl.getAttribute('data-kselect-id');
    if (existingId && Kselect._instances && Kselect._instances[existingId]) {
      return Kselect._instances[existingId];
    }

    this.select = selectEl;

    // data-* attributes sit above Kselect.defaults and below per-instance
    // options, so a page-wide default never overrides markup.
    const dataOptions = {};
    if (selectEl.getAttribute('data-placeholder')) {
      dataOptions.placeholder = selectEl.getAttribute('data-placeholder');
    }
    if (selectEl.getAttribute('data-search-placeholder')) {
      dataOptions.searchPlaceholder = selectEl.getAttribute('data-search-placeholder');
    }

    this.options = Object.assign({
      placeholder: 'Select an option…',
      searchPlaceholder: 'Search…',
      noResultsText: 'No results found',
      maxHeight: 300,
      searchable: true,
      allowClear: true,
      closeOnSelect: true,        // single only; multi stays open
      collapseGroups: false,      // optgroups collapsed by default?
      selectAll: false,           // show a global "Select all" checkbox (multi only)
      selectAllText: 'Select all',
      selectAllGroups: false,     // show a "Select all" checkbox inside each optgroup (multi only)
      selectAllGroupText: 'Select all', // unused — superseded by selectAllGroupLabel; kept so existing configs don't break
      selectAllGroupLabel: 'Select all in {group}', // accessible name of each optgroup's select-all button; {group} = the optgroup label
      clearText: 'Clear selection',     // accessible name of the clear (×) button
      closeText: 'Close',               // accessible name of the mobile sheet's close button
      removeTagText: 'Remove {label}',  // accessible name of each tag's remove button; {label} = the option's plain text
      nativeOnMobile: false,     // on coarse-pointer devices, leave the native <select> in place
      mobileModal: true,          // on coarse-pointer devices, open a full-screen modal instead of a dropdown
      maxSelect: null,            // maximum number of items that can be selected (multi only; null = unlimited)
      maxSelectText: 'Max {n} items', // label shown in the control when the limit is reached
      allowHtml: false,           // render HTML markup inside <option> labels; false = show tags as literal text
      summarizeSelected: 'auto',  // multi only: 'auto' = collapse to "n selected" when tags would wrap; 'off' or false = always show all tags; number = collapse when count exceeds it
      summarizeSelectedText: '{n} selected', // template for the summary; {n} is replaced with the selected count
      autoSync: true,             // watch the underlying <select> for external mutations and stay in sync without manual refresh()/kselect:sync calls
      showEmptyOptGroups: true,   // when an <optgroup> has no <option> children, true keeps its header in the dropdown; false omits it entirely
      copyClassName: true,        // copy the source <select>'s class onto the wrapper <div>; set false when that class styles the native control (borders/padding) and would double up around .ks-control
      revealSelection: true,      // on open, start the list scrolled so the (first) selected option is visible and centred; false = always open at the top
      dropdownParent: null,       // where the dropdown and the mobile sheet are mounted: null = <body> (escapes every overflow ancestor); 'wrapper' = inside .ks-wrapper; an Element, a CSS selector, or a function(select, wrapper) returning one — for a Shadow DOM or a scoped theme
      load: null,                 // remote source: function(query, signal) returning (a promise of) [{ value, label, detail }]; called as the user types in either search box, and its answer replaces the offered rows
      loadDelay: 250,             // debounce before load() is called, ms
      loadMinChars: 1,            // shorter queries filter the select's own options locally instead of calling load()
      loadingText: 'Searching…',  // shown in the dropdown and the mobile sheet while load() is pending
      create: null,               // function(query) returning a value, a { value, label, detail, className, color } record, or a promise of either: offers a "create" row for a query nothing matches
      createText: 'Create “{query}”', // the create row; {query} = the trimmed query, always plain text
      createMatch: null,          // function(query, label) → boolean: does this offered row already equal the query? null = equal ignoring case, whitespace and accents (by the page language's rules)
      createPosition: 'end',      // 'end' or 'start' of the list
      creatingText: 'Creating “{query}”…', // the create row while create() is pending
      createErrorText: 'Couldn’t create “{query}”', // shown when create() fails without a message of its own
      resultsText: DEFAULT_TEXTS.resultsText, // live-region count; a string with {n}, or function(n) returning one (for languages with other plural rules)
      resultText: DEFAULT_TEXTS.resultText,   // the count when it is exactly 1 (unused when resultsText is a function)
      resultsCreateText: '{results}, or create “{query}”', // announced with results and a create row
      createOnlyText: 'No results; create “{query}”',      // announced with only the create row
    }, Kselect.defaults, dataOptions, userOptions || {});

    this.isMultiple = selectEl.multiple;
    this.isDisabled = selectEl.disabled;
    this.id = uniqueId();

    // Native-passthrough mode: on phones/tablets, the native picker is a
    // better experience than the custom widget (which has to fight the
    // on-screen keyboard for space). We don't build the widget at all — we
    // just attach the public API to the existing <select> and forward the
    // native `change` event as `kselect:change` for code that listens for it.
    if (this.options.nativeOnMobile && isCoarsePointerDevice()) {
      this._nativeMode = true;
      this._initNativePassthrough();
      Kselect._instances = Kselect._instances || {};
      Kselect._instances[this.id] = this;
      return;
    }

    this._nativeMode = false;
    this._open = false;
    this._collapsedGroups = {};
    this._searchQuery = '';

    this._build();
    this._bindEvents();
    this._syncFromSelect();

    // Mark original select as replaced. Save the original inline display
    // value so destroy() can restore it precisely (rather than wiping to '').
    selectEl.setAttribute('data-kselect-id', this.id);
    this._originalDisplay = selectEl.style.display;
    selectEl.style.display = 'none';

    // Store instance
    Kselect._instances = Kselect._instances || {};
    Kselect._instances[this.id] = this;
  }

  // Set up a thin wrapper around the native <select> so the public Kselect
  // API still works, the original element is left visible, and any code
  // listening for `kselect:change` continues to receive events.
  Kselect.prototype._initNativePassthrough = function () {
    const self = this;
    this.select.setAttribute('data-kselect-id', this.id);
    this.select.classList.add('ks-native');
    // Forward the native change event as kselect:change for parity with the
    // custom-widget mode (`change` fires natively, no need to re-dispatch).
    this._nativeChangeForwarder = function () {
      self._dispatch('kselect:change');
    };
    this.select.addEventListener('change', this._nativeChangeForwarder);
  };

  // ─── Static ──────────────────────────────────────────────────────────────────

  Kselect.init = function (selector, options) {
    const els = typeof selector === 'string'
      ? document.querySelectorAll(selector)
      : (selector ? [selector] : []);
    const instances = [];
    Array.prototype.forEach.call(els, function (el) {
      instances.push(new Kselect(el, options));
    });
    // Always return an array. Earlier versions (≤0.1.x) returned a single
    // instance when one element matched — that polymorphic return type was a
    // footgun for callers. Use Kselect.init('#one')[0] or destructuring if
    // you want the single instance.
    return instances;
  };

  Kselect.version = KSELECT_VERSION;

  // Page-wide option defaults, merged under each new instance's options —
  // a multilingual page sets its language's strings here once instead of
  // passing them to every init. data-* attributes and per-instance options
  // still win. Read at construction, so set it before the first init.
  Kselect.defaults = {};

  Kselect.getInstance = function (selectEl) {
    const id = selectEl && selectEl.getAttribute('data-kselect-id');
    return id ? (Kselect._instances || {})[id] : null;
  };

  // Destroy every kselect instance inside `root` (default: the whole document),
  // returning the number destroyed.
  //
  // Hosts that tear a subtree down with `container.innerHTML = ''` silently
  // leak every widget in it: the dropdown lives in <body> (so it survives the
  // wipe), along with a capturing window scroll listener, resize/click/
  // visualViewport listeners, and the MutationObserver/ResizeObserver pair —
  // none of which are released, because destroy() never ran. Call this before
  // wiping the container.
  Kselect.destroyAll = function (root) {
    const scope = root || document;
    let count = 0;
    const destroyOne = function (el) {
      const inst = Kselect.getInstance(el);
      if (inst) { inst.destroy(); count++; }
    };
    if (scope.tagName === 'SELECT') destroyOne(scope);
    if (scope.querySelectorAll) {
      Array.prototype.forEach.call(
        scope.querySelectorAll('select[data-kselect-id]'), destroyOne
      );
    }
    return count;
  };

  // Returns true when the mobile-modal experience should be used for this instance.
  // Requires mobileModal:true AND a coarse-pointer device AND the viewport is in
  // the "phone" size range (≤ 640 px wide — same breakpoint used by the CSS).
  Kselect.prototype._isMobileModal = function () {
    if (!this.options.mobileModal) return false;
    if (!isCoarsePointerDevice()) return false;
    // Check visual viewport width if available, fall back to window.innerWidth.
    const vv = window.visualViewport;
    const width = vv ? vv.width : window.innerWidth;
    return width <= 640;
  };

  Kselect.prototype._build = function () {
    const self = this;

    // Wrapper
    // The source select's class is copied on by default — that's what makes
    // sizing and layout utility classes on the <select> keep working. But a
    // form framework's field class (.form-control, .form-select, an @apply'd
    // input class) paints its own border/padding/radius, which then draws a
    // second box around the already-boxed .ks-control. copyClassName:false is
    // the supported way to say "that class is for the native control".
    // _copiedClassName records what we copied so refresh() can diff it.
    this._copiedClassName = this.options.copyClassName ? (this.select.className || '') : '';
    const wrapper = document.createElement('div');
    // ks-no-search goes on the wrapper, dropdown and mobile overlay (the last
    // two live in <body>) so the stylesheet can hide every search box —
    // searchable:false used to only skip focusing it.
    const noSearch = this.options.searchable ? '' : ' ks-no-search';
    wrapper.className = 'ks-wrapper' +
      (this.isMultiple ? ' ks-multiple' : ' ks-single') +
      (this.isDisabled ? ' ks-disabled' : '') + noSearch +
      (this._copiedClassName ? ' ' + this._copiedClassName : '');
    wrapper.setAttribute('id', 'ks-wrapper-' + this.id);

    // Copy width style if set
    if (this.select.style.width) {
      wrapper.style.width = this.select.style.width;
    }

    // ── Control (the visible input area) ──
    const control = document.createElement('div');
    control.className = 'ks-control';
    control.setAttribute('role', 'combobox');
    control.setAttribute('aria-haspopup', 'listbox');
    control.setAttribute('aria-expanded', 'false');
    // The listbox is the options <ul> (ks-listbox-<id>), not the dropdown
    // around it: the dropdown also holds the live region and the status
    // notices, which a listbox may not contain.
    control.setAttribute('aria-controls', 'ks-listbox-' + this.id);
    control.setAttribute('aria-owns', 'ks-listbox-' + this.id);
    control.setAttribute('tabindex', this.isDisabled ? '-1' : '0');
    if (this.isDisabled) control.setAttribute('aria-disabled', 'true');

    // Resolve accessible label: prefer the <label> that points at the original <select>
    let labelText = '';
    if (this.select.id) {
      const labelEl = rootOf(this.select).querySelector('label[for="' + this.select.id + '"]');
      if (labelEl) {
        const labelId = labelEl.id || ('ks-label-' + this.id);
        labelEl.id = labelId;
        control.setAttribute('aria-labelledby', labelId);
        labelText = labelEl.textContent.trim();

        // The label's `for` still points at the now-hidden <select>, so
        // clicking it focuses nothing — where a native control would take
        // focus. Redirect the click to the widget. The label lives outside
        // the wrapper, so destroy() has to unbind this explicitly.
        this._labelEl = labelEl;
        this._labelClick = function (e) {
          if (self.isDisabled) return;
          // Don't hijack clicks on anything interactive nested in the label.
          if (e.target !== labelEl && e.target.closest &&
              e.target.closest('a, button, input, select, textarea')) return;
          self._control.focus();
        };
        labelEl.addEventListener('click', this._labelClick);
      }
    }
    if (!labelText && this.select.getAttribute('aria-label')) {
      control.setAttribute('aria-label', this.select.getAttribute('aria-label'));
      labelText = this.select.getAttribute('aria-label');
    }
    if (!labelText) {
      control.setAttribute('aria-label', this.options.placeholder);
    }

    // Selection display area
    const selection = document.createElement('div');
    selection.className = 'ks-selection';

    // Search input
    const searchWrap = document.createElement('div');
    searchWrap.className = 'ks-search-wrap';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'ks-search-input';
    searchInput.setAttribute('role', 'searchbox');
    searchInput.setAttribute('aria-label', this.options.searchPlaceholder);
    searchInput.setAttribute('placeholder', this.options.searchPlaceholder);
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('autocorrect', 'off');
    searchInput.setAttribute('autocapitalize', 'off');
    searchInput.setAttribute('spellcheck', 'false');
    searchInput.setAttribute('aria-autocomplete', 'list');
    searchInput.setAttribute('aria-controls', 'ks-listbox-' + this.id);
    searchWrap.appendChild(searchInput);

    // Placeholder
    const placeholder = document.createElement('span');
    placeholder.className = 'ks-placeholder';
    placeholder.textContent = this.options.placeholder;

    // Arrow
    const arrow = document.createElement('span');
    arrow.className = 'ks-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<svg viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'ks-clear';
    clearBtn.setAttribute('aria-label', this.options.clearText);
    clearBtn.innerHTML = '<svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

    control.appendChild(selection);
    control.appendChild(searchWrap);
    control.appendChild(placeholder);
    if (this.options.allowClear) control.appendChild(clearBtn);

    // Limit badge — shown in multi mode when maxSelect is set, replaced by an
    // "at limit" pill once the user hits the cap.
    const limitBadge = document.createElement('span');
    limitBadge.className = 'ks-limit-badge';
    limitBadge.setAttribute('aria-hidden', 'true');
    limitBadge.style.display = 'none';
    control.appendChild(limitBadge);

    control.appendChild(arrow);

    // ── Dropdown ──
    const dropdown = document.createElement('div');
    dropdown.className = 'ks-dropdown' +
      (this.isMultiple ? ' ks-multiple' : ' ks-single') + noSearch;
    dropdown.setAttribute('id', 'ks-dropdown-' + this.id);
    dropdown.style.maxHeight = this.options.maxHeight + 'px';

    // The listbox itself: only options and groups of options inside it. It
    // moves into the mobile sheet while that is open, and stays the listbox
    // there. Named as the control is — by the same <label>, or the same text.
    const optionsList = document.createElement('ul');
    optionsList.className = 'ks-options';
    optionsList.setAttribute('id', 'ks-listbox-' + this.id);
    optionsList.setAttribute('role', 'listbox');
    optionsList.setAttribute('aria-multiselectable', this.isMultiple ? 'true' : 'false');
    if (control.getAttribute('aria-labelledby')) {
      optionsList.setAttribute('aria-labelledby', control.getAttribute('aria-labelledby'));
    } else if (control.getAttribute('aria-label')) {
      optionsList.setAttribute('aria-label', control.getAttribute('aria-label'));
    }
    dropdown.appendChild(optionsList);

    // Limit-reached notice banner — shown at the top of the dropdown when
    // maxSelect is configured and the user has hit the cap.
    const limitNotice = document.createElement('div');
    limitNotice.className = 'ks-limit-notice';
    limitNotice.setAttribute('role', 'status');
    limitNotice.setAttribute('aria-live', 'polite');
    limitNotice.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M8 5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<circle cx="8" cy="11" r="0.75" fill="currentColor"/>' +
      '</svg>' +
      '<span class="ks-limit-notice-text"></span>';
    dropdown.insertBefore(limitNotice, optionsList);

    // Remote-search loading line (load option). Shown by CSS while the
    // dropdown carries .ks-loading — a class, not an inline style, so it
    // needs nothing from style-src.
    let loadingEl = null;
    if (typeof this.options.load === 'function') {
      loadingEl = document.createElement('div');
      loadingEl.className = 'ks-loading-text';
      loadingEl.textContent = this.options.loadingText;
      dropdown.insertBefore(loadingEl, optionsList);
    }

    // Live region announces status changes (no results, count) to screen readers
    const liveRegion = document.createElement('div');
    liveRegion.className = 'ks-live';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    dropdown.appendChild(liveRegion);

    const noResults = document.createElement('div');
    noResults.className = 'ks-no-results';
    noResults.setAttribute('role', 'status');
    noResults.textContent = this.options.noResultsText;
    noResults.style.display = 'none';
    dropdown.appendChild(noResults);

    // ── Create row (create option) ──
    // One element for the widget's life, placed into the listbox after each
    // rebuild (_updateCreate) — an option among options, which the arrow keys,
    // Enter, a click and a tap reach like any other. Its error line is not an
    // option, so it sits beside the listbox (_showCreateError places it).
    if (typeof this.options.create === 'function') {
      const createEl = document.createElement('li');
      createEl.className = 'ks-option ks-create ks-hidden';
      createEl.setAttribute('role', 'option');
      createEl.setAttribute('id', 'ks-create-' + this.id);
      const createIcon = document.createElement('span');
      createIcon.className = 'ks-create-icon';
      createIcon.setAttribute('aria-hidden', 'true');
      createIcon.innerHTML = '<svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 1V9M1 5H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const createLabel = document.createElement('span');
      createLabel.className = 'ks-option-text';
      const createDetail = document.createElement('span');
      createDetail.className = 'ks-option-detail';
      createEl.appendChild(createIcon);
      createEl.appendChild(createLabel);
      createEl.appendChild(createDetail);
      createEl.addEventListener('click', function (e) {
        e.stopPropagation();
        self._activateCreate();
      });
      this._createEl = createEl;
      this._createLabel = createLabel;
      this._createDetail = createDetail;

      const createError = document.createElement('div');
      createError.className = 'ks-create-error';
      createError.style.display = 'none';
      this._createError = createError;
    }

    wrapper.appendChild(control);
    wrapper.appendChild(dropdown);

    // Insert after the original select
    this.select.parentNode.insertBefore(wrapper, this.select.nextSibling);

    // Attach the dropdown to <body> so it is never clipped by an overflow
    // ancestor — _positionDropdown sets fixed coordinates each time it opens —
    // unless dropdownParent names another mount. A mounted dropdown is
    // positioned absolutely inside that parent instead (.ks-mounted), so the
    // parent is made its containing block when it is not positioned already;
    // destroy() puts that back.
    this._mount = resolveMountParent(this.options.dropdownParent, this.select, wrapper);
    this._mountPositioned = false;
    if (this._mount) {
      dropdown.classList.add('ks-mounted');
      if (getComputedStyle(this._mount).position === 'static') {
        this._mount.style.position = 'relative';
        this._mountPositioned = true;
      }
    }
    (this._mount || document.body).appendChild(dropdown);

    // ── Mobile modal overlay ──
    // A full-screen sheet used instead of the dropdown on small touch devices
    // when mobileModal:true. Built once and reused; shown/hidden by open()/close().
    const mobileOverlay = document.createElement('div');
    mobileOverlay.className = 'ks-mobile-overlay' +
      (this.isMultiple ? ' ks-multiple' : ' ks-single') + noSearch;
    mobileOverlay.setAttribute('aria-modal', 'true');
    mobileOverlay.setAttribute('role', 'dialog');
    // Version marker — inspect the modal's HTML to confirm you're not running a
    // cached build. Shows up as `<!-- kselect.js v1.5.1 -->` inside the overlay.
    mobileOverlay.appendChild(document.createComment(' kselect.js v' + KSELECT_VERSION + ' '));

    // Backdrop (the dark scrim behind the sheet)
    const mobileBackdrop = document.createElement('div');
    mobileBackdrop.className = 'ks-mobile-backdrop';

    // The sheet panel itself
    const mobileSheet = document.createElement('div');
    mobileSheet.className = 'ks-mobile-sheet';

    // Header row: title (label text) + close button
    const mobileHeader = document.createElement('div');
    mobileHeader.className = 'ks-mobile-header';

    const mobileTitle = document.createElement('span');
    mobileTitle.className = 'ks-mobile-title';
    mobileTitle.setAttribute('id', 'ks-mobile-title-' + this.id);
    // Use the label text if we found one above, else placeholder
    mobileTitle.textContent = labelText || this.options.placeholder;

    const mobileClose = document.createElement('button');
    mobileClose.type = 'button';
    mobileClose.className = 'ks-mobile-close';
    mobileClose.setAttribute('aria-label', this.options.closeText);
    mobileClose.innerHTML =
      '<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';

    mobileHeader.appendChild(mobileTitle);
    mobileHeader.appendChild(mobileClose);

    // Current selection display (shown at top, for multi only)
    const mobileSelection = document.createElement('div');
    mobileSelection.className = 'ks-mobile-selection';

    // The scrollable options area — grows to fill available space,
    // but anchors content to the bottom so sparse lists sit near the search bar.
    // The options <ul> — the listbox — moves in here while the sheet is open;
    // the wrap is only its scroller, beside the sheet's live region and
    // no-results line, which a listbox may not contain.
    const mobileOptionsWrap = document.createElement('div');
    mobileOptionsWrap.className = 'ks-mobile-options-wrap';
    mobileOptionsWrap.setAttribute('id', 'ks-mobile-options-' + this.id);

    // Search bar (fixed at the very bottom of the sheet)
    const mobileSearchWrap = document.createElement('div');
    mobileSearchWrap.className = 'ks-mobile-search-wrap';

    const mobileSearchInput = document.createElement('input');
    mobileSearchInput.type = 'text';
    mobileSearchInput.className = 'ks-mobile-search-input';
    mobileSearchInput.setAttribute('role', 'searchbox');
    mobileSearchInput.setAttribute('aria-label', this.options.searchPlaceholder);
    mobileSearchInput.setAttribute('placeholder', this.options.searchPlaceholder);
    mobileSearchInput.setAttribute('autocomplete', 'off');
    mobileSearchInput.setAttribute('autocorrect', 'off');
    mobileSearchInput.setAttribute('autocapitalize', 'off');
    mobileSearchInput.setAttribute('spellcheck', 'false');
    mobileSearchInput.setAttribute('inputmode', 'search');
    mobileSearchInput.setAttribute('aria-autocomplete', 'list');
    mobileSearchInput.setAttribute('aria-controls', 'ks-listbox-' + this.id);

    const mobileSearchIcon = document.createElement('span');
    mobileSearchIcon.className = 'ks-mobile-search-icon';
    mobileSearchIcon.setAttribute('aria-hidden', 'true');
    mobileSearchIcon.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>' +
        '<path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';

    mobileSearchWrap.appendChild(mobileSearchIcon);
    mobileSearchWrap.appendChild(mobileSearchInput);

    // No-results inside the options wrap
    const mobileNoResults = document.createElement('div');
    mobileNoResults.className = 'ks-mobile-no-results';
    mobileNoResults.textContent = this.options.noResultsText;
    mobileNoResults.style.display = 'none';

    mobileOptionsWrap.appendChild(mobileNoResults);

    if (loadingEl) mobileOptionsWrap.appendChild(loadingEl.cloneNode(true));

    mobileSheet.appendChild(mobileHeader);
    mobileSheet.appendChild(mobileSelection);
    mobileSheet.appendChild(mobileOptionsWrap);
    mobileSheet.appendChild(mobileSearchWrap);

    mobileOverlay.appendChild(mobileBackdrop);
    mobileOverlay.appendChild(mobileSheet);
    // The sheet is a full-viewport fixed layer; it only moves into the mount so
    // a Shadow DOM's stylesheet (and a scoped theme) reach it.
    (this._mount || document.body).appendChild(mobileOverlay);

    // Store refs
    this._mobileOverlay    = mobileOverlay;
    this._mobileBackdrop   = mobileBackdrop;
    this._mobileSheet      = mobileSheet;
    this._mobileHeader     = mobileHeader;
    this._mobileTitle      = mobileTitle;
    this._mobileClose      = mobileClose;
    this._mobileSelection  = mobileSelection;
    this._mobileOptionsWrap = mobileOptionsWrap;
    this._mobileSearchWrap = mobileSearchWrap;
    this._mobileSearchInput = mobileSearchInput;
    this._mobileNoResults  = mobileNoResults;

    // ── iframe-aware mobile positioning ──
    // If we're inside an iframe that's rendered taller than the parent window,
    // `position: fixed` on the overlay anchors to the iframe's (oversized)
    // viewport, so the bottom-pinned sheet can land off-screen. We track the
    // slice of the iframe that's actually visible to the user with an
    // IntersectionObserver whose implicit root is the *top-level* viewport —
    // the intersection is clipped across (even cross-origin) frame boundaries,
    // so this works with zero cooperation from the parent page. The cached
    // rect is in this frame's viewport coordinates, exactly what fixed
    // positioning needs. (Only wired up when the mobile modal can actually
    // appear — coarse pointer, small viewport.)
    this._inIframe = inIframe();
    this._iframeVisibleRect = null;
    if (this._inIframe && this.options.mobileModal && typeof IntersectionObserver === 'function') {
      const sentinel = document.createElement('div');
      sentinel.className = 'ks-iframe-sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      document.body.appendChild(sentinel);
      this._iframeSentinel = sentinel;

      const self = this;
      this._iframeObserver = new IntersectionObserver(function (entries) {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        // The observer's job here is mainly to *fire* — its callback runs when
        // the parent scrolls (even cross-origin), which an in-frame scroll
        // listener can't see when the iframe itself isn't the thing scrolling.
        // For the actual coordinates we prefer the synchronous same-origin
        // computation: `intersectionRect` is reported in the top-level
        // viewport's coordinate space, not this frame's fixed-positioning
        // space, so using it directly would mis-place the overlay by the
        // parent scroll offset. We only fall back to it when the parent is
        // unreachable (cross-origin) — a case where a content-tall iframe
        // can't really arise without parent cooperation anyway.
        const sync = self._computeIframeVisibleRect();
        if (sync) {
          self._iframeVisibleRect = sync;
        } else {
          const r = entry.intersectionRect;
          self._iframeVisibleRect = entry.isIntersecting
            ? { top: r.top, left: r.left, width: r.width, height: r.height }
            : null;
        }
        // Re-pin live if the sheet is open.
        if (self._mobileOverlay &&
            self._mobileOverlay.classList.contains('ks-mobile-overlay-open')) {
          self._positionMobileOverlay();
        }
      });
      this._iframeObserver.observe(sentinel);
    }

    // Store refs
    this._wrapper = wrapper;
    this._control = control;
    this._selection = selection;
    this._searchInput = searchInput;
    this._searchWrap = searchWrap;
    this._placeholder = placeholder;
    this._clearBtn = clearBtn;
    this._limitBadge = limitBadge;
    this._dropdown = dropdown;
    this._limitNotice = limitNotice;
    this._optionsList = optionsList;
    this._liveRegion = liveRegion;
    this._noResults = noResults;
    this._arrow = arrow;

    // Mirror the host's validation/description ARIA onto the control
    this._syncAria();

    // Build option items
    this._buildOptionsList();

    // ── Wrapper-height change compensation ──
    // When the dropdown is open in multi-select mode, adding or removing tags
    // changes the wrapper's height. Because the dropdown uses position:fixed
    // anchored to rect.bottom at open-time, a height change creates a gap
    // (wrapper shrank) or overlap (wrapper grew).
    //
    // Strategy: keep the dropdown pin-point completely still and instead scroll
    // the page by the height delta. This preserves the user's visual reference —
    // the dropdown never jumps — while the wrapper smoothly follows the scroll.
    //
    // We observe the wrapper with ResizeObserver (fires synchronously after
    // layout, before paint) and call window.scrollBy with the delta. Because
    // the dropdown is position:fixed to the viewport and the viewport doesn't
    // move, the dropdown stays exactly where it is. Only the page content scrolls.
    this._wrapperPrevHeight = 0;
    this._wrapperPrevWidth = 0;
    if (typeof ResizeObserver !== 'undefined') {
      const self = this;
      this._wrapperResizeObserver = new ResizeObserver(function (entries) {
        if (!self._open) return;
        const rect = entries[0].contentRect;
        const newHeight = rect.height;
        const newWidth = rect.width;
        const heightDelta = newHeight - self._wrapperPrevHeight;
        const widthDelta = newWidth - self._wrapperPrevWidth;
        self._wrapperPrevHeight = newHeight;
        self._wrapperPrevWidth = newWidth;
        if (heightDelta !== 0) {
          if (self._mount) {
            // A mounted dropdown is positioned against the control, so it
            // follows the wrapper by itself; scrolling the page would move both.
            self._positionDropdown();
          } else {
            const isDropup = self._wrapper.classList.contains('ks-dropup');
            // Drop-down: wrapper bottom moved down (grew) or up (shrank).
            //   Scroll down by delta keeps wrapper bottom at the same viewport Y.
            // Drop-up: wrapper top moved up (grew) or down (shrank).
            //   Scroll up by delta keeps wrapper top at the same viewport Y.
            window.scrollBy(0, isDropup ? -heightDelta : heightDelta);
          }
        }
        // Width changes (e.g. selecting a tag pushes the wrapper wider in a
        // flex/grid layout) — the dropdown must follow so its left/right
        // edges stay flush with the control.
        if (widthDelta !== 0) {
          self._positionDropdown();
        }
      });
    } else {
      this._wrapperResizeObserver = null;
    }
  };

  Kselect.prototype._buildOptionsList = function () {
    this._optionsList.innerHTML = '';
    this._itemMap = {}; // value -> [li, li, ...] (array; multiple options can share a value)
    this._optionCount = 0;
    this._selectAllEl = null;
    this._groupSelectAllMap = {}; // groupId -> li element
    const self = this;
    const children = this.select.children;

    // Global "Select all" row — only in multi mode when option is enabled
    if (this.isMultiple && this.options.selectAll) {
      this._renderSelectAll(this._optionsList);
      // Move the search input inside the select-all li (left side)
      if (this.options.searchable && this._selectAllEl) {
        // Its own row at the top of the dropdown, above the list (1.11.1): it
        // sat inside the select-all option, and an option's content is not a
        // control a screen reader can reach.
        this._dropdown.insertBefore(this._searchWrap, this._dropdown.firstChild);
        this._wrapper.classList.add('ks-search-in-row');
        this._dropdown.classList.add('ks-search-in-row');
      }
    } else {
      // Ensure search wrap is back in the control if options changed at runtime.
      // Also clear any inline display that open()/close() may have left on it
      // while it was living in the dropdown — once back in the control its
      // visibility is governed by CSS (.ks-open .ks-search-wrap).
      if (this._searchWrap.parentNode !== this._control) {
        this._control.insertBefore(this._searchWrap, this._placeholder);
      }
      this._searchWrap.style.display = '';
      this._wrapper.classList.remove('ks-search-in-row');
      this._dropdown.classList.remove('ks-search-in-row');
    }

    // .ks-remote marks a list that shows a remote answer (load option) rather
    // than the select's own options. The stylesheet hides select-all under it.
    const remote = !!this._remote;
    [this._wrapper, this._dropdown, this._mobileOverlay].forEach(function (el) {
      if (el) el.classList.toggle('ks-remote', remote);
    });
    if (remote) {
      this._renderRemote(this._optionsList);
    } else {
      this._renderChildren(children, this._optionsList, null);
    }
    // The rebuild emptied the list, create row included.
    this._updateCreate();
  };

  // The list while a remote answer is shown: picked options the answer lacks
  // first — still selected, and still where the user can untick them — then
  // the answer in the server's order. An answered value the select already
  // has an <option> for renders that option, so its selected state, class and
  // style are the select's own; the rest render detached <option>s, which
  // only join the select when picked (_materialize). An empty-value option is
  // a single select's "nothing chosen" placeholder (selected by default), not
  // a pick, so it is not carried into the answer.
  //
  // Rows the server gave a `group` follow the ungrouped ones, under a header
  // per group in the order the groups first appear in the answer (1.12.0).
  Kselect.prototype._renderRemote = function (container) {
    const self = this;
    const answered = {};
    this._remote.options.forEach(function (o) { answered[o.value] = true; });
    Array.prototype.forEach.call(this.select.options, function (o) {
      if (o.selected && o.value !== '' && !answered[o.value]) self._renderOption(o, container, null);
    });
    const groups = [];
    const byName = {};
    this._remote.options.forEach(function (o) {
      const shown = self._nativeOption(o.value) || o;
      if (o._ksGroup === null || o._ksGroup === undefined) {
        self._renderOption(shown, container, null);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(byName, o._ksGroup)) {
        byName[o._ksGroup] = { name: o._ksGroup, rows: [] };
        groups.push(byName[o._ksGroup]);
      }
      byName[o._ksGroup].rows.push(shown);
    });
    groups.forEach(function (g) {
      const list = self._renderStaticGroup(g.name, container);
      g.rows.forEach(function (o) { self._renderOption(o, list, g.name); });
    });
  };

  // A group of a remote answer: a named role="group" built like an optgroup's
  // (so it looks and reads the same), but only a heading — it neither
  // collapses nor has a select-all, since the server chose what is in it.
  // Returns the list its rows go into.
  Kselect.prototype._renderStaticGroup = function (name, container) {
    this._staticGroupCount = (this._staticGroupCount || 0) + 1;
    const labelId = 'ks-rgroup-' + this.id + '-' + this._staticGroupCount;
    const li = document.createElement('li');
    li.className = 'ks-group ks-group-static';
    li.setAttribute('role', 'group');
    li.setAttribute('aria-labelledby', labelId);

    const head = document.createElement('div');
    head.className = 'ks-group-head';
    const header = document.createElement('div');
    header.className = 'ks-group-header';
    header.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'ks-group-label';
    label.setAttribute('id', labelId);
    label.textContent = name;
    header.appendChild(label);
    head.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'ks-group-options';
    list.setAttribute('role', 'presentation');

    li.appendChild(head);
    li.appendChild(list);
    container.appendChild(li);
    return list;
  };

  // The select's first <option> with this value, or null.
  Kselect.prototype._nativeOption = function (value) {
    const opts = this.select.options;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].value === value) return opts[i];
    }
    return null;
  };

  Kselect.prototype._renderSelectAll = function (container) {
    const self = this;
    const li = document.createElement('li');
    li.className = 'ks-option ks-select-all';
    li.setAttribute('role', 'option');
    li.setAttribute('data-select-all', 'global');

    // Wrap label+checkbox in a single clickable element so only clicking
    // on those two things triggers select-all (not clicking in empty space).
    const trigger = document.createElement('span');
    trigger.className = 'ks-select-all-trigger';

    const text = document.createElement('span');
    text.className = 'ks-option-text';
    text.textContent = this.options.selectAllText;

    const checkbox = document.createElement('span');
    checkbox.className = 'ks-checkbox';
    checkbox.setAttribute('aria-hidden', 'true');
    checkbox.innerHTML = '<svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    trigger.appendChild(text);
    trigger.appendChild(checkbox);

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      self._toggleSelectAll();
    });

    // Search wrap is prepended by _buildOptionsList when selectAll+searchable
    li.appendChild(trigger);

    container.appendChild(li);
    this._selectAllEl = li;
    this._selectAllTrigger = trigger;
  };

  Kselect.prototype._renderChildren = function (children, container, groupEl) {
    const self = this;
    Array.prototype.forEach.call(children, function (child) {
      if (child.tagName === 'OPTGROUP') {
        self._renderGroup(child, container);
      } else if (child.tagName === 'OPTION') {
        self._renderOption(child, container, groupEl ? groupEl.label : null);
      }
    });
  };

  // Open or close a group's options; remembered across rebuilds.
  Kselect.prototype._setGroupCollapsed = function (groupLi, collapsed) {
    const groupList = groupLi.querySelector('.ks-group-options');
    groupLi.classList.toggle('ks-group-collapsed', collapsed);
    if (groupList) groupList.style.display = collapsed ? 'none' : '';
    this._collapsedGroups[groupLi.getAttribute('data-group-id')] = collapsed;
  };

  Kselect.prototype._renderGroup = function (optgroup, container) {
    const self = this;

    // Empty optgroups (no <option> children in the source) are skipped entirely
    // when showEmptyOptGroups is false. Otherwise we render the header as usual;
    // _filterOptions keeps it visible while there's no active search query.
    if (!this.options.showEmptyOptGroups) {
      const hasOption = Array.prototype.some.call(optgroup.children, function (c) {
        return c.tagName === 'OPTION';
      });
      if (!hasOption) return;
    }

    const groupId = this.id + '-group-' + encodeURIComponent(optgroup.label);
    const isCollapsed = this._collapsedGroups[groupId] !== undefined
      ? this._collapsedGroups[groupId]
      : this.options.collapseGroups;

    // A group of options in the listbox, named by its label.
    const li = document.createElement('li');
    li.className = 'ks-group' + (isCollapsed ? ' ks-group-collapsed' : '');
    this._carryAttrs(li, optgroup);
    li.setAttribute('data-group-id', groupId);
    li.setAttribute('role', 'group');
    li.setAttribute('aria-labelledby', 'ks-group-label-' + groupId);

    // The header row: the collapse button and, with selectAllGroups, the
    // group's select-all button, side by side — a button may not contain
    // another (it used to hold the select-all button).
    const head = document.createElement('div');
    head.className = 'ks-group-head';

    // The group's name, which the pointer can click to collapse the group.
    // Not a button: a listbox may hold only options and groups of options, so
    // a control inside it is unreachable or misreported. Hidden from assistive
    // technology, because it is already the group's accessible name (the
    // group's aria-labelledby reads hidden text), and keyboard users reach a
    // collapsed group's options with the arrow keys, which open it (1.11.1).
    const header = document.createElement('div');
    header.className = 'ks-group-header';
    this._carryAttrs(header, optgroup);
    header.setAttribute('aria-hidden', 'true');

    const toggle = document.createElement('span');
    toggle.className = 'ks-group-toggle';
    toggle.setAttribute('aria-hidden', 'true');
    toggle.innerHTML = '<svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const label = document.createElement('span');
    label.className = 'ks-group-label';
    label.setAttribute('id', 'ks-group-label-' + groupId);
    label.textContent = optgroup.label;

    header.appendChild(toggle);
    header.appendChild(label);
    head.appendChild(header);

    // Per-group select-all: a small checkbox in the header row (multi only).
    // An option of the group — "Select all in {group}" — drawn where the
    // checkbox has always been; the arrow keys reach it and Enter toggles it,
    // as for the global select-all row.
    if (this.isMultiple && this.options.selectAllGroups) {
      const groupCheckBtn = document.createElement('div');
      groupCheckBtn.className = 'ks-group-select-all';
      groupCheckBtn.setAttribute('role', 'option');
      groupCheckBtn.setAttribute('id', 'ks-group-all-' + groupId);
      groupCheckBtn.setAttribute('aria-selected', 'false');
      groupCheckBtn.setAttribute('data-select-all', 'group');
      groupCheckBtn._ksOptgroup = optgroup;
      groupCheckBtn.setAttribute('aria-label',
        formatText(this.options.selectAllGroupLabel, 'group', optgroup.label));
      this._markUiLang(groupCheckBtn, li);
      groupCheckBtn.innerHTML =
        '<span class="ks-checkbox">' +
          '<svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M1 4L3.5 6.5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</span>';
      groupCheckBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self._toggleSelectAllGroup(optgroup);
      });
      head.appendChild(groupCheckBtn);
      this._groupSelectAllMap[groupId] = groupCheckBtn;
    }

    const groupList = document.createElement('ul');
    groupList.className = 'ks-group-options';
    this._carryAttrs(groupList, optgroup);
    groupList.setAttribute('id', 'ks-group-list-' + groupId);
    groupList.setAttribute('role', 'presentation');
    if (isCollapsed) groupList.style.display = 'none';

    header.addEventListener('click', function (e) {
      e.stopPropagation();
      self._setGroupCollapsed(li, !li.classList.contains('ks-group-collapsed'));
    });

    li.appendChild(head);
    li.appendChild(groupList);
    container.appendChild(li);

    Array.prototype.forEach.call(optgroup.children, function (option) {
      if (option.tagName === 'OPTION') {
        self._renderOption(option, groupList, optgroup.label);
      }
    });
  };

  // Carries the source <option>/<optgroup>'s class and inline style onto a
  // rendered chrome element (option <li>, group <li>/header/list, or .ks-tag).
  // Lets consumers attach per-row styling hooks to the source select markup —
  // e.g. `style="--chip-color: #b53f5c"` for data-derived colours, or
  // `class="is-recommended"` for enumerable states — and have them surface
  // on the widget without writing post-render mutation code.
  // Classes are appended (never replacing the framework's own classes); styles
  // are concatenated with a semicolon so any inline style the framework set
  // itself is preserved.
  Kselect.prototype._carryAttrs = function (target, source) {
    if (!source) return;
    if (source.className) {
      target.className += ' ' + source.className;
    }
    const style = source.getAttribute('style');
    if (style) {
      target.style.cssText = target.style.cssText
        ? target.style.cssText + ';' + style
        : style;
    }

    // CSP-safe per-row colours. A host running a strict `style-src 'self'`
    // cannot write style="--chip-color: …" on the source <option> at all — a
    // nonce whitelists <style> *elements*, never style *attributes*, so there
    // is no escape hatch short of re-adding 'unsafe-inline'. These data
    // attributes carry the colour as data instead, and setProperty() is a
    // CSSOM write, which CSP does not govern. The `.ks-coloured` marker saves
    // consumers from hooking coloured rows with a brittle [style*="…"]
    // attribute selector.
    const chipColor = source.getAttribute('data-ks-color');
    if (chipColor) {
      target.style.setProperty('--chip-color', chipColor);
      target.classList.add('ks-coloured');
    }
    const groupColor = source.getAttribute('data-ks-group-color');
    if (groupColor) {
      target.style.setProperty('--group-color', groupColor);
      target.classList.add('ks-coloured');
    }

    // Language of parts (WCAG 3.1.2). A language switcher whose labels are
    // each in their own language marks that per option; without this every
    // re-rendered label is read in the page language's voice. An option with
    // no lang/dir of its own takes its optgroup's, as it does natively — that
    // matters for tags and the single-value span, which render in the control
    // rather than inside the group's list. The <select>'s own lang is
    // deliberately not consulted. Absent → removed, so an element can never
    // keep a stale value.
    const group = source.tagName === 'OPTION' && source.parentNode &&
      source.parentNode.tagName === 'OPTGROUP' ? source.parentNode : null;
    ['lang', 'dir'].forEach(function (attr) {
      let val = source.getAttribute(attr);
      if (val === null && group) val = group.getAttribute(attr);
      if (val === null) target.removeAttribute(attr);
      else target.setAttribute(attr, val);
    });
  };

  // kselect's own strings (remove/select-all labels) are in the page's
  // language. When they sit inside an element that carried an option's lang
  // (a tag, a group header), mark them back to the language the wrapper
  // inherits so "Remove Svenska" isn't read with a Swedish voice.
  Kselect.prototype._markUiLang = function (el, container) {
    if (!container.hasAttribute('lang')) return;
    const scope = this._wrapper && this._wrapper.parentNode;
    const langEl = scope && scope.closest ? scope.closest('[lang]') : null;
    if (langEl) el.setAttribute('lang', langEl.getAttribute('lang'));
  };

  // Populates a label element with the option's display content.
  // The browser decodes HTML entities in <option> text, so option.text gives
  // the decoded string (e.g. "<strong>Bold</strong>"). Setting that as innerHTML
  // causes it to render as real markup. Setting it as textContent shows the
  // tag characters literally — which is the allowHtml:false behaviour.
  Kselect.prototype._setLabel = function (el, option) {
    if (this.options.allowHtml) {
      el.innerHTML = option.text;
    } else {
      el.textContent = option.text;
    }
  };

  Kselect.prototype._renderOption = function (option, container, groupLabel) {
    const self = this;
    const li = document.createElement('li');
    li.className = 'ks-option' +
      (option.disabled ? ' ks-option-disabled' : '') +
      (option.selected ? ' ks-option-selected' : '');
    this._carryAttrs(li, option);
    li.setAttribute('role', 'option');
    // Use a monotonic counter rather than the value to guarantee unique DOM
    // ids — values with the same alphanumeric-only sanitisation, or genuinely
    // duplicate values across optgroups, would otherwise collide and break
    // aria-activedescendant.
    this._optionCount = (this._optionCount || 0) + 1;
    li.setAttribute('id', 'ks-opt-' + self.id + '-' + this._optionCount);
    li.setAttribute('aria-selected', option.selected ? 'true' : 'false');
    li.setAttribute('data-value', option.value);
    if (option.disabled) li.setAttribute('aria-disabled', 'true');
    if (groupLabel) li.setAttribute('data-group', groupLabel);

    if (this.isMultiple) {
      const checkbox = document.createElement('span');
      checkbox.className = 'ks-checkbox';
      checkbox.setAttribute('aria-hidden', 'true');
      checkbox.innerHTML = '<svg viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      li.appendChild(checkbox);
    }

    const text = document.createElement('span');
    text.className = 'ks-option-text';
    self._setLabel(text, option);
    li.appendChild(text);

    // Optional second line (data-ks-detail, or a remote answer's `detail`).
    // Always plain text, whatever allowHtml says, and outside .ks-option-text
    // so the local search filter still matches on the label alone.
    const detail = option.getAttribute('data-ks-detail');
    if (detail) {
      li.classList.add('ks-option-has-detail');
      const detailEl = document.createElement('span');
      detailEl.className = 'ks-option-detail';
      detailEl.textContent = detail;
      li.appendChild(detailEl);
    }

    if (!option.disabled) {
      li.addEventListener('click', function (e) {
        e.stopPropagation();
        self._selectOption(option.value);
      });
    }

    container.appendChild(li);
    // Multiple <li>s can share a value (legal HTML, e.g. same value listed in
    // two optgroups) — store all of them so visual state stays in sync.
    this._itemMap = this._itemMap || {};
    if (!this._itemMap[option.value]) this._itemMap[option.value] = [];
    this._itemMap[option.value].push(li);
    // Back-reference from the rendered <li> to its source <option>. Lets
    // visibility checks (used by select-all when filtering) match exactly,
    // which matters when two options share a value but differ in text.
    li._kselectOption = option;
  };

  // ─── Event Binding ───────────────────────────────────────────────────────────

  Kselect.prototype._bindEvents = function () {
    const self = this;

    // Track whether the most recent pointer interaction with the control was
    // a touch tap (vs. mouse / pen / synthetic). Used by the click handler
    // below to decide whether to focus the search input on open — focusing it
    // on a touch tap would pop up the on-screen keyboard and cover most of
    // the dropdown on a phone.
    this._lastPointerType = null;
    this._control.addEventListener('pointerdown', function (e) {
      self._lastPointerType = e.pointerType || null;
    });

    // Control click → open/close
    this._control.addEventListener('click', function (e) {
      if (self.isDisabled) return;
      if (e.target === self._clearBtn || self._clearBtn.contains(e.target)) return;
      if (self._open) {
        self.close();
      } else {
        const fromTouch = self._lastPointerType === 'touch';
        self.open(fromTouch ? { skipSearchFocus: true } : undefined);
      }
      // Reset so a subsequent keyboard-driven open doesn't inherit this state.
      self._lastPointerType = null;
    });

    // Keyboard nav on control. The search input usually lives *inside* the
    // control, so its keydown events bubble up here after its own listener
    // (below) has already handled them — skip those, or every arrow press
    // would move focus twice.
    this._control.addEventListener('keydown', function (e) {
      if (e.target === self._searchInput) return;
      self._handleKeydown(e);
    });

    // Search input. Debounced — but keep a reference so close() can cancel
    // any pending invocation (an empty close() doesn't want a filter() chasing it).
    // With a remote source the debounce is loadDelay, since it now spaces out
    // server requests; the mobile sheet's box uses the same delay.
    this._searchDelay = typeof this.options.load === 'function' ? this.options.loadDelay : 100;
    this._debouncedFilter = debounce(function () {
      self._wrapper.classList.toggle('ks-searching', self._searchInput.value.length > 0);
      self._applySearch(self._searchInput.value);
    }, this._searchDelay);
    this._searchInput.addEventListener('input', this._debouncedFilter);

    this._searchInput.addEventListener('keydown', function (e) {
      self._handleKeydown(e);
    });

    this._searchInput.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    this._searchInput.addEventListener('focus', function () {
      self._wrapper.classList.add('ks-search-focused');
    });

    this._searchInput.addEventListener('blur', function () {
      self._wrapper.classList.remove('ks-search-focused');
    });

    // Clear button
    this._clearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.clear();
    });

    // Keep focus where it is (search input or control) when the user mouses
    // down inside the dropdown. Options are non-focusable <li>s, so the
    // browser default would blur the search input to <body> before the click
    // handler runs — then a single-mode click-select closes the dropdown with
    // focus already gone, and close()'s focus handoff (which only reclaims
    // focus from inside the widget) can't restore keyboard interaction.
    // Two exemptions: the search wrap (in the select-all-row layout the
    // search input lives inside the dropdown and must be clickable to focus),
    // and the dropdown element itself (a mousedown targeting it directly is
    // on its scrollbar — Firefox dispatches those, and preventing the default
    // would break scrollbar dragging).
    this._dropdown.addEventListener('mousedown', function (e) {
      if (e.target === self._dropdown) return;
      if (self._searchWrap.contains(e.target)) return;
      e.preventDefault();
    });

    // Close on outside click. The dropdown lives in <body>, not inside the
    // wrapper, so we must check both — otherwise clicks in the dropdown's
    // empty space (padding, scrollbar, no-results area, live region) close it.
    // Inside a Shadow DOM the document-level listener sees the event
    // retargeted to the shadow host, so `contains(e.target)` is false for a
    // click on the widget's own option; the composed path still holds it.
    const within = function (e, el) {
      if (!el) return false;
      if (e.composedPath) return e.composedPath().indexOf(el) !== -1;
      return el.contains(e.target);
    };
    this._outsideClick = function (e) {
      if (within(e, self._wrapper)) return;
      if (within(e, self._dropdown)) return;
      // The mobile overlay (sheet + backdrop) lives in <body> outside the
      // wrapper and dropdown — taps inside it must not trigger an outside-close.
      // The backdrop's own click handler calls close() deliberately.
      if (within(e, self._mobileOverlay)) return;
      // While create() is pending, the host may have opened a dialog of its
      // own over the list (to ask for the new option's colour, say). Clicks
      // in it are part of creating, not a request to close; the dropdown
      // stays open so the result has somewhere to land. A dialog that holds
      // the widget itself (dropdownParent inside a modal) does not count.
      // _createGuard covers the click that settles it: a host that resolves
      // and closes its dialog in one click handler has done both before this
      // listener sees the click bubble up (promise callbacks run between
      // listeners), so neither "pending" nor "open" is still true by then.
      if ((self._createPending || self._createGuard) && self._inForeignDialog(e)) return;
      self.close();
    };
    document.addEventListener('click', this._outsideClick);

    // Resize: debounced is fine — repainting mid-resize is wasted work
    this._repositionDebounced = debounce(function () {
      if (self._open) self._positionDropdown();
    }, 50);
    window.addEventListener('resize', this._repositionDebounced);

    // Auto-summarize re-check: when the wrapper width changes, the threshold
    // for "tags wrap to a second line" moves. Re-render so the summary swap
    // tracks the new layout. Only relevant in 'auto' mode — fixed-number and
    // 'off' modes don't depend on width.
    this._summaryResizeHandler = debounce(function () {
      if (self.isMultiple && self.options.summarizeSelected === 'auto') {
        self._updateControl();
      }
    }, 100);
    window.addEventListener('resize', this._summaryResizeHandler);

    // Scroll: reposition on every frame so the dropdown stays locked to the
    // control while the page moves. We use rAF to stay in sync with the
    // browser's paint cycle and avoid layout thrashing.
    this._rafId = null;
    this._repositionOnScroll = function () {
      if (!self._open) return;
      if (self._rafId) return; // already have a frame queued
      self._rafId = requestAnimationFrame(function () {
        self._rafId = null;
        if (self._open) self._positionDropdown();
      });
    };
    window.addEventListener('scroll', this._repositionOnScroll, { passive: true, capture: true });

    // Visual viewport changes — fired on iOS when the keyboard appears/dismisses
    // and on any platform when the user pinch-zooms. Without these listeners,
    // an iOS user who opens the dropdown then taps the search input would see
    // the dropdown stay anchored to the wrong position because window.resize
    // doesn't fire on keyboard show in Safari. We reuse the rAF-coalesced
    // _repositionOnScroll callback so the keyboard animation doesn't thrash.
    if (window.visualViewport) {
      this._repositionOnVVChange = this._repositionOnScroll;
      window.visualViewport.addEventListener('resize', this._repositionOnVVChange);
      window.visualViewport.addEventListener('scroll', this._repositionOnVVChange);
    }

    // Sync from external select changes
    this.select.addEventListener('kselect:sync', function () {
      self._syncFromSelect();
      self._buildOptionsList();
      if (self._searchQuery) self._filterOptions(self._searchQuery);
    });

    // ── Auto-sync with the underlying <select> ──
    // Two paths cover the ways external code can mutate the select:
    //   1. DOM mutation — options added/removed/reordered, attribute changes,
    //      label text edits. MutationObserver catches these.
    //   2. `change` event — host code sets `select.value = …` or
    //      `option.selected = true` (property assignment doesn't fire
    //      MutationObserver) and dispatches change. We listen for that, but
    //      skip our own events (tagged with `event.kselect`).
    // kselect's internal selection uses property assignment (no MutationObserver
    // fire) and dispatches `change` with `event.kselect = true` (filtered below),
    // so this never triggers a self-induced refresh loop.
    if (this.options.autoSync) {
      if (typeof MutationObserver !== 'undefined') {
        this._selectObserver = new MutationObserver(function () {
          self.refresh();
        });
        this._selectObserver.observe(this.select, {
          childList: true,      // option add/remove
          subtree: true,        // optgroup children, option text
          attributes: true,     // disabled, value, label, selected attribute
          characterData: true,  // option label text edits
        });
      }
      this._externalChangeListener = function (e) {
        if (e.kselect) return; // our own event — already in sync
        self._syncFromSelect();
      };
      this.select.addEventListener('change', this._externalChangeListener);
    }
  };

  Kselect.prototype._handleKeydown = function (e) {
    const key = e.key;
    if (!this._open) {
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault();
        // Mirror a closed native <select>: in single mode, plain arrows step
        // the selection up/down without opening the picker (Alt+Arrow opens
        // it, as native does). Multi mode has no native "step" concept, so
        // arrows open the dropdown.
        if (this.isMultiple || e.altKey) {
          this.open();
        } else {
          this._stepSelection(key === 'ArrowDown' ? 1 : -1);
        }
      } else if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        this.open();
      } else if (!this.isMultiple && key.length === 1 &&
                 !e.ctrlKey && !e.metaKey && !e.altKey) {
        // First-letter type-ahead, the last piece of closed-control parity
        // with a native <select>. Space is excluded above — it opens the
        // dropdown, and always has.
        e.preventDefault();
        this._typeAhead(key);
      }
      return;
    }

    if (key === 'Escape') {
      this.close();
      this._control.focus();
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      this._moveFocus(1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      this._moveFocus(-1);
    } else if (key === 'Enter') {
      e.preventDefault();
      const focused = this._dropdown.querySelector('.ks-option-focused');
      if (focused) {
        if (focused.classList.contains('ks-create')) {
          this._activateCreate();
        } else if (focused.classList.contains('ks-select-all')) {
          this._toggleSelectAll();
        } else if (focused.classList.contains('ks-group-select-all')) {
          this._toggleSelectAllGroup(focused._ksOptgroup);
        } else {
          const val = focused.getAttribute('data-value');
          if (val !== null) this._selectOption(val);
        }
      }
    } else if (key === 'Tab') {
      this.close();
    }
  };

  // Step the selection up/down while the dropdown is closed (single mode
  // only) — the keyboard behaviour of a closed native <select>. Walks from
  // the currently selected option (or from the top/bottom edge when nothing
  // is selected), skips disabled options, and stops at the list edge rather
  // than wrapping around, matching the native control.
  Kselect.prototype._stepSelection = function (dir) {
    const opts = this.select.options;
    let idx = -1;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].selected) { idx = i; break; }
    }
    let i = idx === -1 ? (dir > 0 ? 0 : opts.length - 1) : idx + dir;
    for (; i >= 0 && i < opts.length; i += dir) {
      if (!opts[i].disabled) {
        this._selectOption(opts[i].value);
        return;
      }
    }
  };

  // Type-ahead on a closed single select — typing "b" jumps to the first
  // option starting with B, as a native <select> does. Single mode only, like
  // _stepSelection: multi mode has no closed-state "current option".
  //
  // Native's two-mode rule: while every buffered keystroke is the *same*
  // letter, each press cycles to the next option starting with it (so "bbb"
  // walks B-options); as soon as the buffer holds different letters it
  // becomes a prefix match ("be" finds the first "Be…"). The buffer expires
  // after a second of no typing.
  Kselect.prototype._typeAhead = function (ch) {
    const self = this;
    this._typeBuffer = (this._typeBuffer || '') + ch.toLowerCase();
    if (this._typeTimer) clearTimeout(this._typeTimer);
    this._typeTimer = setTimeout(function () {
      self._typeBuffer = '';
      self._typeTimer = null;
    }, 1000);

    const buf = this._typeBuffer;
    const sameLetter = buf.split('').every(function (c) { return c === buf[0]; });
    const needle = sameLetter ? buf[0] : buf;

    const opts = this.select.options;
    if (!opts.length) return;
    let current = -1;
    for (let i = 0; i < opts.length; i++) {
      if (opts[i].selected) { current = i; break; }
    }
    // Cycling starts after the current option and wraps; a fresh prefix match
    // starts at the top of the list.
    const start = sameLetter ? current + 1 : 0;
    for (let n = 0; n < opts.length; n++) {
      const opt = opts[(start + n) % opts.length];
      if (opt.disabled) continue;
      if (opt.text.toLowerCase().indexOf(needle) === 0) {
        this._selectOption(opt.value);
        return;
      }
    }
  };

  Kselect.prototype._moveFocus = function (dir) {
    // An option is "navigable" if it is enabled and not filtered out by
    // search. Walking the DOM for offsetParent is the simplest correct check
    // for that — it catches "display:none on self" and on an ancestor. An
    // option that is hidden only because its group is collapsed is navigable
    // too (1.11.1): the group header is no longer a button a keyboard can
    // reach, so the arrow keys open the group instead.
    const all = this._dropdown.querySelectorAll('.ks-option:not(.ks-option-disabled), .ks-group-select-all');
    let items = [];
    for (let i = 0; i < all.length; i++) {
      if (all[i].offsetParent !== null) { items.push(all[i]); continue; }
      const group = all[i].closest('.ks-group-collapsed');
      if (group && group.offsetParent !== null && !all[i].classList.contains('ks-hidden')) items.push(all[i]);
    }
    if (!items.length) return;
    const focused = this._dropdown.querySelector('.ks-option-focused');
    let idx = focused ? items.indexOf(focused) : -1;
    if (focused) focused.classList.remove('ks-option-focused');
    // If the previously-focused option is no longer navigable (e.g. a group
    // just collapsed), indexOf returned -1 — start from the top going down,
    // bottom going up.
    if (idx === -1) {
      idx = dir > 0 ? 0 : items.length - 1;
    } else {
      idx = Math.max(0, Math.min(items.length - 1, idx + dir));
    }
    const closed = items[idx].closest('.ks-group-collapsed');
    if (closed) this._setGroupCollapsed(closed, false);
    items[idx].classList.add('ks-option-focused');
    items[idx].scrollIntoView({ block: 'nearest' });
    // Update aria-activedescendant so screen readers announce the focused option
    const itemId = items[idx].getAttribute('id');
    if (itemId) {
      this._control.setAttribute('aria-activedescendant', itemId);
      this._searchInput.setAttribute('aria-activedescendant', itemId);
    }
  };

  // ─── Reveal the current selection on open ────────────────────────────────────

  // Scrolls `scroller` so the first selected, reachable option row is visible,
  // and returns that row (or null when there is nothing to reveal).
  //
  // Called synchronously from open() *after* the dropdown has been shown and
  // positioned — that is what applies the inline maxHeight that makes the
  // dropdown overflow, and a scrollTop write on a container that has no
  // overflow yet is a silent no-op. Because nothing between display:block and
  // this write yields to the browser, the first painted frame already shows
  // the selection: the list *starts* at the selected row rather than opening
  // at the top and then visibly scrolling.
  //
  // `scroller` is the element that actually scrolls: the fixed-position
  // .ks-dropdown on desktop, .ks-mobile-options-wrap in the mobile sheet. The
  // row search goes through _optionsList (not _dropdown) because the <ul> is
  // moved between those two containers.
  //
  // Rules:
  //  - already visible → left alone (an on-screen selection should not jump)
  //  - otherwise → centred in the scroller, so the user has context both ways
  //  - nothing selected → do nothing; the top is right
  //  - search active → do nothing; the filtered list is the user's question
  //  - selection inside a collapsed group → do nothing; the group is not
  //    expanded (a consumer that collapses groups did so deliberately)
  //  - multi mode → the first selected row in DOM order
  Kselect.prototype._revealSelection = function (scroller) {
    if (!this.options.revealSelection || !scroller || this._searchQuery) return null;

    const selected = this._optionsList.querySelectorAll('.ks-option-selected');
    let li = null;
    for (let i = 0; i < selected.length; i++) {
      // _kselectOption excludes the select-all row; offsetParent excludes rows
      // hidden by the filter or by a collapsed group (same test _moveFocus uses).
      if (selected[i]._kselectOption && selected[i].offsetParent !== null) {
        li = selected[i];
        break;
      }
    }
    if (!li) return null;

    // Measure via rects rather than offsetTop so the maths is independent of
    // whatever positioned ancestors sit between the row and the scroller.
    const sRect = scroller.getBoundingClientRect();
    const rRect = li.getBoundingClientRect();
    const viewH = scroller.clientHeight;
    const rowH = rRect.height;
    const rowTop = rRect.top - sRect.top + scroller.scrollTop - scroller.clientTop;

    const alreadyVisible = rowTop >= scroller.scrollTop &&
                           rowTop + rowH <= scroller.scrollTop + viewH;
    if (!alreadyVisible) {
      // The browser clamps an over-large value to the maximum scroll offset.
      scroller.scrollTop = Math.max(0, rowTop - (viewH - rowH) / 2);
    }
    return li;
  };

  // Seeds keyboard focus on `li` so the first ArrowDown/ArrowUp after open
  // continues from the current selection (as a native <select> does) instead
  // of restarting from the top — which, with the list opened at the selection,
  // would scroll straight back up. Mirrors the three writes _moveFocus makes;
  // _moveFocus itself is unchanged and picks up from this row via indexOf.
  Kselect.prototype._seedFocus = function (li) {
    if (!li || li.classList.contains('ks-option-disabled')) return;
    const prev = this._dropdown.querySelector('.ks-option-focused');
    if (prev && prev !== li) prev.classList.remove('ks-option-focused');
    li.classList.add('ks-option-focused');
    const itemId = li.getAttribute('id');
    if (itemId) {
      this._control.setAttribute('aria-activedescendant', itemId);
      this._searchInput.setAttribute('aria-activedescendant', itemId);
    }
  };

  // ─── Mobile modal ────────────────────────────────────────────────────────────

  Kselect.prototype._openMobileModal = function () {
    const self = this;

    // Snapshot the page scroll position so we can restore it after the modal
    // closes. On iOS the keyboard appearing/disappearing can shift the scroll
    // position; we need the restore to happen *after* the keyboard has finished
    // animating (hence the setTimeout).
    this._modalScrollX = window.scrollX !== undefined ? window.scrollX : window.pageXOffset;
    this._modalScrollY = window.scrollY !== undefined ? window.scrollY : window.pageYOffset;

    // Move the options list into the mobile options wrap
    this._mobileOptionsWrap.insertBefore(this._optionsList, this._mobileNoResults);
    // And the live region with it (1.12.0): the sheet is aria-modal, so a
    // screen reader ignores the dropdown left behind — and the dropdown is
    // display:none besides — so the counts it announces went unheard.
    this._mobileOptionsWrap.appendChild(this._liveRegion);

    // Populate mobile selection display (multi mode only)
    this._updateMobileSelection();

    // Show overlay
    this._mobileOverlay.classList.add('ks-mobile-overlay-open');
    document.body.classList.add('ks-body-modal-open');

    // Truly lock page scroll. iOS Safari ignores `overflow:hidden` /
    // `touch-action:none` on <body> for *touch* scrolling, so a drag that
    // starts inside the scrollable options list chains out to the page — or,
    // when kselect is inside an iframe, to the iframe's own document — and
    // carries the sheet off-screen (from which there's often no way to scroll
    // back). Pinning the body with `position:fixed` removes it from the scroll
    // flow entirely, so there is no scrollable ancestor for the list to chain
    // into. The pre-modal scroll offset is reapplied as a negative `top` so the
    // page doesn't visually jump, and restored in _closeMobileModal.
    const bodyStyle = document.body.style;
    this._prevBodyStyle = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
    };
    bodyStyle.position = 'fixed';
    bodyStyle.top = (-this._modalScrollY) + 'px';
    bodyStyle.left = (-this._modalScrollX) + 'px';
    bodyStyle.right = '0';
    bodyStyle.width = '100%';

    // When inside a tall iframe, pin the overlay to the visible slice rather
    // than to the iframe's (oversized) viewport bottom.
    this._positionMobileOverlay();

    // Reset mobile search
    this._mobileSearchInput.value = '';
    this._filterOptions('');

    // Start the sheet's list at the current selection. The options <ul> now
    // lives inside _mobileOptionsWrap, which is the sheet's scroller. No
    // keyboard focus is seeded here — the sheet has no arrow-key navigation.
    this._revealSelection(this._optionsList);

    // Bind search
    if (!this._debouncedMobileFilter) {
      this._debouncedMobileFilter = debounce(function () {
        self._applySearch(self._mobileSearchInput.value);
      }, this._searchDelay);
    }
    this._mobileSearchInput.addEventListener('input', this._debouncedMobileFilter);

    // Restore the page scroll position when the on-screen keyboard dismisses.
    // On iOS/Android, tapping Done or tapping outside the search input fires
    // blur on the input, then the keyboard animates away (~250 ms) and the
    // browser shifts the scroll position as a side-effect. We listen for blur,
    // wait for the animation to settle, then silently snap back so the page is
    // already in place before the user closes the picker.
    this._mobileSearchBlurHandler = function () {
      const savedX = self._modalScrollX;
      const savedY = self._modalScrollY;
      if (savedX !== undefined && savedY !== undefined) {
        setTimeout(function () {
          window.scrollTo(savedX, savedY);
        }, 320);
      }
    };
    this._mobileSearchInput.addEventListener('blur', this._mobileSearchBlurHandler);

    // Close button
    this._mobileClose.addEventListener('click', this._mobileCloseHandler = function () {
      self.close();
    });

    // Backdrop tap closes
    this._mobileBackdrop.addEventListener('click', this._mobileBackdropHandler = function () {
      self.close();
    });

    // ── Swipe-to-close gesture ──
    // Track a downward drag on the sheet. If the user releases after dragging
    // > 80 px down (or flicks fast enough), close the modal. The sheet follows
    // the finger in real time via a CSS transform so the gesture feels physical.
    let dragStartY = 0;
    let dragCurrentY = 0;
    let isDragging = false;

    this._mobileTouchStart = function (e) {
      // Only start a drag from the handle area (top ~48 px of the sheet) or
      // the header row — so the user can still scroll the options list freely.
      const touchY = e.touches[0].clientY;
      const sheetTop = self._mobileSheet.getBoundingClientRect().top;
      if (touchY - sheetTop > 56) return; // too far down — let scroll handle it
      isDragging = true;
      dragStartY = touchY;
      dragCurrentY = touchY;
      self._mobileSheet.style.transition = 'none';
    };

    this._mobileTouchMove = function (e) {
      if (!isDragging) return;
      dragCurrentY = e.touches[0].clientY;
      const dy = Math.max(0, dragCurrentY - dragStartY); // only downward
      self._mobileSheet.style.transform = 'translateY(' + dy + 'px)';
      // Dim the backdrop proportionally
      const progress = Math.min(dy / 220, 1);
      self._mobileBackdrop.style.opacity = String(1 - progress * 0.7);
    };

    this._mobileTouchEnd = function (e) {
      if (!isDragging) return;
      isDragging = false;
      const dy = Math.max(0, dragCurrentY - dragStartY);
      // Detect a fast flick (high velocity) even if distance is small
      const velocity = e.changedTouches[0]
        ? (dragCurrentY - dragStartY) / (e.timeStamp - (self._mobileTouchStartTime || e.timeStamp) + 1)
        : 0;
      self._mobileSheet.style.transition = '';
      if (dy > 80 || velocity > 0.5) {
        self.close();
      } else {
        // Snap back
        self._mobileSheet.style.transform = '';
        self._mobileBackdrop.style.opacity = '';
      }
    };

    this._mobileTouchStartTime = 0;
    const recordStartTime = function (e) { self._mobileTouchStartTime = e.timeStamp; };
    this._mobileSheet.addEventListener('touchstart', recordStartTime, { passive: true });
    this._mobileSheet.addEventListener('touchstart', this._mobileTouchStart, { passive: true });
    this._mobileSheet.addEventListener('touchmove',  this._mobileTouchMove,  { passive: true });
    this._mobileSheet.addEventListener('touchend',   this._mobileTouchEnd,   { passive: true });

    // ── Block scroll-chaining out of the options list ──
    // When a drag inside the options list can't be consumed by the list itself
    // — the list is shorter than its container (not scrollable at all), or it's
    // already pinned at the top/bottom edge — iOS chains the scroll to the
    // document. Inside an iframe that gesture *propagates to the parent frame*,
    // which `position:fixed` on <body> cannot stop (the body lock only governs
    // this frame). So we consume the gesture directly: a non-passive touchmove
    // that calls preventDefault() exactly when the list can't scroll in the
    // drag direction. Mid-list drags fall through untouched and scroll normally.
    this._lastTouchY = 0;
    this._mobileRecordTouchY = function (e) {
      if (e.touches && e.touches.length) self._lastTouchY = e.touches[0].clientY;
    };
    this._mobilePreventChain = function (e) {
      const wrap = self._mobileOptionsWrap;
      if (!wrap || !wrap.contains(e.target)) return; // not the list's area
      if (!e.touches || e.touches.length !== 1) return; // ignore pinch-zoom
      const y = e.touches[0].clientY;
      const dy = y - self._lastTouchY;
      self._lastTouchY = y;
      // The listbox is what scrolls (1.11.1), inside the wrap.
      const list = self._optionsList;
      if (list.scrollHeight <= list.clientHeight) { e.preventDefault(); return; }
      const atTop = list.scrollTop <= 0;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault();
    };
    this._mobileSheet.addEventListener('touchstart', this._mobileRecordTouchY, { passive: true });
    this._mobileSheet.addEventListener('touchmove',  this._mobilePreventChain, { passive: false });
  };

  Kselect.prototype._closeMobileModal = function () {
    // Move options list back to the desktop dropdown, live region too
    this._dropdown.insertBefore(this._liveRegion, this._noResults);
    this._dropdown.insertBefore(this._optionsList, this._liveRegion);

    this._mobileOverlay.classList.remove('ks-mobile-overlay-open');
    document.body.classList.remove('ks-body-modal-open');

    // Un-pin the body (see _openMobileModal) and restore the pre-modal scroll
    // position. `position:fixed` collapses the document's scroll range, so the
    // scrollTo only takes effect once the inline styles are cleared.
    if (this._prevBodyStyle) {
      const bodyStyle = document.body.style;
      bodyStyle.position = this._prevBodyStyle.position;
      bodyStyle.top = this._prevBodyStyle.top;
      bodyStyle.left = this._prevBodyStyle.left;
      bodyStyle.right = this._prevBodyStyle.right;
      bodyStyle.width = this._prevBodyStyle.width;
      this._prevBodyStyle = null;
      if (this._modalScrollX !== undefined && this._modalScrollY !== undefined) {
        window.scrollTo(this._modalScrollX, this._modalScrollY);
      }
    }

    // Remove event listeners
    if (this._mobileCloseHandler) {
      this._mobileClose.removeEventListener('click', this._mobileCloseHandler);
      this._mobileCloseHandler = null;
    }
    if (this._mobileBackdropHandler) {
      this._mobileBackdrop.removeEventListener('click', this._mobileBackdropHandler);
      this._mobileBackdropHandler = null;
    }
    if (this._debouncedMobileFilter) {
      this._mobileSearchInput.removeEventListener('input', this._debouncedMobileFilter);
    }
    if (this._mobileSearchBlurHandler) {
      this._mobileSearchInput.removeEventListener('blur', this._mobileSearchBlurHandler);
      this._mobileSearchBlurHandler = null;
    }
    // Remove swipe-to-close listeners and reset any in-progress transform
    if (this._mobileTouchStart) {
      this._mobileSheet.removeEventListener('touchstart', this._mobileTouchStart);
      this._mobileSheet.removeEventListener('touchmove',  this._mobileTouchMove);
      this._mobileSheet.removeEventListener('touchend',   this._mobileTouchEnd);
      this._mobileTouchStart = null;
      this._mobileTouchMove  = null;
      this._mobileTouchEnd   = null;
    }
    // Remove the scroll-chain blocker (see _openMobileModal)
    if (this._mobilePreventChain) {
      this._mobileSheet.removeEventListener('touchstart', this._mobileRecordTouchY);
      this._mobileSheet.removeEventListener('touchmove',  this._mobilePreventChain);
      this._mobileRecordTouchY = null;
      this._mobilePreventChain = null;
    }
    this._mobileSheet.style.transform = '';
    this._mobileSheet.style.transition = '';
    this._mobileBackdrop.style.opacity = '';

    // Clear any iframe slice positioning so the next open (or a non-iframe
    // context) starts from the CSS `inset: 0` / `max-height: 92dvh` defaults.
    const ov = this._mobileOverlay.style;
    ov.top = ov.left = ov.width = ov.height = ov.bottom = ov.right = '';
    this._mobileSheet.style.maxHeight = '';
  };

  // Size and position the mobile overlay to the user's actually-visible slice
  // of this frame. A no-op (leaves the CSS `inset: 0` default) when we're not
  // in an iframe. Inside an iframe, prefer the IntersectionObserver-cached
  // rect; if that hasn't reported yet (it's async), fall back to a synchronous
  // same-origin computation so the very first open doesn't flash off-screen.
  Kselect.prototype._positionMobileOverlay = function () {
    if (!this._inIframe || !this._mobileOverlay) return;

    // Prefer the synchronous computation (correct coordinate space for fixed
    // positioning in this frame); fall back to the observer-cached rect, which
    // is only populated for the cross-origin case.
    let rect = this._computeIframeVisibleRect() || this._iframeVisibleRect;
    const ov = this._mobileOverlay.style;
    if (rect) {
      ov.top    = rect.top + 'px';
      ov.left   = rect.left + 'px';
      ov.width  = rect.width + 'px';
      ov.height = rect.height + 'px';
      ov.bottom = 'auto';   // override the CSS `inset: 0`
      ov.right  = 'auto';
      // The sheet's CSS `max-height: 92dvh` is relative to *this frame's*
      // (oversized) viewport, so it would tower far above the visible slice.
      // Cap it to the slice instead so the header/close button stay on-screen.
      this._mobileSheet.style.maxHeight = Math.round(rect.height * 0.92) + 'px';
    } else {
      // Unknown (cross-origin, IO not reported yet): use the CSS default and
      // let the first IntersectionObserver callback snap it into place.
      ov.top = ov.left = ov.width = ov.height = ov.bottom = ov.right = '';
      this._mobileSheet.style.maxHeight = '';
    }
  };

  // Best-effort synchronous computation of this frame's visible slice, walking
  // up same-origin ancestor frames. Returns null at the first cross-origin
  // boundary (where the async IntersectionObserver path takes over). Coordinates
  // are in this frame's viewport space — what `position: fixed` uses.
  Kselect.prototype._computeIframeVisibleRect = function () {
    try {
      const vv = window.visualViewport;
      let top = 0;
      let bottom = vv ? vv.height : window.innerHeight;
      const left = 0;
      const width = vv ? vv.width : window.innerWidth;

      let win = window;
      // Cumulative vertical offset from this frame's coords to `win`'s coords,
      // so each ancestor's visible-band constraint can be expressed back in the
      // innermost frame's coordinate space.
      let offset = 0;
      while (win !== win.parent) {
        const frameEl = win.frameElement; // throws / null across origins
        if (!frameEl) return null;
        const fr = frameEl.getBoundingClientRect();
        const parent = win.parent;
        const pvv = parent.visualViewport;
        const parentVisH = pvv ? pvv.height : parent.innerHeight;
        // The parent's visible band is [0, parentVisH] in `win`'s parent coords;
        // a point y in this frame maps to (offset + fr.top + y) there.
        top    = Math.max(top, -fr.top - offset);
        bottom = Math.min(bottom, parentVisH - fr.top - offset);
        offset += fr.top;
        win = parent;
      }

      const height = bottom - top;
      if (height <= 0) return null;
      return { top: top, left: left, width: width, height: height };
    } catch (e) {
      return null; // cross-origin — IntersectionObserver handles it
    }
  };

  // Renders the current selection tags inside the mobile selection header area (multi only)
  Kselect.prototype._updateMobileSelection = function () {
    if (!this._mobileSelection) return;
    this._mobileSelection.innerHTML = '';
    if (!this.isMultiple) {
      this._mobileSelection.style.display = 'none';
      return;
    }
    const selected = Array.prototype.filter.call(this.select.options, function (o) { return o.selected; });
    if (selected.length === 0) {
      this._mobileSelection.style.display = 'none';
      return;
    }
    this._mobileSelection.style.display = '';
    const self = this;
    selected.forEach(function (o) {
      const tag = document.createElement('span');
      tag.className = 'ks-tag';
      self._carryAttrs(tag, o);
      const labelSpan = document.createElement('span');
      labelSpan.className = 'ks-tag-label';
      self._setLabel(labelSpan, o);
      tag.appendChild(labelSpan);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'ks-tag-remove';
      removeBtn.setAttribute('aria-label', formatText(self.options.removeTagText, 'label', o.text));
      self._markUiLang(removeBtn, tag);
      removeBtn.innerHTML = '<svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self._selectOption(o.value);
        self._updateMobileSelection();
      });
      tag.appendChild(removeBtn);
      self._mobileSelection.appendChild(tag);
    });
  };

  // ─── Open / Close ────────────────────────────────────────────────────────────

  Kselect.prototype.open = function (opts) {
    if (this._nativeMode) return;  // native picker is user-driven — no programmatic open
    if (this._open || this.isDisabled) return;
    this._open = true;
    this._wrapper.classList.add('ks-open');
    this._control.setAttribute('aria-expanded', 'true');

    if (this._isMobileModal()) {
      this._openMobileModal();
    } else {
      // A column: the search row and notices at their height, the listbox
      // filling the rest and scrolling (1.11.1; the dropdown itself scrolled).
      this._dropdown.style.display = 'flex';
      // If search is in the select-all row it lives inside the dropdown (body),
      // so CSS .ks-open rules can't reach it — show/hide manually.
      if (this._wrapper.classList.contains('ks-search-in-row')) {
        this._searchWrap.style.display = 'block';
      }
      this._positionDropdown();

      // Start the list at the current selection. Must run after
      // _positionDropdown() (which applies the maxHeight that makes the
      // dropdown scrollable) and before anything can yield to the browser.
      this._seedFocus(this._revealSelection(this._optionsList));

      // Start observing wrapper height changes so we can scroll-compensate
      // when tags wrap to a new line (or a line collapses). Snapshot the
      // current height so the first callback has a valid baseline to diff against.
      if (this._wrapperResizeObserver) {
        const wrapRect = this._wrapper.getBoundingClientRect();
        this._wrapperPrevHeight = wrapRect.height;
        this._wrapperPrevWidth = wrapRect.width;
        this._wrapperResizeObserver.observe(this._wrapper);
      }

      // Skip focusing the search input when the open was triggered by a touch
      // tap — focusing it pops up the on-screen keyboard, which on phones can
      // cover most of the dropdown. The user can still tap the search input
      // directly if they want to search.
      const skipSearchFocus = opts && opts.skipSearchFocus;
      if (this.options.searchable && !skipSearchFocus) {
        this._searchInput.focus();
      }
    }

    this._dispatch('kselect:open');
  };

  Kselect.prototype.close = function () {
    if (this._nativeMode) return;
    if (!this._open) return;
    this._open = false;
    // Anything typed into the search input shouldn't seed closed-control
    // type-ahead once the dropdown is gone.
    if (this._typeTimer) { clearTimeout(this._typeTimer); this._typeTimer = null; }
    this._typeBuffer = '';
    this._wrapper.classList.remove('ks-open');
    this._control.setAttribute('aria-expanded', 'false');
    this._control.removeAttribute('aria-activedescendant');
    this._searchInput.removeAttribute('aria-activedescendant');

    if (this._mobileOverlay && this._mobileOverlay.classList.contains('ks-mobile-overlay-open')) {
      this._closeMobileModal();
    } else {
      // If focus is on the search input (or anywhere in the dropdown), hiding
      // it would drop focus to <body> and kill keyboard interaction — e.g.
      // selecting with Enter closes the dropdown, and the user should be able
      // to keep arrowing through options on the closed control. Hand focus
      // back to the control before hiding.
      // document.activeElement is the shadow host for a focus inside a
      // Shadow DOM; the select's own root reports the element itself.
      const active = rootOf(this.select).activeElement || document.activeElement;
      if (active === this._searchInput || this._dropdown.contains(active)) {
        this._control.focus();
      }
      this._dropdown.style.display = 'none';
      if (this._wrapper.classList.contains('ks-search-in-row')) {
        this._searchWrap.style.display = 'none';
      }
      // Stop observing — no need to compensate when the dropdown is hidden
      if (this._wrapperResizeObserver) {
        this._wrapperResizeObserver.unobserve(this._wrapper);
      }
    }

    // Cancel any pending debounced filter — its work is no longer relevant
    // and would only re-touch DOM after the dropdown is already hidden.
    if (this._debouncedFilter && this._debouncedFilter.cancel) {
      this._debouncedFilter.cancel();
    }
    if (this._debouncedMobileFilter && this._debouncedMobileFilter.cancel) {
      this._debouncedMobileFilter.cancel();
    }
    // Clear search
    this._searchInput.value = '';
    this._searchQuery = '';
    this._hideCreateError();
    // Drop any remote answer (and a request still in flight): the next open
    // starts from the select's own options, picked rows included.
    this._endRemote();
    this._wrapper.classList.remove('ks-searching');
    this._wrapper.classList.remove('ks-search-focused');
    this._filterOptions('');
    // Clear mobile search too
    if (this._mobileSearchInput) {
      this._mobileSearchInput.value = '';
    }
    // Remove focus highlights
    const focused = this._dropdown.querySelector('.ks-option-focused');
    if (focused) focused.classList.remove('ks-option-focused');

    this._dispatch('kselect:close');
  };

  Kselect.prototype._positionDropdown = function () {
    const rect = this._control.getBoundingClientRect();

    // Use the visual viewport when available. On iOS Safari, the layout
    // viewport doesn't shrink when the on-screen keyboard appears — the page
    // scrolls up and `window.innerHeight` keeps reporting the full layout
    // height, so the dropdown can end up underneath the keyboard. The visual
    // viewport's height/offsetTop reflect the actually-visible area and let
    // us clamp correctly.
    const vv = window.visualViewport;
    const visTop    = vv ? vv.offsetTop : 0;
    const visLeft   = vv ? vv.offsetLeft : 0;
    const visHeight = vv ? vv.height : window.innerHeight;
    const visWidth  = vv ? vv.width : window.innerWidth;
    const visBottom = visTop + visHeight;

    const spaceBelow = visBottom - rect.bottom;
    const spaceAbove = rect.top - visTop;
    const maxH = this.options.maxHeight;
    const dropup = spaceBelow < Math.min(maxH, 200) && spaceAbove > spaceBelow;

    if (dropup) {
      this._wrapper.classList.add('ks-dropup');
      this._dropdown.classList.add('ks-dropup');
    } else {
      this._wrapper.classList.remove('ks-dropup');
      this._dropdown.classList.remove('ks-dropup');
    }

    // Apply fixed coordinates so the dropdown escapes any
    // overflow:hidden or overflow:scroll ancestor on the user's page.
    // Fixed positioning is anchored to the layout viewport, not the visual
    // viewport — so we use rect coordinates (which are also layout-relative)
    // directly, and only clamp `maxHeight` against the visible area.
    const dd = this._dropdown;
    dd.style.width = rect.width + 'px';
    dd.style.left  = rect.left + 'px';

    if (dropup) {
      const clampedMaxH = Math.max(40, Math.min(maxH, spaceAbove - 8));
      dd.style.maxHeight = clampedMaxH + 'px';

      // When the visual viewport hasn't been shifted (no keyboard, no pinch
      // zoom), `bottom`-based positioning is fastest and avoids a reflow.
      // When it HAS been shifted, `bottom` would anchor to the layout-viewport
      // bottom — i.e. underneath the keyboard — so we measure and use top.
      // A mounted dropdown always uses top: its `bottom` would be the mount's.
      if (!this._mount && visTop === 0 && visLeft === 0) {
        dd.style.top    = '';
        dd.style.bottom = (window.innerHeight - rect.top + 1.5) + 'px';
      } else {
        dd.style.bottom = '';
        // First put it somewhere harmless to measure, then move into place.
        dd.style.top = '0px';
        const actualHeight = dd.offsetHeight;
        dd.style.top = (rect.top - actualHeight - 1.5) + 'px';
      }
    } else {
      dd.style.top       = (rect.bottom - 1.5) + 'px';
      dd.style.bottom    = '';
      dd.style.maxHeight = Math.max(40, Math.min(maxH, spaceBelow - 8)) + 'px';
    }

    // Avoid horizontal overflow when the visual viewport is narrower than the
    // layout viewport (e.g. iOS pinch-zoom, or right-side keyboard accessory).
    const visRight = visLeft + visWidth;
    const ddRight = rect.left + rect.width;
    if (ddRight > visRight) {
      dd.style.left = Math.max(visLeft, visRight - rect.width) + 'px';
    }

    // A mounted dropdown is absolutely positioned inside its parent: translate
    // the viewport coordinates above into the parent's padding box, allowing
    // for its border and its own scroll offset.
    if (this._mount) {
      const pRect = this._mount.getBoundingClientRect();
      const ox = pRect.left + this._mount.clientLeft - this._mount.scrollLeft;
      const oy = pRect.top + this._mount.clientTop - this._mount.scrollTop;
      dd.style.left = (parseFloat(dd.style.left) - ox) + 'px';
      dd.style.top = (parseFloat(dd.style.top) - oy) + 'px';
    }
  };

  // ─── Select-all helpers ───────────────────────────────────────────────────────

  // Returns the enabledOptions for a scope (global or a specific optgroup element)
  Kselect.prototype._scopeOptions = function (optgroup) {
    const opts = optgroup
      ? Array.prototype.filter.call(optgroup.children, function (o) { return o.tagName === 'OPTION' && !o.disabled; })
      : Array.prototype.filter.call(this.select.options, function (o) { return !o.disabled; });
    // While a search filter is active, restrict the scope to options whose
    // rendered <li> is currently visible. Otherwise select-all would silently
    // toggle hidden items the user can't see.
    if (this._searchQuery) {
      const self = this;
      return opts.filter(function (o) { return self._isOptionVisible(o); });
    }
    return opts;
  };

  // Returns true if `option` has at least one rendered <li> that isn't hidden
  // by the active filter. Uses the li→option back-reference so duplicate-value
  // options whose text differs are evaluated individually.
  Kselect.prototype._isOptionVisible = function (option) {
    const lis = this._itemMap && this._itemMap[option.value];
    if (!lis) return false;
    for (let i = 0; i < lis.length; i++) {
      if (lis[i]._kselectOption === option && !lis[i].classList.contains('ks-hidden')) {
        return true;
      }
    }
    return false;
  };

  Kselect.prototype._toggleSelectAll = function () {
    // A remote answer is a page the server chose, not a scope the user can
    // see whole; select-all is hidden while one is shown (.ks-remote), and the
    // keyboard can still reach the row in the search-in-row layout.
    if (this._remote) return;
    const enabledOpts = this._scopeOptions(null);
    const allSelected = enabledOpts.every(function (o) { return o.selected; });
    const self = this;
    const limit = this.options.maxSelect;
    // When selecting all, only tick as many as the limit allows (already-selected
    // ones "cost" nothing extra since they're already counted).
    let toSelect = 0;
    if (!allSelected && limit != null) {
      const alreadySelected = enabledOpts.filter(function (o) { return o.selected; }).length;
      toSelect = limit - alreadySelected; // remaining capacity
    }
    let selectBudget = !allSelected && limit != null ? toSelect : Infinity;
    enabledOpts.forEach(function (o) {
      if (allSelected) {
        o.selected = false;
      } else {
        if (!o.selected) {
          if (selectBudget > 0) {
            o.selected = true;
            selectBudget--;
          }
          // else leave unselected — already at limit
        }
        // already-selected stay selected
      }
      self._setLiSelectedState(o.value, o.selected);
    });
    this._updateSelectAllState();
    this._updateControl();
    this._dispatch('input');
    this._dispatch('change');
    this._dispatch('kselect:change');
  };

  Kselect.prototype._toggleSelectAllGroup = function (optgroup) {
    const enabledOpts = this._scopeOptions(optgroup);
    const allSelected = enabledOpts.every(function (o) { return o.selected; });
    const self = this;
    const limit = this.options.maxSelect;
    let selectBudget = Infinity;
    if (!allSelected && limit != null) {
      const totalSelected = Array.prototype.filter.call(self.select.options, function (o) { return o.selected; }).length;
      selectBudget = limit - totalSelected;
    }
    enabledOpts.forEach(function (o) {
      if (allSelected) {
        o.selected = false;
      } else {
        if (!o.selected) {
          if (selectBudget > 0) {
            o.selected = true;
            selectBudget--;
          }
        }
      }
      self._setLiSelectedState(o.value, o.selected);
    });
    this._updateSelectAllState();
    this._updateControl();
    this._dispatch('input');
    this._dispatch('change');
    this._dispatch('kselect:change');
  };

  // Sync the visual state (unchecked / indeterminate / checked) of all
  // select-all rows to match the current selection.
  Kselect.prototype._updateSelectAllState = function () {
    if (!this.isMultiple) return;

    // Global select-all
    if (this._selectAllEl) {
      const enabled = this._scopeOptions(null);
      const selectedCount = enabled.filter(function (o) { return o.selected; }).length;
      const allChecked  = selectedCount === enabled.length && enabled.length > 0;
      const someChecked = selectedCount > 0 && !allChecked;
      this._applySelectAllVisual(this._selectAllEl, allChecked, someChecked);
    }

    // Per-group select-all rows
    const self = this;
    Object.keys(this._groupSelectAllMap || {}).forEach(function (groupId) {
      const li = self._groupSelectAllMap[groupId];
      // Find the matching optgroup by its encoded label
      const optgroups = Array.prototype.slice.call(self.select.querySelectorAll('optgroup'));
      let optgroup = null;
      for (let i = 0; i < optgroups.length; i++) {
        if (self.id + '-group-' + encodeURIComponent(optgroups[i].label) === groupId) {
          optgroup = optgroups[i];
          break;
        }
      }
      if (!optgroup) return;
      const enabled = self._scopeOptions(optgroup);
      const selectedCount = enabled.filter(function (o) { return o.selected; }).length;
      const allChecked  = selectedCount === enabled.length && enabled.length > 0;
      const someChecked = selectedCount > 0 && !allChecked;
      self._applySelectAllVisual(li, allChecked, someChecked);
    });
  };

  Kselect.prototype._applySelectAllVisual = function (el, allChecked, someChecked) {
    // el is the global select-all row or a group's select-all; both are
    // options (1.11.1: the group's was a button, with aria-pressed).
    el.classList.toggle('ks-option-selected', allChecked);
    el.classList.toggle('ks-select-all-indeterminate', someChecked);
    el.setAttribute('aria-selected', allChecked ? 'true' : 'false');
  };

  // ─── Selection ───────────────────────────────────────────────────────────────

  // Update the visual selected state for every <li> that represents `value`.
  // (Multiple <li>s can share a value if the underlying <select> has duplicates.)
  Kselect.prototype._setLiSelectedState = function (value, selected) {
    const lis = this._itemMap && this._itemMap[value];
    if (!lis) return;
    for (let i = 0; i < lis.length; i++) {
      lis[i].classList.toggle('ks-option-selected', selected);
      lis[i].setAttribute('aria-selected', selected ? 'true' : 'false');
    }
  };

  Kselect.prototype._selectOption = function (value) {
    this._materialize(value);
    // Find all <option>s with this value (duplicates are legal HTML).
    const matches = Array.prototype.filter.call(
      this.select.options,
      function (o) { return o.value === value && !o.disabled; }
    );
    if (!matches.length) return;

    if (this.isMultiple) {
      // Toggle: if any are selected, deselect all; otherwise select all.
      const anySelected = matches.some(function (o) { return o.selected; });
      const newState = !anySelected;

      // Enforce maxSelect: if we're trying to select (not deselect) and the
      // limit is already reached, silently bail out — the UI already greys
      // out unselected options when ks-at-limit is on the wrapper.
      if (newState && this.options.maxSelect != null) {
        const currentCount = Array.prototype.filter.call(this.select.options, function (o) { return o.selected; }).length;
        if (currentCount >= this.options.maxSelect) return;
      }

      matches.forEach(function (o) { o.selected = newState; });
      this._setLiSelectedState(value, newState);
    } else {
      // Single-select: deselect everything, then select all matches with this value.
      Array.prototype.forEach.call(this.select.options, function (o) { o.selected = false; });
      const self = this;
      Object.keys(this._itemMap || {}).forEach(function (v) {
        self._setLiSelectedState(v, false);
      });
      matches.forEach(function (o) { o.selected = true; });
      this._setLiSelectedState(value, true);

      if (this.options.closeOnSelect) this.close();
    }

    this._updateSelectAllState();
    this._updateControl();
    // Keep mobile selection display in sync when the modal is open
    if (this._mobileOverlay && this._mobileOverlay.classList.contains('ks-mobile-overlay-open')) {
      this._updateMobileSelection();
    }
    this._dispatch('input');
    this._dispatch('change');
    this._dispatch('kselect:change');
  };

  Kselect.prototype._updateControl = function () {
    const self = this;
    const selected = Array.prototype.filter.call(this.select.options, function (o) { return o.selected; });

    // Clear existing tags / text
    this._selection.innerHTML = '';

    // ── maxSelect limit badge ──
    if (this.isMultiple && this.options.maxSelect != null) {
      const count = selected.length;
      const limit = this.options.maxSelect;
      const atLimit = count >= limit;
      this._wrapper.classList.toggle('ks-at-limit', atLimit);
      // The dropdown lives in <body>, so toggle the class directly on it
      // (same pattern as ks-dropup) so the CSS notice selector works.
      if (this._dropdown) this._dropdown.classList.toggle('ks-at-limit', atLimit);
      // Update the notice banner text
      if (this._limitNotice) {
        const noticeText = this._limitNotice.querySelector('.ks-limit-notice-text');
        if (noticeText) {
          noticeText.textContent = formatText(this.options.maxSelectText, 'n', limit);
        }
      }
      // Update unselected option rows: add ks-option-at-limit when at the cap
      // so they appear greyed-out without being truly disabled (they must still
      // be clickable to deselect, but we block new selections in _selectOption).
      if (this._optionsList) {
        const allOptionEls = this._optionsList.querySelectorAll('.ks-option:not(.ks-option-disabled):not(.ks-select-all):not(.ks-create)');
        Array.prototype.forEach.call(allOptionEls, function (li) {
          const isSelected = li.classList.contains('ks-option-selected');
          const blocked = atLimit && !isSelected;
          li.classList.toggle('ks-option-at-limit', blocked);
          // Unavailable is what it is, to a screen reader as to the eye — and
          // a disabled option's greyed text is exempt from the contrast minimum.
          if (blocked) li.setAttribute('aria-disabled', 'true');
          else li.removeAttribute('aria-disabled');
        });
      }
      // Limit badge text: show "n / limit" always; swap style at limit
      this._limitBadge.textContent = count + '\u202f/\u202f' + limit; // narrow-space slashes
      this._limitBadge.style.display = '';
      this._limitBadge.classList.toggle('ks-limit-reached', atLimit);
      // Announce to screen readers via the live region when the limit is first hit
      if (atLimit && this._liveRegion) {
        const msg = formatText(this.options.maxSelectText, 'n', limit);
        this._liveRegion.textContent = msg;
      } else if (!atLimit && this._liveRegion) {
        this._liveRegion.textContent = '';
      }
    } else {
      if (this._limitBadge) this._limitBadge.style.display = 'none';
      if (this._wrapper) this._wrapper.classList.remove('ks-at-limit');
      if (this._dropdown) this._dropdown.classList.remove('ks-at-limit');
    }
    // The create row is unavailable at the limit, and says why.
    if (this.options.maxSelect != null) this._updateCreate();

    if (selected.length === 0) {
      this._placeholder.style.display = '';
      this._clearBtn.style.display = 'none';
      return;
    }

    this._placeholder.style.display = 'none';
    this._clearBtn.style.display = '';

    if (this.isMultiple) {
      selected.forEach(function (o) {
        const tag = document.createElement('span');
        tag.className = 'ks-tag';
        self._carryAttrs(tag, o);
        const labelSpan = document.createElement('span');
        labelSpan.className = 'ks-tag-label';
        self._setLabel(labelSpan, o);
        tag.appendChild(labelSpan);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'ks-tag-remove';
        removeBtn.setAttribute('aria-label', formatText(self.options.removeTagText, 'label', o.text));
        self._markUiLang(removeBtn, tag);
        removeBtn.innerHTML = '<svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1L7 7M7 1L1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          self._selectOption(o.value); // toggle off
        });
        tag.appendChild(removeBtn);
        self._selection.appendChild(tag);
      });
      this._maybeSummarize(selected.length);
    } else {
      const single = document.createElement('span');
      single.className = 'ks-single-value';
      this._carryAttrs(single, selected[0]);
      self._setLabel(single, selected[0]);
      this._selection.appendChild(single);
    }
  };

  // After tag rendering, decide whether to swap the tag list out for a
  // "{n} selected" summary. The decision depends on the summarizeSelected
  // option:
  //   'off' or false → never summarize (keep all tags)
  //   number n       → summarize when count > n
  //   'auto'         → summarize when the rendered tags wrapped to a second line
  //              (detected by comparing offsetTop of the first vs last tag)
  // 'auto' has to run after the tags are in the DOM because it relies on
  // measured layout — there's no way to know up-front whether N tags of
  // varying widths will fit in the wrapper's current width.
  Kselect.prototype._maybeSummarize = function (count) {
    if (!this.isMultiple || count === 0) return;
    const opt = this.options.summarizeSelected;
    if (opt === 'off' || opt === false) return;

    let shouldSummarize;
    if (typeof opt === 'number') {
      shouldSummarize = count > opt;
    } else {
      const tags = this._selection.children;
      if (tags.length < 2) return;
      shouldSummarize = tags[0].offsetTop !== tags[tags.length - 1].offsetTop;
    }

    if (!shouldSummarize) return;

    this._selection.innerHTML = '';
    const summary = document.createElement('span');
    summary.className = 'ks-summary';
    summary.textContent = formatText(this.options.summarizeSelectedText, 'n', count);
    this._selection.appendChild(summary);
  };

  Kselect.prototype._syncFromSelect = function () {
    this._updateControl();
    this._updateSelectAllState();
    // Sync checked state on items
    const self = this;
    if (!this._itemMap) return;
    Array.prototype.forEach.call(this.select.options, function (o) {
      self._setLiSelectedState(o.value, o.selected);
    });
  };

  // ─── Search / Filter ─────────────────────────────────────────────────────────

  Kselect.prototype._filterOptions = function (query) {
    // The server is the filter: a remote answer is shown whole, never
    // re-filtered by the query (it may have matched on fields the label
    // doesn't show). No-results means the server answered with nothing.
    if (this._remote) {
      const count = this._remote.options.length;
      const offerCreate = this._updateCreate();
      this._setNoResults(count === 0 && !offerCreate);
      this._updateSelectAllState();
      this._announceResults(count, offerCreate);
      return;
    }

    const q = query.toLowerCase().trim();
    const rawQ = query.trim();
    const self = this;
    // With create on, a row that already *is* the query (by createMatch —
    // "Finances" for "finançes") is shown even when the substring filter
    // would hide it: it is the answer, and hiding it would offer to create a
    // duplicate of it.
    const createOn = typeof this.options.create === 'function' && !!rawQ;
    let visibleCount = 0;

    // Show/hide regular options (skip select-all rows — they're handled separately).
    // We use a .ks-hidden class rather than inline style so the visibility
    // signal is a clean boolean and not subject to "display:none" string
    // matching against arbitrary inline styles.
    Array.prototype.forEach.call(this._optionsList.querySelectorAll('.ks-option:not(.ks-select-all):not(.ks-create)'), function (li) {
      const label = (li.querySelector('.ks-option-text') || li).textContent;
      const text = label.toLowerCase();
      const match = !q || text.indexOf(q) !== -1 || (createOn && self._createMatches(rawQ, label));
      li.classList.toggle('ks-hidden', !match);
      if (match) visibleCount++;
    });

    // Show group headers if any child option is visible; auto-expand on search.
    // Empty optgroups (no .ks-option children at all) reach this loop only when
    // showEmptyOptGroups is true (_renderGroup skips them otherwise), so they
    // stay visible regardless of the search state.
    Array.prototype.forEach.call(this._optionsList.querySelectorAll('.ks-group:not(.ks-group-static)'), function (group) {
      const allChildren = group.querySelectorAll('.ks-option:not(.ks-select-all)');
      if (allChildren.length === 0) {
        group.classList.remove('ks-hidden');
        return;
      }
      const visibleChildren = group.querySelectorAll('.ks-option:not(.ks-select-all):not(.ks-hidden)');
      const hasVisible = visibleChildren.length > 0;
      group.classList.toggle('ks-hidden', !hasVisible);
      // When searching, expand groups that have matches
      if (q && hasVisible) {
        const groupList = group.querySelector('.ks-group-options');
        if (groupList) groupList.style.display = '';
        group.classList.remove('ks-group-collapsed');
      }
    });

    // Global select-all: hide when no results. (Until 1.11.1 it housed the
    // search input in search-in-row mode and had to stay; the search box has
    // its own row now.)
    if (self._selectAllEl) {
      self._selectAllEl.classList.toggle('ks-hidden', visibleCount === 0);
    }

    const offerCreate = this._updateCreate();
    this._setNoResults(visibleCount === 0 && !offerCreate);

    // Select-all rows toggle against the visible scope while filtering, so
    // their checked/indeterminate visual needs to follow the filter too.
    this._updateSelectAllState();

    // Announce result count / no-results to screen readers via the live region
    if (q) {
      this._announceResults(visibleCount, offerCreate);
    } else {
      this._liveRegion.textContent = '';
    }
  };

  // Both "no results" lines, the dropdown's and the mobile sheet's.
  Kselect.prototype._setNoResults = function (show) {
    this._noResults.style.display = show ? '' : 'none';
    this._mobileNoResults.style.display = show ? '' : 'none';
  };

  // "3 results" in the page's language: resultsText as a function(n) for a
  // language with its own plural rules, else resultText for exactly one and
  // resultsText for the rest. A host that translated resultsText but not
  // resultText gets its own wording for one as well, not the English default.
  Kselect.prototype._resultsText = function (n) {
    const many = this.options.resultsText;
    if (typeof many === 'function') return String(many.call(this, n));
    const one = this.options.resultText;
    const oneIsStale = one === DEFAULT_TEXTS.resultText && many !== DEFAULT_TEXTS.resultsText;
    if (n === 1 && one !== null && one !== undefined && !oneIsStale) return formatText(one, 'n', n);
    return formatText(many, 'n', n);
  };

  // The live region after a search: the count, the create row when it is
  // offered ("3 results, or create “x”"), or no-results.
  Kselect.prototype._announceResults = function (count, offerCreate) {
    const query = (this._searchQuery || '').trim();
    let msg;
    if (offerCreate) {
      msg = count === 0
        ? fillText(this.options.createOnlyText, { query: query })
        : fillText(this.options.resultsCreateText, { results: this._resultsText(count), query: query });
    } else {
      msg = count === 0 ? this.options.noResultsText : this._resultsText(count);
    }
    this._liveRegion.textContent = msg;
  };

  // ─── Creating an option (create option) ─────────────────────────────────────

  // Does `label` already say what the user typed? The host's createMatch, or
  // by default: equal at the collator's base strength in the page's language
  // — case and accents ignored ("Finances", "finances", "finançes"), but not
  // the letters a language counts as its own (Swedish keeps "Öst" apart from
  // "ost"). Whitespace runs count as one space. Without Intl, a plain fold.
  Kselect.prototype._createMatches = function (query, label) {
    const fn = this.options.createMatch;
    if (typeof fn === 'function') {
      try {
        return !!fn.call(this, query, label);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) console.warn('kselect: createMatch threw', err);
        return false;
      }
    }
    if (this._collator === undefined) {
      this._collator = null;
      if (typeof Intl !== 'undefined' && Intl.Collator) {
        const langEl = this.select.closest ? this.select.closest('[lang]') : null;
        const lang = langEl ? langEl.getAttribute('lang') : '';
        try {
          this._collator = new Intl.Collator(lang || undefined, { sensitivity: 'base', usage: 'search' });
        } catch (e) {
          try { this._collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' }); } catch (e2) { /* fold */ }
        }
      }
    }
    const tidy = function (s) { return String(s).replace(/\s+/g, ' ').trim(); };
    if (this._collator) return this._collator.compare(tidy(query), tidy(label)) === 0;
    return foldText(query) === foldText(label);
  };

  // Places, labels and shows or hides the create row, and returns whether it
  // is offered (shown and pickable, for the announcement and no-results).
  // Called after every rebuild and filter pass, when loading starts or ends,
  // and when the selection count changes (maxSelect).
  //
  // It is shown while a create is pending, whatever the query (so the user
  // sees it working); otherwise for a non-empty query that no offered row
  // matches, and never while load() is pending — it would flicker in and out
  // between keystrokes, and the answer may well contain the query.
  Kselect.prototype._updateCreate = function () {
    const row = this._createEl;
    if (!row || !this._optionsList) return false;
    const list = this._optionsList;
    const pending = this._createPending;
    const query = pending ? pending.query : (this._searchQuery || '').trim();

    // Place it: last, or first (after the select-all row, which heads the list).
    if (this.options.createPosition === 'start') {
      const after = this._selectAllEl && this._selectAllEl.parentNode === list ? this._selectAllEl : null;
      const ref = after ? after.nextSibling : list.firstChild;
      if (ref !== row) list.insertBefore(row, ref);
    } else if (list.lastChild !== row) {
      list.appendChild(row);
    }
    row.classList.toggle('ks-create-start', this.options.createPosition === 'start');

    const rows = list.querySelectorAll('.ks-option:not(.ks-select-all):not(.ks-create):not(.ks-hidden)');
    let show = !!pending;
    if (!pending && query && !this._loading) {
      show = true;
      for (let i = 0; i < rows.length; i++) {
        if (!rows[i]._kselectOption) continue;
        const text = rows[i].querySelector('.ks-option-text');
        if (this._createMatches(query, text ? text.textContent : rows[i].textContent)) { show = false; break; }
      }
    }
    // Alone in the list, it needs no rule separating it from rows.
    row.classList.toggle('ks-create-alone', rows.length === 0);

    const atLimit = !pending && this.isMultiple && this.options.maxSelect != null &&
      Array.prototype.filter.call(this.select.options, function (o) { return o.selected; }).length >= this.options.maxSelect;

    this._createLabel.textContent = formatText(pending ? this.options.creatingText : this.options.createText, 'query', query);
    this._createDetail.textContent = atLimit ? formatText(this.options.maxSelectText, 'n', this.options.maxSelect) : '';
    row.classList.toggle('ks-option-has-detail', atLimit);
    row.classList.toggle('ks-option-at-limit', atLimit);
    if (atLimit) row.setAttribute('aria-disabled', 'true');
    else row.removeAttribute('aria-disabled');
    row.classList.toggle('ks-create-pending', !!pending);
    if (pending) row.setAttribute('aria-busy', 'true');
    else row.removeAttribute('aria-busy');

    const wasShown = !row.classList.contains('ks-hidden');
    row.classList.toggle('ks-hidden', !show);
    // A hidden row cannot stay the active descendant.
    if (!show && wasShown && row.classList.contains('ks-option-focused')) {
      row.classList.remove('ks-option-focused');
      this._control.removeAttribute('aria-activedescendant');
      this._searchInput.removeAttribute('aria-activedescendant');
    }
    return show && !pending && !atLimit;
  };

  // The create row was picked (Enter, click or tap). Fires kselect:create —
  // cancelable, so a host can take over entirely — and otherwise calls
  // create(query) and waits for it. One create at a time: picking the row
  // again while one is pending does nothing.
  Kselect.prototype._activateCreate = function () {
    const row = this._createEl;
    if (!row || this._createPending || row.classList.contains('ks-hidden')) return;
    if (row.classList.contains('ks-option-at-limit')) return;
    // The search box may be ahead of the list (its filter is debounced): act
    // on what is typed, not on the query of a moment ago. With load() that
    // means asking the server first; the row returns with the answer.
    const input = this._isSheetOpen() ? this._mobileSearchInput : this._searchInput;
    if (input && input.value !== (this._searchQuery || '')) {
      if (this._debouncedFilter) this._debouncedFilter.cancel();
      if (this._debouncedMobileFilter) this._debouncedMobileFilter.cancel();
      this._wrapper.classList.toggle('ks-searching', input.value.length > 0);
      this._applySearch(input.value);
      if (row.classList.contains('ks-hidden') || this._loading) return;
    }
    const query = (this._searchQuery || '').trim();
    if (!query) return;
    this._hideCreateError();

    const event = this._dispatch('kselect:create', { query: query }, true);
    if (event.defaultPrevented) return;

    const self = this;
    this._createPending = { query: query };
    [this._wrapper, this._dropdown, this._mobileOverlay].forEach(function (el) {
      el.classList.add('ks-creating');
    });
    this._updateCreate();
    this._liveRegion.textContent = formatText(this.options.creatingText, 'query', query);

    let result;
    try {
      result = this.options.create.call(this, query);
    } catch (err) {
      result = Promise.reject(err);
    }
    Promise.resolve(result).then(function (item) {
      self._createSettled(query, item, null, false);
    }, function (err) {
      self._createSettled(query, null, err, true);
    });
  };

  // create() answered. A value or a record becomes a selected <option> — or,
  // when the select already has one with that value (the server answered an
  // existing tag), that option is selected and nothing is added. null or
  // undefined means the host chose not to create (its dialog was dismissed):
  // everything stays as it was, quietly. A rejection, a throw or an answer
  // without a value keeps the query and shows why, in the list and the live
  // region. Afterwards, focus that was lost (or left in the widget) comes
  // back to the search box, or to the control if the list has closed.
  Kselect.prototype._createSettled = function (query, item, err, failed) {
    if (this._destroyed) return;
    const self = this;
    this._createPending = null;
    this._createGuard = true;
    [this._wrapper, this._dropdown, this._mobileOverlay].forEach(function (el) {
      el.classList.remove('ks-creating');
    });

    if (!failed && item !== null && item !== undefined && item !== false) {
      const record = typeof item === 'object' ? item : { value: item };
      if (record.value === undefined || record.value === null || record.value === '') {
        failed = true;
        err = new TypeError('create() must answer a value or { value, label }');
      } else {
        const outcome = this._commitCreated(query, record);
        if (outcome) { failed = true; err = outcome; }
      }
    } else if (!failed) {
      this._liveRegion.textContent = '';
    }

    if (failed) {
      let message = '';
      if (typeof err === 'string') message = err;
      else if (err && !isRuntimeError(err) && typeof err.message === 'string') message = err.message;
      if (!message) {
        if (err && typeof console !== 'undefined' && console.warn) {
          console.warn('kselect: create() failed; nothing was added', err);
        }
        message = formatText(this.options.createErrorText, 'query', query);
      }
      this._updateCreate();
      // A list the user has closed shows nothing; the next open starts afresh.
      if (this._open) this._showCreateError(message);
    } else {
      this._updateCreate();
    }
    this._restoreFocusAfterCreate();
  };

  // Adds (or finds) the created option and selects it, then tidies the list.
  // Returns an Error to report instead, or null.
  Kselect.prototype._commitCreated = function (query, record) {
    const value = String(record.value);
    let option = this._nativeOption(value);
    if (!option) {
      if (this.isMultiple && this.options.maxSelect != null &&
          Array.prototype.filter.call(this.select.options, function (o) { return o.selected; }).length >= this.options.maxSelect) {
        return new Error(formatText(this.options.maxSelectText, 'n', this.options.maxSelect));
      }
      // The label falls back to what the user typed. Under allowHtml an
      // option's text is markup, so the typed text is escaped into it.
      option = optionFromItem(record, value, this.options.allowHtml ? escapeHtml(query) : query);
      this.select.appendChild(option);
      // Our own mutation: drop the observer's record of it (see _materialize).
      if (this._selectObserver) this._selectObserver.takeRecords();
    }

    const sameQuery = (this._searchQuery || '').trim() === query;
    if (!option.selected) {
      if (option.disabled) return new Error(formatText(this.options.createErrorText, 'query', query));
      this._selectOption(value);
    } else if (!this.isMultiple && this.options.closeOnSelect) {
      // Already the value: nothing changed, so no events — but the pick is done.
      this.close();
    }

    if (!this._open) return null;
    if (sameQuery) {
      // The query is answered: clear it, as the next thing the user types is
      // usually the next tag, and show the select's own options again.
      if (this._debouncedFilter) this._debouncedFilter.cancel();
      if (this._debouncedMobileFilter) this._debouncedMobileFilter.cancel();
      this._searchInput.value = '';
      if (this._mobileSearchInput) this._mobileSearchInput.value = '';
      this._wrapper.classList.remove('ks-searching');
      this._applySearch('');
    } else {
      // A newer query is on screen: keep its rows and do not search again —
      // only re-render, so the new option shows its state if it is listed.
      this._buildOptionsList();
      this._syncFromSelect();
      this._filterOptions(this._searchQuery || '');
    }
    // Keyboard focus on the new option, so a screen reader hears it, selected.
    const lis = this._itemMap && this._itemMap[value];
    const li = lis && lis.filter(function (l) { return l.offsetParent !== null; })[0];
    if (li && !this._isSheetOpen()) {
      this._seedFocus(li);
      li.scrollIntoView({ block: 'nearest' });
    }
    return null;
  };

  Kselect.prototype._isSheetOpen = function () {
    return !!(this._mobileOverlay && this._mobileOverlay.classList.contains('ks-mobile-overlay-open'));
  };

  // A failure line beside the listbox (not in it: it is not an option), on
  // the side the create row is on. The live region announces it once; the
  // line itself is not a second live region.
  Kselect.prototype._showCreateError = function (message) {
    const el = this._createError;
    if (!el) return;
    const list = this._optionsList;
    if (list.parentNode) {
      list.parentNode.insertBefore(el, this.options.createPosition === 'start' ? list : list.nextSibling);
    }
    el.textContent = message;
    el.style.display = '';
    this._liveRegion.textContent = message;
  };

  Kselect.prototype._hideCreateError = function () {
    if (this._createError && this._createError.style.display !== 'none') {
      this._createError.style.display = 'none';
      this._createError.textContent = '';
    }
  };

  // Is the event inside an open dialog other than one holding this widget?
  // (Native <dialog> and ARIA modals alike.)
  Kselect.prototype._inForeignDialog = function (e) {
    const path = e.composedPath ? e.composedPath() : [];
    for (let i = 0; i < path.length; i++) {
      const el = path[i];
      if (!el || el.nodeType !== 1) continue;
      // A <dialog> counts closed as well: the click that closed it is still
      // on its way up.
      const isDialog = el.tagName === 'DIALOG' ||
        el.getAttribute('aria-modal') === 'true' || el.getAttribute('role') === 'dialog' ||
        el.getAttribute('role') === 'alertdialog';
      if (isDialog && !el.contains(this._wrapper) && el !== this._mobileOverlay) return true;
    }
    return false;
  };

  // After create() settles. A host dialog may have taken focus and, on
  // closing, dropped it on <body> (or handed it back to the search box): in
  // either case it goes to the search box while the list is open, else to the
  // control. Focus somewhere else on the page — the user moved on, or the
  // host's dialog is still open — is left alone. Deferred a task, so a dialog
  // the host closes right after resolving has closed (and stopped making the
  // page inert) first. In the phone sheet nothing is focused: a tap left no
  // focus behind, and focusing its search box would raise the keyboard.
  Kselect.prototype._restoreFocusAfterCreate = function () {
    const self = this;
    setTimeout(function () {
      self._createGuard = false;
      if (self._destroyed) return;
      const active = rootOf(self.select).activeElement || document.activeElement;
      const lost = !active || active === document.body || active === document.documentElement;
      const inWidget = !!active && (self._wrapper.contains(active) || self._dropdown.contains(active) ||
        (self._mobileOverlay && self._mobileOverlay.contains(active)));
      if (!lost && !inWidget) return;
      if (self._open) {
        if (self._isSheetOpen()) return;
        const target = self.options.searchable ? self._searchInput : self._control;
        if (active !== target) target.focus();
      } else if (active !== self._control) {
        self._control.focus();
      }
    }, 0);
  };

  // ─── Remote source (load option) ─────────────────────────────────────────────

  // Turns a load() answer into detached <option>s: value as a string, label
  // falling back to the value, detail carried as data-ks-detail (rendered as
  // plain text by _renderOption), className as the option's class and color
  // as data-ks-color (both carried to its row and tag by _carryAttrs, as a
  // hand-written option's are), disabled as disabled. `group` is kept on the
  // option for _renderRemote and never reaches the select. Rows without a
  // value, and repeats of a value already seen, are dropped — one row per
  // value keeps _materialize exact.
  function remoteOptions(items) {
    const out = [];
    const seen = {};
    items.forEach(function (item) {
      if (!item || item.value === undefined || item.value === null) return;
      const value = String(item.value);
      if (seen[value]) return;
      seen[value] = true;
      const o = optionFromItem(item, value, value);
      if (item.disabled) o.disabled = true;
      o._ksGroup = item.group === undefined || item.group === null || item.group === '' ? null : String(item.group);
      out.push(o);
    });
    return out;
  }

  // One path for both search boxes (the dropdown's and the mobile sheet's).
  // With `load`, a query of loadMinChars or more goes to the server; anything
  // shorter — and every query without `load` — filters the select's own
  // options locally, as kselect always has.
  Kselect.prototype._applySearch = function (value) {
    this._searchQuery = value;
    // A failed create's message belongs to the query it was for.
    this._hideCreateError();
    const q = value.trim();
    if (typeof this.options.load === 'function' && q && q.length >= this.options.loadMinChars) {
      this._startLoad(q);
    } else {
      this._endRemote();
      this._filterOptions(value);
    }
  };

  // Calls load(query, signal) and shows its answer, unless a later search (or
  // close/destroy) has overtaken it. Overtaken requests are aborted through
  // their AbortSignal, and their answers ignored even if load() disregards
  // the signal. A throw, a rejection or a non-array answer leaves the list as
  // it was; nothing escapes to the page beyond a console warning.
  Kselect.prototype._startLoad = function (q) {
    const self = this;
    if (this._remote && this._remote.query === q && !this._loading) return;
    this._abortLoad();
    const seq = this._loadSeq;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    this._loadController = ctrl;
    this._setLoading(true);

    let result;
    try {
      result = this.options.load.call(this, q, ctrl ? ctrl.signal : undefined);
    } catch (err) {
      result = Promise.reject(err);
    }
    Promise.resolve(result).then(function (items) {
      if (seq !== self._loadSeq) return;
      if (!Array.isArray(items)) throw new TypeError('load() must resolve to an array');
      self._loadController = null;
      self._setLoading(false);
      self._remote = { query: q, options: remoteOptions(items) };
      self._buildOptionsList();
      self._syncFromSelect();
      // The rows aria-activedescendant pointed at were just replaced, and a
      // new answer reads from its first row, whatever the old list's scroll.
      self._control.removeAttribute('aria-activedescendant');
      self._searchInput.removeAttribute('aria-activedescendant');
      self._optionsList.scrollTop = 0;
      self._filterOptions(self._searchQuery);
    }).catch(function (err) {
      if (seq !== self._loadSeq) return;
      self._loadController = null;
      self._setLoading(false);
      if (err && err.name === 'AbortError') return;
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('kselect: load() failed; the list is unchanged', err);
      }
    });
  };

  // Invalidates the request in flight, if any. Bumping the sequence is what
  // makes a late answer lose; abort() is the courtesy that lets fetch() stop.
  Kselect.prototype._abortLoad = function () {
    this._loadSeq = (this._loadSeq || 0) + 1;
    if (this._loadController) {
      this._loadController.abort();
      this._loadController = null;
    }
  };

  // Loading state on the wrapper, the dropdown and the mobile sheet (the
  // latter two may live in <body>): .ks-loading shows the loadingText line,
  // aria-busy marks both listboxes, and no-results stays hidden until the
  // server has actually answered.
  Kselect.prototype._setLoading = function (on) {
    this._loading = on;
    const self = this;
    [this._wrapper, this._dropdown, this._mobileOverlay].forEach(function (el) {
      el.classList.toggle('ks-loading', on);
    });
    // On the listbox, which is what is being filled — the same element on
    // desktop and in the sheet.
    if (on) this._optionsList.setAttribute('aria-busy', 'true');
    else this._optionsList.removeAttribute('aria-busy');
    if (on) self._setNoResults(false);
    // No create row while the answer is pending; it comes back with it.
    this._updateCreate();
  };

  // Back to the select's own options: cancels a pending request and, if a
  // remote answer was showing, rebuilds the list from the select.
  Kselect.prototype._endRemote = function () {
    this._abortLoad();
    if (this._loading) this._setLoading(false);
    if (this._remote) {
      this._remote = null;
      this._buildOptionsList();
      this._syncFromSelect();
    }
  };

  // Picking a row of a remote answer that the select has no <option> for adds
  // that row's detached <option> to the select, so the form posts it and the
  // ordinary selection path (and its input/change events) takes over. The
  // mutation is our own, so the autoSync observer's record of it is dropped
  // rather than rebuilding the list — a rebuild would discard keyboard focus.
  // Nothing is added when a multi select is at maxSelect: the pick would be
  // refused anyway.
  Kselect.prototype._materialize = function (value) {
    if (!this._remote || this._nativeOption(value)) return;
    let option = null;
    for (let i = 0; i < this._remote.options.length; i++) {
      if (this._remote.options[i].value === value) { option = this._remote.options[i]; break; }
    }
    if (!option) return;
    if (this.isMultiple && this.options.maxSelect != null) {
      const count = Array.prototype.filter.call(this.select.options, function (o) { return o.selected; }).length;
      if (count >= this.options.maxSelect) return;
    }
    this.select.appendChild(option);
    if (this._selectObserver) this._selectObserver.takeRecords();
  };

  // ─── Public API ──────────────────────────────────────────────────────────────

  Kselect.prototype.clear = function () {
    const self = this;
    let changed = false;
    Array.prototype.forEach.call(this.select.options, function (o) {
      if (o.selected) { o.selected = false; changed = true; }
    });
    // For single-mode <select>, the browser snaps selectedIndex back to 0
    // when every option is deselected (no "empty" state for a required
    // single-choice field). Force -1 so clear() truly clears.
    if (!this.isMultiple && this.select.selectedIndex !== -1) {
      this.select.selectedIndex = -1;
      changed = true;
    }
    if (!this._nativeMode) {
      Object.keys(this._itemMap || {}).forEach(function (v) {
        self._setLiSelectedState(v, false);
      });
      this._updateSelectAllState();
      this._updateControl();
    }
    if (changed) {
      this._dispatch('input');
      this._dispatch('change');
      // In native mode, the native change listener forwards 'change' to
      // 'kselect:change' for us — don't double-dispatch.
      if (!this._nativeMode) this._dispatch('kselect:change');
    }
  };

  Kselect.prototype.setValue = function (values) {
    // Normalise input. null/undefined → clear. Single value → wrap in array.
    // Use a Set to dedupe so setValue(['a','a']) doesn't toggle 'a' off again.
    let arr;
    if (values == null) {
      arr = [];
    } else if (Array.isArray(values)) {
      arr = [];
      const seen = {};
      for (let i = 0; i < values.length; i++) {
        const v = String(values[i]);
        if (!seen[v]) { seen[v] = true; arr.push(v); }
      }
    } else {
      arr = [String(values)];
    }

    // For a single select, only the last value in the array can win.
    if (!this.isMultiple && arr.length > 1) arr = [arr[arr.length - 1]];

    // Honour maxSelect: silently truncate to the first N values.
    if (this.isMultiple && this.options.maxSelect != null && arr.length > this.options.maxSelect) {
      arr = arr.slice(0, this.options.maxSelect);
    }

    // Mutate the underlying <select> atomically — no events fired yet.
    const wantSelected = {};
    arr.forEach(function (v) { wantSelected[v] = true; });
    let changed = false;
    Array.prototype.forEach.call(this.select.options, function (o) {
      const shouldBe = !!wantSelected[o.value] && !o.disabled;
      if (o.selected !== shouldBe) {
        o.selected = shouldBe;
        changed = true;
      }
    });
    // Single-mode browser snap-back: if we wanted nothing selected, force -1.
    if (!this.isMultiple && arr.length === 0 && this.select.selectedIndex !== -1) {
      this.select.selectedIndex = -1;
      changed = true;
    }

    // Repaint everything from the new ground truth.
    if (!this._nativeMode) this._syncFromSelect();

    // Fire change exactly once, and only if something actually changed.
    if (changed) {
      this._dispatch('input');
      this._dispatch('change');
      // In native mode, the native change listener forwards 'change' to
      // 'kselect:change' for us — don't double-dispatch.
      if (!this._nativeMode) this._dispatch('kselect:change');
    }
  };

  Kselect.prototype.getValue = function () {
    const selected = Array.prototype.filter.call(this.select.options, function (o) { return o.selected; });
    const vals = selected.map(function (o) { return o.value; });
    return this.isMultiple ? vals : (vals[0] || null);
  };

  Kselect.prototype.enable = function () {
    this.isDisabled = false;
    this.select.disabled = false;
    if (this._nativeMode) return;
    this._wrapper.classList.remove('ks-disabled');
    this._control.setAttribute('tabindex', '0');
    this._control.removeAttribute('aria-disabled');
  };

  Kselect.prototype.disable = function () {
    this.isDisabled = true;
    this.select.disabled = true;
    if (this._nativeMode) return;
    this._wrapper.classList.add('ks-disabled');
    this._control.setAttribute('tabindex', '-1');
    this._control.setAttribute('aria-disabled', 'true');
    this.close();
  };

  Kselect.prototype.destroy = function () {
    if (this._nativeMode) {
      this.select.removeEventListener('change', this._nativeChangeForwarder);
      this.select.classList.remove('ks-native');
      this.select.removeAttribute('data-kselect-id');
      if (Kselect._instances) delete Kselect._instances[this.id];
      return;
    }
    document.removeEventListener('click', this._outsideClick);
    window.removeEventListener('resize', this._repositionDebounced);
    window.removeEventListener('resize', this._summaryResizeHandler);
    window.removeEventListener('scroll', this._repositionOnScroll, true);
    if (window.visualViewport && this._repositionOnVVChange) {
      window.visualViewport.removeEventListener('resize', this._repositionOnVVChange);
      window.visualViewport.removeEventListener('scroll', this._repositionOnVVChange);
    }
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._wrapperResizeObserver) {
      this._wrapperResizeObserver.disconnect();
      this._wrapperResizeObserver = null;
    }
    if (this._selectObserver) {
      this._selectObserver.disconnect();
      this._selectObserver = null;
    }
    if (this._iframeObserver) {
      this._iframeObserver.disconnect();
      this._iframeObserver = null;
    }
    if (this._iframeSentinel && this._iframeSentinel.parentNode) {
      this._iframeSentinel.parentNode.removeChild(this._iframeSentinel);
      this._iframeSentinel = null;
    }
    if (this._externalChangeListener) {
      this.select.removeEventListener('change', this._externalChangeListener);
      this._externalChangeListener = null;
    }
    // The <label> lives outside the wrapper, so removing the wrapper doesn't
    // take this listener with it.
    if (this._labelEl && this._labelClick) {
      this._labelEl.removeEventListener('click', this._labelClick);
      this._labelEl = null;
      this._labelClick = null;
    }
    if (this._typeTimer) { clearTimeout(this._typeTimer); this._typeTimer = null; }
    // A create() that settles after this finds nothing to update.
    this._destroyed = true;
    // A pending search must not call load() — or render its answer — after
    // the widget is gone.
    if (this._debouncedFilter) this._debouncedFilter.cancel();
    if (this._debouncedMobileFilter) this._debouncedMobileFilter.cancel();
    this._abortLoad();
    this._wrapper.parentNode && this._wrapper.parentNode.removeChild(this._wrapper);
    this._dropdown.parentNode && this._dropdown.parentNode.removeChild(this._dropdown);
    if (this._mobileOverlay && this._mobileOverlay.parentNode) {
      this._mobileOverlay.parentNode.removeChild(this._mobileOverlay);
    }
    if (this._mountPositioned && this._mount) {
      this._mount.style.position = '';
      this._mountPositioned = false;
    }
    this._mount = null;
    document.body.classList.remove('ks-body-modal-open');
    // If destroyed while the mobile sheet was open, un-pin the body too (see
    // _openMobileModal) so we don't leave the page stuck with position:fixed.
    if (this._prevBodyStyle) {
      const bodyStyle = document.body.style;
      bodyStyle.position = this._prevBodyStyle.position;
      bodyStyle.top = this._prevBodyStyle.top;
      bodyStyle.left = this._prevBodyStyle.left;
      bodyStyle.right = this._prevBodyStyle.right;
      bodyStyle.width = this._prevBodyStyle.width;
      this._prevBodyStyle = null;
      if (this._modalScrollX !== undefined && this._modalScrollY !== undefined) {
        window.scrollTo(this._modalScrollX, this._modalScrollY);
      }
    }
    // Restore the select's original inline display (may have been '' or anything else)
    this.select.style.display = this._originalDisplay || '';
    this.select.removeAttribute('data-kselect-id');
    if (Kselect._instances) delete Kselect._instances[this.id];
  };

  // Classes the widget owns on the wrapper. _syncWrapperClasses never removes
  // these, even if a host happens to put an identically-named class on the
  // <select> and later takes it off again.
  const KS_WRAPPER_OWNED = [
    'ks-wrapper', 'ks-single', 'ks-multiple',
    'ks-disabled', 'ks-open', 'ks-dropup', 'ks-at-limit', 'ks-no-search',
    'ks-loading', 'ks-remote', 'ks-creating',
  ];

  function classTokens(str) {
    return (str || '').split(/\s+/).filter(Boolean);
  }

  // Re-read `disabled` from the <select>. Hosts reasonably assume setting the
  // attribute is enough — it's the native contract — so with autoSync on, the
  // MutationObserver's refresh() lands here.
  //
  // The equality guard does two jobs: it stops disable()'s close() firing on
  // every unrelated refresh, and it terminates the observer loop. enable() and
  // disable() assign select.disabled, which reflects to the content attribute
  // and re-fires the observer; the second pass finds state already in sync and
  // does nothing.
  Kselect.prototype._syncDisabledFromSelect = function () {
    if (this.select.disabled === this.isDisabled) return;
    if (this.select.disabled) this.disable(); else this.enable();
  };

  // Re-read the <select>'s class onto the wrapper. Diff-based rather than a
  // wholesale rebuild, because the wrapper also carries runtime state the
  // widget owns (ks-open, ks-dropup, ks-at-limit) that a rebuild would wipe.
  Kselect.prototype._syncWrapperClasses = function () {
    if (!this._wrapper) return;
    const next = this.options.copyClassName ? (this.select.className || '') : '';
    if (next === this._copiedClassName) return;
    const nextTokens = classTokens(next);
    const self = this;
    classTokens(this._copiedClassName).forEach(function (c) {
      if (nextTokens.indexOf(c) === -1 && KS_WRAPPER_OWNED.indexOf(c) === -1) {
        self._wrapper.classList.remove(c);
      }
    });
    nextTokens.forEach(function (c) { self._wrapper.classList.add(c); });
    this._copiedClassName = next;
  };

  // Mirror the host's validation/description ARIA from the <select> onto
  // .ks-control. The select is display:none, so anything a form framework
  // wires to it (help text, error messages, required/invalid state) is
  // otherwise stranded on an element no assistive tech can reach. All three
  // are valid on the control's role="combobox". Called from _build() and from
  // refresh(), so it tracks validation state as it changes.
  Kselect.prototype._syncAria = function () {
    if (!this._control) return;
    const self = this;
    ['aria-describedby', 'aria-invalid', 'aria-required'].forEach(function (attr) {
      const val = self.select.getAttribute(attr);
      if (val === null) self._control.removeAttribute(attr);
      else self._control.setAttribute(attr, val);
    });
    // Hosts commonly set the native `required` attribute and not the ARIA
    // form; map it across when no explicit aria-required overrides it.
    if (this.select.getAttribute('aria-required') === null && this.select.required) {
      this._control.setAttribute('aria-required', 'true');
    }
  };

  Kselect.prototype.refresh = function () {
    if (this._nativeMode) return; // nothing to rebuild — native picker reads <select> live
    this._buildOptionsList();
    this._syncFromSelect();
    this._syncDisabledFromSelect();
    this._syncWrapperClasses();
    this._syncAria();
    // _buildOptionsList recreates every <li>, wiping the ks-hidden classes that
    // represent the active search filter. If a query is in flight (typically
    // because refresh() was called mid-search by a host framework reacting to
    // change events), re-apply it so the user's filter survives the rebuild.
    if (this._searchQuery) this._filterOptions(this._searchQuery);
  };

  // ─── Internal helpers ────────────────────────────────────────────────────────

  // Returns the event, so a caller can read defaultPrevented. `detail` makes
  // it a CustomEvent (kselect:create); `cancelable` lets preventDefault() work.
  Kselect.prototype._dispatch = function (eventName, detail, cancelable) {
    let event;
    try {
      event = detail !== undefined
        ? new CustomEvent(eventName, { bubbles: true, cancelable: !!cancelable, detail: detail })
        : new Event(eventName, { bubbles: true, cancelable: !!cancelable });
    } catch (e) {
      event = document.createEvent(detail !== undefined ? 'CustomEvent' : 'Event');
      if (detail !== undefined) event.initCustomEvent(eventName, true, !!cancelable, detail);
      else event.initEvent(eventName, true, true);
    }
    // Tag the event so listeners can distinguish kselect-originated changes
    // from external mutations (e.g. host code editing the <select> and firing
    // its own change event). Reachable as `e.kselect` in vanilla listeners and
    // `e.originalEvent.kselect` from jQuery.
    event.kselect = true;
    this.select.dispatchEvent(event);
    return event;
  };

  return Kselect;
}));
