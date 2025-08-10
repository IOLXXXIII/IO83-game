// IO83 – Browser 2D Prototype (Canvas 2D)
// Controls: ← → to move, ↑ to jump. Collect WANTED posters.
// Assets expected:
//   /assets/background/bg_back.png, bg_mid.png, bg_front.png
//   /assets/characters/idle_1.png, walk_1.png..walk_4.png
//   /assets/audio/bgm_iogame.mp3, sfx_wanted.mp3

(function(){
  'use strict';

  // Canvas & sizing (auto scale for HiDPI while preserving pixel art)
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  function resize() {
    // Logical size stays 960x540, internal buffer scales up by DPR
    const w = 960, h = 540;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // draw in logical pixels
  }
  resize();
  addEventListener('resize', resize);

  // UI elements
  const scoreEl = document.getElementById('scoreNum');
  const gate = document.getElementById('gate');
  const startBtn = document.getElementById('startBtn');
  const bgm = document.getElementById('bgm');
  const sfxWanted = document.getElementById('sfxWanted');

  // Physics
  const GRAVITY = 1800;      // px/s^2
  const JUMP_VELOCITY = 800; // px/s upward impulse
  const MOVE_SPEED = 340;    // px/s horizontal
  const GROUND_Y = 440;      // ground baseline y (feet)

  // Parallax factors (smaller = slower = farther)
  const PARALLAX = { back: 0.15, mid: 0.45, front: 1.0 };

  // World
  const WORLD_LEN = 6200; // logical pixels width
  let cameraX = 0;

  // Input
  const keys = new Set();
  addEventListener('keydown', (e) => { if(['ArrowLeft','ArrowRight','ArrowUp','a','d','w'].includes(e.key)) e.preventDefault(); keys.add(e.key); });
  addEventListener('keyup',   (e) => { keys.delete(e.key); });

  // Player (Myo)
  const MYO_TARGET_HEIGHT = 120; // pixels on screen
  const IDLE_FPS = 4;            // frames/sec
  const WALK_FPS = 8;
  const player = {
    x: 200, y: 0, vy: 0, onGround: true, facing: 'right', state: 'idle', animTime: 0,
    w: 60, h: 120 // rough collision box; sprite visual scales to this height
  };

  // Simple rectangles for collisions (rocks, walls, cliffs, water as solid for v0)
  // Each rect: {x,y,w,h,type}
  const solids = [];
  // --- Desert (0..2000)
  solids.push(
    { x: 800, y: GROUND_Y-40, w: 120, h: 40, type: 'rock' },
    { x: 1200, y: GROUND_Y-60, w: 160, h: 60, type: 'rock' },
    { x: 1600, y: GROUND_Y-40, w: 100, h: 40, type: 'rock' },
  );
  // --- Village (2000..4200)
  solids.push(
    { x: 2300, y: GROUND_Y-160, w: 40, h: 160, type: 'wall' },
    { x: 2600, y: GROUND_Y-120, w: 200, h: 120, type: 'house' },
    { x: 3100, y: GROUND_Y-60,  w: 140, h: 60,  type: 'crate' },
    { x: 3400, y: GROUND_Y-180, w: 60,  h: 180, type: 'tower' },
  );
  // --- Oasis (4200..6200)
  solids.push(
    { x: 4550, y: GROUND_Y-20, w: 320, h: 20, type: 'shore' },
    { x: 4870, y: GROUND_Y-60, w: 260, h: 60, type: 'water' }, // solid for now
    { x: 5400, y: GROUND_Y-40, w: 100, h: 40, type: 'rock' },
    { x: 5750, y: GROUND_Y-80, w: 180, h: 80, type: 'cliff' },
  );

  // Wanted posters (collectibles)
  const posters = [];
  const POSTER_SIZE = 36;
  function spawnPosters() {
    const spots = [
      600, 1100, 1500, 2050, 2450, 2950, 3350, 3650, 4250, 4650, 5200, 5600, 6000
    ];
    posters.length = 0;
    for (const x of spots) posters.push({ x, y: GROUND_Y - 110, w: POSTER_SIZE, h: POSTER_SIZE, taken: false });
  }
  spawnPosters();
  let score = 0;

  // Assets
  const loadImage = (src) => new Promise((res, rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
  const ASSETS = {
    back: '/assets/background/bg_back.png',
    mid: '/assets/background/bg_mid.png',
    front: '/assets/background/bg_front.png',
    idle: ['/assets/characters/idle_1.png'],
    walk: ['/assets/characters/walk_1.png','/assets/characters/walk_2.png','/assets/characters/walk_3.png','/assets/characters/walk_4.png']
  };
  const images = { back:null, mid:null, front:null, idle:[], walk:[] };

  async function loadAll() {
    const [back, mid, front] = await Promise.all([
      loadImage(ASSETS.back), loadImage(ASSETS.mid), loadImage(ASSETS.front)
    ]);
    images.back = back; images.mid = mid; images.front = front;
    for (const s of ASSETS.idle) images.idle.push(await loadImage(s));
    for (const s of ASSETS.walk) images.walk.push(await loadImage(s));
  }

  // Drawing helpers
  function drawTiled(img, factor) {
    const W = canvas.width / DPR; // logical width
    const H = canvas.height / DPR;
    const x0 = - (cameraX * factor) % img.width;
    for (let x = x0 - img.width; x < W; x += img.width) ctx.drawImage(img, x, 0);
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
      if (sx < -60 || sx > canvas.width/DPR + 60) continue; // cull offscreen
      // Simple placeholder if you don't have art yet; replace with a sprite if desired.
      ctx.fillRect(Math.round(sx), Math.round(sy), WICON, HICON);
      ctx.strokeRect(Math.round(sx)+0.5, Math.round(sy)+0.5, WICON-1, HICON-1);
      ctx.font = '10px monospace';
      ctx.fillStyle = '#ffe08a';
      ctx.fillText('WANTED', Math.round(sx)+3, Math.round(sy)+13);
    }
    ctx.restore();
  }

  function drawSolidsDebug() {
    // Toggle by setting DEBUG_SOLIDS to true if you want to see hitboxes
    if (!DEBUG_SOLIDS) return;
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#00ffff';
    for (const r of solids) {
      const sx = r.x - cameraX; if (sx + r.w < -10 || sx > canvas.width/DPR + 10) continue;
      ctx.fillRect(Math.round(sx), r.y, r.w, r.h);
    }
    ctx.restore();
  }

  // Collision helpers (AABB)
  function aabb(ax, ay, aw, ah, bx, by, bw, bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function resolveCollisions(px, py, pw, ph, vx, vy) {
    // Only test rects near the player for perf
    const near = solids.filter(r => Math.abs(r.x - px) < 600);
    let nx = px + vx, ny = py + vy;

    // Horizontal
    for (const r of near) {
      if (aabb(nx, ny, pw, ph, r.x, r.y, r.w, r.h)) {
        if (vx > 0) nx = r.x - pw; else if (vx < 0) nx = r.x + r.w;
        vx = 0;
      }
    }
    // Vertical
    for (const r of near) {
      if (aabb(nx, ny, pw, ph, r.x, r.y, r.w, r.h)) {
        if (vy > 0) { ny = r.y - ph; vy = 0; player.onGround = true; }
        else if (vy < 0) { ny = r.y + r.h; vy = 0; }
      }
    }
    return { x: nx, y: ny, vx, vy };
  }

  // Game loop
  let last = 0; const MAX_DT = 1/30; // clamp big frame gaps
  function loop(ts){
    const dt = Math.min((ts - last) / 1000 || 0, MAX_DT); last = ts;
    update(dt); draw(); requestAnimationFrame(loop);
  }

  function update(dt){
    // Input → velocity
    let vx = 0;
    if (keys.has('ArrowRight') || keys.has('d')) { vx += MOVE_SPEED; player.facing = 'right'; }
    if (keys.has('ArrowLeft')  || keys.has('a')) { vx -= MOVE_SPEED; player.facing = 'left'; }

    // Jump
    const wantJump = keys.has('ArrowUp') || keys.has('w');
    if (wantJump && player.onGround) { player.vy = -JUMP_VELOCITY; player.onGround = false; }

    // Gravity
    player.vy += GRAVITY * dt;

    // Proposed movement
    const pw = 44, ph = 110; // tighter than sprite to feel better
    const px = player.x, py = GROUND_Y - ph + player.y; // convert to world box

    // Resolve with solids
    let res = resolveCollisions(px, py, pw, ph, vx * dt, player.vy * dt);

    // Extract back to player
    player.x = Math.max(0, Math.min(WORLD_LEN, res.x));
    player.y = res.y - (GROUND_Y - ph); // keep feet anchored to GROUND_Y baseline
    player.vy = res.vy;

    // World floor/ceiling safety
    if (GROUND_Y + player.y > GROUND_Y) { player.y = 0; player.vy = 0; player.onGround = true; }
    if (player.x <= 0 || player.x >= WORLD_LEN) { /* clamp at bounds */ }

    // Camera follow (deadzone could be added later)
    const W = canvas.width / DPR;
    cameraX = Math.max(0, Math.min(player.x - W/2, WORLD_LEN - W));

    // Anim state
    const moving = Math.abs(vx) > 1e-2;
    player.state = moving ? 'walk' : 'idle';
    player.animTime += dt;

    // Collectibles
    for (const p of posters) {
      if (p.taken) continue;
      if (aabb(player.x-22, GROUND_Y-110+player.y, 44, 110, p.x, p.y, p.w, p.h)) {
        p.taken = true; score++; scoreEl.textContent = String(score);
        // Play SFX (ignore errors)
        try { sfxWanted.currentTime = 0; sfxWanted.play(); } catch(e) {}
      }
    }
  }

  function draw(){
    const W = canvas.width / DPR, H = canvas.height / DPR;
    // Clear
    ctx.fillStyle = '#1a1b1e';
    ctx.fillRect(0, 0, W, H);

    // Parallax backgrounds
    if (images.back)  drawTiled(images.back,  PARALLAX.back);
    if (images.mid)   drawTiled(images.mid,   PARALLAX.mid);
    if (images.front) drawTiled(images.front, PARALLAX.front);

    // Ground baseline guide (optional)
    // DEBUG: draw line
    // ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, GROUND_Y+0.5); ctx.lineTo(W, GROUND_Y+0.5); ctx.stroke();

    drawPosters();
    drawMyo();
    drawSolidsDebug();
  }

  // Debug toggle
  const DEBUG_SOLIDS = false; // set true to visualize collision rects

  async function boot(){
    await loadAll();
    requestAnimationFrame(loop);
  }

  // Start gate to unlock audio (mobile/desktop policies)
  startBtn.addEventListener('click', async () => {
    gate.style.display = 'none';
    try { await bgm.play(); } catch(e) { /* Ignore if blocked */ }
    boot();
  }, { once: true });

  // Also start if user presses any movement key first
  addEventListener('keydown', function anyKeyStart(){
    if (gate.style.display !== 'none') { startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
