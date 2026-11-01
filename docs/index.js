// ── Version in the header ──
// Read from the loaded build, so it shows what actually ran (a stale cached
// kselect.min.js would show its own, older number).
(function () {
  const el = document.getElementById('kselect-version');
  if (el && window.Kselect && Kselect.version) {
    el.textContent = 'v' + Kselect.version;
    el.setAttribute('aria-label', 'kselect.js version ' + Kselect.version + ': what\'s new');
    el.hidden = false;
  }
})();

// ── Init all instances ──
const ks1 = Kselect.init('#single-basic')[0];
const ks2 = Kselect.init('#multi-basic')[0];
const ks3 = Kselect.init('#optgroup-select', { collapseGroups: false })[0];
const ks4 = Kselect.init('#optgroup-collapsed', { collapseGroups: true })[0];
const ks5 = Kselect.init('#disabled-control')[0];
const ks6 = Kselect.init('#disabled-options')[0];
const ks7 = Kselect.init('#sync-demo')[0];
const ks8 = Kselect.init('#theme-dark')[0];
const ks9 = Kselect.init('#theme-green')[0];
const ks10 = Kselect.init('#event-demo')[0];

// ── Output displays ──
function bindOutput(selectId, outputId, ks) {
  const out = document.getElementById(outputId);
  document.getElementById(selectId).addEventListener('kselect:change', function () {
    const v = ks.getValue();
    out.textContent = Array.isArray(v) ? (v.length ? v.join(', ') : '—') : (v || '—');
  });
}
bindOutput('single-basic',        'single-basic-output',   ks1);
bindOutput('multi-basic',         'multi-basic-output',    ks2);
bindOutput('optgroup-select',     'optgroup-output',       ks3);
bindOutput('optgroup-collapsed',  'optgroup-collapsed-output', ks4);

// ── Dynamic sync demo ──
let dynamicAdded = false;
function addDynamicOptions() {
  if (dynamicAdded) return;
  dynamicAdded = true;
  const sel = document.getElementById('sync-demo');
  ['Dynamic option A', 'Dynamic option B', 'Dynamic option C'].forEach(function (label, i) {
    const o = document.createElement('option');
    o.value = 'dyn' + (i+1);
    o.text  = label;
    sel.appendChild(o);
  });
  alert('3 options added to the native <select>. Now click "Dispatch kselect:sync" to update the widget.');
}

function triggerSync() {
  const sel = document.getElementById('sync-demo');
  sel.dispatchEvent(new Event('kselect:sync'));
}

function resetSyncDemo() {
  dynamicAdded = false;
  const sel = document.getElementById('sync-demo');
  while (sel.options.length > 2) sel.remove(sel.options.length - 1);
  sel.dispatchEvent(new Event('kselect:sync'));
}

const ksSelectAll = Kselect.init('#select-all-demo', { selectAll: true })[0];
const ksSelectAllGroups = Kselect.init('#select-all-groups-demo', { selectAll: true, selectAllGroups: true })[0];
const ksMaxSelect = Kselect.init('#max-select-demo', { maxSelect: 3, maxSelectText: 'Max {n} toppings' })[0];
const ksSummarize = Kselect.init('#summarize-demo', { summarizeSelected: 1, summarizeSelectedText: '{n} Channels Applied' })[0];
const ksNativeMobile = Kselect.init('#native-mobile-demo', { nativeOnMobile: true })[0];
const ksNativeMobileMulti = Kselect.init('#native-mobile-multi-demo', { nativeOnMobile: true })[0];

bindOutput('select-all-demo',        'select-all-output',        ksSelectAll);
bindOutput('select-all-groups-demo', 'select-all-groups-output', ksSelectAllGroups);
bindOutput('max-select-demo',        'max-select-output',        ksMaxSelect);
bindOutput('summarize-demo',         'summarize-output',         ksSummarize);
bindOutput('native-mobile-demo',     'native-mobile-output',     ksNativeMobile);
bindOutput('native-mobile-multi-demo', 'native-mobile-multi-output', ksNativeMobileMulti);

