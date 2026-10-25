// Full-screen air drawing: hand tracking (MediaPipe, in this browser only), strokes,
// undo/redo, eraser, and the wand menu that opens when the hand holds still.
//
// Anything on screen with a `data-air` attribute is an air button: hover it with the
// hand cursor and pinch to press it. Elements inside `.air-zone` are no-draw zones.

export const COLORS = ['#ffd666', '#ff7a9c', '#7ec8ff', '#8ef0a8', '#c79bff', '#ffffff'];
export const SIZES = [[6, 'Thin'], [11, 'Medium'], [22, 'Thick']];
const BG = '#120e28';
const PINCH_DOWN = 0.28, PINCH_UP = 0.42; // hysteresis, relative to hand size
const SMOOTH = 0.45;
const STILL_PX = 14, STILL_MS = 600; // hold this still this long to open the wand menu
const MENU_RADIUS = 150, MENU_CLOSE_PX = 260, REARM_PX = 70;

export class AirCanvas {
  constructor({ ink, cursor, video, ui }) {
    Object.assign(this, { ink, cursor, video, ui });
    this.ctx = ink.getContext('2d');
    this.cctx = cursor.getContext('2d');
    this.history = [];
    this.redoStack = [];
    this.current = null;
    this.hand = { pinched: false, mode: null, pos: null, lost: 0, hoverBtn: null, stillAt: null, stillPos: null, armed: true, closedAt: null };
    this.lastVideoTime = -1;
    Object.assign(ui, {
      color: COLORS[0], eraser: false, size: 1,
      canUndo: false, canRedo: false,
      menu: { open: false, x: 0, y: 0 },
      status: 'Show your hand to the camera…',
    });
    this.onResize = () => this.resize();
    addEventListener('resize', this.onResize);
    this.resize();
    this.bindMouse();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    this.unbindMouse?.();
  }

  // ---------- geometry ----------

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = innerWidth;
    this.H = innerHeight;
    for (const c of [this.ink, this.cursor]) {
      c.width = Math.round(this.W * dpr);
      c.height = Math.round(this.H * dpr);
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.scale = Math.min(this.W, this.H) / 900; // brush sizes track screen size
    this.redraw();
  }
  toPx = ([x, y]) => [x * this.W, y * this.H];
  toNorm = ([x, y]) => [x / this.W, y / this.H];

  // ---------- strokes ----------

  style(s) {
    const c = this.ctx;
    c.lineCap = c.lineJoin = 'round';
    c.lineWidth = s.width * this.scale * (s.eraser ? 2.5 : 1);
    c.globalCompositeOperation = s.eraser ? 'destination-out' : 'source-over';
    c.strokeStyle = s.eraser ? '#000' : s.color;
    c.shadowColor = s.color;
    c.shadowBlur = s.eraser ? 0 : 12 * this.scale; // wand glow
  }
  segment(s, a, b) {
    this.style(s);
    const c = this.ctx;
    c.beginPath(); c.moveTo(...this.toPx(a)); c.lineTo(...this.toPx(b)); c.stroke();
  }
  drawStroke(s) {
    if (s.points.length === 1) return this.segment(s, s.points[0], s.points[0]);
    for (let i = 1; i < s.points.length; i++) this.segment(s, s.points[i - 1], s.points[i]);
  }
  redraw() {
    this.ctx.clearRect(0, 0, this.W, this.H);
    for (const a of this.history) a.type === 'clear' ? this.ctx.clearRect(0, 0, this.W, this.H) : this.drawStroke(a);
    if (this.current) this.drawStroke(this.current);
  }
  begin(px) {
    const p = this.toNorm(px);
    this.current = { type: 'stroke', color: this.ui.color, width: SIZES[this.ui.size][0], eraser: this.ui.eraser, points: [p] };
    this.segment(this.current, p, p);
  }
  extend(px) {
    if (!this.current) return;
    const p = this.toNorm(px);
    this.segment(this.current, this.current.points.at(-1), p);
    this.current.points.push(p);
  }
  end() {
    if (!this.current) return;
    this.commit(this.current);
    this.current = null;
  }
  commit(a) {
    this.history.push(a);
    this.redoStack = [];
    this.syncButtons();
  }
  undo() {
    this.end();
    if (!this.history.length) return;
    this.redoStack.push(this.history.pop());
    this.redraw(); this.syncButtons();
  }
  redo() {
    if (this.current || !this.redoStack.length) return;
    this.history.push(this.redoStack.pop());
    this.redraw(); this.syncButtons();
  }
  clear() {
    this.end();
    if (!this.history.length || this.history.at(-1).type === 'clear') return;
    this.commit({ type: 'clear' }); // undoable
    this.redraw();
  }
  reset() {
    this.history = []; this.redoStack = []; this.current = null;
    this.redraw(); this.syncButtons();
  }
  syncButtons() {
    this.ui.canUndo = this.history.length > 0;
    this.ui.canRedo = this.redoStack.length > 0;
  }

