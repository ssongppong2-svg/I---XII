// 톱니 칸 화면 — 휴식 · 상점 · 암시장 · 강화소 · 기계 이식소 · 심연 · 시험 · 골목 · 천막 · 사건 · 유물 제단
import { register, go } from '../ui/router.js';
import {
  RUN, chapterDef, dm, mods, maxHp, fixHp, gainParts, gainShards, heal, hurt, addAlert, addCard, removeCard, upgradeCard, addRelic, addImplant,
  alertStage, alertStageUp, restAmbushChance, bag, addItem,
} from '../game/run.js';
import { markEventSeen } from '../game/profile.js';
import { playScene, sceneNote, fmt } from '../scenes/scene.js';
import { autosave, writeRecur } from '../game/save.js';
import { finishNode, encounterFor, cardChoices, relicChoice, TRIALS, storyDef, storyOf, sceneOpts } from '../game/flow.js';
import { NODE_TYPES } from '../data/nodes.js';
import { CARDS, cardDef, canUpgrade } from '../data/cards.js';
import { RELICS, IMPLANTS, RELIC_POOL } from '../data/relics.js';
import { EVENTS } from '../data/events.js';
import { ITEMS } from '../data/items.js';
import { LORE } from '../data/lore.js';
import { FOES, BOSSES } from '../data/foes.js';
import { makeRng, hashSeed } from '../core/rng.js';
import { canShortcut } from '../map/gen.js';
import { icon } from '../ui/icons.js';
import { art, load, loadAll, bgImgHTML } from '../ui/assets.js';
import { bigCardHTML, openDeck, relicTip, openSettings, openHelp, pauseMenu, toggleSound } from '../ui/menus.js';
import { openSheet, closeSheet, confirmBox, toast, bindTips, hideTip } from '../ui/overlay.js';
import { SFX } from '../ui/sfx.js';
import { esc, eulreul } from '../core/util.js';
import { typeInto, typeSequence, finishTyping } from '../ui/typewriter.js';
import { alertGaugeHTML, bagHTML, bindBag } from '../ui/hud.js';
import { storyArtKeys } from '../ui/foeart.js';

let root = null, node = null, R = null, alive = false, seq = null;
const TYPE = { mul: 0.55, sound: 'soft' };   // 칸 화면 글은 대사보다 조금 빠르게, 작은 타자 소리
let shownAlert = null, alertWhy = '';   // HUD에 마지막으로 보여 준 경계도 — 바뀌면 게이지 옆에 +/− 를 띄운다
const q = s => root.querySelector(s);

/* ── 공통 틀 ── */
// 칸 배경 그림 — bg-<칸 종류>. 휴식은 두 장(bg-rest-1 · 2)을 칸마다 번갈아, 골목은 네 가지 모두 bg-alley
const NARROW = ['rest', 'alley', 'event', 'tent', 'abyss', 'trial', 'story'];   // 배경이 있을 때 글 판을 좁게(장면이 보이게)
function bgKeyOf(n) {
  if (n.type === 'event' && n.event && art(`bg-ev-${n.event}`)) return `bg-ev-${n.event}`;   // 사건마다 따로 넣은 배경이 있으면
  // 이야기 칸 — 전용 배경(bg-st-<칸>)이 있으면 그것, 없으면 대본이 말한 기존 배경
  if (n.type === 'story') { const slot = `bg-st-${n.story}`; return art(slot) ? slot : (storyOf(RUN.chapter).bgs || {})[n.story] || 'bg-event'; }
  if (n.type === 'rest') {
    const k = `bg-rest-${1 + hashSeed(RUN.seed, n.id, 'bg') % 2}`;
    return art(k) ? k : 'bg-rest-1';
  }
  return `bg-${n.type}`;
}
// onLeave = 떠날 때 할 일(없으면 바로 지도로) · narrow = 글 판을 좁게(없으면 칸 종류대로)
function frame({ title, text = '', say = '', artHTML = '', leave: leaveText = '떠난다', onLeave = null, narrow = null }) {
  const T = NODE_TYPES[node.type];
  const bgKey = bgKeyOf(node);
  const bg = bgImgHTML(bgKey);
  const sd = node.type === 'story' ? storyDef(node) : null;
  const wide = narrow === null ? NARROW.includes(node.type) : narrow;
  root.innerHTML = `<div class="nd t-${node.type}${bg ? ' has-bg' : ''}${wide ? ' narrow' : ''}" style="--tone:${T.tone}">
    <div class="nd-bg" aria-hidden="true">${bg}</div>
    <div class="nd-art">${artHTML}</div>
    <div class="nd-panel">
      <div class="nd-kicker">${icon(sd ? sd.icon : T.icon)}${sd ? `${T.label} <b class="nd-no">${sd.no}</b>` : T.label}${node.watched && !chapterDef().hunted ? ` <em>${icon('eye')}감시 톱니</em>` : ''}</div>
      <h2 class="nd-title">${title}</h2>
      ${say ? '<div class="nd-say" id="ndSay"></div>' : ''}
      <p class="nd-text" id="ndText"></p>
      <div class="nd-body" id="ndBody"></div>
      <div class="nd-foot"><button class="btn-sub" type="button" id="ndLeave">${leaveText}</button></div>
    </div>
    <div class="nd-hud" id="ndHud"></div>
  </div>`;
  q('#ndLeave').addEventListener('click', () => { SFX.click(); (onLeave || leave)(); });
  // 아직 확인 안 한 배경(처음 들어가는 칸 종류)은 찾아보고, 있으면 살며시 깐다
  if (!bg) {
    const here = node;
    load(bgKey).then(u => {
      if (!u || !alive || node !== here || !root) return;
      q('.nd-bg').innerHTML = bgImgHTML(bgKey, 'fade');
      q('.nd').classList.add('has-bg');
    });
  }
  // 상인 말 → 설명 순서로 타자. 글을 누르면 바로 다 보인다
  seq = typeSequence([[q('#ndSay'), say], [q('#ndText'), text]], TYPE);
  q('.nd-panel').addEventListener('click', e => { if (!e.target.closest('button')) finishAll(); });
  hud();
}
function finishAll() {
  if (seq) seq.finish();
  root.querySelectorAll('.tw-typing').forEach(finishTyping);
}
// 아래로 더 있으면 끝을 흐리게 — 스크롤할 수 있다는 표시
function moreBelow(b) { b.classList.toggle('more', b.scrollHeight - b.scrollTop - b.clientHeight > 4); }
function hud() {
  if (!root || !q('#ndHud')) return;
  const mh = maxHp();
  let hearts = '';
  for (let i = 0; i < mh; i++) hearts += `<svg class="heart${i < RUN.hp ? '' : ' empty'}"><use href="#i-heart"/></svg>`;
  q('#ndHud').innerHTML = `<span class="hearts">${hearts}</span><span class="res parts">${icon('parts')}${RUN.parts}<small>부품</small></span><span class="res shard">${icon('shard')}${RUN.shards}<small>톱니 조각</small></span>${bagHTML()}${alertGaugeHTML()}
    <button class="icon-btn" type="button" id="ndDeck">${icon('deck')}덱 ${RUN.deck.length}</button>`;
  q('#ndDeck').addEventListener('click', () => { SFX.click(); openDeck(RUN.deck); });
  bindBag(q('#ndHud'), () => { hud(); autosave(); });
  if (shownAlert !== null && RUN.alert !== shownAlert) alertPop(RUN.alert - shownAlert, alertWhy);
  shownAlert = RUN.alert; alertWhy = '';
}
function alertPop(n, why) {
  const g = q('#ndHud .alert-g');
  if (!g) return;
  const p = document.createElement('em');
  p.className = 'alert-pop' + (n < 0 ? ' down' : '');
  p.innerHTML = `${n > 0 ? '+' : '−'}${Math.abs(n)}${why ? `<small>${why}</small>` : ''}`;
  g.appendChild(p);
  g.classList.add(n > 0 ? 'bump' : 'ease');
}
// 설명 글 바꾸기 — instant면 타자 없이 (강화소처럼 누를 때마다 숫자만 바뀌는 글)
// 치던 글은 끝까지 보여 준 뒤에 바꾼다 — 위의 상인 · 신도 말(ndSay)이 치다 만 채로 남지 않게
function setText(html, instant = false) {
  const t = q('#ndText');
  if (!t) return;
  if (seq) { seq.finish(); seq = null; }
  if (instant) t.innerHTML = html; else typeInto(t, html, TYPE);
}
// 몸통은 그릴 때마다 새 요소로 갈아 끼운다 — 다시 그려도 이전 클릭 처리기가 쌓이지 않게 (두 번 사지는 일 방지)
function body(html, { keepScroll = false } = {}) {
  const old = q('#ndBody');
  const top = keepScroll ? old.scrollTop : 0;
  const b = old.cloneNode(false);
  b.classList.remove('more');
  b.innerHTML = html;
  old.replaceWith(b);
  hideTip();
  b.scrollTop = top;
  b.addEventListener('scroll', () => moreBelow(b), { passive: true });
  requestAnimationFrame(() => { if (b.isConnected) moreBelow(b); });
  // 결과 · 경보 글은 타자로
  const msgs = [...b.querySelectorAll('.nd-result, .nd-alarm')];
  if (msgs.length) typeSequence(msgs.map(m => [m, m.innerHTML]), TYPE);
  return b;
}
function leaveLabel(t) { const b = q('#ndLeave'); if (b) b.textContent = t; }
function leave() { hideTip(); closeSheet(); finishNode(); }
function fight(enc, extra = {}) {
  hideTip();
  go('battle', Object.assign({ nodeId: node.id, enc }, extra));
}
function charArt(key, fallbackIcon) {
  const u = art(key);
  return u ? `<img src="${u}" alt="" draggable="false">` : `<div class="nd-glyph">${icon(fallbackIcon)}</div>`;
}
const glyph = name => `<div class="nd-glyph">${icon(name)}</div>`;
function opts(list) {
  // list: [{ label, desc, on, dis }]
  const b = body(`<div class="nd-opts">${list.map((o, i) => `<button class="nd-opt" type="button" data-i="${i}"${o.dis ? ' disabled' : ''}><b>${o.label}</b>${o.desc ? `<small>${o.desc}</small>` : ''}</button>`).join('')}</div>`);
  b.querySelector('.nd-opts').addEventListener('click', e => {
    const x = e.target.closest('.nd-opt');
    if (!x || x.disabled) return;
    SFX.click();
    list[+x.dataset.i].on();
  });
}
// 덱에서 한 장 고르기 (없애기 · 강화 · 거래)
function pickFromDeck({ title, sub = '', filter = () => true, onPick, preview = null }) {
  const cards = RUN.deck.filter(filter);
  if (!cards.length) { toast('고를 수 있는 카드가 없어요'); return; }
  const bodyEl = openSheet({ title, sub, wide: true, body: `<div class="deck-grid pick">${cards.map(c => bigCardHTML(preview ? preview(c) : c, { pick: true, extra: `data-uid="${c.uid}"` })).join('')}</div>` });
  bodyEl.addEventListener('click', e => {
    const el = e.target.closest('.card[data-uid]');
    if (!el) return;
    const uid = +el.dataset.uid;
    closeSheet();
    onPick(uid);
  });
}
// 카드 여러 장 중 하나 (보상과 같은 모양, 화면 안에). picked = 이미 고른 카드(다시 들어왔을 때 — 고른 모양만 보여 준다)
function cardPick(ids, { onPick, skip = '건너뛴다', title = '한 장을 고르세요', lead = '', picked = null } = {}) {
  const b = body(`${lead}<p class="nd-sub">${title}</p><div class="nd-cards">${ids.map(id => bigCardHTML(id, { pick: true, extra: `data-id="${id}"` })).join('')}</div>`);
  const mark = c => b.querySelectorAll('.card').forEach(x => { x.classList.toggle('taken', x === c); x.classList.toggle('off', x !== c); x.style.pointerEvents = 'none'; });
  leaveLabel(skip);
  if (picked) { mark(b.querySelector(`.card[data-id="${picked}"]`)); return; }
  b.querySelector('.nd-cards').addEventListener('click', e => {
    const c = e.target.closest('.card[data-id]');
    if (!c) return;
    addCard(c.dataset.id);
    SFX.gain();
    mark(c);
    if (onPick) onPick(c.dataset.id);   // 고른 것을 칸에 적는 일이 먼저 — 같은 저장에 들어가게
    autosave(); hud();
  });
}
const relicHTML = id => `<span class="relic r-${RELICS[id].rarity}" data-tip="relic:${id}">${icon(RELICS[id].icon)}</span>`;

