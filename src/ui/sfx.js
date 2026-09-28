// 효과음 · 배경음 — 파일 없이 WebAudio로 합성 (배경음은 assets/bgm-<종류> 파일이 있으면 그것을 깐다)
import { SET, onSettings } from '../core/settings.js';

let ctx = null, out = null, bgOut = null, duckG = null, noise = null;
const gainFor = () => (SET.sound ? 0.8 * SET.volume : 0);
const bgGainFor = () => (SET.sound ? SET.volume * SET.music : 0);   // 배경음 — 기본값(0.8)에서 예전 장면 배경 소리와 같은 크기

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended' && document.visibilityState !== 'hidden') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = gainFor(); out.connect(ctx.destination);
    bgOut = ctx.createGain(); bgOut.gain.value = bgGainFor(); bgOut.connect(ctx.destination);
    duckG = ctx.createGain(); duckG.gain.value = duckLevel(); duckG.connect(bgOut);
    const len = Math.floor(ctx.sampleRate * 1.2);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ctx = null; return; }
  if (wantBed) bedStart(wantBed);   // 소리를 켜기 전에 정해 둔 화면의 배경음
}
onSettings(k => {
  if (!ctx) return;
  if (k === 'sound' || k === 'volume') out.gain.value = gainFor();
  if (k === 'sound' || k === 'volume' || k === 'music') bgOut.gain.value = bgGainFor();
  if (k === 'sound') { if (!SET.sound) { ambStop(0.2); bedStop(0.2); } else if (wantBed) bedStart(wantBed); }
});
// 창이 가려지면 소리를 멈춘다 — 다시 보이면 이어서 (가려진 사이 쌓인 소리가 한꺼번에 나지 않게 고리들은 멈춘 동안 건너뛴다)
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.visibilityState === 'hidden') ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

// o.to = 보낼 곳 (없으면 효과음 쪽) — 배경음 고리의 소리는 고리의 음량(페이드 · 배경음 설정)을 따른다
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
  osc.connect(g).connect(o.to || out);
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
  src.connect(bf).connect(g).connect(o.to || out);
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

/* ═════════════ 배경음 ═════════════
   두 겹 — 화면마다 깔리는 소리(bed: 타이틀 · 지도 · 전투 · 보스 · 칸마다)와 대사 장면의 배경 소리(amb: 대본의 amb).
   둘 다 설정의 「배경음」 음량을 따른다. 대사 장면이 뜨면 bed는 30%로 낮아지고, 장면이 제 배경 소리를 깔면 잠시 꺼진다 */
const noiseLoop = (g, f, type, q, v) => {
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = f; bf.Q.value = q;
  const gg = ctx.createGain(); gg.gain.value = v;
  src.connect(bf).connect(gg).connect(g); src.start();
  return src;
};
const hum = (g, f, v, type = 'sine') => {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
  const gg = ctx.createGain(); gg.gain.value = v;
  o.connect(gg).connect(g); o.start();
  return o;
};
// 느리게 숨 쉬는 저음 필터 — 드론을 거친다 (전투 · 보스)
const breathLP = (a, g, f, depth, rate) => {
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.9; lp.connect(g);
  const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
  const lg = ctx.createGain(); lg.gain.value = depth;
  lfo.connect(lg).connect(lp.frequency); lfo.start();
  a.srcs.push(lfo);
  return lp;
};
// 오르골 메아리 — 들어온 소리를 그대로 + 흐려지며 되풀이
const echo = (g, time = 0.36, fb = 0.3, wet = 0.45) => {
  const inG = ctx.createGain(), d = ctx.createDelay(1.5), f = ctx.createGain(), lp = ctx.createBiquadFilter(), w = ctx.createGain();
  d.delayTime.value = time; f.gain.value = fb; lp.type = 'lowpass'; lp.frequency.value = 2200; w.gain.value = wet;
  inG.connect(g); inG.connect(d); d.connect(lp); lp.connect(f).connect(d); lp.connect(w).connect(g);
  return inG;
};
// 오르골 한 음 — 쇠 빗살: 사인 + 옥타브 + 짧은 금속성 배음
const musicBox = (to, f, at, v) => {
  tone(f, 2.6, { type: 'sine', v, at, to });
  tone(f * 2.001, 1.1, { type: 'sine', v: v * 0.3, at, to });
  tone(f * 4.2, 0.35, { type: 'sine', v: v * 0.08, at, to });
};
// 열두 칸 사다리(A 단조 5음 — 열두 시각)와 열두 음 가락 넷 · 가락마다 받치는 낮은 음
const LADDER = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
const PHRASES = [
  [5, 8, 10, 8, 9, 8, 7, 5, 6, 5, 4, 5],
  [3, 5, 7, 5, 8, 7, 5, 4, 5, 4, 2, 3],
  [5, 8, 10, 11, 10, 9, 8, 10, 9, 8, 7, 8],
  [7, 6, 5, 4, 5, 3, 4, 2, 3, 1, 2, 0],
];
const BASS = [110, 87.31, 130.81, 98];

