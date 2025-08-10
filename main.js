// IO83 – main.js (high double-jump, no right wall, NPC bubbles, posters FX, audio prewarm)

(function(){
  'use strict';

  // ---------- Helpers ----------
  function banner(msg){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:'#b00020',color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  // ---------- Canvas / HiDPI ----------
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  // ---------- UI & Audio ----------
  const scoreEl=document.getElementById('scoreNum');
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const bgm=document.getElementById('bgm');
  const sfxWanted=document.getElementById('sfxWanted');

  // Pre-warm audio (joue muet au chargement, unmute au 1er geste)
  let bgmArmed=false;
  function prewarmBGM(){
    if(!bgm) return;
    try{ bgm.loop=true; bgm.volume=0; bgm.muted=true; const p=bgm.play(); if(p&&p.catch) p.catch(()=>{});}catch(_){}
  }
  function fadeTo(el, to=0.6, ms=800){
    const start=el.volume, t0=performance.now();
    function step(t){
      const k=Math.min(1,(t-t0)/ms);
      el.volume=start+(to-start)*k;
      if(k<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function armBGM(){
    if(!bgm || bgmArmed) return;
    bgmArmed=true; bgm.muted=false; if(bgm.volume===0) bgm.volume=0.01; fadeTo(bgm,0.6,800);
  }
  prewarmBGM(); // lance muet dès le load

  // ---------- Parallax / Layout ----------
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_DEN={back:6, mid:6, front:6};      // 1/6 visible (zoom)
  const LAYER_ALIGN='bottom';
  let FRONT_GROUND_SRC_OFFSET=18;               // ajuste si pieds flottent
  let cameraX=0;

  // ---------- Physics ----------
  const MOVE_SPEED=360;
  const MYO_H=120;

  // Saut ~5× hauteur Myo ≈ 600 px avec g terrestre ~3000 → v0 ≈ 1900
  const GRAVITY=3000;
  const JUMP_VELOCITY=1900;     // premier ET second saut
  const FALL_MULTIPLIER=2.2;    // chute plus rapide
  const JUMP_CUT_VELOCITY=-260; // coupe la montée si on relâche ↑
  const MAX_JUMPS=2;
  let GROUND_Y=560;             // recalculé après load

  // ---------- Input ----------
  const keys=new Set();
  function onInteract(){ armBGM(); }
  addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(e.key)) e.preventDefault();
    keys.add(e.key); onInteract();
  });
  addEventListener('keyup',e=>keys.delete(e.key));
  canvas.addEventListener('pointerdown', onInteract, {passive:true});

  // ---------- Player (toujours Myo) ----------
  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0, jumpsLeft:MAX_JUMPS, prevJump:false };
  const images={ back:null, mid:null, front:null, myoIdle:[], myoWalk:[], poster:null };

  // ---------- World props ----------
  // Base "segment" qu’on répète (colliders/posters dupliqués 2×)
  const SEG_LEN=5000;
  const SEG_REPEATS=2; // tu peux passer à 3 pour + long
  const solidsBase=[
    { x: 800, w:120, h: 40 }, { x:1200, w:160, h: 60 }, { x:1600, w:100, h: 40 },
    { x:2300, w: 40, h:160 }, { x:2600, w:200, h:120 }, { x:3100, w:140, h: 60 },
    { x:3400, w: 60, h:180 }, { x:4550, w:320, h: 20 }, { x:4870, w:260, h: 60 },
  ];
  const postersBaseX=[600,1100,1500,2050,2450,2950,3350,3650,4250,4650];
  const POSTER_SIZE=42;  // un poil plus grand
  const POSTER_Y_ABOVE_GROUND=130; // un peu plus haut
  const COLLECT_RADIUS=56; // zone large symétrique
  const COLLECT_DUR=0.15, COLLECT_AMP=6;

  // Étend sur 2 segments à droite
  const solids=[]; const posters=[];
  function buildWorld(){
    solids.length=0; posters.length=0;
    for(let k=0;k<SEG_REPEATS;k++){
      const off=k*SEG_LEN;
      for(const s of solidsBase) solids.push({ x:s.x+off, w:s.w, h:s.h, y:0 });
      for(const x of postersBaseX) posters.push({ id:`${k}:${x}`, x:x+off, y:0, w:POSTER_SIZE, h:POSTER_SIZE, taking:false, t:0, taken:false });
    }
  }
  buildWorld();

  // ---------- NPCs ----------
  const NPC_DEFS={
    aeron:     { path:'assets/characters/aeron/idle_1.png', lines:[
      "Too much blood spilled... not enough justice.",
      "Stay cautious, the Kahi are preparing something—I can feel it.",
      "From your look, you’re up to something… admit it, haha!",
      "I’m going to the Redpill to dance tonight. Coming?",
      "I saw your WANTED posters everywhere—they’re stepping up the hunt!"
    ]},
    kaito:     { path:'assets/characters/kaito/idle_1.png', lines:[
      "My head’s still spinning—I just crash—uh, landed!",
      "Once I’m steady, I’ll head toward the city.",
      "This ship won’t go any further… not so sturdy after all, huh?",
      "Good news: I’m officially fired—for good."
    ]},
    maonis:    { path:'assets/characters/maonis/idle_1.png', lines:[
      "The winds are changing, stranger. Don’t linger here.",
      "Sometimes, silence is the loudest warning.",
      "Every light casts a shadow—remember that.",
      "A bird’s silence says more than its song.",
      "A sharp ear hears trouble before it arrives.",
      "What you seek might already be seeking you."
    ]},
    kahikoans: { path:'assets/characters/kahikoans/idle_1.png', lines:[
      "I’m tasked with keeping the peace—don’t come closer.",
      "I’ve got my eye on you—you look like the rebel Myo.",
      "Order must be maintained. Move along.",
      "Only the powerful can make this world prosper.",
      "Without the Kahi Koans, there would be chaos.",
      "Sometimes force is needed to keep peace.",
      "We’re actively searching for dangerous rebels. Move along."
    ]}
  };
  const NPC_TARGET_H=120;
  const npcs=[]; // {x,y,img,lines,talkT,text}
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ---------- Assets ----------
  const ASSETS={
    back:'assets/background/bg_far.png',
    mid :'assets/background/bg_mid.png',
    front:'assets/background/ground.png',
    myoIdle:['assets/characters/myo/idle_1.png'],
    myoWalk:['assets/characters/myo/walk_1.png','assets/characters/myo/walk_2.png','assets/characters/myo/walk_3.png','assets/characters/myo/walk_4.png'],
    poster:'assets/collectibles/wanted.png'
  };
  function tryLoad(src){ return new Promise(res=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; }); }

  async function loadAll(){
    const miss=[];
    images.back  = await tryLoad(ASSETS.back)  || (miss.push(ASSETS.back), null);
    images.mid   = await tryLoad(ASSETS.mid)   || (miss.push(ASSETS.mid), null);
    images.front = await tryLoad(ASSETS.front) || (miss.push(ASSETS.front), null);
    for(const s of ASSETS.myoIdle){ const i=await tryLoad(s); i?images.myoIdle.push(i):miss.push(s); }
    for(const s of ASSETS.myoWalk){ const i=await tryLoad(s); i?images.myoWalk.push(i):miss.push(s); }
    images.poster = await tryLoad(ASSETS.poster);

    if(miss.length) banner('Missing assets → '+miss.join(', '));

    // Sol depuis "front"
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const scale=(VIEW_DEN.front*W)/images.front.width;
      const groundFromBottom=Math.round(FRONT_GROUND_SRC_OFFSET*scale);
      GROUND_Y=H-groundFromBottom;
    }
    const toWorldY=h=>GROUND_Y-h;
    for(const s of solids) s.y=toWorldY(s.h);
    for(const p of posters) p.y=toWorldY(POSTER_Y_ABOVE_GROUND);

    // NPCs (aléatoires, 1 par ~segment/zone)
    const slots=[1400, 2800, 4100, 5400, 6800, 8200];
    for(const x of slots){
      const t=pick(Object.keys(NPC_DEFS)); const def=NPC_DEFS[t];
      const img=await tryLoad(def.path); if(!img) continue;
      npcs.push({ x, y:toWorldY(110), img, lines:def.lines, talkT:0, text:"" });
    }
  }

  // ---------- Render ----------
  function drawLayer(img,f,den){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(LAYER_ALIGN==='bottom')?(H-dh):0;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawSprite(img,targetH,worldX,worldY,flip=false){
    const s=targetH/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const x=Math.floor(worldX-cameraX), y=GROUND_Y-dh+worldY;
    ctx.save();
    if(flip){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
    else     ctx.drawImage(img,x,y,dw,dh);
    ctx.restore();
    return {x, y, dw, dh};
  }
  function drawBubble(x,y,text){
    ctx.save();
    ctx.font='14px monospace';
    const pad=8, w=ctx.measureText(text).width+pad*2, h=24;
    const bx=Math.round(x-w/2), by=Math.round(y-h-18);
    ctx.fillStyle='#fff'; ctx.fillRect(bx,by,w,h);
    ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.strokeRect(bx+0.5,by+0.5,w-1,h-1);
    ctx.beginPath(); ctx.moveTo(x-6,by+h-0.5); ctx.lineTo(x+6,by+h-0.5); ctx.lineTo(x,by+h+8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#111'; ctx.fillText(text,bx+pad,by+16);
    ctx.restore();
  }

  function drawMyo(){
    const frames=(player.state==='walk'?images.myoWalk:images.myoIdle);
    const fps=(player.state==='walk'?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0]; if(!img) return;
    drawSprite(img, MYO_H, player.x, player.y, player.facing==='left');
  }
  function drawPosters(){
    for(const p of posters){
      if(p.taken) continue;
      const sx=p.x-cameraX; if(sx<-100 || sx>canvas.width/DPR+100) continue;
      let sy=p.y; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      if(images.poster) ctx.drawImage(images.poster, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
      else { ctx.fillStyle='#000'; ctx.strokeStyle='#ffe08a'; ctx.fillRect(Math.round(sx),Math.round(sy),POSTER_SIZE,POSTER_SIZE); ctx.strokeRect(Math.round(sx)+0.5,Math.round(sy)+0.5,POSTER_SIZE-1,POSTER_SIZE-1); }
    }
  }
  function drawNPCs(){
    for(const npc of npcs){
      const spr=drawSprite(npc.img, NPC_TARGET_H, npc.x, npc.y, false);
      if(npc.talkT>0) drawBubble(spr.x+spr.dw/2, spr.y-6, npc.text);
    }
  }

  // ---------- Collisions ----------
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
  function resolve(px,py,pw,ph,vx,vy){
    const near=solids.filter(r=>Math.abs(r.x - px) < 600);
    let nx=px+vx, ny=py+vy;
    for(const r of near){ if(aabb(nx,ny,pw,ph,r.x,r.y,r.w,r.h)){ if(vx>0) nx=r.x-pw; else if(vx<0) nx=r.x+r.w; vx=0; } }
    for(const r of near){ if(aabb(nx,ny,pw,ph,r.x,r.y,r.w,r.h)){ if(vy>0){ ny=r.y-ph; vy=0; player.onGround=true; } else if(vy<0){ ny=r.y+r.h; vy=0; } } }
    return {x:nx,y:ny,vx,vy};
  }

  // ---------- Loop ----------
  let last=0; const MAX_DT=1/30; let score=0;
  function loop(ts){
    const dt=Math.min((ts-last)/1000||0,MAX_DT); last=ts;

    // Horizontal
    let vx=0;
    if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }

    // Jumps (double)
    const jump=keys.has('ArrowUp')||keys.has('w');
    if(jump && !player.prevJump){
      if(player.onGround){ player.vy=-JUMP_VELOCITY; player.onGround=false; player.jumpsLeft=MAX_JUMPS-1; }
      else if(player.jumpsLeft>0){ player.vy=-JUMP_VELOCITY; player.jumpsLeft--; }
    }
    player.prevJump=jump;

    // Gravité (chute plus rapide)
    if(player.vy>0) player.vy += GRAVITY*FALL_MULTIPLIER*dt;
    else            player.vy += GRAVITY*dt;
    if(!jump && player.vy<JUMP_CUT_VELOCITY) player.vy=JUMP_CUT_VELOCITY;

    // Déplacements + collisions
    const pw=44, ph=110;
    const px=player.x, py=GROUND_Y-ph+player.y;
    const res=resolve(px,py,pw,ph, vx*dt, player.vy*dt);
    // Gauche bloquée, droite libre
    player.x=Math.max(0, res.x);
    player.y=res.y-(GROUND_Y-ph);
    player.vy=res.vy;
    if(GROUND_Y+player.y>GROUND_Y){ player.y=0; player.vy=0; player.onGround=true; }
    if(player.onGround) player.jumpsLeft=MAX_JUMPS;

    // Posters (↓/S) — zone symétrique autour du centre
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const feetY=GROUND_Y-110+player.y;
    for(const p of posters){
      if(p.taken) continue;
      if(!p.taking){
        const center=p.x+p.w/2;
        const dx=Math.abs(player.x-center);
        const overY=aabb(player.x-22,feetY,44,110, p.x,p.y,p.w,p.h);
        if(dx<=COLLECT_RADIUS && overY && wantsCollect){ p.taking=true; p.t=0; }
      } else {
        p.t+=dt;
        if(p.t>=COLLECT_DUR){
          p.taken=true; score++; scoreEl.textContent=String(score);
          try{ sfxWanted.currentTime=0; sfxWanted.play(); }catch(_){}
        }
      }
    }

    // PNJ talk (↓/S)
    for(const npc of npcs){
      if(npc.talkT>0){ npc.talkT-=dt; continue; }
      const dx=Math.abs(player.x - npc.x);
      if(dx<=60 && wantsCollect){ npc.text = pick(npc.lines); npc.talkT=2.8; }
    }

    // Caméra : clamp à gauche, libre à droite
    const W=canvas.width/DPR;
    cameraX=Math.max(0, player.x - W/2);

    // Anim
    player.state=Math.abs(vx)>1e-2?'walk':'idle';
    player.animTime+=dt;

    // Draw
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_DEN.back);
    if(images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_DEN.mid);
    if(images.front) drawLayer(images.front, PARALLAX.front, VIEW_DEN.front);
    drawPosters(); drawNPCs(); drawMyo();

    requestAnimationFrame(loop);
  }

  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // Start
  startBtn.addEventListener('click', ()=>{
    gate.style.display='none';
    armBGM(); // unmute & fade-in
    boot();
  }, { once:true });

  // Auto-start si touche pressée avant le clic Start
  addEventListener('keydown', function anyKeyStart(){
    if(gate && gate.style.display!=='none'){ startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });
})();