/* ═════════════ 칸마다 ═════════════ */
const HANDLERS = {
  // ── 휴식 (기습 확률)
  rest() {
    const ch = chapterDef();
    const h = restHeal();
    const p = restAmbushChance();
    const al = ch.hunted ? 15 : 10;
    frame({ title: '무너진 벽 아래', text: `몸을 숨길 만한 자리가 있다. 잠시 눈을 붙일 수 있을 것 같다.<br><span class="dim">경계 ${alertStage()}단계 — 쉬는 사이 습격받을 확률 ${Math.round(p * 100)}% (회복한 뒤에 판정).</span>`, artHTML: glyph('flame'), leave: '쉬지 않고 떠난다' });
    if (node.rested) { restOutcome(); return; }   // 이 칸에서 이미 쉬었다 — 다시 회복 · 판정하지 않는다
    opts([
      { label: `쉰다 — HP +${h}`, desc: `경계도 +${al} · 습격 확률 ${Math.round(p * 100)}%${RUN.hp >= maxHp() ? ' · 이미 HP가 가득 차 있다' : ''}`, on: () => {
        const got = heal(h);
        addAlert(al);
        node.rested = { got, ambushed: R.chance(p) };
        SFX.heal(); hud(); autosave();
        restOutcome();
      } },
    ]);
  },

  // ── 상점 — "뭐 필요한 거 있어?"
  shop() {
    shopStock();
    frame({ title: '상점', say: '뭐 필요한 거 있어?', artHTML: charArt('shopkeeper', 'bag') });
    renderShop();
  },

  // ── 이야기 칸 — 대본의 뼈대 (data/story). kind마다 따로: battle · talk · shop · rest
  async story(params = {}) {
    const d = storyDef(node);
    if (!d || !STORY[d.kind]) { finishNode(); return; }
    const here = node, S = storyOf(RUN.chapter);
    await loadAll([bgKeyOf(node), `bg-st-${node.story}`, 'blackmarket', 'believer', d.art || '', ...storyArtKeys([...(d.pre || []), ...(d.scene || []), ...(d.quiet || []), ...(d.ambush || []), ...(d.win || []), ...(d.leave || []), ...(d.close || []), ...(d.ask || []).flatMap(a => a.scene)], S.cast || {})].filter(Boolean));
    if (!alive || node !== here) return;
    STORY[d.kind](d, S, params);
  },

  // ── 암시장 — "뭐 필요한 거 있어?" · 값은 부품이 아니다
  blackmarket() {
    if (!node.stock) {
      const costs = ['maxhp', 'curse', 'alert', 'hp'];
      const cards = cardChoices(R, 'high', 2).map(id => ({ kind: 'card', id, cost: R.pick(costs), sold: false }));
      const dark = RELIC_POOL('dark').filter(id => !RUN.relics.includes(id));
      const relics = (dark.length ? [R.pick(dark)] : []).map(id => ({ kind: 'relic', id, cost: 'free', sold: false }));
      const rare = relicChoice(R, [['rare', 100]], 1).map(id => ({ kind: 'relic', id, cost: R.pick(['maxhp', 'curse']), sold: false }));
      node.stock = [...cards, ...relics, ...rare];
    }
    frame({ title: '암시장', say: '뭐 필요한 거 있어?', artHTML: charArt('blackmarket', 'mask') });
    renderBlack();
  },

  // ── 강화소 — 1장 무료 + 톱니 조각 1개당 1장
  forge() {
    if (node.free === undefined) node.free = 1 + mods().forgeFree;
    frame({ title: '강화소', text: forgeText(), artHTML: glyph('anvil') });
    renderForge();
  },

  // ── 기계 이식소 — 톱니 조각 2
  implant() {
    if (!node.offer) {
      const pool = Object.keys(IMPLANTS).filter(id => !RUN.implants.includes(id));
      node.offer = R.sample(pool, Math.min(3, pool.length));
    }
    frame({ title: '기계 이식소', text: '녹슨 수술대 위로 정밀한 팔들이 매달려 있다. 기계를 몸에 이식한다. 이것은 되돌릴 수 없다.', artHTML: glyph('chip') });
    renderImplant();
  },

  // ── 심연 — 한 번만 디딘다 (결과는 칸에 남아, 다시 들어와도 같은 글만)
  abyss() {
    frame({ title: '심연', text: '발밑이 끝없이 가라앉는다. 심연은 무엇이든 돌려준다. 아니면 앗아간다.', artHTML: glyph('vortex') });
    if (node.abyss) { abyssDone(); return; }
    opts([
      { label: '발을 디딘다', desc: '좋은 일 셋 · 나쁜 일 셋 중 하나', on: () => {
        const out = R.pick(['parts', 'heal', 'relic', 'hurt', 'lose', 'curse']);
        let t = '';
        if (out === 'parts') { const n = R.int(50, 90); gainParts(n); t = `부품 ${n}개가 손에 쥐어져 있었다.`; }
        if (out === 'heal') { const n = heal(2); t = n ? `심연이 상처를 메웠다. HP +${n}.` : '심연이 상처를 더듬었지만, 메울 곳이 없었다.'; }
        if (out === 'relic') { const id = relicChoice(R, [['common', 55], ['rare', 45]])[0]; if (id) { addRelic(id); t = `어둠 속에서 「${RELICS[id].name}」${eulreul(RELICS[id].name)} 건져 올렸다.`; } else { gainParts(60); t = '부품 60개가 떠올랐다.'; } }
        if (out === 'hurt') { if (RUN.hp > 1) { hurt(1); t = '무언가가 살을 베어 갔다. HP −1.'; } else { addAlert(20); t = '비명이 새어 나갔다. 경계도 +20.'; } }
        if (out === 'lose') { const n = Math.min(RUN.parts, R.int(30, 50)); gainParts(-n); t = n ? `주머니가 가벼워졌다. 부품 −${n}.` : '빈 주머니를 뒤지던 손이 그냥 물러갔다.'; }
        if (out === 'curse') { addCard('rust'); t = '녹이 스며들었다. 저주 카드 「녹」이 덱에 들어갔다.'; }
        node.abyss = t;
        (['hurt', 'lose', 'curse'].includes(out) ? SFX.hurt : SFX.gain)();
        hud(); autosave();
        abyssDone();
      } },
    ]);
    leaveLabel('물러선다');
  },

  // ── 시험 — 조건이 붙은 전투
  trial() {
    const T = TRIALS[node.trial] || TRIALS.untouched;
    frame({ title: `시험 「${T.name}」`, text: `시스템이 당신을 평가한다.<br><b>${T.desc}.</b><br><span class="dim">통과하면 유물 하나와 톱니 조각 1개. 실패해도 전투 보상은 받는다.</span>`, artHTML: glyph('hourglass'), leave: '거부한다' });
    opts([{ label: '시험에 응한다', desc: `적: ${(node.enc ? node.enc.foes : []).map(t => FOES[t].name).join(' · ')}`, on: () => fight(encounterFor(node)) }]);
  },

  // ── 골목 — 4가지 중 무작위 (지도를 만들 때 정해짐)
  alley() {
    const ch = chapterDef();
    const kind = node.alley === 'shortcut' && !canShortcut(RUN.map, node.id) ? 'hide' : node.alley;   // 이야기 칸을 건너뛰는 지름길은 없다 (예전 저장의 골목)
    if (kind === 'hide') {
      frame({ title: '숨을 틈', text: '좁은 골목 안쪽, 감시가 닿지 않는 틈이 있다. 잠시 숨을 죽이면 흔적이 흐려질 것이다.', artHTML: glyph('alley') });
      if (node.hid) { hideDone(); return; }   // 한 번만 — 다시 들어와도 경계도가 또 내려가지 않는다
      opts([{ label: '숨는다 — 경계도 −30', desc: ch.hunted ? '추격대에게 들킬 수도 있다 (30%)' : '감시의 눈이 멀어진다', on: () => {
        node.hid = ch.hunted && R.chance(0.3) ? 'found' : 'hid';
        if (node.hid === 'hid') { addAlert(-30); SFX.cool(); } else SFX.alarm();
        hud(); autosave();
        hideDone();
      } }]);
    } else if (kind === 'narrow') {
      frame({ title: '좁은 골목', text: '양옆 벽이 바짝 붙은 골목. 기계들이 길을 막고 있다 — 판의 양 끝 세로줄이 막힌 채로 싸운다.<br><span class="dim">피할 곳이 적은 대신 부품 보상 ×1.5</span>', artHTML: glyph('alley'), leave: '돌아간다' });
      opts([{ label: '뚫고 지나간다', desc: '좁은 판 전투', on: () => fight(encounterFor({ id: node.id + '#narrow', type: 'battle', enc: { foes: R.pick(chapterDef().encounters.easy).slice() } }, { narrow: true, partsMul: 1.5, sub: '좁은 골목' })) }]);
    } else if (kind === 'deal') {
      frame({ title: '뒷골목 거래', say: '카드 한 장을 내놓으면, 더 좋은 걸 주지.', text: '두건을 깊이 눌러쓴 거래상이 손바닥을 펼친다. 얼굴은 보이지 않는다.', artHTML: glyph('mask') });
      if (node.deal) { dealDone(); return; }   // 거래는 한 번 — 다시 들어오면 꺼내 놓은 세 장(고른 뒤면 고른 모양) 그대로
      opts([{ label: '카드 한 장을 내놓는다', desc: '덱에서 한 장을 없애고, 희귀 · 전설 카드 3장 중 1장을 받는다', on: () => pickFromDeck({ title: '내놓을 카드', onPick: uid => {
        const c = removeCard(uid);
        node.deal = { gave: cardDef(c).name, ids: cardChoices(R, 'high', 3) };
        SFX.coin(); hud(); autosave();
        dealDone();
      } }) }]);
    } else {
      frame({ title: '지름길', text: '무너진 담장 너머로 지름길이 보인다. 다만 감시탑의 빛이 곧장 닿는 길이다.', artHTML: glyph('alley'), leave: '원래 길로 간다' });
      opts([{ label: '지름길로 간다', desc: '톱니 두 칸 앞으로 곧장 · 경계도 +25', on: () => {
        addAlert(25);
        RUN.flags.shortcut = true;
        SFX.gears(); autosave();
        leave();
      } }]);
    }
  },

  // ── 천막(사이비) — 세계 소식 + 기도 · 성물 · 속삭임 중 하나
  tent() {
    const ch = chapterDef();
    const list = LORE[ch.num] || [];
    const seen = (RUN.flags.lore[ch.num] || 0);
    if (node.loreIdx === undefined) { node.loreIdx = seen % Math.max(1, list.length); RUN.flags.lore[ch.num] = seen + 1; }
    const line = list[node.loreIdx] || '';
    frame({ title: '신도들의 천막', say: fmt(line), text: `천막 안의 신도들이 목소리를 낮춘다. 「${esc(RUN.name || '당신')}${RUN.name ? ' 님' : ''}, 필요한 게 있으면 말해요.」`, artHTML: charArt('believer', 'tent') });
    if (node.tent) { tentDone(); return; }   // 셋 중 하나만 — 다시 들어오면 고른 일의 결과만
    opts([
      { label: '치료 — HP +2', desc: `지금 ${RUN.hp} / ${maxHp()}`, on: () => { node.tent = { kind: 'heal', got: heal(2) }; SFX.heal(); hud(); autosave(); tentDone(); } },
      { label: '성물 — 사이비 카드 한 장', desc: '신도들이 간직해 온 옛 기도문 세 장 중 하나', on: () => { node.tent = { kind: 'cards', ids: cardChoices(R, 'cult', 3) }; autosave(); tentDone(); } },
      { label: '속삭임 — 앞길의 정보', desc: '앞에 기다리는 것에 대해 듣고 경계도 −15', on: () => { addAlert(-15); node.tent = { kind: 'whisper' }; hud(); autosave(); SFX.page(); tentDone(); } },
    ]);
  },

  // ── 사건 — 대사 장면으로 겪고, 끝나면 결과를 이 화면에 남긴다 (다시 들어와도 두 번 받지 않는다)
  async event() {
    const here = node;
    const id = EVENTS[node.event] ? node.event : Object.keys(EVENTS)[0];
    const E = EVENTS[id];
    await load(`bg-ev-${id}`);   // 사건마다 배경 그림 슬롯 — 없으면 사건 칸 공통 배경(bg-event)
    if (!alive || node !== here) return;
    if (node.ev && node.ev.done) { eventResult(E); return; }
    frame({ title: E.title, artHTML: glyph(E.icon || 'help') });
    q('#ndLeave').hidden = true;   // 장면을 끝까지 겪어야 떠날 수 있다
    playEvent(id, E);
  },

  // ── 유물 제단 — 2개 중 1개
  shrine() {
    if (!node.offer) node.offer = relicChoice(R, [['common', 55], ['rare', 45]], 2);
    frame({ title: '유물 제단', text: '먼지 쌓인 제단 위에 두 개의 물건이 놓여 있다. 하나를 집으면 다른 하나는 바스러질 것이다.', artHTML: glyph('gem') });
    const b = body(`<div class="nd-relics">${node.offer.map(id => `<button class="rw-relic" type="button" data-id="${id}"><span class="relic big r-${RELICS[id].rarity}">${icon(RELICS[id].icon)}</span><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></button>`).join('')}</div>`);
    const took = id => {
      b.querySelectorAll('.rw-relic').forEach(y => { y.disabled = true; y.classList.toggle('taken', y.dataset.id === id); });
      setText(`「${RELICS[id].name}」${eulreul(RELICS[id].name)} 집었다. 다른 하나는 먼지가 되었다.`);
    };
    if (node.taken) { took(node.taken); return; }   // 이미 집었다 — 다시 들어와도 남은 하나를 또 집을 수 없다
    b.addEventListener('click', e => {
      const x = e.target.closest('.rw-relic');
      if (!x || x.disabled || node.taken) return;
      node.taken = x.dataset.id;
      addRelic(x.dataset.id); SFX.gain(); hud(); autosave();
      took(x.dataset.id);
    });
  },
};

