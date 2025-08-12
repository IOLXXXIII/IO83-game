// IO83 – main.js (distribution homogène, portes 2&3 seulement (10 maisons), drop-through fiable, Kaito groupé, mur fin OK)
// Remplace entièrement.

(function(){
  'use strict';

  /* ---------- Utils ---------- */
  const rnd=(a,b)=>Math.random()*(b-a)+a;
  const rint=(a,b)=>Math.floor(rnd(a,b+1));
  const aabb=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;

  /* ---------- Canvas ---------- */
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  /* ---------- HUD / Gate ---------- */
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const hud=document.getElementById('hud');

  let postersCount=0, eggs=0;
  const scoreEl=document.getElementById('scoreNum')||document.querySelector('#scoreNum');
  const eggHost=(()=>{ let e=document.getElementById('eggNum'); if(!e){ const box=document.createElement('div'); box.id='eggs'; box.innerHTML='??? <span id="eggNum">0/10</span>'; hud.appendChild(box); e=box.querySelector('#eggNum'); } return e; })();
  const setWanted=()=>{ if(scoreEl) scoreEl.textContent=`${postersCount}/10`; };
  const setEggs=()=>{ eggHost.textContent=`${eggs}/10`; };
  setWanted(); setEggs();

  /* ---------- Audio ---------- */
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
  Object.values(sfx).forEach(a=>{ if(a) a.volume=(a===bgm?1:0.8)*(a?.volume||1); });
  if(sfx.foot) sfx.foot.volume=0.7;
  const startAudio=()=>{ if(bgm){ bgm.muted=false; bgm.volume=0.6; bgm.currentTime=0; bgm.play().catch(()=>{});} };

  /* ---------- Parallax / Ground ---------- */
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

  /* ---------- Assets ---------- */
  const CB=''; // pas de cache-bust (chargements suivants rapides)
  const ASSETS={
    back :'assets/background/bg_far.png'+CB,
    mid  :'assets/background/bg_mid.png'+CB,
    front:'assets/background/ground.png'+CB,
    myoIdle:['assets/characters/myo/myo_idle_1.png'+CB,'assets/characters/myo/myo_idle_2.png'+CB],
    myoWalk:['assets/characters/myo/myo_walk_1.png'+CB,'assets/characters/myo/myo_walk_2.png'+CB,'assets/characters/myo/myo_walk_3.png'+CB,'assets/characters/myo/myo_walk_4.png'+CB],
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

  /* ---------- Player / Physique ---------- */
  const MOVE_SPEED=360*1.2*1.15, AIR_SPEED_MULT=1.2;
  const MYO_H=120*1.5, MYO_H_INTERIOR=Math.round(MYO_H*1.7), INTERIOR_FOOT_EXTRA=Math.round(MYO_H_INTERIOR/6);
  const PLAYER_HALF_W=26;
  const GRAVITY_UP=2600, GRAVITY_DOWN=2600*2.2, TARGET_JUMP_HEIGHT=200;
  const JUMP_VELOCITY=Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);
  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  // Dash (double-tap)
  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOL_G=0.6, DASH_COOL_A=0.28, DASH_MULT=4;
  let lastTapL=-999,lastTapR=-999,dashTimer=0,dashCooldown=0,airDashUsed=0;

  // Toits
  let onPlatform=false, dropThrough=0;
  let downPressedEdge=false;

  const keys=new Set();
  addEventListener('keydown',e=>{
    if(!worldReady || (mode!=='world' && mode!=='interior')) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(e.key)) e.preventDefault();
    if(e.repeat){ keys.add(e.key); return; }
    keys.add(e.key);
    if(e.key==='ArrowDown'||e.key==='s') downPressedEdge=true;
    if(e.key==='ArrowUp'||e.key==='w') jumpBuf=JUMP_BUFFER;
    const t=performance.now()/1000;
    if(e.key==='ArrowRight'||e.key==='d'){ if(t-lastTapR<=DASH_WINDOW) tryDash('right'); lastTapR=t; }
    if(e.key==='ArrowLeft' ||e.key==='a'){ if(t-lastTapL<=DASH_WINDOW) tryDash('left');  lastTapL=t; }
  });
  addEventListener('keyup',e=>{ if(!worldReady) return; keys.delete(e.key); });

  const player={x:0,y:0,vy:0,onGround:true,facing:'right',state:'idle',animTime:0};

  // Footsteps
  const foot=()=>{ const a=sfx.foot; if(!a) return; if(a.paused) a.play().catch(()=>{}); a.playbackRate=0.96+Math.random()*0.08; };
  const footStop=()=>{ const a=sfx.foot; if(a && !a.paused) a.pause(); };

  /* ---------- Posters (10 réparties) ---------- */
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

  /* ---------- World content ---------- */
  const BUILDING_TARGET_H=Math.round(450*1.15);
  const VILLAGE_MIN=2,VILLAGE_MAX=3;
  const VILLAGE_GAP_MIN=600,VILLAGE_GAP_MAX=1200; // étalé
  const buildings=[]; let nextBId=1;
  let worldStartX=1400, worldEndX=20000;
  let endWall=null;

  // Toit: mi-hauteur, 92%*2/3 en largeur, côté droit −40%
  function makeRoof(bx,by,dw,dh){
    const y=by+Math.round(dh*0.50);
    const fullW=Math.round(dw*0.92*(2/3));
    const left=bx+Math.round((dw-fullW)/2);
    const cutR=Math.round(fullW*0.40);
    const w=Math.max(24, fullW-cutR);
    return {x:left, y, w, h:12};
  }

  const NPC_H=300, NPC_LOWER=0.20; // baisse visuelle 20%
  const npcs=[];

  // Eggs progression (session-only)
  let eggIndex=0; const hackedIds=new Set(); eggs=eggIndex; setEggs();

  /* ---------- Load ---------- */
  let worldReady=false;
  async function loadAll(){
    const L=async s=>await loadImg(s);
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
    images.postersComplete = await loadImg(ASSETS.postersCompletePNG);

    recalcGround();
    buildWorld();
    worldReady=true;
  }

  /* ---------- Build world (répartition homogène) ---------- */
  function buildWorld(){
    // 1) VILLAGES
    buildings.length=0;
    let x=worldStartX, endTarget=worldStartX+16000;
    while(x<endTarget){
      const count=(Math.random()<0.65)? rint(VILLAGE_MIN,VILLAGE_MAX):1;
      for(let i=0;i<count;i++){
        const [im1,im2,typeId]=images.buildings[rint(0,images.buildings.length-1)];
        const s=BUILDING_TARGET_H/im1.height, dw=Math.round(im1.width*s), dh=Math.round(im1.height*s);
        const bx=x, by=GROUND_Y-dh;
        const roof=makeRoof(bx,by,dw,dh);
        buildings.push({id:nextBId++, typeId, frames:[im1,im2||im1], animT:0, x:bx,y:by,dw,dh,roof,doorX:bx,doorW:dw, canEnter:false});
        x += dw + rint(28,64);
      }
      x += rint(VILLAGE_GAP_MIN,VILLAGE_GAP_MAX);
    }

    // 2) CHOIX DES MAISONS OUVRABLES = types 2 & 3, EXACTEMENT 10, réparties
    const enterables = buildings.filter(b=>b.typeId===2||b.typeId===3).sort((a,b)=>a.x-b.x);
    // reset tout fermé
    for(const b of enterables) b.canEnter=false;
    const wanted=10;
    if(enterables.length){
      for(let i=0;i<wanted;i++){
        const idx=Math.floor((i+0.5)*enterables.length/wanted); const b=enterables[Math.min(idx,enterables.length-1)];
        if(b) b.canEnter=true;
      }
    }

    // 3) NPCs – segmentation régulière (Aeron x1, Maonis x2, Kahi x3), Kaito dédié
    npcs.length=0;
    const worldMin=buildings[0]?.x||worldStartX, worldMax=buildings.at(-1)?.x+buildings.at(-1)?.dw||x;
    const span=worldMax-worldMin;
    const placeSegmented=(type,count,avoidL=0,avoidR=0)=>{
      for(let i=0;i<count;i++){
        const target = worldMin + ((i+1)/(count+1))*span;
        let px = target + rint(-400,400);
        px = nonOverlapShiftX(px,600,avoidL,avoidR);
        npcs.push(makeNPC(type, px));
      }
    };
    placeSegmented('aeron',1);
    placeSegmented('maonis',2);
    placeSegmented('kahikoans',3);

    // Kaito + vaisseau avant lui (à sa gauche), loin du début
    const kaitoTarget = worldMin + span*0.65 + rint(-300,300);
    let kaitoX = nonOverlapShiftX(kaitoTarget,1200);
    placeKaitoWithShip(kaitoX);

    // 4) POSTERS (10) – segmentation régulière
    posters.length=0;
    for(let i=0;i<10;i++){
      const px = worldMin + ((i+1)/(10+1))*span + rint(-220,220);
      const x2 = nonOverlapShiftX(px,520);
      posters.push({x:x2, y:GROUND_Y-POSTER_SIZE, w:POSTER_SIZE, h:POSTER_SIZE, t:0, taking:false, taken:false});
    }

    // 5) MUR DE FIN
    worldEndX = Math.max(...[...buildings.map(b=>b.x+b.dw), ...posters.map(p=>p.x+p.w), ...npcs.map(n=>n.x+200)]) + 1600;
    spawnEndWall();
  }

  function nonOverlapShiftX(x, extra=0, avoidL=0, avoidR=0){
    let moved=true, guard=0;
    while(moved && guard++<240){
      moved=false;
      for(const b of buildings){
        const c=b.x+b.dw/2; const min=b.dw/2 + 420 + extra;
        if(Math.abs(x-c)<min){ x = c + (x<c? -min : min); moved=true; }
      }
      for(const p of posters){ const min=520+extra; if(Math.abs(x-p.x)<min){ x = p.x + (x<p.x? -min : min); moved=true; } }
      for(const n of npcs){ const min=600+extra; if(Math.abs(x-n.x)<min){ x = n.x + (x<n.x? -min : min); moved=true; } }
      if(x>avoidL && x<avoidR){ x = avoidR + 800; moved=true; }
    }
    return x;
  }

  function makeNPC(type, x){
    const frames=images.npcs[type]; return {type,x,frames,animT:0,face:'right',show:false,hideT:0,dialogImg:null,dialogIdx:0};
  }

  function placeKaitoWithShip(x){
    // Kaito
    const k = makeNPC('kaito', x); npcs.push(k);
    // Zone réservée ±1600
    const L=x-1600, R=x+1600;
    for(const b of buildings){ if(!(b.x+b.dw<L||b.x>R)){ const shift=(R-(b.x+b.dw))+320; b.x+=shift; b.doorX+=shift; b.roof.x+=shift; } }
    for(const p of posters){ if(p.x>L && p.x<R) p.x = R + 500; }

    // Vaisseau (building_kaito) à GAUCHE de Kaito
    if(images.buildingKaito){
      const base=images.buildingKaito[0], s=BUILDING_TARGET_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      let bx = x - (dw + 180), by = GROUND_Y - dh;
      // pousser si chevauche
      let moved=true, guard=0; while(moved && guard++<120){ moved=false;
        for(const b of buildings){ if(!(bx+dw < b.x-100 || bx > b.x+b.dw+100)){ bx = b.x - dw - 160; moved=true; } }
      }
      buildings.push({id:nextBId++, typeId:98, frames:[images.buildingKaito[0],images.buildingKaito[1]||images.buildingKaito[0]], animT:0, x:bx,y:by,dw,dh, roof:makeRoof(bx,by,dw,dh), doorX:bx,doorW:dw, canEnter:false});
    }
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

  /* ---------- Draw helpers ---------- */
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
    const x=Math.floor(player.x - cameraX), y=GROUND_Y - dh + player.y + yOff;

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
      const lower=Math.round(dh*NPC_LOWER);
      const sy=(GROUND_Y+yOff)-dh+lower, sx=Math.floor(n.x - cameraX);
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
        const bx=sx + Math.round(dw/2 - bw*0.5);
        const by=sy - Math.round(bh*0.6);
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

  /* ---------- Movement / Dash ---------- */
  function tryDash(dir){
    if(dashCooldown>0) return;
    if(!player.onGround){
      const max=1 + (airJumpsUsed>0?1:0);
      if(airDashUsed>=max) return;
      airDashUsed++; dashCooldown=DASH_COOL_A;
    }else{ airDashUsed=0; dashCooldown=DASH_COOL_G; }
    dashTimer=DASH_DUR; player.facing=dir; sfx.dash?.play().catch(()=>{});
  }

  /* ---------- Loops ---------- */
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentB=null;

  function updateWorld(dt){
    let vx=0;
    const base = MOVE_SPEED * (player.onGround || dashTimer>0 ? 1 : AIR_SPEED_MULT);

    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*base*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=base; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=base; player.facing='left'; }
    }
    player.x = Math.max(0, Math.min(player.x + vx*dt, worldEndX-10));

    if(player.onGround && Math.abs(vx)>1) foot(); else footStop();

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

    // Détecter si posé sur toit (pour drop-through)
    onPlatform=false;
    for(const b of buildings){
      const feet=GROUND_Y+player.y, top=b.roof.y;
      if(feet>=top && feet<=top+14){
        const within=(player.x+PLAYER_HALF_W>b.roof.x)&&(player.x-PLAYER_HALF_W<b.roof.x+b.roof.w);
        if(within && player.onGround){ onPlatform=true; break; }
      }
    }
    if(downPressedEdge && onPlatform){ dropThrough=0.35; player.y+=4; } // lâcher
    // Collisions with roof (ignore si drop-through actif)
    if(dropThrough<=0){
      for(const b of buildings){
        const feet=GROUND_Y+player.y, top=b.roof.y;
        const within=(player.x+PLAYER_HALF_W>b.roof.x)&&(player.x-PLAYER_HALF_W<b.roof.x+b.roof.w);
        const wasAbove=(prevFeet<=top+4);
        const crossing=(player.vy>=0)&&wasAbove&&(feet>=top);
        const nearTop=(feet>=top && feet<=top+16 && player.vy>=0);
        if(within && (crossing||nearTop)){
          player.y += (top-feet);
          player.vy=0; player.onGround=true;
          break;
        }
      }
    }

    // PNJ talk
    for(const n of npcs){
      const near=Math.abs(player.x-n.x)<=160;
      if(near){ n.show=true; n.hideT=0; }
      else if(n.show){ n.hideT=(n.hideT||0)+dt; if(n.hideT>=1.0){ n.show=false; n.dialogImg=null; n.hideT=0; } }
    }

    // Collect posters
    const wantsDown = keys.has('ArrowDown')||keys.has('s');
    for(const p of posters){
      const center=p.x+p.w/2, dx=Math.abs(player.x-center);
      const feetY=GROUND_Y-110+player.y;
      const over=aabb(player.x-26,feetY,52,110,p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && over && wantsDown){ p.taking=true; p.t=0; }
      if(p.taking){ p.t+=dt; if(p.t>=COLLECT_DUR){ p.taking=false; p.taken=true; postersCount++; setWanted(); sfx.wanted?.play().catch(()=>{}); if(postersCount>=POSTERS_TOTAL){ sfx.postersComplete?.play().catch(()=>{}); ensureOverlay().style.display='grid'; } } }
    }

    // Entrée bâtiments : PRIORITÉ AU DROP-THROUGH (si sur un toit, ↓ ne rentre JAMAIS)
    if(wantsDown && !onPlatform && dropThrough<=0){
      for(const b of buildings){
        const atDoor=(player.x>b.doorX && player.x<b.doorX+b.doorW);
        const feet=GROUND_Y+player.y, base=b.y+b.dh;
        const nearBase=Math.abs(feet-base)<280;
        if(atDoor && nearBase){
          if(b.canEnter && (b.typeId===2||b.typeId===3)){ enterInterior(b); break; }
          else { sfx.getout?.play().catch(()=>{}); break; }
        }
      }
      // Mur de fin : toute la largeur
      if(endWall){
        if(player.x > endWall.x-20 && player.x < endWall.x+endWall.dw+20) sfx.getout?.play().catch(()=>{});
      }
    }

    // Caméra (légère)
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
    mode='interior'; currentB=b; cameraX=0; if(bgm){ bgm.volume=0.12; }
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
    const floorY=H-40, ceilY=0;

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
    // Terminal = 1/4 à DROITE, moitié basse
    const term={ x:Math.floor(W*0.75), y:Math.floor(H*0.5), w:Math.floor(W*0.25), h:Math.floor(H*0.5) };
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
        interiorOpenIdx=Math.max(1,eggIndex); // 1→10 séquentiel
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
    // Myo plus grand et plus bas
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

  /* ---------- Start ---------- */
  async function boot(){ await loadAll(); gate.style.display='none'; requestAnimationFrame(loop); }
  startBtn.addEventListener('click', ()=>{ startAudio(); boot(); }, {once:true});
})();
