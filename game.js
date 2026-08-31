// DARKSIDE - main game script (updated: replay button, start/boost buttons, top-only enemy spawn + entrance animation)
// Keep all existing visual assets (SVG spacecrafts, nebula, stars).

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
resize();
window.addEventListener('resize', resize);

function resize() {
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}

// Utility
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function now(){ return performance.now(); }

const hudScore = document.getElementById('score');
const hudShield = document.getElementById('shield');
const hudEnergy = document.getElementById('energy');
const radarCanvas = document.getElementById('radar');
const radarCtx = radarCanvas.getContext('2d');

const overlay = document.getElementById('overlay');
const gameoverEl = document.getElementById('gameover');
const gameoverScoreEl = document.getElementById('gameover-score');
const replayBtn = document.getElementById('replay-btn');
const startBtn = document.getElementById('start-btn');
const boostBtn = document.getElementById('boost-btn');

let running = false;
let lastTime = now();
let seed = Math.random()*9999;

// Game state
const state = {
  w: window.innerWidth,
  h: window.innerHeight,
  player: null,
  bullets: [],
  enemies: [],
  particles: [],
  enemyBullets: [],
  stars: [],
  score: 0,
  shield: 100,
  energy: 100,
  spawnTimer: 0,
  spawnInterval: 1200,
  difficultyTimer: 0,
  level: 1,
  startTime: now(),
  mouse: { x: 0, y: 0, down: false, moved: false },
};

// Create starfield
function initStars(){
  state.stars = [];
  const count = Math.round((state.w*state.h)/90000) * 80;
  for(let i=0;i<count;i++){
    state.stars.push({
      x: Math.random()*state.w,
      y: Math.random()*state.h,
      z: Math.random()*1,
      size: Math.random()*1.6,
      speed: 8 + Math.random()*20,
      hue: rand(190,260)
    });
  }
}
initStars();

