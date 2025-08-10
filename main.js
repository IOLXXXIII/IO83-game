// IO83 – Robust start (works even if some assets fail)
// Controls: ← → move, ↑ jump

(function(){
  'use strict';

  // Canvas & HiDPI
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  function resize() {
    const w = 960, h = 540;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  addEventListener('resize', resize);

  // UI
  const scoreEl  = document.getElementById('scoreNum');
  const gate     = document.getElementById('gate');
  const startBtn = document.getElementById('startBtn');
  const bgm      = document.getElementById('bgm');
  const sfxWanted= document.getElementById('sfxWanted');

  // Parallax + zoom (1/6 de l’image visible en largeur)
  const PARALLAX = { back: 0.15, mid: 0.45, front: 1.0 };
  const VIEW_FRAC_DENOM = { back: 6, mid: 6, front: 6 };
  const LAYER_ALIGN = 'bottom';
  let FRONT_GROUND_SRC_OFFSET = 22; // ajuste 18–26 si les pieds flottent

  // Monde & physique
  const WORLD_LEN = 6200;
  let cameraX = 0;

  const GRAVITY = 1800;
  const JUMP_VELOCITY = 800;
  const MOVE_SPEED = 340;
  let GROUND_Y = 440;

  // Input
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','a','d','w'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
  });
  addEventListener('keyup', (e) => keys.delete(e.key));

  // Player
  const MYO_TARGET_HEIGHT = 120;
  const player = { x:200, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0 };

  // Colliders (hauteurs relatives; y fixé après load)
  const solids = [
    { x:  800, w:120, h: 40, type:'rock' },
    { x: 1200, w:160, h: 60, type:'rock' },
    { x: 1600, w:100, h: 40, type:'rock' },
    { x: 2300, w: 40, h:160, type:'wall' },
    { x: 2600, w:200, h:120, type:'house' },
    { x: 3100, w:140, h: 60, type:'crate' },
    { x: 3400, w: 60, h:180, type:'tower' },
    { x: 4550, w:320, h: 20, type:'shore' },
    { x: 4870, w:260, h: 60, type:'water' }, // solide pour v0
    { x: 5400, w:100, h: 40, type:'rock' },
    { x: 5750, w:180, h: 80, type:'cliff' },
  ];

  // Posters
  const posters = []; const POSTER_SIZE = 36;
  function spawnPosters(){
    const spots = [600,1100,1500,2050,2450,2950,3350,3650,4250,4650,5200,5600,6000];
    posters.length = 0;
    for (const x of spots) posters.push({ x, y:-110, w:POSTER_SIZE, h:POSTER_SIZE, taken:false });
  }
  spawnPosters();
  let score = 0;

  // ===== Robust loader (noms EXACTS) =====
  const ASSETS = {
    back: 'assets/background/bg_far.png',
    mid:  'assets/background/bg_mid.png',
    front:'assets/background/ground.png',
    idle: ['assets/characters/idle_1.png'],
    walk: ['assets/characters/walk_1.png','assets/characters/walk_2.png','assets/characters/walk_3.png','assets/characters/walk_4.png']
  };
  const images = { back:null, mid:null, front:null, idle:[], walk:[] };

  function tryLoad(src){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload  = () => resolve({ ok:true, img, src });
      img.onerror = () => resolve({ ok:false, img:null, src });
      img.src = src;
    });
  }

  async function loadAllSafe(){
    const missing = [];

    // layers
    for (const key of ['back','mid','front']) {
      const res = await tryLoad(ASSETS[key]);
      if (res.ok) images[key] = res.img; else missing.push(ASSETS[key]);
    }
    // characters
    for (const s of ASSETS.idle) {
      const r = await tryLoad(s); if (r.ok) images.idle.push(r.img); else missing.push(s);
    }
    for (const s of ASSETS.walk) {
      const r = await tryLoad(s); if (r.ok) images.walk.push(r.img); else missing.push(s);
    }

    // Bandeau si fichiers manquants
    if (missing.length) {
      const div = document.createElement('div');
      div.textContent = 'Missing assets → ' + missing.join(', ');
      div.style.position='fixed'; div.style.top='0'; div.style.left='0'; div.style.right='0';
      div.style.padding='8px 12px'; div.style.background='#b00020'; div.style.color='#fff';
      div.style.font='12px/1.2 monospace'; div.style.zIndex='9';
      document.body.appendChild(div);
    }

    // Même si des images manquent, on calcule le sol (sinon fallback par défaut)
    const W = canvas.width / DPR, H = canvas.height / DPR;
    if (images.front) {
      const denom = VIEW_FRAC_DENOM.front || 6;
      const frontScale = (denom * W) / images.front.width;
      const groundFromBottom = Math.round(FRONT_GROUND_SRC_OFFSET * frontScale);
      GROUND_Y = H - groundFromBottom;
    }

    const toWorldY = (h) => GROUND_Y - h;
    for (const r of solids)  r.y = toWorldY(r.h);
    for (const p of posters) p.y = toWorldY(110);
  }

  // ===== Render helpers =====
  function drawLayer(img, parallaxFactor, denom) {
    const W = canvas.width / DPR, H = canvas.height / DPR;
    const scale = (denom * W) / img.width;     // montre 1/denom de l'image
    const dw = Math.round(img.width * scale);
    const dh = Math.round(img.height * scale);
    const y  = (LAYER_ALIGN === 'bottom') ? (H - dh) : 0;

    let xStart = -Math.floor((cameraX * parallaxFactor) % dw);
    if (xStart > 0) xStart -= dw;

    for (let x = xStart; x < W; x += dw) ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
  }

  function drawMyo() {
    const frames = player.state === 'walk' ? images.walk : images.idle;
    const fps = player.state === 'walk' ? 8 : 4;
    const idx = frames.length > 1 ? Math.floor(player.animTime * fps) % frames.length : 0;
    const img = frames[idx] || images.idle[0]; // fallback
    if (!img) return;
    const scale = MYO_TARGET_HEIGHT / img.height;
    const dw = Math.round(img.width * scale);
    const dh = Math.round(img.height * scale);
    const screenX = Math.floor(player.x - cameraX);
    const screenY = GROUND_Y - dh + player.y;

    ctx.save();
    if (player.facing === 'left') {
      ctx.translate(screenX + dw/2, screenY);
      ctx.scale(-1, 1);
      ctx.translate(-dw/2, 0);
      ctx.drawImage(img, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, screenX, screenY, dw, dh);
    }
    ctx.restore();
  }

  function drawPosters() {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 2;
    for (const p of posters) {
      if (p.taken) continue;
      const sx = p.x - cameraX, sy = p.y;
      if (sx < -60 || sx > canvas.width/DPR + 60) continue;
      ctx.fillRect(Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
      ctx.strokeRect(Math.round(sx)+0.5, Math.round(sy)+0.5, POSTER_SIZE-1, POSTER_SIZE-1);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffe08a';
      ctx.fillText('WANTED', Math.round(sx)+3, Math.round(sy)+13);
    }
    ctx.restore();
  }

  // Collisions
  function aabb(ax, ay, aw, ah, bx, by, bw, bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function resolveCollisions(px, py, pw, ph, vx, vy) {
    const near = solids.filter(r => Math.abs(r.x - px) < 600);
    let nx = px + vx, ny = py + vy;
    for (const r of near) {
      if (aabb(nx, ny, pw, ph, r.x, r.y, r.w, r.h)) {
        if (vx > 0) nx = r.x - pw; else if (vx < 0) nx = r.x + r.w;
        vx = 0;
      }
    }
    for (const r of near) {
      if (aabb(nx, ny, pw, ph, r.x, r.y, r.w, r.h)) {
        if (vy > 0) { ny = r.y - ph; vy = 0; player.onGround = true; }
        else if (vy < 0) { ny = r.y + r.h; vy = 0; }
      }
    }
    return { x: nx, y: ny, vx, vy };
  }

  // Loop
  let last = 0; const MAX_DT = 1/30;
  function loop(ts){
    const dt = Math.min((ts - last) / 1000 || 0, MAX_DT); last = ts;
    // Update
    let vx = 0;
    if (keys.has('ArrowRight') || keys.has('d')) { vx += MOVE_SPEED; player.facing = 'right'; }
    if (keys.has('ArrowLeft')  || keys.has('a')) { vx -= MOVE_SPEED; player.facing = 'left'; }
    const wantJump = keys.has('ArrowUp') || keys.has('w');
    if (wantJump && player.onGround) { player.vy = -JUMP_VELOCITY; player.onGround = false; }
    player.vy += GRAVITY * dt;
    const pw = 44, ph = 110;
    const px = player.x, py = GROUND_Y - ph + player.y;
    const res = resolveCollisions(px, py, pw, ph, vx * dt, player.vy * dt);
    player.x = Math.max(0, Math.min(WORLD_LEN, res.x));
    player.y = res.y - (GROUND_Y - ph);
    player.vy = res.vy;
    if (GROUND_Y + player.y > GROUND_Y) { player.y = 0; player.vy = 0; player.onGround = true; }
    const W = canvas.width / DPR;
    cameraX = Math.max(0, Math.min(player.x - W/2, WORLD_LEN - W));
    player.state = Math.abs(vx) > 1e-2 ? 'walk' : 'idle';
    player.animTime += dt;
    for (const p of posters) {
      if (!p.taken && aabb(player.x-22, GROUND_Y-110+player.y, 44, 110, p.x, p.y, p.w, p.h)) {
        p.taken = true; score++; scoreEl.textContent = String(score);
        try { sfxWanted.currentTime = 0; sfxWanted.play(); } catch(e) {}
      }
    }

    // Draw
    const Wpx = canvas.width / DPR, Hpx = canvas.height / DPR;
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, Wpx, Hpx);
    if (images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_FRAC_DENOM.back);
    if (images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_FRAC_DENOM.mid);
    if (images.front) drawLayer(images.front, PARALLAX.front, VIEW_FRAC_DENOM.front);
    drawPosters();
    drawMyo();

    requestAnimationFrame(loop);
  }

  // Boot (NE JETTE PAS si assets manquent)
  async function boot(){
    await loadAllSafe();
    requestAnimationFrame(loop);
  }

  // Start gate
  startBtn.addEventListener('click', async () => {
    gate.style.display = 'none';
    try { await bgm.play(); } catch(_) {}
    boot();
  }, { once: true });

  addEventListener('keydown', function anyKeyStart(){
    if (gate.style.display !== 'none') { startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
