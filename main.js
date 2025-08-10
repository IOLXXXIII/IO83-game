// IO83 – main.js (fix MOVE_SPEED, double jump, pickup ↓ + vibration, audio robuste)

(function(){
  'use strict';

  // ---- Banner diag (affiche erreurs en haut)
  function banner(msg){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:'#b00020',color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  // ---- Canvas/HiDPI
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  // ---- UI/Audio
  const scoreEl=document.getElementById('scoreNum');
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const bgm=document.getElementById('bgm');
  const sfxWanted=document.getElementById('sfxWanted');

  // ---- Parallaxe + zoom 1/6
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_FRAC_DENOM={back:6, mid:6, front:6};
  const LAYER_ALIGN='bottom';
  let FRONT_GROUND_SRC_OFFSET=18; // ajuste 18–26 si besoin

  // ---- Monde/physique
  const WORLD_LEN=8000;
  let cameraX=0;

  // Vitesse horizontale (oublie réparée)
  const MOVE_SPEED=360;

  // Saut plus haut + retombée naturelle + double saut
  const GRAVITY=2700;
  const FALL_MULTIPLIER=1.35;
  const JUMP_VELOCITY=1050;
  const JUMP_CUT_VELOCITY=-260;
  const MAX_JUMPS=2;
  let GROUND_Y=560; // recalculé après load

  // ---- Input
  const keys=new Set();
  addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s','m','M'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if((e.key==='m'||e.key==='M')) tryPlayBGM(); // M pour (re)lancer la musique si bloquée
  });
  addEventListener('keyup',e=>keys.delete(e.key));

  // ---- Player
  const MYO_TARGET_HEIGHT=120;
  const player={ x:200, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0, jumpsLeft:MAX_JUMPS, prevJump:false };

  // ---- Colliders (repoussés pour éviter blocage tôt)
  const solids=[
    { x:2200, w:120, h: 40, type:'rock' },
    { x:2600, w:160, h: 60, type:'rock' },
    { x:3000, w:100, h: 40, type:'rock' },
    { x:3600, w: 40, h:160, type:'wall' },
    { x:3900, w:200, h:120, type:'house' },
    { x:4200, w:140, h: 60, type:'crate' },
    { x:4550, w: 60, h:180, type:'tower' },
    { x:5200, w:320, h: 20, type:'shore' },
    { x:5550, w:260, h: 60, type:'water' },
    { x:6100, w:100, h: 40, type:'rock' },
    { x:6500, w:180, h: 80, type:'cliff' },
  ];

  // ---- Posters (pickup ↓, zone élargie + vibration)
  const posters=[]; const POSTER_SIZE=36; const COLLECT_MARGIN=24; const COLLECT_DUR=0.15; const COLLECT_AMP=6;
  function spawnPosters(){
    const spots=[600,1100,1500,2050,2450,2950,3350,3650,4250,4650,5200,5600,6000,7000,7600];
    posters.length=0;
    for(const x of spots) posters.push({ x, y:-110, w:POSTER_SIZE, h:POSTER_SIZE, taken:false, collecting:false, t:0 });
  }
  spawnPosters();
  let score=0;

  // ---- Assets
  const ASSETS={
    back:'assets/background/bg_far.png',
    mid:'assets/background/bg_mid.png',
    front:'assets/background/ground.png',
    idle:['assets/characters/myo/idle_1.png'],
    walk:['assets/characters/myo/walk_1.png','assets/characters/myo/walk_2.png','assets/characters/myo/walk_3.png','assets/characters/myo/walk_4.png'],
    poster:'assets/collectibles/wanted.png'
  };
  const images={ back:null, mid:null, front:null, idle:[], walk:[], poster:null };
  function tryLoad(src){ return new Promise(r=>{ const i=new Image(); i.onload=()=>r({ok:true,img:i}); i.onerror=()=>r({ok:false}); i.src=src; }); }

  async function loadAll(){
    const miss=[];
    let r;
    r=await tryLoad(ASSETS.back);  if(r.ok) images.back=r.img;  else miss.push(ASSETS.back);
    r=await tryLoad(ASSETS.mid);   if(r.ok) images.mid=r.img;   else miss.push(ASSETS.mid);
    r=await tryLoad(ASSETS.front); if(r.ok) images.front=r.img; else miss.push(ASSETS.front);
    for(const s of ASSETS.idle){ r=await tryLoad(s); if(r.ok) images.idle.push(r.img); else miss.push(s); }
    for(const s of ASSETS.walk){ r=await tryLoad(s); if(r.ok) images.walk.push(r.img); else miss.push(s); }
    r=await tryLoad(ASSETS.poster); if(r.ok) images.poster=r.img;

    if(miss.length) banner('Missing assets → '+miss.join(', '));

    // Sol depuis "front"
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const denom=VIEW_FRAC_DENOM.front||6;
      const frontScale=(denom*W)/images.front.width;
      const groundFromBottom=Math.round(FRONT_GROUND_SRC_OFFSET*frontScale);
      GROUND_Y=H-groundFromBottom;
    }
    const toWorldY=h=>GROUND_Y-h;
    for(const r2 of solids) r2.y=toWorldY(r2.h);
    for(const p of posters) p.y=toWorldY(110);
  }

  // ---- Render
  function drawLayer(img, f, denom){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const scale=(denom*W)/img.width;
    const dw=Math.round(img.width*scale), dh=Math.round(img.height*scale);
    const y=(LAYER_ALIGN==='bottom')?(H-dh):0;
    let xStart=-Math.floor((cameraX*f)%dw); if(xStart>0) xStart-=dw;
    for(let x=xStart;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(){
    const frames=(player.state==='walk')?images.walk:images.idle;
    const fps=(player.state==='walk')?8:4;
    const idx=frames.length>1?Math.floor(player.animTime*fps)%frames.length:0;
    const img=frames[idx]||images.idle[0]; if(!img) return;
    const s=MYO_TARGET_HEIGHT/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const x=Math.floor(player.x-cameraX), y=GROUND_Y-dh+player.y;
    ctx.save();
    if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
    else ctx.drawImage(img,x,y,dw,dh);
    ctx.restore();
  }
  function drawPosters(){
    ctx.save();
    for(const p of posters){
      if(p.taken) continue;
      const sx=p.x-cameraX; if(sx<-60||sx>canvas.width/DPR+60) continue;
      let sy=p.y;
      if(p.collecting){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      if(images.poster) ctx.drawImage(images.poster, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
      else { ctx.fillStyle='#000'; ctx.strokeStyle='#ffe08a'; ctx.lineWidth=2;
             ctx.fillRect(Math.round(sx),Math.round(sy),POSTER_SIZE,POSTER_SIZE);
             ctx.strokeRect(Math.round(sx)+0.5,Math.round(sy)+0.5,POSTER_SIZE-1,POSTER_SIZE-1); }
    }
    ctx.restore();
  }

  // ---- Collisions
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }
  function resolve(px,py,pw,ph,vx,vy){
    const near=solids.filter(r=>Math.abs(r.x-px)<400);
    let nx=px+vx, ny=py+vy;
    for(const r of near){ if(aabb(nx,ny,pw,ph,r.x,r.y,r.w,r.h)){ if(vx>0) nx=r.x-pw; else if(vx<0) nx=r.x+r.w; vx=0; } }
    for(const r of near){ if(aabb(nx,ny,pw,ph,r.x,r.y,r.w,r.h)){ if(vy>0){ ny=r.y-ph; vy=0; player.onGround=true; } else if(vy<0){ ny=r.y+r.h; vy=0; } } }
    return {x:nx,y:ny,vx,vy};
  }

  // ---- Loop
  let last=0; const MAX_DT=1/30;
  function loop(ts){
    const dt=Math.min((ts-last)/1000||0,MAX_DT); last=ts;

    // Input
    let vx=0;
    if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }

    // Jump (double)
    const jump=keys.has('ArrowUp')||keys.has('w');
    if(jump && !player.prevJump){
      if(player.onGround){ player.vy=-JUMP_VELOCITY; player.onGround=false; player.jumpsLeft=MAX_JUMPS-1; }
      else if(player.jumpsLeft>0){ player.vy=-JUMP_VELOCITY*0.9; player.jumpsLeft--; }
    }
    player.prevJump=jump;

    // Gravité (plus forte en chute)
    if(player.vy>0) player.vy += GRAVITY*FALL_MULTIPLIER*dt;
    else            player.vy += GRAVITY*dt;
    if(!jump && player.vy<JUMP_CUT_VELOCITY) player.vy=JUMP_CUT_VELOCITY;

    // Déplacement + collisions
    const pw=44, ph=110;
    const px=player.x, py=GROUND_Y-ph+player.y;
    const res=resolve(px,py,pw,ph, vx*dt, player.vy*dt);
    player.x=Math.max(0,Math.min(WORLD_LEN,res.x));
    player.y=res.y-(GROUND_Y-ph);
    player.vy=res.vy;
    if(GROUND_Y+player.y>GROUND_Y){ player.y=0; player.vy=0; player.onGround=true; }
    if(player.onGround) player.jumpsLeft=MAX_JUMPS;

    // Collecte (↓ / S) — zone élargie + vibration
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    for(const p of posters){
      if(p.taken) continue;
      if(!p.collecting){
        const overlap=aabb(player.x-22, GROUND_Y-110+player.y, 44,110,
                           p.x-COLLECT_MARGIN, p.y-COLLECT_MARGIN, p.w+COLLECT_MARGIN*2, p.h+COLLECT_MARGIN*2);
        if(overlap && wantsCollect){ p.collecting=true; p.t=0; }
      } else {
        p.t+=dt;
        if(p.t>=COLLECT_DUR){
          p.taken=true; score++; scoreEl.textContent=String(score);
          try{ sfxWanted.currentTime=0; sfxWanted.play(); }catch(_){}
        }
      }
    }

    // Caméra + anim
    const W=canvas.width/DPR;
    cameraX=Math.max(0,Math.min(player.x-W/2, WORLD_LEN-W));
    player.state=Math.abs(vx)>1e-2?'walk':'idle';
    player.animTime+=dt;

    // Draw
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_FRAC_DENOM.back);
    if(images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_FRAC_DENOM.mid);
    if(images.front) drawLayer(images.front, PARALLAX.front, VIEW_FRAC_DENOM.front);
    drawPosters(); drawMyo();

    requestAnimationFrame(loop);
  }

  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // ---- Audio helpers
  function tryPlayBGM(){
    if(!bgm) return;
    try{
      bgm.currentTime=0; bgm.volume=0.6;
      const p=bgm.play();
      if(p && p.catch) p.catch(()=>banner('Audio bloqué: presse Start ou M (bgm_iogame.mp3)'));
    }catch(_){ banner('Audio introuvable: assets/audio/bgm_iogame.mp3'); }
  }

  // Start + musique
  startBtn.addEventListener('click', async ()=>{
    gate.style.display='none';
    tryPlayBGM();
    boot();
  }, { once:true });

  // Si l’utilisateur clique/touche le canvas, on retente l’audio
  canvas.addEventListener('pointerdown', tryPlayBGM, { passive:true });

  addEventListener('keydown', function anyKeyStart(){
    if(gate && gate.style.display!=='none'){ startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
