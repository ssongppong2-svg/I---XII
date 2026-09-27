// 톱니 지도 화면 — 칸을 끝내면 장치가 돌고, 맞물린 톱니 중 하나를 고른다
import { register, go } from '../ui/router.js';
import { RUN, chapterDef, maxHp, restAmbushChance } from '../game/run.js';
import { writeRecur, autosave } from '../game/save.js';
import { choices, enterNode, storyDef, storyOf } from '../game/flow.js';
import { buildMapSVG, makeTurner, linkPoints } from '../map/view.js';
import { NODE_TYPES } from '../data/nodes.js';
import { FOES, BOSSES } from '../data/foes.js';
import { EVENTS } from '../data/events.js';
import { RELICS, IMPLANTS } from '../data/relics.js';
import { icon } from '../ui/icons.js';
import { art } from '../ui/assets.js';
import { SFX } from '../ui/sfx.js';
import { confirmBox, toast, bindTips, hideTip } from '../ui/overlay.js';
import { openDeck, openRelics, openSettings, openHelp, pauseMenu, relicTip, toggleSound } from '../ui/menus.js';
import { roman, sleep, esc, flash } from '../core/util.js';
import { typeInto } from '../ui/typewriter.js';
import { alertGaugeHTML, bagHTML, bindBag } from '../ui/hud.js';

let root = null, svg = null, turner = null, avail = [], focusIdx = -1, busy = false, tickTimer = 0, alive = false;

function mapClock(hour) {
  let s = '<svg class="map-clock" viewBox="0 0 1180 1180" aria-hidden="true"><circle cx="590" cy="590" r="570" stroke-width="3"/><circle cx="590" cy="590" r="500" stroke-width="1.5"/>';
  for (let i = 1; i <= 12; i++) {
    const a = i / 12 * Math.PI * 2 - Math.PI / 2;
    s += `<text x="${590 + Math.cos(a) * 430}" y="${590 + Math.sin(a) * 430}">${roman(i)}</text>`;
  }
  const ha = hour / 12 * Math.PI * 2 - Math.PI / 2;
  s += `<line class="hand" x1="590" y1="590" x2="${590 + Math.cos(ha) * 300}" y2="${590 + Math.sin(ha) * 300}" stroke-width="18"/><circle cx="590" cy="590" r="22" fill="#E8D2A0"/></svg>`;
  return s;
}