// SVG sprite generator: player and 3 enemy types (as strings) - unchanged
function playerSVG(){
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
    <defs>
      <linearGradient id="metal" x1="0" x2="1">
        <stop offset="0" stop-color="#1b2030"/>
        <stop offset="0.5" stop-color="#2a2f3d"/>
        <stop offset="1" stop-color="#101217"/>
      </linearGradient>
      <linearGradient id="glass" x1="0" x2="1">
        <stop offset="0" stop-color="#72d9ff" stop-opacity="0.95"/>
        <stop offset="1" stop-color="#3bb0ff" stop-opacity="0.5"/>
      </linearGradient>
      <radialGradient id="engine" cx="50%" cy="50%">
        <stop offset="0" stop-color="#8ff"/>
        <stop offset="0.3" stop-color="#39f"/>
        <stop offset="1" stop-color="#000"/>
      </radialGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- body -->
    <g transform="translate(120,120)">
      <path d="M0 -100 C 30 -80 60 -40 80 0 C 60 40 30 80 0 100 C -30 80 -60 40 -80 0 C -60 -40 -30 -80 0 -100 Z"
        fill="url(#metal)" stroke="#1f2533" stroke-width="2"/>
      <!-- nose spine -->
      <path d="M0 -100 L8 -40 L0 -20 L-8 -40 Z" fill="#111827" opacity="0.9"/>
      <!-- cockpit -->
      <ellipse cx="0" cy="-12" rx="26" ry="18" fill="url(#glass)" stroke="#16202a" stroke-width="2" filter="url(#glow)"/>
      <ellipse cx="0" cy="-14" rx="16" ry="10" fill="#bff6ff" opacity="0.35"/>
      <!-- wings -->
      <path d="M80 0 C 120 10 140 40 170 60 L130 40 C 100 24 80 8 80 0 Z" fill="#222733" opacity="0.95"/>
      <path d="M-80 0 C -120 10 -140 40 -170 60 L-130 40 C -100 24 -80 8 -80 0 Z" fill="#222733" opacity="0.95"/>
      <!-- fins -->
      <path d="M40 70 L80 90 L58 60 Z" fill="#2a313c" />
      <path d="M-40 70 L-80 90 L-58 60 Z" fill="#2a313c" />
      <!-- engine core -->
      <g transform="translate(0,100)">
        <ellipse rx="36" ry="16" fill="#0b1724"/>
        <ellipse rx="22" ry="8" fill="url(#engine)" opacity="0.95" />
      </g>
      <!-- subtle panel lines -->
      <path d="M0 -72 C 20 -60 60 -18 82 10" stroke="#0e2433" stroke-width="2" fill="none" opacity="0.25"/>
      <path d="M0 -72 C -20 -60 -60 -18 -82 10" stroke="#0e2433" stroke-width="2" fill="none" opacity="0.25"/>
    </g>
  </svg>
  `;
}

function enemySVG(type){
  if(type==='scout'){
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="m1" x1="0" x2="1">
          <stop offset="0" stop-color="#2b2b35"/>
          <stop offset="1" stop-color="#191b22"/>
        </linearGradient>
        <radialGradient id="e1" cx="50%" cy="50%">
          <stop offset="0" stop-color="#ff7a6a"/>
          <stop offset="1" stop-color="#b82b1a"/>
        </radialGradient>
      </defs>
      <g transform="translate(80,80)">
        <path d="M0 -60 C 18 -48 36 -20 44 0 C 36 20 18 48 0 60 C -18 48 -36 20 -44 0 C -36 -20 -18 -48 0 -60 Z" fill="url(#m1)"/>
        <path d="M0 -60 L14 -32 L24 -10 L34 20 L20 12 L0 0 Z" fill="#2a2a2e" opacity="0.9"/>
        <circle cx="0" cy="38" r="8" fill="url(#e1)" opacity="0.95"/>
      </g>
    </svg>`;
  } else if(type==='fighter'){
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
      <defs>
        <linearGradient id="m2" x1="0" x2="1">
          <stop offset="0" stop-color="#2c2a33"/>
          <stop offset="1" stop-color="#15131a"/>
        </linearGradient>
        <radialGradient id="gun" cx="50%" cy="50%">
          <stop offset="0" stop-color="#ffad42"/>
          <stop offset="1" stop-color="#ff5a00"/>
        </radialGradient>
      </defs>
      <g transform="translate(110,110)">
        <path d="M0 -90 C 30 -70 70 -30 84 0 C 70 30 30 70 0 90 C -30 70 -70 30 -84 0 C -70 -30 -30 -70 0 -90 Z" fill="url(#m2)"/>
        <rect x="-18" y="2" width="36" height="30" rx="6" fill="#0f1116"/>
        <path d="M78 6 L110 24 L86 6 Z" fill="url(#gun)"/>
        <path d="M-78 6 L-110 24 L-86 6 Z" fill="url(#gun)"/>
        <ellipse cx="0" cy="-26" rx="22" ry="12" fill="#bff0ff" opacity="0.22"/>
      </g>
    </svg>`;
  } else {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="m3" x1="0" x2="1">
          <stop offset="0" stop-color="#22252b"/>
          <stop offset="1" stop-color="#0d0f12"/>
        </linearGradient>
        <radialGradient id="thr" cx="50%" cy="50%">
          <stop offset="0" stop-color="#fffdba"/>
          <stop offset="1" stop-color="#ff8b1f"/>
        </radialGradient>
      </defs>
      <g transform="translate(150,150)">
        <path d="M0 -120 C 50 -100 110 -40 140 0 C 110 40 50 100 0 120 C -50 100 -110 40 -140 0 C -110 -40 -50 -100 0 -120 Z" fill="url(#m3)"/>
        <rect x="-70" y="-24" width="140" height="48" rx="12" fill="#111316"/>
        <g transform="translate(0,120)">
          <ellipse rx="48" ry="20" fill="#07090a"/>
          <ellipse rx="30" ry="10" fill="url(#thr)" opacity="0.98"/>
        </g>
      </g>
    </svg>`;
  }
}

// Convert SVG string -> Image
function svgToImage(svgString, scale=1){
  return new Promise(resolve=>{
    const img = new Image();
    const svg64 = 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svgString);
    img.onload = ()=>resolve(img);
    img.onerror = ()=>resolve(img);
    img.src = svg64;
  });
}

// Load sprites
let playerSprite, enemySprites;
async function loadSprites(){
  playerSprite = await svgToImage(playerSVG());
  enemySprites = {
    scout: await svgToImage(enemySVG('scout')),
    fighter: await svgToImage(enemySVG('fighter')),
    cruiser: await svgToImage(enemySVG('cruiser')),
  };
}
loadSprites().then(()=> initUI());

