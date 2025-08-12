// IO83 – patch : start gating clean, intérieurs idle->open, cam Y follow, anti-overlap ++,
// PNJ au sol, bulles décalées, bâtiments/toits solides, vitesse +15%, 2e dash aérien fiable.

(function(){
  'use strict';

  /* ------------------ helpers ------------------ */
  function banner(msg, color='#b00020'){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:color,color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d); setTimeout(()=>d.remove(), 5000);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  const rndInt=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const aabb=(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;

  /* ------------------ canvas ------------------ */
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  /* ------------------ title / start ------------------ */
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const title2=document.getElementById('title2');
  let tTitle=0; (function loopTitle(){ tTitle+=0.016; if(title2){ const a=(Math.sin(tTitle*1.4)+1)/2; title2.style.opacity=(a*0.75).toFixed(3); } if(gate && gate.style.display!=='none') requestAnimationFrame(loopTitle); })();

  /* ------------------ audio ------------------ */
  const bgm=document.getElementById('bgm');
  const sfx={ wanted:document.getElementById('sfxWanted'),
              dash:document.getElementById('sfxDash'),
              enter:document.getElementById('sfxEnter'),
              exit:document.getElementById('sfxExit'),
              jump:document.getElementById('sfxJump'),
              type:document.getElementById('sfxType'),
              ding:document.getElementById('sfxDing'),
              foot:document.getElementById('sfxFoot'),
              doorLocked:document.getElementById('sfxDoorLocked') };

  // volumes : BGM intact, SFX -20%
  const SFX_VOL=0.8;
  Object.values(sfx).forEach(a=>{ if(a){ a.volume=Math.min(1,(a.volume||1)*SFX_VOL); }});
  if(sfx.foot) sfx.foot.volume = Math.min(1,(sfx.foot.volume||1)*0.7); // un peu plus doux

  let gameStarted=false;
  function startAudio(){ if(bgm){ bgm.volume=0.6; bgm.currentTime=0; bgm.muted=false; bgm.play().catch(()=>{}); } }
  function fadeTo(audio, target, ms=300){ if(!audio) return;
    const step=(target-audio.volume)/(ms/50); const id=setInterval(()=>{ audio.volume=Math.max(0,Math.min(1,audio.volume+step)); if(Math.abs(audio.volume-target)<0.02){ audio.volume=target; clearInterval(id);} },50);
  }

  /* ------------------ parallax ------------------ */
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_DEN={back:6, mid:6, front:6};
  let cameraX=0;
  let camYOffset=0; // suivi vertical doux (back/mid uniquement)

  /* ------------------ assets ------------------ */
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
      i.onerror=()=>{ const p=src.split('?')[0]; const j=new Image(); j.onload=()=>res(j); j.onerror=()=>res(null); j.src=p; };
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
        const list=mf[k]||[]; for(const name of list){
          const p=`assets/ui/dialogs/${k}/${name}${CB}`; const i=await loadImgRetry(p);
          if(i) images.dialogs[k].push(i); else miss.push(p);
        }
      }
    }catch{ banner('dialogs_manifest.json introuvable ou invalide'); }

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
    posters.forEach(p=>p.y = GROUND_Y - POSTER_SIZE);

    spawnVillages();
    spawnNPCsOnce();
    placePostersNonOverlapping();
  }

  /* ------------------ ground align ------------------ */
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

  /* ------------------ physics & state ------------------ */
  const SPEED_MULT = 1.2 * 1.15;           // +20% puis +15%
  const MOVE_SPEED = 360 * SPEED_MULT;     // ≈ 497 px/s
  const MYO_H      = 120 * 1.5;            // 180 px
  const PLAYER_HALF_W=26;

  const GRAVITY_UP=2600, GRAVITY_DOWN=2600*2.2;
  const TARGET_JUMP_HEIGHT=200;
  const JUMP_VELOCITY=Math.sqrt(2*GRAVITY_UP*TARGET_JUMP_HEIGHT);

  const AIR_JUMPS=1; let airJumpsUsed=0;
  const COYOTE_TIME=0.10, JUMP_BUFFER=0.12; let coyote=0, jumpBuf=0;

  // Dash : 2e dash aérien possible après 2e saut, cooldown aérien raccourci
  const DASH_WINDOW=0.22, DASH_DUR=0.18, DASH_COOLDOWN_GROUND=0.6, DASH_COOLDOWN_AIR=0.28, DASH_MULT=4;
  let lastTapL=-999, lastTapR=-999, dashTimer=0, dashCooldown=0, airDashUsed=0;

  const keys=new Set();
  addEventListener('keydown',e=>{
    if(!gameStarted) return; // pas d’input avant START
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

  /* ------------------ posters (×1.2) ------------------ */
  const POSTER_SIZE=Math.round(100*1.2);
  const COLLECT_RADIUS=76, COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  (function seedPosters(){
    const seg=5000, rep=2;
    let x=600;
    for(let k=0;k<rep;k++){
      for(let i=0;i<10;i++){
        x += rndInt(380,850); // moins systématique
        posters.push({x:x+k*seg,y:0,w:POSTER_SIZE,h:POSTER_SIZE,taking:false,t:0,taken:false});
      }
    }
  })();

  /* ------------------ buildings (×1.15, spacing ×1.5) ------------------ */
  const BUILDING_TARGET_H=Math.round(450*1.15);
  const VILLAGE_MIN=2, VILLAGE_MAX=3;
  const VILLAGE_GAP_MIN=Math.round(300*1.5), VILLAGE_GAP_MAX=Math.round(800*1.5);
  const buildings=[]; let nextBuildingId=1;

  function spawnVillages(){
    buildings.length=0;
    const startX=600, endX=(posters.at(-1)?.x||10000)+1800;
    let x=startX;
    while(x<endX){
      const count=(Math.random()<0.65)? rndInt(VILLAGE_MIN,VILLAGE_MAX):1;
      for(let i=0;i<count;i++){
        const pair=images.buildings[rndInt(0,images.buildings.length-1)];
        if(!pair||!pair[0]) continue;
        const typeId=pair[2]; const canEnter=(typeId===2||typeId===3);
        const img=pair[0]; const s=BUILDING_TARGET_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
        const bx=x, by=GROUND_Y-dh;
        // porte = TOUTE la largeur (souhait)
        const doorW=dw, doorX=bx;
        // toit plus haut/large
        const roofW=Math.round(dw*0.92), roofX=bx+Math.round((dw-roofW)/2), roofY=by+Math.round(dh*0.18);
        buildings.push({id:nextBuildingId++, typeId, canEnter, frames:[pair[0],pair[1]||pair[0]], animT:0, x:bx,y:by,dw,dh,doorX,doorW, roof:{x:roofX,y:roofY,w:roofW,h:12}});
        x += dw + rndInt(28,64);
      }
      x += rndInt(VILLAGE_GAP_MIN, VILLAGE_GAP_MAX);
    }
  }

  /* ------------------ NPCs (au sol, counts, anti-overlap) ------------------ */
  const NPC_H=300, NPC_TALK_RADIUS=140, NPC_HIDE_DELAY=1.0;
  const npcs=[];

  function xIsFree(x){
    for(const b of buildings){ if(x > b.x-200 && x < b.x+b.dw+200) return false; }
    for(const n of npcs){ if(Math.abs(n.x-x)<320) return false; }
    for(const p of posters){ if(Math.abs(p.x-x)<300) return false; }
    return true;
  }

  function spawnNPCsOnce(){
    npcs.length=0;
    const counts={ aeron:1, kaito:1, maonis:2, kahikoans:3 };
    const endX=(posters.at(-1)?.x||10000)+1200;
    let tries=0;
    for(const t of Object.keys(counts)){
      for(let c=0;c<counts[t];c++){
        let x=rndInt(900,endX-900); tries=120;
        while(tries-- && !xIsFree(x)) x += rndInt(-500,500);
        const frames=images.npcs[t]; if(!frames?.length) continue;
        npcs.push({type:t,x,frames,animT:0,face:'right',show:false,hideT:0,dialogImg:null});
      }
    }
  }

  function pickDialog(k){ const list=images.dialogs[k]||[]; return list.length? list[(Math.random()*list.length)|0] : null; }

  /* ------------------ poster placement anti-overlap ------------------ */
  function placePostersNonOverlapping(){
    posters.sort((a,b)=>a.x-b.x);
    for(let i=0;i<posters.length;i++){
      const p=posters[i];
      // push away from buildings
      for(const b of buildings){
        const minGap = 240 + b.dw*0.1;
        if(Math.abs(p.x - (b.x + b.dw/2)) < (b.dw/2 + minGap)) p.x = b.x + b.dw + minGap;
      }
      // push from npcs (after spawn)
      for(const n of npcs){ if(Math.abs(p.x-n.x)<280) p.x = n.x + 300; }
      // push from previous posters
      if(i>0 && p.x - posters[i-1].x < 320) p.x = posters[i-1].x + 340;
      p.y = GROUND_Y - POSTER_SIZE;
    }
  }

  /* ------------------ interiors ------------------ */
  let mode='world', interiorOpenIdx=0, hacking=false, hackT=0, currentBuilding=null;
  let eggIndex = parseInt(localStorage.getItem('io83_egg_index')||'0',10); // démarre bien à 0 → 1 sera le premier
  const hackedOnce=new Set();

  /* ------------------ footsteps ------------------ */
  let footArmed=false;
  function playFoot(){ const a=sfx.foot; if(!a) return; if(!footArmed && a.readyState>=2){ const d=a.duration||15; a.currentTime=Math.random()*Math.max(1,d-1); footArmed=true; } a.playbackRate=0.96+Math.random()*0.08; if(a.paused) a.play().catch(()=>{}); }
  function stopFoot(){ const a=sfx.foot; if(a && !a.paused) a.pause(); }

  /* ------------------ render helpers ------------------ */
  function drawLayer(img,f,den, yParallax=0){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(H-dh) + yParallax;
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
      const sx=p.x - cameraX; if(sx<-1400 || sx>canvas.width/DPR+1400) continue;
      let sy=p.y; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      const sprite=p.taken ? images.posterWithout : images.posterWith;
      if(sprite) ctx.drawImage(sprite, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
    }
  }
  function drawBuildings(){ for(const b of buildings){
    const sx=Math.floor(b.x - cameraX); if(sx<-2200 || sx>canvas.width/DPR+2200) continue;
    const frame=(Math.floor(b.animT*2)%2===0)? b.frames[0]:(b.frames[1]||b.frames[0]);
    if(frame) ctx.drawImage(frame, sx, b.y, b.dw, b.dh);
  } }
  function drawNPCs(){
    for(const n of npcs){
      const base=n.frames[0]; if(!base) continue;
      const s=NPC_H/base.height, dw=Math.round(base.width*s), dh=Math.round(base.height*s);
      const sy=GROUND_Y - dh;                // POSÉ AU SOL
      const sx=Math.floor(n.x - cameraX);
      if(player.x < n.x - 16) n.face='left'; else if(player.x > n.x + 16) n.face='right';
      const idx=(Math.floor(n.animT*2)%2); const img=n.frames[Math.min(idx,n.frames.length-1)]||base;

      ctx.save();
      if(n.face==='left'){ ctx.translate(sx+dw/2,sy); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
      else ctx.drawImage(img,sx,sy,dw,dh);
      ctx.restore();

      if(n.show && n.dialogImg){
        const scale=0.6;
        const bw=n.dialogImg.width*scale, bh=n.dialogImg.height*scale;
        // Décalage : à gauche de la moitié de sa largeur, et baissée de la moitié de sa hauteur
        const bx = sx + Math.round(dw/2 - bw*1.0);
        const by = sy - Math.round(bh*0.5);
        ctx.drawImage(n.dialogImg, bx, by, bw, bh);
      }
    }
  }

  /* ------------------ dash ------------------ */
  function tryDash(dir){
    if(dashCooldown>0) return;
    if(!player.onGround){
      const maxDashes = 1 + (airJumpsUsed > 0 ? 1 : 0);
      if(airDashUsed >= maxDashes) return;
      airDashUsed++;
      dashCooldown = DASH_COOLDOWN_AIR;   // cooldown court en l’air
    }else{
      airDashUsed = 0;
      dashCooldown = DASH_COOLDOWN_GROUND;
    }
    dashTimer=DASH_DUR; player.facing=dir;
    if(sfx.dash){ sfx.dash.currentTime=0; sfx.dash.play().catch(()=>{}); }
  }

  /* ------------------ world loop ------------------ */
  let last=0, prevFeetY=0;
  function updateWorld(dt){
    let vx=0;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*MOVE_SPEED*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    }
    player.x=Math.max(0, player.x + vx*dt);

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

    // toits one-way robustes (collision uniquement si on descend et qu'on croise le plan)
    for(const b of buildings){
      const feetY = GROUND_Y + player.y;
      const top   = b.roof.y;
      const withinX = (player.x + PLAYER_HALF_W > b.roof.x) && (player.x - PLAYER_HALF_W < b.roof.x + b.roof.w);
      if(withinX && player.vy>=0 && prevFeetY<=top && feetY>=top-2){
        player.y += (top - feetY); player.vy=0; player.onGround=true;
      }
    }

    // collect
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const feetY=GROUND_Y-110+player.y;
    for(const p of posters){
      const center=p.x + p.w/2, dx=Math.abs(player.x - center);
      const overY=aabb(player.x-26, feetY, 52,110, p.x,p.y,p.w,p.h);
      if(!p.taken && !p.taking && dx<=COLLECT_RADIUS && overY && wantsCollect){ p.taking=true; p.t=0; }
      if(p.taking){ p.t+=dt; if(p.t>=COLLECT_DUR){ p.taking=false; p.taken=true; score++; scoreEl.textContent=String(score); if(sfx.wanted){sfx.wanted.currentTime=0; sfx.wanted.play().catch(()=>{});} } }
    }

    // building enter / locked (porte = toute la largeur)
    if(wantsCollect){
      for(const b of buildings){
        if(player.x>b.doorX && player.x<b.doorX+b.doorW && Math.abs((GROUND_Y+player.y)-(b.y+b.dh))<150){
          if(b.canEnter){ enterInterior(b); break; }
          else if(sfx.doorLocked){ sfx.doorLocked.currentTime=0; sfx.doorLocked.play().catch(()=>{}); }
        }
      }
    }

    // caméra : X classique, Y suit 20% de -player.y, amorti
    const W=canvas.width/DPR; cameraX=Math.max(0, player.x - W/2);
    const targetYOffset = -player.y * 0.2;
    camYOffset += (targetYOffset - camYOffset) * Math.min(1, dt*8); // lissage

    // anim & draw
    player.state=Math.abs(vx)>1e-2?'walk':'idle'; player.animTime+=dt;
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back, 0.15, 6, camYOffset*0.6);
    if(images.mid)   drawLayer(images.mid,  0.45, 6, camYOffset*0.85);
    if(images.front) drawLayer(images.front,1.00, 6, 0); // ground collé
    for(const b of buildings) b.animT+=dt;
    drawBuildings(); drawPosters(); drawNPCs(); drawMyo(vx);
  }

  /* ------------------ interiors loop ------------------ */
  function enterInterior(b){
    mode='interior'; currentBuilding=b; cameraX=0;
    stopFoot();
    // Musique continue à ~20% du volume (0.6 → 0.12)
    if(bgm) fadeTo(bgm,0.12,250);
    interiorOpenIdx=0; hacking=false; hackT=0;
    player.x=60; player.y=6; player.vy=0; player.onGround=true; player.facing='right'; // posé correctement
  }
  function exitInterior(){
    mode='world';
    if(bgm) fadeTo(bgm,0.6,250);
    if(sfx.exit){ sfx.exit.currentTime=0; sfx.exit.play().catch(()=>{}); }
    if(currentBuilding){ player.x=currentBuilding.doorX + currentBuilding.doorW/2; player.y=0; player.vy=0; player.onGround=true; }
    currentBuilding=null;
  }

  function updateInterior(dt){
    // mêmes contrôles (marche, saut, double saut, dash)
    let vx=0;
    if(dashTimer>0){ vx=(player.facing==='right'?1:-1)*MOVE_SPEED*DASH_MULT; dashTimer-=dt; }
    else{
      if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
      if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }
    }
    player.x=Math.max(0, Math.min(1220, player.x + vx*dt));

    // sauts
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

    // sortie auto gauche
    if(player.x<=0 && !hacking){ exitInterior(); return; }

    // ordi : zone = de 4/5 de l'écran jusqu'au bord droit (plus souple)
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const termX0=Math.floor(1280*0.80);
    if(!hacking && wantsCollect && player.x>=termX0){ hacking=true; hackT=0; if(sfx.type){ sfx.type.currentTime=0; sfx.type.play().catch(()=>{}); } }
    if(hacking){
      hackT+=dt;
      if(hackT>=1.5){
        hacking=false; hackT=0;
        if(sfx.ding){ sfx.ding.currentTime=0; sfx.ding.play().catch(()=>{}); }
        if(currentBuilding && !hackedOnce.has(currentBuilding.id)){
          hackedOnce.add(currentBuilding.id);
          // progression stricte 1→10
          eggIndex = Math.min(10, eggIndex+1);
          localStorage.setItem('io83_egg_index', String(eggIndex));
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

    // Myo
    const frames2=(Math.abs(vx)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(vx)>1e-2?8:4);
    const idx2=frames2.length>1 ? Math.floor(player.animTime*fps)%frames2.length : 0;
    const img2=frames2[idx2]||images.myoIdle[0];
    if(img2){
      const s=MYO_H/img2.height, dw=Math.round(img2.width*s), dh=Math.round(img2.height*s);
      const x=Math.floor(player.x), y=floorY - dh + player.y + 2; // visuel “pieds posés”
      ctx.save(); if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img2,0,0,dw,dh); } else ctx.drawImage(img2,x,y,dw,dh); ctx.restore();
    }
  }

  function loop(ts){ const dt=Math.min((ts-last)/1000||0, 1/30); last=ts; if(mode==='world') updateWorld(dt); else updateInterior(dt); requestAnimationFrame(loop); }

  /* ------------------ boot & start ------------------ */
  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  startBtn.addEventListener('click', ()=>{
    if(gameStarted) return;
    gameStarted=true;
    // pas de SFX “porte” ici (tu ne l’aimais pas) → simple start audio + hide gate
    gate.style.display='none';
    startAudio();
    boot();
  }, {once:true});

})();
