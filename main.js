// IO83 – main.js (répartition par blocs 3–4 + headroom intérieur)
// - On conserve tout : dash, double saut, toits one-way + ↓, Kaito + son bâtiment, mur fin, caméra Y douce, overlay 10/10, sons…
// - NEW: Intérieur plus confortable (plafond reculé, sol un peu plus bas)
// - NEW: Répartition "par blocs" 3–4 bâtiments : au moins 1 PNJ ou 1 poster par bloc, 10 posters répartis régulièrement

(function(){
  'use strict';

  /* ========== Utils ========== */
  const rnd=(a,b)=>Math.random()*(b-a)+a;
  const rint=(a,b)=>Math.floor(rnd(a,b+1));
  const aabb=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;

  /* ========== Canvas ========== */
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  /* ========== Gate / HUD ========== */
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const hud=document.getElementById('hud');

  let postersCount=0, eggs=0;
  const scoreEl=document.getElementById('scoreNum');
  const eggBox=(()=>{ let e=document.getElementById('eggNum'); if(!e){ const box=document.createElement('div'); box.id='eggs'; box.innerHTML='??? <span id="eggNum">0/10</span>'; hud.appendChild(box); e=box.querySelector('#eggNum'); } return e; })();
  const setWanted=()=>{ if(scoreEl) scoreEl.textContent=`${postersCount}/10`; };
  const setEggs=()=>{ eggBox.textContent=`${eggs}/10`; };
  setWanted(); setEggs();

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
  Object.values(sfx).forEach(a=>{ if(a) a.volume=(a===bgm?1:0.8)*(a?.volume||1); });
  if(sfx.foot) sfx.foot.volume=0.7;
  const startAudio=()=>{ if(bgm){ bgm.muted=false; bgm.volume=0.6; bgm.currentTime=0; bgm.play().catch(()=>{});} };
  const footPlay=()=>{ if(!sfx.foot) return; if(sfx.foot.paused) sfx.foot.play().catch(()=>{}); sfx.foot.playbackRate=0.96+Math.random()*0.08; };
  const footStop=()=>{ if(sfx.foot && !sfx.foot.paused) sfx.foot.pause(); };

  /* ========== Parallax / Ground ========== */
  const VIEW_DEN={back:6, mid:6, front:6};
  let cameraX=0, camYOffset=0;
  let GROUND_SRC_OFFSET=parseInt(localStorage.getItem('GROUND_SRC_OFFSET')||'18',10);
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
  const CB='';
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
    dashTrail:['assets/fx/dash_trail_1.png'+CB,'assets/fx/dash_trail_2.png'+CB,'assets/fx/dash_trail_3.png'+CB],
    interiorClosedIdle:['assets/interiors/interior_closed_idle_1.png'+CB,'assets/interiors/interior_closed_idle_2.png'+CB],
    interiorOpens:Array.from({length:10},(_,i)=>`assets/interiors/interior_open_${i+1}.png${CB}`),
    postersCompletePNG:'assets/ui/posters_complete.png'+CB
  };
  const images={
    back:null, mid:null, front:null, myoIdle:[], myoWalk:[],
    posterWith:null, posterWithout:null,
    npcs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    dialogs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    buildings:[], buildingKaito:null, buildingWall:null, dashTrail:[],
    interiorClosedIdle:[], interiorOpens:[], postersComplete:null
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
  let lastTapL=-999,lastTapR=-999,dashTimer=0,dashCooldown=0,airDashUsed=0;

  // Toits
  let onPlatform=false, dropThrough=0; let downPressedEdge=false;

  const keys=new Set();
  addEventListener('keydown',e=>{
    if(!worldReady || (mode!=='world' && mode!=='interior')) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(e.key)) e.preventDefault();
    if(e.repeat){ keys.add(e.key); return; }
    keys.add(e.key);
    if(e.key==='ArrowDown'||e.key==='s') downPressedEdge=true;
    if(e.key==='ArrowUp'||e.key==='w')   jumpBuf=JUMP_BUFFER;
    const t=performance.now()/1000;
    if(e.key==='ArrowRight'||e.key==='d'){ if(t-lastTapR<=DASH_WINDOW) tryDash('right'); lastTapR=t; }
    if(e.key==='ArrowLeft' ||e.key==='a'){ if(t-lastTapL<=DASH_WINDOW) tryDash('left');  lastTapL=t; }
  });
  addEventListener('keyup',e=>{ if(!worldReady) return; keys.delete(e.key); });

  const player={x:0,y:0,vy:0,onGround:true,facing:'right',state:'idle',animTime:0};

  /* ========== Posters ========== */
  const POSTERS_TOTAL=10, POSTER_SIZE=Math.round(100*1.2);
  const COLLECT_RADIUS=76, COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  let postersOverlay=null;
  function ensureOverlay(){
    if(postersOverlay) return postersOverlay;
    const wrap=document.createElement('div'); Object.assign(wrap.style,{position:'fixed',inset:'0',display:'none',placeItems:'center',background:'rgba(0,0,0,.6)',zIndex:'9998'});
    const panel=document.createElement('div'); Object.assign(panel.style,{padding:'16px',background:'#111',border:'2px solid #444',borderRadius:'12px'});
    const img=document.createElement('img'); img.alt='Completed'; img.style.maxWidth='min(80vw,800px)'; img.style.maxHeight='70vh'; img.style.imageRendering='pixelated'; img.src=ASSETS.postersCompletePNG.split('?')[0];
    const btn=document.createElement('button'); btn.textContent='Close'; Object.assign(btn.style,{display:'block',margin:'12px auto 0',padding:'8px 16px',cursor:'pointer',background:'#1b1b1b',color:'#fff',border:'1px solid #555',borderRadius:'8px'});
    btn.onclick=()=>{ wrap.style.display='none'; };
    panel.appendChild(img); panel.appendChild(btn); wrap.appendChild(panel); document.body.appendChild(wrap); postersOverlay=wrap; return wrap;
  }

  /* ========== Monde & contenu ========== */
  const BUILDING_TARGET_H=Math.round(450*1.15);

  const buildings=[]; let nextBId=1;
  let worldStartX=1400, worldEndX=20000;
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
  const npcs=[];
  let eggIndex=0; const hackedIds=new Set(); eggs=eggIndex; setEggs();

  /* ===== Entrée aléatoire 2/3 avec garantie ===== */
  const BASE_ENTER_CHANCE=0.55;
  const triedDoor=new Set();
  function shouldEnterThis23(b){
    if(triedDoor.has(b.id) && !b.wasOpen) return false;
    const eggsRemain=10 - eggIndex;
    const notTried = buildings.filter(x=> (x.typeId===2||x.typeId===3) && !triedDoor.has(x.id));
    const potentialsRemain=notTried.length - (triedDoor.has(b.id)?0:1);
    if(eggsRemain>=potentialsRemain) return true;
    return Math.random() < BASE_ENTER_CHANCE;
  }

  /* ========== Chargement ========== */
  let worldReady=false;
  async function loadAll(){
    const L=src=>loadImg(src);
    images.back = await L(ASSETS.back);
    images.mid  = await L(ASSETS.mid);
    images.front= await L(ASSETS.front);
    for(const s of ASSETS.myoIdle) images.myoIdle.push(await L(s));
    for(const s of ASSETS.myoWalk) images.myoWalk.push(await L(s));
    images.posterWith    = await L(ASSETS.posterWith);
    images.posterWithout = await L(ASSETS.posterWithout);
    for(const k of Object.keys(ASSETS.npcs)) for(const s of ASSETS.npcs[k]) images.npcs[k].push(await L(s));
    try{
      const r=await fetch(ASSETS.dialogsManifest); const mf=await r.json();
      for(const k of ['aeron','kaito','maonis','kahikoans']){
        const list=mf[k]||[]; for(const name of list){
          const p=`assets/ui/dialogs/${k}/${name}${CB}`; const i=await loadImg(p); if(i) (images.dialogs[k]??=[]).push(i);
        }
      }
    }catch{}
    for(const [a,b,id] of ASSETS.buildings) images.buildings.push([await L(a), (await L(b))||null, id]);
    { const ka=await L(ASSETS.buildingKaito[0]); const kb=ka? await L(ASSETS.buildingKaito[1]):null; images.buildingKaito=ka?[ka,kb||ka]:null; }
    { const wa=await L(ASSETS.buildingWall[0]); const wb=wa? await L(ASSETS.buildingWall[1]):null; images.buildingWall=wa?[wa,wb||wa]:null; }
    for(const s of ASSETS.dashTrail){ const i=await L(s); if(i) images.dashTrail.push(i); }
    for(const s of ASSETS.interiorClosedIdle){ const i=await L(s); if(i) images.interiorClosedIdle.push(i); }
    for(const s of ASSETS.interiorOpens){ const i=await L(s); if(i) images.interiorOpens.push(i); }
    images.postersComplete = await L(ASSETS.postersCompletePNG);

    recalcGround();
    buildWorld();
    worldReady=true;
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

  /* ========== Build world (BLOCS 3–4 bâtiments, contenu garanti) ========== */
  function pickBuildingFrameWeighted(){
    const pool=[...Array(36).fill(1), ...Array(16).fill(2), ...Array(16).fill(3), ...Array(36).fill(4)];
    const t=pool[rint(0,pool.length-1)];
    const found=images.buildings.find(b=>b[2]===t) || images.buildings[0];
    return found;
  }

function buildWorld(){
  buildings.length = 0;

  // 1) Génère ~62 bâtiments (même logique qu’avant)
  let x = worldStartX;
  const minBuildings = 62;
  while (buildings.length < minBuildings) {
    const cluster = (Math.random() < 0.65) ? rint(2,3) : 1;
    for (let i=0;i<cluster;i++){
      const [im1, im2, typeId] = pickBuildingFrameWeighted();
      const s  = BUILDING_TARGET_H / im1.height;
      const dw = Math.round(im1.width * s);
      const dh = Math.round(im1.height * s);
      const bx = x, by = GROUND_Y - dh;
      const roof = makeRoof(bx, by, dw, dh);
      buildings.push({
        id: nextBId++, typeId,
        frames: [im1, im2 || im1], animT: 0,
        x: bx, y: by, dw, dh, roof,
        doorX: bx, doorW: dw,
        canEnterPossible: (typeId===2 || typeId===3)
      });
      x += dw + rint(28, 64);
    }
    x += rint(600, 1200);
  }

  // 2) Réserve Kaito loin du début
  const worldMin = buildings[0]?.x || worldStartX;
  const worldMax = (buildings.at(-1)?.x || worldMin) + (buildings.at(-1)?.dw || 0);
  const span     = Math.max(9000, worldMax - worldMin);

  const kaitoMin = worldMin + 6000;
  const kaitoMax = worldMin + Math.floor(span * 0.8);
  let kaitoX     = Math.max(kaitoMin, Math.min(kaitoMax, worldMin + Math.floor(span*0.7) + rint(-300,300)));
  const reserveL = kaitoX - 1600, reserveR = kaitoX + 1600;

  // décale ce qui empiète sur la réserve
  for (const b of buildings) {
    if (b.x < reserveR && b.x + b.dw > reserveL) {
      const shift = reserveR - (b.x + b.dw) + 320;
      b.x += shift; b.doorX += shift; b.roof.x += shift;
    }
  }

  // 3) Intervalles d’exclusion (anti-superposition pour PNJ/posters)
  const forbid = intervalsFromBuildings(520);

  // 4) Place Kaito (perso)
  npcs.length = 0;
  kaitoX = placeInGaps(kaitoX, 200, forbid, 160);
  forbid.push([kaitoX-300, kaitoX+300]);
  npcs.push({ type:'kaito', x:kaitoX, frames:images.npcs.kaito, animT:0, face:'right', show:false, hideT:0, dialogImg:null, dialogIdx:0 });

  // Bâtiment de Kaito à sa gauche
  if (images.buildingKaito) {
    const base = images.buildingKaito[0];
    const s  = BUILDING_TARGET_H / base.height;
    const dw = Math.round(base.width * s);
    const dh = Math.round(base.height * s);
    const minBX = reserveL - 1200, maxBX = kaitoX - 400 - dw;
    let bx = Math.max(minBX, Math.min(maxBX, kaitoX - (dw + 220)));
    bx = placeInGaps(bx, dw, forbid, 160);
    const by = GROUND_Y - dh;
    const roof = makeRoof(bx, by, dw, dh);
    buildings.push({
      id: nextBId++, typeId: 98,
      frames: [images.buildingKaito[0], images.buildingKaito[1] || images.buildingKaito[0]],
      animT:0, x:bx, y:by, dw, dh, roof, doorX:bx, doorW:dw, canEnterPossible:false
    });
    forbid.push([bx-420, bx+dw+420]);
  }

  // 5) RÈGLE DURE PNJ : tous les 3–5 bâtiments
  const PNJ_EVERY_MIN = 3, PNJ_EVERY_MAX = 5;
  const firstThird = Math.floor(buildings.length/3);
  let aeronPlaced = false;

  for (let idx = rint(2,4); idx < buildings.length; idx += rint(PNJ_EVERY_MIN, PNJ_EVERY_MAX)) {
    const b  = buildings[Math.min(idx, buildings.length-1)];
    let px   = b.x + Math.round(b.dw*0.5) + rint(-140,140);
    if (px > reserveL && px < reserveR) px = reserveR + 600;

    let type = 'kahikoans';
    if (!aeronPlaced && idx <= firstThird) { type='aeron'; aeronPlaced=true; }
    else if (Math.random() < 0.35)        { type='maonis'; }

    px = placeInGaps(px, 200, forbid, 120);
    forbid.push([px-300, px+300]);
    npcs.push({ type, x:px, frames:images.npcs[type], animT:0, face:'right', show:false, hideT:0, dialogImg:null, dialogIdx:0 });
  }
  if (!aeronPlaced) {
    const b = buildings[Math.min(5, buildings.length-1)];
    let px = placeInGaps(b.x + Math.round(b.dw*0.5), 200, forbid, 120);
    npcs.unshift({ type:'aeron', x:px, frames:images.npcs.aeron, animT:0, face:'right', show:false, hideT:0, dialogImg:null, dialogIdx:0 });
    forbid.push([px-300, px+300]);
  }

  // 6) RÈGLE DURE POSTERS : tous les 4–6 bâtiments (cap 10)
  posters.length = 0;
  for (let idx = rint(3,5); posters.length < POSTERS_TOTAL && idx < buildings.length; idx += rint(4,6)) {
    const b = buildings[Math.min(idx, buildings.length-1)];
    let px  = b.x + Math.round(b.dw*0.5) + rint(-120,120);
    if (px > reserveL && px < reserveR) px = reserveR + 600;
    px = placeInGaps(px, POSTER_SIZE, forbid, 140);
    posters.push({ x:px, y: GROUND_Y - POSTER_SIZE, w:POSTER_SIZE, h:POSTER_SIZE, t:0, taking:false, taken:false });
    forbid.push([px-260, px+POSTER_SIZE+260]);
  }
  // Complète si < 10
  for (let i=2; posters.length<POSTERS_TOTAL && i<buildings.length; i+=4) {
    const b = buildings[i];
    let px  = b.x + Math.round(b.dw*0.5);
    if (px > reserveL && px < reserveR) continue;
    px = placeInGaps(px, POSTER_SIZE, forbid, 140);
    posters.push({ x:px, y: GROUND_Y - POSTER_SIZE, w:POSTER_SIZE, h:POSTER_SIZE, t:0, taking:false, taken:false });
    forbid.push([px-260, px+POSTER_SIZE+260]);
  }

  // 7) Mur de fin
  worldEndX = Math.max(
    ...buildings.map(b=>b.x+b.dw),
    ...posters.map(p=>p.x+p.w),
    ...npcs.map(n=>n.x+200)
  ) + 1600;
  spawnEndWall();
}


  function spawnEndWall(){
    if(!images.buildingWall) return;
    const base=images.buildingWall[0]; const screenH=canvas.height/DPR;
    const targetH=Math.round(screenH*1.25*0.85);
    const s=targetH/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
    const x = worldEndX - 800; const y = GROUND_Y - dh;
    endWall={frames:images.buildingWall, animT:0, x, y, dw, dh};
    worldEndX = endWall.x - 8;
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
    const x=Math.floor(player.x - cameraX), y=GROUND_Y - dh + player.y + yOff + footPad;
    if(dashTimer>0 && images.dashTrail.length){
      const ti=images.dashTrail[Math.floor(player.animTime*9)%images.dashTrail.length];
      ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2-16,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); } else ctx.translate(x-16,y);
      ctx.globalAlpha=0.85; ctx.drawImage(ti,0,0,dw,dh); ctx.restore();
    }
    ctx.save();
    if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
    else ctx.drawImage(img,x,y,dw,dh);
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
      if(player.x<n.x) n.face='left'; else if(player.x>n.x) n.face='right';
      const img=n.frames[Math.floor(n.animT*2)%2]||base;
      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

      if(n.show){
        if(!n.dialogImg && images.dialogs[n.type]?.length){
          const list=images.dialogs[n.type];
          n.dialogImg=list[n.dialogIdx++ % list.length];
        }
      }else n.dialogImg=null;

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
    dashTimer=DASH_DUR; player.facing=dir; sfx.dash?.play().catch(()=>{});
  }

  /* ========== Loops ========== */
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentB=null;

  function updateWorld(dt){
    let vx=0;
    const base=MOVE_SPEED*(player.onGround || dashTimer>0 ? 1 : AIR_SPEED_MULT);

    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*base*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=base; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=base; player.facing='left'; }
    }
    player.x=Math.max(0, Math.min(player.x+vx*dt, worldEndX-10));

    if(mode==='world'){ if(player.onGround && Math.abs(vx)>1) footPlay(); else footStop(); }

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; }
    else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt); dashCooldown=Math.max(0,dashCooldown-dt);
    if(dropThrough>0) dropThrough=Math.max(0,dropThrough-dt);

    // Jump
    if(jumpBuf>0){
      if(player.onGround || coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; sfx.jump?.play().catch(()=>{}); }
      else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; sfx.jump?.play().catch(()=>{}); }
    }
    // Gravity
    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else player.vy=0;

    const prevFeet=GROUND_Y+player.y;
    player.y += player.vy*dt;
    if(GROUND_Y+player.y>GROUND_Y){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;

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

    // PNJ talk
    for(const n of npcs){
      const near=Math.abs(player.x-n.x)<=NPC_TALK_RADIUS;
      if(near){ n.show=true; n.hideT=0; }
      else if(n.show){ n.hideT=(n.hideT||0)+dt; if(n.hideT>=NPC_HIDE_DELAY){ n.show=false; n.dialogImg=null; n.hideT=0; } }
    }

    // Posters
    const wantsDown=keys.has('ArrowDown')||keys.has('s');
    for(const p of posters){
      const center=p.x+p.w/2, dx=Math.abs(player.x-center);
      const feetY=GROUND_Y-110+player.y;
      const over=aabb(player.x-26,feetY,52,110, p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && over && wantsDown){ p.taking=true; p.t=0; }
      if(p.taking){ p.t+=dt; if(p.t>=COLLECT_DUR){ p.taking=false; p.taken=true; postersCount++; setWanted(); sfx.wanted?.play().catch(()=>{}); if(postersCount>=POSTERS_TOTAL){ sfx.postersComplete?.play().catch(()=>{}); ensureOverlay().style.display='grid'; } } }
    }

    // Portes
    if(wantsDown && !onPlatform && dropThrough<=0){
      for(const b of buildings){
        const atDoor=(player.x>b.doorX && player.x<b.doorX+b.doorW);
        const feet=GROUND_Y+player.y, base=b.y+b.dh;
        const nearBase=Math.abs(feet-base)<280;
        if(atDoor && nearBase){
          if(b.canEnterPossible){
            const open = shouldEnterThis23(b);
            triedDoor.add(b.id);
            if(open){ b.wasOpen=true; enterInterior(b); } else { b.wasOpen=false; sfx.doorLocked?.play().catch(()=>{}); }
            break;
          } else { sfx.doorLocked?.play().catch(()=>{}); break; }
        }
      }
      if(endWall){
        if(player.x > endWall.x-20 && player.x < endWall.x+endWall.dw+20) sfx.getout?.play().catch(()=>{});
      }
    }

    // Caméra
    const W=canvas.width/DPR; cameraX=Math.max(0, player.x - W/2);
    const targetY=-player.y*0.18; camYOffset += (targetY-camYOffset)*Math.min(1,dt*8);

    // Draw
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    const yG=camYOffset, yM=camYOffset*0.5;
    if(images.back)  drawLayer(images.back,0.15,6,0);
    if(images.mid)   drawLayer(images.mid, 0.45,6,yM);
    if(images.front) drawLayer(images.front,1.00,6,yG);
    for(const b of buildings) b.animT+=dt;
    drawBuildings(yG); drawPosters(yG); drawNPCs(yG); drawMyo(vx,yG);
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
    mode='world'; if(bgm){ bgm.volume=0.6; } sfx.exit?.play().catch(()=>{});
    if(currentB){ player.x=currentB.doorX+currentB.doorW/2; player.y=0; player.vy=0; player.onGround=true; }
    currentB=null;
  }

  function updateInterior(dt){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    // >>> plus de headroom : sol plus bas, plafond reculé
    const floorY=H-16, ceilY=-60;

    let vx=0; const base=MOVE_SPEED*AIR_SPEED_MULT;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*base*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=base; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=base; player.facing='left'; }
    }
    player.x=Math.max(0,Math.min(W-60,player.x+vx*dt));

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; }
    else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt); dashCooldown=Math.max(0,dashCooldown-dt);

    if(jumpBuf>0){
      if(player.onGround||coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; sfx.jump?.play().catch(()=>{}); }
      else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; sfx.jump?.play().catch(()=>{}); }
    }
    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else player.vy=0;
    player.y += player.vy*dt;
    if(floorY+player.y>floorY){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;
    const head=floorY - MYO_H_INTERIOR + player.y; if(head<ceilY){ player.y+=(ceilY-head); player.vy=0; }

    if(player.x<=0 && !hacking){ exitInterior(); return; }

    const wantsDown=keys.has('ArrowDown')||keys.has('s');

    // Terminal LARGE : 1/2 droite & 1/2 basse
    const term={ x:Math.floor(W*0.50), y:Math.floor(H*0.50), w:Math.floor(W*0.50), h:Math.floor(H*0.50) };
    const myoH=MYO_H_INTERIOR, myoRect={ x:player.x-24, y:(floorY - myoH + player.y + INTERIOR_FOOT_EXTRA), w:48, h:myoH };
    const inTerm=aabb(myoRect.x,myoRect.y,myoRect.w,myoRect.h, term.x,term.y,term.w,term.h);

    if(!hacking && wantsDown && inTerm){ hacking=true; hackT=0; sfx.type?.play().catch(()=>{}); }
    if(hacking){
      hackT+=dt;
      if(hackT>=1.5){
        hacking=false; hackT=0; sfx.ding?.play().catch(()=>{});
        if(currentB && !hackedIds.has(currentB.id)){
          hackedIds.add(currentB.id);
          eggIndex=Math.min(10,eggIndex+1); eggs=eggIndex; setEggs();
        }
        interiorOpenIdx=Math.max(1,eggIndex); // 1→10
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
      const x=Math.floor(player.x), y=floorY - dh + player.y + INTERIOR_FOOT_EXTRA;
      ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(i2,0,0,dw,dh); } else ctx.drawImage(i2,x,y,dw,dh); ctx.restore();
    }
  }

  function loop(ts){ const dt=Math.min((ts-(loop.last||ts))/1000,1/30); loop.last=ts;
    if(!worldReady){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR); requestAnimationFrame(loop); return; }
    if(mode==='world') updateWorld(dt); else updateInterior(dt);
    requestAnimationFrame(loop);
  }

  /* ========== Boot ========== */
  async function boot(){
    startBtn.disabled=true; startBtn.textContent='Loading…';
    await loadAll();
    gate.style.display='none';
    requestAnimationFrame(loop);
  }
  function tryStart(){ startAudio(); boot(); }
  startBtn.addEventListener('click', tryStart, {once:true});
})();