// 한 번만 하는 칸의 결과 — 고른 일은 칸(node)에 적어 두고, 다시 들어오면(이어 하기 · 새로고침) 이 결과만 보여 준다
function abyssDone() { body(`<p class="nd-result">${icon('vortex')} ${node.abyss}</p>`); leaveLabel('떠난다'); }
function hideDone() {
  if (node.hid !== 'found') { body(`<p class="nd-result">${icon('eye')} 숨을 죽였다. 경계도가 내려갔다 (지금 ${RUN.alert}).</p>`); return; }
  // 들켰다(추격이 붙은 장) — 휴식 습격처럼 싸워야 지나간다
  body(`<p class="nd-alarm">${icon('burst')} 들켰다! 골목 끝에서 추격대가 막아선다.</p><div class="nd-opts"><button class="nd-opt main" type="button" id="ndFight"><b>맞서 싸운다</b><small>골목 — 발각</small></button></div>`);
  q('#ndLeave').hidden = true;
  q('#ndFight').addEventListener('click', () => { SFX.click(); fight(encounterFor({ id: node.id + '#found', type: 'battle' }, { sub: '골목 — 발각' })); });
}
function dealDone() {
  const d = node.deal;
  const say = () => setText(d.picked ? `「${d.gave}」${eulreul(d.gave)} 내주고 「${CARDS[d.picked].name}」${eulreul(CARDS[d.picked].name)} 받았다. 거래상은 어느새 골목 안쪽으로 사라졌다.`
    : `「${d.gave}」${eulreul(d.gave)} 내주었다. 거래상이 품에서 카드 세 장을 꺼낸다.`);
  say();
  cardPick(d.ids, { skip: '떠난다', title: '하나를 고르세요', picked: d.picked, onPick: id => { d.picked = id; say(); } });
}
function tentDone() {
  const t = node.tent;
  if (t.kind === 'heal') { body(`<p class="nd-result">${icon('chalice')} 신도들이 숨겨 둔 약으로 상처를 감쌌다. ${t.got ? `HP +${t.got}.` : '상처는 이미 아물어 있었다.'}</p>`); return; }
  if (t.kind === 'whisper') { body(`<div class="nd-result">${nextEliteBoss()}</div>`); return; }
  const say = () => setText(t.picked ? `신도들이 기도문 「${CARDS[t.picked].name}」${eulreul(CARDS[t.picked].name)} 건네며 손을 모았다.` : '신도들이 빼앗기지 않은 기도문을 조심스레 펼쳐 보인다.');
  say();
  cardPick(t.ids, { skip: '떠난다', picked: t.picked, onPick: id => { t.picked = id; say(); } });
}

