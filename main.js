// IO83 – main.js (socle stable : double saut fort, affiches OK, audio pré-armé, défilement infini droite)

(function(){
  'use strict';

  // --- petite bannière d’erreurs
  function banner(msg){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:'#b00020',color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  // --- canvas HiDPI
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  // --- UI + audio
  const scoreEl=document.getElementById('scoreNum');
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const bgm=document.getElementById('bgm');
  const sfx=document.getElementById('sfxWanted');

  // Pré-armement audio : joue muet, on dé-mute à la 1re interaction
  let bgmArmed=false;
  function prewarmBGM(){
    if(!bgm) return;
    try{ bgm.loop=true; bgm.volume=0; bgm.muted=true; const p=bgm.play(); if(p&&p.catch) p.catch(()=>{});}catch(_){}
  }
  function fadeTo(el,to=0.6,ms=800){
    const v0=el.volume, t0=performance.now();
    function step(t){ const k=Math.min(1,(t-t0)/ms); el.volume=v0+(to-v0)*k; if(k<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  function armBGM(){ if(!bgm || bgmArmed) return; bgmArmed=true; bgm.muted=false; if(bgm.volume===0) bgm.volume=0.01; fadeTo(bgm,0.6,800); }
  prewarmBGM();
  function onFirstInteract(){ armBGM(); }
  addEventListener('keydown', onFirstInteract, { once:true });
  canvas.addEventListener('pointerdown', onFirstInteract, { once:true, passive:true });

  // --- parallax & zoom
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_DEN={back:6, mid:6, front:6}; // 1/6 visible
  const LAYER_ALIGN='bottom';
  let FRONT_GROUND_SRC_OFFSET=18;
  let cameraX=0;

  // --- physique / déplacements
  const MOVE_SPEED=360;
  const MYO_H=120;

  // Double saut très haut (~5× hauteur Myo ≈ 600 px)
  const GRAVITY=3000;
  const JUMP_VELOCITY=1900;      // 1er et 2e saut identiques
  const FALL_MULTIPLIER=2.2;     // chute plus rapide
  const JUMP_CUT_VELOCITY=-260;  // coupe la montée si on relâche ↑
  const MAX_JUMPS=2;
  let GROUND_Y=560;              // recalculé après load

  // --- input
  const keys=new Set();
  addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
  });
  addEventListener('keyup',e=>keys.delete(e.key));

  // --- player (Myo uniquement)
  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0, jumpsLeft:MAX_JUMPS, prevJump:false };

  // --- monde minimal : on enlève les colliders pour supprimer tout “mur”
  const solids=[];

  // --- affiches (un peu plus grandes et plus hautes)
  const POSTER_SIZE=42;
  const POSTER_Y_ABOVE_GROUND=130;
  const COLLECT_RADIUS=56;         // zone symétrique autour du centre de l’affiche
  const COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  (function spawnPosters(){
    const segLen=5000, repeats=2; // 2 segments à droite (tu peux augmenter)
    const base=[600,1100,1500,2050,2450,2950,3350,3650,4250,4650];
    for(let k=0;k<repeats;k++){
      for(const x of base) posters.push({ x:x+k*segLen, y:0, w:POSTER_SIZE, h:POSTER_SIZE, taking:false, t:0, taken:false });
    }
  })();
  let score=0;

  // --- assets (chemins = ta structure)
  const ASSETS={
    back:'assets/background/bg_far.png',
    mid :'assets/background/bg_mid.png',
    front:'assets/background/ground.png',
    myoIdle:['assets/characters/myo/idle_1.png'],
    myoWalk:['assets/characters/myo/walk_1.png','assets/characters/myo/walk_2.png','assets/characters/myo/walk_3.png','assets/characters/myo/walk_4.png'],
    poster:'assets/collectibles/wanted.png'
  };
  const images={ back:null, mid:null, front:null, myoIdle:[], myoWalk:[], poster:null };
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

    // recalcul du sol depuis le layer “front”
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const scale=(VIEW_DEN.front*W)/images.front.width;
      const groundFromBottom=Math.round(FRONT_GROUND_SRC_OFFSET*scale);
      GROUND_Y=H-groundFromBottom;
    }
    const toWorldY=h=>GROUND_Y-h;
    for(const p of posters) p.y=toWorldY(POSTER_Y_ABOVE_GROUND);
  }

  // --- rendu
  function drawLayer(img,f,den){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(LAYER_ALIGN==='bottom')?(H-dh):0;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(){
    const frames=(player.state==='walk'?images.myoWalk:images.myoIdle);
    const fps=(player.state==='walk'?8:4);
    const idx=frames.length>1 ? Math.floor(player.animTime*fps)%frames.length : 0;
    const img=frames[idx] || images.myoIdle[0]; if(!img) return;

    const s=MYO_H/img.height, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const x=Math.floor(player.x - cameraX), y=GROUND_Y - dh + player.y;

    ctx.save();
    if(player.facing==='left'){ ctx.translate(x+dw/2,y); ctx.scale(-1,1); ctx.translate(-dw/2,0); ctx.drawImage(img,0,0,dw,dh); }
    else ctx.drawImage(img,x,y,dw,dh);
    ctx.restore();
  }
  function drawPosters(){
    for(const p of posters){
      if(p.taken) continue;
      const sx=p.x - cameraX; if(sx<-120 || sx>canvas.width/DPR+120) continue;
      let sy=p.y; if(p.taking){ const k=Math.min(1,p.t/COLLECT_DUR); sy -= Math.sin(k*Math.PI)*COLLECT_AMP; }
      if(images.poster) ctx.drawImage(images.poster, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
      else { ctx.fillStyle='#000'; ctx.strokeStyle='#ffe08a'; ctx.fillRect(Math.round(sx),Math.round(sy),POSTER_SIZE,POSTER_SIZE); ctx.strokeRect(Math.round(sx)+0.5,Math.round(sy)+0.5,POSTER_SIZE-1,POSTER_SIZE-1); }
    }
  }

  // --- collisions util (au cas où on remettra des obstacles plus tard)
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

  // --- boucle
  let last=0; const MAX_DT=1/30;
  function loop(ts){
    const dt=Math.min((ts-last)/1000||0,MAX_DT); last=ts;

    // input horizontal
    let vx=0;
    if(keys.has('ArrowRight')||keys.has('d')){ vx+=MOVE_SPEED; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ vx-=MOVE_SPEED; player.facing='left'; }

    // sauts (double, hauteur élevée)
    const jump=keys.has('ArrowUp')||keys.has('w');
    if(jump && !player.prevJump){
      if(player.onGround){ player.vy=-JUMP_VELOCITY; player.onGround=false; player.jumpsLeft=MAX_JUMPS-1; }
      else if(player.jumpsLeft>0){ player.vy=-JUMP_VELOCITY; player.jumpsLeft--; }
    }
    player.prevJump=jump;

    // gravité + chute plus rapide
    if(player.vy>0) player.vy += GRAVITY*FALL_MULTIPLIER*dt;
    else            player.vy += GRAVITY*dt;
    if(!jump && player.vy<JUMP_CUT_VELOCITY) player.vy=JUMP_CUT_VELOCITY;

    // déplacement (pas de murs → pas de clamp à droite; gauche bloquée à 0)
    player.x = Math.max(0, player.x + vx*dt);

    // sol (pas d’obstacles verticaux pour l’instant)
    player.y += player.vy*dt;
    if (GROUND_Y + player.y > GROUND_Y) { player.y=0; player.vy=0; player.onGround=true; }
    else player.onGround=false;
    if(player.onGround) player.jumpsLeft=MAX_JUMPS;

    // collecte affiches (↓ / S), zone symétrique large + vibration
    const wantsCollect=keys.has('ArrowDown')||keys.has('s');
    const feetY=GROUND_Y-110+player.y;
    for(const p of posters){
      if(p.taken) continue;
      if(!p.taking){
        const center=p.x + p.w/2;
        const dx=Math.abs(player.x - center);
        const overY=aabb(player.x-22, feetY, 44,110, p.x,p.y,p.w,p.h);
        if(dx<=COLLECT_RADIUS && overY && wantsCollect){ p.taking=true; p.t=0; }
      } else {
        p.t += dt;
        if(p.t >= COLLECT_DUR){
          p.taken=true; score++; scoreEl.textContent=String(score);
          try{ sfx.currentTime=0; sfx.play(); }catch(_){}
        }
      }
    }

    // caméra : clamp gauche, libre à droite
    const W=canvas.width/DPR;
    cameraX=Math.max(0, player.x - W/2);

    // anim
    player.state = Math.abs(vx)>1e-2 ? 'walk' : 'idle';
    player.animTime += dt;

    // draw
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_DEN.back);
    if(images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_DEN.mid);
    if(images.front) drawLayer(images.front, PARALLAX.front, VIEW_DEN.front);
    drawPosters(); drawMyo();

    requestAnimationFrame(loop);
  }

  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // start
  startBtn.addEventListener('click', ()=>{
    gate.style.display='none';
    armBGM(); // dé-mute + fade-in si pas déjà fait
    boot();
  }, { once:true });

  // auto-start si touche pressée avant clic
  addEventListener('keydown', function anyKeyStart(){
    if(gate && gate.style.display!=='none'){ startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
