/* Wrenessa Planner — offline ADHD budget & paycheck planner.
   100% client-side. State lives in localStorage (primary) and is mirrored
   to IndexedDB. No account, no server, no network calls. */
'use strict';

/* ---------------- storage ---------------- */
/* Demo mode: demo.html sets window.WRENISSA_DEMO before app.js loads.
   The demo uses separate storage keys and never registers the service worker. */
const IS_DEMO = typeof window !== 'undefined' && window.WRENISSA_DEMO === true;
const LS_KEY = IS_DEMO ? 'wrenessa-planner-demo-v1' : 'wrenessa-planner-v1';
const IDB_NAME = IS_DEMO ? 'wrenessa-planner-demo' : 'wrenessa-planner';
const IDB_STORE = 'state';
const DEMO_SPEND_LIMIT = 30;
const DEMO_LIMIT_MSG = 'Demo limit reached — get the full version for unlimited entries & Home Screen offline mode';

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
    mirrorToIDB();
  }, 250);
}
function mirrorToIDB() {
  try {
    const req = indexedDB.open(IDB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(JSON.stringify(state), 'state');
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      } catch (e) { db.close(); }
    };
  } catch (e) { /* IndexedDB unavailable — localStorage is the source of truth */ }
}
function loadFromIDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const get = tx.objectStore(IDB_STORE).get('state');
          get.onsuccess = () => { db.close(); resolve(get.result ? JSON.parse(get.result) : null); };
          get.onerror = () => { db.close(); resolve(null); };
        } catch (e) { db.close(); resolve(null); }
      };
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

