(function () {
  'use strict';

  // ---------- safe storage ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ---------- elements ----------
  const $ = (id) => document.getElementById(id);
  const card = $('card');
  const qBadge = $('qBadge');
  const qCount = $('qCount');
  const qText = $('qText');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');
  const copyBtn = $('copyBtn');
  const form = $('pickForm');
  const numInput = $('numInput');
  const rangeHint = $('rangeHint');
  const randomBtn = $('randomBtn');
  const noRepeat = $('noRepeat');
  const resetBtn = $('resetBtn');
  const historyList = $('historyList');
  const askedCount = $('askedCount');
  const toast = $('toast');
  const qCat = $('qCat');
  const themeChips = $('themeChips');
  const allThemesBtn = $('allThemesBtn');

  // Theme index in questions.txt -> display name
  const THEMES = ['Work life', 'Food & drink', 'Travel & places', 'Would you rather', 'Hypotheticals',
    'Favorites', 'Throwbacks', 'Hobbies & fun', 'Tech & tools', 'Movies, music & books'];

  let questions = [];              // [{ text, theme }]
  let selected = loadThemes();     // Set of theme indexes used by Randomize
  let pool = [];                   // global question numbers (1-based) in the selected themes, in order
  let current = null;              // global question number on screen (1-based; also used in the URL hash)
  let asked = loadAsked();         // ordered list of numbers asked this game

  // ---------- theme ----------
  const themeButtons = document.querySelectorAll('[data-theme-choice]');
  function applyTheme(choice) {
    const root = document.documentElement;
    if (choice === 'light' || choice === 'dark') {
      root.setAttribute('data-theme', choice);
      store.set('sdg-theme', choice);
    } else {
      root.removeAttribute('data-theme');
      store.del('sdg-theme');
      choice = 'system';
    }
    themeButtons.forEach((b) => {
      const on = b.dataset.themeChoice === choice;
      b.setAttribute('aria-checked', String(on));
      const icon = b.querySelector('i');
      icon.classList.toggle('ph-fill', on);   // Fill style = active state
      icon.classList.toggle('ph-light', !on); // Regular/Light = default
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', dark ? '#001A35' : '#0072CF');
  }
  themeButtons.forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.themeChoice)));
  applyTheme(store.get('sdg-theme') || 'system');
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!store.get('sdg-theme')) applyTheme('system');
  });

  // ---------- asked history ----------
  function loadAsked() {
    try {
      const v = JSON.parse(store.get('sdg-asked-v2') || '[]');
      return Array.isArray(v) ? v.filter(Number.isInteger) : [];
    } catch (e) { return []; }
  }
  function loadThemes() {
    try {
      const v = JSON.parse(store.get('sdg-themes') || 'null');
      if (Array.isArray(v)) {
        const ok = v.filter((i) => Number.isInteger(i) && i >= 0 && i < THEMES.length);
        if (ok.length) return new Set(ok);
      }
    } catch (e) {}
    return new Set(THEMES.map((_, i) => i));
  }
  function saveThemes() { store.set('sdg-themes', JSON.stringify([...selected])); }

  // Numbers typed by players count within the selected themes:
  // all themes -> 1-3000, one theme -> 1-300, several -> 1-N across them.
  function rebuildPool() {
    pool = [];
    for (let i = 1; i <= questions.length; i++) {
      if (selected.has(questions[i - 1].theme)) pool.push(i);
    }
  }
  function posOf(g) { return pool.indexOf(g) + 1; } // 0 when not in the pool
  function scopeLabel() {
    if (selected.size === THEMES.length) return '';
    if (selected.size === 1) return ` in ${THEMES[[...selected][0]]}`;
    return ` across ${selected.size} themes`;
  }
  function onThemesChanged() {
    saveThemes();
    renderThemes();
    if (!questions.length) return;
    rebuildPool();
    numInput.max = pool.length;
    numInput.placeholder = `1–${pool.length}`;
    clearError();
    if (current && posOf(current)) {
      show(current, { fromHash: true, noMark: true });
    } else if (current) {
      // The question on screen isn't in the new selection; reset the card.
      current = null;
      numInput.value = '';
      qBadge.textContent = '#—';
      qCat.hidden = true;
      qCount.textContent = `${pool.length} questions`;
      qText.textContent = 'Enter a number or press Randomize to get started.';
      qText.classList.add('is-empty');
      prevBtn.disabled = nextBtn.disabled = true;
      history.replaceState(null, '', location.pathname);
      renderHistory();
    } else {
      qCount.textContent = `${pool.length} questions`;
      renderHistory();
    }
  }

  function renderThemes() {
    themeChips.innerHTML = '';
    THEMES.forEach((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-chip';
      b.textContent = name;
      b.setAttribute('aria-pressed', String(selected.has(i)));
      b.addEventListener('click', () => toggleTheme(i));
      themeChips.appendChild(b);
    });
    const all = selected.size === THEMES.length;
    allThemesBtn.textContent = all ? 'Clear' : 'Select all';
  }
  function toggleTheme(i) {
    if (selected.has(i)) {
      if (selected.size === 1) { showToast('Keep at least one theme selected.'); return; }
      selected.delete(i);
    } else {
      selected.add(i);
    }
    onThemesChanged();
  }
  allThemesBtn.addEventListener('click', () => {
    // "Clear" leaves just the first theme so Randomize always has a pool
    selected = selected.size === THEMES.length ? new Set([0]) : new Set(THEMES.map((_, i) => i));
    onThemesChanged();
  });

  function saveAsked() { store.set('sdg-asked-v2', JSON.stringify(asked)); }

  // Record a question the first time it's shown. Revisiting it (history chip,
  // previous/next, a link) keeps its original place in the list.
  function markAsked(n) {
    if (asked.includes(n)) return;
    asked.push(n);
    saveAsked();
  }

  function renderHistory() {
    askedCount.textContent = `(${asked.length})`;
    historyList.innerHTML = '';
    if (!asked.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No questions yet.';
      historyList.appendChild(li);
      return;
    }
    const inScope = asked.filter((n) => posOf(n));
    if (!inScope.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'None in these themes yet.';
      historyList.appendChild(li);
      return;
    }
    // Oldest first: each new question is added at the end, so chips never shift.
    inScope.forEach((n) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `#${posOf(n)}`;
      b.setAttribute('aria-label', `Show question ${posOf(n)}`);
      if (n === current) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => show(n));
      li.appendChild(b);
      historyList.appendChild(li);
    });
  }

  // ---------- display ----------
  // n is the global question number.
  function show(n, opts = {}) {
    if (!questions.length) return;
    if (!posOf(n)) {
      // Opened from a link to a question outside the selected themes: widen to all themes.
      selected = new Set(THEMES.map((_, i) => i));
      saveThemes();
      renderThemes();
      rebuildPool();
      numInput.max = pool.length;
      numInput.placeholder = `1–${pool.length}`;
      showToast('Showing all themes.');
    }
    current = n;
    const pos = posOf(n);
    qBadge.textContent = `#${pos}`;
    qCount.textContent = `of ${pool.length}${scopeLabel()}`;
    const q = questions[n - 1];
    qText.textContent = q.text;
    qCat.textContent = THEMES[q.theme] || '';
    qCat.hidden = !qCat.textContent;
    qText.classList.remove('is-empty');
    card.classList.remove('flip'); void card.offsetWidth; card.classList.add('flip');
    prevBtn.disabled = pos <= 1;
    nextBtn.disabled = pos >= pool.length;
    numInput.value = pos;
    clearError();
    if (!opts.noMark) markAsked(n);
    renderHistory();
    if (!opts.fromHash) history.replaceState(null, '', `#${n}`);
  }

  function randomPick() {
    const total = questions.length;
    if (!total) return;
    const seen = noRepeat.checked ? new Set(asked) : new Set(current ? [current] : []);
    const options = pool.filter((g) => !seen.has(g));
    if (!options.length) {
      showToast(noRepeat.checked
        ? 'Every question in these themes has been asked. Add a theme or press Reset.'
        : 'Add another theme to keep going.');
      return;
    }
    const pick = options[cryptoRandom(options.length)];
    show(pick);
  }

  function cryptoRandom(max) {
    if (window.crypto?.getRandomValues) {
      const a = new Uint32Array(1);
      const limit = Math.floor(0xFFFFFFFF / max) * max;
      do { crypto.getRandomValues(a); } while (a[0] >= limit);
      return a[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function setError(msg) {
    rangeHint.textContent = msg;
    rangeHint.classList.add('error');
    numInput.classList.add('invalid');
    numInput.setAttribute('aria-invalid', 'true');
  }
  function clearError() {
    rangeHint.textContent = `Choose a number from 1 to ${pool.length}${scopeLabel()}.`;
    rangeHint.classList.remove('error');
    numInput.classList.remove('invalid');
    numInput.removeAttribute('aria-invalid');
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  // ---------- events ----------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Number(numInput.value);
    if (!Number.isInteger(n) || n < 1 || n > pool.length) {
      setError(`That number isn't in range. Try 1 to ${pool.length}${scopeLabel()}.`);
      numInput.focus();
      return;
    }
    show(pool[n - 1]);
  });
  numInput.addEventListener('input', clearError);
  randomBtn.addEventListener('click', randomPick);
  function step(d) {
    const pos = current ? posOf(current) : 0;
    const next = pos + d;
    if (pos && next >= 1 && next <= pool.length) show(pool[next - 1]);
  }
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  resetBtn.addEventListener('click', () => {
    asked = [];
    saveAsked();
    renderHistory();
    showToast('History cleared.');
  });
  noRepeat.addEventListener('change', () => store.set('sdg-norepeat', noRepeat.checked ? '1' : '0'));
  if (store.get('sdg-norepeat') === '0') noRepeat.checked = false;

  copyBtn.addEventListener('click', async () => {
    if (!current) return;
    const url = `${location.origin}${location.pathname}#${current}`;
    try { await navigator.clipboard.writeText(url); showToast('Link copied.'); }
    catch (e) { showToast(url); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target === numInput || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); randomPick(); }
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n >= 1 && n <= questions.length && n !== current) show(n, { fromHash: true });
  });

  // ---------- load ----------
  renderThemes();

  // Questions live in questions/part-1.txt, part-2.txt, part-3.txt (1,000 each, in order).
  // One question per line as "<theme index>|<question text>". Line 1 of part 1 is question #1.
  const PARTS = ['questions/part-1.txt', 'questions/part-2.txt', 'questions/part-3.txt'];
  Promise.all(PARTS.map((f) => fetch(f, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })))
    .then((parts) => {
      const data = parts.join('\n');
      questions = data.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
        const bar = l.indexOf('|');
        return bar > 0
          ? { theme: Number(l.slice(0, bar)), text: l.slice(bar + 1).trim() }
          : { theme: -1, text: l.trim() };
      });
      rebuildPool();
      numInput.max = pool.length;
      numInput.placeholder = `1–${pool.length}`;
      qCount.textContent = `${pool.length} questions`;
      clearError();
      prevBtn.disabled = nextBtn.disabled = true;
      qText.classList.add('is-empty');
      renderHistory();
      const n = parseInt(location.hash.slice(1), 10);
      if (n >= 1 && n <= questions.length) show(n, { fromHash: true });
    })
    .catch(() => {
      qCount.textContent = '';
      qText.textContent = "Couldn't load the questions. Refresh to try again.";
      qText.classList.add('is-empty');
    });
})();
