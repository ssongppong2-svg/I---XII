// I — XII 데이터 점검 (브라우저 없이 · 몇 초)
//   node tests/data.cjs
// 대본 · 사건 · 카드를 더하거나 고친 뒤에 돌린다. 이름 하나를 잘못 써도 게임은 그 장면에서야 멈추거나(효과음 · 모듈 문법)
// 조용히 빠지므로(연출 · 배경 소리 · 색조 · 아이콘) 여기서 미리 잡는다.
//   1) 소스 모듈 문법 — 브라우저가 읽는 방식(ES 모듈)으로 (node --check 로는 못 잡는 겹친 선언 등)
//   2) 효과음 — 코드에서 부르는 SFX.이름 이 모두 있는지
//   3) 장면 연출 · 배경 소리 · 색조 — 대본의 fx · amb · tint 이름을 장면 엔진 · 소리 · 스타일이 아는지
//   4) 아이콘 — icon('이름') · glyph('이름') · 데이터의 icon: '이름' 이 모두 그려지는지
//   5) 적 · 카드 참조 — 전투 구성의 foes 와 저주 카드 이름 등이 실제로 있는지
//   6) 카드 설명 — 강화판 설명이 강화 전 숫자 · 소멸을 그대로 적고 있지 않은지
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`); if (!ok) fails.push(msg); };
const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const rel = p => path.relative(ROOT, p);
const read = p => fs.readFileSync(p, 'utf8');
const all = (text, re) => [...text.matchAll(re)].map(m => m[1]);

// 모듈을 브라우저 밖에서 읽기 위한 최소한의 흉내
globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {} };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = { addEventListener() {}, querySelector() { return null; }, visibilityState: 'visible' };
const load = f => import(pathToFileURL(path.join(ROOT, f)).href);

(async () => {
  const src = walk(path.join(ROOT, 'src')).filter(f => f.endsWith('.js'));
  const data = src.filter(f => f.includes(`${path.sep}data${path.sep}`));
  const srcText = src.map(read).join('\n');
  const dataText = data.map(read).join('\n');

  console.log('1. 소스 모듈 문법');
  const bad = src.filter(f => spawnSync(process.execPath, ['--input-type=module', '--check'], { input: read(f) }).status !== 0);
  check(!bad.length, `ES 모듈 ${src.length}개 문법${bad.length ? ' — ' + bad.map(rel).join(', ') : ''}`);

  console.log('2. 효과음');
  const { SFX } = await load('src/ui/sfx.js');
  const sfxUsed = [...new Set(all(srcText, /SFX\.([A-Za-z0-9_]+)/g))];
  const sfxMissing = sfxUsed.filter(k => typeof SFX[k] !== 'function');
  check(!sfxMissing.length, `코드에서 부르는 효과음 ${sfxUsed.length}종${sfxMissing.length ? ' — 없음: ' + sfxMissing.join(', ') : ''}`);

  console.log('3. 장면 연출 · 배경 소리 · 색조');
  const scene = read(path.join(ROOT, 'src/scenes/scene.js'));
  const fxKnown = new Set(all(scene, /kind === '([a-z0-9_]+)'/g));
  for (const list of all(scene, /\[((?:'[a-z0-9_]+',?\s*)+)\]\.includes\(kind\)/g)) for (const k of list.match(/'[a-z0-9_]+'/g)) fxKnown.add(k.slice(1, -1));
  const fxUsed = [...new Set(all(dataText, /fx: '([a-z0-9_]+)'/g))];
  const fxMissing = fxUsed.filter(k => !fxKnown.has(k));
  check(!fxMissing.length, `대본의 연출(fx) ${fxUsed.length}종을 장면 엔진이 안다${fxMissing.length ? ' — 모름: ' + fxMissing.join(', ') : ''}`);
  const ambKnown = new Set(all(read(path.join(ROOT, 'src/ui/sfx.js')), /kind === '([a-z0-9_]+)'/g));
  const ambUsed = [...new Set(all(dataText, /amb: '([a-z0-9_]+)'/g))];
  const ambMissing = ambUsed.filter(k => !ambKnown.has(k));
  check(!ambMissing.length, `배경 소리(amb) ${ambUsed.length}종${ambMissing.length ? ' — 없음: ' + ambMissing.join(', ') : ''}`);
  const css = walk(path.join(ROOT, 'styles')).filter(f => f.endsWith('.css')).map(read).join('\n');
  const tintUsed = [...new Set(all(dataText, /tint: '([a-z0-9_]+)'/g))];
  const tintMissing = tintUsed.filter(k => !css.includes(`data-tint="${k}"`));
  check(!tintMissing.length, `화면 색조(tint) ${tintUsed.length}종${tintMissing.length ? ' — 스타일 없음: ' + tintMissing.join(', ') : ''}`);

  console.log('4. 아이콘');
  const { iconSprite } = await load('src/ui/icons.js');
  const iconKnown = new Set(all(iconSprite(), /id="i-([a-z0-9_-]+)"/g));
  const iconUsed = new Set([
    ...all(srcText, /\bicon\('([a-z0-9_-]+)'/g), ...all(srcText, /\bglyph\('([a-z0-9_-]+)'\)/g),
    ...all(srcText, /\bicon: '([a-z0-9_-]+)'/g), ...all(srcText, /charArt\('[^']+', '([a-z0-9_-]+)'\)/g),
    ...all(srcText, /storyArt\(d, '[^']+', '([a-z0-9_-]+)'\)/g),
  ]);
  const iconMissing = [...iconUsed].filter(k => !iconKnown.has(k));
  check(!iconMissing.length, `쓰는 아이콘 ${iconUsed.size}종이 모두 그려진다 (정의 ${iconKnown.size}종)${iconMissing.length ? ' — 없음: ' + iconMissing.join(', ') : ''}`);

  console.log('5. 적 · 카드 참조');
  const { FOES, BOSSES } = await load('src/data/foes.js');
  const { CARDS } = await load('src/data/cards.js');
  const { CHAPTERS } = await load('src/data/chapters.js');
  // 장마다 전투 구성(easy · normal · 정예 · 증원 · 발각 · 보스 곁) + 대본 · 사건의 foes: [...]
  const foesUsed = new Set(), bossMissing = [];
  const collect = v => { if (typeof v === 'string') foesUsed.add(v); else if (Array.isArray(v)) v.forEach(collect); };
  for (const [n, ch] of Object.entries(CHAPTERS)) {
    const E = ch.encounters || {};
    for (const k of ['easy', 'normal', 'reinforce', 'caught']) collect(E[k]);
    for (const e of E.elite || []) collect(e.foes);
    if (E.boss) { collect(E.boss.adds); if (!BOSSES[E.boss.boss]) bossMissing.push(`${n}장 ${E.boss.boss}`); }
  }
  for (const arr of all(dataText, /foes: \[([^\]]*)\]/g)) for (const k of arr.match(/'[a-z0-9_]+'/g) || []) foesUsed.add(k.slice(1, -1));
  const foeMissing = [...foesUsed].filter(k => !FOES[k]);
  check(!foeMissing.length && !bossMissing.length, `전투 구성의 적 ${foesUsed.size}종 · 장마다 보스${foeMissing.length || bossMissing.length ? ' — 없음: ' + [...foeMissing, ...bossMissing].join(', ') : ''}`);
  const cardsUsed = new Set([...all(srcText, /\bcard\('([a-z0-9_]+)'\)/g), ...all(srcText, /addCard\('([a-z0-9_]+)'\)/g)]);
  const cardMissing = [...cardsUsed].filter(k => !CARDS[k]);
  check(!cardMissing.length, `이름으로 넣는 카드 ${cardsUsed.size}종 (${[...cardsUsed].join(' · ')})${cardMissing.length ? ' — 없음: ' + cardMissing.join(', ') : ''}`);

  console.log('6. 카드 설명 — 강화판');
  // 강화로 바뀌는 값을 설명 글이 숫자로 적고 있거나, 소멸이 없어지는데 「한 전투에 한 번(소멸)」이 남아 있으면 강화판 설명이 틀린다 → up.desc 로
  const { cardDef, upgradeNote } = await load('src/data/cards.js');
  const stale = [];
  for (const [id, base] of Object.entries(CARDS)) {
    if (!base.up) continue;
    const up = cardDef({ id, up: true });
    if (base.up.exhaust === false && /\(소멸\)|한 전투에 한 번/.test(up.desc)) stale.push(`${id}+ 설명에 소멸이 남음`);
    for (const [k, v] of Object.entries(base.up)) {
      if (typeof v !== 'number' || typeof base[k] !== 'number' || v === base[k]) continue;
      if (new RegExp(`(^|[^0-9])${base[k]}([^0-9]|$)`).test(up.desc)) stale.push(`${id}+ 설명에 강화 전 숫자 ${base[k]}(${k})`);
    }
    if (/desc/.test(upgradeNote(id))) stale.push(`${id} 강화 미리보기에 desc`);
  }
  const ups = Object.values(CARDS).filter(c => c.up).length;
  check(!stale.length, `강화되는 카드 ${ups}장의 강화판 설명${stale.length ? ' — ' + stale.join(', ') : ''}`);

  console.log(fails.length ? `\n실패 ${fails.length}개` : '\n모두 통과');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('점검 중단:', e); process.exit(1); });
