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
  function onSlide() {
    var slide = window.Reveal && Reveal.getCurrentSlide();
    if (!slide || slide === lastSlide) return; // ignore repeated fires for the same slide
    lastSlide = slide;
    clearTimers();
    reshuffle(slide);
    countUp(slide);
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