// 고리 종류마다 소리 만들기 — (a: 고리, g: 고리의 음량, every: 드문드문 · pulse: 박자에 맞춰, T · N: 고리로 가는 tone · hiss)
const LOOPS = {
  // ── 대사 장면 (대본의 amb)
  work(a, { g, every, T, N }) {        // 작업실 — 낮은 방 울림 + 드문드문 금속을 두드리는 소리
    a.srcs.push(noiseLoop(g, 260, 'lowpass', 0.5, 0.05), hum(g, 62, 0.012));
    every(0.7, 2.2, () => { const f = 1700 + Math.random() * 1400; T(f, 0.05, { type: 'triangle', v: 0.03 }); T(f * 1.5, 0.08, { type: 'sine', v: 0.012, at: 0.01 }); N(0.03, { v: 0.03, f: 5200, type: 'highpass' }); });
  },
  fire(a, { g, every, N }) {           // 화로 — 불 소리 + 타닥
    a.srcs.push(noiseLoop(g, 700, 'lowpass', 0.4, 0.07));
    every(0.25, 1.1, () => N(0.02 + Math.random() * 0.03, { v: 0.05 + Math.random() * 0.05, f: 2200 + Math.random() * 2400, type: 'bandpass', q: 2 }));
  },
  wind(a, { g }) {                     // 성벽 밖 · 다리 — 바람
    a.srcs.push(noiseLoop(g, 420, 'lowpass', 0.7, 0.11), noiseLoop(g, 1300, 'bandpass', 0.35, 0.025));
  },
  hum(a, { g, every, T }) {            // 난방실 · 공장 — 기계 소음
    a.srcs.push(hum(g, 55, 0.03, 'sawtooth'), hum(g, 110, 0.012), noiseLoop(g, 520, 'lowpass', 0.6, 0.04));
    every(1.6, 4, () => T(90 + Math.random() * 40, 0.4, { type: 'triangle', v: 0.02 }));
  },
  street(a, { g, every, T }) {         // 시장 · 골목 — 먼 거리 소리
    a.srcs.push(noiseLoop(g, 900, 'bandpass', 0.5, 0.035));
    every(1.4, 3.6, () => T(300 + Math.random() * 500, 0.12, { type: 'triangle', v: 0.012 }));
  },
  drip(a, { g, every, T }) {           // 지하 · 복도 — 물방울
    a.srcs.push(noiseLoop(g, 300, 'lowpass', 0.6, 0.035));
    every(1.2, 3.2, () => T(1300 + Math.random() * 900, 0.09, { type: 'sine', v: 0.02, f2: 700 }));
  },
  // ── 화면 (bed)
  title(a, { g, every, pulse, T, N }) {   // 타이틀 · 난이도 — 오르골 가락(열두 음) + 느린 시계
    const box = echo(g);
    a.srcs.push(hum(g, 55, 0.006), noiseLoop(g, 240, 'lowpass', 0.5, 0.012));
    pulse(1, (at, n) => { T(n % 2 ? 1500 : 1800, 0.018, { type: 'square', v: 0.005, at }); N(0.02, { v: 0.008, f: 6500, type: 'highpass', at }); });
    let p = 0;
    every(10.5, 12, () => {
      const i = p++ % PHRASES.length;
      T(BASS[i], 6, { type: 'sine', v: 0.028, to: box });
      PHRASES[i].forEach((n, k) => musicBox(box, LADDER[n], 0.3 + k * 0.5 + (Math.random() - 0.5) * 0.02, k === 0 ? 0.05 : 0.036));
    }, 1.2);
  },
  map(a, { g, every, pulse, T, N }) {     // 톱니 지도 — 째깍거리는 장치 + 먼 톱니 + 가끔 오르골 몇 음 (타이틀 가락의 조각)
    const box = echo(g, 0.42, 0.28, 0.5);
    a.srcs.push(hum(g, 55, 0.012), hum(g, 82.4, 0.005), noiseLoop(g, 320, 'lowpass', 0.6, 0.018));
    pulse(1, (at, n) => { T(n % 2 ? 1450 : 1750, 0.018, { type: 'square', v: 0.006, at }); N(0.02, { v: 0.012, f: 6000, type: 'highpass', at }); });
    every(7, 13, () => { for (let i = 0; i < 6; i++) T(1300 + (i % 2) * 220, 0.02, { type: 'square', v: 0.006, at: i * 0.06 }); T(70, 0.6, { type: 'triangle', v: 0.018, f2: 60 }); }, 5);
    every(6, 11, () => { const P = PHRASES[(Math.random() * PHRASES.length) | 0], s = (Math.random() * 8) | 0; for (let i = 0; i < 4; i++) musicBox(box, LADDER[P[(s + i) % 12]] / 2, i * 0.62, 0.028); }, 3);
  },
  battle(a, { g, every, pulse, T, N }) {  // 전투 — 맥놀이하는 낮은 기계음 + 느린 맥박 + 빠른 초침 + 먼 쇳소리
    const lp = breathLP(a, g, 170, 60, 0.06);
    a.srcs.push(hum(lp, 55, 0.04, 'sawtooth'), hum(lp, 55.35, 0.032, 'sawtooth'));
    pulse(0.5, (at, n) => {
      N(0.018, { v: n % 2 ? 0.008 : 0.014, f: 7000, type: 'highpass', at });
      if (n % 4 === 0) T(64, 0.26, { v: 0.065, f2: 40, at }); else if (n % 4 === 2) T(60, 0.2, { v: 0.035, f2: 40, at });
    });
    every(9, 16, () => { T(180, 1.3, { type: 'triangle', v: 0.018, f2: 172 }); T(497, 0.9, { type: 'sine', v: 0.01 }); N(0.5, { v: 0.018, f: 900, type: 'bandpass', q: 5 }); }, 6);
  },
  boss(a, { g, every, pulse, T, N }) {    // 보스 — 더 낮고 무거운 기계음 + 빠른 맥박 + 거대한 쇳소리 + 조여 오는 낮은 음
    const lp = breathLP(a, g, 150, 50, 0.09);
    a.srcs.push(hum(lp, 41.2, 0.05, 'sawtooth'), hum(lp, 41.55, 0.04, 'sawtooth'), hum(g, 82.4, 0.008));
    pulse(0.4, (at, n) => {
      N(0.018, { v: n % 2 ? 0.009 : 0.016, f: 7000, type: 'highpass', at });
      if (n % 2 === 0) T(58, 0.24, { v: n % 4 === 0 ? 0.08 : 0.048, f2: 36, at });
    });
    every(5, 9, () => { T(140, 1.6, { type: 'triangle', v: 0.022, f2: 132 }); T(386, 1.1, { type: 'sine', v: 0.012 }); T(1033, 0.6, { type: 'sine', v: 0.005 }); N(0.6, { v: 0.02, f: 700, type: 'bandpass', q: 4 }); }, 3);
    every(14, 20, () => T(110, 4, { type: 'sine', v: 0.02, f2: 117 }), 10);
  },
  forge(a, { g, every, T, N }) {          // 강화소 — 화로 + 드문드문 모루
    a.srcs.push(noiseLoop(g, 600, 'lowpass', 0.4, 0.05));
    every(2.5, 5, () => { const f = 1100 + Math.random() * 300; T(f, 0.6, { type: 'triangle', v: 0.03 }); T(f * 2.7, 0.3, { type: 'sine', v: 0.012 }); N(0.05, { v: 0.04, f: 3000, type: 'bandpass', q: 2 }); }, 1.5);
    every(0.3, 1.2, () => N(0.02 + Math.random() * 0.03, { v: 0.03 + Math.random() * 0.04, f: 2000 + Math.random() * 2000, type: 'bandpass', q: 2 }));
  },
  abyss(a, { g, every, T }) {             // 심연 — 깊은 바람 + 아주 낮은 울림
    a.srcs.push(noiseLoop(g, 180, 'lowpass', 0.8, 0.09), noiseLoop(g, 700, 'bandpass', 0.3, 0.012), hum(g, 36.7, 0.02));
    every(6, 12, () => T(73.4 + Math.random() * 10, 3, { type: 'sine', v: 0.02, f2: 70 }), 4);
  },
  // 파일 배경음 — assets/bgm-<종류>.ogg · mp3 · m4a (되풀이)
  file(a, { g }, url) {
    const el = new Audio(url);
    el.loop = true;
    try { ctx.createMediaElementSource(el).connect(g); } catch (e) { return; }
    el.play().catch(() => {});
    a.el = el;
  },
};

