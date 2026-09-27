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

// 말하는 사람마다 타자 밑소리 — [기본 높이, 흔들림, 길이, 파형, 크기]
const VOICES = {
  hero:     [640, 80, 0.03, 'triangle', 0.016],
  boss:     [150, 20, 0.035, 'square', 0.014],
  voice:    [500, 40, 0.045, 'sine', 0.011],
  marte:    [560, 60, 0.03, 'triangle', 0.014],   // 마르트 — 가볍고 빠르게
  or:       [168, 18, 0.04, 'square', 0.011],     // 오르 — 낮고 거칠게
  eda:      [430, 30, 0.032, 'triangle', 0.013],  // 에다 — 또렷하게
  barnett:  [205, 25, 0.036, 'square', 0.011],    // 바넷 — 느긋한 장사꾼
  human:    [300, 25, 0.04, 'sine', 0.012],       // 방문자의 목소리 · 인간의 목소리
  machine:  [880, 40, 0.022, 'square', 0.009],    // 녹음 방송 · 자동 안내 · 기계
  unknown:  [96, 10, 0.08, 'sine', 0.02],         // 알 수 없는 목소리 (II)
};

// ── 배경 소리 (대사 장면이 까는 고리) — 작업음 · 화로 · 바람 · 기계 소음 · 거리. 장면이 끝나면 멎는다
let amb = null;
function ambStop(fade = 0.9) {
  if (!amb) return;
  const a = amb; amb = null;
  a.timers.forEach(t => clearTimeout(t));
  if (!ctx) return;
  const t = ctx.currentTime;
  try { a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(Math.max(0.0001, a.g.gain.value), t); a.g.gain.exponentialRampToValueAtTime(0.0001, t + fade); } catch (e) { /* 이미 멈춘 노드 */ }
  a.srcs.forEach(s => { try { s.stop(t + fade + 0.05); } catch (e) { /* 이미 멈춤 */ } });
}
function ambLoop(g, f, type, q, v) {
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = f; bf.Q.value = q;
  const gg = ctx.createGain(); gg.gain.value = v;
  src.connect(bf).connect(gg).connect(g); src.start();
  return src;
}
function ambHum(g, f, v, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
  const gg = ctx.createGain(); gg.gain.value = v;
  o.connect(gg).connect(g); o.start();
  return o;
}
function ambStart(kind) {
  if (amb && amb.kind === kind) return;
  ambStop();
  if (!kind || !ctx || !SET.sound) return;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.4);
  g.connect(out);
  const a = { kind, g, srcs: [], timers: [] };
  const every = (min, max, fn) => { const loop = () => { if (amb !== a) return; fn(); a.timers[0] = setTimeout(loop, (min + Math.random() * (max - min)) * 1000); }; a.timers.push(setTimeout(loop, min * 1000)); };
  if (kind === 'work') {        // 작업실 — 낮은 방 울림 + 드문드문 금속을 두드리는 소리
    a.srcs.push(ambLoop(g, 260, 'lowpass', 0.5, 0.05), ambHum(g, 62, 0.012));
    every(0.7, 2.2, () => { const f = 1700 + Math.random() * 1400; tone(f, 0.05, { type: 'triangle', v: 0.03 }); tone(f * 1.5, 0.08, { type: 'sine', v: 0.012, at: 0.01 }); hiss(0.03, { v: 0.03, f: 5200, type: 'highpass' }); });
  } else if (kind === 'fire') { // 화로 — 불 소리 + 타닥
    a.srcs.push(ambLoop(g, 700, 'lowpass', 0.4, 0.07));
    every(0.25, 1.1, () => hiss(0.02 + Math.random() * 0.03, { v: 0.05 + Math.random() * 0.05, f: 2200 + Math.random() * 2400, type: 'bandpass', q: 2 }));
  } else if (kind === 'wind') { // 성벽 밖 · 다리 — 바람
    a.srcs.push(ambLoop(g, 420, 'lowpass', 0.7, 0.11), ambLoop(g, 1300, 'bandpass', 0.35, 0.025));
  } else if (kind === 'hum') {  // 난방실 · 공장 — 기계 소음
    a.srcs.push(ambHum(g, 55, 0.03, 'sawtooth'), ambHum(g, 110, 0.012), ambLoop(g, 520, 'lowpass', 0.6, 0.04));
    every(1.6, 4, () => tone(90 + Math.random() * 40, 0.4, { type: 'triangle', v: 0.02 }));
  } else if (kind === 'street') { // 시장 · 골목 — 먼 거리 소리
    a.srcs.push(ambLoop(g, 900, 'bandpass', 0.5, 0.035));
    every(1.4, 3.6, () => tone(300 + Math.random() * 500, 0.12, { type: 'triangle', v: 0.012 }));
  } else if (kind === 'drip') {   // 지하 · 복도 — 물방울
    a.srcs.push(ambLoop(g, 300, 'lowpass', 0.6, 0.035));
    every(1.2, 3.2, () => tone(1300 + Math.random() * 900, 0.09, { type: 'sine', v: 0.02, f2: 700 }));
  }
  amb = a;
}
onSettings(k => { if (k === 'sound' && !SET.sound) ambStop(0.2); });

