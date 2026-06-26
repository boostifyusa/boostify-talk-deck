// Presenter mode + cross-device sync (poll-based). Loads after Reveal.initialize().
// - PIN unlocks presenter mode (notes + control). Without it, a device just follows (read-only).
// - Attached devices stay in sync; detach to hold a device on its own slide.
// - Phone -> slides+bar, iPad/desktop -> notes (toggle either way).
(function () {
  var POLL = 700;
  var $ = function (id) { return document.getElementById(id); };
  var cid = localStorage.bz_cid || (localStorage.bz_cid = 'c' + Math.random().toString(36).slice(2, 9));
  var pin = localStorage.bz_pin || null;
  var unlocked = !!pin;
  var attached = localStorage.bz_attached !== '0';
  var isWide = window.matchMedia('(min-width:768px)').matches;
  var view = isWide ? 'notes' : 'slides';
  var lastRev = -1, applyingRemote = false;

  var pinModal = $('bz-pin'), notes = $('bz-notes'), bar = $('bz-bar'), unlockChip = $('bz-unlock');

  function R() { return window.Reveal; }
  function curIndex() { return R() ? R().getIndices().h : 0; }
  function total() { return R() ? R().getTotalSlides() : 1; }
  function slideTitle(i) {
    var s = R() && R().getSlides()[i];
    var h = s && s.querySelector('h1,h2');
    if (h) return h.textContent.replace(/\s+/g, ' ').trim();
    var d = s && s.querySelector('.lead, .label');
    return d ? d.textContent.slice(0, 60).trim() : ('Slide ' + (i + 1));
  }
  function noteFor(i) { return (window.BZ_NOTES && window.BZ_NOTES[i]) || ['(no notes for this slide)']; }

  function renderNotes() {
    var i = curIndex(), t = total();
    $('bz-num').textContent = (i + 1) + ' / ' + t;
    $('bz-now').textContent = slideTitle(i);
    var ul = $('bz-notelist'); ul.innerHTML = '';
    noteFor(i).forEach(function (n) { var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
    $('bz-next').innerHTML = (i + 1 < t) ? ('Up next: <b>' + slideTitle(i + 1) + '</b>') : '<b>End of deck</b>';
    $('bz-barnum').textContent = (i + 1) + '/' + t;
  }

  function syncButtons() {
    document.querySelectorAll('.bz-view').forEach(function (b) { b.textContent = (view === 'notes') ? 'Slides' : 'Notes'; });
    document.querySelectorAll('.bz-attach').forEach(function (b) { b.textContent = attached ? 'Detach' : 'Attach'; b.classList.toggle('on', !attached); });
  }
  // Locked = no control: disable reveal's own keyboard/arrows/swipe (and the overview jump).
  // Programmatic Reveal.slide() from sync still works, so locked devices follow but can't drive.
  function applyLock() {
    window.BZ_LOCKED = !unlocked;
    if (window.Reveal && Reveal.configure) Reveal.configure({ keyboard: unlocked, controls: unlocked, touch: unlocked });
  }
  function applyView() {
    notes.classList.toggle('show', unlocked && view === 'notes');
    bar.classList.toggle('show', unlocked && view === 'slides');
    unlockChip.classList.toggle('show', !unlocked);
    applyLock();
    syncButtons();
    renderNotes();
  }
  function setConn(ok) { document.querySelectorAll('.bz-conn').forEach(function (c) { c.classList.toggle('off', !ok); c.textContent = ok ? '● Live' : '● Offline'; }); }

  function dismissStart() { document.body.classList.remove('prestart'); var s = $('bz-start'); if (s) s.classList.add('hide'); }

  // ---- PIN ----
  function openPin() { pinModal.classList.add('show'); var inp = $('bz-pin-input'); inp.value = ''; $('bz-pin-err').textContent = ''; setTimeout(function () { inp.focus(); }, 60); }
  function unlock(p) { pin = p; localStorage.bz_pin = p; unlocked = true; pinModal.classList.remove('show'); dismissStart(); view = isWide ? 'notes' : 'slides'; applyView(); }
  $('bz-pin-go').onclick = function () {
    var p = $('bz-pin-input').value.trim();
    fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: p }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) unlock(p); else { $('bz-pin-err').style.color = 'var(--red)'; $('bz-pin-err').textContent = 'Wrong PIN.'; } })
      .catch(function () { $('bz-pin-err').style.color = 'var(--red)'; $('bz-pin-err').textContent = 'Cannot reach the server.'; });
  };
  $('bz-pin-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('bz-pin-go').click(); });
  $('bz-pin-forgot').onclick = function () {
    $('bz-pin-err').style.color = 'var(--mute)'; $('bz-pin-err').textContent = 'Sending...';
    fetch('/api/forgot', { method: 'POST' }).then(function (r) { return r.json(); })
      .then(function (d) { $('bz-pin-err').style.color = d.sent ? 'var(--green)' : 'var(--red)'; $('bz-pin-err').textContent = d.sent ? 'PIN sent to the owner email.' : (d.reason || 'Could not send.'); })
      .catch(function () { $('bz-pin-err').style.color = 'var(--red)'; $('bz-pin-err').textContent = 'Cannot reach the server.'; });
  };
  $('bz-pin-cancel').onclick = function () { pinModal.classList.remove('show'); };
  unlockChip.onclick = openPin;

  // ---- toggles ----
  document.querySelectorAll('.bz-view').forEach(function (b) { b.onclick = function () { view = (view === 'notes') ? 'slides' : 'notes'; applyView(); }; });
  document.querySelectorAll('.bz-attach').forEach(function (b) {
    b.onclick = function () { attached = !attached; localStorage.bz_attached = attached ? '1' : '0'; if (attached) pullState(true); syncButtons(); };
  });
  document.querySelectorAll('.bz-recenter').forEach(function (b) { b.onclick = recenterAll; });
  $('bz-prev').onclick = function () { R() && R().prev(); };
  $('bz-nextb').onclick = function () { R() && R().next(); };

  // ---- sync ----
  function pushState() {
    if (!unlocked || !attached || !pin) return;
    fetch('/api/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slide: curIndex(), clientId: cid, pin: pin }) })
      .then(function (r) { return r.json(); }).then(function (s) { if (s && typeof s.rev === 'number') lastRev = s.rev; }).catch(function () {});
  }
  function pullState(force) {
    return fetch('/api/state').then(function (r) { return r.json(); }).then(function (s) {
      setConn(true);
      if (typeof s.rev !== 'number') return;
      // Remember the room's slide so the start overlay can land a late joiner on it (not slide 1).
      if (typeof s.slide === 'number') window.BZ_SHARED_SLIDE = s.slide;
      if (s.rev !== lastRev || force) {
        lastRev = s.rev;
        if ((attached || force) && s.by !== cid && typeof s.slide === 'number' && s.slide !== curIndex()) {
          applyingRemote = true; R() && R().slide(s.slide); setTimeout(function () { applyingRemote = false; }, 60);
        }
      }
    }).catch(function () { setConn(false); });
  }
  // "Recenter everyone": force-advance the shared slide so every attached device snaps to mine.
  function recenterAll() {
    if (!unlocked || !pin) return;
    fetch('/api/state', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slide: curIndex(), clientId: cid, pin: pin, force: true }) })
      .then(function (r) { return r.json(); }).then(function (s) { if (s && typeof s.rev === 'number') lastRev = s.rev; }).catch(function () {});
  }

  function start() {
    if (!window.Reveal) { return setTimeout(start, 80); }
    Reveal.on('slidechanged', function () { renderNotes(); if (!applyingRemote) pushState(); });
    if (unlocked) dismissStart();
    // A read-only late joiner clicks the cover to begin: snap them to the live slide right after.
    var se = $('bz-start'); if (se) se.addEventListener('click', function () { setTimeout(function () { pullState(true); }, 240); });
    applyView();
    pullState(true);
    // Jittered, non-overlapping poll: at 100-300 viewers this spreads load and never stacks requests.
    function loop() { pullState(false).then(function () { setTimeout(loop, POLL + Math.floor(Math.random() * 300)); }); }
    setTimeout(loop, POLL + Math.floor(Math.random() * 300));
  }
  start();
})();