// Audio (WebAudio synth) - unchanged
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playShot(){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 1200;
  g.gain.value = 0.002;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.002,t);
  g.gain.exponentialRampToValueAtTime(0.0003, t+0.15);
  o.stop(t+0.18);
}

function playExplosion(){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  o.type = 'square';
  o.frequency.value = 200;
  o.connect(f);
  f.connect(g);
  g.connect(audioCtx.destination);
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.002,t);
  g.gain.exponentialRampToValueAtTime(0.00001,t+0.5);
  o.frequency.exponentialRampToValueAtTime(30,t+0.5);
  o.start();
  o.stop(t+0.6);
}

// Player constructor
function createPlayer(){
  const p = {
    x: state.w/2,
    y: state.h * 0.78,     // keep player low on screen by default
    r: 20,
    rotation: -Math.PI/2,  // face upward by default
    baseSpeed: 260,
    speed: 260,
    recoil:0,
    fireCooldown: 0,
    hp: 100,
    energy: 100,
    radarRadius: Math.min(state.w, state.h) * 0.25,
    revealTime: 900,
    lastShot: 0,
    boosting: false,
    boostEnd: 0
  };
  state.player = p;
}
createPlayer();

function spawnEnemy(){
  // Only spawn from the top of the screen (y negative)
  const s = state.score;
  const p = Math.random();
  let t;
  if(p < 0.5) t = 'scout';
  else if(p < 0.85) t = 'fighter';
  else t = 'cruiser';

  // horizontal spawn position (slightly inset)
  const margin = 60;
  const x = rand(margin, state.w - margin);
  const startY = -rand(120, 420); // above screen, varied depths for "deep space" feel
  // initial downward speed (will be applied after entrance)
  let speed = t==='scout' ? rand(120,200) : t==='fighter' ? rand(80,140) : rand(40,90);
  speed *= 1 + (state.level-1)*0.08;

  // create enemy with entrance animation metadata
  const enemy = {
    id: Math.random().toString(36).slice(2,10),
    type: t,
    x: x,
    y: startY,
    vx: rand(-30,30), // slight horizontal drift while descending
    vy: speed,
    rot: Math.PI/2, // face downward initially
    sprite: enemySprites[t],
    size: t==='scout' ? 28 : t==='fighter' ? 48 : 86,
    hp: t==='scout' ? 12 : t==='fighter' ? 30 : 95,
    lastShot: 0,
    shootInterval: t==='scout' ? 0 : t==='fighter' ? 1600 : 2200,
    revealed: false,
    revealUntil: 0,
    flashing: 0,
    // entrance properties
    enterStart: now(),
    enterDuration: rand(700,1400),
    enterFromY: startY,
    enterTargetY: rand(30, Math.max(80, state.h * 0.34)), // they come down into the top region first
    entering: true
  };
  state.enemies.push(enemy);
}

// Input
const keys = {};
window.addEventListener('keydown', e=>{
  if(e.code==='Space'){ state.mouse.down = true; e.preventDefault(); }
  if(e.key==='r' || e.key==='R'){ restart(); }
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', e=>{
  if(e.code==='Space'){ state.mouse.down = false; e.preventDefault(); }
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', e=>{
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - rect.left);
  state.mouse.y = (e.clientY - rect.top);
  state.mouse.moved = true;
});
canvas.addEventListener('mousedown', e=>{ state.mouse.down = true; state.mouse.moved = true; });
canvas.addEventListener('mouseup', e=>{ state.mouse.down = false; });

// UI wiring
function initUI(){
  // Start button: starts or restarts
  startBtn.addEventListener('click', ()=>{
    // user gesture will also unlock audio
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    restart();
  });

  // Boost button: triggers temporary boost
  boostBtn.addEventListener('click', ()=>{
    activateBoost();
  });

  // Replay button: visible on game over
  replayBtn.addEventListener('click', ()=>{
    restart();
  });

  // initialize game after sprites loaded
  lastTime = now();
  running = false;
  // keep overlay visible initially (Start is available)
  overlay.style.display = 'block';
  gameoverEl.setAttribute('aria-hidden', 'true');

  // start a light update loop to allow initial overlay
  requestAnimationFrame(loop);
}

