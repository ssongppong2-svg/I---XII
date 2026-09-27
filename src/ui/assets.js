// 그림 슬롯 — assets/ 폴더에 정해진 이름으로 넣으면 자동으로 쓴다 (webp · png · jpg)
// 없으면 null → 각 화면이 기본 그림(실루엣 · SVG)을 그린다
const found = new Map();      // key → url | null
const pending = new Map();    // key → Promise

// 주인공 표정 (대사 장면 · 왼쪽 얼굴 칸)
export const FACES = {
  idle:      { file: 'hero',           label: '기본' },
  aim:       { file: 'hero-aim',       label: '조준' },
  overload:  { file: 'hero-overload',  label: '과부하', center: [0.494, 0.208] },   // 고개를 숙인 자세라 얼굴이 아래쪽
  smug:      { file: 'hero-smug',      label: '씩 웃음' },
  surprised: { file: 'hero-surprised', label: '놀람' },
  puzzled:   { file: 'hero-puzzled',   label: '의문' },
  wounded:   { file: 'hero-wounded',   label: '부상' },
  pain:      { file: 'hero-pain',      label: '괴로움' },
  angry:     { file: 'hero-angry',     label: '분노' },
};
export const FACE_FALLBACK = { puzzled: ['surprised'], wounded: ['pain', 'overload'], pain: ['overload'] };
export const FACE_CENTER = [0.489, 0.135];   // 전신 그림(2:3)에서 얼굴 가운데 (가로 · 세로 비율)

// 그 밖의 슬롯 (적 · 인물 · 보스 · 카드) — 적 그림 이름은 foes.js의 art 값
const STATIC = ['hero-sd', 'card-bg', 'shopkeeper', 'shopkeeper-hmph', 'blackmarket', 'believer', 'boss', 'boss-full'];

function probe(base) {
  const exts = ['webp', 'png', 'jpg'];
  return new Promise(res => {
    let i = 0;
    const next = () => {
      if (i >= exts.length) return res(null);
      const url = `assets/${base}.${exts[i++]}`;
      const img = new Image();
      img.onload = () => res(url);
      img.onerror = next;
      img.src = url;
    };
    next();
  });
}

export function load(key) {
  if (found.has(key)) return Promise.resolve(found.get(key));
  if (pending.has(key)) return pending.get(key);
  const p = probe(key).then(url => { found.set(key, url); pending.delete(key); return url; });
  pending.set(key, p);
  return p;
}
export const loadAll = keys => Promise.all(keys.map(load));
export const art = key => found.get(key) || null;           // 확인된 것만 (없거나 아직이면 null)
export const known = key => found.has(key);

export function preloadCore() {
  return loadAll([...Object.values(FACES).map(f => f.file), ...STATIC]);
}

export function faceUrl(face) {
  for (const f of [face, ...(FACE_FALLBACK[face] || []), 'idle']) {
    const u = art(FACES[f] ? FACES[f].file : '');
    if (u) return u;
  }
  return null;
}
export function faceKeyOf(url) {
  return Object.keys(FACES).find(k => art(FACES[k].file) === url) || 'idle';
}