// 상점 물건 — 칸마다 한 번 정한다 (상점 · 이야기 칸의 천막 상점)
function shopStock() {
  if (node.stock) return;
  const mul = dm().shopMul * mods().shopMul;
  const price = base => Math.round(base * mul);
  const cardP = { common: 45, rare: 80, legend: 150 };
  const relicP = { common: 140, rare: 200 };
  node.stock = {
    cards: cardChoices(R, 'shop', 5).map(id => ({ id, price: price(cardP[CARDS[id].rarity] || 60), sold: false })),
    relics: relicChoice(R, [['common', 60], ['rare', 40]], 2).map(id => ({ id, price: price(relicP[RELICS[id].rarity] || 160), sold: false })),
    items: [{ id: 'potion', price: price(ITEMS.potion.price), left: 2 }, { id: 'kit', price: price(ITEMS.kit.price), left: 1 }],
    removed: false,
  };
}

/* ═════════════ 이야기 칸 ═════════════ */
// 대본 장면 — 사건과 같은 도우미(G)로 선택지 효과를 처리한다. 저장은 장면이 끝난 뒤
async function storyScene(script, G = eventCtx()) {
  const S = storyOf(RUN.chapter);
  await playScene(script, Object.assign(sceneOpts(), { ctx: G, cast: S.cast || {}, bg: bgKeyOf(node), onName: n => { RUN.name = n; } }));
  return G;
}
// 이야기 칸의 사람 그림 — 전용 그림(art)이 있으면 그것, 없으면 대신 쓰는 그림(altArt)
const storyArt = (d, fallback, glyphName) => charArt(d.art && art(d.art) ? d.art : d.altArt || fallback, glyphName);
// 장면을 보는 동안 칸 화면은 제목만 (장면이 끝나야 떠날 수 있다)
function storyCover(d, artHTML = '') {
  frame({ title: esc(d.title), artHTML: artHTML || glyph(d.icon) });
  q('#ndLeave').hidden = true;
}
const STORY = {
  // 앞 대사(선택 · 효과) → 재귀 지점(자동) → 전투 → 승리 대사 → 보상. 재귀 · 이어 하기로 돌아오면 곧장 전투
  async battle(d) {
    const here = node;
    if (!node.preDone) {
      storyCover(d);
      await storyScene(d.pre);
      if (!alive || node !== here) return;
      node.preDone = true;
      writeRecur({ at: node.id });   // 전투 직전 — 쓰러지면 여기로 (저장 횟수를 쓰지 않는다)
      toast('재귀 지점 — 쓰러지면 이 전투를 처음부터', 'gold');
    }
    fight(encounterFor(node));
  },
  // 대사 · 선택 → 결과 (사건처럼 다시 들어와도 두 번 받지 않는다)
  async talk(d) {
    const here = node;
    if (node.ev && node.ev.done) { eventResult(d); return; }
    storyCover(d);
    const G = await storyScene(d.scene);
    if (!alive || node !== here) return;
    if (node.healed && node.healed.got && !G.res.some(r => r.i === 'heart')) G.res.unshift({ t: `HP +${node.healed.got}`, k: 'good', i: 'heart' });   // 장면을 보다 끄고 다시 봐도 회복한 것은 남긴다
    node.ev = { done: true, after: G.afterText || '', res: G.res, pending: G.pending };
    RUN.flags.seen = Object.assign({}, RUN.flags.seen, { [`st:${node.story}`]: true });
    autosave();
    eventResult(d);
  },
  // 앞 대사 → 천막 상점 + 질문 두 가지(무료, 둘 다 들어야 나갈 수 있다) → 나갈 때 마무리 대사
  async shop(d) {
    const here = node;
    if (!node.preDone) {
      storyCover(d, storyArt(d, 'blackmarket', 'mask'));
      await storyScene(d.pre);
      if (!alive || node !== here) return;
      node.preDone = true;
      autosave();
    }
    shopStock();
    node.asked = node.asked || {};
    frame({ title: esc(d.title), say: d.say || '', artHTML: storyArt(d, 'blackmarket', 'mask'), narrow: false, onLeave: () => storyShopLeave(d) });
    renderShop();
    storyShopLeaveLabel(d);
  },
  // 앞 대사 → 휴식(회복 먼저, 습격 판정 한 번) · 정비만 → 조용한 휴식 / 습격 전투 / 떠날 때 대사
  async rest(d) {
    const here = node;
    if (!node.preDone) {
      storyCover(d, glyph('flame'));
      await storyScene(d.pre);
      if (!alive || node !== here) return;
      node.preDone = true;
      autosave();
    }
    const r = node.rested;
    if (!r) { storyRestChoose(d); return; }
    if (r.ambushed && !node.won) { storyRestAmbush(d); return; }
    storyRestDone(d);
  },
};

