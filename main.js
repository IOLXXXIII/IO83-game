// IO83 – main.js (pack correctifs ciblés)
// - Interiors: progression 1→10 (pas de persistance ; reset à chaque chargement)
// - Toits one-way: largeur réduite de 40% côté droit + drop-through (↓) fiable
// - Porte close: SFX sur bâtiments 1 & 4 ; entrée fiable sur 2 & 3
// - Répartition: gaps plus grands, anti-overlap renforcé, zone Kaito réservée
// - PNJ: abaissés de 20% de leur hauteur pour coller visuellement au sol

(function(){
  'use strict';

  /* ==== Utils ==== */
  const rndInt=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const aabb=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
  const shuffle=a=>{ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1)|0); [a[i],a[j]]=[a[j],a[i]];} return a; };

  /* ==== Canvas ==== */
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  /* ==== Gate/HUD ==== */
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const title2=document.getElementById('title2');
  const hud=document.getElementById('hud');

  // Compteurs
  let postersCount=0, eggs=0;
  let wantedSpan=document.getElementById('scoreNum');
  if(!wantedSpan){ const d=document.createElement('div'); d.id='score'; d.innerHTML='Wanted: <span id="scoreNum">0/10</span>'; hud?.appendChild(d); wantedSpan=d.querySelector('#scoreNum'); }
  else wantedSpan.textContent='0/10';
  let eggSpan=document.getElementById('eggNum');
  if(!eggSpan){ const e=document.createElement('div'); e.id='eggs'; e.innerHTML='??? <span id="eggNum">0/10</span>'; hud?.appendChild(e); eggSpan=e.querySelector('#eggNum'); }
  else eggSpan.textContent='0/10';

  // Title blink
  let tTitle=0; (function loopTitle(){ tTitle+=0.016; if(title2){ const a=(Math.sin(tTitle*1.4)+1)/2; title2.style.opacity=(a*0.75).toFixed(3); } if(gate && gate.style.display!=='none') requestAnimationFrame(loopTitle); })();

  /* ==== Audio ==== */
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
    getout:document.getElementById('sfxGetOut'),
    postersComplete:document.getElementById('sfxPostersComplete')
  };
  const SFX_VOL=0.8; Object.values(sfx).forEach(a=>{ if(a) a.volume=Math.min(1,(a?.volume||1)*SFX_VOL); });
  if(sfx.foot) sfx.foot.volume=Math.min(1,(sfx.foot.volume||1)*0.7);
  function startAudio(){ if(bgm){ bgm.volume=0.6; bgm.currentTime=0; bgm.muted=false; bgm.play().catch(()=>{});} }
  function fadeTo(audio,target,ms=250){ if(!audio) return; const step=(target-audio.volume)/(ms/50); const id=setInterval(()=>{ audio.volume=Math.max(0,Math.min(1,audio.volume+step)); if(Math.abs(audio.volume-target)<0.02){ audio.volume=target; clearInterval(id);} },50); }

  /* ==== Camera / Parallax ==== */
  const VIEW_DEN={back:6, mid:6, front:6};
  let cameraX=0, camYOffset=0;

  /* ==== Assets ==== */
  const CB=''; // pas de cache-bust (load plus rapide après 1er cache)
  const ASSETS={
    back :'assets/background/bg_far.png'+CB,
    mid  :'assets/background/bg_mid.png'+CB,
    front:'assets/background/ground.png'+CB,
    myoIdle:[ 'assets/characters/myo/myo_idle_1.png'+CB, 'assets/characters/myo/myo_idle_2.png'+CB ],
    myoWalk:[
      'assets/characters/myo/myo_walk_1.png'+CB,'assets/characters/myo/myo_walk_2.png'+CB,
      'assets/characters/myo/myo_walk_3.png'+CB,'assets/characters/myo/myo_walk_4.png'+CB
    ],
    posterWith:'assets/collectibles/wanted_withposter.png'+CB,
    posterWithout:'assets/collectibles/wanted_withoutposter.png'+CB,
    npcs:{
      aeron:     ['assets/characters/aeron/aeron_idle_1.png'+CB,'assets/characters/aeron/aeron_idle_2.png'+CB],
      kaito:     ['assets/characters/kaito/kaito_idle_1.png'+CB,'assets/characters/kaito/kaito_idle_2.png'+CB],
      maonis:    ['assets/characters/maonis/maonis_idle_1.png'+CB,'assets/characters/maonis/maonis_idle_2.png'+CB],
      kahikoans: ['assets/characters/kahikoans/kahikoans_idle_1.png'+CB,'assets/characters/kahikoans/kahikoans_idle_2.png'+CB]
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
    dashTrail:[ 'assets/fx/dash_trail_1.png'+CB,'assets/fx/dash_trail_2.png'+CB,'assets/fx/dash_trail_3.png'+CB ],
    interiorClosedIdle:[ 'assets/interiors/interior_closed_idle_1.png'+CB, 'assets/interiors/interior_closed_idle_2.png'+CB ],
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
  function loadImg(src){ return new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; }); }

  /* ==== Ground align ==== */
  let GROUND_SRC_OFFSET=parseInt(localStorage.getItem('GROUND_SRC_OFFSET')||'18',10);
  let GROUND_Y=560;
  function recalcGround(){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const scale=(VIEW_DEN.front*W)/images.front.width;
      const groundFromBottom=Math.round(GROUND_SRC_OFFSET*scale);
      GROUND_Y = H - groundFromBottom;
    }
  }

  /* ==== Physique / Player ==== */
  const SPEED_MULT = 1.2 * 1.15;
  const MOVE_SPEED = 360 * SPEED_MULT;
  const AIR_SPEED_MULT = 1.2;
  const MYO_H = 120 * 1.5;
  const MYO_H_INTERIOR = Math.round(MYO_H*1.7);
  const INTERIOR_FOOT_EXTRA = Math.round(MYO_H_INTERIOR/6);
  const PLAYER_HALF_W=26;

  const GRAVITY_UP=2600, GRAVITY_DOWN=2600*2.2;
  const TARGET_JUMP_HEIGHT=200;
  const JUMP_VELOCITY=Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);

  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  // Dash
  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOLDOWN_GROUND=0.6, DASH_COOLDOWN_AIR=0.28, DASH_MULT=4;
  let lastTapL=-999, lastTapR=-999, dashTimer=0, dashCooldown=0, airDashUsed=0;

  // Drop-through toits
  let onPlatform=false, dropThrough=0;
  let downPressedEdge=false;

  // Input
  const keys=new Set();
  addEventListener('keydown',e=>{
    if(!worldReady || (mode!=='world' && mode!=='interior')) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s','[',']'].includes(e.key)) e.preventDefault();
    if(e.repeat){ keys.add(e.key); return; }
    keys.add(e.key);
    if(e.key==='ArrowDown'||e.key==='s') downPressedEdge=true;
    if(e.key==='ArrowUp'||e.key==='w') jumpBuf=JUMP_BUFFER;
    const t=performance.now()/1000;
    if(e.key==='ArrowRight'||e.key==='d'){ if(t-lastTapR<=DASH_WINDOW) tryDash('right'); lastTapR=t; }
    if(e.key==='ArrowLeft' ||e.key==='a'){ if(t-lastTapL<=DASH_WINDOW) tryDash('left');  lastTapL=t; }
  });
  addEventListener('keyup',e=>{ if(!worldReady) return; keys.delete(e.key); });

  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0 };

  /* ==== Footsteps ==== */
  let footArmed=false;
  function playFoot(){ const a=sfx.foot; if(!a) return;
    if(!footArmed && a.readyState>=2){ const d=a.duration||15; a.currentTime=Math.random()*Math.max(1,d-1); footArmed=true; }
    a.playbackRate=0.96+Math.random()*0.08; if(a.paused) a.play().catch(()=>{});
  }
  function stopFoot(){ const a=sfx.foot; if(a && !a.paused) a.pause(); }

  /* ==== Posters ==== */
  const POSTERS_TOTAL=10;
  const POSTER_SIZE=Math.round(100*1.2);
  const COLLECT_RADIUS=76, COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  let postersOverlay=null;
  function ensurePostersOverlay(){
    if(postersOverlay) return postersOverlay;
    const wrap=document.createElement('div');
    Object.assign(wrap.style,{position:'fixed',inset:'0',display:'none',placeItems:'center',background:'rgba(0,0,0,.6)',zIndex:'9998'});
    const panel=document.createElement('div');
    Object.assign(panel.style,{position:'relative',padding:'16px',background:'#111',border:'2px solid #444',borderRadius:'12px'});
    const img=document.createElement('img'); img.alt='Completed'; img.style.maxWidth='min(80vw,800px)'; img.style.maxHeight='70vh'; img.style.imageRendering='pixelated';
    img.src=ASSETS.postersCompletePNG.split('?')[0];
    const btn=document.createElement('button'); btn.textContent='Close';
    Object.assign(btn.style,{display:'block',margin:'12px auto 0',padding:'8px 16px',cursor:'pointer',background:'#1b1b1b',color:'#fff',border:'1px solid #555',borderRadius:'8px'});
    btn.onclick=()=>{ wrap.style.display='none'; };
    panel.appendChild(img); panel.appendChild(btn); wrap.appendChild(panel); document.body.appendChild(wrap);
    postersOverlay=wrap; return wrap;
  }

  /* ==== Buildings / NPC / World ==== */
  const BUILDING_TARGET_H=Math.round(450*1.15);
  const VILLAGE_MIN=2, VILLAGE_MAX=3;
  const VILLAGE_GAP_MIN=Math.round(600), VILLAGE_GAP_MAX=Math.round(1200); // plus étalé
  const buildings=[]; let nextBuildingId=1;
  let worldEndX=20000; let endWall=null;

  // Toit one-way: mi-hauteur ; largeur gauche conservée, côté droit raccourci -40%
  function makeRoof(bx,by,dw,dh){
    const y = by + Math.round(dh*0.50);
    const fullW = Math.round(dw*0.92 * (2/3));
    const leftEdge = bx + Math.round((dw - fullW)/2);
    const cutRight = Math.round(fullW * 0.40);
    const newW = Math.max(24, fullW - cutRight);
    return {x:leftEdge, y, w:newW, h:12}; // gauche identique, droite réduite
  }

  const NPC_H=300, NPC_TALK_RADIUS=160, NPC_HIDE_DELAY=1.0;
  const npcs=[];

  /* ==== Progression interiors – SANS persistance ==== */
  let eggIndex=0; // 0→10 durant cette session
  const hackedIds=new Set();
  eggSpan.textContent=`${eggIndex}/10`;

  /* ==== Helpers ==== */
  function buildingCenters(){ return buildings.map((b,idx)=>({idx, x:b.x + Math.round(b.dw/2)})); }
  function pickBuildingIndices(minGap,maxGap,count,startIdxMin=0){
    const centers=buildingCenters(); const idxs=centers.map(c=>c.idx);
    const picked=[]; let last=-9999; let tries=0;
    while(picked.length<count && tries<4000){
      tries++; const cand = idxs[rndInt(0,idxs.length-1)];
      if(cand<startIdxMin) continue;
      if(picked.includes(cand)) continue;
      if(Math.abs(cand - last) < rndInt(minGap,maxGap)) continue;
      picked.push(cand); last=cand;
    }
    picked.sort((a,b)=>a-b);
    return picked.map(i=>centers[i]);
  }
  function nonOverlapShiftX(x, extra=0){
    let moved=true, guard=0;
    while(moved && guard++<220){
      moved=false;
      for(const b of buildings){
        const c=b.x+b.dw/2; const minGap=b.dw/2 + 420 + extra;
        if(Math.abs(x-c)<minGap){ x = c + (x<c? -minGap : minGap); moved=true; }
      }
      for(const p of posters){ if(Math.abs(x-p.x)<(520+extra)){ x = p.x + (560+extra); moved=true; } }
      for(const n of npcs){ if(Math.abs(x-n.x)<(600+extra)){ x = n.x + (640+extra); moved=true; } }
    }
    return x;
  }

  /* ==== Load & Spawn ==== */
  let worldReady=false;

  async function loadAll(){
    const L=async s=>await loadImg(s);

    images.back  = await L(ASSETS.back);
    images.mid   = await L(ASSETS.mid);
    images.front = await L(ASSETS.front);
    for(const s of ASSETS.myoIdle) images.myoIdle.push(await L(s));
    for(const s of ASSETS.myoWalk) images.myoWalk.push(await L(s));
    images.posterWith    = await L(ASSETS.posterWith);
    images.posterWithout = await L(ASSETS.posterWithout);

    for(const k of Object.keys(ASSETS.npcs))
      for(const s of ASSETS.npcs[k]) images.npcs[k].push(await L(s));

    try{
      const r=await fetch(ASSETS.dialogsManifest); const mf=await r.json();
      for(const k of ['aeron','kaito','maonis','kahikoans']){
        const list=mf[k]||[]; for(const name of list){
          const p=`assets/ui/dialogs/${k}/${name}${CB}`; const i=await loadImg(p); if(i) (images.dialogs[k]??=[]).push(i);
        }
      }
    }catch{}

    for(const [a,b,id] of ASSETS.buildings){ images.buildings.push([await L(a), (await L(b))||null, id]); }
    { const ka=await L(ASSETS.buildingKaito[0]); const kb=ka? await L(ASSETS.buildingKaito[1]) : null; images.buildingKaito = ka ? [ka, kb||ka] : null; }
    { const wa=await L(ASSETS.buildingWall[0]); const wb=wa? await L(ASSETS.buildingWall[1]) : null; images.buildingWall = wa ? [wa, wb||wa] : null; }
    for(const s of ASSETS.dashTrail){ const i=await L(s); if(i) images.dashTrail.push(i); }
    for(const s of ASSETS.interiorClosedIdle){ const i=await L(s); if(i) images.interiorClosedIdle.push(i); }
    for(const s of ASSETS.interiorOpens){ const i=await L(s); if(i) images.interiorOpens.push(i); }
    images.postersComplete = await loadImg(ASSETS.postersCompletePNG);

    recalcGround();
    seedPosters10();
    spawnVillages();
    spawnNPCsOnce();
    placePostersNonOverlap();
    ensureAtLeastEnterable(10);
    computeWorldEnd();
    spawnEndWall();
    ensurePostersOverlay();

    worldReady=true;
  }

  function seedPosters10(){
    posters.length=0;
    let x=1400;
    for(let i=0;i<10;i++){ x += rndInt(1200,1900); posters.push({x,y:0,w:POSTER_SIZE,h:POSTER_SIZE,taking:false,t:0,taken:false}); }
  }

  function spawnVillages(){
    buildings.length=0;
    const startX=1400, endX=(posters.at(-1)?.x||13000)+3200;
    let x=startX;
    while(x<endX){
      const count=(Math.random()<0.65)? rndInt(VILLAGE_MIN,VILLAGE_MAX):1;
      for(let i=0;i<count;i++){
        const pair=images.buildings[rndInt(0,images.buildings.length-1)]; if(!pair||!pair[0]) continue;
        const [im1,im2,typeId]=pair; const canEnter=(typeId===2||typeId===3);
        const s=BUILDING_TARGET_H/im1.height, dw=Math.round(im1.width*s), dh=Math.round(im1.height*s);
        const bx=x, by=GROUND_Y-dh; const roof=makeRoof(bx,by,dw,dh);
        buildings.push({id:nextBuildingId++, typeId, canEnter, frames:[im1,im2||im1], animT:0, x:bx,y:by,dw,dh,doorX:bx,doorW:dw, roof});
        x += dw + rndInt(28,64);
      }
      x += rndInt(VILLAGE_GAP_MIN, VILLAGE_GAP_MAX);
    }
  }

  function spawnNPCsOnce(){
    npcs.length=0; const centers=buildingCenters(); if(!centers.length) return;
    const GAP_MIN=6, GAP_MAX=12;

    // Aeron (1)
    for(const c of pickBuildingIndices(GAP_MIN,GAP_MAX,1,3)) placeNPC('aeron', nonOverlapShiftX(c.x,300));

    // Kaito + vaisseau à sa gauche + zone réservée
    const firstX = buildings[0]?.x || 1400;
    let kaitoX = Math.max((pickBuildingIndices(GAP_MIN,GAP_MAX,1,12)[0]?.x||firstX+7500), firstX+6500);
    kaitoX = nonOverlapShiftX(kaitoX,1200);
    placeNPC('kaito', kaitoX, true);
    reserveKaitoZone(kaitoX, 1600);

    // Maonis (2)
    for(const c of pickBuildingIndices(GAP_MIN,GAP_MAX,2,5)) placeNPC('maonis', nonOverlapShiftX(c.x,300));

    // Kahi Koans (3)
    for(const c of pickBuildingIndices(GAP_MIN,GAP_MAX,3,4)) placeNPC('kahikoans', nonOverlapShiftX(c.x,300));
  }

  function placeNPC(type, x, withShip=false){
    x = nonOverlapShiftX(x,300);
    const frames=images.npcs[type]; if(!frames?.length) return;
    const list = images.dialogs[type]?.slice()||[]; shuffle(list);
    const npc={type, x, frames, animT:0, face:'right', show:false, hideT:0, dialogImg:null, dialogList:list, dialogIdx:0};
    npcs.push(npc);

    if(withShip && images.buildingKaito){
      const base=images.buildingKaito[0], s=BUILDING_TARGET_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      let bx = x - (dw + 180), by=GROUND_Y-dh;
      const minBX=(buildings[0]?.x||1400)+5600; if(bx<minBX) bx=minBX;
      let moved=true, guard=0;
      while(moved && guard++<150){
        moved=false;
        for(const b of buildings){
          if(!(bx+dw < b.x-100 || bx > b.x+b.dw+100)){ bx = b.x - dw - 160; moved=true; }
        }
      }
      buildings.push({id:nextBuildingId++, typeId:98, canEnter:false, frames:[images.buildingKaito[0],images.buildingKaito[1]||images.buildingKaito[0]],
        animT:0, x:bx,y:by,dw,dh,doorX:bx,doorW:dw, roof:makeRoof(bx,by,dw,dh)});
    }
  }

  function reserveKaitoZone(cx, radius){
    const L=cx-radius, R=cx+radius;
    for(const b of buildings){
      if(b.typeId===98) continue;
      if(!(b.x+b.dw<L || b.x>R)){ const shift = (R - (b.x+b.dw)) + 320; b.x+=shift; b.doorX+=shift; b.roof.x+=shift; }
    }
    for(const p of posters){ if(p.x>L && p.x<R) p.x = R + 500; }
    for(const n of npcs){ if(n.type!=='kaito' && n.x>L && n.x<R) n.x = R + 900; }
  }

  function placePostersNonOverlap(){
    for(const p of posters){
      for(const b of buildings){ const L=b.x-540, R=b.x+b.dw+540; if(p.x>L && p.x<R) p.x = R + rndInt(120,260); }
      for(const n of npcs){ if(Math.abs(p.x-n.x)<560) p.x = n.x + 620; }
      p.y = GROUND_Y - POSTER_SIZE;
    }
    posters.sort((a,b)=>a.x-b.x);
    for(let i=1;i<posters.length;i++) if(posters[i].x - posters[i-1].x < 700) posters[i].x = posters[i-1].x + 700;
  }

  function ensureAtLeastEnterable(minCount){
    const enterables = buildings.filter(b=>b.canEnter);
    if(enterables.length>=minCount) return;
    const c = buildings.filter(b=>!b.canEnter && b.typeId!==98).sort((a,b)=>b.dw-a.dw);
    for(let i=0;i<minCount-enterables.length && i<c.length; i++) c[i].canEnter=true;
  }

  function computeWorldEnd(){
    const maxB = Math.max(...buildings.map(b=>b.x+b.dw), 0);
    const maxP = Math.max(...posters.map(p=>p.x+p.w), 0);
    const maxN = Math.max(...npcs.map(n=>n.x+200), 0);
    worldEndX = Math.max(maxB, maxP, maxN) + 1600;
  }

  function spawnEndWall(){
    if(!images.buildingWall) return;
    const base=images.buildingWall[0]; if(!base) return;
    const screenH=canvas.height/DPR;
    const targetH=Math.round(screenH * 1.25 * 0.85);
    const s=targetH/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
    const x = worldEndX - 800; const y = GROUND_Y - dh;
    endWall = {frames:images.buildingWall, animT:0, x, y, dw, dh};
    worldEndX = endWall.x - 8;
  }

  /* ==== Movement / Dash ==== */
  function tryDash(dir){
    if(dashCooldown>0) return;
    if(!player.onGround){
      const maxDashes = 1 + (airJumpsUsed > 0 ? 1 : 0);
      if(airDashUsed >= maxDashes) return;
      airDashUsed++; dashCooldown = DASH_COOLDOWN_AIR;
    }else{ airDashUsed=0; dashCooldown = DASH_COOLDOWN_GROUND; }
    dashTimer=DASH_DUR; player.facing=dir; sfx.dash?.play().catch(()=>{});
  }

  /* ==== Draw ==== */
  function drawLayer(img,f,den,yParallax=0){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(H-dh) + yParallax;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(runVel, yOff, hOverride=null){
    const frames=(Math.abs(runVel)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(runVel)>1e-2?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0]; if(!img) return;
    const H = hOverride || MYO_H;
    const s=H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const x=Math.floor(player.x - cameraX), y=GROUND_Y - dh + player.y + yOff;

    if(dashTimer>0 && images.dashTrail.length){
      const tIdx=Math.floor(player.animTime*9)%images.dashTrail.length;
      const ti=images.dashTrail[tIdx]; ctx.save();
      if(player.facing==='left'){ ctx.translate(x+dw/2-16,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); }
      else ctx.translate(x-16,y);
      ctx.globalAlpha=0.85; ctx.drawImage(ti,0,0,dw,dh); ctx.restore();
    }
    ctx.save();
    if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
    else ctx.drawImage(img,x,y,dw,dh);
    ctx.restore();
  }
  function drawPosters(yOff){
    for(const p of posters){
      const sx=p.x - cameraX; if(sx<-1400 || sx>canvas.width/DPR+1400) continue;
      let sy=p.y + yOff; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      const sprite=p.taken ? images.posterWithout : images.posterWith;
      if(sprite) ctx.drawImage(sprite, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
    }
  }
  function drawBuildings(yOff){
    for(const b of buildings){
      const sx=Math.floor(b.x - cameraX); if(sx<-2200 || sx>canvas.width/DPR+2200) continue;
      const frame=(Math.floor(b.animT*2)%2===0)? b.frames[0]:(b.frames[1]||b.frames[0]);
      if(frame) ctx.drawImage(frame, sx, b.y + yOff, b.dw, b.dh);
    }
  }
  function drawNPCs(yOff){
    for(const n of npcs){
      const base=n.frames[0]; if(!base) continue;
      const s=NPC_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      // Abaissement visuel de 20% de la hauteur (pour compenser l'espace vide PNG)
      const LOWER = Math.round(dh*0.20);
      const sy = (GROUND_Y + yOff) - dh + LOWER;
      const sx=Math.floor(n.x - cameraX);
      if(player.x < n.x) n.face='left'; else if(player.x > n.x) n.face='right';
      const idx=(Math.floor(n.animT*2)%2); const img=n.frames[Math.min(idx,n.frames.length-1)]||base;

      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

      if(n.show){
        if(!n.dialogList || n.dialogList.length===0) n.dialogImg=null;
        if(!n.dialogImg && n.dialogList && n.dialogList.length){ const imgD=n.dialogList[n.dialogIdx % n.dialogList.length]; n.dialogIdx++; n.dialogImg=imgD; }
      } else n.dialogImg=null;
      if(n.show && n.dialogImg){
        const scale=0.6, bw=n.dialogImg.width*scale, bh=n.dialogImg.height*scale;
        const bx = sx + Math.round(dw/2 - bw*1.0);
        const by = sy - Math.round(bh*0.5);
        ctx.drawImage(n.dialogImg, bx, by, bw, bh);
      }
      n.animT += 1/60;
    }
  }
  function drawEndWall(yOff){
    if(!endWall) return; const frame=(Math.floor(endWall.animT*2)%2===0)? endWall.frames[0]:(endWall.frames[1]||endWall.frames[0]);
    const sx=Math.floor(endWall.x - cameraX); if(frame) ctx.drawImage(frame, sx, endWall.y + yOff, endWall.dw, endWall.dh);
  }

  /* ==== World loop ==== */
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentBuilding=null;

  function updateWorld(dt){
    let vx=0;
    const baseSpeed = MOVE_SPEED * (player.onGround || dashTimer>0 ? 1 : AIR_SPEED_MULT);

    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*baseSpeed*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=baseSpeed; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=baseSpeed; player.facing='left'; }
    }
    const nextX = player.x + vx*dt;
    player.x = Math.max(0, Math.min(nextX, worldEndX-10));

    if(player.onGround && Math.abs(vx)>1) playFoot(); else stopFoot();

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
    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else { player.vy=0; }

    const prevFeetY = GROUND_Y + player.y;
    player.y += player.vy*dt;

    // sol
    if(GROUND_Y + player.y > GROUND_Y){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;

    // Détecte si posé sur un toit (pour autoriser drop-through)
    onPlatform=false;
    for(const b of buildings){
      const feet = GROUND_Y + player.y;
      if(feet>=b.roof.y && feet<=b.roof.y+14){
        const withinX = (player.x + PLAYER_HALF_W > b.roof.x) && (player.x - PLAYER_HALF_W < b.roof.x + b.roof.w);
        if(withinX && player.onGround){ onPlatform=true; break; }
      }
    }
    if(downPressedEdge && onPlatform){ dropThrough=0.35; player.y+=4; } // lâche le toit

    // roofs one-way (ignorer si dropThrough actif)
    if(dropThrough<=0){
      for(const b of buildings){
        const feetY = GROUND_Y + player.y;
        const top   = b.roof.y;
        const withinX = (player.x + PLAYER_HALF_W > b.roof.x) && (player.x - PLAYER_HALF_W < b.roof.x + b.roof.w);
        const wasAbove = (prevFeetY <= top + 4);
        const crossingDown = (player.vy>=0) && wasAbove && (feetY >= top);
        const nearTop = (feetY>=top && feetY<=top+16 && player.vy>=0);
        if( withinX && (crossingDown || nearTop) ){
          player.y += (top - feetY);
          player.vy=0; player.onGround=true;
          break;
        }
      }
    }

    // PNJ talk on/off
    for(const n of npcs){
      const near = Math.abs(player.x - n.x) <= NPC_TALK_RADIUS;
      if(near){ n.show=true; n.hideT=0; }
      else if(n.show){
        n.hideT = (n.hideT||0) + dt; if(n.hideT>=NPC_HIDE_DELAY){ n.show=false; n.dialogImg=null; n.hideT=0; }
      }
    }

    // Posters
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    for(const p of posters){
      const center=p.x + p.w/2, dx=Math.abs(player.x - center);
      const feetY=GROUND_Y-110+player.y;
      const overY=aabb(player.x-26, feetY, 52,110, p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && overY && wantsCollect){ p.taking=true; p.t=0; }
      if(p.taking){ p.t+=dt; if(p.t>=COLLECT_DUR){ p.taking=false; p.taken=true;
          postersCount++; wantedSpan.textContent=`${postersCount}/${POSTERS_TOTAL}`; sfx.wanted?.play().catch(()=>{});
          if(postersCount>=POSTERS_TOTAL){ sfx.postersComplete?.play().catch(()=>{}); ensurePostersOverlay().style.display='grid'; }
      }}
    }

    // Portes (toute largeur, sans exiger onGround strict)
    if(wantsCollect){
      for(const b of buildings){
        const atDoor = (player.x>b.doorX && player.x<b.doorX+b.doorW);
        const feet = GROUND_Y + player.y;
        const base = b.y + b.dh;
        const nearGround = Math.abs(feet - base) < 280;
        if(atDoor && nearGround){
          if(b.canEnter){ enterInterior(b); break; }
          else sfx.getout?.play().catch(()=>{}); // porte close
        }
      }
      if(endWall && (player.x > endWall.x - 100)) sfx.getout?.play().catch(()=>{});
    }

    // Caméra
    const W=canvas.width/DPR; cameraX=Math.max(0, player.x - W/2);
    const targetYOffset = -player.y * 0.18;
    camYOffset += (targetYOffset - camYOffset) * Math.min(1, dt*8);

    // Draw
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);

    const yGround = camYOffset;
    const yMid    = camYOffset * 0.5;

    if(images.back)  drawLayer(images.back, 0.15, 6, 0);
    if(images.mid)   drawLayer(images.mid,  0.45, 6, yMid);
    if(images.front) drawLayer(images.front,1.00, 6, yGround);

    for(const b of buildings) b.animT+=dt;
    drawBuildings(yGround); drawPosters(yGround); drawNPCs(yGround); drawMyo(vx, yGround);
    if(endWall){ endWall.animT+=dt; drawEndWall(yGround); }

    downPressedEdge=false;
  }

  /* ==== Interior ==== */
  function enterInterior(b){
    mode='interior'; currentBuilding=b; cameraX=0; stopFoot();
    if(bgm) fadeTo(bgm,0.12,250);
    interiorOpenIdx=0; hacking=false; hackT=0;
    player.x=60; player.y=12; player.vy=0; player.onGround=true; player.facing='right';
  }
  function exitInterior(){
    mode='world';
    if(bgm) fadeTo(bgm,0.6,250);
    sfx.exit?.play().catch(()=>{});
    if(currentBuilding){ player.x=currentBuilding.doorX + currentBuilding.doorW/2; player.y=0; player.vy=0; player.onGround=true; }
    currentBuilding=null;
  }

  function updateInterior(dt){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const floorY = H - 40, ceilY = 0;

    let vx=0;
    const baseSpeed = MOVE_SPEED * AIR_SPEED_MULT;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*baseSpeed*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=baseSpeed; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=baseSpeed; player.facing='left'; }
    }
    player.x=Math.max(0, Math.min(W-60, player.x + vx*dt));

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; }
    else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt); dashCooldown=Math.max(0,dashCooldown-dt);

    if(jumpBuf>0){
      if(player.onGround || coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; sfx.jump?.play().catch(()=>{}); }
      else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; sfx.jump?.play().catch(()=>{}); }
    }
    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else { player.vy=0; }
    player.y += player.vy*dt;

    if(floorY + player.y > floorY){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;
    const headY = floorY - MYO_H_INTERIOR + player.y;
    if(headY<ceilY){ player.y+=(ceilY-headY); player.vy=0; }

    if(player.x<=0 && !hacking){ exitInterior(); return; }

    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const termRect={ x:Math.floor(W*0.75), y:Math.floor(H*0.5), w:Math.floor(W*0.25), h:Math.floor(H*0.5) };
    const myoW=48, myoH=MYO_H_INTERIOR;
    const myoRect={ x:player.x-24, y:(floorY - myoH + player.y + INTERIOR_FOOT_EXTRA), w:myoW, h:myoH };
    const inTerm = aabb(myoRect.x,myoRect.y,myoRect.w,myoRect.h, termRect.x,termRect.y,termRect.w,termRect.h);

    if(!hacking && wantsCollect && inTerm){ hacking=true; hackT=0; sfx.type?.play().catch(()=>{}); }
    if(hacking){
      hackT+=dt;
      if(hackT>=1.5){
        hacking=false; hackT=0; sfx.ding?.play().catch(()=>{});
        if(currentBuilding && !hackedIds.has(currentBuilding.id)){
          hackedIds.add(currentBuilding.id);
          eggIndex = Math.min(10, eggIndex+1);     // 1→10 strict (session)
          eggs = eggIndex; eggSpan.textContent = `${eggs}/10`;
        }
        interiorOpenIdx = Math.max(1, eggIndex);   // affiche open_1 après 1er hack, puis 2, etc.
      }
    }

    // Draw interior
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);

    if(interiorOpenIdx===0){
      const frames=images.interiorClosedIdle;
      const idx=frames.length>1 ? Math.floor(player.animTime*2)%frames.length : 0;
      const img=frames[idx]||frames[0]; if(img) ctx.drawImage(img,0,0,W,H);
    }else{
      const base=images.interiorOpens[Math.min(9,interiorOpenIdx-1)];
      if(base) ctx.drawImage(base,0,0,W,H);
    }

    // Myo agrandi et abaissé
    const frames2=(Math.abs(vx)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(vx)>1e-2?8:4);
    const idx2=frames2.length>1 ? Math.floor(player.animTime*fps)%frames2.length : 0;
    const img2=frames2[idx2]||images.myoIdle[0];
    if(img2){
      const s=MYO_H_INTERIOR/img2.height, dw=Math.round(img2.width*s), dh=Math.round(img2.height*s);
      const x=Math.floor(player.x), y=floorY - dh + player.y + INTERIOR_FOOT_EXTRA;
      ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img2,0,0,dw,dh); } else ctx.drawImage(img2,x,y,dw,dh); ctx.restore();
    }
  }

  /* ==== Loop ==== */
  function loop(ts){ const dt=Math.min((ts - (loop.last||ts))/1000, 1/30); loop.last=ts;
    if(!worldReady){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width/DPR,canvas.height/DPR); requestAnimationFrame(loop); return; }
    if(mode==='world') updateWorld(dt); else updateInterior(dt);
    requestAnimationFrame(loop);
  }

  /* ==== Start ==== */
  async function startGame(){
    startBtn.disabled=true; startBtn.textContent='Loading…';
    await loadAll(); gate.style.display='none'; requestAnimationFrame(loop);
  }
  startBtn.addEventListener('click', ()=>{ startAudio(); startGame(); }, {once:true});

})();