export const SFX = {
  // 배경 소리 고리 — kind 없이 부르면 멎는다
  amb(kind) { if (kind) ambStart(kind); else ambStop(); },
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
  // who = 말하는 사람의 목소리 (장면의 cast.voice — 마르트 · 오르 · 에다 · 바넷 …)
  type(who) {
    const soft = who === 'soft';
    hiss(0.018, { v: soft ? 0.03 : 0.05, f: 3200 + Math.random() * 900, type: 'bandpass', q: 1.6 });
    if (soft) return;
    const V = VOICES[who];
    if (V) tone(V[0] + Math.random() * V[1], V[2], { type: V[3], v: V[4] });
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
  // ── 1장 대본 연출
  rumble() { tone(46, 1.5, { type: 'sawtooth', v: 0.06, f2: 38 }); hiss(1.3, { v: 0.1, f: 260 }); tone(120, 0.5, { type: 'triangle', v: 0.03, at: 0.6, f2: 90 }); },   // 금속 구조물이 움직이는 낮은 소리
  tickodd() { tone(1900, 0.03, { type: 'square', v: 0.04 }); tone(1750, 0.03, { type: 'square', v: 0.034, at: 0.58 }); tone(2050, 0.028, { type: 'square', v: 0.03, at: 0.79 }); hiss(0.03, { v: 0.05, f: 6000, type: 'highpass', at: 0.58 }); },   // 한 개의 불규칙한 시계 소리
  cloth()  { hiss(0.42, { v: 0.09, f: 1500, type: 'bandpass', q: 0.6 }); hiss(0.25, { v: 0.05, f: 3200, type: 'bandpass', q: 0.8, at: 0.12 }); },   // 천을 걷는 소리
  breath() { hiss(0.7, { v: 0.05, f: 700, type: 'lowpass' }); hiss(0.8, { v: 0.04, f: 520, type: 'lowpass', at: 0.8 }); },   // 짧은 호흡
  bells()  { SFX.bell(); tone(233, 1.9, { type: 'sine', v: 0.06, at: 0.38, f2: 230 }); tone(466, 1.2, { type: 'sine', v: 0.022, at: 0.4 }); tone(174, 2, { type: 'sine', v: 0.05, at: 0.95, f2: 172 }); },   // 어긋난 박자로 뒤따르는 종들
  whistle() { tone(2100, 0.4, { type: 'sine', v: 0.05, f2: 2050 }); tone(2100, 0.55, { type: 'sine', v: 0.05, at: 0.5, f2: 1980 }); },   // 배급 시간 휘슬
  announce() { tone(784, 0.28, { type: 'sine', v: 0.06 }); tone(659, 0.4, { type: 'sine', v: 0.06, at: 0.3 }); },   // 규정 안내음
  shutter() { hiss(0.35, { v: 0.28, f: 900 }); tone(62, 0.6, { v: 0.26, f2: 40 }); tone(520, 0.3, { type: 'triangle', v: 0.06, at: 0.05, f2: 380 }); hiss(0.9, { v: 0.05, f: 300, at: 0.2 }); },   // 금속 차단문
  collapse() { SFX.boom(); for (let i = 0; i < 7; i++) { tone(300 + Math.random() * 900, 0.2, { type: 'triangle', v: 0.05, at: 0.15 + i * 0.13, f2: 120 }); hiss(0.2, { v: 0.1, f: 1500, at: 0.1 + i * 0.13 }); } tone(40, 1.4, { v: 0.2, f2: 28, at: 0.2 }); },   // 짧은 금속 붕괴음
  lights() { tone(60, 0.8, { type: 'sawtooth', v: 0.02, f2: 120 }); tone(1200, 0.05, { type: 'square', v: 0.02, at: 0.35 }); hiss(0.6, { v: 0.02, f: 5000, type: 'highpass', at: 0.4 }); },   // 난방등이 켜진다
  murmur() { for (let i = 0; i < 5; i++) hiss(0.4 + Math.random() * 0.3, { v: 0.03, f: 500 + Math.random() * 300, type: 'bandpass', q: 1.2, at: i * 0.22 }); },   // 사람들이 작게 안도하는 소리
  train()  { tone(55, 3.2, { type: 'sawtooth', v: 0.03, f2: 48 }); hiss(3, { v: 0.05, f: 320 }); for (let i = 0; i < 8; i++) tone(95, 0.08, { type: 'triangle', v: 0.03, at: 0.3 + i * 0.34 }); tone(233, 1.4, { type: 'sine', v: 0.022, at: 1.2 }); tone(277, 1.4, { type: 'sine', v: 0.016, at: 1.2 }); },   // 먼 열차 소리
  crack()  { hiss(0.12, { v: 0.3, f: 3200, type: 'bandpass', q: 0.8 }); tone(1480, 0.5, { type: 'triangle', v: 0.05, f2: 1300 }); tone(80, 0.4, { v: 0.14, f2: 50 }); },   // 외장이 깨진다
  powerdown() { tone(220, 1.9, { type: 'sawtooth', v: 0.05, f2: 28 }); tone(110, 2.2, { type: 'sine', v: 0.06, f2: 20 }); hiss(1.6, { v: 0.05, f: 800 }); },   // 동력음 정지
  sign()   { tone(120, 1.1, { type: 'sawtooth', v: 0.018 }); tone(240, 1.1, { type: 'square', v: 0.006 }); },   // 표식 글자가 켜진다
  clink()  { tone(2400, 0.12, { type: 'triangle', v: 0.04 }); tone(3300, 0.1, { type: 'triangle', v: 0.02, at: 0.02 }); },   // 그릇
  panel()  { tone(1320, 0.05, { type: 'square', v: 0.03 }); tone(1760, 0.07, { type: 'square', v: 0.025, at: 0.07 }); },   // 권한 패널
  refuse() { tone(220, 0.14, { type: 'square', v: 0.05 }); tone(165, 0.22, { type: 'square', v: 0.05, at: 0.15 }); },   // 철회된 권한
};
