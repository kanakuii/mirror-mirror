// Laugh highlights ("Happily Ever Laughter"), per CLAUDE.md's privacy rules:
//   - only when the host opted in, only while a round is being drawn;
//   - a rolling ~12 s buffer in memory; only moments the room laughed are kept;
//   - clips never leave this laptop, anyone can veto one, and they vanish on Play again.
//
// MediaRecorder output can only start playing at a keyframe, so instead of one endless
// recording we record short self-contained segments back to back and keep the last few.
// A clip is the run of segments around the laugh, played one after another.
import { reactive } from 'vue';

export const clips = reactive([]); // { id, round, artistName, intensity, thumb, parts: Blob[], durationMs }

const SEGMENT_MS = 4000;
const KEEP_SEGMENTS = 3; // ~12 s of history
const BEFORE_MS = 7000, AFTER_MS = 3000;
const MAX_CLIPS = 8;
const W = 640, H = 360;

export function clearClips() {
  clips.splice(0);
}

export class HighlightRecorder {
  constructor({ video, ink, audioStream, meta }) {
    Object.assign(this, { video, ink, meta }); // meta(): { round, artistName }
    this.canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    this.ctx = this.canvas.getContext('2d');
    this.segments = []; // { blob, start, end }
    this.pending = []; // laughs waiting for their "after" footage
    this.stream = this.canvas.captureStream(24);
    audioStream?.getAudioTracks().forEach((t) => this.stream.addTrack(t));
    this.mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    this.running = true;
    this.draw();
    this.startSegment();
  }

  // Camera (mirrored, like the screen) with the drawing on top.
  draw = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.draw);
    const c = this.ctx, v = this.video;
    c.fillStyle = '#120e28';
    c.fillRect(0, 0, W, H);
    if (v.readyState >= 2) {
      const s = Math.max(W / v.videoWidth, H / v.videoHeight);
      const w = v.videoWidth * s, h = v.videoHeight * s;
      c.save();
      c.translate(W, 0);
      c.scale(-1, 1);
      c.globalAlpha = 0.85;
      c.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
      c.restore();
    }
    // ink canvas is screen-shaped; fit it the same "cover" way the screen shows it
    const s = Math.max(W / this.ink.width, H / this.ink.height);
    c.drawImage(this.ink, (W - this.ink.width * s) / 2, (H - this.ink.height * s) / 2, this.ink.width * s, this.ink.height * s);
  };

  startSegment() {
    if (!this.running) return;
    const rec = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime, videoBitsPerSecond: 1_200_000 } : undefined);
    const parts = [];
    const start = performance.now();
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      this.segments.push({ blob: new Blob(parts, { type: rec.mimeType }), start, end: performance.now() });
      while (this.segments.length > KEEP_SEGMENTS + 1) this.segments.shift();
      this.flush(!this.running); // when stopping, keep whatever we have
    };
    rec.start();
    this.current = rec;
    this.rotate = setTimeout(() => this.nextSegment(), SEGMENT_MS);
  }

  nextSegment() {
    clearTimeout(this.rotate);
    const old = this.current;
    this.startSegment();
    if (old?.state === 'recording') old.stop();
  }

  /** The room laughed. Keep the moments around it once the "after" part has been recorded. */
  laugh(intensity) {
    this.pending.push({ at: performance.now(), intensity, thumb: this.canvas.toDataURL('image/jpeg', 0.7), meta: this.meta() });
    // close the current segment once the "after" part is in it
    setTimeout(() => this.running && this.nextSegment(), AFTER_MS);
  }

  flush(force) {
    const lastEnd = this.segments.at(-1)?.end ?? 0;
    this.pending = this.pending.filter((p) => {
      if (!force && lastEnd < p.at + AFTER_MS - 200) return true; // not recorded yet
      const parts = this.segments.filter((sg) => sg.end > p.at - BEFORE_MS && sg.start < p.at + AFTER_MS);
      if (parts.length) {
        const durationMs = parts.at(-1).end - parts[0].start;
        clips.push({ id: crypto.randomUUID(), ...p.meta, intensity: p.intensity, thumb: p.thumb, parts: parts.map((x) => x.blob), durationMs });
        // keep the best ones: drop the quietest laugh beyond the limit
        if (clips.length > MAX_CLIPS) clips.splice(clips.indexOf(clips.reduce((a, b) => (a.intensity < b.intensity ? a : b))), 1);
        console.log(`Laugh clip kept (${(durationMs / 1000).toFixed(1)}s, intensity ${p.intensity.toFixed(2)})`);
      }
      return false;
    });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.rotate);
    if (this.current?.state === 'recording') this.current.stop();
    this.stream.getVideoTracks().forEach((t) => t.stop()); // the mic track belongs to audio.js
  }
}
