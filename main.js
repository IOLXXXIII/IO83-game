// IO83 – main.js (répartition par blocs 3–4 + headroom intérieur)
// - Conserve: dash, double saut, toits one-way + ↓, Kaito + son bâtiment, mur fin,
//   caméra Y douce, overlay 10/10, sons…
// - Intérieur confortable (plafond reculé, sol un peu plus bas)
// - Répartition "par blocs" 3–4 bâtiments avec 1 PNJ + 1 poster par bloc (si place)

(function(){
  'use strict';
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



  // Variables utilisées par checkAllComplete (déclarées AVANT toute utilisation)
  let allCompleteOverlay = null;
  let allCompleteTimerId = null;
  let allCompleteShown   = false;
  let pendingAllComplete = false;
  let absoluteOverlay = null;
  let absoluteTimerId = null;
  let absoluteShown   = false;
  let pendingAbsoluteComplete = false;
  let postersCompleteShown = false;




  const setWanted = () => {
    if (scoreEl) scoreEl.textContent = `${postersCount}/10`;
    checkAllComplete();
    checkAbsoluteComplete(); // ← ajout
  };
  const setEggs = () => {
    if (eggBox) eggBox.textContent = `${eggs}/10`;
    checkAllComplete();
    checkAbsoluteComplete(); // ← ajout
  };

  setWanted();
  setEggs();


  

  /* ========== Audio ========== */
  const bgm=document.getElementById('bgm');
  const sfx={
    wanted:document.getElementById('sfxWanted'),
    dash:document.getElementById('sfxDash'),
    enter:document.getElementById('sfxEnter'),
    exit:document.getElementById('sfxExit'),
    jump:document.getElementById('sfxJump'),
    type:document.getElementById('sfxType'),
    ding:document.getElementById('sfxDing'),
    foot:document.getElementById('sfxFoot'),
    doorLocked:document.getElementById('sfxDoorLocked')||document.getElementById('sfxGetOut'),
    getout:document.getElementById('sfxGetOut'),
    postersComplete:document.getElementById('sfxPostersComplete')
  };
  Object.values(sfx).forEach(a=>{
  if(!a) return;
  const base = (a===bgm ? 1 : 0.8);
  const cur  = (typeof a.volume === 'number') ? a.volume : 1;
  a.volume = base * cur;
});

  if(sfx.foot) sfx.foot.volume=0.7;
  const startAudio=()=>{ if(bgm){ bgm.muted=false; bgm.volume=0.6; bgm.currentTime=0; bgm.play().catch(()=>{});} };
  const footPlay=()=>{ if(!sfx.foot) return; if(sfx.foot.paused) sfx.foot.play().catch(()=>{}); sfx.foot.playbackRate=0.96+Math.random()*0.08; };
  const footStop=()=>{ if(sfx.foot && !sfx.foot.paused) sfx.foot.pause(); };

// --- Helpers audio ---
function makePool(el, n=3){
  if(!el) return [];
  const arr=[];
  for(let i=0;i<n;i++){ const c=el.cloneNode(true); c.volume=el.volume; arr.push(c); }
  return arr;
}
const jumpPool = makePool(sfx.jump, 3);
let jumpPoolIdx = 0;
function playJump(){
  if(!sfx.jump) return;
  const a = jumpPool.length ? jumpPool[(jumpPoolIdx++)%jumpPool.length] : sfx.jump;
  try{ a.currentTime=0; a.play().catch(()=>{});}catch(_){}
}
function playDing(){
  if(!sfx.ding) return;
  try{ sfx.ding.currentTime=0; sfx.ding.play().catch(()=>{});}catch(_){}
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
  const CB='?v='+(Date.now());
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
    dialogsManifest:'config/dialogs_manifest.json'+CB,
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
    absoluteCompletePNG:'assets/collectibles/absolute_complete.png'+CB


  };
const images = {
  back:null, mid:null, front:null,
  myoIdle:[], myoWalk:[],
  posterWith:null, posterWithout:null,
  npcs:{aeron:[], kaito:[], maonis:[], kahikoans:[]},
  dialogs:{aeron:[], kaito:[], maonis:[], kahikoans:[]},
  buildings:[], buildingKaito:null, buildingWall:null, dashTrail:[],
  interiorClosedIdle:[], interiorOpens:[],
  postersComplete:null, allComplete:null, absoluteComplete:null, jumpDust:[]

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
  // All : quand Posters = 10/10 ET ??? = 10/10 (mais pas à 11/11)
  if (allCompleteShown) return;

  const atLeast10 = (eggs >= 10 && postersCount >= 10);
  const notYet11  = !(eggs >= 11 && postersCount >= 11); // évite un déclenchement à 11/11

  if (!(atLeast10 && notYet11)) return;
  if (mode !== 'world') return; // jamais en intérieur

  if (allCompleteTimerId) clearTimeout(allCompleteTimerId);
  allCompleteTimerId = setTimeout(()=>{
    ensureAllCompleteOverlay().style.display='grid';
    playDing();
    allCompleteShown = true;
  }, 3000);
}



function checkAbsoluteComplete(){
  // Condition : 11/11 minimum
  if(!(eggs>=11 && postersCount>=11)) return;
  // Jamais en intérieur
  if(mode!=='world') return;
  // Affiche ~5 s après la dernière mise à jour
  if(absoluteTimerId) clearTimeout(absoluteTimerId);
  absoluteTimerId = setTimeout(()=>{
    ensureAbsoluteOverlay().style.display='grid';
    playDing(); // sfx_terminal_ding
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
  const NPC_TURN_OFFSET = 160; // ← augmente pour décaler davantage vers la droite (ex: 60, 80…)
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

  // Dialogs (facultatif)
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
        const gapW = rint(minW, maxW);
        x = bx + dw + gapW; // on crée réellement la place
      }
      else{
        // Fin du bloc → gap inter-bloc
        x += rint(INTER_GAP_MIN, INTER_GAP_MAX);
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
      npcs.push({ type, x:nx, frames:images.npcs[type], animT:0, face:'right', show:false, hideT:0, dialogImg:null, dialogIdx:0 });
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
  const img=frames[idx]||images.myoIdle[0]; if(!img) return;

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
    for(const n of npcs){
      const base=n.frames[0]; if(!base) continue;
      const s=NPC_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      const footPad=Math.round(dh*FOOT_PAD_RATIO);
      const sy=(GROUND_Y+yOff)-dh+footPad, sx=Math.floor(n.x - cameraX);
      const flipX = n.x + NPC_TURN_OFFSET;
      if (player.x < flipX) n.face = 'left'; else if (player.x > flipX) n.face = 'right';
      const img=n.frames[Math.floor(n.animT*2)%2]||base;
      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

if(n.show){
  const list = images.dialogs[n.type];
  if(!n.dialogImg && list && list.length){
    n.dialogImg = list[n.dialogIdx++ % list.length];
  }
}else{
  n.dialogImg = null;
}

      if(n.dialogImg){
        const scale=0.72, bw=n.dialogImg.width*scale, bh=n.dialogImg.height*scale;
        const bx=sx + Math.round(dw/2 - bw*0.5) - Math.round(bw*0.5);
        const by=sy - Math.round(bh*0.5);
        ctx.drawImage(n.dialogImg,bx,by,bw,bh);
      }
      n.animT+=1/60;
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
  if(sfx.dash) sfx.dash.play().catch(()=>{});
}


  /* ========== Loops ========== */
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentB=null;

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


    
    // PNJ talk
    for(const n of npcs){
      const near=Math.abs(player.x-n.x)<=NPC_TALK_RADIUS;
      if(near){ n.show=true; n.hideT=0; }
      else if(n.show){ n.hideT=(n.hideT||0)+dt; if(n.hideT>=NPC_HIDE_DELAY){ n.show=false; n.dialogImg=null; n.hideT=0; } }
    }

// Posters
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
      if (sfx.wanted) sfx.wanted.play().catch(()=>{});

      // Posters → à 10/10 (une seule fois)
      if (!postersCompleteShown && postersCount >= POSTERS_TOTAL){
        if (sfx.postersComplete) sfx.postersComplete.play().catch(()=>{});
        ensureOverlay().style.display = 'grid';
        playDing();
        postersCompleteShown = true;
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
  // Bâtiments 2/3 : toujours ré-ouvrables, re-entry infini
  b.wasOpen = true;
  triedDoor.add(b.id);
  enterInterior(b);
  break;
} else {
  if(sfx.doorLocked){
    try { sfx.doorLocked.currentTime = 0; sfx.doorLocked.play(); } catch(_){}
  }
  break;
}
        }
      }
      if(endWall){
        if(player.x > endWall.x-20 && player.x < endWall.x+endWall.dw+20) if(sfx.getout) sfx.getout.play().catch(()=>{});
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
  if(sfx.exit) sfx.exit.play().catch(()=>{});

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

  if(jumpBuf>0){
    if(player.onGround||coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; if(sfx.jump) sfx.jump.play().catch(()=>{}); }
    else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; if(sfx.jump) sfx.jump.play().catch(()=>{}); }
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

  if(!hacking && wantsDown && inTerm){ hacking=true; hackT=0; if(sfx.type) sfx.type.play().catch(()=>{}); }
  if(hacking){
    hackT+=dt;
    if(hackT>=1.5){
      hacking=false; hackT=0; if(sfx.ding) sfx.ding.play().catch(()=>{});
      if(currentB && !hackedIds.has(currentB.id)){
        hackedIds.add(currentB.id);
        eggIndex = Math.min(MAX_COUNT_CAP, eggIndex + 1);
eggs = eggIndex;
setEggs();

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

/* ========== Boot ========== */
function boot(){
  startBtn.disabled = true;
  startBtn.textContent = 'Loading…';
  if(!ensureCanvas()){
    // canvas pas prêt → ne pas bloquer le bouton
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
    return;
  }
  loadAll().then(function(){
    gate.style.display = 'none';
    requestAnimationFrame(loop);
  });
}

function tryStart(){ startAudio(); boot(); }

// Attache robuste (click + pointerdown) et “once” manuel
function onStart(e){
  e.preventDefault();
  cleanup();
  tryStart();
}
function cleanup(){
  startBtn.removeEventListener('click', onStart);
  startBtn.removeEventListener('pointerdown', onStart);
  gate.removeEventListener('click', onStart);
  gate.removeEventListener('pointerdown', onStart);
}
// Écoute le bouton ET toute la zone gate (au cas où quelque chose recouvrirait encore)
startBtn.addEventListener('click', onStart, {passive:false});
startBtn.addEventListener('pointerdown', onStart, {passive:false});
gate.addEventListener('click', onStart, {passive:false});
gate.addEventListener('pointerdown', onStart, {passive:false});

  console.log('[IO83] main.js chargé ✔');

 // --- FIN DU FICHIER ---
})();
