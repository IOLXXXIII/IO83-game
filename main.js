// IO83 – main.js (avec mur de fin réel)
// - Mur de fin: building_wall_idle_1/2, très haut, pied au sol, bloque physiquement
// - Caméra Y “naturelle”: tout le plan sol bouge (Myo/PNJ/bâtiments/affiches/front), mid bouge moins, far immobile
// - PNJ au sol + bulles visibles, flip au centre
// - Toits solides (one-way) robustes
// - Répartition large + anti-chevauchement strict (affiches/PNJ/bâtiments)
// - Intérieurs: zone terminal = dernier quart, progression 1→10 persistée (par bâtiment unique)

(function(){
  'use strict';

  /* ---------- utils ---------- */
  const rndInt=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const aabb=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
  function banner(msg, color='#b00020'){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:color,color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d); setTimeout(()=>d.remove(), 5000);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  /* ---------- canvas ---------- */
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  /* ---------- title / start ---------- */
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const title2=document.getElementById('title2');
  let tTitle=0; (function loopTitle(){ tTitle+=0.016; if(title2){ const a=(Math.sin(tTitle*1.4)+1)/2; title2.style.opacity=(a*0.75).toFixed(3); } if(gate && gate.style.display!=='none') requestAnimationFrame(loopTitle); })();

  /* ---------- audio ---------- */
  const bgm =document.getElementById('bgm');
  const sfx ={
    wanted:document.getElementById('sfxWanted'),
    dash:  document.getElementById('sfxDash'),
    enter: document.getElementById('sfxEnter'),
    exit:  document.getElementById('sfxExit'),
    jump:  document.getElementById('sfxJump'),
    type:  document.getElementById('sfxType'),
    ding:  document.getElementById('sfxDing'),
    foot:  document.getElementById('sfxFoot'),
    doorLocked:document.getElementById('sfxDoorLocked')
  };
  const SFX_VOL=0.8; Object.values(sfx).forEach(a=>{ if(a) a.volume=Math.min(1,(a.volume||1)*SFX_VOL); });
  if(sfx.foot) sfx.foot.volume=Math.min(1,(sfx.foot.volume||1)*0.7);
  function startAudio(){ if(bgm){ bgm.volume=0.6; bgm.currentTime=0; bgm.muted=false; bgm.play().catch(()=>{}); } }
  function fadeTo(audio,target,ms=250){ if(!audio) return; const step=(target-audio.volume)/(ms/50);
    const id=setInterval(()=>{ audio.volume=Math.max(0,Math.min(1,audio.volume+step)); if(Math.abs(audio.volume-target)<0.02){ audio.volume=target; clearInterval(id);} },50);
  }

  /* ---------- parallax / camera ---------- */
  const VIEW_DEN={back:6, mid:6, front:6};
  let cameraX=0, camYOffset=0;

  /* ---------- assets ---------- */
  const CB='?cb='+Date.now();
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
    interiorOpens:Array.from({length:10},(_,i)=>`assets/interiors/interior_open_${i+1}.png${CB}`)
  };
  const images={
    back:null, mid:null, front:null, myoIdle:[], myoWalk:[],
    posterWith:null, posterWithout:null,
    npcs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    dialogs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    buildings:[], buildingKaito:null, buildingWall:null, dashTrail:[],
    interiorClosedIdle:[], interiorOpens:[]
  };
  function loadImgRetry(src){
    return new Promise(res=>{
      const i=new Image(); i.onload=()=>res(i);
      i.onerror=()=>{ const p=src.split('?')[0]; const j=new Image(); j.onload=()=>res(j); j.onerror=()=>res(null); j.src=p; };
      i.src=src;
    });
  }

  /* ---------- ground align ---------- */
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

  /* ---------- physics ---------- */
  const SPEED_MULT = 1.2 * 1.15;
  const MOVE_SPEED = 360 * SPEED_MULT;
  const MYO_H      = 120 * 1.5;   // 180 px
  const PLAYER_HALF_W=26;

  const GRAVITY_UP=2600, GRAVITY_DOWN=2600*2.2;
  const TARGET_JUMP_HEIGHT=200;
  const JUMP_VELOCITY=Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);

  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOLDOWN_GROUND=0.6, DASH_COOLDOWN_AIR=0.28, DASH_MULT=4;
  let lastTapL=-999, lastTapR=-999, dashTimer=0, dashCooldown=0, airDashUsed=0;

  const keys=new Set();
  addEventListener('keydown',e=>{
    if(!worldReady || (mode!=='world' && mode!=='interior')) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s','[',']'].includes(e.key)) e.preventDefault();
    if(e.repeat){ keys.add(e.key); return; }
    keys.add(e.key);
    if(e.key==='ArrowUp'||e.key==='w') jumpBuf=JUMP_BUFFER;
    const t=performance.now()/1000;
    if(e.key==='ArrowRight'||e.key==='d'){ if(t-lastTapR<=DASH_WINDOW) tryDash('right'); lastTapR=t; }
    if(e.key==='ArrowLeft' ||e.key==='a'){ if(t-lastTapL<=DASH_WINDOW) tryDash('left');  lastTapL=t; }
  });
  addEventListener('keyup',e=>{ if(!worldReady) return; keys.delete(e.key); });

  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0 };
  const scoreEl=document.getElementById('scoreNum'); let score=0;

  /* ---------- footsteps ---------- */
  let footArmed=false;
  function playFoot(){ const a=sfx.foot; if(!a) return;
    if(!footArmed && a.readyState>=2){ const d=a.duration||15; a.currentTime=Math.random()*Math.max(1,d-1); footArmed=true; }
    a.playbackRate=0.96+Math.random()*0.08; if(a.paused) a.play().catch(()=>{});
  }
  function stopFoot(){ const a=sfx.foot; if(a && !a.paused) a.pause(); }

  /* ---------- posters (moins & + espacées) ---------- */
  const POSTER_SIZE=Math.round(100*1.2);
  const COLLECT_RADIUS=76, COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];

  /* ---------- buildings & NPC ---------- */
  const BUILDING_TARGET_H=Math.round(450*1.15);
  const VILLAGE_MIN=2, VILLAGE_MAX=3;
  const VILLAGE_GAP_MIN=Math.round(300*1.5), VILLAGE_GAP_MAX=Math.round(800*1.5);
  const buildings=[]; let nextBuildingId=1;
  let worldEndX=20000; // ajusté après spawn
  let endWall=null;    // {frames,animT,x,y,dw,dh}

  const NPC_H=300, NPC_TALK_RADIUS=160, NPC_HIDE_DELAY=1.0;
  const npcs=[];

  /* ---------- dialogs & progression ---------- */
  let eggIndex = parseInt(localStorage.getItem('io83_egg_index')||'0',10); // 0 → premier hack donnera 1
  let hackedIds = new Set(JSON.parse(localStorage.getItem('io83_hacked_ids')||'[]'));

  /* ---------- placement helpers ---------- */
  function buildingCenters(){ return buildings.map((b,idx)=>({idx, x:b.x + Math.round(b.dw/2)})); }
  function pickCentersWithGap(minGap,maxGap,count){
    const centers=buildingCenters(); const picked=[];
    if(!centers.length) return picked;
    let lastIdx=-9999;
    for(let c=0;c<count;c++){
      let tries=200, choice=null;
      while(tries--){
        const cand=centers[rndInt(0,centers.length-1)];
        if(Math.abs(cand.idx - lastIdx) >= rndInt(minGap,maxGap)){ choice=cand; break; }
      }
      if(!choice) choice=centers[Math.min(centers.length-1, lastIdx + rndInt(minGap,maxGap))] || centers[centers.length-1];
      picked.push(choice); lastIdx=choice.idx;
    }
    return picked;
  }

  /* ---------- spawn sequence ---------- */
  let worldReady=false;

  async function loadAll(){
    const miss=[]; const L=async s=>{ const i=await loadImgRetry(s); if(!i) miss.push(s); return i; };

    // layers
    images.back  = await L(ASSETS.back);
    images.mid   = await L(ASSETS.mid);
    images.front = await L(ASSETS.front);

    // myo
    for(const s of ASSETS.myoIdle) images.myoIdle.push(await L(s));
    for(const s of ASSETS.myoWalk) images.myoWalk.push(await L(s));

    // posters
    images.posterWith    = await L(ASSETS.posterWith);
    images.posterWithout = await L(ASSETS.posterWithout);

    // npcs
    for(const k of Object.keys(ASSETS.npcs))
      for(const s of ASSETS.npcs[k]) images.npcs[k].push(await L(s));

    // dialogs
    try{
      const r=await fetch(ASSETS.dialogsManifest); const mf=await r.json();
      for(const k of ['aeron','kaito','maonis','kahikoans']){
        const list=mf[k]||[]; for(const name of list){
          const p=`assets/ui/dialogs/${k}/${name}${CB}`; const i=await loadImgRetry(p);
          if(i) images.dialogs[k].push(i); else miss.push(p);
        }
      }
    }catch{/* ok */}

    // buildings
    for(const [a,b,id] of ASSETS.buildings){
      images.buildings.push([await L(a), (await L(b))||null, id]);
    }
    // building Kaito (optionnel)
    {
      const ka=await loadImgRetry(ASSETS.buildingKaito[0]);
      const kb=ka? await loadImgRetry(ASSETS.buildingKaito[1]) : null;
      images.buildingKaito = ka ? [ka, kb||ka] : null;
    }
    // building Wall (optionnel)
    {
      const wa=await loadImgRetry(ASSETS.buildingWall[0]);
      const wb=wa? await loadImgRetry(ASSETS.buildingWall[1]) : null;
      images.buildingWall = wa ? [wa, wb||wa] : null;
    }

    // misc
    for(const s of ASSETS.dashTrail){ const i=await loadImgRetry(s); if(i) images.dashTrail.push(i); }
    for(const s of ASSETS.interiorClosedIdle){ const i=await loadImgRetry(s); if(i) images.interiorClosedIdle.push(i); }
    for(const s of ASSETS.interiorOpens){ const i=await loadImgRetry(s); if(i) images.interiorOpens.push(i); }

    if(miss.length) banner('Missing assets → '+miss.join(', '));

    recalcGround();

    // Posters seed (après GROUND_Y)
    (function seedPosters(){
      posters.length=0;
      const seg=5000, rep=2; let x=900;
      for(let k=0;k<rep;k++){
        const n=rndInt(5,7);
        for(let i=0;i<n;i++){ x += rndInt(800,1600); posters.push({x:x+k*seg,y:GROUND_Y-POSTER_SIZE,w:POSTER_SIZE,h:POSTER_SIZE,taking:false,t:0,taken:false}); }
      }
    })();

    spawnVillages();
    spawnNPCsOnce();
    placePostersNonOverlapping();
    ensureAtLeastEnterable(10);    // autant de maisons que d’eggs
    computeWorldEnd();
    spawnEndWall();                // crée le mur réel et ajuste le blocage

    worldReady=true;
  }

  function spawnVillages(){
    buildings.length=0;
    const startX=900, endX=(posters.at(-1)?.x||12000)+2600;
    let x=startX;
    while(x<endX){
      const count=(Math.random()<0.65)? rndInt(VILLAGE_MIN,VILLAGE_MAX):1;
      for(let i=0;i<count;i++){
        const pair=images.buildings[rndInt(0,images.buildings.length-1)];
        if(!pair||!pair[0]) continue;
        const [im1,im2,typeId]=pair;
        const canEnter=(typeId===2||typeId===3);
        const s=BUILDING_TARGET_H/im1.height, dw=Math.round(im1.width*s), dh=Math.round(im1.height*s);
        const bx=x, by=GROUND_Y-dh;
        const doorW=dw, doorX=bx;
        const roofW=Math.round(dw*0.92), roofX=bx+Math.round((dw-roofW)/2), roofY=by+Math.round(dh*0.18);
        buildings.push({id:nextBuildingId++, typeId, canEnter, frames:[im1,im2||im1], animT:0, x:bx,y:by,dw,dh,doorX,doorW, roof:{x:roofX,y:roofY,w:roofW,h:12}});
        x += dw + rndInt(28,64);
      }
      x += rndInt(VILLAGE_GAP_MIN, VILLAGE_GAP_MAX);
    }
  }

  function spawnNPCsOnce(){
    npcs.length=0;
    const plan=[ {type:'aeron',n:1}, {type:'kaito',n:1}, {type:'maonis',n:2}, {type:'kahikoans',n:3} ];
    const centers=buildingCenters(); if(!centers.length) return;
    const usedX=[];

    function placeAtX(type, x){
      let tries=200;
      while(tries--){
        let bad=false;
        for(const u of usedX) if(Math.abs(x-u)<500){ bad=true; break; }
        if(!bad) for(const b of buildings) if(Math.abs(x-(b.x+b.dw/2)) < (b.dw/2 + 280)){ bad=true; break; }
        if(!bad) for(const p of posters)   if(Math.abs(x-p.x) < 340){ bad=true; break; }
        if(!bad) break;
        x += rndInt(320,540);
      }
      usedX.push(x);
      const frames=images.npcs[type]; if(!frames?.length) return;
      npcs.push({type, x, frames, animT:0, face:'right', show:false, hideT:0, dialogImg:null});
    }

    for(const spec of plan){
      const picks=pickCentersWithGap(6,12,spec.n);
      for(const c of picks) placeAtX(spec.type, c.x);
    }

    // Building Kaito dédié : à GAUCHE du PNJ Kaito, sans overlap
    const kai=npcs.find(n=>n.type==='kaito');
    if(kai && images.buildingKaito){
      const base=images.buildingKaito[0], s=BUILDING_TARGET_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      let bx = kai.x - (dw + 140), by=GROUND_Y-dh;
      // repousse si chevauche un autre building
      let moved=true, guard=0;
      while(moved && guard++<50){
        moved=false;
        for(const b of buildings){
          const overlap = !(bx+dw < b.x-60 || bx > b.x+b.dw+60);
          if(overlap){ bx = b.x - dw - 100; moved=true; }
        }
      }
      buildings.push({id:nextBuildingId++, typeId:99, canEnter:false, frames:[images.buildingKaito[0],images.buildingKaito[1]], animT:0,
        x:bx,y:by,dw,dh,doorX:bx,doorW:dw, roof:{x:bx+Math.round(dw*0.04), y:by+Math.round(dh*0.18), w:Math.round(dw*0.92), h:12}});
    }
  }

  function placePostersNonOverlapping(){
    posters.sort((a,b)=>a.x-b.x);
    for(let i=0;i<posters.length;i++){
      const p=posters[i];
      for(const b of buildings){
        const left = b.x - 420, right = b.x + b.dw + 420;
        if(p.x>left && p.x<right) p.x = right + rndInt(60,140);
      }
      for(const n of npcs){ if(Math.abs(p.x-n.x)<380) p.x = n.x + 400; }
      if(i>0 && p.x - posters[i-1].x < 420) p.x = posters[i-1].x + 440;
      p.y = GROUND_Y - POSTER_SIZE;
    }
  }

  function ensureAtLeastEnterable(minCount){
    const enterables = buildings.filter(b=>b.canEnter);
    if(enterables.length>=minCount) return;
    const candidates = buildings.filter(b=>!b.canEnter).sort((a,b)=>b.dw-a.dw);
    for(let i=0; i<minCount-enterables.length && i<candidates.length; i++){
      candidates[i].canEnter=true;
    }
  }

  function computeWorldEnd(){
    const maxB = Math.max(...buildings.map(b=>b.x+b.dw), 0);
    const maxP = Math.max(...posters.map(p=>p.x+p.w), 0);
    const maxN = Math.max(...npcs.map(n=>n.x+200), 0);
    worldEndX = Math.max(maxB, maxP, maxN) + 1600; // “rien” avant mur
  }

  function spawnEndWall(){
    if(!images.buildingWall){ return; }
    const base = images.buildingWall[0]; if(!base) return;
    // Scale : ~125% de la hauteur de l’écran → dépasse le haut
    const targetH = Math.round((canvas.height/DPR) * 1.25); // 720 * 1.25 ≈ 900
    const s = targetH / base.height;                         // base = 1466 px haut
    const dw = Math.round(base.width * s);                   // ≈ 1024 * s
    const dh = Math.round(base.height* s);
    // Position : après la dernière entité, sans chevauchement
    const lastX = worldEndX - 1000;
    const lastRight = Math.max(...buildings.map(b=>b.x+b.dw), 0);
    const x = Math.max(lastX, lastRight + 300); // marge
    const y = GROUND_Y - dh;
    endWall = {frames:images.buildingWall, animT:0, x, y, dw, dh};
    // Blocage pile au mur (on bloque un peu avant la face)
    worldEndX = endWall.x - 8;
  }

  /* ---------- game modes ---------- */
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentBuilding=null;

  function tryDash(dir){
    if(dashCooldown>0) return;
    if(!player.onGround){
      const maxDashes = 1 + (airJumpsUsed > 0 ? 1 : 0);
      if(airDashUsed >= maxDashes) return;
      airDashUsed++; dashCooldown = DASH_COOLDOWN_AIR;
    }else{ airDashUsed=0; dashCooldown = DASH_COOLDOWN_GROUND; }
    dashTimer=DASH_DUR; player.facing=dir;
    if(sfx.dash){ sfx.dash.currentTime=0; sfx.dash.play().catch(()=>{}); }
  }

  function enterInterior(b){
    mode='interior'; currentBuilding=b; cameraX=0; stopFoot();
    if(bgm) fadeTo(bgm,0.12,250);
    interiorOpenIdx=0; hacking=false; hackT=0;
    player.x=60; player.y=6; player.vy=0; player.onGround=true; player.facing='right';
  }
  function exitInterior(){
    mode='world';
    if(bgm) fadeTo(bgm,0.6,250);
    if(sfx.exit){ sfx.exit.currentTime=0; sfx.exit.play().catch(()=>{}); }
    if(currentBuilding){ player.x=currentBuilding.doorX + currentBuilding.doorW/2; player.y=0; player.vy=0; player.onGround=true; }
    currentBuilding=null;
  }

  /* ---------- rendering helpers (offsets Y appliqués au “sol”) ---------- */
  function drawLayer(img,f,den, yParallax=0){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(H-dh) + yParallax;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(runVel, yOff){
    const frames=(Math.abs(runVel)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(runVel)>1e-2?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0]; if(!img) return;
    const s=MYO_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
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
  function drawBuildings(yOff){ for(const b of buildings){
    const sx=Math.floor(b.x - cameraX); if(sx<-2200 || sx>canvas.width/DPR+2200) continue;
    const frame=(Math.floor(b.animT*2)%2===0)? b.frames[0]:(b.frames[1]||b.frames[0]);
    if(frame) ctx.drawImage(frame, sx, b.y + yOff, b.dw, b.dh);
  } }
  function drawNPCs(yOff){
    for(const n of npcs){
      const base=n.frames[0]; if(!base) continue;
      const s=NPC_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      const sy=GROUND_Y - dh + yOff + 2; // au SOL
      const sx=Math.floor(n.x - cameraX);
      if(player.x < n.x) n.face='left'; else if(player.x > n.x) n.face='right';
      const idx=(Math.floor(n.animT*2)%2); const img=n.frames[Math.min(idx,n.frames.length-1)]||base;

      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

      if(n.show && !n.dialogImg) n.dialogImg = pickDialog(n.type);
      if(n.show && n.dialogImg){
        const scale=0.6, bw=n.dialogImg.width*scale, bh=n.dialogImg.height*scale;
        const bx = sx + Math.round(dw/2 - bw*1.0);
        const by = sy - Math.round(bh*0.5);
        ctx.drawImage(n.dialogImg, bx, by, bw, bh);
      }
      n.animT += yOff? 0: 0; // (animT déjà avancé ailleurs)
    }
  }
  function drawEndWall(yOff){
    if(!endWall) return;
    const frame=(Math.floor(endWall.animT*2)%2===0)? endWall.frames[0]:(endWall.frames[1]||endWall.frames[0]);
    const sx=Math.floor(endWall.x - cameraX);
    if(frame) ctx.drawImage(frame, sx, endWall.y + yOff, endWall.dw, endWall.dh);
  }
  function pickDialog(k){ const list=images.dialogs[k]||[]; return list.length? list[(Math.random()*list.length)|0] : null; }

  /* ---------- world loop ---------- */
  let last=0, prevFeetY=0;
  function updateWorld(dt){
    let vx=0;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*MOVE_SPEED*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    }
    const nextX = player.x + vx*dt;
    const blockX = (endWall ? endWall.x - 8 : worldEndX - 10);
    player.x = Math.min(nextX, blockX);

    if(player.onGround && Math.abs(vx)>1) playFoot(); else stopFoot();

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; }
    else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt); dashCooldown=Math.max(0,dashCooldown-dt);

    const wantJump=jumpBuf>0;
    if(wantJump){
      if(player.onGround || coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; if(sfx.jump){sfx.jump.currentTime=0; sfx.jump.play().catch(()=>{});} }
      else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; if(sfx.jump){sfx.jump.currentTime=0; sfx.jump.play().catch(()=>{});} }
    }

    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else { player.vy=0; }
    prevFeetY = GROUND_Y + player.y;
    player.y += player.vy*dt;

    // sol
    if(GROUND_Y + player.y > GROUND_Y){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;

    // toits
    for(const b of buildings){
      const feetY = GROUND_Y + player.y;
      const top   = b.roof.y;
      const withinX = (player.x + PLAYER_HALF_W > b.roof.x) && (player.x - PLAYER_HALF_W < b.roof.x + b.roof.w);
      const crossingDown = (player.vy>=0) && (prevFeetY <= top) && (feetY >= top - 2);
      const insideTol = withinX && (feetY >= top) && (feetY - prevFeetY) <= 40;
      if( withinX && (crossingDown || insideTol) ){
        player.y += (top - feetY);
        player.vy=0; player.onGround=true;
      }
    }

    // PNJ: talk radius + bulles
    for(const n of npcs){
      const near = Math.abs(player.x - n.x) <= NPC_TALK_RADIUS;
      if(near){ n.show=true; n.hideT=0; }
      else if(n.show){
        n.hideT += dt; if(n.hideT>=NPC_HIDE_DELAY){ n.show=false; n.dialogImg=null; n.hideT=0; }
      }
      n.animT += dt;
    }

    // Collecte affiches
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const feetY=GROUND_Y-110+player.y;
    for(const p of posters){
      const center=p.x + p.w/2, dx=Math.abs(player.x - center);
      const overY=aabb(player.x-26, feetY, 52,110, p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && overY && wantsCollect){ p.taking=true; p.t=0; }
      if(p.taking){ p.t+=dt; if(p.t>=COLLECT_DUR){ p.taking=false; p.taken=true; score++; scoreEl.textContent=String(score); if(sfx.wanted){sfx.wanted.currentTime=0; sfx.wanted.play().catch(()=>{});} } }
    }

    // entrée / portes
    if(wantsCollect){
      for(const b of buildings){
        if(player.x>b.doorX && player.x<b.doorX+b.doorW && Math.abs((GROUND_Y+player.y)-(b.y+b.dh))<150){
          if(b.canEnter){ enterInterior(b); break; }
          else if(sfx.doorLocked){ sfx.doorLocked.currentTime=0; sfx.doorLocked.play().catch(()=>{}); }
        }
      }
    }

    // caméra
    const W=canvas.width/DPR; cameraX=Math.max(0, player.x - W/2);
    const targetYOffset = -player.y * 0.18;
    camYOffset += (targetYOffset - camYOffset) * Math.min(1, dt*8);

    // draw
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
  }

  /* ---------- interior loop ---------- */
  function updateInterior(dt){
    let vx=0;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*MOVE_SPEED*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    }
    player.x=Math.max(0, Math.min(1220, player.x + vx*dt));

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; } else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt); dashCooldown=Math.max(0,dashCooldown-dt);
    const wantJump=jumpBuf>0;
    if(wantJump){
      if(player.onGround || coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; if(sfx.jump){sfx.jump.currentTime=0; sfx.jump.play().catch(()=>{});} }
      else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; if(sfx.jump){sfx.jump.currentTime=0; sfx.jump.play().catch(()=>{});} }
    }
    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else { player.vy=0; }
    player.y += player.vy*dt;

    const floorY=650, ceilY=120;
    if(floorY + player.y > floorY){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;
    const headY = floorY - MYO_H + player.y; if(headY<ceilY){ player.y+=(ceilY-headY); player.vy=0; }

    if(player.x<=0 && !hacking){ exitInterior(); return; }

    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const termX0=Math.floor(1280*0.75); // dernier quart
    if(!hacking && wantsCollect && player.x>=termX0){
      hacking=true; hackT=0; if(sfx.type){ sfx.type.currentTime=0; sfx.type.play().catch(()=>{}); }
    }
    if(hacking){
      hackT+=dt;
      if(hackT>=1.5){
        hacking=false; hackT=0;
        if(sfx.ding){ sfx.ding.currentTime=0; sfx.ding.play().catch(()=>{}); }
        if(currentBuilding && !hackedIds.has(currentBuilding.id)){
          hackedIds.add(currentBuilding.id);
          eggIndex = Math.min(10, eggIndex+1);
          localStorage.setItem('io83_egg_index', String(eggIndex));
          localStorage.setItem('io83_hacked_ids', JSON.stringify([...hackedIds]));
        }
        interiorOpenIdx=Math.max(1, eggIndex);
      }
    }

    // draw
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,Wpx,Hpx);

    if(interiorOpenIdx===0){
      const frames=images.interiorClosedIdle;
      const idx=frames.length>1 ? Math.floor(player.animTime*2)%frames.length : 0;
      const img=frames[idx]||frames[0];
      if(img) ctx.drawImage(img,0,0,Wpx,Hpx);
    }else{
      const base=images.interiorOpens[Math.min(9,interiorOpenIdx-1)];
      if(base) ctx.drawImage(base,0,0,Wpx,Hpx);
    }

    const frames2=(Math.abs(vx)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(vx)>1e-2?8:4);
    const idx2=frames2.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img2=frames2[idx2]||images.myoIdle[0];
    if(img2){
      const s=MYO_H/img2.height, dw=Math.round(img2.width*s), dh=Math.round(img2.height*s);
      const x=Math.floor(player.x), y=floorY - dh + player.y + 2;
      ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img2,0,0,dw,dh); } else ctx.drawImage(img2,x,y,dw,dh); ctx.restore();
    }
  }

  function loop(ts){ const dt=Math.min((ts - (loop.last||ts))/1000, 1/30); loop.last=ts;
    if(!worldReady){
      const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
      ctx.fillStyle='#000'; ctx.fillRect(0,0,Wpx,Hpx);
      ctx.fillStyle='#fff'; ctx.font='16px monospace'; ctx.fillText('Loading…', 24, 40);
      requestAnimationFrame(loop); return;
    }
    if(mode==='world') updateWorld(dt); else updateInterior(dt);
    requestAnimationFrame(loop);
  }

  /* ---------- start ---------- */
  async function startGame(){
    startBtn.disabled=true; startBtn.textContent='Loading…';
    await loadAll();
    gate.style.display='none';
    requestAnimationFrame(loop);
  }
  startBtn.addEventListener('click', ()=>{ startAudio(); startGame(); }, {once:true});

})();
