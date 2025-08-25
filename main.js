// IO83 – main.js (répartition par blocs 3–4 + headroom intérieur)
// - Conserve: dash, double saut, toits one-way + ↓, Kaito + son bâtiment, mur fin,
//   caméra Y douce, overlay 10/10, sons…
// - Intérieur confortable (plafond reculé, sol un peu plus bas)
// - Répartition "par blocs" 3–4 bâtiments avec 1 PNJ + 1 poster par bloc (si place)

(function(){
  'use strict';
  // --- Stub ultra-tôt : permet d’appeler __IO83_START__ depuis le HTML AVANT que onStart soit défini
if (!window.__IO83_PENDING_START__) window.__IO83_PENDING_START__ = false;
window.__IO83_START__ = function(e){ window.__IO83_PENDING_START__ = true; };

// --- Polyfills qui peuvent sinon bloquer le boot sur des moteurs plus vieux
if (!Promise.allSettled) {
  Promise.allSettled = function(promises){
    return Promise.all(promises.map(function(p){
      return Promise.resolve(p).then(
        function(value){ return {status:'fulfilled', value:value}; },
        function(reason){ return {status:'rejected',  reason:reason}; }
      );
    }));
  };
}
if (!Array.from) {
  Array.from = function(a){ return [].slice.call(a); };
}
  // ——— Debug visuel : affiche une bannière rouge si une erreur JS survient ———
window.addEventListener('error', function(ev){
  try{
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#b00020;color:#fff;padding:8px 12px;font:14px/1.4 system-ui';
    bar.textContent = 'Erreur JS: ' + (ev.error && ev.error.message ? ev.error.message : ev.message);
    document.body.appendChild(bar);
  }catch(_){}
});


  /* ========== Utils ========== */
  const rnd=(a,b)=>Math.random()*(b-a)+a;
  const rint=(a,b)=>Math.floor(rnd(a,b+1));
  const aabb=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;

/* ========== Canvas (lazy init) ========== */
let canvas = null;
let ctx = null;
const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

function resize(){
  if(!canvas || !ctx) return;
  const w = 1280, h = 720;
  canvas.width = w * DPR; 
  canvas.height = h * DPR;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}

let resizeHooked = false;
function ensureCanvas(){
  if (canvas && ctx) return true;
  const el = document.getElementById('game');
  if(!el){ console.error('[IO83] Canvas #game introuvable'); return false; }
  canvas = el;
  try{
    ctx = canvas.getContext('2d', {alpha:false});
  }catch(e){}
  if(!ctx) ctx = canvas.getContext('2d');
  if(!ctx){ console.error('[IO83] Contexte 2D introuvable'); return false; }
  resize();
  if(!resizeHooked){ addEventListener('resize', resize); resizeHooked = true; }
  return true;
}



/* ========== Gate / HUD ========== */
const gate = document.getElementById('gate');
const startBtn = document.getElementById('startBtn');

// --- DÉMARRAGE DURABLE : premier geste humain = onStart (vraiment) ---
let started = false;
let hardStartArmed = false;

// Compat : utilisé ailleurs (gateUI etc.)
function tryStart(){ startAudio(); boot(); }

// -> Démarrage robuste
function onStart(e){
  if (started) return;
  started = true;
  if (e) { try{ e.preventDefault(); }catch(_){} }
  

  // >>> IMPORTANT : garder l’écran titre visible et afficher ton LOADING tout de suite
  if (window.gateUI && window.gateUI.showLoading) window.gateUI.showLoading();
  cleanup();                // on débranche les listeners "start"


  try {
    ensureCanvas();         // on prépare le canvas (sans démarrer la boucle)
    startAudio();           // démuter musique au besoin
    boot();                 // boot lance les chargements puis, seulement une fois prêt :
                            //   - cache le gate
                            //   - stoppe les UI gate
                            //   - démarre la boucle de jeu
  } catch(err){
    console.error('[IO83] start error:', err);
    started = false;        // permet un second essai si une exception survient
  }
}

  window.__IO83_START__ = onStart;


// Clavier (Enter / Espace)
function onStartKey(e){
  const k = e.key;
  if (k === 'Enter' || k === ' ' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown'){
    onStart(e);
  }
}


// Supprime tous les listeners « hard start »
function cleanup(){
  const winEvs = ['pointerdown','pointerup','click','mousedown','mouseup','touchstart','touchend','keydown','keyup','wheel','contextmenu','gamepadconnected'];
  winEvs.forEach(ev => window.removeEventListener(ev, onStart, true));
  window.removeEventListener('keydown', onStartKey, true);

  if (gate){
    gate.onclick = null;
    gate.removeEventListener('click', onStart);
    gate.removeEventListener('pointerdown', onStart);
    gate.removeEventListener('keydown', onStartKey);
  }
  if (startBtn){
    startBtn.onclick = null;
    startBtn.removeEventListener('click', onStart);
    startBtn.removeEventListener('pointerdown', onStart);
  }
}

// Arme le démarrage sur **toute** action utilisateur + timebomb de secours
function armHardStart(){
  if (hardStartArmed) return;
  hardStartArmed = true;

  // Le « gate » agit comme un énorme bouton
  if (gate){
    gate.style.cursor = 'pointer';
    gate.setAttribute('role','button');
    gate.setAttribute('tabindex','0');

    gate.onclick = onStart;
    gate.addEventListener('click', onStart, {passive:false});
    gate.addEventListener('pointerdown', onStart, {passive:false});
    gate.addEventListener('keydown', onStartKey, {passive:false});
  }

// Seulement : clic/tap et touches utiles (flèches, espace, Entrée)
const opts = { capture:true, passive:false };
['click','pointerdown','touchstart','keydown'].forEach(ev => window.addEventListener(ev, onStart, opts));
window.removeEventListener('wheel', onStart, opts);       // sécurité si existait
window.removeEventListener('contextmenu', onStart, opts); // sécurité si existait


  // Le bouton HTML (s’il est dévoilé) démarre aussi
  if (startBtn){
    startBtn.disabled = false;
    startBtn.addEventListener('click', onStart, {passive:false});
    startBtn.addEventListener('pointerdown', onStart, {passive:false});
  }

  // Exposé console (secours manuel)
  window.__IO83_START__ = onStart;
if (window.__IO83_PENDING_START__) { try { onStart(); } catch(_){} }
}

// Arme dès maintenant
armHardStart();


  const hud = document.getElementById('hud');

  let postersCount = 0, eggs = 0;          // ← UNE SEULE FOIS
  const POSTERS_TOTAL = 10;
  const MAX_COUNT_CAP = 11; // cap d'affichage/compte à 11


  const scoreEl = document.getElementById('scoreNum');

  // Crée la boîte des œufs si elle n’existe pas déjà et renvoie le <span id="eggNum">
  const eggBox = (() => {
    let e = document.getElementById('eggNum');
    if (!e) {
      const box = document.createElement('div');
      box.id = 'eggs';
      box.innerHTML = '??? <span id="eggNum">0/10</span>';
      hud.appendChild(box);
      e = box.querySelector('#eggNum');
    }
    return e;
  })();
  
// Couleur : seul le compteur (0/10) en jaune, pas "???"
try{
  const wantedColor = scoreEl ? getComputedStyle(scoreEl).color : null;
  if (wantedColor && eggBox) eggBox.style.color = wantedColor; // chiffres en jaune
  const eggsDiv = document.getElementById('eggs');
  if (eggsDiv) eggsDiv.style.removeProperty('color'); // laisse "???" en couleur par défaut
}catch(_){}



  
// ——— HUD moderne : légende centrée + panneau score top-right ———
let scoreWantedUI = null, scoreEggUI = null; // utilisés par setWanted/setEggs

function installHUD(){
  const SCALE = 0.80;                     // ~20% plus petit
  const BASE_W = 420, BASE_H = 94;
  const PANEL_W = Math.round(BASE_W * SCALE); // 336
  const PANEL_H = Math.round(BASE_H * SCALE); // 75
  const PANEL_TOP   = 18;
  const PANEL_RIGHT = 24;

  // Ajuste ces deux valeurs si jamais ton PNG change (ce sont les bordures visuelles internes)
  const PANEL_INSET_TOP    = Math.round(12 * SCALE);  // marge visuelle haute interne du PNG
  const PANEL_INSET_BOTTOM = Math.round(12 * SCALE);  // marge visuelle basse interne du PNG
  const H_PAD = 32;                                   // padding gauche/droite identique à avant

  const counterColor = (scoreEl && getComputedStyle(scoreEl).color) || '#FFD15C';

  // — Score panel —
  const panel = document.createElement('div');
  panel.id = 'scorePanel';
  panel.style.cssText = [
    'position:fixed', `top:${PANEL_TOP}px`, `right:${PANEL_RIGHT}px`,
    `width:${PANEL_W}px`, `height:${PANEL_H}px`,
    'background-repeat:no-repeat','background-position:center','background-size:contain',
    'image-rendering:pixelated','pointer-events:none','z-index:60',
    'display:block','contain:paint'
  ].join(';');
  panel.style.backgroundImage = `url(${ASSETS.scorePanelPNG})`;
  document.body.appendChild(panel);

  // Zone intérieure EXACTE du “cartouche” (top/bottom insets respectés)
  const inner = document.createElement('div');
  inner.style.cssText = [
    'position:absolute',
    `left:${H_PAD}px`, `right:${H_PAD}px`,
    `top:${PANEL_INSET_TOP}px`, `bottom:${PANEL_INSET_BOTTOM}px`,
    'display:flex','align-items:center','justify-content:center',
    'white-space:nowrap'
  ].join(';');
  panel.appendChild(inner);

  // Ligne de texte (aucun surplus vertical)
  const line = document.createElement('span');
  line.style.cssText = [
    'display:inline-flex','align-items:center','justify-content:center',
    'font:16px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    'text-shadow:0 1px 0 rgba(0,0,0,.25)','color:#7a3f12',
    'letter-spacing:0','line-height:1'
  ].join(';');
  line.style.transform = 'translateY(-4px)'; // remonte légèrement le texte


  const sp = w => { const s=document.createElement('span'); s.style.cssText=`display:inline-block;width:${w}ch`; return s; };

  const wantedLbl = document.createElement('b');
  wantedLbl.className='lbl';
  wantedLbl.textContent='wanted';

  const wantedNum = document.createElement('b');
  wantedNum.id='uiWantedNum';
  wantedNum.className='num';
  wantedNum.textContent='0/10';
  wantedNum.style.cssText = `font-weight:800; color:${counterColor}; font-variant-numeric:tabular-nums;`;

  const eggLbl = document.createElement('b');
  eggLbl.className='lbl';
  eggLbl.textContent='???';

  const eggNum = document.createElement('b');
  eggNum.id='uiEggNum';
  eggNum.className='num';
  eggNum.textContent='0/10';
  eggNum.style.cssText = `font-weight:800; color:${counterColor}; font-variant-numeric:tabular-nums;`;

  // Espacements : wanted (2) 0/10 (4) ??? (2) 0/10
  line.append(wantedLbl, sp(2), wantedNum, sp(4), eggLbl, sp(2), eggNum);
  inner.appendChild(line);

  scoreWantedUI = wantedNum;
  scoreEggUI    = eggNum;

  // masque l’ancien HUD si présent
  try{
    if (scoreEl && scoreEl.parentElement) scoreEl.parentElement.style.display = 'none';
    const oldEggs = document.getElementById('eggs');
    if (oldEggs) oldEggs.style.display = 'none';
  }catch(_){}

  // Légende noire centrée (inchangé)
  const legend = document.createElement('div');
  legend.id = 'io83Legend';
  legend.style.cssText = [
    'position:fixed',
    `top:${PANEL_TOP + Math.round(PANEL_H/2)}px`,
    'left:50%','transform:translate(-50%,-50%)',
    'z-index:55','pointer-events:none','opacity:.95',
    'display:flex','gap:28px','align-items:center',
    'font:16px/1.2 system-ui','color:#000',
    'text-shadow:0 -1px 0 rgba(0,0,0,.45)'
  ].join(';');
  const mk = t => { const s=document.createElement('span'); s.textContent=t; return s; };
  legend.append( mk('← → move'), mk('↑ jump'), mk('×2 → dash'), mk('↓ interact') );
  document.body.appendChild(legend);
}





  
// Supprime toute ancienne rangée blanche de contrôles encore présente dans le DOM
function removeLegacyControlsLegend(){
  // 1) Ids possibles
  ['#legend','#controls','#controlsTop','#howto','#tips','#legendTop']
    .forEach(sel => { const n = document.querySelector(sel); if (n) try{ n.remove(); }catch(_){ } });

  // 2) Heuristique : tout élément (hors #io83Legend) dont le texte contient move+jump+dash+interact
  document.querySelectorAll('body *:not(#io83Legend)').forEach(el=>{
    const t = (el.textContent || '').toLowerCase();
    if(t.includes('move') && t.includes('jump') && t.includes('dash') && t.includes('interact')){
      // Si ce n’est pas notre légende noire, on supprime
      if(el.id !== 'io83Legend') try{ el.remove(); }catch(_){}
    }
  });
}


  

  // Variables utilisées par checkAllComplete (déclarées AVANT toute utilisation)
  let allCompleteOverlay = null;
  let allCompleteTimerId = null;
  let allCompleteShown   = false;
  let allCompleteReshown = false;
  let pendingAllComplete = false;
  let absoluteOverlay = null;
  let absoluteTimerId = null;
  let absoluteShown   = false;
  let pendingAbsoluteComplete = false;
  let postersCompleteShown = false;
  let helperOverlay = null;
  let helperShown   = false;




  const setWanted = () => {
    if (scoreEl) scoreEl.textContent = `${postersCount}/10`;
    if (scoreWantedUI) scoreWantedUI.textContent = `${postersCount}/10`;
    checkAllComplete();
    checkAbsoluteComplete(); // ← ajout
  };
  const setEggs = () => {
    if (eggBox) eggBox.textContent = `${eggs}/10`;
    if (scoreEggUI) scoreEggUI.textContent = `${eggs}/10`;
    checkAllComplete();
    checkAbsoluteComplete(); // ← ajout
  };


  
// Effet “+1” : part d’un point (optionnel) et vole vers un élément du HUD.
// opts.fromCanvas = {x, y} en coordonnées canvas CSS (après caméra).
function flyPlusOne(toEl, opts={}){
  if (!toEl || !canvas) return;
  try{
    const cRect = canvas.getBoundingClientRect();
    const tRect = toEl.getBoundingClientRect();

    const startX = (opts.fromCanvas && typeof opts.fromCanvas.x==='number')
      ? cRect.left + opts.fromCanvas.x
      : cRect.left + cRect.width / 2;
    const startY = (opts.fromCanvas && typeof opts.fromCanvas.y==='number')
      ? cRect.top  + opts.fromCanvas.y
      : cRect.top  + cRect.height / 2;

    const endX   = tRect.left + tRect.width  / 2;
    const endY   = tRect.top  + tRect.height / 2;

    // Arc vers le haut (Bézier)
    const ctrlX  = (startX + endX) / 2 + 40;
    const ctrlY  = Math.min(startY, endY) - 120;

    const col = (getComputedStyle(toEl).color || '#ffcc00');

    const n = document.createElement('div');
    n.textContent = '+1';
    Object.assign(n.style, {
      position:'fixed', left:'0px', top:'0px',
      transform:`translate(${Math.round(startX)}px, ${Math.round(startY)}px) translate(-50%, -50%) scale(1.1)`,
      transformOrigin:'50% 50%',
      willChange:'transform, opacity, filter',
      color: col, fontWeight:'800', fontSize:'42px', lineHeight:'1',
      textShadow:'0 2px 0 #000, 0 0 6px rgba(0,0,0,.6)',
      pointerEvents:'none', userSelect:'none', zIndex:'9996', opacity:'1'
    });
    document.body.appendChild(n);

    const dur = 650; const t0 = performance.now();
    (function step(now){
      let k = (now - t0)/dur; if (k > 1) k = 1;
      const u = 1 - k;
      const x = u*u*startX + 2*u*k*ctrlX + k*k*endX;
      const y = u*u*startY + 2*u*k*ctrlY + k*k*endY;
      const s = 1.1 - 0.4*k;
      n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%) scale(${s})`;
      n.style.opacity   = String(1 - k*0.9);
      if (k < 1) requestAnimationFrame(step);
      else {
        // flash bref sur la cible
        try {
          const prevF = toEl.style.filter, prevT = toEl.style.transition, prevS = toEl.style.transform;
          toEl.style.transition = 'filter 200ms ease, transform 200ms ease';
          toEl.style.filter     = 'drop-shadow(0 0 8px rgba(255,209,92,.9))';
          toEl.style.transform  = 'scale(1.30)';
          setTimeout(()=>{ toEl.style.filter = prevF || ''; toEl.style.transform = prevS || ''; toEl.style.transition = prevT || ''; }, 180);
        } catch(_) {}
        try{ n.remove(); }catch(_){}
      }
    })(t0);
  }catch(_){}
}



  

// Petit "pulse" visuel sur le compteur touché
function pulseCounter(el){
  if (!el) return;
  const prev = el.style.transition;
  el.style.transition = 'transform 240ms ease';
  el.style.transform = 'scale(1.85)';
  setTimeout(()=>{ el.style.transform = 'scale(1)'; el.style.transition = prev; }, 240);
}

let mode = 'world';
  setWanted();
  setEggs();


  

  /* ========== Audio ========== */
/* ========== Audio (bgm ultra stable + SFX via WebAudio) ========== */
const bgm = document.getElementById('bgm');
const sfxEls = {
  wanted: document.getElementById('sfxWanted'),
  dash: document.getElementById('sfxDash'),
  enter: document.getElementById('sfxEnter'),
  exit: document.getElementById('sfxExit'),
  jump: document.getElementById('sfxJump'),
  type: document.getElementById('sfxType'),
  ding: document.getElementById('sfxDing'),
  foot: document.getElementById('sfxFoot'),
  doorLocked: document.getElementById('sfxDoorLocked') || document.getElementById('sfxGetOut'),
  getout: document.getElementById('sfxGetOut'),
  postersComplete: document.getElementById('sfxPostersComplete')
};

// Volumes fallback (HTMLAudio seulement)
Object.values(sfxEls).forEach(a => { if (!a) return; if (a !== bgm) a.volume = 0.8; });
if (bgm) bgm.volume = 0.6;

// ---- WebAudio pour SFX (BGM reste en HTMLAudio) ----
let AC = null, sfxGain = null, sfxBuffers = {}, footSrc = null;
const sfxLastPlay = {}; // anti-spam par SFX


function audioCtx(){
  if (!AC){
    const C = window.AudioContext || window.webkitAudioContext;
    AC = C ? new C() : null;
    if (AC){
      sfxGain = AC.createGain();
      sfxGain.gain.value = 1;
      sfxGain.connect(AC.destination);
    }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}

function decodeOne(name, el){
  const url = (el && (el.currentSrc || el.src)) || null;
  if (!url || !audioCtx()) return Promise.resolve();
  return fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => AC.decodeAudioData(ab))
    .then(buf => { sfxBuffers[name] = buf; })
    .catch(() => {}); // fallback: on gardera HTMLAudio si échec
}

function loadAllSfx(){
  const tasks = [];
  // Évite file:// → CORS. En http(s) seulement.
  if (IS_HTTP && typeof fetch === 'function' && audioCtx()){
    for (const [name, el] of Object.entries(sfxEls)){
      if (el) tasks.push(decodeOne(name, el));
    }
  }
  return Promise.allSettled(tasks);
}

function playSfx(name, opts = {}){
  // Anti-spam (évite les redéclenchements à chaque frame)
  const now = performance.now();
  const minGapMs = (name === 'getout' || name === 'doorLocked') ? 450 : 0; // ~0.45s
  const last = sfxLastPlay[name] || 0;
  if (minGapMs && (now - last) < minGapMs) return null;
  sfxLastPlay[name] = now;

  const buf = sfxBuffers[name];
  if (buf && audioCtx()){
    const src = AC.createBufferSource();
    src.buffer = buf;
    src.loop = !!opts.loop;
    src.playbackRate.value = opts.rate || 1;

    const g = AC.createGain();
    g.gain.value = (opts.gain != null ? opts.gain : 1);

    src.connect(g).connect(sfxGain);
    src.start(0);
    if (!src.loop) src.onended = () => { try { g.disconnect(); } catch(_){} };
    return src;
  }
  // Fallback HTMLAudio
  const el = sfxEls[name];
  if (el) { try { el.currentTime = 0; el.play(); } catch(_){} }
  return null;
}


// API publique (appelée par ton start + le moteur)
const startAudio = () => {
  if (bgm){
    bgm.muted = false;
    try { bgm.play(); } catch(_) {}
  }
  audioCtx(); // crée/réveille pour SFX
};

// Fonctions que tu utilises déjà
function playJump(){ playSfx('jump'); }
function playDing(){ playSfx('ding'); }

// Footsteps (boucle)
function footPlay(){
  const rate = 0.96 + Math.random()*0.08;
  if (!footSrc){
    footSrc = playSfx('foot', { loop:true, rate, gain:0.7 });
  } else if (footSrc.playbackRate){
    footSrc.playbackRate.value = rate;
  }
}
function footStop(){
  if (footSrc){ try { footSrc.stop(); } catch(_){} footSrc = null; }
}



  
  /* ========== Parallax / Ground ========== */
  const VIEW_DEN={back:6, mid:6, front:6};
  let cameraX=0, camYOffset=0;
  let GROUND_SRC_OFFSET = 18;
try{
  const v = localStorage.getItem('GROUND_SRC_OFFSET');
  if(v!=null) GROUND_SRC_OFFSET = parseInt(v,10) || 18;
}catch(e){ /* pas de localStorage → on garde 18 */ }

  let GROUND_Y=560;
  function recalcGround(){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const s=(VIEW_DEN.front*W)/images.front.width;
      const off=Math.round(GROUND_SRC_OFFSET*s);
      GROUND_Y=H-off;
    }
  }

  /* ========== Assets ========== */
  // IMPORTANT : n'ajouter ?v=... que si la page est servie en http(s).
// En file:// ça peut casser le chargement des images → écran noir.
const IS_HTTP = location.protocol === 'http:' || location.protocol === 'https:';
const CB = IS_HTTP ? ('?v=' + Date.now()) : '';

  const ASSETS={
    back :'assets/background/bg_far.png'+CB,
    mid  :'assets/background/bg_mid.png'+CB,
    front:'assets/background/ground.png'+CB,
    myoIdle:['assets/characters/myo/myo_idle_1.png'+CB,'assets/characters/myo/myo_idle_2.png'+CB],
    myoWalk:['assets/characters/myo/myo_walk_1.png'+CB,'assets/characters/myo/myo_walk_2.png'+CB],
    posterWith:'assets/collectibles/wanted_withposter.png'+CB,
    posterWithout:'assets/collectibles/wanted_withoutposter.png'+CB,
    npcs:{
      aeron:['assets/characters/aeron/aeron_idle_1.png'+CB,'assets/characters/aeron/aeron_idle_2.png'+CB],
      kaito:['assets/characters/kaito/kaito_idle_1.png'+CB,'assets/characters/kaito/kaito_idle_2.png'+CB],
      maonis:['assets/characters/maonis/maonis_idle_1.png'+CB,'assets/characters/maonis/maonis_idle_2.png'+CB],
      kahikoans:['assets/characters/kahikoans/kahikoans_idle_1.png'+CB,'assets/characters/kahikoans/kahikoans_idle_2.png'+CB]
    },
    dialogsManifest:'assets/config/dialogs_manifest.json'+CB,
    buildings:[
      ['assets/buildings/building_1_idle_1.png'+CB,'assets/buildings/building_1_idle_2.png'+CB,1],
      ['assets/buildings/building_2_idle_1.png'+CB,'assets/buildings/building_2_idle_2.png'+CB,2],
      ['assets/buildings/building_3_idle_1.png'+CB,'assets/buildings/building_3_idle_2.png'+CB,3],
      ['assets/buildings/building_4_idle_1.png'+CB,'assets/buildings/building_4_idle_2.png'+CB,4]
    ],
    buildingKaito:['assets/buildings/building_kaito_idle_1.png'+CB,'assets/buildings/building_kaito_idle_2.png'+CB],
    buildingWall:['assets/buildings/building_wall_idle_1.png'+CB,'assets/buildings/building_wall_idle_2.png'+CB],
    dashTrail: Array.from({length:8}, (_,i)=>`assets/fx/dash_trail_${i+1}.png${CB}`),
    jumpDust : Array.from({length:16},(_,i)=>`assets/fx/jump_dust_${i+1}.png${CB}`),
    interiorClosedIdle:['assets/interiors/interior_closed_idle_1.png'+CB,'assets/interiors/interior_closed_idle_2.png'+CB],
    interiorOpens:Array.from({length:10},(_,i)=>`assets/interiors/interior_open_${i+1}.png${CB}`),
    postersCompletePNG:'assets/collectibles/posters_complete.png'+CB,
    allCompletePNG:'assets/collectibles/all_complete.png'+CB,
    absoluteCompletePNG:'assets/collectibles/absolute_complete.png'+CB,
    helperPNG:'assets/collectibles/helper.png'+CB,
    scorePanelPNG:'assets/ui/hud/score_panel.png'+CB,
    uiStart:   ['assets/ui/start/start_idle_1.png'+CB, 'assets/ui/start/start_idle_2.png'+CB],
    uiLoading: Array.from({length:5}, (_,i)=>`assets/ui/loading/loading_idle_${i+1}.png${CB}`),

  };

// HUD créé après le chargement (déplacé dans boot()) pour ne pas l’afficher sur le Title


  
// ——— Gate UI (START sprite + LOADING) ———
window.gateUI = (() => {
  if (!gate) return { showStart(){}, showLoading(){}, stopAll(){} };

  const startWrap  = document.getElementById('startSprite');
  const loadingImg = document.getElementById('loadingImg');

  // Animation LOADING (fait défiler loading_idle_1..5)
  let loadingTimer = null;
  let loadingIdx = 0;
  function startLoadingAnim(){
    if (!loadingImg) return;
    stopLoadingAnim();
    loadingIdx = 0;
    loadingTimer = setInterval(()=>{
      const arr = images.ui && images.ui.loading ? images.ui.loading : null;
      if (arr && arr.length){
        loadingImg.src = arr[loadingIdx % arr.length].src || loadingImg.src;
      }
      loadingIdx++;
    }, 280); // ~7 fps
  }
  function stopLoadingAnim(){
    if (loadingTimer){ clearInterval(loadingTimer); loadingTimer = null; }
  }

  // Entrées utilisateur
  if (startWrap) {
    startWrap.addEventListener('click', onStart, {passive:false});
    startWrap.addEventListener('pointerdown', onStart, {passive:false});
  }
  if (gate) {
    gate.addEventListener('click', onStart, {passive:false});
    gate.addEventListener('pointerdown', onStart, {passive:false});
    gate.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) onStart(e);
    }, {passive:false});
  }

  function showStart(){
    if (startWrap)  startWrap.style.display = 'block';
    if (loadingImg) loadingImg.style.display = 'none';
    stopLoadingAnim();
  }
  function showLoading(){
    if (startWrap)  startWrap.style.display = 'none';
    if (loadingImg) loadingImg.style.display = 'block';
    startLoadingAnim();
  }
  function stopAll(){
    if (startWrap)  startWrap.style.display = 'none';
    if (loadingImg) loadingImg.style.display = 'none';
    stopLoadingAnim();
  }

  // État initial
  showStart();

  return { showStart, showLoading, stopAll };
})();



  
const images = {
  back:null, mid:null, front:null,
  myoIdle:[], myoWalk:[],
  posterWith:null, posterWithout:null,
  npcs:{aeron:[], kaito:[], maonis:[], kahikoans:[]},
  dialogs:{aeron:[], kaito:[], maonis:[], kahikoans:[]},
  buildings:[], buildingKaito:null, buildingWall:null, dashTrail:[],
  interiorClosedIdle:[], interiorOpens:[],
  postersComplete:null, allComplete:null, absoluteComplete:null, jumpDust:[],
  ui:{ start:[], loading:[] }
};

  const loadImg=src=>new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; });

  /* ========== Player / Physique ========== */
  const CHAR_H=300; // monde
  const MYO_H=CHAR_H, NPC_H=CHAR_H;
  const FOOT_PAD_RATIO=0.14; // compense vide bas
  const MYO_H_INTERIOR=Math.round(MYO_H*1.7), INTERIOR_FOOT_EXTRA=Math.round(MYO_H_INTERIOR/6);

  const MOVE_SPEED=360*1.2*1.15, AIR_SPEED_MULT=1.2;
  const PLAYER_HALF_W=26;

  const GRAVITY_UP=2600, GRAVITY_DOWN=2600*2.2, TARGET_JUMP_HEIGHT=200;
  const JUMP_VELOCITY=Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);
  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  // Dash (2e dash dispo après 2e saut)
  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOL_G=0.6, DASH_COOL_A=0.28, DASH_MULT=4;
  const NPC_MAONIS_RATE = 0.18; // 18% de Maonis (mets 0.10–0.25 selon ton goût)
  let lastTapL=-999,lastTapR=-999,dashTimer=0,dashCooldown=0,airDashUsed=0;

  /* ========== Camera lookahead & micro shake ========== */
const LOOKAHEAD_MAX = 0;     // px max
const LOOK_SMOOTH   = 8;       // suivi (plus grand = plus rapide)
const LOOK_DASH_BONUS = 0;    // petit bonus pendant dash
const DASH_TRAIL_OFF = 60; // px de séparation horizontale du trail vs le perso
let camLookX = 0;              // valeur lissée du lookahead X
let shakeAmp = 0;              // amplitude écran
function addShake(s){ shakeAmp = Math.min(6, shakeAmp + s); }

const DASH_TRAIL_FPS = 8; // ~10–11% plus lent que 9
  const DASH_TRAIL_VIS = 0.32; // durée d’affichage du trail en secondes
let dashTrailT = 0;          // compte à rebours du trail



/* ========== Variable jump (tap court / long) ========== */
let jumpHeld = false;          // vrai tant que ↑ (ou W) est maintenu
const JUMP_CUT_MULT = 2.2;     // gravité supplémentaire si on relâche tôt

/* ========== FX poussière ========== */
const fx=[]; // {x,y,t}
const DUST_FPS = 24;
function spawnDust(x,y){
  if(!images.jumpDust.length) return;
  fx.push({x,y,t:0});
}
function drawFX(yOff){
  if(!images.jumpDust.length) return;
  for(let i=fx.length-1;i>=0;i--){
    const f=fx[i];
    f.t += 1/60;
    const idx = Math.floor(f.t * DUST_FPS);
    if(idx >= images.jumpDust.length){ fx.splice(i,1); continue; }
    const img = images.jumpDust[idx];
    const s = 1; // échelle 1:1 (sprites déjà ajustés)
    const dw = Math.round(img.width * s);
    const dh = Math.round(img.height* s);
    const sx = Math.round(f.x - cameraX - dw/2);
    const sy = Math.round(f.y + yOff - dh + Math.round(dh*0.15));
    ctx.drawImage(img, sx, sy, dw, dh);
  }
}

const DUST_ON_TAKEOFF = true;   // poussière au décollage (depuis sol/toit)
const DUST_ON_LANDING = false;  // pas de poussière à l’atterrissage

// --- Feet helper (monde) : renvoie la Y "visible" des pieds (avec footPad) ---
function feetYWorld(){
  const footPad = Math.round(MYO_H * FOOT_PAD_RATIO);
  return GROUND_Y + player.y + footPad;
}
  
  // Toits
  let onPlatform=false, dropThrough=0; let downPressedEdge=false;

const keys=new Set();
addEventListener('keydown',e=>{
  if(!worldReady || (mode!=='world' && mode!=='interior')) return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(e.key)) e.preventDefault();
  if(e.repeat){ keys.add(e.key); return; }
  keys.add(e.key);
  if(e.key==='ArrowDown'||e.key==='s') downPressedEdge=true;
  if(e.key==='ArrowUp'||e.key==='w'){  jumpBuf=JUMP_BUFFER; jumpHeld=true; }
  const t=performance.now()/1000;
  if(e.key==='ArrowRight'||e.key==='d'){ if(t-lastTapR<=DASH_WINDOW) tryDash('right'); lastTapR=t; }
  if(e.key==='ArrowLeft' ||e.key==='a'){ if(t-lastTapL<=DASH_WINDOW) tryDash('left');  lastTapL=t; }
});
addEventListener('keyup',e=>{
  if(!worldReady) return;
  keys.delete(e.key);
  if(e.key==='ArrowUp'||e.key==='w') jumpHeld=false;
});
  
  const player={x:220,y:0,vy:0,onGround:true,facing:'right',state:'idle',animTime:0};

/* ========== Posters ========== */
const POSTER_SIZE=Math.round(100*1.2*1.25);
const COLLECT_RADIUS=76, COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  let postersOverlay=null;
  function ensureOverlay(){
    if(postersOverlay) return postersOverlay;
    const wrap=document.createElement('div'); Object.assign(wrap.style,{position:'fixed',inset:'0',display:'none',placeItems:'center',background:'rgba(0,0,0,.6)',zIndex:'9998'});
    const panel=document.createElement('div'); Object.assign(panel.style,{padding:'16px',background:'#111',border:'2px solid #444',borderRadius:'12px'});
    const img=document.createElement('img'); img.alt='Completed'; img.style.maxWidth='min(80vw,800px)'; img.style.maxHeight='70vh'; img.style.imageRendering='pixelated'; img.src = ASSETS.postersCompletePNG;
    const btn=document.createElement('button'); btn.textContent='Close'; Object.assign(btn.style,{display:'block',margin:'12px auto 0',padding:'8px 16px',cursor:'pointer',background:'#1b1b1b',color:'#fff',border:'1px solid #555',borderRadius:'8px'});
    btn.onclick=()=>{ wrap.style.display='none'; };
    panel.appendChild(img); panel.appendChild(btn); wrap.appendChild(panel); document.body.appendChild(wrap); postersOverlay=wrap; return wrap;
  }

function ensureAllCompleteOverlay(){
  if(allCompleteOverlay) return allCompleteOverlay;
  const wrap=document.createElement('div');
  Object.assign(wrap.style,{position:'fixed',inset:'0',display:'none',placeItems:'center',background:'rgba(0,0,0,.6)',zIndex:'9999'});
  const panel=document.createElement('div');
  Object.assign(panel.style,{padding:'16px',background:'#111',border:'2px solid #444',borderRadius:'12px'});
  const img=document.createElement('img');
  img.alt='All Complete';
  img.style.maxWidth='min(80vw,800px)';
  img.style.maxHeight='70vh';
  img.style.imageRendering='pixelated';
  img.src = ASSETS.allCompletePNG;
  const btn=document.createElement('button');
  btn.textContent='Close';
  Object.assign(btn.style,{display:'block',margin:'12px auto 0',padding:'8px 16px',cursor:'pointer',background:'#1b1b1b',color:'#fff',border:'1px solid #555',borderRadius:'8px'});
  btn.onclick=()=>{ wrap.style.display='none'; };
  panel.appendChild(img); panel.appendChild(btn); wrap.appendChild(panel);
  document.body.appendChild(wrap);
  allCompleteOverlay=wrap; return wrap;
}

// Hoistée (déclarée en function) → peut être appelée depuis n’importe où
function checkAllComplete(){
  if (typeof mode === 'undefined') return; // ← évite la ReferenceError au boot
  // All : quand Posters = 10/10 ET ??? = 10/10 (mais pas à 11/11)
  if (allCompleteShown) return;

  const atLeast10 = (eggs >= 10 && postersCount >= 10);
  const notYet11  = !(eggs >= 11 && postersCount >= 11); // évite un déclenchement à 11/11

  if (!(atLeast10 && notYet11)) return;
  if (mode !== 'world') return; // jamais en intérieur

  if (allCompleteTimerId) clearTimeout(allCompleteTimerId);
allCompleteTimerId = setTimeout(()=>{
  ensureAllCompleteOverlay().style.display='grid';
  allCompleteShown = true;
}, 3000);
}



function checkAbsoluteComplete(){
  if (typeof mode === 'undefined') return; // ← évite la ReferenceError au boot
  // Condition : 11/11 minimum
  if(!(eggs>=11 && postersCount>=11)) return;
  // Jamais en intérieur
  if(mode!=='world') return;
  // Affiche ~5 s après la dernière mise à jour
  if(absoluteTimerId) clearTimeout(absoluteTimerId);
absoluteTimerId = setTimeout(()=>{
  ensureAbsoluteOverlay().style.display='grid';
  absoluteShown = true;
}, 3000);
}


function ensureAbsoluteOverlay(){
  if(absoluteOverlay) return absoluteOverlay;
  const wrap=document.createElement('div');
  Object.assign(wrap.style,{position:'fixed',inset:'0',display:'none',placeItems:'center',background:'rgba(0,0,0,.6)',zIndex:'10000'});
  const panel=document.createElement('div');
  Object.assign(panel.style,{padding:'16px',background:'#111',border:'2px solid #444',borderRadius:'12px'});
  const img=document.createElement('img');
  img.alt='Absolute Complete';
  img.style.maxWidth='min(80vw,800px)';
  img.style.maxHeight='70vh';
  img.style.imageRendering='pixelated';
  img.src = ASSETS.absoluteCompletePNG;
  const btn=document.createElement('button');
  btn.textContent='Close';
  Object.assign(btn.style,{display:'block',margin:'12px auto 0',padding:'8px 16px',cursor:'pointer',background:'#1b1b1b',color:'#fff',border:'1px solid #555',borderRadius:'8px'});
  btn.onclick=()=>{ wrap.style.display='none'; };
  panel.appendChild(img); panel.appendChild(btn); wrap.appendChild(panel);
  document.body.appendChild(wrap);
  absoluteOverlay=wrap; return wrap;
}

  
function ensureHelperOverlay(){
  if (helperOverlay) return helperOverlay;
  const wrap = document.createElement('div');
  Object.assign(wrap.style,{
    position:'fixed', inset:'0', display:'none', placeItems:'center',
    background:'rgba(0,0,0,.6)', zIndex:'10001'
  });
  const panel = document.createElement('div');
  Object.assign(panel.style,{
    padding:'16px', background:'#111', border:'2px solid #444', borderRadius:'12px'
  });
  const img = document.createElement('img');
  img.alt = 'Helper';
  img.style.maxWidth = 'min(80vw,800px)';
  img.style.maxHeight= '70vh';
  img.style.imageRendering = 'pixelated';
  img.src = ASSETS.helperPNG;

  const btn = document.createElement('button');
  btn.textContent = 'Close';
  Object.assign(btn.style,{
    display:'block', margin:'12px auto 0', padding:'8px 16px',
    cursor:'pointer', background:'#1b1b1b', color:'#fff',
    border:'1px solid #555', borderRadius:'8px'
  });
  btn.onclick = ()=>{ wrap.style.display='none'; };

  panel.appendChild(img);
  panel.appendChild(btn);
  wrap.appendChild(panel);
  document.body.appendChild(wrap);

  helperOverlay = wrap;
  return wrap;
}

  
  /* ========== Monde & contenu ========== */
  const BUILDING_TARGET_H=Math.round(450*1.15);

  const buildings=[]; let nextBId=1;
  let worldStartX=480, worldEndX=20000;
  let worldPlayerMaxX=null; // limite dure pour le centre du joueur
  let endWall=null;

  // toits one-way (largeur droite réduite)
  function makeRoof(bx,by,dw,dh){
    const y=by+Math.round(dh*0.50);
    const fullW=Math.round(dw*0.92*(2/3));
    const left=bx+Math.round((dw-fullW)/2);
    const cutR=Math.round(fullW*0.40);
    const w=Math.max(24, fullW-cutR);
    return {x:left, y, w, h:12};
  }

  const NPC_TALK_RADIUS=160, NPC_HIDE_DELAY=1.0;
  const NPC_TURN_HYST = 0; // marge anti-flip en px autour du CENTRE du PNJ (mets 0 pour pile au milieu)
  const npcs=[];
  let eggIndex=0; const hackedIds=new Set(); eggs=eggIndex; setEggs();

  /* ===== Entrée aléatoire 2/3 avec garantie ===== */
  const BASE_ENTER_CHANCE=0.55;
  const triedDoor=new Set();
  function shouldEnterThis23(b){
    if (b.canEnterAlways) return true; // << ouvrable systématique pour types 2/3
    if(triedDoor.has(b.id) && !b.wasOpen) return false;
    const eggsRemain=10 - eggIndex;
    const notTried = buildings.filter(x=> (x.typeId===2||x.typeId===3) && !triedDoor.has(x.id));
    const potentialsRemain=notTried.length - (triedDoor.has(b.id)?0:1);
    if(eggsRemain>=potentialsRemain) return true;
    return Math.random() < BASE_ENTER_CHANCE;
  }

/* ========== Chargement ========== */
let worldReady=false;
function loadAll(){
  const L = (src)=>loadImg(src);
  const tasks = [];
  tasks.push(L(ASSETS.absoluteCompletePNG).then(i=>{ images.absoluteComplete = i; }).catch(()=>{}));
  tasks.push(L(ASSETS.helperPNG).catch(()=>{}));


  // Fonds
  tasks.push(L(ASSETS.back ).then(i=>{ images.back  = i; }).catch(()=>{}));
  tasks.push(L(ASSETS.mid  ).then(i=>{ images.mid   = i; }).catch(()=>{}));
  tasks.push(L(ASSETS.front).then(i=>{ images.front = i; }).catch(()=>{}));

  // Myo
  tasks.push(Promise.all(ASSETS.myoIdle.map(L)).then(arr=>{ images.myoIdle = arr.filter(Boolean); }).catch(()=>{}));
  tasks.push(Promise.all(ASSETS.myoWalk.map(L)).then(arr=>{ images.myoWalk = arr.filter(Boolean); }).catch(()=>{}));

  // Posters
  tasks.push(L(ASSETS.posterWith   ).then(i=>{ images.posterWith    = i; }).catch(()=>{}));
  tasks.push(L(ASSETS.posterWithout).then(i=>{ images.posterWithout = i; }).catch(()=>{}));

  // NPCs
  tasks.push(Promise.all(Object.keys(ASSETS.npcs).map(function(k){
    return Promise.all(ASSETS.npcs[k].map(L)).then(function(arr){
      images.npcs[k] = arr.filter(Boolean);
    }).catch(()=>{ images.npcs[k]=[]; });
  })).catch(()=>{}));

  // Loading et Start
  tasks.push(Promise.all(ASSETS.uiStart.map(L)).then(arr=>{ images.ui.start = arr.filter(Boolean); }).catch(()=>{}));
  tasks.push(Promise.all(ASSETS.uiLoading.map(L)).then(arr=>{ images.ui.loading = arr.filter(Boolean); }).catch(()=>{}));


  // Dialogs (facultatif) — faire le fetch UNIQUEMENT en http(s) pour éviter les erreurs en file://
  if (IS_HTTP && typeof fetch === 'function') {
    tasks.push(
      fetch(ASSETS.dialogsManifest)
        .then(r=>r.json())
        .then(function(mf){
          const subtasks=[];
          ['aeron','kaito','maonis','kahikoans'].forEach(function(k){
            const list = (mf && mf[k]) ? mf[k] : [];
            subtasks.push(
              Promise.all(list.map(function(name){
                const p = 'assets/ui/dialogs/'+k+'/'+name+CB;
                return L(p);
              }))
              .then(function(arr){ images.dialogs[k] = arr.filter(Boolean); })
              .catch(()=>{ images.dialogs[k]=[]; })
            );
          });
          return Promise.all(subtasks);
        })
        .catch(()=>{})
    );
  }

// Fallback dialogs sans manifest : essaie dialog_01..dialog_20
tasks.push((async ()=>{
  const types = ['aeron','kaito','maonis','kahikoans'];
  for (const t of types){
    if (images.dialogs[t] && images.dialogs[t].length) continue;
    const arr = [];
    for (let i=1; i<=20; i++){
      const n = String(i).padStart(2,'0');
      const url = `assets/ui/dialogs/${t}/dialog_${t}_${n}.png${CB}`;
      const img = await L(url);
      if (img) arr.push(img);
    }
    images.dialogs[t] = arr;
  }
})());



  // Bâtiments (4 types)
  tasks.push(Promise.all(ASSETS.buildings.map(function(pair){
    return Promise.all([ L(pair[0]), L(pair[1]) ]).then(function(ab){
      images.buildings.push([ ab[0], (ab[1]||ab[0]), pair[2] ]);
    }).catch(()=>{});
  })).catch(()=>{}));

  // Kaito + mur de fin
  tasks.push(Promise.all([ L(ASSETS.buildingKaito[0]), L(ASSETS.buildingKaito[1]) ])
    .then(function(kb){ var ka=kb[0], kb2=kb[1]; images.buildingKaito = ka ? [ka, (kb2||ka)] : null; })
    .catch(()=>{ images.buildingKaito=null; })
  );
  tasks.push(Promise.all([ L(ASSETS.buildingWall[0]), L(ASSETS.buildingWall[1]) ])
    .then(function(wb){ var wa=wb[0], wb2=wb[1]; images.buildingWall = wa ? [wa, (wb2||wa)] : null; })
    .catch(()=>{ images.buildingWall=null; })
  );

  // FX + intérieurs + overlays
  tasks.push(Promise.all(ASSETS.dashTrail.map(L)).then(arr=>{ images.dashTrail = arr.filter(Boolean); }).catch(()=>{}));
  tasks.push(Promise.all(ASSETS.jumpDust .map(L)).then(arr=>{ images.jumpDust  = arr.filter(Boolean); }).catch(()=>{}));
  tasks.push(Promise.all(ASSETS.interiorClosedIdle.map(L)).then(arr=>{ images.interiorClosedIdle = arr.filter(Boolean); }).catch(()=>{}));
  tasks.push(Promise.all(ASSETS.interiorOpens     .map(L)).then(arr=>{ images.interiorOpens      = arr.filter(Boolean); }).catch(()=>{}));
  tasks.push(L(ASSETS.postersCompletePNG).then(i=>{ images.postersComplete = i; }).catch(()=>{}));
  tasks.push(L(ASSETS.allCompletePNG    ).then(i=>{ images.allComplete     = i; }).catch(()=>{}));
  tasks.push(loadAllSfx());

  // Pare-chocs global : ne REJETTE JAMAIS
  return Promise.allSettled(tasks).then(function(){
    try{
      recalcGround();
      buildWorld();
      worldReady = true;
    }catch(err){
      console.error('[IO83] build/init error:', err);
      worldReady = true; // on lance quand même la boucle pour ne pas bloquer le START
    }
  });
}



  /* ========== Intervalles réservés (anti-chevauchement) ========== */
  function intervalsFromBuildings(margin=420){
    return buildings.map(b=>[b.x-margin, b.x+b.dw+margin]);
  }
  function placeInGaps(x, w, list, step=80, guard=400){
    const sorted=[...list].sort((a,b)=>a[0]-b[0]);
    let tries=0;
    while(tries++<guard){
      let hit=false;
      for(const [L,R] of sorted){ if(x < R && x+w > L){ x = R + step; hit=true; break; } }
      if(!hit) break;
    }
    return x;
  }

  /* ========== Build world (BLOCS 3 bâtiments par bloc) ========== */
  function pickBuildingFrameWeighted(){
    const pool=[...Array(36).fill(1), ...Array(16).fill(2), ...Array(16).fill(3), ...Array(36).fill(4)];
    const t=pool[rint(0,pool.length-1)];
    const found=images.buildings.find(b=>b[2]===t) || images.buildings[0];
    return found;
  }

function buildWorld(){
  // Réinit
  buildings.length = 0;
  npcs.length = 0;
  posters.length = 0;

  const NUM_BLOCKS = 12; // 12 blocs => 12 bâtiments 2/3 (1 par bloc)

  // Gaps (entre b0-b1 et b1-b2) – on garantit la place pour 1 poster et 1 PNJ
  const GAP_POSTER_MIN = 200;          // >= poster 120 + marge sécurité
  const GAP_POSTER_MAX = 280;
  const GAP_NPC_MIN    = 280;          // >= ~200 de largeur PNJ + marge
  const GAP_NPC_MAX    = 360;

  const INTER_GAP_MIN = 320;           // écart entre blocs (rendu compact mais safe)
  const INTER_GAP_MAX = 560;

  const GAP_SCALE = 1.10; // +10% d'écartement

  // Bloc Kaito (0-based) : Kaito + son bâtiment dans le même bloc
  const KAITO_BLOCK = Math.min(5, NUM_BLOCKS-1);

  let x = worldStartX;
  const blockRects = [];

  // ——— Génération des blocs : 3 bâtiments + 1 PNJ + 1 poster par bloc ———
  for (let b = 0; b < NUM_BLOCKS; b++) {

    const firstX = x;

    // Composition des 3 bâtiments du bloc
    // Règle globale: exactement 1 ouvrable (2 ou 3) + 2 fermés (1/4)
    const openType = (Math.random()<0.5) ? 2 : 3;

    // Cas général (pas Kaito): deux fermés au hasard (1/4)
    let closedPool = (Math.random()<0.5) ? [1,4] : (Math.random()<0.5 ? [1,1] : [4,4]);

    // Cas spécial Kaito : on force le triplet à [fermé, Kaito, ouvrable]
    // => Le bloc a quand même son bâtiment 2/3, ET Kaito est au milieu
    let triplet;
    if (images.buildingKaito && b === KAITO_BLOCK) {
      // un fermé au hasard (1 ou 4)
      const closedPick = (Math.random()<0.5) ? 1 : 4;
      triplet = [closedPick, 98 /*Kaito*/, openType];
    } else {
      triplet = [openType, closedPool[0], closedPool[1]];
      // mélanger pour varier
      for (let i=triplet.length-1;i>0;i--){ const j=rint(0,i); const t=triplet[i]; triplet[i]=triplet[j]; triplet[j]=t; }
    }

    // On décidera quel gap sert au poster et lequel au PNJ.
    // Si bloc Kaito, on impose que le PNJ soit à droite du building Kaito -> gap après l’index 1.
    const gapRoles = (b === KAITO_BLOCK) ? ['poster','npc']   // gap après b0 = poster, gap après b1 = PNJ (donc à droite de Kaito au centre)
                                          : (Math.random()<0.5 ? ['poster','npc'] : ['npc','poster']);

    // Place les 3 bâtiments en garantissant des gaps assez larges entre b0-b1 et b1-b2
    const placedThisBlock = []; // {x,dw,typeId}
    for (let i=0;i<3;i++){
      let typeId = triplet[i];
      let im1, im2, dw, dh;

      if (typeId === 98 && images.buildingKaito) {
        const base = images.buildingKaito[0];
        const s  = BUILDING_TARGET_H / base.height;
        dw = Math.round(base.width * s);
        dh = Math.round(base.height * s);
        im1 = images.buildingKaito[0];
        im2 = images.buildingKaito[1] || im1;
      } else {
        const pair = images.buildings.find(e => e[2]===typeId) || images.buildings[0];
        const base = pair[0];
        const s  = BUILDING_TARGET_H / base.height;
        dw = Math.round(base.width * s);
        dh = Math.round(base.height * s);
        im1 = pair[0];
        im2 = pair[1] || pair[0];
      }

      const bx = x;
      const by = GROUND_Y - dh;
      const roof = makeRoof(bx, by, dw, dh);

      buildings.push({
        id: nextBId++,
        typeId,
        frames: [im1, im2],
        animT: 0,
        x: bx, y: by, dw, dh,
        roof,
        doorX: bx, doorW: dw,
        canEnterPossible: (typeId===2 || typeId===3), // Kaito (98) non ouvrable
        canEnterAlways  : (typeId===2 || typeId===3)

      });

      placedThisBlock.push({x:bx, dw, typeId});
      const isLast = (i===2);
      if (!isLast){
        // Calcul du gap après ce bâtiment
        const role = gapRoles[i]; // 'poster' ou 'npc'
        const minW = (role==='poster') ? GAP_POSTER_MIN : GAP_NPC_MIN;
        const maxW = (role==='poster') ? GAP_POSTER_MAX : GAP_NPC_MAX;
        const gapW = Math.round(rint(minW, maxW) * GAP_SCALE);
        x = bx + dw + gapW; // on crée réellement la place
      }
      else{
        // Fin du bloc → gap inter-bloc
        x += Math.round(rint(INTER_GAP_MIN, INTER_GAP_MAX) * GAP_SCALE);
      }
    }

    // Définition rectangle du bloc
    const lastPlaced = placedThisBlock[placedThisBlock.length-1];
    const xL = firstX;
    const xR = x; // après le dernier + inter-gap
    const mid = Math.round((xL + (lastPlaced.x + lastPlaced.dw)) / 2);
    blockRects.push({xL,xR,mid});

    // — Place le POSTER et le PNJ précisément dans les deux gaps créés —
    // Gaps réels : entre [b0] et [b1], puis entre [b1] et [b2]
    const gap01L = placedThisBlock[0].x + placedThisBlock[0].dw;
    const gap01R = placedThisBlock[1].x;
    const gap12L = placedThisBlock[1].x + placedThisBlock[1].dw;
    const gap12R = placedThisBlock[2].x;

    const roleAfter0 = gapRoles[0]; // rôle du gap entre b0 et b1
    const roleAfter1 = gapRoles[1]; // rôle du gap entre b1 et b2

    const placePosterInGap = (L,R)=>{
      const w = POSTER_SIZE;
      const cx = (L+R)/2;
      const px = Math.round(cx - w/2);
      posters.push({ x:px, y: GROUND_Y - POSTER_SIZE, w:POSTER_SIZE, h:POSTER_SIZE, t:0, taking:false, taken:false });
    };
    const placeNPCInGap = (L,R, type)=>{
      const npcW = 200;                 // largeur “logique” pour l’emprise au sol
      const cx = (L+R)/2;
      const nx = Math.round(cx - npcW/2);
npcs.push({
  type,
  x: nx,
  frames: images.npcs[type],
  animT: 0,
  face: 'right',
  show: false,
  hideT: 0,
  dialogImg: null,
  dialogIdx: -1,
  // 10% plus petit UNIQUEMENT pour maonis
  scale: (type === 'maonis' ? 0.9 : 1)
});
};
    

    // Choix du PNJ de ce bloc (Aeron tôt, sinon Maonis/Kahikoans, et Kaito si bloc Kaito)
    const firstThird = Math.max(1, Math.floor(NUM_BLOCKS/3));
    let npcType = 'kahikoans';
    // place Aeron dans le premier tiers (une seule fois)
    if (!buildWorld._aeronPlaced && b < firstThird) { npcType='aeron'; buildWorld._aeronPlaced = true; }
    else if (Math.random() < NPC_MAONIS_RATE)        { npcType='maonis'; }
    if (b === KAITO_BLOCK)                           { npcType='kaito'; } // bloc Kaito → PNJ = Kaito

    // Affectation gap → éléments
    if (roleAfter0 === 'poster') placePosterInGap(gap01L,gap01R);
    else                         placeNPCInGap(gap01L,gap01R, npcType);

    if (roleAfter1 === 'poster') placePosterInGap(gap12L,gap12R);
    else                         placeNPCInGap(gap12L,gap12R, npcType);
  }

  // Mur de fin juste après le dernier bloc
  worldEndX = Math.max(
    ...buildings.map(b => b.x + b.dw),
    ...posters.map(p => p.x + p.w),
    ...npcs.map(n => n.x + 200)
  ) + 1200;

  spawnEndWall();
} // <<<<<< FIN buildWorld()

  function spawnEndWall(){
    if(!images.buildingWall) return;
    const base=images.buildingWall[0]; const screenH=canvas.height/DPR;
    const targetH=Math.round(screenH*1.25*0.85);
    const s=targetH/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
    const x = worldEndX - 800; const y = GROUND_Y - dh;
    endWall={frames:images.buildingWall, animT:0, x, y, dw, dh};
    worldEndX = endWall.x + endWall.dw + 8; // on peut "voir" et approcher le mur
    worldPlayerMaxX = Math.floor(endWall.x + endWall.dw*0.5) - PLAYER_HALF_W; // centre du joueur bloqué à la moitié du mur

  }

  /* ========== Draw helpers ========== */
  function drawLayer(img,f,den,yOff=0){
    if(!img || !img.width) return;
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(H-dh)+yOff;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  
function drawMyo(runVel,yOff,H=MYO_H){
  const frames=(Math.abs(runVel)>1e-2?images.myoWalk:images.myoIdle);
  const fps=(Math.abs(runVel)>1e-2?8:4);
  const idx=frames.length>1?Math.floor(player.animTime*fps)%frames.length:0;
  const img=frames[idx]||images.myoIdle[0];
  if(!img || !img.width) return;  // garde-fou anti-écran noir


  const s=H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
  const footPad=Math.round(dh*FOOT_PAD_RATIO);

  // Sprite centré sur player.x
  const x=Math.floor(player.x - cameraX - dw/2);
  const y=GROUND_Y - dh + player.y + yOff + footPad;

  // Dash trail — animé par un timer dédié (toujours de la 1ère à la dernière frame)
  if(dashTrailT>0 && images.dashTrail.length){
    const u = 1 - (dashTrailT / DASH_TRAIL_VIS); // 0 → 1
    let tiIndex = Math.floor(u * images.dashTrail.length);
    if(tiIndex>=images.dashTrail.length) tiIndex = images.dashTrail.length-1;
    const ti = images.dashTrail[tiIndex];

    const c  = x + dw/2; // centre du perso
    const cx = c + (player.facing==='left' ? +DASH_TRAIL_OFF : -DASH_TRAIL_OFF);
    const sx = Math.round(cx - dw/2);
    const sy = Math.round(y);

    ctx.save();
    ctx.globalAlpha = 0.85;
    if(player.facing==='left'){
      // flip parfait autour du centre → symétrie exacte
      ctx.translate(sx + dw/2, sy + dh/2);
      ctx.scale(-1,1);
      ctx.translate(-dw/2, -dh/2);
      ctx.drawImage(ti, 0, 0, dw, dh);
    }else{
      ctx.drawImage(ti, sx, sy, dw, dh);
    }
    ctx.restore();
  }

  // Perso
  ctx.save();
  if(player.facing==='left'){
    ctx.translate(x+dw/2,y);
    ctx.scale(-1,1);
    ctx.translate(-dw/2,0);
    ctx.drawImage(img,0,0,dw,dh);
  }else{
    ctx.drawImage(img,x,y,dw,dh);
  }
  ctx.restore();
}


  

  
  function drawBuildings(yOff){
    for(const b of buildings){
      const sx=Math.floor(b.x - cameraX); if(sx<-2200 || sx>canvas.width/DPR+2200) continue;
      const frame=(Math.floor(b.animT*2)%2===0)? b.frames[0]:(b.frames[1]||b.frames[0]);
      ctx.drawImage(frame,sx,b.y+yOff,b.dw,b.dh);
    }
  }

function drawNPCs(yOff){
  for (const n of npcs){
    const base = n.frames && n.frames[0];
    if (!base) continue;

    // — Taille PNJ (avec scale par PNJ : maonis = 0.9, sinon = 1)
    const scale = (n.scale || 1);
    const s  = (NPC_H * scale) / base.height;   // ← une seule définition de s
    const dw = Math.round(base.width  * s);
    const dh = Math.round(base.height * s);
    const footPad = Math.round(dh * FOOT_PAD_RATIO);

    // Position (n.x = GAUCHE logique du PNJ)
    const sx = Math.round(n.x - cameraX);
    const sy = (GROUND_Y + yOff) - dh + footPad;

    // Orientation vers le joueur
    const npcCenter = n.x + dw/2;
    if (player.x < npcCenter - NPC_TURN_HYST)      n.face = 'left';
    else if (player.x > npcCenter + NPC_TURN_HYST) n.face = 'right';

    const img = n.frames[Math.floor((n.animT || 0) * 2) % 2] || base;

    // Dessin du PNJ
    ctx.save();
    if (n.face === 'left'){
      ctx.translate(sx + dw/2, sy);
      ctx.scale(-1, 1);
      ctx.translate(-dw/2, 0);
      ctx.drawImage(img, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, sx, sy, dw, dh);
    }
    ctx.restore();

    // Bulle PNG : décalée vers la gauche et moins haute (comme l’exemple OK)
    if (n.show && n.dialogImg){
      const dlgScale = 0.72; // (renommé pour éviter toute confusion avec scale ci-dessus)
      const bw = Math.round(n.dialogImg.width  * dlgScale);
      const bh = Math.round(n.dialogImg.height * dlgScale);
      const bx = sx + Math.round(dw/2 - bw*0.5) - Math.round(bw*0.5); // décalage gauche
      const by = sy - Math.round(bh*0.5);                              // un peu plus bas
      ctx.drawImage(n.dialogImg, bx, by, bw, bh);
    }
  }
}


  
  
  function drawPosters(yOff){
    for(const p of posters){
      const sx=p.x - cameraX; if(sx<-1400 || sx>canvas.width/DPR+1400) continue;
      let sy=p.y + yOff; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      const sp=p.taken?images.posterWithout:images.posterWith;
      if(sp) ctx.drawImage(sp,Math.round(sx),Math.round(sy),POSTER_SIZE,POSTER_SIZE);
    }
  }
  function drawEndWall(yOff){
    if(!endWall) return;
    const f=endWall.frames[Math.floor(endWall.animT*2)%2]||endWall.frames[0];
    const sx=Math.floor(endWall.x - cameraX);
    ctx.drawImage(f,sx,endWall.y+yOff,endWall.dw,endWall.dh);
  }

  /* ========== Mouvement / Dash ========== */
function tryDash(dir){
  if(dashCooldown>0) return;
  if(!player.onGround){
    const max=1 + (airJumpsUsed>0?1:0);
    if(airDashUsed>=max) return;
    airDashUsed++; dashCooldown=DASH_COOL_A;
  }else{ airDashUsed=0; dashCooldown=DASH_COOL_G; }

  dashTimer = DASH_DUR;          // durée du dash physique (inchangée)
  dashTrailT = DASH_TRAIL_VIS;   // lance l’anim du trail (durée un peu plus longue)
  player.facing = dir;
  addShake(0.4);
  playSfx('dash');

}


  /* ========== Loops ========== */
  // (mode est déjà déclaré plus haut)
let interiorOpenIdx=0, hacking=false, hackT=0, currentB=null;

  function updateWorld(dt){
    const wasOnGround = player.onGround;
    const vyBefore = player.vy;

    let vx=0;
    const groundSpeed = MOVE_SPEED * 1.05;                    // +10% au sol
const airSpeed    = MOVE_SPEED * (AIR_SPEED_MULT * 1.10); // +15% en l’air
const base        = (player.onGround ? groundSpeed : airSpeed);


    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*base*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=base; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=base; player.facing='left'; }
    }
    const hardMaxX = (worldPlayerMaxX!=null) ? worldPlayerMaxX : (worldEndX-10);
player.x = Math.max(0, Math.min(player.x + vx*dt, hardMaxX));


    if(mode==='world'){ if(player.onGround && Math.abs(vx)>1) footPlay(); else footStop(); }

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; }
    else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt);
dashCooldown=Math.max(0,dashCooldown-dt);
dashTrailT=Math.max(0, dashTrailT - dt);
    if(dropThrough>0) dropThrough=Math.max(0,dropThrough-dt);

// Jump (variable height + FX)
if(jumpBuf>0){
  if(player.onGround||coyote>0){
    player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0;

    if (DUST_ON_TAKEOFF) spawnDust(player.x, GROUND_Y + player.y); // ← poussière

    playJump(); // son uniquement pour le saut du sol
  } else if(airJumpsUsed<AIR_JUMPS){
    airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0;
    // pas de son ici
  }
}


// Gravity (variable jump height)
if(dashTimer<=0){
  if(player.vy<0){
    let g = GRAVITY_UP;
    if(!jumpHeld) g *= JUMP_CUT_MULT; // relâché tôt -> saut plus court
    player.vy += g*dt;
  } else {
    player.vy += GRAVITY_DOWN*dt;
  }
} else {
  player.vy = 0;
}
    
// --- Apply vertical movement & ground clamp (NE PAS SUPPRIMER) ---
const prevFeet = GROUND_Y + player.y;      // <-- utilisé par les toits
player.y += player.vy * dt;

// Sol monde (clamp)
if (GROUND_Y + player.y > GROUND_Y) {
  player.y = 0;
  player.vy = 0;
  player.onGround = true;
} else {
  player.onGround = false;
}


    // Toits one-way + ↓
    onPlatform=false;
    for(const b of buildings){
      const feet=GROUND_Y+player.y, top=b.roof.y;
      const withinX=(player.x+PLAYER_HALF_W>b.roof.x)&&(player.x-PLAYER_HALF_W<b.roof.x+b.roof.w);
      if(withinX && feet>=top-4 && feet<=top+16){ onPlatform=true; break; }
    }
    if(downPressedEdge && onPlatform){ dropThrough=0.35; player.y+=4; }
    if(dropThrough<=0){
      for(const b of buildings){
        const feet=GROUND_Y+player.y, top=b.roof.y;
        const withinX=(player.x+PLAYER_HALF_W>b.roof.x)&&(player.x-PLAYER_HALF_W<b.roof.x+b.roof.w);
        const wasAbove=(prevFeet<=top+4);
        const crossing=(player.vy>=0)&&wasAbove&&(feet>=top);
        const nearTop=(feet>=top && feet<=top+16 && player.vy>=0);
        if(withinX && (crossing||nearTop)){
          player.y += (top-feet);
          player.vy=0; player.onGround=true;
          break;
        }
      }
    }

// Landing FX (transition air -> sol)
if(!wasOnGround && player.onGround){
  const impact = Math.min(4, Math.abs(vyBefore)/600);
  addShake(impact>0.6 ? impact : 0.6);
  if(DUST_ON_LANDING) spawnDust(player.x, GROUND_Y + player.y); // pied réel (sans footPad)
}


// PNJ talk : SANS tempo → à chaque entrée dans la zone, bulle suivante (boucle)
for (const n of npcs){
  const near = Math.abs(player.x - n.x) <= NPC_TALK_RADIUS;
  const list = images.dialogs[n.type] || [];

  if (near){
    if (!n.show){
      // entrée dans le rayon → bulle suivante (boucle complète)
      n.show = true;
      n.hideT = 0;
      if (list.length){
        if (typeof n.dialogIdx !== 'number') n.dialogIdx = -1;
        n.dialogIdx = (n.dialogIdx + 1) % list.length; // -1 → 0 à la première entrée
        n.dialogImg = list[n.dialogIdx];
      } else {
        n.dialogImg = null;
      }
    } else {
      // on reste dans le rayon → on garde la même bulle
      n.hideT = 0;
    }
  } else if (n.show){
    // sortie du rayon → masquage après un court délai
    n.hideT = (n.hideT || 0) + dt;
    if (n.hideT >= NPC_HIDE_DELAY){
      n.show = false;
      n.hideT = 0;
      n.dialogImg = null;
      // on conserve n.dialogIdx pour reprendre à la suivante à la prochaine entrée
    }
  }
}

    

// Posters (collecte)
const wantsDown = keys.has('ArrowDown') || keys.has('s');
for (const p of posters){
  const center = p.x + p.w/2;
  const dx = Math.abs(player.x - center);
  const feetY = GROUND_Y - 110 + player.y;
  const over = aabb(player.x-26, feetY, 52, 110, p.x, p.y, p.w, p.h);

  if (!p.taken && !p.taking && dx <= COLLECT_RADIUS && over && wantsDown){
    p.taking = true;
    p.t = 0;
  }

  if (p.taking){
    p.t += dt;
    if (p.t >= COLLECT_DUR){
      p.taking = false;
      p.taken = true;
      postersCount = Math.min(MAX_COUNT_CAP, postersCount + 1);
      setWanted();

      // +1 qui vole vers le compteur wanted
      const startPos = { x: (p.x - cameraX) + p.w/2, y: (p.y + camYOffset) + p.h/2 };
      flyPlusOne(scoreWantedUI || scoreEl || document.getElementById('scoreNum'), { fromCanvas: startPos });
      pulseCounter(scoreWantedUI || scoreEl || document.getElementById('scoreNum'));

      // Son
      playSfx('wanted');

      // Posters complets (10/10) – une seule fois
      if (!postersCompleteShown && postersCount >= POSTERS_TOTAL){
        playSfx('postersComplete');
        ensureOverlay().style.display = 'grid';
        postersCompleteShown = true;
      }

      // Re-affichage "all_complete" à 11/10 (si Absolute pas vrai)
      if (allCompleteShown && !allCompleteReshown && eggs >= 10 && postersCount >= 11 && !(eggs >= 11 && postersCount >= 11)) {
        setTimeout(()=>{
          ensureAllCompleteOverlay().style.display = 'grid';
          playDing();
        }, 3000);
        allCompleteReshown = true;
      }
    }
  }
}

// Portes
if(wantsDown && !onPlatform && dropThrough<=0){
  for(const b of buildings){
    const atDoor=(player.x>b.doorX && player.x<b.doorX+b.doorW);
    const feet=GROUND_Y+player.y, base=b.y+b.dh;
    const nearBase=Math.abs(feet-base)<280;
    if(atDoor && nearBase){
      if (b.canEnterPossible){
        // ré-ouvrables (2/3)
        b.wasOpen = true;
        triedDoor.add(b.id);
        enterInterior(b);
        break;
      } else {
        playSfx('doorLocked');
        break;
      }
    }
  }
  // Mur de fin → "get out"
  if(endWall){
    if(player.x > endWall.x-20 && player.x < endWall.x+endWall.dw+20){
      playSfx('getout');
    }
  }
}




  
// Caméra (lookahead + micro shake)
const W=canvas.width/DPR;
const speedRatio = Math.min(1, Math.abs(vx)/MOVE_SPEED);
const sign = (player.facing==='right') ? 1 : -1;
const lookTarget = sign * (LOOKAHEAD_MAX*speedRatio + (dashTimer>0?LOOK_DASH_BONUS:0));
camLookX += (lookTarget - camLookX) * Math.min(1, dt*LOOK_SMOOTH);

// shake decay + offsets
shakeAmp *= 0.88;
const shX = (Math.random()*2-1) * shakeAmp;
const shY = (Math.random()*2-1) * (shakeAmp*0.6);

// X
let camXTarget = player.x + camLookX - W/2;
camXTarget = Math.max(0, Math.min(camXTarget, Math.max(0, worldEndX - W)));
cameraX = camXTarget + shX;

// Y doux + shake
const targetY = -player.y*0.18;
camYOffset += (targetY - camYOffset) * Math.min(1,dt*8);
camYOffset += shY;


    // Draw
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    const yG=camYOffset, yM=camYOffset*0.5;
    if(images.back)  drawLayer(images.back,0.15,6,0);
    if(images.mid)   drawLayer(images.mid, 0.45,6,yM);
    if(images.front) drawLayer(images.front,1.00,6,yG);
    for(const b of buildings) b.animT+=dt;
    drawBuildings(yG); drawPosters(yG); drawNPCs(yG); drawFX(yG); drawMyo(vx,yG);
    if(endWall){ endWall.animT+=dt; drawEndWall(yG); }

    downPressedEdge=false;
  }

  function enterInterior(b){
    mode='interior'; currentB=b; cameraX=0;
    footStop(); if(bgm){ bgm.volume=0.12; }
    interiorOpenIdx=0; hacking=false; hackT=0;
    player.x=60; player.y=12; player.vy=0; player.onGround=true; player.facing='right';
  }
function exitInterior(){
  mode='world';
  if(bgm){ bgm.volume=0.6; }
  playSfx('exit');
  
  if(currentB){
    player.x=currentB.doorX+currentB.doorW/2;
    player.y=0; player.vy=0; player.onGround=true;
  }

  const showAll = pendingAllComplete;
  const showAbs = pendingAbsoluteComplete;
  pendingAllComplete = false;
  pendingAbsoluteComplete = false;
  currentB = null;

if (showAll) {
  setTimeout(()=>{ ensureAllCompleteOverlay().style.display='grid'; playDing(); }, 3000);
}
if (showAbs) {
  setTimeout(()=>{ ensureAbsoluteOverlay().style.display='grid'; playDing(); }, 3000);
}
}

function updateInterior(dt){
  const W=canvas.width/DPR, H=canvas.height/DPR;
  // headroom : sol plus bas, plafond reculé
  const floorY=H-48, ceilY=-300;

  let vx=0; const base=MOVE_SPEED*AIR_SPEED_MULT;
  if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*base*DASH_MULT; dashTimer-=dt; }
  else{
    if(keys.has('ArrowRight')||keys.has('d')){ vx+=base; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=base; player.facing='left'; }
  }
  player.x=Math.max(0,Math.min(W-60,player.x+vx*dt));

  if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; }
  else coyote=Math.max(0,coyote-dt);
  jumpBuf=Math.max(0,jumpBuf-dt);
dashCooldown=Math.max(0,dashCooldown-dt);
dashTrailT=Math.max(0, dashTrailT - dt);

if (jumpBuf > 0) {
  if (player.onGround || coyote > 0) {
    player.vy = -JUMP_VELOCITY;
    player.onGround = false;
    jumpBuf = 0;
    playJump(); // même fonction SFX que dehors
  } else if (airJumpsUsed < AIR_JUMPS) {
    airJumpsUsed++;
    player.vy = -JUMP_VELOCITY;
    jumpBuf = 0;
    playJump(); // même fonction SFX que dehors
  }
}

  if(dashTimer<=0){
    if(player.vy<0){
      let g = GRAVITY_UP;
      if(!jumpHeld) g *= JUMP_CUT_MULT;
      player.vy += g*dt;
    } else {
      player.vy += GRAVITY_DOWN*dt;
    }
  } else player.vy=0;

  player.y += player.vy*dt;
  if(floorY+player.y>floorY){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;
  const head=floorY - MYO_H_INTERIOR + player.y; if(head<ceilY){ player.y+=(ceilY-head); player.vy=0; }

  if(player.x<=0 && !hacking){ exitInterior(); return; }

  const wantsDown=keys.has('ArrowDown')||keys.has('s');

  // Terminal LARGE : moitié droite & moitié basse
  const term={ x:Math.floor(W*0.50), y:Math.floor(H*0.50), w:Math.floor(W*0.50), h:Math.floor(H*0.50) };
  const myoH=MYO_H_INTERIOR, myoRect={ x:player.x-24, y:(floorY - myoH + player.y + INTERIOR_FOOT_EXTRA), w:48, h:myoH };
  const inTerm=aabb(myoRect.x,myoRect.y,myoRect.w,myoRect.h, term.x,term.y,term.w,term.h);

  if(!hacking && wantsDown && inTerm){ hacking=true; hackT=0; playSfx('type'); }
  if(hacking){
    hackT+=dt;
    if(hackT>=1.5){
      hacking=false; hackT=0; playDing();
      if(currentB && !hackedIds.has(currentB.id)){
        hackedIds.add(currentB.id);
        eggIndex = Math.min(MAX_COUNT_CAP, eggIndex + 1);
eggs = eggIndex;
setEggs();
        // Effet "+1" qui vole vers le compteur des œufs (eggNum)
// centre du terminal intérieur (déjà défini plus haut : const term = {...})
const startPos = { x: Math.floor(term.x + term.w/2), y: Math.floor(term.y + term.h/2) };
flyPlusOne(scoreEggUI || eggBox || document.getElementById('eggNum'), { fromCanvas: startPos });
pulseCounter(scoreEggUI || eggBox || document.getElementById('eggNum'));


      }
      interiorOpenIdx=Math.max(1,eggIndex); // 1→10

      // Ne pas afficher ici : on flag pour l’afficher après la sortie
      if (!allCompleteShown && eggIndex >= 10 && postersCount >= 10 && !(eggIndex >= 11 && postersCount >= 11)) {
        pendingAllComplete = true;
      }
      if (!absoluteShown && eggIndex >= 11 && postersCount >= 11) {
        pendingAbsoluteComplete = true;
      }

    }
  }

  // Draw
  player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  if(interiorOpenIdx===0){
    const fr=images.interiorClosedIdle; const img=fr[Math.floor(player.animTime*2)%fr.length]||fr[0]; if(img) ctx.drawImage(img,0,0,W,H);
  }else{
    const img=images.interiorOpens[Math.min(9,interiorOpenIdx-1)]; if(img) ctx.drawImage(img,0,0,W,H);
  }
  const fr2=(Math.abs(vx)>1e-2?images.myoWalk:images.myoIdle);
  const i2=fr2[Math.floor(player.animTime*(Math.abs(vx)>1e-2?8:4))%fr2.length]||fr2[0];
  if(i2){
    const s=MYO_H_INTERIOR/i2.height, dw=Math.round(i2.width*s), dh=Math.round(i2.height*s);
    const x=Math.floor(player.x - dw/2), y=floorY - dh + player.y + INTERIOR_FOOT_EXTRA;
    ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(i2,0,0,dw,dh); } else ctx.drawImage(i2,x,y,dw,dh); ctx.restore();
  }
}


  function loop(ts){ const dt=Math.min((ts-(loop.last||ts))/1000,1/30); loop.last=ts;
    if(!worldReady){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR); requestAnimationFrame(loop); return; }
    if(mode==='world') updateWorld(dt); else updateInterior(dt);
    requestAnimationFrame(loop);
  }

function assetsCruciauxOk(){
  // Il faut au minimum : 1 frame idle de Myo + le ground (devant).
  const okMyo    = !!(images.myoIdle && images.myoIdle[0]);
  const okGround = !!images.front;
  return okMyo && okGround;
}

  
/* ========== Boot ========== */
function boot(){
  if (startBtn) startBtn.disabled = true;
  if (window.gateUI && window.gateUI.showLoading) window.gateUI.showLoading();

if(!ensureCanvas()){
  if (startBtn) startBtn.disabled = false;
  return;
}

  loadAll().then(function(){
    // On signale si des visuels minimum manquent, MAIS on lance quand même la boucle.
    const missing = [
      !(images.myoIdle && images.myoIdle[0]) ? 'images.myoIdle[0]' : null,
      !images.front ? 'images.front (ground.png)' : null
    ].filter(Boolean);

    if (missing.length){
      const note = document.getElementById('loadNote') || document.createElement('div');
      note.id = 'loadNote';
      Object.assign(note.style, {
        position:'absolute', bottom:'12px', left:'12px', right:'12px',
        font:'12px/1.4 system-ui', color:'#bbb', opacity:'0.9'
      });
      note.textContent = 'Chargement incomplet (fallback actif). Manque: ' + missing.join(', ');
      gate.appendChild(note);
      console.warn('[IO83] Fallback actif. Manque :', missing);
    }


    
    gate.style.display = 'none';
    if (window.gateUI && window.gateUI.stopAll) window.gateUI.stopAll();
        // Affiche l'aide (helper) dès le début du jeu
    if (!helperShown) {
      ensureHelperOverlay().style.display = 'grid';
      helperShown = true;
    }

    // ——— NOUVEAU : retire la rangée blanche héritée ———
    try { removeLegacyControlsLegend(); } catch(_) {}
    
    // Installe et affiche le HUD maintenant (pas sur l’écran Title)
    try { installHUD(); setWanted(); setEggs(); } catch(_) {}

    requestAnimationFrame(loop);
  });

}

console.log('[IO83] main.js chargé ✔');


 // --- FIN DU FICHIER ---
})();
