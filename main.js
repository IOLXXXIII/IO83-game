// IO83 – socle: jump fixe "wave", double jump, no swap de sprites, affiches ajustées

(function(){
  'use strict';

  // --- Banner erreurs
  function banner(msg){
    const d=document.createElement('div'); d.textContent=msg;
    Object.assign(d.style,{position:'fixed',top:'0',left:'0',right:'0',padding:'8px 12px',
      background:'#b00020',color:'#fff',font:'12px/1.2 monospace',zIndex:'9999'});
    document.body.appendChild(d);
  }
  window.addEventListener('error', e=>banner('JS error → '+(e?.error?.message||e?.message||'unknown')));

  // --- Canvas HiDPI
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d',{alpha:false});
  const DPR=Math.max(1,Math.floor(window.devicePixelRatio||1));
  function resize(){ const w=1280,h=720; canvas.width=w*DPR; canvas.height=h*DPR; ctx.imageSmoothingEnabled=false; ctx.setTransform(DPR,0,0,DPR,0,0); }
  resize(); addEventListener('resize',resize);

  // --- UI + audio (pré-armé muet; on dé-mute à la 1re interaction)
  const scoreEl=document.getElementById('scoreNum');
  const gate=document.getElementById('gate');
  const startBtn=document.getElementById('startBtn');
  const bgm=document.getElementById('bgm');
  const sfx=document.getElementById('sfxWanted');

  let bgmArmed=false;
  function prewarmBGM(){ if(!bgm) return; try{ bgm.loop=true; bgm.volume=0; bgm.muted=true; const p=bgm.play(); if(p&&p.catch) p.catch(()=>{});}catch(_){}} 
  function fadeTo(el,to=0.6,ms=700){ const v0=el.volume,t0=performance.now(); function step(t){ const k=Math.min(1,(t-t0)/ms); el.volume=v0+(to-v0)*k; if(k<1) requestAnimationFrame(step);} requestAnimationFrame(step); }
  function armBGM(){ if(!bgm||bgmArmed) return; bgmArmed=true; bgm.muted=false; if(bgm.volume===0) bgm.volume=0.01; fadeTo(bgm,0.6,700); }
  prewarmBGM();
  function onFirstInteract(){ armBGM(); }
  addEventListener('keydown', onFirstInteract, {once:true});
  canvas.addEventListener('pointerdown', onFirstInteract, {once:true, passive:true});

  // --- Parallaxe & zoom
  const PARALLAX={back:0.15, mid:0.45, front:1.0};
  const VIEW_DEN={back:6, mid:6, front:6}; // 1/6 visible
  const LAYER_ALIGN='bottom';
  let FRONT_GROUND_SRC_OFFSET=18;
  let cameraX=0;

  // --- Physique & mouvement
  const MOVE_SPEED=360;
  const MYO_H=120;

  // Jump "Towerfall-like" (fixe) : montée rapide -> ralentit -> chute plus rapide
  // Hauteur cible ~5× Myo ≈ 600 px (fixe)
  const GRAVITY_UP   = 2600;       // gravité pendant montée
  const GRAVITY_DOWN = 2600*2.2;   // chute 2.2× plus rapide
  const JUMP_VELOCITY = Math.sqrt(2*GRAVITY_UP*600); // ~1766 px/s pour 600 px de hauteur
  const MAX_JUMPS = 2;
  const COYOTE_TIME = 0.10;        // tolérance après avoir quitté le sol
  const JUMP_BUFFER = 0.12;        // tampon d'appui
  let coyote = 0, jumpBuf = 0;

  let GROUND_Y=560; // recalculé après load

  // --- Input
  const keys=new Set();
  addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if(e.key==='ArrowUp'||e.key==='w') jumpBuf = JUMP_BUFFER;   // buffer de saut
  });
  addEventListener('keyup',e=>keys.delete(e.key));

  // --- Player (Myo uniquement)
  const player={ x:0, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0, jumpsLeft:MAX_JUMPS };

  // --- Monde: pas d'obstacles (pas de murs), seulement affiches
  const POSTER_SIZE=46;                 // un poil + grand
  const POSTER_Y_ABOVE_GROUND=150;      // un peu + haut
  const COLLECT_RADIUS=56;
  const COLLECT_DUR=0.15, COLLECT_AMP=6;
  const posters=[];
  (function spawn(){
    const segLen=5000, repeats=2;
    const base=[600,1100,1500,2050,2450,2950,3350,3650,4250,4650];
    for(let k=0;k<repeats;k++){
      for(const x of base) posters.push({ x:x+k*segLen, y:0, w:POSTER_SIZE, h:POSTER_SIZE, taking:false, t:0, taken:false });
    }
  })();
  let score=0;

  // --- Assets (cache-bust pour éviter mélange Myo/Kaito)
  const CB='?cb='+Date.now();
  const ASSETS={
    back :'assets/background/bg_far.png'+CB,
    mid  :'assets/background/bg_mid.png'+CB,
    front:'assets/background/ground.png'+CB,
    myoIdle:['assets/characters/myo/idle_1.png'+CB],
    myoWalk:[
      'assets/characters/myo/walk_1.png'+CB,
      'assets/characters/myo/walk_2.png'+CB,
      'assets/characters/myo/walk_3.png'+CB,
      'assets/characters/myo/walk_4.png'+CB
    ],
    poster:'assets/collectibles/wanted.png'+CB
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

    // recalcul du sol via le layer "front"
    const W=canvas.width/DPR, H=canvas.height/DPR;
    if(images.front){
      const scale=(VIEW_DEN.front*W)/images.front.width;
      const groundFromBottom=Math.round(FRONT_GROUND_SRC_OFFSET*scale);
      GROUND_Y=H-groundFromBottom;
    }
    const toWorldY=h=>GROUND_Y-h;
    for(const p of posters) p.y=toWorldY(POSTER_Y_ABOVE_GROUND);
  }

  // --- Rendu
  function drawLayer(img,f,den){
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const s=(den*W)/img.width, dw=Math.round(img.width*s), dh=Math.round(img.height*s);
    const y=(LAYER_ALIGN==='bottom')?(H-dh):0;
    let x0=-Math.floor((cameraX*f)%dw); if(x0>0) x0-=dw;
    for(let x=x0;x<W;x+=dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }
  function drawMyo(){
    const frames=(Math.abs(hVel)>1e-2?images.myoWalk:images.myoIdle);
    const fps=(Math.abs(hVel)>1e-2?8:4);
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

  // --- Util collisions (pour le pickup seulement ici)
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){ return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by; }

  // --- Boucle
  let last=0; const MAX_DT=1/30;
  let hVel=0; // pour l'anim
  function loop(ts){
    const dt=Math.min((ts-last)/1000||0,MAX_DT); last=ts;

    // Horizontal
    hVel = 0;
    if(keys.has('ArrowRight')||keys.has('d')){ hVel+=MOVE_SPEED; player.facing='right'; }
    if(keys.has('ArrowLeft') ||keys.has('a')){ hVel-=MOVE_SPEED; player.facing='left'; }
    player.x = Math.max(0, player.x + hVel*dt); // gauche bloquée, droite libre

    // Timers qualité de vie
    if(player.onGround) coyote = COYOTE_TIME; else coyote = Math.max(0, coyote - dt);
    jumpBuf = Math.max(0, jumpBuf - dt);

    // Déclenchement saut (fixe, double)
    const wantJump = jumpBuf > 0;
    if (wantJump && (player.onGround || coyote > 0 || player.jumpsLeft > 0)) {
      // si pas sur le sol et pas en coyote, on consomme un saut aérien
      if (!player.onGround && coyote<=0) player.jumpsLeft--;
      player.vy = -JUMP_VELOCITY; // hauteur fixe
      player.onGround = false;
      jumpBuf = 0; // on consomme le buffer
    }

    // Gravité "wave": plus faible à la montée, plus forte à la descente
    if (player.vy < 0) player.vy += GRAVITY_UP   * dt; // monte (vy négatif)
    else               player.vy += GRAVITY_DOWN * dt; // tombe (vy positif)

    // Vertical
    player.y += player.vy * dt;
    if (GROUND_Y + player.y > GROUND_Y) { // contact sol
      player.y=0; player.vy=0; if(!player.onGround){ player.onGround=true; player.jumpsLeft=MAX_JUMPS; }
    } else {
      player.onGround=false;
    }

    // Collecte (↓/S), zone symétrique large
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

    // Caméra (fixe à gauche, libre à droite)
    const W=canvas.width/DPR;
    cameraX=Math.max(0, player.x - W/2);

    // Anim
    player.state = Math.abs(hVel)>1e-2 ? 'walk' : 'idle';
    player.animTime += dt;

    // Draw
    const Wpx=canvas.width/DPR, Hpx=canvas.height/DPR;
    ctx.fillStyle='#0d0f14'; ctx.fillRect(0,0,Wpx,Hpx);
    if(images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_DEN.back);
    if(images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_DEN.mid);
    if(images.front) drawLayer(images.front, PARALLAX.front, VIEW_DEN.front);
    drawPosters(); drawMyo();

    requestAnimationFrame(loop);
  }

  // --- Chargement
  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // Start
  startBtn.addEventListener('click', ()=>{
    gate.style.display='none';
    armBGM();
    boot();
  }, { once:true });

  // Auto-start si touche avant clic
  addEventListener('keydown', function anyKeyStart(){
    if(gate && gate.style.display!=='none'){ startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
