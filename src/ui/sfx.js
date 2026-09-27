// 효과음 — 파일 없이 WebAudio로 합성
import { SET, onSettings } from '../core/settings.js';

let ctx = null, out = null, noise = null;
const gainFor = () => (SET.sound ? 0.8 * SET.volume : 0);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = gainFor(); out.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 1.2);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; }
}
onSettings(k => { if ((k === 'sound' || k === 'volume') && out) out.gain.value = gainFor(); });

function tone(f, t, o = {}) {
  if (!ctx || !SET.sound) return;
  const t0 = ctx.currentTime + (o.at || 0);
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + t);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.v || 0.12, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  osc.connect(g).connect(out);
  osc.start(t0); osc.stop(t0 + t + 0.03);
}
function hiss(t, o = {}) {
  if (!ctx || !SET.sound) return;
  const t0 = ctx.currentTime + (o.at || 0);
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = t > 1.1;   // 긴 소리(바람 · 문)는 잡음을 이어 붙인다
  const bf = ctx.createBiquadFilter(); bf.type = o.type || 'lowpass'; bf.frequency.value = o.f || 1200; bf.Q.value = o.q || 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(o.v || 0.2, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  src.connect(bf).connect(g).connect(out);
  src.start(t0); src.stop(t0 + t + 0.03);
}

export const SFX = {
  step()   { tone(420, 0.07, { type: 'triangle', v: 0.07, f2: 560 }); },
  fstep()  { tone(210, 0.08, { type: 'triangle', v: 0.06, f2: 170 }); hiss(0.05, { v: 0.04, f: 900 }); },
  shot()   { hiss(0.14, { v: 0.26, f: 2600, type: 'bandpass', q: 0.9 }); tone(900, 0.07, { type: 'square', v: 0.05, f2: 180 }); },
  beam()   { tone(1200, 0.18, { type: 'sawtooth', v: 0.05, f2: 300 }); hiss(0.16, { v: 0.12, f: 3200, type: 'bandpass', q: 1.4 }); },
  bite()   { hiss(0.1, { v: 0.2, f: 1800, type: 'bandpass', q: 1 }); tone(160, 0.12, { type: 'square', v: 0.07, f2: 90 }); },
  toss()   { hiss(0.3, { v: 0.07, f: 1400, type: 'bandpass', q: 2 }); tone(300, 0.3, { type: 'sine', v: 0.04, f2: 700 }); },
  foeDie() { tone(260, 0.35, { type: 'sawtooth', v: 0.05, f2: 60 }); hiss(0.2, { v: 0.1, f: 1200 }); },
  draw()   { hiss(0.12, { v: 0.08, f: 3000, type: 'highpass' }); tone(880, 0.08, { v: 0.05, type: 'triangle', at: 0.03 }); },
  card()   { hiss(0.16, { v: 0.1, f: 1800, type: 'bandpass', q: 1.2 }); },
  hit(big) { tone(big ? 90 : 140, big ? 0.35 : 0.18, { type: 'square', v: 0.09, f2: 50 }); hiss(big ? 0.4 : 0.2, { v: 0.16, f: big ? 900 : 1400 }); },
  boom()   { hiss(0.5, { v: 0.3, f: 700 }); tone(70, 0.45, { v: 0.26, f2: 35 }); },
  heavy()  { hiss(0.7, { v: 0.32, f: 500 }); tone(55, 0.6, { v: 0.3, f2: 28 }); },
  nail()   { for (let i = 0; i < 5; i++) { hiss(0.05, { v: 0.14, f: 5000, type: 'highpass', at: i * 0.045 }); tone(1800, 0.03, { type: 'square', v: 0.03, at: i * 0.045 }); } },
  arm()    { tone(660, 0.09, { type: 'square', v: 0.035 }); tone(990, 0.09, { type: 'square', v: 0.03, at: 0.1 }); },
  warn()   { tone(330, 0.12, { type: 'sawtooth', v: 0.045 }); tone(330, 0.12, { type: 'sawtooth', v: 0.045, at: 0.16 }); },
  ward()   { tone(660, 0.25, { v: 0.08, f2: 990 }); tone(1320, 0.2, { v: 0.04, at: 0.05 }); },
  block()  { tone(1400, 0.18, { type: 'triangle', v: 0.1, f2: 900 }); hiss(0.1, { v: 0.08, f: 4000, type: 'highpass' }); },
  cool()   { hiss(0.4, { v: 0.1, f: 2500, type: 'bandpass', q: 0.8 }); },
  zap()    { for (let i = 0; i < 4; i++) tone(200 + Math.random() * 800, 0.06, { type: 'sawtooth', v: 0.05, at: i * 0.05 }); },
  stun()   { tone(600, 0.6, { type: 'sawtooth', v: 0.06, f2: 60 }); },
  fizzle() { tone(160, 0.12, { type: 'sawtooth', v: 0.05, f2: 120 }); hiss(0.08, { v: 0.05, f: 3000, type: 'highpass' }); },
  deny()   { tone(180, 0.08, { type: 'square', v: 0.045 }); tone(140, 0.1, { type: 'square', v: 0.045, at: 0.08 }); },
  // 타자기 한 글자 — 딸깍. 말하는 사람마다 밑소리가 조금 다르다 (soft = 화면 글 · 튜토리얼용 작은 소리)
  type(who) {
    const soft = who === 'soft';
    hiss(0.018, { v: soft ? 0.03 : 0.05, f: 3200 + Math.random() * 900, type: 'bandpass', q: 1.6 });
    if (soft) return;
    if (who === 'boss') tone(150 + Math.random() * 20, 0.035, { type: 'square', v: 0.014 });
    else if (who === 'hero') tone(640 + Math.random() * 80, 0.03, { type: 'triangle', v: 0.016 });
    else if (who === 'voice') tone(500 + Math.random() * 40, 0.045, { type: 'sine', v: 0.011 });
    else if (who && who !== 'nar') tone(250 + Math.random() * 40, 0.035, { type: 'square', v: 0.01 });
    else tone(120, 0.02, { type: 'triangle', v: 0.012 });
  },
  page()   { hiss(0.12, { v: 0.035, f: 2600, type: 'bandpass', q: 0.7 }); },
  chime()  { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.9, { v: 0.07, at: i * 0.12 })); },
  hurt()   { tone(220, 0.25, { type: 'square', v: 0.09, f2: 90 }); },
  win()    { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.5, { type: 'triangle', v: 0.09, at: i * 0.13 })); },
  lose()   { [330, 262, 196, 131].forEach((f, i) => tone(f, 0.6, { type: 'triangle', v: 0.09, at: i * 0.18 })); },
  // 지도 · 메뉴
  tick()   { tone(1900, 0.03, { type: 'square', v: 0.035 }); hiss(0.03, { v: 0.05, f: 6000, type: 'highpass' }); },
  bell()   { tone(196, 2.2, { type: 'sine', v: 0.09, f2: 194 }); tone(392, 1.6, { type: 'sine', v: 0.035 }); tone(587, 1.1, { type: 'triangle', v: 0.018, at: 0.02 }); },   // 먼 종소리
  wheel()  { for (let i = 0; i < 5; i++) tone(1400 + (i % 2) * 300, 0.03, { type: 'square', v: 0.018, at: i * 0.07 }); },         // 작은 바퀴
  // 열두 개의 시계가 어긋나게 겹친다 (01 첫 장면)
  clocks() { for (let c = 0; c < 12; c++) { const f = 1500 + c * 70, off = c * 0.037; for (let i = 0; i < 4; i++) tone(f, 0.022, { type: 'square', v: 0.012, at: off + i * (0.3 + c * 0.013) }); } },
  // 하나뿐이던 박자에 겹치는 낯선 박자 두 번 (II의 잔향)
  beat2()  { tone(110, 0.5, { type: 'sine', v: 0.12, f2: 96 }); tone(220, 0.3, { type: 'triangle', v: 0.03 }); tone(123, 0.55, { type: 'sine', v: 0.11, f2: 104, at: 0.42 }); tone(247, 0.3, { type: 'triangle', v: 0.028, at: 0.42 }); },
  door()   { tone(55, 1.6, { type: 'sawtooth', v: 0.05, f2: 42 }); hiss(1.4, { v: 0.09, f: 380 }); for (let i = 0; i < 6; i++) tone(700 - i * 60, 0.05, { type: 'square', v: 0.016, at: 0.2 + i * 0.18 }); },   // 큰 문이 열린다
  clank()  { tone(620, 0.32, { type: 'triangle', v: 0.08, f2: 540 }); tone(1480, 0.2, { type: 'triangle', v: 0.035 }); hiss(0.12, { v: 0.1, f: 3200, type: 'bandpass', q: 1.1 }); tone(90, 0.3, { v: 0.1, f2: 60, at: 0.05 }); },   // 쇳조각이 떨어진다
  wind()   { hiss(2.4, { v: 0.05, f: 520, type: 'lowpass' }); hiss(1.8, { v: 0.025, f: 1200, type: 'bandpass', q: 0.4, at: 0.5 }); },   // 바람 · 멀어지는 도시
  steps()  { for (let i = 0; i < 6; i++) { tone(140 + (i % 2) * 20, 0.06, { type: 'triangle', v: 0.05, at: i * 0.21 }); hiss(0.04, { v: 0.03, f: 1400, at: i * 0.21 }); } },   // 여러 사람의 발소리
  tock()   { tone(1300, 0.04, { type: 'square', v: 0.03 }); hiss(0.03, { v: 0.04, f: 4000, type: 'highpass' }); },
  gears()  { for (let i = 0; i < 8; i++) { tone(i % 2 ? 1500 : 1900, 0.025, { type: 'square', v: 0.022, at: i * 0.11 }); hiss(0.03, { v: 0.03, f: 5000, type: 'highpass', at: i * 0.11 }); } tone(90, 0.9, { type: 'sawtooth', v: 0.03, f2: 70 }); },
  click()  { tone(1100, 0.04, { type: 'triangle', v: 0.05 }); },
  hover()  { tone(1600, 0.02, { type: 'sine', v: 0.018 }); },
  coin()   { tone(1318, 0.08, { type: 'triangle', v: 0.06 }); tone(1760, 0.14, { type: 'triangle', v: 0.05, at: 0.06 }); },
  gain()   { [660, 880, 1175].forEach((f, i) => tone(f, 0.22, { type: 'triangle', v: 0.06, at: i * 0.07 })); },
  heal()   { [523, 784, 1047].forEach((f, i) => tone(f, 0.4, { v: 0.06, at: i * 0.09 })); },
  save()   { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, { v: 0.05, at: i * 0.1 })); hiss(0.6, { v: 0.03, f: 3000, type: 'bandpass', q: 0.6 }); },
  rewind() { for (let i = 0; i < 10; i++) tone(1200 - i * 90, 0.06, { type: 'triangle', v: 0.04, at: i * 0.07 }); hiss(0.9, { v: 0.06, f: 1800, type: 'bandpass', q: 0.5 }); },
  alarm()  { for (let i = 0; i < 3; i++) { tone(880, 0.14, { type: 'sawtooth', v: 0.05, at: i * 0.3 }); tone(660, 0.14, { type: 'sawtooth', v: 0.05, at: i * 0.3 + 0.15 }); } },
};