/* ---------------- helpers ---------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CURRENCIES = {
  USD: { locale: 'en-US', code: 'USD' },
  GBP: { locale: 'en-GB', code: 'GBP' },
  EUR: { locale: 'en-IE', code: 'EUR' },
  CAD: { locale: 'en-CA', code: 'CAD' },
  AUD: { locale: 'en-AU', code: 'AUD' },
  INR: { locale: 'en-IN', code: 'INR' },
  PKR: { locale: 'en-PK', code: 'PKR' },
};
function fmt(n) {
  const c = CURRENCIES[state.currency] || CURRENCIES.USD;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code }).format(Number(n) || 0);
}
function fmtDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  return DAYS[x.getDay()].slice(0, 3) + ' ' + x.getDate() + ' ' + MONTHS[x.getMonth()].slice(0, 3);
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}
function setActiveNav(name) {
  document.querySelectorAll('.nav-pill').forEach((p) => p.classList.toggle('active', p.dataset.nav === name));
}

/* ---------------- demo data ---------------- */
function demoState() {
  const now = new Date();
  const nextFri = nextWeekday(5);
  return {
    version: 1,
    currency: 'USD',
    theme: 'daylight',
    mode: 'simple',
    name: 'Alex',
    balance: 2150.00,
    paycheck: { amount: 1450, schedule: 'biweekly', weekday: 5, dayOfMonth: 1, anchor: nextFri.toISOString().slice(0, 10) },
    bills: [
      { id: uid(), name: 'Rent', amount: 850, day: 1, paid: false },
      { id: uid(), name: 'Electric', amount: 85, day: 12, paid: false },
      { id: uid(), name: 'Internet', amount: 65, day: 18, paid: false },
      { id: uid(), name: 'Netflix', amount: 15.49, day: 22, paid: false },
      { id: uid(), name: 'Phone', amount: 45, day: 25, paid: false },
      { id: uid(), name: 'Spotify', amount: 9.99, day: 28, paid: false },
    ],
    sinking: [
      { id: uid(), name: 'Car insurance', annual: 600, saved: 150, lastSetAside: '' },
      { id: uid(), name: 'Holiday gifts', annual: 300, saved: 75, lastSetAside: '' },
    ],
    goals: [
      { id: uid(), name: 'Emergency fund', target: 2000, saved: 1200, color: '#4E9B7A' },
      { id: uid(), name: 'New laptop', target: 800, saved: 350, color: '#B7791F' },
      { id: uid(), name: 'Vacation', target: 1500, saved: 500, color: '#7C9070' },
    ],
    debts: [
      { id: uid(), name: 'Credit card', balance: 420, original: 420, apr: 22, min: 25, paidOff: false },
      { id: uid(), name: 'Store card', balance: 180, original: 180, apr: 18, min: 15, paidOff: false },
    ],
    envelopes: [
      { id: uid(), name: 'Groceries', monthly: 380 },
      { id: uid(), name: 'Transport', monthly: 60 },
      { id: uid(), name: 'Fun', monthly: 100 },
    ],
    transactions: [
      { id: uid(), date: todayISO(), amount: 45, category: 'Groceries', note: 'Weekly shop', kind: 'spend' },
      { id: uid(), date: todayISO(), amount: 12.5, category: 'Coffee', note: 'Flat white', kind: 'spend' },
      { id: uid(), date: todayISO(), amount: 2.5, category: 'Transport', note: 'Bus fare', kind: 'spend' },
      { id: uid(), date: todayISO(), amount: 8.75, category: 'Food', note: 'Lunch', kind: 'spend' },
    ],
    vault: [
      { id: uid(), name: 'Headphones', amount: 120, addedAt: Date.now() - 3 * 3600e3 },
      { id: uid(), name: 'Sneakers', amount: 85, addedAt: Date.now() - 20 * 3600e3 },
    ],
    vaultSaved: 0,
    brainDump: 'Call the dentist about the filling.\nIdea: meal-prep Sundays so weekdays are easier.',
    lastVisit: Date.now(),
    strategy: 'snowball',
  };
}
function freshState() {
  return {
    version: 1, currency: 'USD', theme: 'daylight', mode: 'full', name: 'Alex',
    balance: 0,
    paycheck: { amount: 0, schedule: 'monthly', weekday: 5, dayOfMonth: 1, anchor: nextWeekday(5).toISOString().slice(0, 10) },
    bills: [], sinking: [], goals: [], debts: [], envelopes: [], transactions: [], vault: [],
    vaultSaved: 0, brainDump: '', lastVisit: Date.now(), strategy: 'snowball',
  };
}
function nextWeekday(wd) {
  const d = new Date();
  let diff = (wd - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(d, diff);
}

/* ---------------- payday math ---------------- */
function nextPayday() {
  const p = state.paycheck;
  const today = startOfDay(new Date());
  if (p.schedule === 'weekly') {
    let d = nextWeekday(p.weekday);
    return d;
  }
  if (p.schedule === 'biweekly') {
    let anchor = startOfDay(new Date(p.anchor || today));
    let d = new Date(anchor);
    while (d <= today) d = addDays(d, 14);
    return d;
  }
  if (p.schedule === 'semimonthly') {
    const y = today.getFullYear(), m = today.getMonth();
    const first = new Date(y, m, 1), fifteenth = new Date(y, m, 15);
    if (first > today) return first;
    if (fifteenth > today) return fifteenth;
    return new Date(y, m + 1, 1);
  }
  // monthly
  const y = today.getFullYear(), m = today.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const dom = Math.min(p.dayOfMonth || 1, dim);
  const thisMonth = new Date(y, m, dom);
  if (thisMonth > today) return thisMonth;
  const dim2 = new Date(y, m + 2, 0).getDate();
  return new Date(y, m + 1, Math.min(p.dayOfMonth || 1, dim2));
}
function nextDueDate(bill) {
  const today = startOfDay(new Date());
  const y = today.getFullYear(), m = today.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const d = new Date(y, m, Math.min(bill.day, dim));
  if (d >= today) return d;
  const dim2 = new Date(y, m + 2, 0).getDate();
  return new Date(y, m + 1, Math.min(bill.day, dim2));
}
function computeSafe() {
  const payday = nextPayday();
  const today = startOfDay(new Date());
  let days = daysBetween(today, payday);
  const paydayToday = days <= 0;
  if (days <= 0) days = 1;
  const billsDue = state.bills
    .filter((b) => !b.paid && nextDueDate(b) <= payday)
    .map((b) => ({ ...b, due: nextDueDate(b) }));
  const billsTotal = billsDue.reduce((s, b) => s + b.amount, 0);
  const monthKey = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
  const sinkingDue = state.sinking
    .filter((f) => f.lastSetAside !== monthKey)
    .reduce((s, f) => s + f.annual / 12, 0);
  const available = state.balance - billsTotal - sinkingDue;
  const perDay = Math.max(0, available) / days;
  return { payday, days, paydayToday, billsDue, billsTotal, sinkingDue, available, perDay };
}

/* ---------------- render ---------------- */
function render() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('themeToggle').textContent = state.theme === 'daylight' ? '☾' : '☀';
  $('currencySelect').value = state.currency;
  $('modeToggle').checked = state.mode === 'full';
  $('modeLabel').textContent = state.mode === 'full' ? 'Full' : 'Simple';
  $('fullSections').hidden = state.mode !== 'full';
  renderHero();
  renderToday();
  renderDemo();
  renderCalendar();
  renderIncome();
  renderBills();
  renderEnvelopes();
  renderFunds();
  renderGoals();
  renderDebts();
  renderVault();
  renderTx();
  $('brainDump').value = state.brainDump || '';
  $('dumpCount').textContent = (state.brainDump || '').length;
}
function renderHero() {
  const s = computeSafe();
  $('safeNumber').textContent = fmt(s.perDay);
  $('safeSub').textContent = s.paydayToday
    ? 'for today — payday is today'
    : 'per day until payday · ' + s.days + (s.days === 1 ? ' day' : ' days') + ' to go';
  const nextBill = state.bills.filter((b) => !b.paid).sort((a, b) => nextDueDate(a) - nextDueDate(b))[0];
  $('paydayLine').textContent = 'Next payday ' + fmtDate(s.payday) + ' · ' + fmt(state.paycheck.amount) +
    (nextBill ? ' · Next bill: ' + nextBill.name + ' ' + fmt(nextBill.amount) + ' on ' + fmtDate(nextDueDate(nextBill)) : '');
  const note = $('safeNote');
  if (s.available < 0) {
    note.hidden = false;
    note.textContent = 'Heads up — bills before payday are ' + fmt(-s.available) + ' more than your balance. Nothing is wrong with you; let’s look at the bills below together.';
  } else if (s.perDay === 0) {
    note.hidden = false;
    note.textContent = 'Today is a no-spend day — and that is completely okay.';
  } else {
    note.hidden = true;
  }
  // breakdown modal body
  const rows = [
    ['Current balance', fmt(state.balance)],
    ['Bills due before payday', '− ' + fmt(s.billsTotal)],
    ['Sinking funds to set aside', '− ' + fmt(s.sinkingDue)],
    ['Left for the next ' + s.days + (s.days === 1 ? ' day' : ' days'), fmt(Math.max(0, s.available))],
  ];
  let html = rows.map(([a, b]) => '<div class="calc-row"><span>' + esc(a) + '</span><strong>' + esc(b) + '</strong></div>').join('');
  if (s.billsDue.length) {
    html += '<p class="muted small" style="margin-top:10px">Bills counted: ' + s.billsDue.map((b) => esc(b.name) + ' ' + fmt(b.amount) + ' (' + fmtDate(b.due) + ')').join(', ') + '</p>';
  }
  html += '<div class="calc-row total"><span>Safe to spend per day</span><span>' + fmt(s.perDay) + '</span></div>';
  $('calcBody').innerHTML = html;
}
function renderToday() {
  const t = todayISO();
  const todays = state.transactions.filter((x) => x.date === t && x.kind === 'spend');
  $('todayList').innerHTML = todays.length
    ? todays.map((x) => '<li><span>' + esc(x.note || x.category) + ' <span class="muted">·</span> <span class="cat-pill ' + catClass(x.category) + '">' + esc(x.category) + '</span></span><strong>' + fmt(x.amount) + '</strong></li>').join('')
    : '<li><span class="muted">Nothing logged today yet.</span></li>';
  const chips = [
    ['Coffee', 4.5, 'Coffee'], ['Lunch', 12, 'Food'], ['Bus fare', 2.5, 'Transport'], ['Groceries', 45, 'Groceries'],
  ];
  $('quickChips').innerHTML = chips.map(([label, amt, cat]) =>
    '<button type="button" class="chip ' + catClass(cat) + '" data-amt="' + amt + '" data-cat="' + esc(label) + '">' + esc(label) + ' · ' + fmt(amt) + '</button>').join('');
}
function renderDemo() {
  const dc = $('demoCount');
  if (!dc) return;
  if (IS_DEMO) {
    dc.hidden = false;
    dc.textContent = 'Free demo: ' + demoSpendCount() + ' of ' + DEMO_SPEND_LIMIT + ' spends used';
  } else {
    dc.hidden = true;
  }
}
function demoSpendCount() {
  return state.transactions.filter((x) => x.kind === 'spend').length;
}
function renderIncome() {
  $('payAmount').value = state.paycheck.amount || '';
  $('paySchedule').value = state.paycheck.schedule;
  const extra = $('payExtra');
  const p = state.paycheck;
  if (p.schedule === 'weekly' || p.schedule === 'biweekly') {
    extra.innerHTML = '<label for="payWeekday">Payday</label><select id="payWeekday">' +
      DAYS.map((d, i) => '<option value="' + i + '"' + (p.weekday === i ? ' selected' : '') + '>' + d + '</option>').join('') + '</select>';
    $('payWeekday').addEventListener('change', (e) => {
      state.paycheck.weekday = Number(e.target.value);
      state.paycheck.anchor = nextWeekday(state.paycheck.weekday).toISOString().slice(0, 10);
      save(); render();
    });
  } else if (p.schedule === 'monthly') {
    extra.innerHTML = '<label for="payDom">Day of month</label><input id="payDom" type="number" min="1" max="31" value="' + p.dayOfMonth + '">';
    $('payDom').addEventListener('change', (e) => {
      state.paycheck.dayOfMonth = Math.max(1, Math.min(31, Number(e.target.value) || 1));
      save(); render();
    });
  } else {
    extra.innerHTML = '';
  }
  const s = computeSafe();
  $('nextPaydayLine').textContent = 'Next payday: ' + fmtDate(s.payday) + ' (' + s.days + (s.days === 1 ? ' day' : ' days') + ' away)';
}
function renderBills() {
  const sorted = [...state.bills].sort((a, b) => nextDueDate(a) - nextDueDate(b));
  $('billList').innerHTML = sorted.length ? sorted.map((b) =>
    '<li class="' + (b.paid ? 'paid' : '') + '"><span>' + esc(b.name) + ' <span class="bill-due due-pill">Due ' + fmtDate(nextDueDate(b)) + '</span></span>' +
    '<span class="row-right"><span class="bill-amt">' + fmt(b.amount) + '</span> ' +
    (b.paid
      ? '<span class="muted small">paid</span>'
      : '<button class="btn btn-quiet" data-pay-bill="' + b.id + '">Mark paid</button>') +
    ' <button class="btn btn-quiet" data-del-bill="' + b.id + '" aria-label="Delete ' + esc(b.name) + '">✕</button></span></li>'
  ).join('') : '<li><span class="muted">No bills yet — add one below.</span></li>';
}
/* Monthly calendar: first weekday is computed from the date, never hardcoded. */
let calYear = null;
let calMonth = null;
function renderCalendar() {
  const now = new Date();
  if (calYear === null) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  $('calTitle').textContent = MONTHS[calMonth] + ' ' + calYear;
  const startWeekday = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  const spendByDay = {};
  state.transactions.forEach((x) => {
    if (x.kind !== 'spend') return;
    const d = new Date(x.date + 'T00:00:00');
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      spendByDay[d.getDate()] = (spendByDay[d.getDate()] || 0) + x.amount;
    }
  });
  const billsByDay = {};
  state.bills.forEach((b) => { (billsByDay[b.day] = billsByDay[b.day] || []).push(b); });
  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map((d) => '<div class="cal-weekday" role="columnheader">' + d + '</div>').join('');
  for (let i = 0; i < startWeekday; i++) html += '<div class="cal-day other" aria-hidden="true"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const spent = spendByDay[day] || 0;
    const bills = billsByDay[day] || [];
    html += '<div class="cal-day' + (isToday ? ' today' : '') + '" role="gridcell"><span class="cal-num">' + day + '</span>' +
      (spent > 0 ? '<span class="cal-spend">' + fmt(spent) + '</span>' : '') +
      bills.map((b) => '<span class="cal-bill">● ' + esc(b.name) + '</span>').join('') + '</div>';
  }
  $('calGrid').innerHTML = html;
}
function envelopeSpent(env) {
  const now = new Date();
  const key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  return state.transactions
    .filter((x) => x.kind === 'spend' && x.date.slice(0, 7) === key && (x.category || '').toLowerCase() === env.name.toLowerCase())
    .reduce((s, x) => s + x.amount, 0);
}
function renderEnvelopes() {
  const list = state.envelopes || [];
  $('envGrid').innerHTML = list.length ? list.map((env) => {
    const spent = envelopeSpent(env);
    const pct = env.monthly > 0 ? Math.min(100, Math.round((spent / env.monthly) * 100)) : 0;
    return '<div class="env-card"><h3>' + esc(env.name) + '</h3>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="env-amounts"><span>' + fmt(spent) + ' spent</span><span>of ' + fmt(env.monthly) + '/mo</span></div>' +
      '<div class="env-actions"><button class="btn btn-quiet" data-del-env="' + env.id + '">Remove</button></div></div>';
  }).join('') : '<p class="muted">No envelopes yet — add one below.</p>';
}
function renderFunds() {
  const monthKey = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
  $('fundList').innerHTML = state.sinking.length ? state.sinking.map((f) => {
    const monthly = f.annual / 12;
    const done = f.lastSetAside === monthKey;
    return '<li><div class="fund-top"><strong>' + esc(f.name) + '</strong><span>' + fmt(f.annual) + '/yr → <strong>' + fmt(monthly) + '/mo</strong></span></div>' +
      '<div class="muted small">Saved so far: ' + fmt(f.saved) + '</div>' +
      '<div class="fund-actions"><button class="btn btn-primary" data-setaside="' + f.id + '"' + (done ? ' disabled' : '') + '>' +
      (done ? 'Set aside for ' + MONTHS[new Date().getMonth()] : 'Set aside ' + fmt(monthly)) + '</button>' +
      ' <button class="btn btn-quiet" data-del-fund="' + f.id + '">Remove</button></div></li>';
  }).join('') : '<li><span class="muted">No sinking funds yet.</span></li>';
}
function renderGoals() {
  $('jarGrid').innerHTML = state.goals.length ? state.goals.map((g) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
    return '<div class="jar" id="jar-' + g.id + '"><h3>' + esc(g.name) + '</h3>' +
      '<div class="bar"><i style="width:' + pct + '%;background:' + esc(g.color || '#4E9B7A') + '"></i></div>' +
      '<div class="jar-amounts"><span>' + fmt(g.saved) + ' saved</span><span>' + pct + '% · goal ' + fmt(g.target) + '</span></div>' +
      '<div class="jar-actions"><input type="number" min="0" step="0.01" placeholder="Amount" aria-label="Amount to add to ' + esc(g.name) + '" data-goal-amt="' + g.id + '">' +
      '<button class="btn btn-primary" data-goal-add="' + g.id + '">Add money</button></div></div>';
  }).join('') : '<p class="muted">No jars yet — add your first savings goal below.</p>';
}
function orderedDebts() {
  const list = state.debts.filter((d) => !d.paidOff);
  return state.strategy === 'snowball'
    ? [...list].sort((a, b) => a.balance - b.balance)
    : [...list].sort((a, b) => b.apr - a.apr);
}
function renderDebts() {
  $('strategyBtn').textContent = state.strategy === 'snowball' ? 'Snowball — smallest first' : 'Avalanche — highest APR first';
  $('strategyBtn').setAttribute('aria-pressed', String(state.strategy === 'avalanche'));
  const ordered = orderedDebts();
  const paidOff = state.debts.filter((d) => d.paidOff);
  $('debtList').innerHTML = (ordered.length ? ordered.map((d, i) => {
    const original = d.original || d.balance;
    const pct = original > 0 ? Math.round((1 - d.balance / original) * 100) : 0;
    return '<li><div class="debt-top"><strong>' + esc(d.name) + '</strong><span>' + fmt(d.balance) + ' left · ' + d.apr + '% APR</span></div>' +
      '<div class="bar debt"><i style="width:' + Math.max(pct, d.balance > 0 ? 4 : 100) + '%"></i></div>' +
      '<div class="debt-actions">' + (i === 0 ? '<span class="focus-badge">Focus — pay this first</span>' : '') +
      '<input type="number" min="0" step="0.01" placeholder="Amount" aria-label="Extra payment for ' + esc(d.name) + '" data-debt-amt="' + d.id + '">' +
      '<button class="btn btn-primary" data-debt-pay="' + d.id + '">Pay extra</button></div></li>';
  }).join('') : '') +
    (paidOff.length ? paidOff.map((d) => '<li><div class="debt-top"><strong class="paid">' + esc(d.name) + '</strong><span class="muted">paid off 🎉</span></div></li>').join('') : '') ||
    '<li><span class="muted">No debts — nice.</span></li>';
}
function vaultRemaining(v) {
  const left = v.addedAt + 24 * 3600e3 - Date.now();
  return Math.max(0, left);
}
function fmtCountdown(ms) {
  if (ms <= 0) return 'Ready — decide now';
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1000);
  return h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's left';
}
function renderVault() {
  $('vaultSaved').textContent = fmt(state.vaultSaved || 0);
  $('vaultList').innerHTML = state.vault.length ? state.vault.map((v) => {
    const left = vaultRemaining(v);
    const ready = left <= 0;
    return '<li><div class="vault-top"><strong>' + esc(v.name) + '</strong><span>' + fmt(v.amount) + '</span></div>' +
      '<div class="vault-timer' + (ready ? ' ready' : '') + '" data-vault-timer="' + v.id + '">' + fmtCountdown(left) + '</div>' +
      '<div class="vault-actions">' +
      (ready
        ? '<button class="btn btn-primary" data-vault-buy="' + v.id + '">Still want it — buy it</button><button class="btn" data-vault-skip="' + v.id + '">Skip it — keep the money</button>'
        : '<button class="btn" data-vault-skip="' + v.id + '">Changed my mind — skip it</button>') +
      '</div></li>';
  }).join('') : '<li><span class="muted">Vault is empty. Park your next impulse buy here.</span></li>';
}
function renderTx() {
  const list = [...state.transactions].sort((a, b) => (b.date + (b.id || '')).localeCompare(a.date + (a.id || ''))).slice(0, 50);
  $('txEmpty').hidden = list.length > 0;
  $('txList').innerHTML = list.map((x) => {
    const sign = x.kind === 'spend' ? '−' : '+';
    return '<li><span>' + esc(x.note || x.category) + ' <span class="cat-pill ' + catClass(x.category) + '">' + esc(x.category) + '</span> <span class="muted"><span class="nowrap">· ' + esc(x.date) + '</span></span></span><strong class="tx-amt">' + sign + ' ' + fmt(x.amount) + '</strong></li>';
  }).join('');
}