function topBarHTML() {
  const ch = chapterDef();
  return `<div class="map-top">
    <div class="ch-badge"><div class="ch-num">${ch.hour}</div><div class="ch-txt"><b>${ch.title}</b><span>${ch.sub} · ${ch.place}</span></div></div>
    <div class="map-res" id="mapRes"></div>
    <div class="map-btns">
      <button class="icon-btn btn-save" id="mSave" type="button" title="지금을 재귀 지점으로 새긴다">${icon('hourglass')}저장 <b id="mSaveN"></b></button>
      <button class="icon-btn" id="mDeck" type="button">${icon('deck')}덱 <b id="mDeckN"></b><kbd>D</kbd></button>
      <button class="icon-btn" id="mRelic" type="button">${icon('gem')}유물<kbd>R</kbd></button>
      <button class="icon-btn" id="mMenu" type="button">${icon('menu')}메뉴<kbd>Esc</kbd></button>
    </div></div>`;
}
function resHTML() {
  const mh = maxHp();
  let hearts = '';
  for (let i = 0; i < mh; i++) hearts += `<svg class="heart${i < RUN.hp ? '' : ' empty'}"><use href="#i-heart"/></svg>`;
  return `<span class="hearts" title="HP ${RUN.hp} / ${mh}">${hearts}</span><span class="sep"></span>
    <span class="res parts" title="부품 — 상점에서 쓴다">${icon('parts')}${RUN.parts}<small>부품</small></span>
    <span class="res shard" title="톱니 조각 — 강화소 · 기계 이식소에서 쓴다">${icon('shard')}${RUN.shards}<small>톱니 조각</small></span><span class="sep"></span>
    ${bagHTML()}<span class="sep"></span>
    ${alertGaugeHTML()}`;
}
function relicStripHTML() {
  return RUN.relics.map(id => `<span class="relic r-${RELICS[id].rarity}" data-tip="relic:${id}">${icon(RELICS[id].icon)}</span>`).join('')
    + RUN.implants.map(id => `<span class="relic r-implant implant" data-tip="implant:${id}">${icon(IMPLANTS[id].icon)}</span>`).join('');
}
// 범례 — 이 지도에 실제로 있는 칸 종류만
function legendHTML() {
  const keys = ['story', 'battle', 'elite', 'rest', 'shop', 'blackmarket', 'forge', 'implant', 'abyss', 'trial', 'ambush', 'alley', 'tent', 'event', 'shrine', 'boss'];
  const has = new Set(Object.values(RUN.map.nodes).map(n => n.type));
  const watched = !chapterDef().hunted && Object.values(RUN.map.nodes).some(n => n.watched);
  return keys.filter(k => has.has(k)).map(k => `<span style="--tone:${NODE_TYPES[k].tone}">${icon(NODE_TYPES[k].icon)}${NODE_TYPES[k].label}</span>`).join('') + (watched ? `<span class="watch-l">${icon('eye')}감시 톱니</span>` : '');
}
// 톱니 이름표 — 이야기 칸은 대본 제목, 보스는 보스 이름, 시작은 이 장의 출발지
function labelOf(n) {
  const ch = chapterDef();
  if (n.type === 'story') { const d = storyDef(n); return d ? d.title : NODE_TYPES.story.label; }
  if (n.type === 'boss') return BOSSES[ch.encounters.boss.boss].name;
  if (n.type === 'start' && ch.start) return ch.start.label;
  return (NODE_TYPES[n.type] || NODE_TYPES.battle).label;
}
function noOf(n) {
  if (n.type === 'story') { const d = storyDef(n); return d ? d.no : ''; }
  if (n.type === 'boss') { const b = storyOf(RUN.chapter)[chapterDef().encounters.boss.story]; return (b && b.no) || ''; }
  return '';
}
const KIND_TEXT = {
  battle: '대화 → 전투. 전투를 시작하기 직전에 재귀 지점이 저절로 새겨진다(저장 횟수를 쓰지 않는다).',
  talk: '대화. 선택이 있으면 고른 것에 따라 얻는 것과 뒷이야기가 달라진다.',
  safe: '숨은 곳 — 들어가면 먼저 회복한다(습격 없음). 그다음 대화.',
  shop: '대화 · 상점. 사는 것은 고르기 나름이다.',
  rest: '휴식 · 확률 사건. 회복한 뒤 습격을 판정한다(이 칸에서 한 번).',
};
function goalHTML() {
  return RUN.goal ? `${icon('compass')}<small>${RUN.flags.goalSeen === RUN.goal ? '목표' : '새 목표'}</small><span>${esc(RUN.goal)}</span>` : '';
}
// 목표가 바뀐 뒤 처음 보는 지도 — 목표 띠를 한 번 빛내고 「새 목표」로 알린다 (본 목표는 적어 두어 다시 빛나지 않게)
function markGoal() {
  if (!RUN.goal || RUN.flags.goalSeen === RUN.goal) return;
  const g = root.querySelector('#mapGoal');
  g.classList.add('new');
  RUN.flags.goalSeen = RUN.goal;
  setTimeout(() => { if (alive) SFX.tick(); }, 350);
}

function refreshHud() {
  if (!root) return;
  root.querySelector('#mapRes').innerHTML = resHTML();
  root.querySelector('#mapGoal').innerHTML = goalHTML();
  bindBag(root.querySelector('#mapRes'), () => { refreshHud(); autosave(); });
  root.querySelector('#mSaveN').textContent = `${RUN.saves.left}/${RUN.saves.max}`;
  root.querySelector('#mSave').classList.toggle('spent', RUN.saves.left <= 0);
  root.querySelector('#mDeckN').textContent = RUN.deck.length;
  root.querySelector('#relicStrip').innerHTML = relicStripHTML();
}

// 톱니 상태: 지나온 길 · 지금 · 고를 수 있는 곳 · 앞으로 갈 수 있는 곳 · 못 가는 곳
function paint(showAvail) {
  const map = RUN.map;
  const visited = new Set(RUN.visited);
  const reach = new Set();
  const stack = [...avail];
  while (stack.length) { const id = stack.pop(); if (reach.has(id)) continue; reach.add(id); stack.push(...map.nodes[id].next); }
  const trail = new Set();
  for (let i = 1; i < RUN.visited.length; i++) trail.add(`${RUN.visited[i - 1]}>${RUN.visited[i]}`);
  for (const g of svg.querySelectorAll('.gn')) {
    const id = g.dataset.id;
    g.classList.toggle('done', visited.has(id));
    g.classList.toggle('cur', id === RUN.pos);
    g.classList.toggle('avail', showAvail && avail.includes(id));
    g.classList.toggle('far', !visited.has(id) && reach.has(id) && !(showAvail && avail.includes(id)));
    g.classList.toggle('gone', !visited.has(id) && !reach.has(id) && id !== RUN.pos);
  }
  // 축: 고를 수 있는 길(빛이 흐름) · 지나온 길 · 앞으로 갈 수 있는 길 · 못 가는 길(흐리게)
  const lit = new Set(showAvail ? avail.map(a => `${RUN.pos}>${a}`) : []);
  svg.querySelectorAll('.lk').forEach(el => {
    const k = `${el.dataset.from}>${el.dataset.to}`;
    el.classList.toggle('lit', lit.has(k));
    el.classList.toggle('trail', trail.has(k));
    el.classList.toggle('dim', !lit.has(k) && !trail.has(k) && !(reach.has(el.dataset.to) && (reach.has(el.dataset.from) || el.dataset.from === RUN.pos)));
  });
}

