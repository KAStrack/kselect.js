/*!
 * kselect.js - A modern, accessible select replacement
 * Version 1.2.0
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

  // ─── Utility helpers ────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
  function isCoarsePointerDevice() {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches;
  }

  function Kselect(selectEl, userOptions) {
    if (!(this instanceof Kselect)) return new Kselect(selectEl, userOptions);
    if (!selectEl || selectEl.tagName !== 'SELECT') {
      throw new Error('Kselect: first argument must be a <select> element.');
    }

    this.select = selectEl;
    this.options = Object.assign({
      placeholder: selectEl.getAttribute('data-placeholder') || 'Select an option…',
      searchPlaceholder: selectEl.getAttribute('data-search-placeholder') || 'Search…',
      noResultsText: 'No results found',
      maxHeight: 300,
      searchable: true,
      allowClear: true,
      closeOnSelect: true,        // single only; multi stays open
      collapseGroups: false,      // optgroups collapsed by default?
      selectAll: false,           // show a global "Select all" checkbox (multi only)
      selectAllText: 'Select all',
      selectAllGroups: false,     // show a "Select all" checkbox inside each optgroup (multi only)
      selectAllGroupText: 'Select all',
      nativeOnMobile: false,      // on coarse-pointer devices, leave the native <select> in place
      mobileModal: true,          // on coarse-pointer devices, open a full-screen modal instead of a dropdown
      maxSelect: null,            // maximum number of items that can be selected (multi only; null = unlimited)
      maxSelectText: 'Max {n} items', // label shown in the control when the limit is reached
      allowHtml: true,            // render HTML markup inside <option> labels; false = show tags as literal text
      summarizeSelected: 'auto',  // multi only: 'auto' = collapse to "n selected" when tags would wrap; 'off' = always show all tags; number = collapse when count exceeds it
      summarizeSelectedText: '{n} selected', // template for the summary; {n} is replaced with the selected count
      autoSync: true,             // watch the underlying <select> for external mutations and stay in sync without manual refresh()/kselect:sync calls
    }, userOptions || {});

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

  Kselect.getInstance = function (selectEl) {
    const id = selectEl && selectEl.getAttribute('data-kselect-id');
    return id ? (Kselect._instances || {})[id] : null;
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
    const wrapper = document.createElement('div');
    wrapper.className = 'ks-wrapper' +
      (this.isMultiple ? ' ks-multiple' : ' ks-single') +
      (this.isDisabled ? ' ks-disabled' : '') +
      (this.select.className ? ' ' + this.select.className : '');
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
    control.setAttribute('aria-controls', 'ks-dropdown-' + this.id);
    control.setAttribute('aria-owns', 'ks-dropdown-' + this.id);
    control.setAttribute('tabindex', this.isDisabled ? '-1' : '0');
    if (this.isDisabled) control.setAttribute('aria-disabled', 'true');

    // Resolve accessible label: prefer the <label> that points at the original <select>
    let labelText = '';
    if (this.select.id) {
      const labelEl = document.querySelector('label[for="' + this.select.id + '"]');
      if (labelEl) {
        const labelId = labelEl.id || ('ks-label-' + this.id);
        labelEl.id = labelId;
        control.setAttribute('aria-labelledby', labelId);
        labelText = labelEl.textContent.trim();
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
    searchInput.setAttribute('aria-controls', 'ks-dropdown-' + this.id);
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
    clearBtn.setAttribute('aria-label', 'Clear selection');
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
    dropdown.className = 'ks-dropdown';
    dropdown.setAttribute('id', 'ks-dropdown-' + this.id);
    dropdown.setAttribute('role', 'listbox');
    dropdown.setAttribute('aria-multiselectable', this.isMultiple ? 'true' : 'false');
    dropdown.style.maxHeight = this.options.maxHeight + 'px';

    const optionsList = document.createElement('ul');
    optionsList.className = 'ks-options';
    optionsList.setAttribute('role', 'presentation');
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

    wrapper.appendChild(control);
    wrapper.appendChild(dropdown);

    // Insert after the original select
    this.select.parentNode.insertBefore(wrapper, this.select.nextSibling);

    // Attach dropdown to <body> so it is never clipped by an overflow ancestor.
    // _positionDropdown sets its coordinates via fixed positioning each time it opens.
    document.body.appendChild(dropdown);

    // ── Mobile modal overlay ──
    // A full-screen sheet used instead of the dropdown on small touch devices
    // when mobileModal:true. Built once and reused; shown/hidden by open()/close().
    const mobileOverlay = document.createElement('div');
    mobileOverlay.className = 'ks-mobile-overlay';
    mobileOverlay.setAttribute('aria-modal', 'true');
    mobileOverlay.setAttribute('role', 'dialog');

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
    // Use the label text if we found one above, else placeholder
    mobileTitle.textContent = labelText || this.options.placeholder;

    const mobileClose = document.createElement('button');
    mobileClose.type = 'button';
    mobileClose.className = 'ks-mobile-close';
    mobileClose.setAttribute('aria-label', 'Close');
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
    // but anchors content to the bottom so sparse lists sit near the search bar
    const mobileOptionsWrap = document.createElement('div');
    mobileOptionsWrap.className = 'ks-mobile-options-wrap';

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

    mobileSheet.appendChild(mobileHeader);
    mobileSheet.appendChild(mobileSelection);
    mobileSheet.appendChild(mobileOptionsWrap);
    mobileSheet.appendChild(mobileSearchWrap);

    mobileOverlay.appendChild(mobileBackdrop);
    mobileOverlay.appendChild(mobileSheet);
    document.body.appendChild(mobileOverlay);

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
          const isDropup = self._wrapper.classList.contains('ks-dropup');
          // Drop-down: wrapper bottom moved down (grew) or up (shrank).
          //   Scroll down by delta keeps wrapper bottom at the same viewport Y.
          // Drop-up: wrapper top moved up (grew) or down (shrank).
          //   Scroll up by delta keeps wrapper top at the same viewport Y.
          window.scrollBy(0, isDropup ? -heightDelta : heightDelta);
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
        this._selectAllEl.insertBefore(this._searchWrap, this._selectAllEl.firstChild);
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

    this._renderChildren(children, this._optionsList, null);
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

  Kselect.prototype._renderGroup = function (optgroup, container) {
    const self = this;
    const groupId = this.id + '-group-' + encodeURIComponent(optgroup.label);
    const isCollapsed = this._collapsedGroups[groupId] !== undefined
      ? this._collapsedGroups[groupId]
      : this.options.collapseGroups;

    const li = document.createElement('li');
    li.className = 'ks-group' + (isCollapsed ? ' ks-group-collapsed' : '');
    this._carryAttrs(li, optgroup);
    li.setAttribute('data-group-id', groupId);

    // Use a <button> for the group header so it's natively keyboard-operable
    // and correctly conveys expanded/collapsed state to screen readers.
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'ks-group-header';
    this._carryAttrs(header, optgroup);
    header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    header.setAttribute('aria-controls', 'ks-group-list-' + groupId);

    const toggle = document.createElement('span');
    toggle.className = 'ks-group-toggle';
    toggle.setAttribute('aria-hidden', 'true');
    toggle.innerHTML = '<svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    const label = document.createElement('span');
    label.className = 'ks-group-label';
    label.textContent = optgroup.label;

    header.appendChild(toggle);
    header.appendChild(label);

    // Per-group select-all: a small checkbox button in the header (multi only)
    if (this.isMultiple && this.options.selectAllGroups) {
      const groupCheckBtn = document.createElement('button');
      groupCheckBtn.type = 'button';
      groupCheckBtn.className = 'ks-group-select-all';
      groupCheckBtn.setAttribute('aria-label', 'Select all in ' + optgroup.label);
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
      header.appendChild(groupCheckBtn);
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
      const collapsed = li.classList.contains('ks-group-collapsed');
      if (collapsed) {
        li.classList.remove('ks-group-collapsed');
        groupList.style.display = '';
        header.setAttribute('aria-expanded', 'true');
        self._collapsedGroups[groupId] = false;
      } else {
        li.classList.add('ks-group-collapsed');
        groupList.style.display = 'none';
        header.setAttribute('aria-expanded', 'false');
        self._collapsedGroups[groupId] = true;
      }
    });

    li.appendChild(header);
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

    // Keyboard nav on control
    this._control.addEventListener('keydown', function (e) {
      self._handleKeydown(e);
    });

    // Search input. Debounced — but keep a reference so close() can cancel
    // any pending invocation (an empty close() doesn't want a filter() chasing it).
    this._debouncedFilter = debounce(function () {
      self._searchQuery = self._searchInput.value;
      self._wrapper.classList.toggle('ks-searching', self._searchInput.value.length > 0);
      self._filterOptions(self._searchQuery);
    }, 100);
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

    // Close on outside click. The dropdown lives in <body>, not inside the
    // wrapper, so we must check both — otherwise clicks in the dropdown's
    // empty space (padding, scrollbar, no-results area, live region) close it.
    this._outsideClick = function (e) {
      if (self._wrapper.contains(e.target)) return;
      if (self._dropdown.contains(e.target)) return;
      // The mobile overlay (sheet + backdrop) lives in <body> outside the
      // wrapper and dropdown — taps inside it must not trigger an outside-close.
      // The backdrop's own click handler calls close() deliberately.
      if (self._mobileOverlay && self._mobileOverlay.contains(e.target)) return;
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
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
        e.preventDefault();
        this.open();
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
        if (focused.classList.contains('ks-select-all')) {
          this._toggleSelectAll();
        } else {
          const val = focused.getAttribute('data-value');
          if (val !== null) this._selectOption(val);
        }
      }
    } else if (key === 'Tab') {
      this.close();
    }
  };

  Kselect.prototype._moveFocus = function (dir) {
    // An option is "navigable" if it is enabled, not filtered out by search,
    // and not inside a collapsed group. Walking the DOM for offsetParent is
    // the simplest correct check — it catches both "display:none on self" and
    // "display:none on an ancestor (collapsed group)".
    const all = this._dropdown.querySelectorAll('.ks-option:not(.ks-option-disabled)');
    let items = [];
    for (let i = 0; i < all.length; i++) {
      if (all[i].offsetParent !== null) items.push(all[i]);
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
    items[idx].classList.add('ks-option-focused');
    items[idx].scrollIntoView({ block: 'nearest' });
    // Update aria-activedescendant so screen readers announce the focused option
    const itemId = items[idx].getAttribute('id');
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

    // Populate mobile selection display (multi mode only)
    this._updateMobileSelection();

    // Show overlay
    this._mobileOverlay.classList.add('ks-mobile-overlay-open');
    document.body.classList.add('ks-body-modal-open');

    // Reset mobile search
    this._mobileSearchInput.value = '';
    this._filterOptions('');

    // Bind search
    if (!this._debouncedMobileFilter) {
      this._debouncedMobileFilter = debounce(function () {
        self._searchQuery = self._mobileSearchInput.value;
        self._filterOptions(self._searchQuery);
        // Sync no-results visibility in mobile
        const anyVisible = self._optionsList.querySelector('.ks-option:not(.ks-hidden):not(.ks-select-all)');
        self._mobileNoResults.style.display = anyVisible ? 'none' : '';
      }, 100);
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
  };

  Kselect.prototype._closeMobileModal = function () {
    // Move options list back to the desktop dropdown
    this._dropdown.insertBefore(this._optionsList, this._liveRegion);

    this._mobileOverlay.classList.remove('ks-mobile-overlay-open');
    document.body.classList.remove('ks-body-modal-open');

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
    this._mobileSheet.style.transform = '';
    this._mobileSheet.style.transition = '';
    this._mobileBackdrop.style.opacity = '';
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
      removeBtn.setAttribute('aria-label', 'Remove ' + o.text);
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
      this._dropdown.style.display = 'block';
      // If search is in the select-all row it lives inside the dropdown (body),
      // so CSS .ks-open rules can't reach it — show/hide manually.
      if (this._wrapper.classList.contains('ks-search-in-row')) {
        this._searchWrap.style.display = 'block';
      }
      this._positionDropdown();

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
    this._wrapper.classList.remove('ks-open');
    this._control.setAttribute('aria-expanded', 'false');
    this._control.removeAttribute('aria-activedescendant');
    this._searchInput.removeAttribute('aria-activedescendant');

    if (this._mobileOverlay && this._mobileOverlay.classList.contains('ks-mobile-overlay-open')) {
      this._closeMobileModal();
    } else {
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
      if (visTop === 0 && visLeft === 0) {
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
  };

  // ─── Select-all helpers ───────────────────────────────────────────────────────

  // Returns the enabledOptions for a scope (global or a specific optgroup element)
  Kselect.prototype._scopeOptions = function (optgroup) {
    const opts = optgroup
      ? Array.prototype.filter.call(optgroup.children, function (o) { return o.tagName === 'OPTION' && !o.disabled; })
      : Array.prototype.filter.call(this.select.options, function (o) { return !o.disabled; });
    return opts;
  };

  Kselect.prototype._toggleSelectAll = function () {
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
    // el is either the global <li> or a group header <button>
    el.classList.toggle('ks-option-selected', allChecked);
    el.classList.toggle('ks-select-all-indeterminate', someChecked);
    if (el.tagName === 'LI') {
      el.setAttribute('aria-selected', allChecked ? 'true' : 'false');
    } else {
      el.setAttribute('aria-pressed', allChecked ? 'true' : 'false');
    }
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
          noticeText.textContent = this.options.maxSelectText.replace('{n}', limit);
        }
      }
      // Update unselected option rows: add ks-option-at-limit when at the cap
      // so they appear greyed-out without being truly disabled (they must still
      // be clickable to deselect, but we block new selections in _selectOption).
      if (this._optionsList) {
        const allOptionEls = this._optionsList.querySelectorAll('.ks-option:not(.ks-option-disabled):not(.ks-select-all)');
        Array.prototype.forEach.call(allOptionEls, function (li) {
          const isSelected = li.classList.contains('ks-option-selected');
          li.classList.toggle('ks-option-at-limit', atLimit && !isSelected);
        });
      }
      // Limit badge text: show "n / limit" always; swap style at limit
      this._limitBadge.textContent = count + '\u202f/\u202f' + limit; // narrow-space slashes
      this._limitBadge.style.display = '';
      this._limitBadge.classList.toggle('ks-limit-reached', atLimit);
      // Announce to screen readers via the live region when the limit is first hit
      if (atLimit && this._liveRegion) {
        const msg = this.options.maxSelectText.replace('{n}', limit);
        this._liveRegion.textContent = msg;
      } else if (!atLimit && this._liveRegion) {
        this._liveRegion.textContent = '';
      }
    } else {
      if (this._limitBadge) this._limitBadge.style.display = 'none';
      if (this._wrapper) this._wrapper.classList.remove('ks-at-limit');
      if (this._dropdown) this._dropdown.classList.remove('ks-at-limit');
    }

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
        removeBtn.setAttribute('aria-label', 'Remove ' + o.text);
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
  //   'off'    → never summarize (keep all tags)
  //   number n → summarize when count > n
  //   'auto'   → summarize when the rendered tags wrapped to a second line
  //              (detected by comparing offsetTop of the first vs last tag)
  // 'auto' has to run after the tags are in the DOM because it relies on
  // measured layout — there's no way to know up-front whether N tags of
  // varying widths will fit in the wrapper's current width.
  Kselect.prototype._maybeSummarize = function (count) {
    if (!this.isMultiple || count === 0) return;
    const opt = this.options.summarizeSelected;
    if (opt === 'off') return;

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
    summary.textContent = this.options.summarizeSelectedText.replace('{n}', count);
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
    const q = query.toLowerCase().trim();
    const self = this;
    let visibleCount = 0;

    // Show/hide regular options (skip select-all rows — they're handled separately).
    // We use a .ks-hidden class rather than inline style so the visibility
    // signal is a clean boolean and not subject to "display:none" string
    // matching against arbitrary inline styles.
    Array.prototype.forEach.call(this._optionsList.querySelectorAll('.ks-option:not(.ks-select-all)'), function (li) {
      const text = (li.querySelector('.ks-option-text') || li).textContent.toLowerCase();
      const groupAttr = li.getAttribute('data-group') || '';
      const match = !q || text.indexOf(q) !== -1 || groupAttr.toLowerCase().indexOf(q) !== -1;
      li.classList.toggle('ks-hidden', !match);
      if (match) visibleCount++;
    });

    // Show group headers if any child option is visible; auto-expand on search
    Array.prototype.forEach.call(this._optionsList.querySelectorAll('.ks-group'), function (group) {
      const visibleChildren = group.querySelectorAll('.ks-option:not(.ks-select-all):not(.ks-hidden)');
      const hasVisible = visibleChildren.length > 0;
      group.classList.toggle('ks-hidden', !hasVisible);
      // When searching, expand groups that have matches
      if (q && hasVisible) {
        const groupList = group.querySelector('.ks-group-options');
        if (groupList) groupList.style.display = '';
        group.classList.remove('ks-group-collapsed');
        const header = group.querySelector('.ks-group-header');
        if (header) header.setAttribute('aria-expanded', 'true');
      }
    });

    // Global select-all: hide when no results, UNLESS it's also housing the
    // search input — in that case always keep it visible.
    if (self._selectAllEl) {
      const searchInRow = self._wrapper.classList.contains('ks-search-in-row');
      self._selectAllEl.classList.toggle('ks-hidden', visibleCount === 0 && !searchInRow);
    }

    this._noResults.style.display = visibleCount === 0 ? '' : 'none';

    // Announce result count / no-results to screen readers via the live region
    if (q) {
      this._liveRegion.textContent = visibleCount === 0
        ? this.options.noResultsText
        : visibleCount + ' result' + (visibleCount === 1 ? '' : 's');
    } else {
      this._liveRegion.textContent = '';
    }
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
    if (this._externalChangeListener) {
      this.select.removeEventListener('change', this._externalChangeListener);
      this._externalChangeListener = null;
    }
    this._wrapper.parentNode && this._wrapper.parentNode.removeChild(this._wrapper);
    this._dropdown.parentNode && this._dropdown.parentNode.removeChild(this._dropdown);
    if (this._mobileOverlay && this._mobileOverlay.parentNode) {
      this._mobileOverlay.parentNode.removeChild(this._mobileOverlay);
    }
    document.body.classList.remove('ks-body-modal-open');
    // Restore the select's original inline display (may have been '' or anything else)
    this.select.style.display = this._originalDisplay || '';
    this.select.removeAttribute('data-kselect-id');
    if (Kselect._instances) delete Kselect._instances[this.id];
  };

  Kselect.prototype.refresh = function () {
    if (this._nativeMode) return; // nothing to rebuild — native picker reads <select> live
    this._buildOptionsList();
    this._syncFromSelect();
    // _buildOptionsList recreates every <li>, wiping the ks-hidden classes that
    // represent the active search filter. If a query is in flight (typically
    // because refresh() was called mid-search by a host framework reacting to
    // change events), re-apply it so the user's filter survives the rebuild.
    if (this._searchQuery) this._filterOptions(this._searchQuery);
  };

  // ─── Internal helpers ────────────────────────────────────────────────────────

  Kselect.prototype._dispatch = function (eventName) {
    let event;
    try {
      event = new Event(eventName, { bubbles: true });
    } catch (e) {
      event = document.createEvent('Event');
      event.initEvent(eventName, true, true);
    }
    // Tag the event so listeners can distinguish kselect-originated changes
    // from external mutations (e.g. host code editing the <select> and firing
    // its own change event). Reachable as `e.kselect` in vanilla listeners and
    // `e.originalEvent.kselect` from jQuery.
    event.kselect = true;
    this.select.dispatchEvent(event);
  };

  return Kselect;
}));