/* ---------------- quick spend + voice ---------------- */
const CATEGORIES = [
  ['grocer', 'Groceries'], ['food', 'Food'], ['coffee', 'Coffee'], ['lunch', 'Food'],
  ['bus', 'Transport'], ['taxi', 'Transport'], ['train', 'Transport'], ['fuel', 'Transport'],
  ['bill', 'Bills'], ['rent', 'Bills'], ['netflix', 'Bills'], ['spotify', 'Bills'],
  ['gym', 'Health'], ['pharmacy', 'Health'], ['cloth', 'Shopping'], ['shoe', 'Shopping'],
  ['movie', 'Fun'], ['game', 'Fun'], ['book', 'Fun'],
];
/* category -> pastel pill class (Groceries sage, Coffee amber, Transport sky,
   Food lavender, Fun rose, Bills blue, Health mint, everything else gray) */
const CATEGORY_CLASSES = {
  Groceries: 'cat-sage', Coffee: 'cat-amber', Transport: 'cat-sky', Food: 'cat-lavender',
  Fun: 'cat-rose', Bills: 'cat-blue', Health: 'cat-mint', Shopping: 'cat-amber',
  Savings: 'cat-mint', Debt: 'cat-rose', 'Sinking fund': 'cat-amber', Other: 'cat-gray',
};
const catClass = (cat) => CATEGORY_CLASSES[cat] || 'cat-gray';
function parseSpend(text) {
  const m = text.match(/(-?\d[\d,]*\.?\d*)/);
  if (!m) return null;
  const amount = parseFloat(m[0].replace(/,/g, ''));
  if (!amount || amount <= 0) return null;
  const rest = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  const lower = rest.toLowerCase();
  let category = 'Other';
  for (const [key, cat] of CATEGORIES) if (lower.includes(key)) { category = cat; break; }
  return { amount, category, note: rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : category };
}
function logSpend(amount, category, note) {
  if (IS_DEMO && demoSpendCount() >= DEMO_SPEND_LIMIT) {
    const card = $('demoLimit');
    if (card) { card.textContent = DEMO_LIMIT_MSG; card.hidden = false; }
    toast(DEMO_LIMIT_MSG);
    return;
  }
  state.balance = Math.max(0, +(state.balance - amount).toFixed(2));
  state.transactions.push({ id: uid(), date: todayISO(), amount, category, note: note || category, kind: 'spend' });
  save(); render();
  toast('Logged ' + fmt(amount) + ' · ' + category);
}
let recognition = null;
function setupVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $('micBtn');
  if (!SR) { btn.disabled = true; btn.title = 'Voice input is not supported in this browser'; return; }
  btn.addEventListener('click', () => {
    try {
      recognition = new SR();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      $('micStatus').hidden = false;
      recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        $('quickInput').value = text;
        $('micStatus').hidden = true;
        const parsed = parseSpend(text);
        if (parsed) logSpend(parsed.amount, parsed.category, parsed.note);
        else toast('Heard “' + text + '” — add an amount, like “45 groceries”.');
      };
      recognition.onerror = () => { $('micStatus').hidden = true; toast('Voice input did not catch that — try typing it.'); };
      recognition.onend = () => { $('micStatus').hidden = true; };
      recognition.start();
    } catch (e) { toast('Voice input is not available right now.'); }
  });
}