// ── Event log ──
const logEl = document.getElementById('event-log');
let logCount = 0;
function logEvent(name, detail) {
  logCount++;
  if (logCount === 1) logEl.textContent = '';
  const line = document.createElement('div');
  line.textContent = name + (detail ? '  →  ' + detail : '');
  const colors = {
    'kselect:change': '#4f46e5',
    'kselect:open':   '#059669',
    'kselect:close':  '#d97706',
    'change':          '#6b7280',
  };
  line.style.color = colors[name] || '#374151';
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

const evtSel = document.getElementById('event-demo');
['change', 'kselect:change', 'kselect:open', 'kselect:close'].forEach(function (evtName) {
  evtSel.addEventListener(evtName, function () {
    const detail = evtName.includes('change') ? JSON.stringify(ks10.getValue()) : '';
    logEvent(evtName, detail);
  });
});
// ── View source toggles ──
function toggleSource(btn) {
  const block = btn.nextElementSibling;
  const isOpen = block.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.lastChild.textContent = isOpen ? ' Hide source' : ' View source';
}

const ksChangeEvent = Kselect.init('#change-event-demo')[0];
const changeEventEl = document.getElementById('change-event-demo');
changeEventEl.addEventListener('change', function () {
  const values = ksChangeEvent.getValue();
  alert('change fired! values: ' + values.join(', '));
});

const ksAllowHtml = Kselect.init('#allow-html-demo', { allowHtml: true })[0];
const ksNoHtml    = Kselect.init('#no-html-demo',    { allowHtml: false })[0];

bindOutput('allow-html-demo', 'allow-html-output', ksAllowHtml);
bindOutput('no-html-demo',    'no-html-output',    ksNoHtml);

const ksPerRowStyling = Kselect.init('#per-row-styling-demo')[0];
bindOutput('per-row-styling-demo', 'per-row-styling-output', ksPerRowStyling);

// Multilingual demo. A Swedish page would put these in Kselect.defaults once;
// the demo page is English, so they are passed to this instance only.
const ksLangSwitcher = Kselect.init('#lang-switcher-demo')[0];
const ksSwedish = Kselect.init('#swedish-demo', {
  selectAllGroups:       true,
  summarizeSelected:     'off',
  searchPlaceholder:     'Sök…',
  noResultsText:         'Inga träffar',
  selectAllGroupLabel:   'Markera alla i {group}',
  removeTagText:         'Ta bort {label}',
  clearText:             'Rensa val',
  closeText:             'Stäng',
  summarizeSelectedText: '{n} valda',
})[0];
bindOutput('swedish-demo', 'swedish-demo-output', ksSwedish);

// ── Tags demo: create from the search box ──
// A fake tag server: search (load) and create, each answering after a delay.
(function () {
  const COLOURS = [
    ['Teal', '#0f766e'], ['Amber', '#b45309'], ['Violet', '#7c3aed'], ['Rose', '#be123c'],
    ['Blue', '#1d4ed8'], ['Green', '#15803d'], ['Slate', '#475569'], ['Pink', '#be185d'],
  ];
  let nextId = 100;
  const server = [
    ['t1', 'Finances', 0, 41], ['t2', 'Fintech', 4, 12], ['t3', 'Finance (old)', 6, 3, true],
    ['t4', 'Design', 1, 30], ['t5', 'Design systems', 2, 9], ['t6', 'Marketing', 3, 22],
    ['t7', 'Market research', 4, 7], ['t8', 'Legal', 6, 15], ['t9', 'HR', 2, 18],
    ['t10', 'UX', 5, 25], ['t11', 'QA', 0, 11], ['t12', 'Research', 1, 14],
    ['t13', 'Reporting', 3, 19], ['t14', 'Recruiting', 7, 8], ['t15', 'Roadmap', 4, 16],
  ].map(function (t) { return { id: t[0], name: t[1], colour: COLOURS[t[2]][1], uses: t[3], archived: !!t[4] }; });

  const later = function (ms, fn) { return new Promise(function (resolve, reject) { setTimeout(function () { try { resolve(fn()); } catch (e) { reject(e); } }, ms); }); };
  const row = function (t, similar) {
    return {
      value: t.id, label: t.name, color: t.colour, className: 'tag-chip',
      detail: t.archived ? 'archived' : t.uses + ' uses', disabled: t.archived,
      group: similar ? 'Similar tags' : 'Other tags',
    };
  };

  // Search: names starting with the query are "similar", names containing it
  // anywhere are "other"; most-used first within each.
  function load(query) {
    return later(300, function () {
      const q = query.toLowerCase();
      const hits = server.filter(function (t) { return t.name.toLowerCase().indexOf(q) !== -1; })
        .sort(function (a, b) { return b.uses - a.uses; });
      return hits.filter(function (t) { return t.name.toLowerCase().indexOf(q) === 0; }).map(function (t) { return row(t, true); })
        .concat(hits.filter(function (t) { return t.name.toLowerCase().indexOf(q) !== 0; }).map(function (t) { return row(t, false); }));
    });
  }

  // Create: refuses "error"; a name that exists in other capitals answers
  // the existing tag; anything else becomes a new tag.
  function createOnServer(name, colour) {
    return later(500, function () {
      if (name.toLowerCase() === 'error') throw new Error('“error” is a reserved word — try another name');
      const existing = server.find(function (t) { return t.name.toLowerCase() === name.toLowerCase(); });
      const tag = existing || { id: 't' + (nextId++), name: name, colour: colour || COLOURS[nextId % COLOURS.length][1], uses: 0 };
      if (!existing) server.push(tag);
      return { value: tag.id, label: tag.name, color: tag.colour, className: 'tag-chip', detail: existing ? tag.uses + ' uses' : 'new' };
    });
  }

  // With the box ticked, a dialog of the host's own asks for the colour
  // first; create() resolves when it is saved, or with null when cancelled.
  const dialog = document.getElementById('tags-demo-dialog');
  const swatches = document.getElementById('tags-demo-swatches');
  COLOURS.forEach(function (c, i) {
    const label = document.createElement('label');
    label.style.setProperty('--swatch', c[1]);
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'colour'; input.value = c[1];
    input.setAttribute('aria-label', c[0]);
    if (i === 0) input.checked = true;
    label.appendChild(input);
    swatches.appendChild(label);
  });
  function askForColour(name) {
    return new Promise(function (resolve) {
      document.getElementById('tags-demo-dialog-name').textContent = name;
      dialog.returnValue = '';
      dialog.showModal();
      dialog.addEventListener('close', function onClose() {
        dialog.removeEventListener('close', onClose);
        if (dialog.returnValue !== 'save') return resolve(null);
        resolve(createOnServer(name, dialog.querySelector('input[name=colour]:checked').value));
      });
    });
  }

  window.ksTags = Kselect.init('#tags-demo', {
    load: load,
    loadMinChars: 3,
    create: function (query) {
      return document.getElementById('tags-demo-ask').checked ? askForColour(query) : createOnServer(query);
    },
  })[0];
  bindOutput('tags-demo', 'tags-demo-output', window.ksTags);

  const events = [];
  const eventsEl = document.getElementById('tags-demo-events');
  ['kselect:create', 'change'].forEach(function (name) {
    document.getElementById('tags-demo').addEventListener(name, function (e) {
      events.unshift(name === 'kselect:create' ? 'kselect:create “' + e.detail.query + '”' : 'change');
      eventsEl.textContent = events.slice(0, 3).join(' · ');
    });
  });
})();