// Boost activation
function activateBoost(){
  const p = state.player;
  if(!p) return;
  const nowt = now();
  // only allow boost if we have energy
  if(state.energy > 12){
    p.boosting = true;
    p.boostEnd = nowt + 1400; // 1.4s boost
    // user gesture will resume audio if needed
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
}

// Game loop
function start(){
  if(running) return;
  running = true;
  lastTime = now();
  requestAnimationFrame(loop);
}

function loop(){
  const t = now();
  let dt = (t - lastTime)/1000;
  lastTime = t;
  if(dt > 0.06) dt = 0.06;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// Update
function update(dt){
  const p = state.player;
  if(!p) return;

  // background stars update
  for(let s of state.stars){
    s.x += (s.z*2 + 1.5)* (p.vx ? (p.vx/100) : 0) * dt;
    s.y += (s.z*2 + 1.5)* (p.vy ? (p.vy/100) : 0) * dt;
    // slowly move downward to create travel feeling
    s.y += 15* (0.2 + s.z) * dt;
    if(s.y > state.h + 10) s.y = -10;
    if(s.x > state.w + 10) s.x = -10;
    if(s.x < -10) s.x = state.w +10;
  }

  // Movement input
  let dx = 0, dy = 0;
  if(keys['w'] || keys['arrowup']) dy -= 1;
  if(keys['s'] || keys['arrowdown']) dy += 1;
  if(keys['a'] || keys['arrowleft']) dx -= 1;
  if(keys['d'] || keys['arrowright']) dx += 1;
  const mag = Math.hypot(dx,dy) || 1;
  dx /= mag; dy /= mag;

  // Boost handling
  if(p.boosting && now() < p.boostEnd && state.energy > 4){
    p.speed = p.baseSpeed * 1.9;
    state.energy = clamp(state.energy - dt*18, 0, 100);
  } else {
    p.boosting = false;
    p.speed = p.baseSpeed;
  }

  p.vx = dx * p.speed;
  p.vy = dy * p.speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Keep player in lower portion of the screen
  const topLimit = state.h * 0.58;   // do not allow moving above this (keep player below)
  p.x = clamp(p.x, 30, state.w-30);
  p.y = clamp(p.y, topLimit, state.h-30);

  // player rotation toward mouse, but prefer upward as default
  const mx = state.mouse.x, my = state.mouse.y;
  const angleToMouse = Math.atan2(my - p.y, mx - p.x);
  let targetAngle;
  const dmouse = Math.hypot(mx - p.x, my - p.y);

  // If mouse is close to ship (or pointing downward), prefer upward direction (-PI/2).
  // Otherwise allow mouse aiming but clamp if it attempts to aim downward (so default direction remains up).
  if(!state.mouse.moved || dmouse < 22) {
    targetAngle = -Math.PI/2;
  } else {
    // If mouse aims below horizontal (down), we still force an upward bias
    if(Math.sin(angleToMouse) > 0.2) {
      targetAngle = -Math.PI/2;
    } else {
      targetAngle = angleToMouse;
    }
  }
  // smooth rotate
  const diff = normalizeAngle(targetAngle - p.rotation);
  p.rotation += diff * dt * 12;

  // Shooting
  p.fireCooldown -= dt*1000;
  if((state.mouse.down || keys[' ']) && p.fireCooldown <= 0 && state.energy > 2){
    shootPlayer();
    p.fireCooldown = 120; // ms
    state.energy = clamp(state.energy - 1.2, 0, 100);
  }
  // regenerate energy slowly
  state.energy = clamp(state.energy + dt*6, 0, 100);

  // Bullets
  for(let b of state.bullets){
    b.x += b.vx*dt;
    b.y += b.vy*dt;
    b.life -= dt*1000;
  }
  // Enemy bullets
  for(let b of state.enemyBullets){
    b.x += b.vx*dt;
    b.y += b.vy*dt;
    b.life -= dt*1000;
  }

  // Particles
  for(let p2 of state.particles){
    p2.x += p2.vx*dt;
    p2.y += p2.vy*dt;
    p2.life -= dt*1000;
    p2.alpha = p2.life/ p2.maxLife;
  }

  // Remove dead things
  state.bullets = state.bullets.filter(b=> b.life>0 && inBounds(b.x,b.y, -40));
  state.enemyBullets = state.enemyBullets.filter(b=> b.life>0 && inBounds(b.x,b.y, -40));
  state.particles = state.particles.filter(p2=> p2.life>0);

  // Enemies update (includes entrance animation)
  for(let e of state.enemies){
    // entrance animation: y eased from enterFromY -> enterTargetY
    if(e.entering){
      const elapsed = now() - e.enterStart;
      const tProg = clamp(elapsed / e.enterDuration, 0, 1);
      // ease out cubic
      const ease = (--(tProg) * tProg * tProg) + 1;
      // position Y uses eased interpolation (start + (target-start)*ease)
      e.y = e.enterFromY + (e.enterTargetY - e.enterFromY) * ease;
      // horizontal drift still applied
      e.x += e.vx * dt * 0.6;
      // once entrance done, mark as entered (regular movement resumes)
      if(now() - e.enterStart >= e.enterDuration) {
        e.entering = false;
        // slightly adjust vy after entrance for direct approach toward player's vertical area
        e.vy = e.vy * (1 + (state.level*0.03));
      }
    } else {
      // after entrance, move toward player but generally downward
      // desired rotation: angle to player but limited around downward to keep readable "downwards" look
      const angToPlayer = Math.atan2(state.player.y - e.y, state.player.x - e.x);
      // limit desired rotation so enemies still generally face down (PI/2)
      const desired = clampAngleToRange(angToPlayer, Math.PI/2, 0.9);
      // smooth rotate
      const err = normalizeAngle(desired - e.rot);
      e.rot += err * dt * 1.8;
      // movement: main downward component + horizontal component tuned to face player
      // ensure vertical velocity is positive
      const speed = Math.hypot(e.vx, e.vy) || e.vy;
      // recompute velocity using rotation but with emphasis to downward
      const moveAngle = e.rot;
      e.vx = Math.cos(moveAngle) * speed;
      e.vy = Math.sin(moveAngle) * speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }

    // radar reveal logic
    const d = dist(e.x,e.y,p.x,p.y);
    if(d < p.radarRadius){
      e.revealed = true;
      e.revealUntil = now() + p.revealTime;
      e.flashing = Math.min(1, (p.revealTime + 300)/1000);
    }
    if(e.revealed && now() > e.revealUntil) e.revealed = false;

    // enemy shooting (only if not entering)
    if(!e.entering && e.shootInterval > 0 && now() - e.lastShot > e.shootInterval * (1 - (state.level*0.04))){
      if(e.revealed || Math.abs(normalizeAngle(e.rot - Math.atan2(state.player.y - e.y, state.player.x - e.x))) < 0.9){
        e.lastShot = now();
        const sp = 260 + Math.random()*60 + state.level*10;
        const vx = Math.cos(e.rot) * sp;
        const vy = Math.sin(e.rot) * sp;
        state.enemyBullets.push({
          x: e.x + Math.cos(e.rot)* (e.size*0.6),
          y: e.y + Math.sin(e.rot)* (e.size*0.6),
          vx, vy,
          life: 4000,
          dmg: e.type==='cruiser'? 18 : e.type==='fighter'? 9 : 5,
        });
      }
    }
  }

  // Collisions: player bullets -> enemies
  for(let b of state.bullets){
    for(let e of state.enemies){
      if(dist(b.x,b.y,e.x,e.y) < e.size*0.6){
        e.hp -= b.dmg;
        b.life = 0;
        spawnHit(b.x,b.y);
        if(e.hp <= 0){
          explodeEnemy(e);
        }
        break;
      }
    }
  }

  // Enemy bullets -> player
  for(let b of state.enemyBullets){
    if(dist(b.x,b.y,p.x,p.y) < 26){
      state.shield -= b.dmg;
      b.life = 0;
      playExplosion();
      spawnHit(b.x,b.y, { color:'#ffb2a0' });
      if(state.shield <= 0){
        gameOver();
      }
    }
  }

  // Enemies colliding with player (ram)
  for(let e of state.enemies){
    if(dist(e.x,e.y,p.x,p.y) < e.size*0.4 + p.r*0.7){
      state.shield -= 8;
      e.hp -= 30;
      if(e.hp <= 0) explodeEnemy(e);
      spawnHit((e.x+p.x)/2,(e.y+p.y)/2,{color:'#ffcc88'});
      if(state.shield <= 0) gameOver();
    }
  }

  // Remove offscreen enemies a bit after leaving bottom
  state.enemies = state.enemies.filter(e => !(e.y > state.h + 220) && e.hp > -300);

  // Spawn logic & difficulty scaling (only spawn from top now)
  state.spawnTimer -= dt*1000;
  if(state.spawnTimer <= 0){
    spawnEnemy();
    state.spawnInterval = clamp(1100 - state.level*40 - Math.min(650, state.score*0.5), 420, 1600);
    state.spawnTimer = state.spawnInterval * (0.8 + Math.random()*0.6);
  }
  state.difficultyTimer += dt;
  if(state.difficultyTimer > 12){
    state.level++;
    state.difficultyTimer = 0;
  }

  // Update HUD
  hudScore.textContent = 'SCORE: ' + String(state.score).padStart(6,'0');
  hudShield.textContent = 'SHIELD: ' + Math.max(0,Math.round(state.shield)) + '%';
  hudEnergy.textContent = 'ENERGY: ' + Math.round(state.energy) + '%';

  // Radar render update
  drawRadar();

  // small cleanup if too many bullets/particles
  if(state.particles.length > 1000) state.particles.length = 700;
  if(state.bullets.length > 400) state.bullets.length = 350;
}

// Helpers
function inBounds(x,y, pad=0){
  return x > -pad && x < state.w + pad && y > -pad && y < state.h + pad;
}
function dist(x1,y1,x2,y2){ return Math.hypot(x1-x2,y1-y2); }
function normalizeAngle(a){
  while(a > Math.PI) a -= Math.PI*2;
  while(a < -Math.PI) a += Math.PI*2;
  return a;
}
function clampAngleToRange(angle, center, span){
  // returns angle moved toward 'angle' but clamped to center +/- span
  const diff = normalizeAngle(angle - center);
  const clamped = clamp(diff, -span, span);
  return normalizeAngle(center + clamped);
}

// Shooting
function shootPlayer(){
  const p = state.player;
  // shot direction is player's rotation (which tends upward)
  const baseAngle = p.rotation;
  for(let off of [-0.02, 0.02]){
    const angle = baseAngle + off;
    const speed = 780;
    state.bullets.push({
      x: p.x + Math.cos(angle)*36,
      y: p.y + Math.sin(angle)*36,
      vx: Math.cos(angle)*speed,
      vy: Math.sin(angle)*speed,
      life: 900,
      dmg: 12,
      color:'#83f2ff'
    });
  }
  // muzzle particle
  for(let i=0;i<8;i++){
    const a = baseAngle + rand(-0.25,0.25);
    const s = rand(40,220);
    state.particles.push({
      x: p.x + Math.cos(baseAngle)*36,
      y: p.y + Math.sin(baseAngle)*36,
      vx: Math.cos(a)*s,
      vy: Math.sin(a)*s,
      life: 160 + Math.random()*120,
      maxLife: 260,
      size: 1.6 + Math.random()*2.4,
      color: '#aef2ff',
      alpha:1
    });
  }
  playShot();
}

// Hit particles
function spawnHit(x,y,opts={}){
  const color = opts.color || '#ffd6e1';
  for(let i=0;i<12;i++){
    const a = Math.random()*Math.PI*2;
    const s = rand(30,200);
    state.particles.push({
      x,y,vx:Math.cos(a)*s, vy:Math.sin(a)*s,
      life: 220 + Math.random()*320,
      maxLife: 500,
      size:1 + Math.random()*4,
      color,
      alpha:1
    });
  }
}

// Explosion
function explodeEnemy(e){
  const pieces = Math.min(80, Math.round(e.size*1.2));
  for(let i=0;i<pieces;i++){
    const a = Math.random()*Math.PI*2;
    const s = rand(30,320) * (e.type==='scout'?0.6:(e.type==='fighter'?1:1.6));
    state.particles.push({
      x:e.x, y:e.y,
      vx:Math.cos(a)*s, vy:Math.sin(a)*s,
      life: 420 + Math.random()*420,
      maxLife: 700,
      size: 1 + Math.random()*4,
      color: e.type==='cruiser' ? '#ffd3a8' : '#ffac9a',
      alpha:1
    });
  }
  state.score += e.type==='scout' ? 60 : e.type==='fighter' ? 170 : 620;
  playExplosion();
  state.enemies = state.enemies.filter(x => x.id !== e.id);
}

// Rendering
function render(){
  const w = state.w, h = state.h;
  // Clear with deep space gradient
  const g = ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0, '#020215');
  g.addColorStop(0.4, '#07061a');
  g.addColorStop(1, '#000011');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,w,h);

  // Nebula overlay (soft radial blur)
  drawNebula();

  // Stars
  for(let s of state.stars){
    ctx.fillStyle = `hsla(${s.hue},70%,90%,${0.7*s.z + 0.1})`;
    const size = (s.z*1.6 + 0.6) * (s.size*0.8);
    ctx.beginPath();
    ctx.arc(s.x, s.y, size, 0, Math.PI*2);
    ctx.fill();
  }

  // subtle dust streaks for cinematic look
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#7fbdf2';
  for(let i=0;i<12;i++){
    const x = (i*73 + (now()*0.02*i)) % w;
    ctx.fillRect(x, (i*53)%h, 1.2, h * 0.4);
  }
  ctx.restore();

  // Draw enemies (if revealed or partially hidden) - with entrance alpha/scale
  for(let e of state.enemies){
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    // compute alpha based on entrance progress
    let alpha = 1;
    let scale = 1;
    if(e.entering){
      const prog = clamp((now() - e.enterStart) / e.enterDuration, 0, 1);
      alpha = 0.15 + 0.85 * prog;
      scale = 0.82 + 0.18 * prog;
    }
    ctx.globalAlpha = e.revealed ? 1 * alpha : 0.32 * alpha;
    // if revealed, add glow ring
    if(e.revealed){
      ctx.save();
      ctx.globalAlpha = 0.18 * alpha;
      ctx.fillStyle = 'rgba(255,120,80,0.12)';
      ctx.beginPath();
      ctx.ellipse(0,0, e.size*1.2, e.size*0.9, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    const drawW = e.sprite.width * (e.size / e.sprite.width) * scale;
    const drawH = e.sprite.height * (e.size / e.sprite.width) * scale;
    ctx.drawImage(e.sprite, -drawW/2, -drawH/2, drawW, drawH);
    ctx.restore();

    // HP bar above enemy
    ctx.save();
    const barW = 44;
    const hx = e.x - barW/2, hy = e.y - e.size*0.7 - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, hx-2, hy-2, barW+4, 8+4, 3, true, false);
    ctx.fillStyle = '#ff6b6b';
    const hpPerc = clamp(e.hp / (e.type==='scout'?12:e.type==='fighter'?30:95), 0, 1);
    roundRect(ctx, hx, hy, barW*hpPerc, 8, 4, true, false);
    ctx.restore();
  }

  // Enemy bullets
  for(let b of state.enemyBullets){
    ctx.save();
    ctx.fillStyle = '#ffb08a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // player bullets with glow
  for(let b of state.bullets){
    ctx.save();
    ctx.fillStyle = b.color || '#8fefff';
    ctx.shadowBlur = 16;
    ctx.shadowColor = b.color || '#8fefff';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 6, 3, Math.atan2(b.vy,b.vx), 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // Particles
  for(let p of state.particles){
    ctx.save();
    ctx.globalAlpha = clamp(p.alpha,0,1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // Draw player with engine glow
  const pl = state.player;
  ctx.save();
  ctx.translate(pl.x, pl.y);
  ctx.rotate(pl.rotation);
  // engine glow
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g2 = ctx.createRadialGradient(-6, 68, 2, 0, 80, 120);
  g2.addColorStop(0, 'rgba(140,220,255,0.9)');
  g2.addColorStop(0.45, 'rgba(50,90,220,0.24)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.ellipse(0, 86, 40, 28, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  // ship draw
  if(playerSprite){
    const size = 84;
    ctx.drawImage(playerSprite, -size/2, -size/2, size, size);
    // muzzle flare if shooting
    if(state.mouse.down){
      ctx.save();
      ctx.globalAlpha = 0.22 + Math.random()*0.16;
      ctx.fillStyle = '#aef2ff';
      ctx.beginPath();
      ctx.ellipse(0, -50, 18, 7, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();

  // Foreground vignette
  ctx.save();
  const vg = ctx.createRadialGradient(state.w/2, state.h/2, Math.min(state.w,state.h)*0.3, state.w/2, state.h/2, Math.max(state.w,state.h)*0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,state.w,state.h);
  ctx.restore();
}

// Nebula painting (soft)
function drawNebula(){
  const cx = state.w * 0.6 + Math.sin(now()*0.0002 + seed) * 120;
  const cy = state.h * 0.4 + Math.cos(now()*0.00024 + seed) * 80;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(state.w, state.h)*0.9);
  g.addColorStop(0, 'rgba(34,12,48,0.44)');
  g.addColorStop(0.2, 'rgba(32,20,58,0.32)');
  g.addColorStop(0.5, 'rgba(12,10,34,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = g;
  ctx.fillRect(0,0,state.w,state.h);
  ctx.restore();
}

// Radar drawing - unchanged logic aside from staying consistent with reveal
function drawRadar(){
  const rctx = radarCtx;
  const s = radarCanvas.width;
  rctx.clearRect(0,0,s,s);
  rctx.save();
  // background circle
  rctx.fillStyle = 'rgba(4,10,18,0.8)';
  rctx.beginPath();
  rctx.arc(s/2,s/2,s/2,0,Math.PI*2);
  rctx.fill();
  // grid rings
  rctx.strokeStyle = 'rgba(100,200,255,0.06)';
  rctx.lineWidth = 1;
  for(let i=1;i<=3;i++){
    rctx.beginPath();
    rctx.arc(s/2,s/2,(s/2)*i/3,0,Math.PI*2);
    rctx.stroke();
  }
  // player marker
  rctx.fillStyle = '#86f6ff';
  rctx.beginPath();
  rctx.arc(s/2,s/2,4,0,Math.PI*2);
  rctx.fill();

  // map enemies relative to player (only those within range)
  const radius = state.player.radarRadius;
  for(let e of state.enemies){
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    if(Math.abs(dx) > radius || Math.abs(dy) > radius) continue;
    const rx = (dx/radius) * (s/2) + s/2;
    const ry = (dy/radius) * (s/2) + s/2;
    if(e.revealed){
      rctx.fillStyle = e.type==='cruiser'?'#ffd89e' : e.type==='fighter'?'#ffb08a' : '#ff7a6a';
      rctx.globalAlpha = 1;
      rctx.beginPath();
      rctx.arc(rx, ry, Math.max(2, (e.size/60)), 0, Math.PI*2);
      rctx.fill();
      // subtle outline
      rctx.strokeStyle = 'rgba(255,255,255,0.08)';
      rctx.lineWidth = 1;
      rctx.stroke();
    } else {
      // dim blip (not fully revealed)
      rctx.fillStyle = 'rgba(255,255,255,0.06)';
      rctx.beginPath();
      rctx.arc(rx, ry, 2, 0, Math.PI*2);
      rctx.fill();
    }
  }

  // radar ring pulse indicator
  const pulse = (now() % 1600)/1600;
  rctx.strokeStyle = 'rgba(120,200,255,0.08)';
  rctx.lineWidth = 2;
  rctx.beginPath();
  rctx.arc(s/2, s/2, (s/2)*(0.2 + pulse*0.8), 0, Math.PI*2);
  rctx.stroke();

  rctx.restore();
}

// Utility: rounded rect
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof stroke === 'undefined') { stroke = true; }
  if (typeof radius === 'undefined') { radius = 5; }
  if (typeof radius === 'number') { radius = {tl: radius, tr: radius, br: radius, bl: radius}; }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Game over
function gameOver(){
  running = false;
  // show overlay with gameover area
  overlay.style.display = 'block';
  document.getElementById('title').textContent = 'DARKSIDE — LOST';
  // show final score in central gameover area
  gameoverScoreEl.textContent = 'SCORE: ' + String(state.score).padStart(6,'0');
  gameoverEl.setAttribute('aria-hidden', 'false');
}

// Restart
function restart(){
  state.bullets.length = 0;
  state.enemyBullets.length = 0;
  state.enemies.length = 0;
  state.particles.length = 0;
  state.score = 0;
  state.shield = 100;
  state.energy = 100;
  state.level = 1;
  state.spawnTimer = 800;
  state.difficultyTimer = 0;
  createPlayer();
  overlay.style.display = 'none';
  document.getElementById('title').textContent = 'DARKSIDE';
  document.getElementById('subtitle').textContent = 'A lone ship fights through the dark side...';
  gameoverEl.setAttribute('aria-hidden', 'true');
  running = true;
  lastTime = now();
  // spawn initial waves
  for(let i=0;i<2;i++) spawnEnemy();
}

// initial spawns so gameplay starts feeling alive after Start
state.spawnTimer = 500;
for(let i=0;i<2;i++) spawnEnemy();
