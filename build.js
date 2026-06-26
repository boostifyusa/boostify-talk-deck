// Build the reveal.js presentation from the static Boostify deck.
// Keeps all original styles/markup; wraps each <section class="slide"> as a reveal slide,
// adds integration CSS, auto-playing per-slide animations, a start-in-fullscreen overlay,
// and the reveal init. Run: node build.js
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '_source-deck.html'), 'utf8');

// 1) deck CSS (the single <style> block in <head>)
const styleMatch = src.match(/<style>([\s\S]*?)<\/style>/);
const deckCSS = styleMatch ? styleMatch[1] : '';

// 2) body inner
const bodyMatch = src.match(/<body>([\s\S]*?)<\/body>/);
let body = bodyMatch ? bodyMatch[1] : '';

// 3) split the logo <symbol> def from the slide sections
const symMatch = body.match(/<svg width="0"[\s\S]*?<\/symbol><\/svg>/);
const symbolDef = symMatch ? symMatch[0] : '';
let sections = symbolDef ? body.replace(symbolDef, '') : body;

// 4) wrap each original <section class="slide ..."> as <section class="rs"><div class="slide ...">...</div></section>
sections = sections
  .replace(/<section class="slide/g, '<section class="rs"><div class="slide')
  .replace(/<\/section>/g, '</div></section>')
  .trim();

const fontLink = (src.match(/<link href="https:\/\/fonts\.googleapis[^>]*>/) || [''])[0];

const integrationCSS = `
/* ---------- reveal.js integration ---------- */
html,body{margin:0;padding:0;height:100%;width:100%;background:#15110d;}
.reveal{height:100vh;width:100vw;font-family:var(--body);}
.reveal .slides{text-align:left;}
.reveal .slides section.rs{padding:0!important;width:1280px!important;height:720px!important;overflow:visible;display:block;}
.reveal .slides section.rs>.slide{box-shadow:none!important;}
.reveal .controls{color:var(--orange);}
.reveal .progress{color:var(--orange);height:5px;}
.reveal .slide-number{background:rgba(26,21,17,.6);font-family:var(--body);}

/* ---------- per-slide content reveal (auto-plays on slide enter; no clicking) ---------- */
@keyframes bzRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.reveal .slides section.present>.slide>*{animation:bzRise .5s cubic-bezier(.2,.7,.2,1) both;}
.reveal .slides section.present>.slide>*:nth-child(1){animation-delay:.04s}
.reveal .slides section.present>.slide>*:nth-child(2){animation-delay:.13s}
.reveal .slides section.present>.slide>*:nth-child(3){animation-delay:.22s}
.reveal .slides section.present>.slide>*:nth-child(4){animation-delay:.31s}
.reveal .slides section.present>.slide>*:nth-child(5){animation-delay:.40s}
.reveal .slides section.present>.slide>*:nth-child(6){animation-delay:.48s}
.reveal .slides section.present>.slide>*:nth-child(n+7){animation-delay:.55s}
/* hold the cover hidden until the user starts, then play it in */
body.prestart .reveal .slides section.present>.slide>*{animation:none;opacity:0;}
@media (prefers-reduced-motion:reduce){.reveal .slides section.present>.slide>*{animation:none!important;opacity:1!important;}}

/* ---------- start / fullscreen overlay ---------- */
#bz-start{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;cursor:pointer;
  background:radial-gradient(130% 130% at 72% 18%, #C44E13 0%, #9a3f0e 62%, #7c330b 100%);color:#fff;font-family:var(--body);transition:opacity .45s ease;}
#bz-start.hide{opacity:0;pointer-events:none;}
#bz-start .si{display:flex;flex-direction:column;align-items:flex-start;gap:18px;max-width:760px;padding:0 6vw;}
#bz-start .smk{height:34px;width:auto;color:#fff;}
#bz-start h1{font-family:var(--disp);font-weight:800;font-size:clamp(40px,7vw,86px);line-height:.95;letter-spacing:-.03em;}
#bz-start h1 .g{color:var(--gold);}
#bz-start p{font-size:clamp(15px,2.1vw,20px);font-weight:500;opacity:.92;max-width:46ch;line-height:1.5;}
#bz-start .cta{margin-top:8px;display:inline-flex;align-items:center;gap:12px;background:#fff;color:#7c330b;font-family:var(--disp);font-weight:800;
  font-size:clamp(15px,2vw,19px);padding:14px 26px;border-radius:10px;}
#bz-start .cta .pl{display:inline-block;width:0;height:0;border-left:13px solid #C44E13;border-top:9px solid transparent;border-bottom:9px solid transparent;}
#bz-start .hint{margin-top:14px;font-size:13px;letter-spacing:.04em;opacity:.78;text-transform:uppercase;font-weight:600;}

/* ---------- floating overview (zoom-out) button ---------- */
#bz-grid{position:fixed;right:16px;bottom:14px;z-index:60;width:40px;height:40px;border-radius:9px;border:1px solid rgba(255,255,255,.25);
  background:rgba(26,21,17,.55);display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;padding:9px;cursor:pointer;backdrop-filter:blur(4px);}
#bz-grid span{background:#fff;border-radius:2px;opacity:.9;}
#bz-grid:hover{background:var(--orange);border-color:var(--orange);}
.reveal.overview #bz-grid{background:var(--orange);border-color:var(--orange);}
`;

const initJS = `
  const startEl = document.getElementById('bz-start');
  function enterFullscreen(){
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if(fn){ try{ const p = fn.call(el); if(p && p.catch) p.catch(function(){}); }catch(e){} }
  }
  function startShow(){
    if(startEl.classList.contains('hide')) return;
    enterFullscreen();
    startEl.classList.add('hide');
    document.body.classList.remove('prestart'); // triggers the cover animation
    setTimeout(function(){ if(window.Reveal){ Reveal.layout(); Reveal.slide(0); } }, 120);
  }
  startEl.addEventListener('click', startShow);
  window.addEventListener('keydown', function(e){
    if(!startEl.classList.contains('hide') && (e.key==='Enter'||e.key===' '||e.key==='ArrowRight')){ e.preventDefault(); startShow(); }
  }, true);

  Reveal.initialize({
    width: 1280, height: 720, margin: 0, minScale: 0.2, maxScale: 2.0,
    center: false, hash: true, controls: true, controlsTutorial: false,
    progress: true, slideNumber: 'c/t', keyboard: true, overview: true, touch: true,
    transition: 'slide', transitionSpeed: 'default', backgroundTransition: 'fade',
    disableLayout: false
  });

  document.getElementById('bz-grid').addEventListener('click', function(){ Reveal.toggleOverview(); });
`;

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Boostify USA — Get Seen, Get Hired</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontLink}
<link rel="stylesheet" href="vendor/reveal/reveal.css">
<link rel="stylesheet" href="anim.css">
<style>
${deckCSS}
${integrationCSS}
</style>
</head>
<body class="prestart">

${symbolDef}

<div id="bz-start"><div class="si">
  <svg class="smk" viewBox="0 0 540.41 109.65" role="img" aria-label="Boostify"><use href="#bz-logo"/></svg>
  <h1>Get seen.<br><span class="g">Get hired.</span></h1>
  <p>Practical social media and website moves for Central Valley businesses. Plus how to stay safe online.</p>
  <span class="cta"><span class="pl"></span> Start presentation</span>
  <div class="hint">Click anywhere · Arrow keys to move · Press O for overview</div>
</div></div>

<div class="reveal"><div class="slides">
${sections}
</div></div>

<div id="bz-grid" title="Overview (O)"><span></span><span></span><span></span><span></span></div>

<script src="vendor/reveal/reveal.js"></script>
<script>
${initJS}
</script>
<script src="anim.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'index.html'), out);
const slideCount = (sections.match(/<section class="rs">/g) || []).length;
console.log('Wrote index.html — ' + slideCount + ' slides, ' + out.length + ' bytes');
console.log('symbolDef found:', !!symbolDef, '| deckCSS bytes:', deckCSS.length, '| fontLink:', !!fontLink);