// 대본의 amb · 화면의 bed로 부를 수 있는 이름 (데이터 점검이 읽는다)
export const LOOP_KINDS = Object.keys(LOOPS).filter(k => k !== 'file');

function loopStart(kind, dest, fade = 1.4, url = '') {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(1, ctx.currentTime + fade);
  g.connect(dest);
  const a = { kind, g, srcs: [], timers: [], live: true, el: null };
  // 드문드문 — 처음은 first초 뒤, 그다음은 min~max초마다. 창이 가려져 멈춘 동안은 건너뛴다
  const every = (min, max, fn, first = min) => {
    const i = a.timers.length; a.timers.push(0);
    const loop = () => { if (!a.live) return; if (ctx.state === 'running') fn(); a.timers[i] = setTimeout(loop, (min + Math.random() * (max - min)) * 1000); };
    a.timers[i] = setTimeout(loop, first * 1000);
  };
  // 박자에 맞춰 — sec초 간격을 소리 시계로 조금 앞서 예약해 흔들리지 않게 (fn(몇 초 뒤, 몇 번째))
  const pulse = (sec, fn) => {
    const i = a.timers.length; a.timers.push(0);
    let next = 0, n = 0;
    const loop = () => {
      if (!a.live) return;
      if (ctx.state === 'running') {
        const now = ctx.currentTime;
        if (next < now) next = now + 0.05;
        while (next < now + 0.3) { fn(next - now, n++); next += sec; }
      }
      a.timers[i] = setTimeout(loop, 100);
    };
    loop();
  };
  const T = (f, t, o = {}) => tone(f, t, Object.assign({ to: g }, o));
  const N = (t, o = {}) => hiss(t, Object.assign({ to: g }, o));
  if (LOOPS[kind]) LOOPS[kind](a, { g, every, pulse, T, N }, url);
  return a;
}
function loopStop(a, fade = 0.9) {
  if (!a) return;
  a.live = false;
  a.timers.forEach(t => clearTimeout(t));
  if (a.el) { const el = a.el; setTimeout(() => el.pause(), (fade + 0.1) * 1000); }
  if (!ctx) return;
  const t = ctx.currentTime;
  try { a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(Math.max(0.0001, a.g.gain.value), t); a.g.gain.exponentialRampToValueAtTime(0.0001, t + fade); } catch (e) { /* 이미 멈춘 노드 */ }
  a.srcs.forEach(s => { try { s.stop(t + fade + 0.05); } catch (e) { /* 이미 멈춤 */ } });
  setTimeout(() => { try { a.g.disconnect(); } catch (e) { /* 이미 끊김 */ } }, (fade + 0.4) * 1000);
}