  // ---------- tools ----------

  pickColor(i) { this.ui.color = COLORS[i]; this.ui.eraser = false; }
  toggleEraser() { this.ui.eraser = !this.ui.eraser; }
  cycleSize() { this.ui.size = (this.ui.size + 1) % SIZES.length; }
  openMenu(x, y) {
    const m = MENU_RADIUS + 50;
    this.ui.menu = { open: true, x: Math.min(this.W - m, Math.max(m, x)), y: Math.min(this.H - m, Math.max(m, y)) };
  }
  closeMenu() {
    if (!this.ui.menu.open) return;
    this.ui.menu = { ...this.ui.menu, open: false };
    this.hand.armed = false;
    this.hand.closedAt = this.hand.pos;
  }

  // ---------- what the Mirror sees ----------

  /** Visible ink only (since the last clear), cropped to the drawing, on a plain background. */
  hasInk() { return this.visibleStrokes().some((s) => !s.eraser); }
  visibleStrokes() {
    const i = this.history.findLastIndex((a) => a.type === 'clear');
    const list = this.history.slice(i + 1);
    if (this.current) list.push(this.current);
    return list;
  }
  snapshot(size = 512) {
    const strokes = this.visibleStrokes().filter((s) => !s.eraser);
    if (!strokes.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of strokes) for (const p of s.points) {
      const [x, y] = this.toPx(p);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const side = Math.max(x1 - x0, y1 - y0, 120) * 1.18; // a little breathing room
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const k = this.ink.width / this.W; // device pixels per css pixel
    const off = document.createElement('canvas');
    off.width = off.height = size;
    const o = off.getContext('2d');
    o.fillStyle = BG;
    o.fillRect(0, 0, size, size);
    o.drawImage(this.ink, (cx - side / 2) * k, (cy - side / 2) * k, side * k, side * k, 0, 0, size, size);
    return off.toDataURL('image/png');
  }

  // ---------- hit testing ----------

  hitAt([x, y]) {
    const el = document.elementFromPoint(x, y);
    return { btn: el?.closest('[data-air]') ?? null, zone: Boolean(el?.closest('.air-zone')) };
  }
  setHover(btn) {
    if (this.hand.hoverBtn === btn) return;
    this.hand.hoverBtn?.classList.remove('air-hover');
    btn?.classList.add('air-hover');
    this.hand.hoverBtn = btn;
  }
  press(btn) {
    if (btn.disabled) return;
    btn.click();
    btn.classList.add('air-flash');
    setTimeout(() => btn.classList.remove('air-flash'), 180);
  }

  // ---------- mouse (testing without a camera) ----------

  bindMouse() {
    let down = false;
    const pos = (e) => [e.clientX, e.clientY];
    const onDown = (e) => {
      if (e.button === 2) return;
      if (this.ui.menu.open) return this.closeMenu();
      down = true; this.begin(pos(e)); this.ink.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!down) return;
      const p = pos(e);
      if (this.hitAt(p).zone) this.end();
      else if (this.current) this.extend(p);
      else this.begin(p);
    };
    const onUp = () => { down = false; this.end(); };
    const onMenu = (e) => { e.preventDefault(); this.openMenu(e.clientX, e.clientY); };
    this.ink.addEventListener('pointerdown', onDown);
    this.ink.addEventListener('pointermove', onMove);
    this.ink.addEventListener('pointerup', onUp);
    this.ink.addEventListener('pointercancel', onUp);
    this.ink.addEventListener('contextmenu', onMenu);
    this.unbindMouse = () => {
      this.ink.removeEventListener('pointerdown', onDown);
      this.ink.removeEventListener('pointermove', onMove);
      this.ink.removeEventListener('pointerup', onUp);
      this.ink.removeEventListener('pointercancel', onUp);
      this.ink.removeEventListener('contextmenu', onMenu);
    };
  }

  // ---------- hand tracking ----------

