// Este é o código completo e funcional para o seu arquivo script.js

(() => {
  const TILE = 8;
  const MAP_SCALE = 1;
  const WATER = 0, LAND = 1;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

  let w = 0, h = 0;
  let terrain, fire;
  const humans = [];
  const trees = [];
  let wood = 0;

  let offsetX = 0, offsetY = 0;
  let scale = 1;

  let running = true;
  let speedMul = 1;
  let brushSize = 2;
  let mapSize = 600;
  let date;
  let tool = 'paint_land';

  // Referências aos novos elementos da UI
  const categoryButtons = document.querySelectorAll('#category-bar button');
  const toolPanels = document.querySelectorAll('.tool-panel');
  const toolButtons = document.querySelectorAll('.tool-button');
  const backButtons = document.querySelectorAll('#back-button');

  // Evento para botões de categoria
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      categoryButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      const category = button.dataset.category;
      
      toolPanels.forEach(panel => panel.classList.remove('active'));
      document.getElementById(`panel-${category}`).classList.add('active');
    });
  });

  // Evento para o botão de "voltar"
  backButtons.forEach(button => {
    button.addEventListener('click', () => {
        toolPanels.forEach(panel => panel.classList.remove('active'));
        document.getElementById('panel-terrain').classList.add('active');
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-category="terrain"]').classList.add('active');
    });
  });

  // Evento para seleção de ferramentas
  toolButtons.forEach(button => {
    button.addEventListener('click', () => {
      toolButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      tool = button.dataset.tool;
    });
  });

  // Outros elementos de UI
  document.getElementById('brush').addEventListener('input', e => brushSize = +e.target.value);
  document.getElementById('speed').addEventListener('input', e => speedMul = +e.target.value);
  document.getElementById('pause').addEventListener('click', () => {
    running = !running;
    document.getElementById('pause').textContent = running ? '⏸️ Pausar' : '▶️ Continuar';
  });
  document.getElementById('reset').addEventListener('click', resetWorld);
  document.getElementById('map-size').addEventListener('change', e => {
    mapSize = parseInt(e.target.value);
    resize();
  });

  const timeEl = document.getElementById('time');
  const dateEl = document.getElementById('date');
  const eraEl = document.getElementById('era');

  const infoPanel = document.getElementById('human-info');
  const infoName = document.getElementById('info-name');
  const infoAge = document.getElementById('info-age');
  const infoHP = document.getElementById('info-hp');

  class Human {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.dir = Math.random() * Math.PI * 2;
      this.timer = 0;
      this.hp = 100;
      this.speechCooldown = 0;
      this.mate = null;
      this.age = 0;
      this.name = this.generateName();
      this.resources = { wood: 0 };
      this.targetTree = null;
      this.state = 'wandering';
    }

    generateName() {
      const names = ['Ana', 'João', 'Maria', 'Pedro', 'Sofia', 'Lucas', 'Laura', 'Gabriel'];
      return names[Math.floor(Math.random() * names.length)];
    }

    move(dt) {
      if (this.state === 'wandering') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0.2 + Math.random() * 0.6;
          this.dir += (Math.random() - 0.5) * 1.5;
        }
        const speed = 1.2 * speedMul;
        const nx = this.x + Math.cos(this.dir) * speed * dt * 6;
        const ny = this.y + Math.sin(this.dir) * speed * dt * 6;
        const ix = Math.floor(nx), iy = Math.floor(ny);
        if (inBounds(ix, iy) && terrain[idx(ix, iy)] === LAND) {
          this.x = nx;
          this.y = ny;
        } else {
          this.dir += Math.PI * (0.4 + Math.random() * 0.6);
        }
      } else if (this.state === 'gathering' && this.targetTree) {
        const dx = this.targetTree.x - this.x;
        const dy = this.targetTree.y - this.y;
        this.dir = Math.atan2(dy, dx);
        const speed = 1.5 * speedMul;
        this.x += Math.cos(this.dir) * speed * dt * 6;
        this.y += Math.sin(this.dir) * speed * dt * 6;

        if (Math.hypot(dx, dy) < 0.5) {
          this.resources.wood += 1;
          this.targetTree.isDead = true;
          this.state = 'wandering';
          wood += 1;
        }
      }
    }
    
    talk() {
      if (this.speechCooldown <= 0 && Math.random() < 0.005) {
        const speech = document.createElement("div");
        speech.className = "speech";
        speech.style.left = `${(this.x * TILE * scale) + offsetX}px`;
        speech.style.top = `${(this.y * TILE * scale) + offsetY}px`;
        const msgs = ["Olá!", "Estou com fome.", "Vamos construir!", "Me apaixonei!", "Que belo dia."];
        speech.innerText = msgs[Math.floor(Math.random() * msgs.length)];
        document.body.appendChild(speech);
        setTimeout(() => speech.remove(), 2000);
        this.speechCooldown = 200;
      }
      this.speechCooldown--;
    }
    draw(ctx) {
      const size = TILE * 0.8;
      ctx.fillStyle = this.hp > 50 ? '#f5f5f4' : '#fde047';
      ctx.fillRect(this.x * TILE - size / 2, this.y * TILE - size / 2, size, size);
    }
  }

  class Tree {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.growth = 0;
      this.age = 0;
      this.isDead = false;
    }
    grow(dt) {
      this.age += dt * 0.1 * speedMul;
      if (this.age > 10 && this.growth < 3) {
        this.growth++;
        this.age = 0;
      }
    }
    draw(ctx) {
      if(this.isDead) return;
      let color = '#006400';
      let size = TILE * 0.3;
      if (this.growth === 1) size = TILE * 0.4;
      if (this.growth === 2) size = TILE * 0.6;
      if (this.growth === 3) {
        size = TILE * 0.8;
        color = '#004d00';
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(this.x * TILE - size / 2, this.y * TILE - size / 2, size, size);
      
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(this.x * TILE - TILE * 0.1, this.y * TILE, TILE * 0.2, TILE * 0.5);
    }
  }

  class Raindrop {
    constructor() {
      this.x = Math.random() * w * TILE;
      this.y = Math.random() * h * TILE;
      this.speed = 4 + Math.random() * 4;
      this.length = 10;
    }
    fall() {
      this.y += this.speed;
      if (this.y > h * TILE) {
        this.y = -this.length;
        this.x = Math.random() * w * TILE;
      }
    }
    draw(ctx) {
      ctx.strokeStyle = "rgba(173,216,230,0.7)";
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y + this.length);
      ctx.stroke();
    }
  }

  const rain = [];
  for (let i = 0; i < 200; i++) rain.push(new Raindrop());

  function resize() {
    const vw = Math.floor(window.innerWidth);
    const vh = Math.floor(window.innerHeight);
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    w = Math.floor(mapSize / MAP_SCALE);
    h = Math.floor(mapSize / MAP_SCALE);
    terrain = new Uint8Array(w * h);
    fire = new Uint8Array(w * h);
    generateIslands();
  }
  window.addEventListener('resize', resize);
  resize();

  function idx(x, y) { return y * w + x; }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < w && y < h; }

  function generateIslands() {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dxc = (x - w / 2) / (w / 2);
        const dyc = (y - h / 2) / (h / 2);
        const r = Math.hypot(dxc, dyc);
        const n = Math.random() * 0.15 - 0.075;
        const v = (0.7 - r) + n;
        terrain[idx(x, y)] = v > 0 ? LAND : WATER;
      }
    }
    humans.length = 0;
  }

  function resetWorld() {
    generateIslands();
    fire.fill(0);
    humans.length = 0;
    trees.length = 0;
    wood = 0;
    date = new Date(1900, 0, 1, 5, 57, 0);
  }

  resetWorld();

  let lastPointers = [];
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    lastPointers.push(e);
    handleInput(e);
  });
  canvas.addEventListener('pointermove', e => {
    e.preventDefault();
    for (let i = 0; i < lastPointers.length; i++) {
      if (lastPointers[i].pointerId === e.pointerId) {
        lastPointers[i] = e;
        break;
      }
    }
    if (e.buttons === 1 || e.pointerType === 'touch') {
      handleInput(e);
    }
  });
  canvas.addEventListener('pointerup', e => {
    lastPointers = lastPointers.filter(p => p.pointerId !== e.pointerId);
    if (e.pointerType === 'mouse' && e.button === 0) {
      handleInput(e);
    }
  });

  function getMapPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX, clientY = e.clientY;
    const x = (clientX - rect.left - offsetX) / scale / TILE;
    const y = (clientY - rect.top - offsetY) / scale / TILE;
    return { x: x, y: y };
  }

  let lastPinchDist = 0;
  function handleInput(e) {
    if (lastPointers.length === 2 && e.type.includes('pointermove')) {
      const [p1, p2] = lastPointers;
      const currentDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
      if (lastPinchDist === 0) { lastPinchDist = currentDist; return; }
      const delta = currentDist - lastPinchDist;
      scale += delta * 0.005;
      scale = Math.max(0.5, Math.min(2, scale));
      lastPinchDist = currentDist;
    } else if (lastPointers.length === 1 && e.type.includes('pointermove') && e.pointerType === 'mouse' && e.buttons === 1) {
      const dx = e.movementX;
      const dy = e.movementY;
      offsetX += dx;
      offsetY += dy;
    } else if (lastPointers.length === 1 && e.type.includes('pointermove') && e.pointerType === 'touch') {
      const dx = e.clientX - (e.prevX || e.clientX);
      const dy = e.clientY - (e.prevY || e.clientY);
      offsetX += dx;
      offsetY += dy;
      e.prevX = e.clientX; e.prevY = e.clientY;
    }
    
    // Ferramentas só funcionam quando não há pan
    if (e.pointerType === 'touch' || e.buttons !== 1) {
      const { x, y } = getMapPos(e);
      if (inBounds(Math.floor(x), Math.floor(y))) {
        if (e.type.includes('pointermove') && (e.pointerType === 'mouse' && e.buttons === 1 || e.pointerType === 'touch')) {
          forBrush(Math.floor(x), Math.floor(y), (px, py) => applyTool(px, py));
        } else if (e.type.includes('pointerup') && e.pointerType === 'mouse' && e.button === 0 && tool !== 'inspect_human') {
          forBrush(Math.floor(x), Math.floor(y), (px, py) => applyTool(px, py));
        } else if (e.type.includes('pointerdown') && tool === 'inspect_human') {
          inspectHuman(x, y);
        }
      }
    }
  }

  function forBrush(cx, cy, fn) {
    const r = brushSize;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r) {
          const px = cx + x, py = cy + y;
          if (inBounds(px, py)) fn(px, py);
        }
      }
    }
  }

  function applyTool(x, y) {
    switch (tool) {
      case 'paint_land': terrain[idx(x, y)] = LAND; break;
      case 'paint_all_land': terrain.fill(LAND); break;
      case 'paint_water':
      case 'erase': terrain[idx(x, y)] = WATER; fire[idx(x, y)] = 0; break;
      case 'paint_all_water': terrain.fill(WATER); break;
      case 'spawn_human': if (terrain[idx(x, y)] === LAND) spawnHuman(x + Math.random(), y + Math.random()); break;
      case 'spawn_seed': if (terrain[idx(x, y)] === LAND) trees.push(new Tree(x, y)); break;
      case 'fire': if (terrain[idx(x, y)] === LAND) fire[idx(x, y)] = 255; break;
      case 'rain': if (fire[idx(x, y)] > 0) fire[idx(x, y)] = Math.max(0, fire[idx(x, y)] - 220); break;
    }
  }

  function spawnHuman(x, y) { humans.push(new Human(x, y)); updateCounts(); }

  function updateCounts() { document.getElementById('humansCount').textContent = String(humans.length) }

  function inspectHuman(x, y) {
    let nearestHuman = null;
    let minDistance = Infinity;

    for (const h of humans) {
      const dist = Math.hypot(h.x - x, h.y - y);
      if (dist < minDistance) {
        minDistance = dist;
        nearestHuman = h;
      }
    }

    if (nearestHuman && minDistance < 2) {
      infoName.textContent = nearestHuman.name;
      infoAge.textContent = Math.floor(nearestHuman.age);
      infoHP.textContent = Math.floor(nearestHuman.hp);
      infoPanel.style.display = 'block';
    } else {
      infoPanel.style.display = 'none';
    }
  }

  function stepHumans(dt) {
    for (let i = humans.length - 1; i >= 0; i--) {
      const h = humans[i];
      
      if (h.state === 'wandering' && h.resources.wood === 0) {
        let nearestTree = null;
        let minDistance = Infinity;
        for (const tree of trees) {
          if (!tree.isDead) {
            const dist = Math.hypot(h.x - tree.x, h.y - tree.y);
            if (dist < minDistance) {
              minDistance = dist;
              nearestTree = tree;
            }
          }
        }
        if (nearestTree && minDistance < 10) {
          h.state = 'gathering';
          h.targetTree = nearestTree;
        }
      }

      h.move(dt);
      h.talk();

      const fx = Math.floor(h.x), fy = Math.floor(h.y);
      const fval = inBounds(fx, fy) ? fire[idx(fx, fy)] : 0;
      if (fval > 0) h.hp -= 25 * dt; else h.hp = Math.min(100, h.hp + 4 * dt);

      h.age += 0.001 * speedMul;
      if (h.hp <= 0 || h.age > 80 + Math.random() * 20) { humans.splice(i, 1); continue; }

      if (h.mate === null && h.age > 18) {
        let nearestMate = null;
        let minDistance = Infinity;
        for (const other of humans) {
          if (other !== h && other.mate === null && other.age > 18) {
            const dist = Math.hypot(h.x - other.x, h.y - other.y);
            if (dist < minDistance) {
              minDistance = dist;
              nearestMate = other;
            }
          }
        }
        if (nearestMate && minDistance < 5) {
          h.mate = nearestMate;
          nearestMate.mate = h;
        }
      }

      if (h.mate !== null && Math.random() < 0.0001 * speedMul) {
        if (h.age > 20 && h.mate.age > 20) {
          spawnHuman((h.x + h.mate.x) / 2, (h.y + h.mate.y) / 2);
        }
      }
    }
    for (let i = trees.length - 1; i >= 0; i--) {
      if (trees[i].isDead) {
        trees.splice(i, 1);
      }
    }
    updateCounts();
  }

  function stepFire(dt) {
    const toAdd = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const id = idx(x, y);
        const f = fire[id];
        if (f > 0) {
          fire[id] = Math.max(0, f - (60 * dt));
          if (Math.random() < 0.03 * dt * speedMul) {
            const nx = x + (Math.random() < 0.5 ? -1 : 1);
            const ny = y + (Math.random() < 0.5 ? -1 : 1);
            if (inBounds(nx, ny)) {
              const nid = idx(nx, ny);
              if (terrain[nid] === LAND && fire[nid] < 120) { toAdd.push(nid) }
            }
          }
        }
      }
    }
    for (const id of toAdd) fire[id] = 200;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = (terrain[idx(x, y)] === WATER) ? '#0369a1' : '#166534';
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    for(const tree of trees) {
      tree.draw(ctx);
    }
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const f = fire[idx(x, y)];
        if (f > 0) {
          const a = Math.min(0.8, f / 255);
          ctx.fillStyle = `rgba(239,68,68,${a})`;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }

    if (tool === 'rain') {
      for (const r of rain) {
        r.draw(ctx);
      }
    }

    for (const h of humans) {
      h.draw(ctx);
    }
    
    ctx.restore();
  }

  function getEra(year) {
    if (year < 500) return "Antiguidade";
    if (year < 1500) return "Idade Média";
    if (year < 1800) return "Idade Moderna";
    if (year < 2100) return "Idade Contemporânea";
    return "Futuro";
  }

  function updateClock(dt) {
    const HOURS_PER_SECOND = 1;
    const minutesToAdd = dt * HOURS_PER_SECOND * 60 * speedMul;
    date.setMinutes(date.getMinutes() + minutesToAdd);
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    eraEl.textContent = `Era: ${getEra(y)}`;
    dateEl.textContent = `Data: ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    timeEl.textContent = `Hora: ${h}:${min}`;
  }
  
  let last = performance.now();
  let fpsEl = document.getElementById('fps');
  let fpsTimer = 0, frames = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (running) {
      stepFire(dt);
      stepHumans(dt);
      trees.forEach(tree => tree.grow(dt));
      if (tool === 'rain') {
        for(const r of rain) r.fall();
      }
      updateClock(dt);
    }
    draw();

    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fpsEl.textContent = `FPS: ${Math.round(frames / fpsTimer)}`;
      fpsTimer = 0;
      frames = 0;
    }
  }

  requestAnimationFrame(frame);
})();