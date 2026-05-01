/**
 * example.js — theme switcher for kselect demo page
 *
 * Injects a theme picker into the page header and dynamically loads
 * theme CSS files from the themes/ folder. The chosen theme is applied
 * to all examples EXCEPT the "Custom Themes via CSS Variables" demo card,
 * which always uses its own inline theme definitions.
 */

(function () {
  'use strict';

  // ── Theme registry ────────────────────────────────────────────────────────
  var THEMES = [
    { id: 'default',          label: 'Default (Indigo)',    emoji: '💜' },
    { id: 'kastrack',         label: 'KAStrack',            emoji: '🏢' },
    { id: 'catppuccin-mocha', label: 'Catppuccin Mocha',    emoji: '🌙' },
    { id: 'nord',             label: 'Nord',                emoji: '❄️'  },
    { id: 'dracula',          label: 'Dracula',             emoji: '🧛' },
    { id: 'gruvbox',          label: 'Gruvbox Dark',        emoji: '🪵' },
    { id: 'solarized-light',  label: 'Solarized Light',     emoji: '☀️'  },
    { id: 'corporate-slate',  label: 'Corporate Slate',     emoji: '💼' },
    { id: 'mint',             label: 'Mint',                emoji: '🌿' },
    { id: 'forest',           label: 'Forest',              emoji: '🌲' },
    { id: 'ocean',            label: 'Ocean',               emoji: '🌊' },
    { id: 'sunset',           label: 'Sunset',              emoji: '🌅' },
    { id: 'sakura',           label: 'Sakura',              emoji: '🌸' },
    { id: 'halloween',        label: 'Halloween',           emoji: '🎃' },
    { id: 'candy',            label: 'Candy Shop',          emoji: '🍭' },
    { id: 'terminal',         label: 'Terminal',            emoji: '💻' },
    { id: 'newsprint',        label: 'Newsprint',           emoji: '📰' },
    { id: 'neon-cyberpunk',   label: 'Neon Cyberpunk',      emoji: '🌃' },
    { id: 'vaporwave',        label: 'Vaporwave',           emoji: '🌴' },
    { id: 'lava-lamp',        label: 'Lava Lamp',           emoji: '🔴' },
  ];

  var STORAGE_KEY = 'kselect-demo-theme';
  var activeThemeId = localStorage.getItem(STORAGE_KEY) || 'default';

  // ── DOM references ────────────────────────────────────────────────────────
  var themeStyleEl = null;   // <link> for the active theme CSS
  var pickerSelect = null;   // the native <select> the Kselect instance is built on
  var pickerRs = null;       // Kselect instance for the picker

  // ── Find the "Custom Themes" demo card so we can skip it ─────────────────
  function findCustomThemeCard() {
    var titles = document.querySelectorAll('.demo-card-title');
    for (var i = 0; i < titles.length; i++) {
      if (titles[i].textContent.indexOf('Custom Themes via CSS Variables') !== -1) {
        var card = titles[i];
        while (card && !card.classList.contains('demo-card')) {
          card = card.parentElement;
        }
        return card;
      }
    }
    return null;
  }

  // ── Apply a theme ─────────────────────────────────────────────────────────
  function applyTheme(themeId) {
    activeThemeId = themeId;
    localStorage.setItem(STORAGE_KEY, themeId);

    // Swap out the <link> element
    if (themeStyleEl) {
      themeStyleEl.parentNode.removeChild(themeStyleEl);
    }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'themes/' + themeId + '.css';
    link.id = 'ks-theme-stylesheet';
    document.head.appendChild(link);
    themeStyleEl = link;
  }

  // ── Build the theme picker UI ─────────────────────────────────────────────
  function buildPicker() {
    // Wrapper bar sits inside the page-header, below the badge row
    var header = document.querySelector('.page-header');
    if (!header) return;

    var bar = document.createElement('div');
    bar.id = 'theme-picker-bar';
    bar.style.cssText = [
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'gap: 12px',
      'position: relative',
      'z-index: 10',
    ].join(';');

    var label = document.createElement('label');
    label.htmlFor = 'theme-picker-select';
    label.textContent = '🎨 Theme:';
    label.style.cssText = 'color: rgba(255,255,255,.85); font-size: 0.88rem; font-weight: 500; white-space: nowrap;';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'width: 240px;';

    var sel = document.createElement('select');
    sel.id = 'theme-picker-select';

    THEMES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.emoji + ' ' + t.label;
      if (t.id === activeThemeId) opt.selected = true;
      sel.appendChild(opt);
    });

    wrap.appendChild(sel);
    bar.appendChild(label);
    bar.appendChild(wrap);
    document.getElementById("docs-theme-wrapper").appendChild(bar);

    pickerSelect = sel;

    // Give the picker its own minimal inline theme so it always stays legible
    // regardless of the active theme (it lives in the header, not the demo grid).
    bar.style.setProperty('--ks-color-bg', '#ffffff');
    bar.style.setProperty('--ks-color-border', 'rgba(255,255,255,.4)');
    bar.style.setProperty('--ks-color-border-focus', '#ffffff');
    bar.style.setProperty('--ks-color-text', '#1a1a2e');
    bar.style.setProperty('--ks-color-placeholder', '#888');
    bar.style.setProperty('--ks-color-option-hover', '#f0f0ff');
    bar.style.setProperty('--ks-color-option-selected', '#4f46e5');
    bar.style.setProperty('--ks-color-option-selected-text', '#ffffff');
    bar.style.setProperty('--ks-color-option-selected-bg', '#eef2ff');
    bar.style.setProperty('--ks-color-option-selected-fg', '#4f46e5');
    bar.style.setProperty('--ks-color-arrow', 'rgba(255,255,255,.6)');
    bar.style.setProperty('--ks-color-arrow-open', '#ffffff');
    bar.style.setProperty('--ks-color-group-header', '#f9fafb');
    bar.style.setProperty('--ks-color-group-label', '#6b7280');
    bar.style.setProperty('--ks-color-tag-bg', '#eef2ff');
    bar.style.setProperty('--ks-color-tag-text', '#4f46e5');
    bar.style.setProperty('--ks-color-tag-border', '#c7d2fe');
    bar.style.setProperty('--ks-color-tag-remove', '#818cf8');
    bar.style.setProperty('--ks-color-tag-remove-hover', '#4f46e5');
    bar.style.setProperty('--ks-color-clear', '#9ca3af');
    bar.style.setProperty('--ks-color-clear-hover', '#ef4444');
    bar.style.setProperty('--ks-color-checkbox-border', '#d1d5db');
    bar.style.setProperty('--ks-color-checkbox-checked', '#6366f1');
    bar.style.setProperty('--ks-color-search-bg', '#f9fafb');
    bar.style.setProperty('--ks-color-disabled-bg', '#f3f4f6');
    bar.style.setProperty('--ks-color-disabled-text', '#9ca3af');
    bar.style.setProperty('--ks-color-disabled-border', '#e5e7eb');
    bar.style.setProperty('--ks-radius-control', '8px');
    bar.style.setProperty('--ks-radius-dropdown', '10px');
    bar.style.setProperty('--ks-radius-tag', '5px');
    bar.style.setProperty('--ks-radius-checkbox', '4px');
    bar.style.setProperty('--ks-font-family', 'Inter, system-ui, sans-serif');

    // Init Kselect on the picker
    pickerRs = Kselect.init('#theme-picker-select', {
      searchable: true,
      allowClear: false,
      closeOnSelect: true,
    })[0];

    // Listen for changes
    sel.addEventListener('kselect:change', function () {
      var newId = pickerRs.getValue();
      if (newId && newId !== activeThemeId) {
        applyTheme(newId);
      }
    });
  }

  // ── Isolate the custom-themes card from global theme ─────────────────────
  function isolateCustomThemeCard() {
    var card = findCustomThemeCard();
    if (!card) return;
    // Mark it so we can target it in CSS — no JS overrides needed, the inline
    // CSS variables on .theme-dark / .theme-green already win via specificity.
    card.setAttribute('data-no-global-theme', '');
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    isolateCustomThemeCard();
    buildPicker();
    applyTheme(activeThemeId);
  }

  // Run after Kselect and the page are both ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