// 천막 상점 — 질문 두 가지 (renderShop 위쪽에 붙는다)
function storyAskHTML(d) {
  const asked = node.asked || {};
  // 다 들었으면 한 줄로 접는다 — 상점 물건이 가려지지 않게 (다시 듣기는 그대로)
  if (storyAsked(d)) return `<div class="st-ask done">${icon('check')}<b>상인에게 들은 것</b>${d.ask.map(a => `<button class="st-chip" type="button" data-ask="${a.id}">${esc(a.short || a.label)}<small>다시 듣기</small></button>`).join('')}</div>`;
  return `<div class="st-ask"><b>${icon('help')}상인에게 묻는다 <small>값은 받지 않는다 · 둘 다 들어야 나갈 수 있다</small></b>
    <div class="st-ask-row">${d.ask.map(a => `<button class="nd-opt${asked[a.id] ? ' done' : ''}" type="button" data-ask="${a.id}"><b>${esc(a.label)}</b><small>${asked[a.id] ? '들었다 — 다시 들을 수 있다' : esc(a.short || '')}</small></button>`).join('')}</div></div>`;
}
function storyAsked(d) { return (d.ask || []).every(a => (node.asked || {})[a.id]); }
function storyShopLeaveLabel(d) {
  const n = (d.ask || []).filter(a => (node.asked || {})[a.id]).length;
  leaveLabel(storyAsked(d) ? '천막을 나선다' : `먼저 물어본다 (${n}/${d.ask.length})`);
  const b = q('#ndLeave');
  if (b) b.classList.toggle('wait', !storyAsked(d));
}
async function storyAsk(d, id) {
  const a = d.ask.find(x => x.id === id);
  if (!a) return;
  const here = node;
  await storyScene([{ tint: 'warm' }, ...a.scene]);
  if (!alive || node !== here) return;
  node.asked = Object.assign({}, node.asked, { [id]: true });
  autosave();
  renderShop();
  storyShopLeaveLabel(d);
}
async function storyShopLeave(d) {
  if (!storyAsked(d)) { SFX.deny(); toast('상인에게 두 가지를 먼저 물어보세요 — 값은 받지 않아요'); return; }
  const here = node;
  // 나가는 대화(07 — 외투의 빚)는 한 번만. 보다가 끄면 다시 들어왔을 때 처음부터
  if (d.close && !node.closed) { await storyScene(d.close); if (!alive || node !== here) return; node.closed = true; }
  leave();
}

// 이야기 칸의 휴식(1장 = 14 「불을 끄는 값」) — 회복하고 쉴지, 물품만 정리하고 떠날지
function storyRestChoose(d) {
  const h = restHeal(), p = restAmbushChance();
  frame({ title: esc(d.title), artHTML: glyph('flame'),
    text: `작은 화로 옆에서 잠시 쉴 수 있다. <b>HP +${h}</b> (지금 ${RUN.hp} / ${maxHp()}).<br><span class="dim">경계 ${alertStage()}단계 — 쉬는 사이 습격받을 확률 <b>${Math.round(p * 100)}%</b> (0 · 1 · 2단계 = 15 · 25 · 35%, 회복한 뒤 한 번만 판정).</span>` });
  q('#ndLeave').hidden = true;
  opts([
    { label: `${d.restLabel || '휴식한다'} — HP +${h}`, desc: `습격 확률 ${Math.round(p * 100)}%${RUN.hp >= maxHp() ? ' · 이미 HP가 가득 차 있다' : ''}`, on: async () => {
      const got = heal(h);
      node.rested = { mode: 'rest', got, ambushed: R.chance(p) };
      SFX.heal(); hud(); autosave();
      if (node.rested.ambushed) { storyRestAmbush(d); return; }
      const here = node;
      await storyScene(d.quiet);
      if (!alive || node !== here) return;
      node.quiet = true; autosave();
      storyRestDone(d);
    } },
    { label: d.fixLabel || '정비만 하고 출발한다', desc: d.fixDesc || '회복도 습격 판정도 없다 — 덱 · 가방을 살핀 뒤 떠난다', on: () => {
      node.rested = { mode: 'fix' };
      SFX.click(); autosave();
      storyRestDone(d);
    } },
  ]);
}
// 습격 — 회복은 이미 들어갔다. 대사 → 재귀 지점(휴식 뒤 상태) → 약한 감시 시계 한 기와 전투 → 보상 뒤 이 칸으로
async function storyRestAmbush(d) {
  const here = node;
  if (!node.ambushPre) {
    SFX.alarm();
    storyCover(d, glyph('flame'));
    await storyScene(d.ambush);
    if (!alive || node !== here) return;
    node.ambushPre = true;
    writeRecur({ at: node.id });
  }
  fight(encounterFor(node, { ambushed: true }), { after: 'rest', back: true });
}
// 결과 — 무엇을 했는지 · (조용한 휴식을 못 들었으면) 신도와 이야기 · 떠나기
function storyRestDone(d) {
  const r = node.rested;
  const line = r.mode === 'fix' ? `${icon('wrench')} 쉬지 않고 물품만 정리했다. 덱과 가방을 살핀 뒤 떠날 수 있다.`
    : `${icon('flame')} 작은 화로 옆에서 잠시 쉬었다. ${r.got ? `HP +${r.got}.` : '몸은 이미 멀쩡했다.'}${r.ambushed ? ' 쉬던 자리를 뒤지던 기계들을 물리쳤다.' : ''}`;
  frame({ title: esc(d.title), artHTML: glyph('flame'), leave: d.leaveLabel || '떠난다', onLeave: async () => {
    const here = node;
    if (r.mode === 'fix' && d.leave && !node.closed) { await storyScene(d.leave); if (!alive || node !== here) return; node.closed = true; }
    if (d.goalAfter) RUN.goal = d.goalAfter;
    autosave();
    leave();
  } });
  body(`<p class="nd-result">${line}</p>`);
}

// 휴식 결과 — 회복은 이미 들어갔고, 습격이면 싸우고 떠난다 (다시 들어와도 같은 결과)
const restHeal = () => Math.max(1, 2 + dm().restHeal + mods().restHeal);
function restOutcome(enc = null) {
  const r = node.rested;
  const healed = `<p class="nd-result">${icon('flame')} 잠시 눈을 붙였다. ${r.got ? `HP +${r.got}.` : '몸은 이미 멀쩡했다.'}</p>`;
  if (!r.ambushed) { body(healed); leaveLabel('떠난다'); return; }
  SFX.alarm();
  body(`${healed}<p class="nd-alarm">${icon('burst')} 습격! 쉬던 자리로 감시 기계가 들이닥쳤다.</p><div class="nd-opts"><button class="nd-opt main" type="button" id="ndFight"><b>맞서 싸운다</b><small>적이 먼저 움직인다</small></button></div>`);
  q('#ndLeave').hidden = true;
  q('#ndFight').addEventListener('click', () => fight(enc || encounterFor({ id: node.id + '#amb', type: 'battle' }, { ambushed: true, sub: '휴식 중 습격' }), { after: 'rest' }));
}