// ── 대사 장면의 배경 소리 (amb) — 장면이 끝나면 멎는다
let amb = null, inScene = false;
function ambStop(fade = 0.9) { if (!amb) return; loopStop(amb, fade); amb = null; duckTo(); }
function ambStart(kind) {
  if (amb && amb.kind === kind) return;
  ambStop();
  if (!kind || !ctx || !SET.sound) return;
  amb = loopStart(kind, bgOut);
  duckTo();
}

// ── 화면의 배경음 (bed) — 같은 종류면 이어서, 바뀌면 천천히 갈아 끼운다
let bed = null, bedKind = null, wantBed = null;
const BGM_FILES = ['title', 'map', 'battle', 'boss'];   // 이 종류는 assets/bgm-<종류> 파일을 먼저 찾는다
const bgmUrl = new Map();                               // 종류 → 주소 | null (찾아본 결과)
function findBgm(kind) {
  if (!BGM_FILES.includes(kind)) return Promise.resolve(null);
  if (bgmUrl.has(kind)) return Promise.resolve(bgmUrl.get(kind));
  return new Promise(res => {
    const exts = ['ogg', 'mp3', 'm4a'];
    let i = 0;
    const next = () => {
      if (i >= exts.length) { bgmUrl.set(kind, null); res(null); return; }
      const url = `assets/bgm-${kind}.${exts[i++]}`;
      const el = new Audio();
      el.preload = 'metadata';
      el.onloadedmetadata = () => { bgmUrl.set(kind, url); res(url); };
      el.onerror = next;
      el.src = url;
    };
    next();
  });
}
function bedStop(fade = 1.2) { loopStop(bed, fade); bed = null; bedKind = null; }
function bedStart(kind) {
  if (!ctx || !SET.sound || !kind || bedKind === kind) return;
  bedStop();
  bedKind = kind;
  findBgm(kind).then(url => {
    if (bedKind !== kind || bed || !ctx || !SET.sound) return;   // 찾는 사이 화면이 바뀌었다
    bed = loopStart(url ? 'file' : kind, duckG, 2, url || '');
  });
}
// 대사 장면이 뜨면 bed를 낮춘다 — 장면이 제 배경 소리를 깔면 잠시 끈다
const duckLevel = () => (amb ? 0.0001 : inScene ? 0.3 : 1);
function duckTo() {
  if (!ctx || !duckG) return;
  const t = ctx.currentTime, v = duckLevel();
  try { duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(Math.max(0.0001, duckG.gain.value), t); duckG.gain.exponentialRampToValueAtTime(v, t + (v < 0.5 ? 0.7 : 1.8)); } catch (e) { /* 노드 없음 */ }
}
// 시험용 — 지금 정해진 배경음 (소리가 꺼져 있어도 화면이 무엇을 골랐는지)
export const audioState = () => ({ bed: wantBed, playing: bed ? bed.kind : null, amb: amb ? amb.kind : null, scene: inScene, duck: duckLevel() });

export const SFX = {
  // 대사 장면의 배경 소리 — kind 없이 부르면 멎는다
  amb(kind) { if (kind) ambStart(kind); else ambStop(); },
  // 화면의 배경음 — 'title' · 'map' · 'battle' · 'boss' · 칸마다('fire' · 'street' · 'forge' …), null이면 조용히
  bed(kind) { wantBed = kind || null; if (!wantBed) bedStop(); else bedStart(wantBed); },
  // 대사 장면이 떠 있는 동안 (장면 엔진이 부른다)
  scene(on) { inScene = !!on; duckTo(); },
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