function placeMarker(x, y) {
  const m = root.querySelector('.map-hero');
  m.style.left = x + 'px'; m.style.top = y + 'px';
}
function markerAtNode(id) {
  const n = RUN.map.nodes[id];
  placeMarker(n.x, n.y - n.r * 0.35);
}

function infoHTML(id) {
  const n = RUN.map.nodes[id];
  const T = NODE_TYPES[n.type];
  const ch = chapterDef();
  const state = avail.includes(id) ? '<em class="go">갈 수 있음</em>' : RUN.visited.includes(id) ? '<em>지나옴</em>' : '';
  // 이야기 칸 · 보스 — 대본 번호 · 제목 · 무엇을 하는 칸인지
  if (n.type === 'story' || n.type === 'boss') {
    const d = n.type === 'story' ? storyDef(n) : null;
    const no = noOf(n);
    const head = `<div class="mi-head" style="--tone:${T.tone}">${no ? `<span class="mi-no">${no}</span>` : icon(T.icon)}<b>${esc(labelOf(n))}</b>${state}</div>`;
    if (d) {
      const foes = d.enc ? `<p class="mi-foes">적: ${d.enc.foes.map(t => FOES[t].name).join(' · ')}</p>` : '';
      const kind = d.kind === 'rest' ? `${KIND_TEXT.rest} 지금 습격 확률 ${Math.round(restAmbushChance() * 100)}%.` : d.safeRest ? KIND_TEXT.safe : KIND_TEXT[d.kind] || '';
      return { head, body: `<p>${esc(d.teaser || '')}</p>${d.kind === 'rest' ? '' : foes}<p class="mi-kind">${kind}</p>` };
    }
    const bd = BOSSES[ch.encounters.boss.boss];
    return { head, body: `<p>${esc(bd.sub || T.desc)}</p><p class="mi-foes">${bd.name} · ${ch.encounters.boss.adds.map(t => FOES[t].name).join(' · ')}</p><p class="mi-kind">16 출입 심사 → 17 보스전. 들어가는 순간 재귀 지점이 저절로 새겨진다. 앞 대화는 처음 한 번만 — 쓰러지면 전투부터 다시.</p>` };
  }
  if (n.type === 'start' && ch.start) return { head: `<div class="mi-head" style="--tone:${T.tone}">${icon(T.icon)}<b>${esc(ch.start.label)}</b>${state}</div>`, body: `<p>${esc(ch.start.desc)}</p>` };
  let extra = '';
  if (n.type === 'boss') extra = `<p class="mi-foes">${BOSSES[ch.encounters.boss.boss].name} · ${ch.encounters.boss.adds.map(t => FOES[t].name).join(' · ')}</p>`;
  else if (n.type === 'elite' && ch.encounters.elite.length) { const e = ch.encounters.elite[(n.eliteIdx || 0) % ch.encounters.elite.length]; extra = `<p class="mi-foes">${e.foes.map(t => FOES[t].name).join(' · ')}</p>`; }
  else if (n.enc && n.enc.foes) extra = `<p class="mi-foes">적: ${n.enc.foes.map(t => FOES[t].name).join(' · ')}${RUN.alert >= 50 ? ' + 증원 1' : ''}</p>`;
  if (n.type === 'event' && n.event) extra = `<p class="mi-foes">「${EVENTS[n.event].title}」</p>`;
  const watch = n.watched && !ch.hunted ? `<p class="mi-watch">${icon('eye').replace('<svg', '<svg style="width:14px;height:14px;fill:#FF9C8C;display:inline-block;vertical-align:-2px"')} 감시 톱니 — 들어가면 경계도 +20</p>` : '';
  return { head: `<div class="mi-head" style="--tone:${T.tone}">${icon(T.icon)}<b>${T.label}</b>${state}</div>`, body: `<p>${T.desc}</p>${extra}${watch}` };
}
// 칸 설명 — 이름은 바로, 설명은 타자로 (같은 칸에 다시 올리면 그대로 둔다)
function showInfo(id) {
  const box = root.querySelector('#mapInfo');
  if (!id) { box.classList.add('empty'); box.dataset.id = ''; return; }
  box.classList.remove('empty');
  if (box.dataset.id === id) return;
  box.dataset.id = id;
  const { head, body } = infoHTML(id);
  box.innerHTML = `${head}<div class="mi-body"></div>`;
  typeInto(box.querySelector('.mi-body'), body, { mul: 0.3 });
}
// 고르려는 톱니로 가는 축을 밝게
function hotChain(id) {
  svg.querySelectorAll('.lk.hot').forEach(e => e.classList.remove('hot'));
  if (!id) return;
  svg.querySelectorAll(`.lk[data-from="${RUN.pos}"][data-to="${id}"]`).forEach(e => e.classList.add('hot'));
}
function setFocus(i) {
  focusIdx = i;
  svg.querySelectorAll('.gn.focus').forEach(e => e.classList.remove('focus'));
  const id = avail[i];
  if (id) { svg.querySelector(`.gn[data-id="${id}"]`).classList.add('focus'); showInfo(id); hotChain(id); }
}