/* ═════════════ 사건 ═════════════ */
// 장면 속 도우미 — 사건 대본(data/events.js)의 act · if · cond가 부른다.
// 효과는 바로 RUN에 들어가지만 저장은 장면이 끝난 뒤 한 번 — 도중에 끄면 장면을 처음부터 다시 본다(두 번 받지 않는다)
const sgn = n => (n > 0 ? '+' : '−') + Math.abs(n);
function eventCtx() {
  const res = [];
  const note = (t, k, i) => { res.push({ t, k, i }); sceneNote(`${icon(i)}<span>${esc(t)}</span>`, k); hud(); };
  const G = {
    res, pending: null, afterText: '', vars: {},
    // 얻고 잃기 — 결과 목록에 저절로 적힌다
    parts(n) { const b = RUN.parts; gainParts(n); const d = RUN.parts - b; if (d) { note(`부품 ${sgn(d)}`, d > 0 ? 'good' : 'bad', 'parts'); d > 0 ? SFX.coin() : SFX.click(); } },
    shards(n) { const b = RUN.shards; gainShards(n); const d = RUN.shards - b; if (d) { note(`톱니 조각 ${sgn(d)}`, d > 0 ? 'good' : 'bad', 'shard'); if (d > 0) SFX.gain(); } },
    heal(n) { const d = heal(n); if (d) { note(`HP +${d}`, 'good', 'heart'); SFX.heal(); } },
    hurt(n) { const b = RUN.hp; hurt(Math.max(0, Math.min(n, RUN.hp - 1))); const d = b - RUN.hp; if (d) { note(`HP −${d}`, 'bad', 'heart'); SFX.hurt(); } },   // 사건에서는 쓰러지지 않는다 — HP 1까지만
    alert(n) { const d = addAlert(n); if (d) { note(`경계도 ${sgn(d)}`, d > 0 ? 'bad' : 'good', 'eye'); d > 0 ? SFX.warn() : SFX.cool(); } },
    maxHp(n, fill = true) { RUN.maxHpBase += n; if (n > 0 && fill) heal(n); else fixHp(); note(`최대 HP ${sgn(n)}`, n > 0 ? 'good' : 'bad', 'heart'); n > 0 ? SFX.heal() : SFX.hurt(); },   // fill = 늘어난 만큼 채우기
    card(cid) { if (!addCard(cid)) return; const c = CARDS[cid]; const bad = c.rarity === 'curse'; note(`${bad ? '저주' : '카드'} 「${c.name}」`, bad ? 'bad' : 'good', bad ? 'nail' : 'deck'); bad ? SFX.hurt() : SFX.gain(); },
    relic(tier = 'common') {
      const rid = relicChoice(R, [[tier, 100]])[0];
      if (!rid) { G.parts(50); return '부품 50'; }
      addRelic(rid); note(`유물 「${RELICS[rid].name}」`, 'good', RELICS[rid].icon); SFX.gain();
      return RELICS[rid].name;
    },
    upgradeRandom() {
      const list = RUN.deck.filter(canUpgrade);
      if (!list.length) return '';
      const c = R.pick(list); upgradeCard(c.uid);
      note(`「${CARDS[c.id].name}」 강화`, 'good', 'up'); SFX.gain();
      return CARDS[c.id].name;
    },
    removeCurse() {
      const c = RUN.deck.find(x => CARDS[x.id] && CARDS[x.id].rarity === 'curse');
      if (!c) return '';
      removeCard(c.uid); note(`저주 「${CARDS[c.id].name}」 없어짐`, 'good', 'check'); SFX.cool();
      return CARDS[c.id].name;
    },
    shortcut() { if (!canShortcut(RUN.map, RUN.pos)) return; RUN.flags.shortcut = true; note('지름길 — 다음엔 두 칸 앞 톱니로', 'good', 'leap'); },
    canShortcut: () => canShortcut(RUN.map, RUN.pos),   // 바로 다음이 이야기 칸이면 건너뛸 수 없다
    // 가방 · 경계 단계 · 목표 (대본 1장)
    item(id, n = 1) { addItem(id, n); note(`${ITEMS[id].name} ${sgn(n)}`, n > 0 ? 'good' : 'bad', ITEMS[id].icon); n > 0 ? SFX.gain() : SFX.click(); },
    alertUp() { if (alertStageUp()) { note(`경계 +1단계 — 지금 ${alertStage()}단계`, 'bad', 'eye'); SFX.warn(); } },   // 대본의 '경계도 +1'
    goal(t) { RUN.goal = t; note(`목표 — ${t}`, '', 'compass'); SFX.page(); },
    // 안전한 휴식(04 · 08) — 이 칸에서 한 번만 회복한다. 습격은 없다
    safeRest() { if (node.healed) return; const b = RUN.hp; heal(restHeal()); node.healed = { got: RUN.hp - b }; if (node.healed.got) { note(`HP +${node.healed.got} — 숨은 곳에서 쉬었다`, 'good', 'heart'); SFX.heal(); } },
    // 장면이 끝난 뒤 이 화면에서 이어지는 일 (하나만)
    cardPick(tier = 'normal') { G.pending = { t: 'cards', ids: cardChoices(R, tier, 3) }; },
    removePick() { G.pending = { t: 'remove' }; },
    upgradePick() { G.pending = { t: 'upgrade' }; },
    fight(enc) { G.pending = { t: 'fight', enc }; },
    // 판단
    chance: p => R.chance(p),
    hp: () => RUN.hp, maxHpNow: () => maxHp(), partsNow: () => RUN.parts, shardsNow: () => RUN.shards, alertNow: () => RUN.alert,
    canUpgrade: () => RUN.deck.some(canUpgrade),
    hasCurse: () => RUN.deck.some(c => CARDS[c.id] && CARDS[c.id].rarity === 'curse'),
    kits: () => bag().kit, potions: () => bag().potion, stage: () => alertStage(),
    deaths: () => RUN.stats.deaths || 0,
    intel: () => nextEliteBoss({ plain: true }),   // 다음 정예 · 보스 공략 (천막 속삭임과 같은 내용, 글만)
    // 이야기 깃발 — 이 판 동안 남아 다른 사건 · 정예 · 보스 대사가 달라진다 (재귀하면 그 시점으로 함께 돌아간다)
    flag(k, v = true) { RUN.flags.ev = Object.assign({}, RUN.flags.ev, { [k]: v }); },
    has: k => !!(RUN.flags.ev || {})[k],
    // 이 장면 안에서만
    set(k, v = true) { G.vars[k] = v; },
    is: k => !!G.vars[k],
  };
  return G;
}
async function playEvent(id, E) {
  const here = node;
  await loadAll(storyArtKeys(E.scene, Object.assign({}, storyOf(RUN.chapter).cast || {}, E.cast || {})));   // 말하는 인물 · 적(돌진 기계 등) 그림
  if (!alive || node !== here) return;
  const G = eventCtx();
  const key = 'ev:' + id;
  // 대본: 되돌린 뒤 같은 사건을 다시 만나도 주인공은 기억하지 않는다(쓰러짐 · 재도전은 정사가 아니다) — 기시감 대사는 없다
  const script = [
    { tint: E.tint || '', place: E.place || chapterDef().place, amb: E.amb || null },
    ...E.scene,
  ];
  let picked = '';
  await playScene(script, { ctx: G, cast: Object.assign({}, storyOf(RUN.chapter).cast || {}, E.cast || {}), bg: bgKeyOf(node), onChoice: l => { if (!picked) picked = l; } });
  if (!alive || node !== here) return;
  node.ev = { done: true, after: G.afterText || '', res: G.res, pending: G.pending };
  RUN.flags.seen = Object.assign({}, RUN.flags.seen, { [key]: picked || true });
  markEventSeen(id);
  autosave();
  eventResult(E);
}
// 싸울 상대 이름 — 「감시 눈 ×2」
const foesText = list => Object.entries(list.reduce((m, t) => (m[t] = (m[t] || 0) + 1, m), {})).map(([t, n]) => `${FOES[t].name}${n > 1 ? ` ×${n}` : ''}`).join(' · ');
// 장면이 끝난 뒤 — 결과 한 줄 · 얻고 잃은 것 · 이어지는 일(카드 고르기 · 내려놓기 · 강화 · 전투)
function eventResult(E) {
  const ev = node.ev;
  frame({ title: E.title, text: ev.after ? fmt(ev.after) : esc(E.teaser || ''), artHTML: glyph(E.icon || 'help') });
  const p = ev.pending;
  // 얻고 잃은 것 — 아무것도 없고 이어지는 일(카드 고르기 등)도 없을 때만 「없다」고 적는다
  const list = ev.res.length
    ? `<ul class="ev-res">${ev.res.map(r => `<li class="${r.k || ''}">${icon(r.i)}<span>${esc(r.t)}</span></li>`).join('')}</ul>`
    : p || E.noLoot ? '' : '<p class="ev-none">얻은 것도, 잃은 것도 없다.</p>';
  const settle = () => { ev.pending = null; hud(); autosave(); };
  if (!p) { body(list); return; }
  if (p.t === 'cards') { cardPick(p.ids, { skip: '떠난다', lead: list, onPick: id => { ev.res.push({ t: `카드 「${CARDS[id].name}」`, k: 'good', i: 'deck' }); settle(); } }); return; }   // 고른 카드도 결과 목록에 (다시 들어오면 목록으로 보인다)
  if (p.t === 'remove' || p.t === 'upgrade') {
    const up = p.t === 'upgrade';
    const cards = up ? RUN.deck.filter(canUpgrade) : RUN.deck.slice();
    if (!cards.length) { ev.pending = null; autosave(); body(list); return; }
    const b = body(`${list}<p class="nd-sub">${up ? '강화할 카드를 한 장 고르세요 — 강화된 모습으로 보여 줘요. 그냥 떠나도 돼요.' : '내려놓을 카드를 한 장 고르세요 — 덱에서 없어져요. 그냥 떠나도 돼요.'}</p>
      <div class="deck-grid pick">${cards.map(c => bigCardHTML(up ? Object.assign({}, c, { up: 1 }) : c, { pick: true, mid: true, showUp: up, extra: `data-uid="${c.uid}"` })).join('')}</div>`);
    b.querySelector('.deck-grid').addEventListener('click', e => {
      const el = e.target.closest('.card[data-uid]');
      if (!el) return;
      const c = RUN.deck.find(x => x.uid === +el.dataset.uid);
      if (!c) return;
      const nm = cardDef(c).name;
      if (up) upgradeCard(c.uid); else removeCard(c.uid);
      SFX.gain();
      ev.res.push({ t: up ? `「${nm}」 강화` : `「${nm}」 내려놓음`, k: 'good', i: up ? 'up' : 'check' });
      settle();
      eventResult(E);
    });
    return;
  }
  if (p.t === 'fight') {
    body(`${list}<div class="nd-opts"><button class="nd-opt main" type="button" id="ndFight"><b>싸운다</b><small>${foesText(p.enc.foes)}${p.enc.bonusParts ? ` · 이기면 부품 +${p.enc.bonusParts}` : ''}</small></button></div>`);
    q('#ndLeave').hidden = true;
    q('#ndFight').addEventListener('click', () => { SFX.click(); fight(encounterFor({ id: node.id + '#ev', type: 'battle', enc: { foes: p.enc.foes } }, { bonusParts: p.enc.bonusParts || 0, sub: E.title })); });
  }
}

