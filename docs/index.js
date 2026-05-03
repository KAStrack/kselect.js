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
