// === IO83 Side Demo – frames séparées ===
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 1920
const H = canvas.height;  // 540

// Physique (pixels / seconde)
const GRAVITY     = 1400;  // force qui ramène au sol
const JUMP_POWER  = 650;   // impulsion du saut

// Réglages sol & taille perso
const GROUND_TOP = H - 100;     // bord supérieur du layer "ground"
const MYO_TARGET_HEIGHT = 120;  // taille souhaitée de Myo (px)
const IDLE_FPS = 4;             // vitesse anim idle (images/seconde)
const WALK_FPS = 8;             // vitesse anim marche

// Déplacements
const SPEED = 3.2;

function update(dt) {
  // Mouvement horizontal
  let vx = 0;
  if (keys.has('ArrowRight') || keys.has('d')) { vx =  SPEED; player.facing = 'right'; }
  if (keys.has('ArrowLeft')  || keys.has('a')) { vx = -SPEED; player.facing = 'left'; }
  player.x = Math.max(0, Math.min(worldLength, player.x + vx));

  // --- Saut / Gravité ---
  // déclenche le saut une seule fois quand on est au sol
  const wantJump = keys.has('ArrowUp') || keys.has('w');
  if (wantJump && player.onGround) {
    player.vy = -JUMP_POWER;   // impulsion vers le haut
    player.onGround = false;
  }

  // gravité + mouvement vertical
  player.vy += GRAVITY * dt;
  player.y  += player.vy * dt;   // y > 0 = descend, y < 0 = monte

  // collision avec le sol (pieds)
  if (player.y > 0) {
    player.y = 0;
    player.vy = 0;
    player.onGround = true;
  }

  // Caméra
  cameraX = Math.max(0, Math.min(player.x - W / 2, worldLength - W));

  // État & animation
  const moving = Math.abs(vx) > 0.01;
  player.state = moving ? 'walk' : 'idle';
  player.animTime += dt;
}


// Parallaxe : chemins des layers (tu remplaceras par tes PNG)
const ASSETS = {
  far: 'assets/bg_far.png',
  mid: 'assets/bg_mid.png',
  ground: 'assets/ground.png',
};

// Frames Myo (chemins vers tes images)
const MYO_FRAMES = {
  idle: [
    'assets/characters/myo/idle_1.png',
  ],
  walk: [
    'assets/characters/myo/walk_1.png',
    'assets/characters/myo/walk_2.png',
    'assets/characters/myo/walk_3.png',
    'assets/characters/myo/walk_4.png',
  ]
};

// Chargement générique d’images
function loadImage(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
}
async function loadAll() {
  const images = {};
  for (const [k, src] of Object.entries(ASSETS)) images[k] = await loadImage(src);

  const myo = { idle: [], walk: [] };
  for (const src of MYO_FRAMES.idle) myo.idle.push(await loadImage(src));
  for (const src of MYO_FRAMES.walk) myo.walk.push(await loadImage(src));

  return { images, myo };
}

const keys = new Set();
addEventListener('keydown', e => keys.add(e.key));
addEventListener('keyup',   e => keys.delete(e.key));

// Monde & caméra
let cameraX = 0;
const worldLength = 5000;

const player = {
  x: 200,
  facing: 'right',
  animTime: 0,
  state: 'idle',   // 'idle' | 'walk' (on gardera simple)
  y: 0,            // offset vertical (0 = pieds au sol, négatif = en l’air)
  vy: 0,           // vitesse verticale
  onGround: true
};

// Utilitaires
function parallax(ctx, img, factor) {
  const x = -(cameraX * factor) % img.width;
  for (let px = x - img.width; px < W; px += img.width) ctx.drawImage(img, px, 0);
}

function drawMyo(ctx, frames, t, fps, facing) {
  // Sélection frame
  const idx = frames.length > 1 ? Math.floor(t * fps) % frames.length : 0;
  const img = frames[idx];

  // Mise à l’échelle uniforme pour viser MYO_TARGET_HEIGHT
  const scale = MYO_TARGET_HEIGHT / img.height;
  const destW = Math.round(img.width * scale);
  const destH = Math.round(img.height * scale);

  // Ancrage par les pieds
  const footOffset = 2;
  const screenX = Math.floor(player.x - cameraX);
  const screenY = GROUND_TOP - destH + footOffset;

  ctx.save();
  if (facing === 'left') {
    ctx.translate(screenX + destW / 2, screenY);
    ctx.scale(-1, 1);
    ctx.translate(-destW / 2, 0);
    ctx.drawImage(img, 0, 0, destW, destH);
  } else {
    ctx.drawImage(img, screenX, screenY, destW, destH);
  }
  ctx.restore();
}

// Boucle
let assets;
loadAll().then(a => { assets = a; requestAnimationFrame(loop); });

let last = 0;
function loop(ts) {
  const dt = (ts - last) / 1000 || 0; last = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  // Mouvement
  let vx = 0;
  if (keys.has('ArrowRight') || keys.has('d')) { vx =  SPEED; player.facing = 'right'; }
  if (keys.has('ArrowLeft')  || keys.has('a')) { vx = -SPEED; player.facing = 'left'; }
  player.x = Math.max(0, Math.min(worldLength, player.x + vx));

  // Caméra
  cameraX = Math.max(0, Math.min(player.x - W / 2, worldLength - W));

  // État & animation time
  player.state = (Math.abs(vx) > 0.01) ? 'walk' : 'idle';
  player.animTime += dt;
}

function draw() {
  const { images, myo } = assets;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, W, H);
  parallax(ctx, images.far, 0.20);
  parallax(ctx, images.mid, 0.50);
  parallax(ctx, images.ground, 1.00);

  if (player.state === 'walk') drawMyo(ctx, myo.walk, player.animTime, WALK_FPS, player.facing);
  else                        drawMyo(ctx, myo.idle, player.animTime, IDLE_FPS, player.facing);
}