// 천막 속삭임 — 다음 정예 · 보스 (plain이면 대사로 읽을 글 한 덩어리)
function nextEliteBoss({ plain = false } = {}) {
  const ch = chapterDef();
  const map = RUN.map;
  const reach = new Set(), stack = [...map.nodes[RUN.pos].next];
  while (stack.length) { const id = stack.pop(); if (reach.has(id)) continue; reach.add(id); stack.push(...map.nodes[id].next); }
  const elites = ch.encounters.elite.length ? [...reach].map(id => map.nodes[id]).filter(n => n.type === 'elite') : [];
  const lines = [];
  const TIPS = {
    gatekeeper: '수문장은 정면의 방패판이 단단해요. 옆이나 뒤로 도세요. 앞 두 줄을 한꺼번에 내려찍으니 거리를 두시고요.',
    alpha: '사냥개 우두머리는 두 칸씩 달려와요. 바로 옆에 서면 물려요 — 대각선도요. 무리를 먼저 흩으세요.',
  };
  const seen = new Set();
  for (const n of elites) {
    const e = ch.encounters.elite[(n.eliteIdx || 0) % ch.encounters.elite.length];
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    lines.push([`정예 · ${FOES[e.foes[0]].name}`, TIPS[e.id] || FOES[e.foes[0]].desc]);
  }
  const bd = BOSSES[ch.encounters.boss.boss];
  lines.push([`외곽문 · ${bd.name}`, '루프마다 공격 하나를 예고하고, 마지막 행동 뒤에 쏴요. 체력이 3분의 2 · 3분의 1 아래로 내려가면 절차가 바뀌어요. 마지막 「전 구역 폐쇄」 때는 옆 두 세로줄만 안전해요. 덧붙인 명령판을 과부하시키면 4코스트 동안 멈춰요.']);
  if (plain) return lines.map(([h, t]) => `「${h}」 — ${t}`).join(' ');
  return lines.map(([h, t]) => `<p><b>${h}</b> — ${t}</p>`).join('');
}

// 상점 그리기
function renderShop() {
  const s = node.stock;
  const canBuy = p => RUN.parts >= p;
  const sd = node.type === 'story' ? storyDef(node) : null;
  const b = body(`${sd && sd.ask ? storyAskHTML(sd) : ''}<div class="shop">
    <div class="shop-cards">${s.cards.map((c, i) => `<div class="shop-item${c.sold ? ' sold' : ''}">${bigCardHTML(c.id, { pick: !c.sold, extra: `data-ci="${i}"` })}<span class="price${canBuy(c.price) ? '' : ' no'}">${icon('parts')}${c.price}</span></div>`).join('')}</div>
    <div class="shop-side">
      ${s.relics.map((r, i) => `<button class="shop-relic${r.sold ? ' sold' : ''}" type="button" data-ri="${i}"${r.sold ? ' disabled' : ''}>${relicHTML(r.id)}<span><b>${RELICS[r.id].name}</b><small>${RELICS[r.id].desc}</small></span><span class="price${canBuy(r.price) ? '' : ' no'}">${icon('parts')}${r.price}</span></button>`).join('')}
      ${(s.items || []).map((it, i) => `<button class="shop-relic item${it.left ? '' : ' sold'}" type="button" data-ii="${i}"${it.left ? '' : ' disabled'}><span class="relic">${icon(ITEMS[it.id].icon)}</span><span><b>${ITEMS[it.id].name}<em class="left">${it.left ? `남은 ${it.left}` : '다 팔림'}</em></b><small>${ITEMS[it.id].desc}</small></span><span class="price${canBuy(it.price) ? '' : ' no'}">${icon('parts')}${it.price}</span></button>`).join('')}
      <button class="shop-relic remove${s.removed ? ' sold' : ''}" type="button" id="shopRemove"${s.removed ? ' disabled' : ''}><span class="relic">${icon('close')}</span><span><b>카드 없애기</b><small>덱에서 카드 한 장을 없앤다 (상점마다 한 번)</small></span><span class="price${canBuy(RUN.removeCost) ? '' : ' no'}">${icon('parts')}${RUN.removeCost}</span></button>
    </div></div>`, { keepScroll: true });
  b.querySelector('.shop-cards').addEventListener('click', e => {
    const el = e.target.closest('.card[data-ci]');
    if (!el) return;
    const c = s.cards[+el.dataset.ci];
    if (c.sold) return;
    if (!canBuy(c.price)) { toast('부품이 모자라요'); SFX.deny(); return; }
    gainParts(-c.price); addCard(c.id); c.sold = true; SFX.coin(); hud(); autosave(); renderShop();
  });
  b.querySelector('.shop-side').addEventListener('click', e => {
    const ib = e.target.closest('.shop-relic[data-ii]');
    if (ib) {
      const it = s.items[+ib.dataset.ii];
      if (!it.left) return;
      if (!canBuy(it.price)) { toast('부품이 모자라요'); SFX.deny(); return; }
      gainParts(-it.price); addItem(it.id); it.left--; SFX.coin(); hud(); autosave(); renderShop();
      return;
    }
    const r = e.target.closest('.shop-relic[data-ri]');
    if (r) {
      const it = s.relics[+r.dataset.ri];
      if (it.sold) return;
      if (!canBuy(it.price)) { toast('부품이 모자라요'); SFX.deny(); return; }
      gainParts(-it.price); addRelic(it.id); it.sold = true; SFX.gain(); hud(); autosave(); renderShop();
      return;
    }
    if (e.target.closest('#shopRemove')) {
      if (s.removed) return;
      if (!canBuy(RUN.removeCost)) { toast('부품이 모자라요'); SFX.deny(); return; }
      pickFromDeck({ title: '없앨 카드', sub: `부품 ${RUN.removeCost}`, onPick: uid => {
        gainParts(-RUN.removeCost); removeCard(uid); s.removed = true; RUN.removeCost += 25; SFX.coin(); hud(); autosave(); renderShop();
      } });
    }
  });
  bindTips(b, t => relicTip(t.dataset.tip));
  if (sd && sd.ask) b.querySelector('.st-ask').addEventListener('click', e => { const x = e.target.closest('[data-ask]'); if (x) { SFX.click(); storyAsk(sd, x.dataset.ask); } });
}

