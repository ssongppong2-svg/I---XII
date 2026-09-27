// 설정 · 덱 보기 · 유물 · 규칙 · 일시정지 메뉴
import { SET, setSetting } from '../core/settings.js';
import { openSheet, closeSheet, confirmBox } from './overlay.js';
import { SFX, initAudio } from './sfx.js';
import { icon } from './icons.js';
import { esc } from '../core/util.js';
import { cardDef, KINDS, extraLine, upgradeNote, CARDS } from '../data/cards.js';
import { RELICS, IMPLANTS } from '../data/relics.js';
import { cardStatHTML, cardTagsHTML, miniRangeHTML } from '../battle/view.js';
import { art, loadAll, FACES } from './assets.js';
import { FOES, BOSSES } from '../data/foes.js';
import { NODE_TYPES } from '../data/nodes.js';
import { EVENTS } from '../data/events.js';

// ── 설정
const OPT = [
  { k: 'sound', label: '소리', type: 'toggle' },
  { k: 'volume', label: '음량', type: 'range' },
  { k: 'textSpeed', label: '대사 글자 속도', type: 'seg', opts: [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '바로']] },
  { k: 'autoSpeed', label: '자동 넘김 빠르기', type: 'seg', opts: [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게']] },
  { k: 'shake', label: '화면 흔들림', type: 'toggle', sub: '폭발 · 피격 때 판이 흔들린다' },
  { k: 'tutorial', label: '튜토리얼 안내', type: 'toggle', sub: '1장 첫 전투의 단계별 안내' },
];
export function openSettings() {
  const render = () => OPT.map(o => {
    if (o.type === 'toggle') return `<label class="cfg-row sw-row"><span>${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}</span><input type="checkbox" data-k="${o.k}"${SET[o.k] ? ' checked' : ''}><i class="sw" aria-hidden="true"></i></label>`;
    if (o.type === 'range') return `<div class="cfg-row"><span>${o.label}</span><input class="range" type="range" min="0" max="100" step="5" data-k="${o.k}" value="${Math.round(SET[o.k] * 100)}"></div>`;
    return `<div class="cfg-row"><span>${o.label}</span><div class="seg">${o.opts.map(([v, l]) => `<button type="button" data-k="${o.k}" data-v="${v}" class="${SET[o.k] === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
  }).join('') + '<p class="dim" style="margin-top:14px">설정은 이 브라우저에 저장돼요.</p>';
  const body = openSheet({ title: '설정', body: render() });
  body.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('input[type=checkbox][data-k]')) { setSetting(t.dataset.k, t.checked); if (t.dataset.k === 'sound' && t.checked) { initAudio(); SFX.click(); } }
    if (t.matches('input[type=range][data-k]')) { setSetting(t.dataset.k, +t.value / 100); SFX.click(); }
  });
  body.addEventListener('input', e => { const t = e.target; if (t.matches('input[type=range][data-k]')) setSetting(t.dataset.k, +t.value / 100); });
  body.addEventListener('click', e => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    setSetting(b.dataset.k, b.dataset.v);
    SFX.click();
    body.innerHTML = render();
  });
}
export function toggleSound() {
  initAudio();
  setSetting('sound', !SET.sound);
  if (SET.sound) SFX.click();
  return SET.sound;
}

// ── 카드 (큰 카드 한 장)
export function bigCardHTML(inst, { pick = false, price = '', extra = '', mid = false, showUp = false } = {}) {
  const def = typeof inst === 'string' ? CARDS[inst] : cardDef(inst);
  const kind = KINDS[def.kind];
  const up = def.upgraded;
  const more = extraLine(def);
  return `<div class="card big${mid ? ' mid' : ''} k-${def.kind} r-${def.rarity}${up ? ' up' : ''}${pick ? ' pick' : ''}" ${extra}>
    <span class="c-top"><span class="c-cost">1</span><span class="c-kind">${icon(kind.icon)}${kind.label}</span></span>
    <span class="c-name">${def.name}</span>
    <span class="c-mid">${miniRangeHTML(def)}<span class="c-stat">${cardStatHTML(def, false)}</span></span>
    <p class="c-text">${def.desc}${more ? `<span class="c-eff">${more}</span>` : ''}</p>
    <span class="c-tags">${cardTagsHTML(def, def.id, false)}</span>${showUp ? `<span class="c-up">${icon('up')}${upgradeNote(def.id)}</span>` : ''}${price}</div>`;
}

