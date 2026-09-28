// 씨앗(seed)이 같으면 같은 결과가 나오는 난수 — 지도 · 칸 내용이 재귀해도 똑같이 되풀이되게
export function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9E3779B9; h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = typeof seed === 'function' ? seed : mulberry32(seed ?? (Math.random() * 2 ** 32));
  const R = {
    next,
    float: (a = 0, b = 1) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: p => next() < p,
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    // [[값, 무게], ...] 에서 하나
    weighted(entries) {
      const tot = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
      if (tot <= 0) return entries[0] ? entries[0][0] : undefined;
      let x = next() * tot;
      for (const [v, w] of entries) { x -= Math.max(0, w); if (x < 0) return v; }
      return entries[entries.length - 1][0];
    },
    // 겹치지 않게 n개
    sample(arr, n) { return R.shuffle(arr.slice()).slice(0, n); },
  };
  return R;
}

// 전투 속 무작위처럼 매번 달라도 되는 곳에 쓰는 기본 난수
export const RNG = makeRng(Math.random);