async function mount(holder, params = {}) {
  root = holder;
  alive = true;
  busy = true;
  const ch = chapterDef();
  const map = RUN.map;
  holder.innerHTML = `${mapClock(RUN.chapter)}${ch.hunted ? '' : '<div class="map-search"></div>'}
    ${buildMapSVG(map, { hour: ch.hour, label: labelOf, no: noOf })}
    <div class="map-hero idle">${art('hero-sd') ? `<img src="${art('hero-sd')}" alt="" draggable="false">` : '<i class="pin"></i>'}</div>
    ${topBarHTML()}
    <div class="relic-strip" id="relicStrip"></div>
    <div class="map-goal" id="mapGoal"></div>
    <div class="map-legend">${legendHTML()}</div>
    <div class="map-hint" id="mapHint">톱니가 돌아가는 중…</div>
    <div class="map-info empty" id="mapInfo"></div>`;
  svg = holder.querySelector('svg.mech');
  turner = makeTurner(svg, map);
  refreshHud();
  markGoal();
  markerAtNode(RUN.pos);
  avail = choices();
  paint(false);
  bindMapInput();
  // 발각 — 경계도 100
  if (RUN.alert >= 100) {
    await banner('발각', '감시망에 걸렸다 — 감시대가 몰려온다', true);
    if (!alive) return;
    go('battle', { caught: true });
    return;
  }
  if (params.intro) await banner(ch.hour, `${ch.title} · ${ch.sub}`);
  if (!alive) return;
  // 칸을 끝낼 때마다 장치 전체가 돈다
  SFX.gears();
  await turner.turn(params.intro ? 90 : 56, params.intro ? 2000 : 1300);
  if (!alive) return;
  paint(true);
  svg.querySelectorAll('.gn.avail').forEach(e => flash(e, 'pulse', 520));
  const hint = root.querySelector('#mapHint');
  hint.textContent = avail.length ? (RUN.flags.shortcut ? '지름길 — 두 칸 앞의 톱니로 곧장 갈 수 있어요' : '빛나는 톱니 중 하나를 고르세요') : '갈 수 있는 톱니가 없어요';
  hint.classList.toggle('warn', RUN.flags.shortcut);
  busy = false;
  autosave();
  // 가만히 있으면 째깍째깍
  tickTimer = setInterval(() => { if (!busy && alive && document.visibilityState === 'visible') turner.turn(2.2, 180); }, 2000);
}

async function banner(big, small, alarm = false) {
  const b = document.createElement('div');
  b.className = 'map-banner' + (alarm ? ' alarm' : '');
  b.innerHTML = `<div><b>${esc(big)}</b><span>${esc(small)}</span>${alarm ? '' : `<small>${esc(RUN.name || '???')} · 난이도 ${roman(RUN.diff)} · 재귀 저장 ${RUN.saves.left}번</small>`}</div>`;
  root.appendChild(b);
  if (alarm) SFX.alarm(); else SFX.chime();
  await sleep(2300);
  b.remove();
}