// ── 덱 보기
const KIND_ORDER = ['melee', 'shot', 'far', 'jam', 'guard', 'cool', 'move', 'cult', 'curse'];
export function openDeck(deck, { title = '덱', sub = '' } = {}) {
  const sorted = deck.slice().sort((a, b) => KIND_ORDER.indexOf(CARDS[a.id].kind) - KIND_ORDER.indexOf(CARDS[b.id].kind) || a.id.localeCompare(b.id) || (b.up - a.up));
  openSheet({ title, sub: sub || `${deck.length}장`, wide: true, body: `<div class="deck-grid">${sorted.map(c => bigCardHTML(c)).join('')}</div>` });
}

// ── 유물 목록
export function relicTip(key) {
  const [kind, id] = key.split(':');
  const R = kind === 'implant' ? IMPLANTS[id] : RELICS[id];
  if (!R) return '';
  const tag = kind === 'implant' ? '기계 이식' : { common: '일반 유물', rare: '희귀 유물', boss: '보스 유물', dark: '암시장 유물' }[R.rarity] || '유물';
  return `<b>${esc(R.name)}</b>${esc(R.desc)}<span class="t-sub">${tag}</span>`;
}
export function openRelics(relics, implants) {
  const row = (R, id, cls) => `<div class="relic-row"><span class="relic big ${cls}">${icon(R.icon)}</span><div><b>${R.name}</b><p>${R.desc}</p></div></div>`;
  const body = `${relics.length ? '' : '<p class="dim">아직 유물이 없어요.</p>'}<div class="relic-list">${relics.map(id => row(RELICS[id], id, 'r-' + RELICS[id].rarity)).join('')}</div>
    ${implants.length ? `<h4 style="margin-top:22px">기계 이식</h4><div class="relic-list">${implants.map(id => row(IMPLANTS[id], id, 'r-implant implant')).join('')}</div>` : ''}`;
  openSheet({ title: '유물', sub: `유물 ${relics.length} · 이식 ${implants.length}`, body });
}

