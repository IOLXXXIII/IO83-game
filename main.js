// IO83 – main.js (titre plein écran, start gating, interiors idle->open, scale + spacing, anti-overlap)

(function(){
  'use strict';

  // ---------- Banner erreurs ----------
  function banner(msg, color='#b00020'){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:color,color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d); setTimeout(()=>d.remove(), 5000);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  // ---------- Canvas / HiDPI ----------
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  // ---------- Title / Start ----------
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const title2=document.getElementById('title2');
  let tTitle=0; (function loopTitle(){ tTitle+=0.016; if(title2){ const a=(Math.sin(tTitle*1.4)+1)/2; title2.style.opacity=(a*0.75).toFixed(3); } if(gate && gate.style.display!=='none') requestAnimationFrame(loopTitle); })();

  // ---------- Audio refs ----------
  const bgm=document.getElementById('bgm');
  const sfxWanted=document.getElementById('sfxWanted');
  const sfxDash=document.getElementById('sfxDash');
  const sfxEnter=document.getElementById('sfxEnter');
  const sfxExit =document.getElementById('sfxExit');
  const sfxJump =document.getElementById('sfxJump');
  const sfxType =document.getElementById('sfxType');
  const sfxDing =document.getElementById('sfxDing');
  const sfxFoot =document.getElementById('sfxFoot');
  const sfxDoorLocked=document.getElementById('sfxDoorLocked');

  // BGM : on ne lance qu’au bouton START (gating)
  let gameStarted=false;
  function startAudio(){
    if(bgm){ bgm.volume=0.6; bgm.currentTime=0; bgm.muted=false; bgm.play().catch(()=>{}); }
  }

  // ---------- Parallax ----------
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_DEN={back:6, mid:6, front:6};
  let cameraX=0;

  // ---------- Assets ----------
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
    dashTrail:[ 'assets/fx/dash_trail_1.png'+CB,'assets/fx/dash_trail_2.png'+CB,'assets/fx/dash_trail_3.png'+CB ],
    // NEW: interiors closed idle 1/2, then open_1..10
    interiorClosedIdle:[ 'assets/interiors/interior_closed_idle_1.png'+CB,
                         'assets/interiors/interior_closed_idle_2.png'+CB ],
    interiorOpens:Array.from({length:10},(_,i)=>`assets/interiors/interior_open_${i+1}.png${CB}`)
  };

  const images={
    back:null, mid:null, front:null,
    myoIdle:[], myoWalk:[],
    posterWith:null, posterWithout:null,
    npcs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    dialogs:{aeron:[],kaito:[],maonis:[],kahikoans:[]},
    buildings:[], dashTrail:[],
    interiorClosedIdle:[], interiorOpens:[]
  };

  function loadImgRetry(src){
    return new Promise(res=>{
      const i=new Image();
      i.onload=()=>res(i);
      i.onerror=()=>{
        const plain=src.split('?')[0];
        const j=new Image(); j.onload=()=>res(j); j.onerror=()=>res(null); j.src=plain;
      };
      i.src=src;
    });
  }

  async function loadAll(){
    const miss=[];
    images.back  = await loadImgRetry(ASSETS.back)  || (miss.push(ASSETS.back),null);
    images.mid   = await loadImgRetry(ASSETS.mid)   || (miss.push(ASSETS.mid),null);
    images.front = await loadImgRetry(ASSETS.front) || (miss.push(ASSETS.front),null);

    for(const s of ASSETS.myoIdle){ const i=await loadImgRetry(s); i?images.myoIdle.push(i):miss.push(s); }
    for(const s of ASSETS.myoWalk){ const i=await loadImgRetry(s); i?images.myoWalk.push(i):miss.push(s); }

    images.posterWith    = await loadImgRetry(ASSETS.posterWith)    || (miss.push(ASSETS.posterWith),null);
    images.posterWithout = await loadImgRetry(ASSETS.posterWithout) || (miss.push(ASSETS.posterWithout),null);

    for(const k of Object.keys(ASSETS.npcs)){
      for(const s of ASSETS.npcs[k]){ const i=await loadImgRetry(s); i?images.npcs[k].push(i):miss.push(s); }
    }

    try{
      const r=await fetch(ASSETS.dialogsManifest); const mf=await r.json();
      for(const k of ['aeron','kaito','maonis','kahikoans']){
        const list = mf[k]||[];
        for(const name of list){
          const p=`assets/ui/dialogs/${k}/${name}${CB}`;
          const i=await loadImgRetry(p); if(i) images.dialogs[k].push(i); else miss.push(p);
        }
      }
    }catch(e){ banner('dialogs_manifest.json introuvable ou invalide'); }

    for(const triple of ASSETS.buildings){
      const a=await loadImgRetry(triple[0]); const b=await loadImgRetry(triple[1]);
      images.buildings.push([a,b||a,triple[2]]);
      if(!a) miss.push(triple[0]);
    }

    for(const s of ASSETS.dashTrail){ const i=await loadImgRetry(s); i?images.dashTrail.push(i):miss.push(s); }

    for(const s of ASSETS.interiorClosedIdle){ const i=await loadImgRetry(s); i?images.interiorClosedIdle.push(i):miss.push(s); }
    for(const s of ASSETS.interiorOpens){ const i=await loadImgRetry(s); i?images.interiorOpens.push(i):miss.push(s); }

    if(miss.length) banner('Missing assets → '+miss.join(', '));

    recalcGround();
    for(const p of posters) p.y = GROUND_Y - POSTER_SIZE;

    spawnVillages(); spawnNPCsOnce(); placePostersNonOverlapping();
  }

  // ---------- Ground align ----------
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

  // ---------- Physique & états (scales + speed) ----------
  const MOVE_SPEED=360*1.2;              // +20%
  const MYO_H=120*1.5;                   // +50% → 180px
  const PLAYER_HALF_W=26;

  const GRAVITY_UP=2600, GRAVITY_DOWN=2600*2.2;
  const TARGET_JUMP_HEIGHT=200;
  const JUMP_VELOCITY=Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);

  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  // Dash (double tap) — autorise 2e dash si double-saut utilisé
  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOLDOWN=0.8, DASH_MULT=4;
  let lastTapL=-999, lastTapR=-999, dashTimer=0, dashCooldown=0, airDashUsed=0;

  // Input
  const keys=new Set();
  addEventListener('keydown',e=>{
    if(!gameStarted) return; // pas d’inputs avant START
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s','[',']'].includes(e.key)) e.preventDefault();
    if(e.repeat){ keys.add(e.key); return; }
    keys.add(e.key);
    if(e.key==='ArrowUp'||e.key==='w') jumpBuf=JUMP_BUFFER;
    const t=performance.now()/1000;
    if(e.key==='ArrowRight'||e.key==='d'){ if(t-lastTapR<=DASH_WINDOW) tryDash('right'); lastTapR=t; }
    if(e.key==='ArrowLeft' ||e.key==='a'){ if(t-lastTapL<=DASH_WINDOW) tryDash('left');  lastTapL=t; }
  });
  addEventListener('keyup',e=>{ if(!gameStarted) return; keys.delete(e.key); });

  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0 };
  const scoreEl=document.getElementById('scoreNum'); let score=0;

  // Posters (×1.2)
  const POSTER_SIZE=Math.round(100*1.2); // 120
  const COLLECT_RADIUS=76, COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  (function initPosterSeeds(){ const seg=5000, rep=2, base=[600,1100,1500,2050,2450,2950,3350,3650,4250,4650]; for(let k=0;k<rep;k++){ for(const x of base) posters.push({x:x+k*seg,y:0,w:POSTER_SIZE,h:POSTER_SIZE,taking:false,t:0,taken:false}); } })();

  // Buildings (×1.15) + spacing ×1.5
  const BUILDING_TARGET_H=Math.round(450*1.15);
  const VILLAGE_MIN=2, VILLAGE_MAX=3;
  const VILLAGE_GAP_MIN=Math.round(300*1.5), VILLAGE_GAP_MAX=Math.round(800*1.5);
  const buildings=[]; let nextBuildingId=1;

  function spawnVillages(){
    buildings.length=0;
    const startX=600, endX=(posters.at(-1)?.x||10000)+1800;
    let x=startX;
    while(x<endX){
      const count=(Math.random()<0.65)? randInt(VILLAGE_MIN,VILLAGE_MAX):1;
      for(let i=0;i<count;i++){
        const pick=randInt(0,images.buildings.length-1); const pair=images.buildings[pick]; if(!pair||!pair[0]) continue;
        const typeId=pair[2]; const canEnter=(typeId===2||typeId===3);
        const img=pair[0]; const s=BUILDING_TARGET_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
        const bx=x, by=GROUND_Y-dh; const doorW=140, doorX=bx+Math.round(dw/2-doorW/2);
        // toits plus larges et plus hauts
        const roofW=Math.round(dw*0.9), roofX=bx+Math.round((dw-roofW)/2), roofY=by+Math.round(dh*0.18);
        buildings.push({id:nextBuildingId++, typeId, canEnter, frames:[pair[0],pair[1]||pair[0]], animT:0, x:bx,y:by,dw,dh,doorX,doorW, roof:{x:roofX,y:roofY,w:roofW,h:10}});
        x += dw + randInt(24,60);
      }
      x += randInt(VILLAGE_GAP_MIN, VILLAGE_GAP_MAX);
    }
  }

  // NPCs (grounded, anti-overlap, flip hystérésis, bulles +20%)
  const NPC_H=300, NPC_TALK_RADIUS=140, NPC_HIDE_DELAY=1.0;
  const npcs=[];
  function xIsFreeForNPC(x){
    for(const b of buildings){ if(x > b.x-160 && x < b.x+b.dw+160) return false; }
    for(const n of npcs){ if(Math.abs(n.x-x)<300) return false; }
    for(const p of posters){ if(Math.abs(p.x-x)<260) return false; }
    return true;
  }
  function spawnNPCsOnce(){
    npcs.length=0;
    const slots=[1400,2600,3800,5200,6500,7800,9000,10400];
    for(const t of ['aeron','kaito','maonis','kahikoans']){
      let x=slots[randInt(0,slots.length-1)], tries=80;
      while(tries-- && !xIsFreeForNPC(x)) x += randInt(-400,400);
      const frames=images.npcs[t]; if(!frames||frames.length===0) continue;
      npcs.push({type:t,x,frames,animT:0,face:'right',show:false,hideT:0,dialogImg:null});
    }
  }

  // Dialogs
  function pickDialog(k){ const list=images.dialogs[k]||[]; return list.length? list[(Math.random()*list.length)|0] : null; }

  // Empêcher chevauchement des posters avec bâtiments/PNJ
  function placePostersNonOverlapping(){
    for(const p of posters){
      // décale si trop près
      let moved=false;
      for(const b of buildings){
        if(Math.abs((p.x+p.w/2) - (b.x+b.dw/2)) < (b.dw/2 + 180)){ p.x = b.x + b.dw + 220; moved=true; }
      }
      for(const n of npcs){
        if(Math.abs(p.x - n.x) < 240){ p.x = n.x + 260; moved=true; }
      }
      // petit écart si trop collé au poster précédent
      const prev=posters[posters.indexOf(p)-1];
      if(prev && Math.abs(p.x - prev.x) < 280){ p.x = prev.x + 320; moved=true; }
      if(moved) p.y = GROUND_Y - POSTER_SIZE;
    }
  }

  // Interiors
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentBuilding=null;
  let eggIndex=parseInt(localStorage.getItem('io83_egg_index')||'0',10); const hackedOnce=new Set();

  // Footsteps
  let footArmed=false;
  function playFootsteps(){ if(!sfxFoot) return; if(!footArmed && sfxFoot.readyState>=2){ const dur=sfxFoot.duration||15; sfxFoot.currentTime=Math.random()*Math.max(1,dur-1); footArmed=true; } sfxFoot.playbackRate=0.96+Math.random()*0.08; if(sfxFoot.paused) sfxFoot.play().catch(()=>{}); }
  function stopFootsteps(){ if(sfxFoot && !sfxFoot.paused) sfxFoot.pause(); }

  // Utils
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

  // Render helpers
  function drawLayer(img,f,den){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=H-dh; let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(runVel){
    const frames=(Math.abs(runVel)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(runVel)>1e-2?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0]; if(!img) return;
    const s=MYO_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const x=Math.floor(player.x - cameraX), y=GROUND_Y - dh + player.y;
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
  function drawPosters(){
    for(const p of posters){
      const sx=p.x - cameraX; if(sx<-1200 || sx>canvas.width/DPR+1200) continue;
      let sy=p.y; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      const sprite=p.taken ? images.posterWithout : images.posterWith;
      if(sprite) ctx.drawImage(sprite, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
    }
  }
  function drawBuildings(){
    for(const b of buildings){
      const sx=Math.floor(b.x - cameraX); if(sx<-2000 || sx>canvas.width/DPR+2000) continue;
      const frame = (Math.floor(b.animT*2)%2===0)? b.frames[0]: (b.frames[1]||b.frames[0]);
      if(frame) ctx.drawImage(frame, sx, b.y, b.dw, b.dh);
    }
  }
  function drawNPCs(){
    for(const n of npcs){
      const base=n.frames[0]; if(!base) continue;
      const s=NPC_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      // posés au sol
      const sy=GROUND_Y - dh + 2;
      const sx=Math.floor(n.x - cameraX);
      if(player.x < n.x - 16) n.face='left';
      else if(player.x > n.x + 16) n.face='right';
      const idx=(Math.floor(n.animT*2)%2);
      const img=n.frames[Math.min(idx,n.frames.length-1)]||base;

      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

      if(n.show && n.dialogImg){
        const scale=0.6; // +20%
        const bw=n.dialogImg.width*scale, bh=n.dialogImg.height*scale;
        const bx=sx+Math.round(dw/2 - bw/2), by=sy - bh - 26;
        ctx.drawImage(n.dialogImg, bx, by, bw, bh);
      }
    }
  }

  // Dash
  function tryDash(dir){
    if(dashCooldown>0) return;
    if(!player.onGround){
      const maxDashes = 1 + (airJumpsUsed > 0 ? 1 : 0);
      if(airDashUsed >= maxDashes) return;
      airDashUsed++;
    }else{
      airDashUsed = 0;
    }
    dashTimer=DASH_DUR; dashCooldown=DASH_COOLDOWN; player.facing=dir;
    if(sfxDash){ sfxDash.currentTime=0; sfxDash.play().catch(()=>{}); }
  }

  // Loops
  let last=0; const MAX_DT=1/30;

  function updateWorld(dt){
    let vx=0;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*MOVE_SPEED*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    }
    player.x=Math.max(0, player.x + vx*dt);

    if(player.onGround && Math.abs(vx)>1) playFootsteps(); else stopFootsteps();

    if(player.onGround){ coyote=COYOTE_TIME; airJumpsUsed=0; airDashUsed=0; } else coyote=Math.max(0,coyote-dt);
    jumpBuf=Math.max(0,jumpBuf-dt); dashCooldown=Math.max(0,dashCooldown-dt);

    const wantJump=jumpBuf>0;
    if(wantJump){
      if(player.onGround || coyote>0){ player.vy=-JUMP_VELOCITY; player.onGround=false; jumpBuf=0; if(sfxJump){sfxJump.currentTime=0; sfxJump.play().catch(()=>{});} }
      else if(airJumpsUsed<AIR_JUMPS){ airJumpsUsed++; player.vy=-JUMP_VELOCITY; jumpBuf=0; if(sfxJump){sfxJump.currentTime=0; sfxJump.play().catch(()=>{});} }
    }

    if(dashTimer<=0){ if(player.vy<0) player.vy+=GRAVITY_UP*dt; else player.vy+=GRAVITY_DOWN*dt; } else { player.vy=0; }
    player.y += player.vy*dt;

    if(GROUND_Y + player.y > GROUND_Y){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;

    // Toits one-way indulgents
    for(const b of buildings){
      const feetY = GROUND_Y + player.y;
      const top = b.roof.y;
      const withinX = (player.x + PLAYER_HALF_W > b.roof.x) && (player.x - PLAYER_HALF_W < b.roof.x + b.roof.w);
      if(withinX && player.vy>=0 && feetY>=top-30 && feetY<=top+14){
        player.y += (top - feetY); player.vy=0; player.onGround=true;
      }
    }

    // Collect (↓/S)
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const feetY=GROUND_Y-110+player.y;
    for(const p of posters){
      const center=p.x + p.w/2;
      const dx=Math.abs(player.x - center);
      const overY=aabb(player.x-26, feetY, 52,110, p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && overY && wantsCollect){ p.taking=true; p.t=0; }
      if(p.taking){ p.t+=dt; if(p.t>=COLLECT_DUR){ p.taking=false; p.taken=true; score++; scoreEl.textContent=String(score); if(sfxWanted){sfxWanted.currentTime=0; sfxWanted.play().catch(()=>{});} } }
    }

    // Entrée bâtiment
    if(wantsCollect){
      for(const b of buildings){
        if(player.x>b.doorX && player.x<b.doorX+b.doorW && Math.abs((GROUND_Y+player.y)-(b.y+b.dh))<140){
          if(b.canEnter){ enterInterior(b); break; }
          else if(sfxDoorLocked){ sfxDoorLocked.currentTime=0; sfxDoorLocked.play().catch(()=>{}); }
        }
      }
    }

    // Caméra & anim
    const W=canvas.width/DPR; cameraX=Math.max(0, player.x - W/2);
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;

    // PNJ
    for(const n of npcs){
      n.animT+=dt;
      const dist=Math.abs(player.x-n.x);
      if(dist<=NPC_TALK_RADIUS){ if(!n.show){ n.dialogImg=pickDialog(n.type); n.show=true; n.hideT=NPC_HIDE_DELAY; } else n.hideT=NPC_HIDE_DELAY; }
      else if(n.show){ n.hideT-=dt; if(n.hideT<=0){ n.show=false; n.dialogImg=null; } }
    }

    // Draw
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back, 0.15, 6);
    if(images.mid)   drawLayer(images.mid,  0.45, 6);
    if(images.front) drawLayer(images.front,1.00, 6);
    for(const b of buildings) b.animT+=dt;
    drawBuildings(); drawPosters(); drawNPCs(); drawMyo(vx);
  }

  // Intérieurs
  function enterInterior(b){
    mode='interior'; currentBuilding=b; cameraX=0;
    stopFootsteps();
    if(bgm) bgm.pause();
    if(sfxEnter){ sfxEnter.currentTime=0; sfxEnter.play().catch(()=>{}); }
    interiorOpenIdx=0; hacking=false; hackT=0;
    player.x=60; player.y=0; player.vy=0; player.onGround=true; player.facing='right';
  }
  function exitInterior(){
    mode='world';
    if(bgm) bgm.play().catch(()=>{});
    if(sfxExit){ sfxExit.currentTime=0; sfxExit.play().catch(()=>{}); }
    if(currentBuilding){ player.x=currentBuilding.doorX + currentBuilding.doorW/2; player.y=0; player.vy=0; player.onGround=true; }
    currentBuilding=null;
  }

  function updateInterior(dt){
    let vx=0;
    if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    player.x=Math.max(0, Math.min(1220, player.x + vx*dt));

    const floorY=620, ceilY=120;
    if(!player.onGround) player.vy += GRAVITY_DOWN*dt;
    player.y += player.vy*dt;
    if(floorY + player.y > floorY){ player.y=0; player.vy=0; player.onGround=true; } else player.onGround=false;
    const headY = floorY - MYO_H + player.y; if(headY<ceilY){ player.y+=(ceilY-headY); player.vy=0; }

    // sortie auto gauche
    if(player.x<=0 && !hacking){ exitInterior(); return; }

    // ordi (↓) -> type puis ding -> passe en "open_N"
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    if(!hacking && wantsCollect && player.x>980 && player.x<1140){ hacking=true; hackT=0; if(sfxType){ sfxType.currentTime=0; sfxType.play().catch(()=>{}); } }
    if(hacking){
      hackT+=dt;
      if(hackT>=1.5){
        hacking=false; hackT=0;
        if(sfxDing){ sfxDing.currentTime=0; sfxDing.play().catch(()=>{}); }
        if(currentBuilding && !hackedOnce.has(currentBuilding.id)){
          hackedOnce.add(currentBuilding.id); eggIndex=Math.min(10, eggIndex+1); localStorage.setItem('io83_egg_index', String(eggIndex));
        }
        interiorOpenIdx=Math.max(1, eggIndex);
      }
    }

    // draw interior
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,Wpx,Hpx);

    // avant ding : animé closed_idle_1/2 ; après ding : open_N figé
    if(interiorOpenIdx===0){
      const frames=images.interiorClosedIdle;
      const idx=frames.length>1 ? Math.floor(player.animTime*2)%frames.length : 0;
      const img=frames[idx]||frames[0];
      if(img) ctx.drawImage(img,0,0,Wpx,Hpx);
    }else{
      const base=images.interiorOpens[Math.min(9,interiorOpenIdx-1)];
      if(base) ctx.drawImage(base,0,0,Wpx,Hpx);
    }

    // Myo
    const frames2=(Math.abs(vx)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(vx)>1e-2?8:4);
    const idx2=frames2.length>1 ? Math.floor(player.animTime*fps)%frames2.length : 0;
    const img2=frames2[idx2]||images.myoIdle[0];
    if(img2){ const s=MYO_H/img2.height, dw=Math.round(img2.width*s), dh=Math.round(img2.height*s);
      const x=Math.floor(player.x), y=floorY - dh + player.y;
      ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img2,0,0,dw,dh); } else ctx.drawImage(img2,x,y,dw,dh); ctx.restore();
    }
  }

  // Boucle principale
  function loop(ts){ const dt=Math.min((ts-last)/1000||0, 1/30); last=ts; if(mode==='world') updateWorld(dt); else updateInterior(dt); requestAnimationFrame(loop); }

  // ---------- Boot ----------
  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // ---------- START gating ----------
  startBtn.addEventListener('click', ()=>{
    if(gameStarted) return;
    gameStarted=true;
    if(sfxEnter){ try{ sfxEnter.currentTime=0; sfxEnter.play(); }catch(_){ } }
    gate.style.display='none';
    startAudio();
    // on arme les inputs après START seulement
    boot();
  }, {once:true});
})();