  startTracking(landmarker) {
    this.landmarker = landmarker;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = this.video.currentTime;
      this.onFrame(this.landmarker.detectForVideo(this.video, performance.now()).landmarks?.[0]);
    };
    loop();
  }

  // Normalized landmark -> screen px, matching the mirrored object-fit: cover video.
  toScreen(lm) {
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const s = Math.max(this.W / vw, this.H / vh);
    const offX = (this.W - vw * s) / 2, offY = (this.H - vh * s) / 2;
    return [(1 - lm.x) * vw * s + offX, lm.y * vh * s + offY];
  }

  onFrame(lms) {
    const h = this.hand;
    if (!lms) {
      if (++h.lost > 5) {
        this.release();
        this.setHover(null);
        h.pos = null;
        this.ui.status = 'Show your hand to the camera…';
      }
      return this.drawCursor();
    }
    h.lost = 0;
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const pinch = d(lms[4], lms[8]) / (d(lms[0], lms[9]) || 1e-6);
    const raw = this.toScreen({ x: (lms[4].x + lms[8].x) / 2, y: (lms[4].y + lms[8].y) / 2 });
    h.pos = h.pos ? [h.pos[0] + (raw[0] - h.pos[0]) * SMOOTH, h.pos[1] + (raw[1] - h.pos[1]) * SMOOTH] : raw;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const { btn, zone } = this.hitAt(h.pos);
    this.setHover(h.pinched ? null : btn);

    if (!h.pinched && pinch < PINCH_DOWN) {
      h.pinched = true;
      h.stillAt = null;
      if (btn) { h.mode = 'button'; this.press(btn); if (btn.closest('.wand')) this.closeMenu(); }
      else if (this.ui.menu.open) { h.mode = 'button'; this.closeMenu(); } // pinch off-menu just closes it
      else if (zone) h.mode = 'paused';
      else { h.mode = 'draw'; this.begin(h.pos); }
    } else if (h.pinched && pinch > PINCH_UP) {
      this.release();
    } else if (h.pinched) {
      if (h.mode === 'draw' && zone) { this.end(); h.mode = 'paused'; }
      else if (h.mode === 'paused' && !zone) { h.mode = 'draw'; this.begin(h.pos); }
      else if (h.mode === 'draw') this.extend(h.pos);
    } else {
      // Not pinched: watch for stillness to open the wand menu.
      if (this.ui.menu.open && dist(h.pos, [this.ui.menu.x, this.ui.menu.y]) > MENU_CLOSE_PX) this.closeMenu();
      if (!h.armed && (!h.closedAt || dist(h.pos, h.closedAt) > REARM_PX)) h.armed = true;
      if (!h.stillPos || dist(h.pos, h.stillPos) > STILL_PX) { h.stillPos = h.pos; h.stillAt = performance.now(); }
      else if (h.armed && !btn && !zone && !this.ui.menu.open && performance.now() - h.stillAt > STILL_MS) {
        this.openMenu(...h.pos);
        h.armed = false;
        h.closedAt = h.pos;
      }
    }

    this.ui.status =
      h.mode === 'draw' ? (this.ui.eraser ? 'Erasing…' : 'Drawing ✦')
      : this.ui.menu.open ? 'Move to a tool and pinch'
      : btn && !h.pinched ? `Pinch to press ${btn.dataset.air}`
      : 'Pinch to draw · hold still for the wand menu';
    this.drawCursor();
  }

  release() {
    if (this.hand.mode === 'draw') this.end();
    this.hand.pinched = false;
    this.hand.mode = null;
  }

  drawCursor() {
    const c = this.cctx, h = this.hand;
    c.clearRect(0, 0, this.W, this.H);
    if (!h.pos) return;
    const w = SIZES[this.ui.size][0] * this.scale;
    const drawing = h.mode === 'draw';
    c.beginPath();
    if (h.hoverBtn || h.mode === 'button' || h.mode === 'paused' || this.ui.menu.open) {
      c.arc(...h.pos, 12, 0, Math.PI * 2);
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.stroke();
      if (h.pinched) { c.fillStyle = 'rgba(255,255,255,.6)'; c.fill(); }
    } else if (this.ui.eraser) {
      c.arc(...h.pos, w * 1.25, 0, Math.PI * 2);
      c.setLineDash(drawing ? [] : [5, 5]);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
      c.setLineDash([]);
    } else {
      c.arc(...h.pos, drawing ? Math.max(6, w / 2 + 2) : 16, 0, Math.PI * 2);
      if (drawing) { c.fillStyle = this.ui.color; c.fill(); }
      else { c.strokeStyle = this.ui.color; c.lineWidth = 2.5; c.stroke(); }
      // Stillness progress: a ring fills as the wand menu is about to open.
      if (!drawing && h.armed && h.stillAt && !this.ui.menu.open && !h.hoverBtn) {
        const t = Math.min(1, (performance.now() - h.stillAt) / STILL_MS);
        if (t > 0.15) {
          c.beginPath();
          c.arc(...h.pos, 24, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
          c.strokeStyle = 'rgba(247,226,162,.9)'; c.lineWidth = 3; c.stroke();
        }
      }
    }
  }
}