// ── 규칙과 조작
export function openHelp() {
  openSheet({ title: '규칙과 조작', wide: true, body: `
  <section><h4>톱니 지도</h4><p>챕터 하나가 커다란 톱니 장치예요. 칸(톱니)을 끝내면 장치가 돌고, <b>지금 톱니와 축으로 이어진 톱니</b>가 빛나요(축에 빛이 흘러요) — 그중 하나를 골라 나아가요. 톱니가 전부 보이니 보스까지 길을 미리 짤 수 있어요.</p>
    <p><b>경계도</b>: 눈 표시가 붙은 감시 톱니에 들어가면 +20, 쉬면 +10. 높을수록 휴식 중 기습이 잦아지고, 50을 넘으면 전투에 적이 한 명 더 나와요. 100이 되면 발각 — 곧바로 강한 전투가 벌어져요.</p>
    <p><b>재귀(저장)</b>: 지도 오른쪽 위 「저장」으로 지금을 재귀 지점으로 새겨요. 챕터마다 횟수가 정해져 있고(난이도마다 다름), 챕터를 시작할 때 자동으로 한 번 새겨져요. 전투에서 쓰러지면 마지막 재귀 지점으로 돌아가요 — 덱 · 유물 · HP · 지도 모두 그때로.</p></section>
  <section><h4>전투 — 한 루프의 흐름</h4><ol>
    <li>루프 시작 — 코스트 4 충전, 손패 3장까지 보충, <b>빨간 기습 줄</b>(보스전은 턴 공격 패턴도) 예고</li>
    <li>행동할 때마다(이동 · 카드 · 뽑기 = 1코스트) — 순번이 된 <b>적</b>이 예고대로 이동 또는 공격하고, 다음 행동을 새로 예고</li>
    <li><b>2번째 행동이 끝나는 순간</b> 기습 폭발 → (보스전) <b>주황 턴 공격 범위</b> 공개</li>
    <li>(보스전) <b>마지막 행동이 끝나는 순간</b> 턴 공격 → 다음 루프</li></ol>
    <p>적은 <b>2코스트마다</b> 움직여요. 머리 위 숫자 1 = 내 다음 행동 뒤. 분홍 표식 칸 밖에서 행동을 끝내면 맞지 않아요.</p>
    <p><b>과부하</b>: 강한 카드 · 못총이 과부하를 채워요. 100이면 4코스트 동안 마비. 보스를 과부하시키면 4코스트 동안 기습 · 턴 공격이 멈춰요.</p>
    <p><b>HP</b>는 전투가 끝나도 이어져요. 휴식 · 천막 · 일부 카드와 유물로 회복해요.</p></section>
  <section><h4>조작</h4><p><b>이동</b> WASD · 방향키 · 옆 칸 클릭 · <b>카드</b> 1–6 또는 클릭(방향이 여럿이면 칸을 눌러 조준) · <b>뽑기</b> Q · <b>취소</b> Esc · <b>규칙</b> H · <b>소리</b> M · <b>대사</b> Space/클릭 · <b>대사 기록</b> L · <b>자동</b> A</p>
    <p><b>지도</b>: 빛나는 톱니 클릭(또는 ←→로 고르고 Enter) · <b>덱</b> D · <b>유물</b> R · <b>메뉴</b> Esc</p></section>
  <section><h4>이미지 슬롯</h4><p class="dim"><code>assets/</code> 폴더에 이 이름(webp · png · jpg)으로 넣으면 자동으로 써요. 없는 슬롯은 기본 그림이 나와요.</p><div class="slot-grid" id="slotGrid"><p class="dim">확인하는 중…</p></div></section>` });
  const slots = imageSlots();
  loadAll(slots.map(x => x[0])).then(() => {
    const g = document.getElementById('slotGrid');
    if (!g) return;
    const have = slots.filter(([k]) => art(k)).length;
    g.innerHTML = slots.map(([k, label]) => `<span class="slot${art(k) ? ' ok' : ''}">${art(k) ? '●' : '○'} <code>${k}</code><small>${esc(label)}</small></span>`).join('') + `<p class="dim slot-sum">${have} / ${slots.length} 슬롯에 그림이 있어요</p>`;
  });
}
// 게임이 찾는 그림 이름 전부 — [파일 이름, 설명]
function imageSlots() {
  return [
    ['hero-sd', '주인공 · 격자 SD'],
    ...Object.values(FACES).map(f => [f.file, `주인공 표정 · ${f.label}`]),
    ['shopkeeper', '상점 주인'], ['shopkeeper-hmph', '상점 주인 · 흥.'], ['blackmarket', '암시장 상인'], ['believer', '미지의 신도'],
    ...Object.values(BOSSES).flatMap(b => [[b.art, `${b.name} · 보스 줄 띠`], [b.artFull, `${b.name} · 전신`]]),
    ...Object.values(FOES).flatMap(f => [[f.art + '-sd', `${f.name} · 격자 SD`], [f.art, `${f.name} · 스탠딩`]]),
    ['card-bg', '카드 배경'], ['ui-plank', '나무판 (넓은 것)'], ['ui-plank-thin', '나무판 (가는 것)'],
    ['bg-title', '배경 · 타이틀'], ['bg-battle', '배경 · 전투'], ['bg-rest-1', '배경 · 휴식 1'], ['bg-rest-2', '배경 · 휴식 2'],
    ['bg-shop', '배경 · 상점'], ['bg-alley', '배경 · 골목'], ['bg-event', '배경 · 사건'],
    ...['blackmarket', 'forge', 'implant', 'abyss', 'trial', 'tent', 'shrine'].map(t => [`bg-${t}`, `배경 · ${NODE_TYPES[t].label}`]),
    // 사건 — 등장인물 스탠딩(대본의 cast.art) · 사건마다 배경(없으면 bg-event)
    ...[...new Map(Object.values(EVENTS).flatMap(e => Object.values(e.cast || {})).filter(c => c.art).map(c => [c.art, `사건 인물 · ${c.name}`])).entries()],
    ...Object.entries(EVENTS).map(([id, e]) => [`bg-ev-${id}`, `배경 · 사건 「${e.title}」`]),
  ];
}

// ── 일시정지 메뉴 (Esc)
export async function pauseMenu({ canSave = false } = {}) {
  return confirmBox({ title: '메뉴', text: '', buttons: [
    { label: '계속', value: 'resume', main: true },
    { label: '설정', value: 'settings' },
    { label: '규칙과 조작', value: 'help' },
    { label: '타이틀로', value: 'title' },
  ] });
}
export { closeSheet };
export const heroImg = () => art('hero');