// 암시장 그리기
const COST = {
  maxhp: { label: '최대 HP −1', can: () => maxHp() > 2, pay: () => { RUN.maxHpBase--; RUN.hp = Math.min(RUN.hp, maxHp()); } },
  curse: { label: '저주 「못 자국」', can: () => true, pay: () => addCard('nail_scar') },
  alert: { label: '경계도 +30', can: () => true, pay: () => addAlert(30) },
  hp: { label: 'HP −2', can: () => RUN.hp > 2, pay: () => hurt(2) },
  free: { label: '대가는 유물에 붙어 있다', can: () => true, pay: () => {} },
};
function renderBlack() {
  const b = body(`<div class="bm">${node.stock.map((it, i) => {
    const C = COST[it.cost];
    const inner = it.kind === 'card' ? bigCardHTML(it.id, { pick: !it.sold, extra: `data-bi="${i}"` })
      : `<button class="shop-relic big${it.sold ? ' sold' : ''}" type="button" data-bi="${i}"${it.sold ? ' disabled' : ''}>${relicHTML(it.id)}<span><b>${RELICS[it.id].name}</b><small>${RELICS[it.id].desc}</small></span></button>`;
    return `<div class="shop-item${it.sold ? ' sold' : ''}">${inner}<span class="price dark${C.can() ? '' : ' no'}">${esc(C.label)}</span></div>`;
  }).join('')}</div>`, { keepScroll: true });
  b.addEventListener('click', async e => {
    const el = e.target.closest('[data-bi]');
    if (!el) return;
    const it = node.stock[+el.dataset.bi];
    if (it.sold) return;
    const C = COST[it.cost];
    if (!C.can()) { toast('그 값을 치를 수 없어요'); SFX.deny(); return; }
    const name = it.kind === 'card' ? CARDS[it.id].name : RELICS[it.id].name;
    const ok = await confirmBox({ title: `「${name}」`, text: `값: ${C.label}`, buttons: [{ label: '거래한다', value: true, main: true }, { label: '그만둔다', value: false }] });
    if (!ok || !alive) return;
    C.pay();
    if (it.kind === 'card') addCard(it.id); else addRelic(it.id);
    it.sold = true; SFX.coin(); hud(); autosave(); renderBlack();
  });
  bindTips(b, t => relicTip(t.dataset.tip));
}

// 강화소 그리기
const forgeText = () => `낡은 모루와 식지 않은 화로. <b>무료 강화 ${node.free}번</b> 남음 · 그 뒤로는 톱니 조각 1개당 한 장 (지금 ${RUN.shards}개).`;
function renderForge() {
  const up = RUN.deck.filter(canUpgrade);
  if (!up.length) { body('<p class="nd-result">강화할 수 있는 카드가 없어요.</p>'); return; }
  const b = body(`<p class="nd-sub">강화된 모습과 바뀌는 점을 보여 줘요. 누르면 강화해요.</p><div class="deck-grid pick">${up.map(c => bigCardHTML(Object.assign({}, c, { up: 1 }), { pick: true, mid: true, showUp: true, extra: `data-uid="${c.uid}"` })).join('')}</div>`, { keepScroll: true });
  b.addEventListener('click', e => {
    const el = e.target.closest('.card[data-uid]');
    if (!el) return;
    if (node.free <= 0 && RUN.shards <= 0) { toast('톱니 조각이 없어요'); SFX.deny(); return; }
    if (node.free > 0) node.free--; else gainShards(-1);
    upgradeCard(+el.dataset.uid);
    SFX.gain(); hud(); autosave();
    setText(forgeText(), true);   // 남은 횟수만 바뀐다 — 다시 타자로 찍지 않는다
    renderForge();
  });
}

// 이식소 그리기
function renderImplant() {
  const cost = 2;
  if (node.done) { body(`<p class="nd-result">${icon('chip')} 「${IMPLANTS[node.done].name}」 — 이식이 끝났다. 몸 안에서 낯선 톱니가 돈다.</p>`); return; }
  const b = body(`<div class="nd-relics">${node.offer.map(id => `<button class="rw-relic implant" type="button" data-id="${id}"${RUN.shards < cost ? ' disabled' : ''}><span class="relic big r-implant implant">${icon(IMPLANTS[id].icon)}</span><b>${IMPLANTS[id].name}</b><small>${IMPLANTS[id].desc}</small><span class="price${RUN.shards >= cost ? '' : ' no'}">${icon('shard')}${cost}</span></button>`).join('')}</div>
    ${RUN.shards < cost ? `<p class="nd-sub">톱니 조각이 ${cost}개 필요해요 (지금 ${RUN.shards}개). ${chapterDef().encounters.elite.length ? '정예 · 보스 · 시험' : '사건 · 시험 · 보스'}에서 얻을 수 있어요.</p>` : '<p class="nd-sub">한 곳에서 하나만 이식할 수 있어요.</p>'}`, { keepScroll: true });
  b.addEventListener('click', async e => {
    const x = e.target.closest('.rw-relic');
    if (!x || x.disabled) return;
    const ok = await confirmBox({ title: `「${IMPLANTS[x.dataset.id].name}」${eulreul(IMPLANTS[x.dataset.id].name)} 이식할까요?`, text: `${IMPLANTS[x.dataset.id].desc} 톱니 조각 ${cost}개. 되돌릴 수 없어요.`, buttons: [{ label: '이식한다', value: true, main: true }, { label: '그만둔다', value: false }] });
    if (!ok || !alive) return;
    gainShards(-cost);
    addImplant(x.dataset.id);
    if (x.dataset.id === 'exo_frame') heal(1);
    node.done = x.dataset.id;
    SFX.save(); hud(); autosave(); renderImplant();
  });
}

function mount(holder, params = {}) {
  root = holder;
  alive = true;
  node = RUN.map.nodes[params.nodeId];
  R = makeRng(hashSeed(RUN.seed, node.id, 'node'));
  const h = HANDLERS[node.type];
  if (!h) { finishNode(); return; }
  // 감시 톱니로 들어오며 오른 경계도는 첫 HUD에서 +로 보여 준다
  shownAlert = RUN.alert - (params.alertGained > 0 ? params.alertGained : 0);
  alertWhy = params.alertGained > 0 ? (chapterDef().hunted ? '추격' : '감시 톱니') : '';
  h(params);
}
function onKey(e) {
  if (e.key === 'Escape') {
    pauseMenu().then(v => { if (v === 'settings') openSettings(); if (v === 'help') openHelp(); if (v === 'title') { autosave(); go('title'); } });
    return true;
  }
  if (e.code === 'KeyM') { toggleSound(); return true; }
  if (e.code === 'KeyH') { openHelp(); return true; }
  if (e.code === 'KeyD') { openDeck(RUN.deck); return true; }
  // 숫자 키 — 번호가 붙은 선택지(대사 장면 · 보상 화면과 같은 조작). 누르고 있어 반복되는 입력은 받지 않는다(다음 화면의 선택지까지 눌리지 않게)
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (m) {
    if (e.repeat || !root) return true;
    const b = root.querySelectorAll('#ndBody .nd-opts > .nd-opt')[+m[1] - 1];
    if (b && !b.disabled) b.click();
    return true;
  }
  return false;
}
register('node', { mount, onKey, unmount() { alive = false; if (seq) seq.stop(); seq = null; hideTip(); root = null; shownAlert = null; } });