/* ---------------- events ---------------- */
function bindEvents() {
  $('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'daylight' ? 'midnight' : 'daylight';
    save(); render();
    toast(state.theme === 'midnight' ? 'Midnight Calm on — easy on the eyes.' : 'Soft Daylight on.');
  });
  $('currencySelect').addEventListener('change', (e) => {
    state.currency = e.target.value;
    save(); render();
    toast('Currency set to ' + state.currency + '.');
  });
  $('modeToggle').addEventListener('change', (e) => {
    state.mode = e.target.checked ? 'full' : 'simple';
    save(); render();
    if (state.mode === 'simple') setActiveNav('today');
  });

  // desktop section nav
  const NAV_TARGETS = {
    today: '.hero',
    month: '#calendarSection',
    bills: '#billsSection',
    income: '#incomeSection',
    goals: '#goalsSection',
    debt: '#debtSection',
    envelopes: '#envelopesSection',
    vault: '#vaultSection',
    settings: '#settingsSection',
  };
  document.querySelectorAll('.nav-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const target = pill.dataset.nav;
      if (target === 'today') {
        setActiveNav('today');
        document.querySelector('.hero').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (state.mode !== 'full') { state.mode = 'full'; save(); render(); }
      setActiveNav(target);
      setTimeout(() => {
        const el = document.querySelector(NAV_TARGETS[target]);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
  });
  // keep the active pill in step with scrolling (full mode only)
  if ('IntersectionObserver' in window) {
    const sectionToNav = {
      heroSection: 'today', calendarSection: 'month', billsSection: 'bills',
      incomeSection: 'income', goalsSection: 'goals', debtSection: 'debt',
      envelopesSection: 'envelopes', vaultSection: 'vault', settingsSection: 'settings',
    };
    const observer = new IntersectionObserver((entries) => {
      if (state.mode !== 'full') return;
      const visible = entries.filter((en) => en.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible && sectionToNav[visible.target.id || 'hero']) setActiveNav(sectionToNav[visible.target.id || 'hero']);
    }, { rootMargin: '-90px 0px -60% 0px' });
    document.querySelector('.hero').id = 'heroSection';
    ['heroSection', 'calendarSection', 'billsSection', 'incomeSection', 'goalsSection', 'debtSection', 'envelopesSection', 'vaultSection', 'settingsSection'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }
  $('calcBtn').addEventListener('click', () => { renderHero(); $('calcModal').hidden = false; });
  $('calcClose').addEventListener('click', () => { $('calcModal').hidden = true; });
  $('calcModal').addEventListener('click', (e) => { if (e.target === $('calcModal')) $('calcModal').hidden = true; });

  $('quickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('quickInput').value.trim();
    const parsed = parseSpend(text);
    if (!parsed) { toast('Add an amount — try “45 groceries”.'); return; }
    $('quickInput').value = '';
    logSpend(parsed.amount, parsed.category, parsed.note);
  });
  $('quickChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    logSpend(Number(chip.dataset.amt), chip.dataset.cat, chip.dataset.cat);
  });
  setupVoice();

  $('payAmount').addEventListener('change', (e) => {
    state.paycheck.amount = Math.max(0, Number(e.target.value) || 0);
    save(); render();
  });
  $('paySchedule').addEventListener('change', (e) => {
    state.paycheck.schedule = e.target.value;
    if (state.paycheck.schedule === 'weekly' || state.paycheck.schedule === 'biweekly') {
      state.paycheck.anchor = nextWeekday(state.paycheck.weekday).toISOString().slice(0, 10);
    }
    save(); render();
  });
  // monthly calendar navigation
  $('calPrev').addEventListener('click', () => {
    calMonth -= 1;
    if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderCalendar();
  });
  $('calNext').addEventListener('click', () => {
    calMonth += 1;
    if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderCalendar();
  });
  $('calToday').addEventListener('click', () => {
    const n = new Date();
    calYear = n.getFullYear(); calMonth = n.getMonth();
    renderCalendar();
  });
  $('envForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('envName').value.trim();
    const monthly = Number($('envMonthly').value);
    if (!name || !monthly) return;
    state.envelopes.push({ id: uid(), name, monthly });
    e.target.reset();
    save(); render();
    toast('Envelope added: ' + name + ' — ' + fmt(monthly) + '/month');
  });
  $('envGrid').addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-env]');
    if (!delBtn) return;
    state.envelopes = state.envelopes.filter((x) => x.id !== delBtn.dataset.delEnv);
    save(); render();
  });
  $('billForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('billName').value.trim();
    const amount = Number($('billAmount').value);
    const day = Math.max(1, Math.min(31, Number($('billDay').value) || 1));
    if (!name || !amount) return;
    state.bills.push({ id: uid(), name, amount, day, paid: false });
    e.target.reset();
    save(); render();
    toast('Bill added: ' + name + ' ' + fmt(amount));
  });
  $('billList').addEventListener('click', (e) => {
    const payBtn = e.target.closest('[data-pay-bill]');
    const delBtn = e.target.closest('[data-del-bill]');
    if (payBtn) {
      const b = state.bills.find((x) => x.id === payBtn.dataset.payBill);
      if (!b) return;
      b.paid = true;
      state.balance = Math.max(0, +(state.balance - b.amount).toFixed(2));
      state.transactions.push({ id: uid(), date: todayISO(), amount: b.amount, category: 'Bills', note: b.name + ' (bill paid)', kind: 'bill' });
      save(); render();
      toast(b.name + ' paid — ' + fmt(b.amount));
    }
    if (delBtn) {
      state.bills = state.bills.filter((x) => x.id !== delBtn.dataset.delBill);
      save(); render();
    }
  });
  $('fundForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('fundName').value.trim();
    const annual = Number($('fundAnnual').value);
    if (!name || !annual) return;
    state.sinking.push({ id: uid(), name, annual, saved: 0, lastSetAside: '' });
    e.target.reset();
    save(); render();
    toast('Sinking fund added: ' + name + ' — ' + fmt(annual / 12) + '/month');
  });
  $('fundList').addEventListener('click', (e) => {
    const setBtn = e.target.closest('[data-setaside]');
    const delBtn = e.target.closest('[data-del-fund]');
    if (setBtn) {
      const f = state.sinking.find((x) => x.id === setBtn.dataset.setaside);
      if (!f) return;
      const monthly = +(f.annual / 12).toFixed(2);
      if (state.balance < monthly) { toast('Not enough in your balance to set this aside yet.'); return; }
      state.balance = +(state.balance - monthly).toFixed(2);
      f.saved = +(f.saved + monthly).toFixed(2);
      f.lastSetAside = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
      state.transactions.push({ id: uid(), date: todayISO(), amount: monthly, category: 'Sinking fund', note: f.name + ' set aside', kind: 'sinking' });
      save(); render();
      toast(fmt(monthly) + ' set aside for ' + f.name);
    }
    if (delBtn) {
      state.sinking = state.sinking.filter((x) => x.id !== delBtn.dataset.delFund);
      save(); render();
    }
  });
  $('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('goalName').value.trim();
    const target = Number($('goalTarget').value);
    if (!name || !target) return;
    const colors = ['#4E9B7A', '#B7791F', '#7C9070', '#5B7FA6', '#A86A8B'];
    state.goals.push({ id: uid(), name, target, saved: 0, color: colors[state.goals.length % colors.length] });
    e.target.reset();
    save(); render();
    toast('Jar added: ' + name);
  });
  $('jarGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goal-add]');
    if (!btn) return;
    const g = state.goals.find((x) => x.id === btn.dataset.goalAdd);
    const input = document.querySelector('[data-goal-amt="' + g.id + '"]');
    const amt = Number(input && input.value);
    if (!g || !amt || amt <= 0) { toast('Enter an amount to add.'); return; }
    if (state.balance < amt) { toast('Not enough in your balance for that.'); return; }
    const beforePct = g.target > 0 ? g.saved / g.target : 0;
    state.balance = +(state.balance - amt).toFixed(2);
    g.saved = +(g.saved + amt).toFixed(2);
    const afterPct = g.target > 0 ? g.saved / g.target : 0;
    state.transactions.push({ id: uid(), date: todayISO(), amount: amt, category: 'Savings', note: 'Added to ' + g.name, kind: 'goal' });
    save(); render();
    const milestones = [0.25, 0.5, 0.75, 1];
    const hit = milestones.find((m) => beforePct < m && afterPct >= m);
    if (hit) {
      const jar = $('jar-' + g.id);
      if (jar) jar.classList.add('celebrate');
      toast(hit === 1 ? g.name + ' is fully funded. Beautiful.' : Math.round(hit * 100) + '% of ' + g.name + ' — keep going.');
    } else {
      toast(fmt(amt) + ' added to ' + g.name);
    }
  });
  $('strategyBtn').addEventListener('click', () => {
    state.strategy = state.strategy === 'snowball' ? 'avalanche' : 'snowball';
    save(); render();
    toast(state.strategy === 'snowball' ? 'Snowball: smallest balance first.' : 'Avalanche: highest APR first.');
  });
  $('debtForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('debtName').value.trim();
    const balance = Number($('debtBalance').value);
    const apr = Number($('debtApr').value);
    if (!name || !balance) return;
    state.debts.push({ id: uid(), name, balance, original: balance, apr: apr || 0, min: 0, paidOff: false });
    e.target.reset();
    save(); render();
    toast('Debt added: ' + name);
  });
  $('debtList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-debt-pay]');
    if (!btn) return;
    const d = state.debts.find((x) => x.id === btn.dataset.debtPay);
    const input = document.querySelector('[data-debt-amt="' + d.id + '"]');
    const amt = Number(input && input.value);
    if (!d || !amt || amt <= 0) { toast('Enter an amount to pay.'); return; }
    if (state.balance < amt) { toast('Not enough in your balance for that.'); return; }
    state.balance = +(state.balance - amt).toFixed(2);
    d.balance = Math.max(0, +(d.balance - amt).toFixed(2));
    state.transactions.push({ id: uid(), date: todayISO(), amount: amt, category: 'Debt', note: 'Paid ' + d.name, kind: 'debt' });
    if (d.balance === 0) {
      d.paidOff = true;
      save(); render();
      toast(d.name + ' is paid off. That is a big deal.');
    } else {
      save(); render();
      toast(fmt(amt) + ' paid toward ' + d.name + ' — ' + fmt(d.balance) + ' left.');
    }
  });
  $('vaultForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('vaultName').value.trim();
    const amount = Number($('vaultAmount').value);
    if (!name || !amount) return;
    state.vault.push({ id: uid(), name, amount, addedAt: Date.now() });
    e.target.reset();
    save(); render();
    toast(name + ' is parked for 24 hours. Sleep on it.');
  });
  $('vaultList').addEventListener('click', (e) => {
    const buyBtn = e.target.closest('[data-vault-buy]');
    const skipBtn = e.target.closest('[data-vault-skip]');
    if (buyBtn) {
      const v = state.vault.find((x) => x.id === buyBtn.dataset.vaultBuy);
      if (!v) return;
      state.vault = state.vault.filter((x) => x.id !== v.id);
      save(); render();
      logSpend(v.amount, 'Shopping', v.name + ' (from vault)');
      return;
    }
    if (skipBtn) {
      const v = state.vault.find((x) => x.id === skipBtn.dataset.vaultSkip);
      if (!v) return;
      state.vaultSaved = +((state.vaultSaved || 0) + v.amount).toFixed(2);
      state.vault = state.vault.filter((x) => x.id !== v.id);
      save(); render();
      toast('Skipped ' + v.name + ' — you kept ' + fmt(v.amount) + '.');
    }
  });
  $('brainDump').addEventListener('input', (e) => {
    state.brainDump = e.target.value;
    $('dumpCount').textContent = e.target.value.length;
    save();
  });
  $('exportJsonBtn').addEventListener('click', () => {
    download('wrenessa-planner-backup.json', JSON.stringify(state, null, 2), 'application/json');
    toast('Backup downloaded.');
  });
  $('exportCsvBtn').addEventListener('click', () => {
    const rows = [['date', 'amount', 'category', 'note', 'kind']];
    state.transactions.forEach((x) => rows.push([x.date, x.amount, x.category, '"' + (x.note || '').replace(/"/g, '""') + '"', x.kind]));
    download('wrenessa-planner-spending.csv', rows.map((r) => r.join(',')).join('\n'), 'text/csv');
    toast('Spending exported as CSV.');
  });
  $('importJsonInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.balance !== 'number' || !Array.isArray(data.transactions)) throw new Error('bad file');
        state = data;
        state.envelopes = state.envelopes || [];
        save(); render();
        toast('Backup restored.');
      } catch (err) { toast('That file does not look like a planner backup.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  $('demoBtn').addEventListener('click', () => {
    if (!confirm('Load the demo data? Your current numbers will be replaced.')) return;
    state = demoState();
    save(); render();
    toast('Demo data loaded.');
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Start fresh? This clears all your numbers, bills, goals and notes on this device.')) return;
    state = freshState();
    try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
    save(); render();
    toast('Fresh start. Add your own numbers when you are ready.');
  });
  $('awayBalanceSave').addEventListener('click', () => {
    const v = Number($('awayBalance').value);
    if (!v && v !== 0) return;
    state.balance = v;
    save(); render();
    toast('Balance updated.');
  });
  $('awayDismiss').addEventListener('click', () => { $('awayCard').hidden = true; });

  // vault countdown tick
  setInterval(() => {
    let needsRender = false;
    document.querySelectorAll('[data-vault-timer]').forEach((el) => {
      const v = state.vault.find((x) => x.id === el.dataset.vaultTimer);
      if (!v) return;
      const left = vaultRemaining(v);
      el.textContent = fmtCountdown(left);
      el.classList.toggle('ready', left <= 0);
      if (left <= 0 && el.closest('li') && !el.closest('li').querySelector('[data-vault-buy]')) needsRender = true;
    });
    if (needsRender) renderVault();
  }, 1000);
}
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- boot ---------------- */
let state = null;
async function boot() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ }
  if (raw) {
    try { state = JSON.parse(raw); } catch (e) { state = null; }
  }
  if (!state) {
    // IndexedDB load must never block boot — 2s cap, then fall back to demo data.
    const fromIDB = await Promise.race([
      loadFromIDB(),
      new Promise((r) => setTimeout(() => r(null), 2000)),
    ]);
    state = fromIDB || demoState();
    if (!fromIDB) save();
  }
  // old saved state may predate envelopes — guard it
  state.envelopes = state.envelopes || [];
  // gentle catch-up after 7+ days away (no guilt, no streaks)
  const last = state.lastVisit || 0;
  if (last && Date.now() - last >= 7 * 86400e3) {
    $('awayBalance').value = state.balance;
    $('awayCard').hidden = false;
  }
  state.lastVisit = Date.now();
  save();
  bindEvents();
  render();
  // the demo is a preview page, not an installable app — no service worker
  if (!IS_DEMO && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => { /* offline support optional */ });
  }
}
document.addEventListener('DOMContentLoaded', boot);
