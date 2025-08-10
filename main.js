// IO83 – Browser 2D Prototype (Canvas 2D)
// Controls: ← → to move, ↑ to jump. Collect WANTED posters.
// Backgrounds expected ~1262×267 (ok).

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

  // UI & audio
  const scoreEl = document.getElementById('scoreNum');
  const gate = document.getElementById('gate');
  const startBtn = document.getElementById('startBtn');
  const bgm = document.getElementById('bgm');
  const sfxWanted = document.getElementById('sfxWanted');

  // Parallaxe + zoom
  const PARALLAX = { back: 0.15, mid: 0.45, front: 1.0 };
  // => on ne voit qu'1/denom de l’image en largeur (donc ici 1/6)
  const VIEW_FRAC_DENOM = { back: 6, mid: 6, front: 6 };
  const LAYER_ALIGN = 'bottom'; // colle en bas
  // Décalage des pieds (en pixels SOURCE du front layer depuis le bas)
  // Ajuste 18–26 si besoin pour tomber pile sur ton sol.
  let FRONT_GROUND_SRC_OFFSET = 22;

  // Monde
  const WORLD_LEN = 6200;
  let cameraX = 0;

  // Physique
  const GRAVITY = 1800;
  const JUMP_VELOCITY = 800;
  const MOVE_SPEED = 340;
  let GROUND_Y = 440; // recalculé après chargement

  // Input
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','a','d','w'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
  });
  addEventListener('keyup',   (e) => keys.delete(e.key));

  // Player
  const MYO_TARGET_HEIGHT = 120;
  const player = { x: 200, y: 0, vy: 0, onGround: true, facing: 'right', state: 'idle', animTime: 0, w: 60, h: 120 };

  // Colliders (hauteurs relatives au sol; y sera fixé après load)
  const solids = [];
  solids.push(
    { x:  800, w: 120, h:  40, type: 'rock' },
    { x: 1200, w: 160, h:  60, type: 'rock' },
    { x: 1600, w: 100, h:  40, type: 'rock' },
    { x: 2300, w:  40, h: 160, type: 'wall' },
    { x: 2600, w: 200, h: 120, type: 'house' },
    { x: 3100, w: 140, h:  60, type: 'crate' },
    { x: 3400, w:  60, h: 180, type: 'tower' },
    { x: 4550, w: 320, h:  20, type: 'shore' },
    { x: 4870, w: 260, h:  60, type: 'water' }, // encore solide pour v0
    { x: 5400, w: 100, h:  40, type: 'rock' },
    { x: 5750, w: 180, h:  80, type: 'cliff' },
  );

  // Posters (hauteur relative; y fixé après load)
  const posters = [];
  const POSTER_SIZE = 36;
  function spawnPosters() {
    const spots = [600, 1100, 1500, 2050, 2450, 2950, 3350, 3650, 4250, 4650, 5200, 5600, 6000];
    posters.length = 0;
    for (const x of spots) posters.push({ x, y: -110, w: POSTER_SIZE, h: POSTER_SIZE, taken: false });
  }
  spawnPosters();
  let score = 0;

  // Assets
  const loadImage = (src) => new Promise((res, rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
  const ASSETS = {
    back: '/assets/background/bg_back.png',
    mid:  '/assets/background/bg_mid.png',
    front:'/assets/background/bg_front.png',
    idle: ['/assets/characters/idle_1.png'],
    walk: ['/assets/characters/walk_1.png','/assets/characters/walk_2.png','/assets/characters/walk_3.png','/assets/characters/walk_4.png']
  };
  const images = { back:null, mid:null, front:null, idle:[], walk:[] };

  async function loadAll() {
    const [back, mid, front] = await Promise.all([ loadImage(ASSETS.back), loadImage(ASSETS.mid), loadImage(ASSETS.front) ]);
    images.back = back; images.mid = mid; images.front = front;
    for (const s of ASSETS.idle) images.idle.push(await loadImage(s));
    for (const s of ASSETS.walk) images.walk.push(await loadImage(s));

    // Recalcul du sol depuis le zoom du front layer (règle 1/6)
    const W = canvas.width / DPR, H = canvas.height / DPR;
    const frontScale = (VIEW_FRAC_DENOM.front * W) / images.front.width;
    const groundFromBottom = Math.round(FRONT_GROUND_SRC_OFFSET * frontScale);
    GROUND_Y = H - groundFromBottom;

    // Convertit les hauteurs relatives en positions monde
    const toWorldY = (heightFromGround) => GROUND_Y - heightFromGround;
    for (const r of solids)  r.y = toWorldY(r.h);
    for (const p of posters) p.y = toWorldY(110); // ~poitrine
  }

  // Rendu d’un layer: zoom (1/denom visible), ancré bas, répété en X, parallaxe
  function drawLayer(img, parallaxFactor, denom) {
    const W = canvas.width / DPR, H = canvas.height / DPR;
    const scale = (denom * W) / img.width; // assure qu'on ne voie qu'1/denom
    const dw = Math.round(img.width * scale);
    const dh = Math.round(img.height * scale);
    const y = (LAYER_ALIGN === 'bottom') ? (H - dh) : 0;

    // point de départ avec modulo stable (évite les coutures)
    let xStart = -Math.floor((cameraX * parallaxFactor) % dw);
    if (xStart > 0) xStart -= dw;

    for (let x = xStart; x < W; x += dw) {
      ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
    }
  }

  function drawMyo() {
    const frames = player.state === 'walk' ? images.walk : images.idle;
    const fps = player.state === 'walk' ? 8 : 4;
    const idx = frames.length > 1 ? Math.floor(player.animTime * fps) % frames.length : 0;
    const img = frames[idx];
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
    const WICON = POSTER_SIZE, HICON = POSTER_SIZE;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 2;
    for (const p of posters) {
      if (p.taken) continue;
      const sx = p.x - cameraX, sy = p.y;
      if (sx < -60 || sx > canvas.width/DPR + 60) continue;
      ctx.fillRect(Math.round(sx), Math.round(sy), WICON, HICON);
      ctx.strokeRect(Math.round(sx)+0.5, Math.round(sy)+0.5, WICON-1, HICON-1);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffe08a';
      ctx.fillText('WANTED', Math.round(sx)+3, Math.round(sy)+13);
    }
    ctx.restore();
  }

  function drawSolidsDebug() {
    if (!DEBUG_SOLIDS) return;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#00ffff';
    for (const r of solids) {
      const sx = r.x - cameraX; if (sx + r.w < -10 || sx > canvas.width/DPR + 10) continue;
      ctx.fillRect(Math.round(sx), r.y, r.w, r.h);
    }
    ctx.restore();
  }

  // AABB + résolution axe par axe
  function aabb(ax, ay, aw, ah, bx, by, bw, bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function resolveCollisions(px, py, pw, ph, vx, vy) {
    const near = solids.filter(r => Math.abs(r.x - px) < 600);
    let nx = px + vx, ny = py + vy;
    for (const r of near) { // X
      if (aabb(nx, ny, pw, ph, r.x, r.y, r.w, r.h)) {
        if (vx > 0) nx = r.x - pw; else if (vx < 0) nx = r.x + r.w;
        vx = 0;
      }
    }
    for (const r of near) { // Y
      if (aabb(nx, ny, pw, ph, r.x, r.y, r.w, r.h)) {
        if (vy > 0) { ny = r.y - ph; vy = 0; player.onGround = true; }
        else if (vy < 0) { ny = r.y + r.h; vy = 0; }
      }
    }
    return { x: nx, y: ny, vx, vy };
  }

  // Boucle
  let last = 0; const MAX_DT = 1/30;
  function loop(ts){ const dt = Math.min((ts - last) / 1000 || 0, MAX_DT); last = ts; update(dt); draw(); requestAnimationFrame(loop); }

  function update(dt){
    // Input → vitesse
    let vx = 0;
    if (keys.has('ArrowRight') || keys.has('d')) { vx += MOVE_SPEED; player.facing = 'right'; }
    if (keys.has('ArrowLeft')  || keys.has('a')) { vx -= MOVE_SPEED; player.facing = 'left'; }
    const wantJump = keys.has('ArrowUp') || keys.has('w');
    if (wantJump && player.onGround) { player.vy = -JUMP_VELOCITY; player.onGround = false; }
    player.vy += GRAVITY * dt;

    // Box joueur (plus serrée que le sprite)
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
  }

  function draw(){
    const W = canvas.width / DPR, H = canvas.height / DPR;
    // Remplissage ciel (pas de seams)
    ctx.fillStyle = '#0d0f14';
    ctx.fillRect(0, 0, W, H);

    // Parallaxe zoomée (1/6 visible)
    if (images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_FRAC_DENOM.back);
    if (images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_FRAC_DENOM.mid);
    if (images.front) drawLayer(images.front, PARALLAX.front, VIEW_FRAC_DENOM.front);

    drawPosters();
    drawMyo();
    drawSolidsDebug();
  }

  const DEBUG_SOLIDS = false;

  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  startBtn.addEventListener('click', async () => {
    gate.style.display = 'none';
    try { await bgm.play(); } catch(e) {}
    boot();
  }, { once: true });

  addEventListener('keydown', function anyKeyStart(){
    if (gate.style.display !== 'none') { startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });
})();
