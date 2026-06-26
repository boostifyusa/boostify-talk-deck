/* JS-driven graphics: posting-week reshuffle + stat count-ups.
   Runs only for the current slide; timers are cleared on slide change.
   Honors prefers-reduced-motion. Loaded after reveal.js + Reveal.initialize(). */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timers = [];
  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }

  // pick 3 distinct indices from 0..6 (Fisher-Yates)
  function pick3() {
    var a = [0, 1, 2, 3, 4, 5, 6];
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a.slice(0, 3);
  }

  // Posting week: light up 3 random days; reshuffle on an interval.
  // Point of the slide: consistency matters, not which days.
  function reshuffle(slide) {
    var cal = slide.querySelector('.cal');
    if (!cal) return;
    var days = Array.prototype.slice.call(cal.querySelectorAll('.d'));
    if (days.length < 4) return;
    function apply() {
      var on = pick3();
      days.forEach(function (d, i) { d.classList.toggle('on', on.indexOf(i) > -1); });
    }
    apply();
    if (reduce) return;
    timers.push(setInterval(apply, 2300));
  }

  // Stat figures count up from 0 on slide enter (ints <= 3 digits, optional %).
  function countUp(slide) {
    var figs = Array.prototype.slice.call(slide.querySelectorAll('.fig'));
    figs.forEach(function (f) {
      var txt = f.getAttribute('data-val') || f.textContent.trim();
      f.setAttribute('data-val', txt);
      var m = txt.match(/^(\d{1,3})(%?)$/);
      if (!m) return;                 // skip 5.0, +30%, 2014, etc.
      if (reduce) { f.textContent = txt; return; }
      var target = parseInt(m[1], 10), suffix = m[2], steps = 26, dur = 850, i = 0;
      var token = (f._ct = (f._ct || 0) + 1);  // cancels any older count on re-enter
      f.textContent = '0' + suffix;
      function tick() {
        if (f._ct !== token) return;
        i++;
        var p = i / steps, eased = 1 - Math.pow(1 - p, 3);
        f.textContent = (i >= steps ? target : Math.round(eased * target)) + suffix;
        if (i < steps) timers.push(setTimeout(tick, dur / steps));
      }
      timers.push(setTimeout(tick, dur / steps));
    });
  }

  var lastSlide = null;
  // Live reviews feed (slide 10): newest on top, content flows down, a new one arrives slowly.
  var REVIEWS = [
    { n: 'Maria G.', a: '2 weeks ago', s: 5, t: 'Showed up on time, did exactly what they said, and cleaned up after. Hired them for the next job already.' },
    { n: 'James R.', a: '1 month ago', s: 5, t: 'Fair price and great communication the whole way through. Highly recommend to anyone in Fresno.' },
    { n: 'Tonya B.', a: '3 days ago', s: 5, t: 'Quick to respond and the work was spotless. You can tell they take real pride in it.' },
    { n: 'Luis M.', a: '1 week ago', s: 5, t: 'Best contractor we have used in the Valley. Honest quote, no surprises at the end.' },
    { n: 'Dana P.', a: '2 months ago', s: 4, t: 'Great job overall. A small follow-up was handled the same day, no hassle at all.' },
    { n: 'Carlos V.', a: '5 days ago', s: 5, t: 'They walked me through everything and finished a day early. Will use them again.' },
    { n: 'Priya S.', a: '3 weeks ago', s: 5, t: 'Professional, friendly, and the quality speaks for itself. Easy five stars.' }
  ];
  function starHtml(s) { return '★'.repeat(s) + (s < 5 ? '<span class="e">' + '★'.repeat(5 - s) + '</span>' : ''); }
  function fillCard(card, r) {
    card.querySelector('.stars').innerHTML = starHtml(r.s);
    card.querySelector('.q').innerHTML = '“' + r.t + '”';
    card.querySelector('.who').textContent = r.n + ' · ' + r.a;
  }
  function startReviews(slide) {
    var stack = slide.querySelector('.revstack');
    if (!stack) return;
    var cards = Array.prototype.slice.call(stack.querySelectorAll('.rev'));
    if (cards.length < 3) return;
    var n = REVIEWS.length, i = 2;
    function paint() {
      fillCard(cards[0], REVIEWS[i]);
      fillCard(cards[1], REVIEWS[(i - 1 + n) % n]);
      fillCard(cards[2], REVIEWS[(i - 2 + n) % n]);
    }
    paint();
    if (reduce) return;
    timers.push(setInterval(function () {
      i = (i + 1) % n;
      paint();
      cards[0].classList.remove('rev-new');
      void cards[0].offsetWidth; // re-trigger the arrival animation
      cards[0].classList.add('rev-new');
    }, 5500));
  }

  // AI agent chat (slide 19): play the message sequence, then loop.
  function startChat(slide) {
    var chat = slide.querySelector('.chat');
    if (!chat) return;
    var step = {};
    Array.prototype.slice.call(chat.querySelectorAll('[data-s]')).forEach(function (el) { step[el.getAttribute('data-s')] = el; });
    function reset() { for (var k in step) { step[k].classList.remove('show', 'hide'); } }
    if (reduce) { // show the resolved conversation, no motion
      step['1'].classList.add('show'); step['2'].classList.add('hide');
      step['3'].classList.add('show'); step['4'].classList.add('show'); step['5'].classList.add('show');
      return;
    }
    function run() {
      reset();
      timers.push(setTimeout(function () { step['1'].classList.add('show'); }, 450));
      timers.push(setTimeout(function () { step['2'].classList.add('show'); }, 1150));
      timers.push(setTimeout(function () { step['2'].classList.add('hide'); step['3'].classList.add('show'); }, 2650));
      timers.push(setTimeout(function () { step['4'].classList.add('show'); }, 3650));
      timers.push(setTimeout(function () { step['5'].classList.add('show'); }, 4550));
    }
    run();
    timers.push(setInterval(run, 8500));
  }

  function onSlide() {
    var slide = window.Reveal && Reveal.getCurrentSlide();
    if (!slide || slide === lastSlide) return; // ignore repeated fires for the same slide
    lastSlide = slide;
    clearTimers();
    reshuffle(slide);
    countUp(slide);
    startReviews(slide);
    startChat(slide);
  }

  function init() {
    if (!window.Reveal) return;
    Reveal.on('slidechanged', onSlide);
    Reveal.on('ready', onSlide);
    onSlide(); // in case 'ready' already fired
  }

  if (document.readyState !== 'loading') setTimeout(init, 60);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 60); });
})();
