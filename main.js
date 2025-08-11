// IO83 – main.js (socle + dash + PNJ + buildings + intérieurs + posters)
// Respecte ton arbo EXACTE. Code commenté pour modifier vite.

(function(){
  'use strict';

  // ---------- Mini banner debug ----------
  function banner(msg, color='#b00020'){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:color,color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d); setTimeout(()=>d.remove(), 4500);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  // ---------- Canvas / HiDPI ----------
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  // ---------- UI / Title anim ----------
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const title1=document.getElementById('title1'), title2=document.getElementById('title2');
  let titleT=0; function titleLoop(ts){ titleT+=0.016; const a=(Math.sin(titleT*1.4)+1)/2; title2.style.opacity=a*0.75; if(gate.style.display!=='none') requestAnimationFrame(titleLoop); }
  requestAnimationFrame(titleLoop);

  // ---------- Audio elements ----------
  const bgm=document.getElementById('bgm');
  const sfxWanted=document.getElementById('sfxWanted');
  const sfxDash=document.getElementById('sfxDash');
  const sfxEnter=document.getElementById('sfxEnter');
  const sfxExit =document.getElementById('sfxExit');
  const sfxJump =document.getElementById('sfxJump');
  const sfxType =document.getElementById('sfxType');
  const sfxDing =document.getElementById('sfxDing');
  const sfxFoot =document.getElementById('sfxFoot');

  let audioArmed=false;
  function armAudio(){
    if(audioArmed) return; audioArmed=true;
    for(const a of [bgm,sfxWanted,sfxDash,sfxEnter,sfxExit,sfxJump,sfxType,sfxDing,sfxFoot]) if(a) a.muted=false;
    if(bgm){ bgm.volume=0.6; const p=bgm.play(); if(p && p.catch) p.catch(()=>{/*blocked until interaction*/}); }
  }
  addEventListener('pointerdown',armAudio,{passive:true}); addEventListener('keydown',armAudio);

  // ---------- Parallax ----------
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_DEN={back:6, mid:6, front:6}; // 1/6 visible
  const LAYER_ALIGN='bottom';
  let cameraX=0;

  // ---------- Assets ----------
  const CB='?cb='+Date.now();
  const ASSETS={
    back :'assets/background/bg_far.png'+CB,
    mid  :'assets/background/bg_mid.png'+CB,
    front:'assets/background/ground.png'+CB,
    // Myo
    myoIdle:[ 'assets/characters/myo/myo_idle_1.png'+CB, 'assets/characters/myo/myo_idle_2.png'+CB ],
    myoWalk:[
      'assets/characters/myo/myo_walk_1.png'+CB,'assets/characters/myo/myo_walk_2.png'+CB,
      'assets/characters/myo/myo_walk_3.png'+CB,'assets/characters/myo/myo_walk_4.png'+CB
    ],
    // Posters
    posterWith:'assets/collectibles/wanted_withposter.png'+CB,
    posterWithout:'assets/collectibles/wanted_withoutposter.png'+CB,
    // PNJ (idles)
    npcs:{
      aeron:     ['assets/characters/aeron/aeron_idle_1.png'+CB,'assets/characters/aeron/aeron_idle_2.png'+CB],
      kaito:     ['assets/characters/kaito/kaito_idle_1.png'+CB,'assets/characters/kaito/kaito_idle_2.png'+CB],
      maonis:    ['assets/characters/maonis/maonis_idle_1.png'+CB,'assets/characters/maonis/maonis_idle_2.png'+CB],
      kahikoans: ['assets/characters/kahikoans/kahikoans_idle_1.png'+CB,'assets/characters/kahikoans/kahikoans_idle_2.png'+CB]
    },
    // Dialog bubble PNGs (listed in config/dialogs_manifest.json)
    dialogsManifest:'config/dialogs_manifest.json'+CB,
    // Buildings
    buildings:[
      ['assets/buildings/building_1_idle_1.png'+CB,'assets/buildings/building_1_idle_2.png'+CB],
      ['assets/buildings/building_2_idle_1.png'+CB,'assets/buildings/building_2_idle_2.png'+CB],
      ['assets/buildings/building_3_idle_1.png'+CB,'assets/buildings/building_3_idle_2.png'+CB],
      ['assets/buildings/building_4_idle_1.png'+CB,'assets/buildings/building_4_idle_2.png'+CB]
    ],
    // Dash trail
    dashTrail:[
      'assets/fx/dash_trail_1.png'+CB,'assets/fx/dash_trail_2.png'+CB,'assets/fx/dash_trail_3.png'+CB
    ],
    // Interiors
    interiorClosed:'assets/interiors/interior_closed.png'+CB,
    interiorOpens: Array.from({length:10},(_,i)=>`assets/interiors/interior_open_${i+1}.png${CB}`)
  };

  const images={
    back:null, mid:null, front:null,
    myoIdle:[], myoWalk:[],
    posterWith:null, posterWithout:null,
    npcs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    dialogs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    buildings:[], // each: [img1,img2]
    dashTrail:[],
    interiorClosed:null, interiorOpens:[]
  };

  function loadImg(src){ return new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; }); }
  async function loadAll(){
    const miss=[];
    images.back  = await loadImg(ASSETS.back)  || (miss.push(ASSETS.back),null);
    images.mid   = await loadImg(ASSETS.mid)   || (miss.push(ASSETS.mid),null);
    images.front = await loadImg(ASSETS.front) || (miss.push(ASSETS.front),null);

    for(const s of ASSETS.myoIdle){ const i=await loadImg(s); i?images.myoIdle.push(i):miss.push(s); }
    for(const s of ASSETS.myoWalk){ const i=await loadImg(s); i?images.myoWalk.push(i):miss.push(s); }

    images.posterWith    = await loadImg(ASSETS.posterWith)    || (miss.push(ASSETS.posterWith),null);
    images.posterWithout = await loadImg(ASSETS.posterWithout) || (miss.push(ASSETS.posterWithout),null);

    for(const k of Object.keys(ASSETS.npcs)){
      for(const s of ASSETS.npcs[k]){ const i=await loadImg(s); i?images.npcs[k].push(i):miss.push(s); }
    }

    // dialogs manifest
    try{
      const r=await fetch(ASSETS.dialogsManifest); const mf=await r.json();
      for(const k of ['aeron','kaito','maonis','kahikoans']){
        const list = mf[k]||[];
        for(const name of list){
          const p = `assets/ui/dialogs/${k}/${name}${CB}`;
          const i=await loadImg(p); if(i) images.dialogs[k].push(i); else miss.push(p);
        }
      }
    }catch(e){ banner('dialogs_manifest.json introuvable ou invalide'); }

    // buildings (2 frames)
    for(const pair of ASSETS.buildings){
      const a=await loadImg(pair[0]); const b=await loadImg(pair[1]);
      images.buildings.push([a,b||a]);
      if(!a) miss.push(pair[0]);
    }

    for(const s of ASSETS.dashTrail){ const i=await loadImg(s); i?images.dashTrail.push(i):miss.push(s); }

    images.interiorClosed = await loadImg(ASSETS.interiorClosed) || (miss.push(ASSETS.interiorClosed),null);
    for(const s of ASSETS.interiorOpens){ const i=await loadImg(s); i?images.interiorOpens.push(i):miss.push(s); }

    if(miss.length) banner('Missing assets → '+miss.join(', '));

    recalcGround();
    const toWorldY=h=>GROUND_Y-h;
    for(const p of posters) p.y=toWorldY(POSTER_Y_ABOVE_GROUND);

    spawnVillages();
    spawnNPCsOnce();
  }

  // ---------- Ground align ----------
  let GROUND_SRC_OFFSET = parseInt(localStorage.getItem('GROUND_SRC_OFFSET')||'18',10);
  let GROUND_Y = 560;
  function recalcGround(){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const scale=(VIEW_DEN.front*W)/images.front.width;
      const groundFromBottom=Math.round(GROUND_SRC_OFFSET*scale);
      GROUND_Y = H - groundFromBottom;
    }
  }
  addEventListener('keydown', (e)=>{
    if(e.key===']'){ GROUND_SRC_OFFSET++; localStorage.setItem('GROUND_SRC_OFFSET', GROUND_SRC_OFFSET); recalcGround(); banner('GROUND_SRC_OFFSET = '+GROUND_SRC_OFFSET, '#1f4f7a'); }
    if(e.key==='['){ GROUND_SRC_OFFSET--; localStorage.setItem('GROUND_SRC_OFFSET', GROUND_SRC_OFFSET); recalcGround(); banner('GROUND_SRC_OFFSET = '+GROUND_SRC_OFFSET, '#1f4f7a'); }
  });

  // ---------- Physique ----------
  const MOVE_SPEED=360;
  const MYO_H=120;

  const GRAVITY_UP   = 2600;
  const GRAVITY_DOWN = 2600*2.2;
  const TARGET_JUMP_HEIGHT = 200;
  const JUMP_VELOCITY = Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);

  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  // Dash (double tap)
  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOLDOWN=0.8, DASH_MULT=4;
  let lastTapL=-999, lastTapR=-999, dashTimer=0, dashCooldown=0, airDashUsed=false;

  // ---------- Input ----------
  const keys=new Set();
  addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s','[',']'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if(e.key==='ArrowUp'||e.key==='w') jumpBuf = JUMP_BUFFER;

    // double tap detection
    const t=performance.now()/1000;
    if(e.key==='ArrowRight'||e.key==='d'){
      if(t-lastTapR<=DASH_WINDOW) tryDash('right');
      lastTapR=t;
    }
    if(e.key==='ArrowLeft'||e.key==='a'){
      if(t-lastTapL<=DASH_WINDOW) tryDash('left');
      lastTapL=t;
    }
  });
  addEventListener('keyup',e=>keys.delete(e.key));

  // ---------- State ----------
  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0 };
  const scoreEl=document.getElementById('scoreNum');
  let score=0;

  // Posters
  const POSTER_SIZE=50;
  const POSTER_Y_ABOVE_GROUND=160;
  const COLLECT_RADIUS=60;
  const COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[]; // {x,y,w,h,taking,t,taken}
  (function spawnPosters(){
    const seg=5000, rep=2;
    const base=[600,1100,1500,2050,2450,2950,3350,3650,4250,4650];
    for(let k=0;k<rep;k++){
      for(const x of base) posters.push({x:x+k*seg,y:0,w:POSTER_SIZE,h:POSTER_SIZE,taking:false,t:0,taken:false});
    }
  })();

  // Buildings & roofs
  const BUILDING_TARGET_H=180;
  const VILLAGE_MIN=2, VILLAGE_MAX=3;
  const VILLAGE_GAP_MIN=300, VILLAGE_GAP_MAX=800;
  const buildings=[]; // {id,frames:[i1,i2],animT,x,y,dw,dh,doorX,doorW,roof:{x,y,w,h}}
  let nextBuildingId=1;
  function spawnVillages(){
    buildings.length=0;
    const startX=400, endX=(posters.at(-1)?.x||10000)+1200;
    let x=startX;
    while(x<endX){
      const count=(Math.random()<0.65)? randInt(VILLAGE_MIN,VILLAGE_MAX):1;
      for(let i=0;i<count;i++){
        const pair = images.buildings[randInt(0, images.buildings.length-1)];
        if(!pair || !pair[0]) continue;
        const img=pair[0];
        const s=BUILDING_TARGET_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
        const bx=x, by=GROUND_Y-dh;
        const doorW=120, doorX=bx + Math.round(dw/2 - doorW/2);
        // toit rectangle: 80% centré, épaisseur 8px
        const roofW=Math.round(dw*0.8), roofX=bx + Math.round((dw-roofW)/2), roofY=by+8;
        buildings.push({ id: nextBuildingId++, frames:pair, animT:0, x:bx, y:by, dw, dh, doorX, doorW, roof:{x:roofX,y:roofY,w:roofW,h:8} });
        x += dw + randInt(10,40);
      }
      x += randInt(VILLAGE_GAP_MIN, VILLAGE_GAP_MAX);
    }
  }

  // NPCs
  const NPC_H=120, NPC_TALK_RADIUS=140, NPC_HIDE_DELAY=1.0;
  const npcs=[]; // {type,x,y,frames[],animT,face,show,hideT,dialogImg}
  function spawnNPCsOnce(){
    npcs.length=0;
    const slots=[1400, 2600, 3800, 5200, 6500, 7800, 9000];
    const types=['aeron','kaito','maonis','kahikoans'];
    const used=new Set();
    for(const t of types){
      let tries=20,x=0; while(tries--){ const s=slots[randInt(0,slots.length-1)]; if(!used.has(s)){ used.add(s); x=s; break; } }
      const frames=images.npcs[t]; if(!frames||frames.length===0) continue;
      npcs.push({type:t, x, y:GROUND_Y-NPC_H, frames, animT:0, face:'right', show:false, hideT:0, dialogImg:null});
    }
  }

  // Dialog helpers
  function pickDialog(pnj){
    const list=images.dialogs[pnj]||[]; if(list.length===0) return null;
    return list[(Math.random()*list.length)|0];
  }

  // Interiors (scene)
  let mode='world'; // 'world' | 'interior'
  const INTERIOR_FLOOR_Y=620, INTERIOR_CEIL_Y=120;
  const TERMINAL_ZONE={x:980,w:160};
  let currentBuilding=null; // ref building
  let eggIndex=parseInt(localStorage.getItem('io83_egg_index')||'0',10); // 0..10
  const hackedOnce=new Set(); // building.id that already incremented

  // Footsteps control
  let footArmed=false;
  function playFootsteps(){
    if(!sfxFoot) return;
    if(!footArmed && sfxFoot.readyState>=2){
      const dur=sfxFoot.duration||15;
      sfxFoot.currentTime=Math.random()*Math.max(1,dur-1);
      footArmed=true;
    }
    sfxFoot.playbackRate=0.96+Math.random()*0.08;
    if(sfxFoot.paused) sfxFoot.play().catch(()=>{});
  }
  function stopFootsteps(){ if(sfxFoot && !sfxFoot.paused) sfxFoot.pause(); }

  // ---------- Utils ----------
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

  // ---------- Render helpers ----------
  function drawLayer(img,f,den){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(LAYER_ALIGN==='bottom')?(H-dh):0;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(runVel){
    const frames=(Math.abs(runVel)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(runVel)>1e-2?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0]; if(!img) return;
    const s=MYO_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const x=Math.floor(player.x - cameraX), y=GROUND_Y - dh + player.y;

    // Trail (dash) derrière Myo
    if(dashTimer>0 && images.dashTrail.length){
      const tIdx = Math.floor(player.animTime*9)%images.dashTrail.length;
      const ti = images.dashTrail[tIdx];
      ctx.save();
      if(player.facing==='left'){ // miroir aussi pour la trail
        ctx.translate(x+dw/2-16, y); ctx.scale(-1,1); ctx.translate(-dw/2,0);
      } else {
        ctx.translate(x-16, y);
      }
      ctx.globalAlpha=0.85;
      ctx.drawImage(ti, 0, 0, dw, dh);
      ctx.restore();
    }

    ctx.save();
    if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
    else ctx.drawImage(img,x,y,dw,dh);
    ctx.restore();
  }
  function drawPosters(){
    for(const p of posters){
      const sx=p.x - cameraX; if(sx<-160 || sx>canvas.width/DPR+160) continue;
      let sy=p.y; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      const sprite = p.taken ? images.posterWithout : images.posterWith;
      if(sprite) ctx.drawImage(sprite, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
    }
  }
  function drawBuildings(){
    for(const b of buildings){
      const sx=Math.floor(b.x - cameraX);
      if(sx<-300 || sx>canvas.width/DPR+300) continue;
      const frame = (Math.floor(b.animT*2)%2===0)? b.frames[0]: (b.frames[1]||b.frames[0]);
      if(frame) ctx.drawImage(frame, sx, b.y, b.dw, b.dh);
    }
  }
  function drawNPCs(){
    for(const n of npcs){
      const idx = (n.frames.length>1) ? (Math.floor(n.animT * 2) % 2) : 0;
      const img = n.frames[idx] || n.frames[0]; if(!img) continue;
      const s = NPC_H / img.height;
      const dw=Math.round(img.width*s), dh=Math.round(img.height*s);
      const sx=Math.floor(n.x - cameraX), sy=GROUND_Y - dh;

      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

      if(n.show && n.dialogImg){
        const bx = sx + Math.round(dw/2 - n.dialogImg.width/2);
        const by = sy - n.dialogImg.height - 8;
        ctx.drawImage(n.dialogImg, bx, by);
      }
    }
  }

  // ---------- World/Interior loops ----------
  let last=0; const MAX_DT=1/30;

  function tryDash(dir){
    if(dashCooldown>0) return;
    if(!player.onGround && airDashUsed) return; // 1 dash aérien max
    dashTimer=DASH_DUR; dashCooldown=DASH_COOLDOWN;
    player.facing=dir;
    if(!player.onGround) airDashUsed=true;
    if(sfxDash) { sfxDash.currentTime=0; sfxDash.play().catch(()=>{}); }
  }

  function updateWorld(dt){
    // Horizontal (ignore input si dash actif → vitesse forcée)
    let vx=0;
    if(dashTimer>0){
      vx = (player.facing==='right'?1:-1)*MOVE_SPEED*DASH_MULT;
      dashTimer -= dt;
    } else {
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    }
    player.x = Math.max(0, player.x + vx*dt);

    // SFX footsteps
    if(player.onGround && Math.abs(vx)>1) playFootsteps(); else stopFootsteps();

    // Timers
    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=false; } else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt);
    dashCooldown=Math.max(0,dashCooldown-dt);

    // Jump
    const wantJump = jumpBuf>0;
    if (wantJump) {
      if (player.onGround || coyote>0) { player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; if(sfxJump){sfxJump.currentTime=0; sfxJump.play().catch(()=>{});} }
      else if (airJumpsUsed < AIR_JUMPS) { airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; if(sfxJump){sfxJump.currentTime=0; sfxJump.play().catch(()=>{});} }
    }

    // Gravité (gelée pendant dash)
    if(dashTimer<=0){
      if (player.vy < 0) player.vy += GRAVITY_UP*dt;
      else               player.vy += GRAVITY_DOWN*dt;
    } else {
      player.vy = 0;
    }

    // Vertical & sol
    player.y += player.vy*dt;
    if (GROUND_Y + player.y > GROUND_Y) { player.y=0; player.vy=0; player.onGround=true; }
    else player.onGround=false;

    // Toits (plates-formes)
    for(const b of buildings){
      // feet position
      const sX = player.x;
      const feetY = GROUND_Y + player.y;
      const top = b.roof.y;
      if (sX > b.roof.x && sX < b.roof.x + b.roof.w) {
        // si on descend et qu'on traverse le top → on se pose
        if (player.vy >= 0 && feetY <= top && feetY + player.vy*dt >= top) {
          player.y += (top - feetY); // colle aux toits
          player.vy = 0; player.onGround = true;
        }
      }
    }

    // Collecte posters (↓/S)
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const feetY=GROUND_Y-110+player.y;
    for(const p of posters){
      const center=p.x + p.w/2;
      const dx=Math.abs(player.x - center);
      const overY=aabb(player.x-22, feetY, 44,110, p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && overY && wantsCollect){
        p.taking=true; p.t=0;
      }
      if(p.taking){
        p.t += dt;
        if(p.t >= COLLECT_DUR){
          p.taking=false; p.taken=true; score++; scoreEl.textContent=String(score);
          if(sfxWanted){ sfxWanted.currentTime=0; sfxWanted.play().catch(()=>{}); }
        }
      }
    }

    // Entrée bâtiment (↓)
    if(wantsCollect){
      for(const b of buildings){
        if(player.x > b.doorX && player.x < b.doorX + b.doorW && Math.abs((GROUND_Y+player.y) - (b.y+b.dh))<120){
          enterInterior(b);
          break;
        }
      }
    }

    // Caméra
    const W=canvas.width/DPR; cameraX=Math.max(0, player.x - W/2);

    // Anim
    player.state = Math.abs(vx)>1e-2 ? 'walk' : 'idle';
    player.animTime += dt;

    // NPCs update
    for(const n of npcs){
      n.animT += dt;
      // face Myo
      n.face = (player.x < n.x) ? 'left' : 'right';
      const dist = Math.abs(player.x - n.x);
      if(dist<=NPC_TALK_RADIUS){
        if(!n.show){ n.dialogImg = pickDialog(n.type); n.show=true; n.hideT=NPC_HIDE_DELAY; }
        else n.hideT = NPC_HIDE_DELAY;
      }else if(n.show){
        n.hideT -= dt; if(n.hideT<=0){ n.show=false; n.dialogImg=null; }
      }
    }

    // Draw world
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_DEN.back);
    if(images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_DEN.mid);
    if(images.front) drawLayer(images.front, PARALLAX.front, VIEW_DEN.front);
    for(const b of buildings) b.animT += dt;
    drawBuildings();
    drawPosters();
    drawNPCs();
    drawMyo(Math.abs(keys.has('ArrowLeft')||keys.has('a')?-MOVE_SPEED:(keys.has('ArrowRight')||keys.has('d')?MOVE_SPEED:0)));
  }

  // ---------- Interior ----------
  let interiorImg=null, interiorOpenIdx=0, hacking=false, hackT=0;
  function enterInterior(building){
    mode='interior'; currentBuilding=building; cameraX=0;
    if(bgm) bgm.pause();
    if(sfxEnter){ sfxEnter.currentTime=0; sfxEnter.play().catch(()=>{}); }
    interiorImg=images.interiorClosed; interiorOpenIdx=0; hacking=false; hackT=0;
    // place Myo à gauche
    player.x=60; player.y=0; player.vy=0; player.onGround=true; player.facing='right';
  }
  function exitInterior(){
    mode='world';
    if(bgm) bgm.play().catch(()=>{});
    if(sfxExit){ sfxExit.currentTime=0; sfxExit.play().catch(()=>{}); }
    // replace Myo devant la porte
    if(currentBuilding){
      player.x = currentBuilding.doorX + currentBuilding.doorW/2;
      player.y = 0; player.vy=0; player.onGround=true;
    }
    currentBuilding=null;
  }

  function updateInterior(dt){
    // mouvement latéral uniquement
    let vx=0;
    if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    player.x = Math.max(0, Math.min(1220, player.x + vx*dt)); // murs gauche/droite soft
    // sol + plafond
    const floorY=INTERIOR_FLOOR_Y, ceilY=INTERIOR_CEIL_Y;
    const MYO_PIX=MYO_H; // hauteur visuelle
    // gravité simple
    if(!player.onGround){ player.vy += GRAVITY_DOWN*dt; }
    player.y += player.vy*dt;
    if(floorY + player.y > floorY){ player.y=0; player.vy=0; player.onGround=true; }
    else player.onGround=false;
    // plafond
    const headY = floorY - MYO_PIX + player.y;
    if(headY < ceilY){ player.y += (ceilY - headY); player.vy=0; }

    // sortie auto à gauche
    if(player.x<=0 && !hacking){ exitInterior(); return; }

    // action ordi (↓) si dans zone
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    if(!hacking && wantsCollect && player.x > TERMINAL_ZONE.x && player.x < TERMINAL_ZONE.x+TERMINAL_ZONE.w){
      hacking=true; hackT=0;
      if(sfxType){ sfxType.currentTime=0; sfxType.play().catch(()=>{}); }
    }
    if(hacking){
      hackT += dt;
      if(hackT>=1.5){
        hacking=false; hackT=0;
        if(sfxDing){ sfxDing.currentTime=0; sfxDing.play().catch(()=>{}); }
        // incrémente egg index une seule fois par building
        if(currentBuilding && !hackedOnce.has(currentBuilding.id)){
          hackedOnce.add(currentBuilding.id);
          eggIndex = Math.min(10, eggIndex+1);
          localStorage.setItem('io83_egg_index', String(eggIndex));
        }
        interiorOpenIdx = Math.max(1, eggIndex);
      }
    }

    // anim + draw interior
    player.state = Math.abs(vx)>1e-2 ? 'walk' : 'idle';
    player.animTime += dt;

    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,Wpx,Hpx);
    const base = interiorOpenIdx>0 ? images.interiorOpens[Math.min(9,interiorOpenIdx-1)] : images.interiorClosed;
    if(base) ctx.drawImage(base, 0, 0, Wpx, Hpx);

    // dessine Myo (caméra fixe)
    const frames=(Math.abs(vx)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(vx)>1e-2?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0];
    if(img){
      const s=MYO_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
      const x=Math.floor(player.x), y=floorY - dh + player.y;
      ctx.save();
      if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,x,y,dw,dh);
      ctx.restore();
    }
  }

  // ---------- Game loop ----------
  function loop(ts){
    const dt=Math.min((ts-last)/1000||0, MAX_DT); last=ts;
    if(mode==='world') updateWorld(dt);
    else               updateInterior(dt);
    requestAnimationFrame(loop);
  }

  // ---------- Boot ----------
  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // Start gate
  startBtn.addEventListener('click', ()=>{
    gate.style.display='none';
    armAudio(); // unmute + play
    boot();
  }, { once:true });

  // Auto-start si touche avant clic
  addEventListener('keydown', function anyKeyStart(){
    if(gate && gate.style.display!=='none'){ startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