function bindMapInput() {
  svg.addEventListener('click', e => {
    const g = e.target.closest('.gn');
    if (!g || busy) return;
    if (avail.includes(g.dataset.id)) choose(g.dataset.id);
    else { SFX.deny(); toast(RUN.visited.includes(g.dataset.id) ? '이미 지나온 톱니예요' : '지금 톱니와 맞물린 톱니만 고를 수 있어요'); }
  });
  svg.addEventListener('pointerover', e => {
    const g = e.target.closest('.gn');
    if (!g) return;
    showInfo(g.dataset.id);
    if (avail.includes(g.dataset.id) && !busy) { hotChain(g.dataset.id); SFX.hover(); }
  });
  svg.addEventListener('pointerout', e => {
    const g = e.target.closest('.gn');
    if (g && !g.contains(e.relatedTarget)) { hotChain(focusIdx >= 0 ? avail[focusIdx] : null); if (focusIdx < 0) showInfo(null); }
  });
  root.querySelector('#mSave').addEventListener('click', manualSave);
  root.querySelector('#mDeck').addEventListener('click', () => { SFX.click(); openDeck(RUN.deck); });
  root.querySelector('#mRelic').addEventListener('click', () => { SFX.click(); openRelics(RUN.relics, RUN.implants); });
  root.querySelector('#relicStrip').addEventListener('click', () => { SFX.click(); openRelics(RUN.relics, RUN.implants); });
  root.querySelector('#mMenu').addEventListener('click', menu);
  bindTips(root.querySelector('#relicStrip'), t => relicTip(t.dataset.tip));
}

async function manualSave() {
  if (busy) return;
  SFX.click();
  if (RUN.saves.left <= 0) { toast('이번 챕터의 재귀 저장을 모두 썼어요'); SFX.deny(); return; }
  const ok = await confirmBox({ title: '지금을 재귀 지점으로 새길까요?',
    text: `쓰러지면 바로 이 순간으로 돌아와요. 이번 챕터에 남은 저장 ${RUN.saves.left}번 → ${RUN.saves.left - 1}번.`,
    buttons: [{ label: '새긴다', value: true, main: true }, { label: '취소', value: false }] });
  if (!ok || !alive) return;
  writeRecur({ manual: true });
  SFX.save();
  refreshHud();
  flash(root.querySelector('#mSave'), 'glow', 1200);
  toast(`재귀 지점을 새겼어요 · 남은 저장 ${RUN.saves.left}번`, 'gold');
}

async function menu() {
  SFX.click();
  const v = await pauseMenu();
  if (v === 'settings') openSettings();
  if (v === 'help') openHelp();
  if (v === 'title') { autosave(); go('title'); }
}

async function choose(id) {
  if (busy || !avail.includes(id)) return;
  busy = true;
  hideTip();
  SFX.click();
  const from = RUN.pos;
  paint(false);
  svg.querySelector(`.gn[data-id="${id}"]`).classList.add('avail', 'focus');
  // 표식이 축을 따라 건너간다 (지름길이면 두 칸 앞까지 곧장)
  const pts = linkPoints(RUN.map, from, id, RUN.map.nodes[from].next.includes(id) ? 3 : 5);
  const m = root.querySelector('.map-hero');
  m.classList.remove('idle');
  turner.turn(18 * pts.length, 140 * pts.length);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    m.animate([{ translate: '0 0' }, { translate: '0 -22px' }, { translate: '0 0' }], { duration: 150 });
    placeMarker(p.x, p.y - (i === pts.length - 1 ? p.r * 0.35 : p.r * 0.6));
    SFX.tock();
    await sleep(140);
  }
  await sleep(220);
  if (!alive) return;
  enterNode(id);
}

function onKey(e) {
  if (busy) return false;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!avail.length) return true;
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const sorted = avail.slice().sort((a, b) => RUN.map.nodes[a].y - RUN.map.nodes[b].y);
    avail = sorted;
    setFocus(focusIdx < 0 ? 0 : (focusIdx + d + avail.length) % avail.length);
    SFX.hover();
    return true;
  }
  if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); if (focusIdx >= 0) choose(avail[focusIdx]); else if (avail.length === 1) choose(avail[0]); return true; }
  if (e.code === 'KeyD') { SFX.click(); openDeck(RUN.deck); return true; }
  if (e.code === 'KeyR') { SFX.click(); openRelics(RUN.relics, RUN.implants); return true; }
  if (e.code === 'KeyH') { openHelp(); return true; }
  if (e.code === 'KeyM') { toggleSound(); return true; }
  if (e.key === 'Escape') { menu(); return true; }
  return false;
}

function unmount() {
  alive = false;
  clearInterval(tickTimer);
  if (turner) turner.stop();
  hideTip();
  root = null; svg = null; turner = null; focusIdx = -1;
}

register('map', { mount, unmount, onKey });
export const mapDebug = () => ({ avail, busy });
