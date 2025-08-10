// IO83 – main.js (stable, avec diagnostics à l'écran)

(function(){
  'use strict';

  // ===== Diagnostics visibles =====
  function showBanner(msg) {
    var d = document.createElement('div');
    d.textContent = msg;
    d.style.position = 'fixed';
    d.style.top = '0'; d.style.left = '0'; d.style.right = '0';
    d.style.padding = '8px 12px';
    d.style.background = '#b00020'; d.style.color = '#fff';
    d.style.font = '12px/1.2 monospace'; d.style.zIndex = '9999';
    document.body.appendChild(d);
  }
  window.addEventListener('error', function(e){
    var m = (e && e.error && e.error.message) ? e.error.message : (e && e.message ? e.message : 'Unknown JS error');
    showBanner('JS error → ' + m);
  });

  // ===== Canvas & HiDPI =====
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha:false });
  var DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  function resize(){
    var w = 1280, h = 720; // buffer logique 16:9
    canvas.width = w * DPR; canvas.height = h * DPR;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize(); addEventListener('resize', resize);

  // ===== UI & audio =====
  var scoreEl  = document.getElementById('scoreNum');
  var gate     = document.getElementById('gate');
  var startBtn = document.getElementById('startBtn');
  var bgm      = document.getElementById('bgm');
  var sfxWanted= document.getElementById('sfxWanted');

  // ===== Parallaxe & zoom =====
  var PARALLAX = { back:0.15, mid:0.45, front:1.0 };
  var VIEW_FRAC_DENOM = { back:6, mid:6, front:6 }; // on ne voit qu'1/6 de l'image
  var LAYER_ALIGN = 'bottom';
  var FRONT_GROUND_SRC_OFFSET = 18; // ajuste si pieds trop haut/bas

  // ===== Monde & physique =====
  var WORLD_LEN = 6200;
  var cameraX = 0;

  var GRAVITY = 2200;
  var JUMP_VELOCITY = 980;
  var MOVE_SPEED = 340;
  var GROUND_Y = 560; // recalculé après chargement

  // ===== Input =====
  var keys = new Set();
  addEventListener('keydown', function(e){
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'].indexOf(e.key) !== -1) e.preventDefault();
    keys.add(e.key);
  });
  addEventListener('keyup', function(e){ keys.delete(e.key); });

  // ===== Player =====
  var MYO_TARGET_HEIGHT = 120;
  var player = { x:200, y:0, vy:0, onGround:true, facing:'right', state:'idle', animTime:0 };

  // ===== Colliders (hauteurs relatives; y rempli après load) =====
  var solids = [
    { x:800,  w:120, h:40,  type:'rock' },
    { x:1200, w:160, h:60,  type:'rock' },
    { x:1600, w:100, h:40,  type:'rock' },
    { x:2300, w:40,  h:160, type:'wall' },
    { x:2600, w:200, h:120, type:'house' },
    { x:3100, w:140, h:60,  type:'crate' },
    { x:3400, w:60,  h:180, type:'tower' },
    { x:4550, w:320, h:20,  type:'shore' },
    { x:4870, w:260, h:60,  type:'water' }, // solide pour v0
    { x:5400, w:100, h:40,  type:'rock' },
    { x:5750, w:180, h:80,  type:'cliff' }
  ];

  // ===== Posters =====
  var posters = []; var POSTER_SIZE = 36;
  function spawnPosters(){
    var spots = [600,1100,1500,2050,2450,2950,3350,3650,4250,4650,5200,5600,6000];
    posters.length = 0;
    for (var i=0;i<spots.length;i++) posters.push({ x:spots[i], y:-110, w:POSTER_SIZE, h:POSTER_SIZE, taken:false });
  }
  spawnPosters();
  var score = 0;

  // ===== Assets =====
  var ASSETS = {
    back:  'assets/background/bg_far.png',
    mid:   'assets/background/bg_mid.png',
    front: 'assets/background/ground.png',
    idle:  ['assets/characters/myo/idle_1.png'],
    walk:  ['assets/characters/myo/walk_1.png','assets/characters/myo/walk_2.png','assets/characters/myo/walk_3.png','assets/characters/myo/walk_4.png'],
    poster:'assets/collectibles/wanted.png'
  };
  var images = { back:null, mid:null, front:null, idle:[], walk:[], poster:null };

  function tryLoad(src){
    return new Promise(function(resolve){
      var img = new Image();
      img.onload  = function(){ resolve({ ok:true, img:img, src:src }); };
      img.onerror = function(){ resolve({ ok:false, img:null,  src:src }); };
      img.src = src;
    });
  }

  function showMissing(list){
    if (!list.length) return;
    showBanner('Missing assets → ' + list.join(', '));
  }

  async function loadAll(){
    var missing = [];

    // layers
    var r;
    r = await tryLoad(ASSETS.back);  if (r.ok) images.back  = r.img; else missing.push(ASSETS.back);
    r = await tryLoad(ASSETS.mid);   if (r.ok) images.mid   = r.img; else missing.push(ASSETS.mid);
    r = await tryLoad(ASSETS.front); if (r.ok) images.front = r.img; else missing.push(ASSETS.front);
    // characters
    for (var i=0;i<ASSETS.idle.length;i++){ r = await tryLoad(ASSETS.idle[i]); if (r.ok) images.idle.push(r.img); else missing.push(ASSETS.idle[i]); }
    for (var j=0;j<ASSETS.walk.length;j++){ r = await tryLoad(ASSETS.walk[j]); if (r.ok) images.walk.push(r.img); else missing.push(ASSETS.walk[j]); }
    // poster (optionnel)
    r = await tryLoad(ASSETS.poster); if (r.ok) images.poster = r.img;

    showMissing(missing);

    // Base sol depuis "front"
    var W = canvas.width / DPR, H = canvas.height / DPR;
    if (images.front) {
      var denom = VIEW_FRAC_DENOM.front || 6;
      var frontScale = (denom * W) / images.front.width;
      var groundFromBottom = Math.round(FRONT_GROUND_SRC_OFFSET * frontScale);
      GROUND_Y = H - groundFromBottom;
    }
    var toWorldY = function(h){ return GROUND_Y - h; };
    for (var k=0;k<solids.length;k++) solids[k].y = toWorldY(solids[k].h);
    for (var m=0;m<posters.length;m++) posters[m].y = toWorldY(110);
  }

  // ===== Rendu =====
  function drawLayer(img, parallaxFactor, denom){
    var W = canvas.width / DPR, H = canvas.height / DPR;
    var scale = (denom * W) / img.width; // 1/denom visible
    var dw = Math.round(img.width * scale);
    var dh = Math.round(img.height * scale);
    var y  = (LAYER_ALIGN === 'bottom') ? (H - dh) : 0;

    var xStart = -Math.floor((cameraX * parallaxFactor) % dw);
    if (xStart > 0) xStart -= dw;

    for (var x = xStart; x < W; x += dw) {
      ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
    }
  }

  function drawMyo(){
    var frames = (player.state === 'walk') ? images.walk : images.idle;
    var fps = (player.state === 'walk') ? 8 : 4;
    var idx = frames.length > 1 ? Math.floor(player.animTime * fps) % frames.length : 0;
    var img = frames[idx] || images.idle[0];
    if (!img) return;

    var scale = MYO_TARGET_HEIGHT / img.height;
    var dw = Math.round(img.width * scale);
    var dh = Math.round(img.height * scale);
    var x = Math.floor(player.x - cameraX);
    var y = GROUND_Y - dh + player.y;

    ctx.save();
    if (player.facing === 'left') {
      ctx.translate(x + dw/2, y);
      ctx.scale(-1, 1);
      ctx.translate(-dw/2, 0);
      ctx.drawImage(img, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, x, y, dw, dh);
    }
    ctx.restore();
  }

  function drawPosters(){
    ctx.save();
    for (var i=0;i<posters.length;i++){
      var p = posters[i];
      if (p.taken) continue;
      var sx = p.x - cameraX, sy = p.y;
      if (sx < -60 || sx > canvas.width/DPR + 60) continue;
      if (images.poster) {
        ctx.drawImage(images.poster, Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
      } else {
        ctx.fillStyle = '#000'; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
        ctx.fillRect(Math.round(sx), Math.round(sy), POSTER_SIZE, POSTER_SIZE);
        ctx.strokeRect(Math.round(sx)+0.5, Math.round(sy)+0.5, POSTER_SIZE-1, POSTER_SIZE-1);
      }
    }
    ctx.restore();
  }

  // ===== Collisions =====
  function aabb(ax,ay,aw,ah,bx,by,bw,bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  function resolveCollisions(px,py,pw,ph,vx,vy){
    var near = [];
    for (var i=0;i<solids.length;i++) if (Math.abs(solids[i].x - px) < 600) near.push(solids[i]);
    var nx = px + vx, ny = py + vy, r;
    for (i=0;i<near.length;i++){ r = near[i]; // X
      if (aabb(nx,ny,pw,ph,r.x,r.y,r.w,r.h)) { if (vx > 0) nx = r.x - pw; else if (vx < 0) nx = r.x + r.w; vx = 0; }
    }
    for (i=0;i<near.length;i++){ r = near[i]; // Y
      if (aabb(nx,ny,pw,ph,r.x,r.y,r.w,r.h)) { if (vy > 0) { ny = r.y - ph; vy = 0; player.onGround = true; } else if (vy < 0) { ny = r.y + r.h; vy = 0; } }
    }
    return { x:nx, y:ny, vx:vx, vy:vy };
  }

  // ===== Boucle =====
  var last = 0; var MAX_DT = 1/30;
  function loop(ts){
    var dt = Math.min((ts - last) / 1000 || 0, MAX_DT); last = ts;

    // Input
    var vx = 0;
    if (keys.has('ArrowRight') || keys.has('d')) { vx += MOVE_SPEED; player.facing = 'right'; }
    if (keys.has('ArrowLeft')  || keys.has('a')) { vx -= MOVE_SPEED; player.facing = 'left'; }

    var wantJump = keys.has('ArrowUp') || keys.has('w');
    if (wantJump && player.onGround) { player.vy = -JUMP_VELOCITY; player.onGround = false; }
    player.vy += GRAVITY * dt;

    // Jump-cut (saut naturel si on relâche)
    var jumpHeld = keys.has('ArrowUp') || keys.has('w');
    if (!jumpHeld && player.vy < -220) player.vy = -220;

    // Mouvements + collisions
    var pw = 44, ph = 110;
    var px = player.x, py = GROUND_Y - ph + player.y;
    var res = resolveCollisions(px,py,pw,ph, vx*dt, player.vy*dt);
    player.x = Math.max(0, Math.min(WORLD_LEN, res.x));
    player.y = res.y - (GROUND_Y - ph);
    player.vy = res.vy;
    if (GROUND_Y + player.y > GROUND_Y) { player.y = 0; player.vy = 0; player.onGround = true; }

    // Collecte avec ↓ / S
    var wantsCollect = keys.has('ArrowDown') || keys.has('s');
    for (var i=0;i<posters.length;i++){
      var p = posters[i];
      if (p.taken) continue;
      var overlap = aabb(player.x-22, GROUND_Y-110+player.y, 44,110, p.x,p.y,p.w,p.h);
      if (overlap && wantsCollect) {
        p.taken = true; score++; scoreEl.textContent = String(score);
        try { sfxWanted.currentTime = 0; sfxWanted.play(); } catch(err) {}
      }
    }

    // Caméra
    var W = canvas.width / DPR;
    cameraX = Math.max(0, Math.min(player.x - W/2, WORLD_LEN - W));

    // Anim
    player.state = Math.abs(vx) > 1e-2 ? 'walk' : 'idle';
    player.animTime += dt;

    // Draw
    var Wpx = canvas.width / DPR, Hpx = canvas.height / DPR;
    ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, Wpx, Hpx);
    if (images.back)  drawLayer(images.back,  PARALLAX.back,  VIEW_FRAC_DENOM.back);
    if (images.mid)   drawLayer(images.mid,   PARALLAX.mid,   VIEW_FRAC_DENOM.mid);
    if (images.front) drawLayer(images.front, PARALLAX.front, VIEW_FRAC_DENOM.front);
    drawPosters();
    drawMyo();

    requestAnimationFrame(loop);
  }

  async function boot(){ await loadAll(); requestAnimationFrame(loop); }

  // ===== Start gate + musique =====
  startBtn.addEventListener('click', async function(){
    gate.style.display = 'none';
    try { bgm.currentTime = 0; bgm.volume = 0.6; await bgm.play(); } catch(err) {}
    boot();
  }, { once:true });

  addEventListener('keydown', function anyKeyStart(){
    if (gate && gate.style.display !== 'none') { startBtn.click(); }
    removeEventListener('keydown', anyKeyStart);
  });

})();
