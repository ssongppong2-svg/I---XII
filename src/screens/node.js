// 톱니 칸 화면 — 휴식 · 상점 · 암시장 · 강화소 · 기계 이식소 · 심연 · 시험 · 골목 · 천막 · 사건 · 유물 제단
import { register, go } from '../ui/router.js';
import {
  RUN, chapterDef, dm, mods, maxHp, gainParts, gainShards, heal, hurt, addAlert, addCard, removeCard, upgradeCard, addRelic, addImplant,
} from '../game/run.js';
import { autosave } from '../game/save.js';
import { finishNode, encounterFor, cardChoices, relicChoice, TRIALS } from '../game/flow.js';
import { NODE_TYPES } from '../data/nodes.js';
import { CARDS, cardDef, canUpgrade } from '../data/cards.js';
import { RELICS, IMPLANTS, RELIC_POOL } from '../data/relics.js';
import { EVENTS } from '../data/events.js';
import { LORE } from '../data/lore.js';
import { FOES, BOSSES } from '../data/foes.js';
import { makeRng, hashSeed } from '../core/rng.js';
import { icon } from '../ui/icons.js';
import { art } from '../ui/assets.js';
import { bigCardHTML, openDeck, relicTip, openSettings, openHelp, pauseMenu, toggleSound } from '../ui/menus.js';
import { openSheet, closeSheet, confirmBox, toast, bindTips, hideTip } from '../ui/overlay.js';
import { SFX } from '../ui/sfx.js';
import { esc, eulreul, isiyeo } from '../core/util.js';

let root = null, node = null, R = null, alive = false;
let shownAlert = null, alertWhy = '';   // HUD에 마지막으로 보여 준 경계도 — 바뀌면 게이지 옆에 +/− 를 띄운다
const q = s => root.querySelector(s);

/* ── 공통 틀 ── */
function frame({ title, text = '', say = '', artHTML = '', leave: leaveText = '떠난다' }) {
  const T = NODE_TYPES[node.type];
  root.innerHTML = `<div class="nd t-${node.type}" style="--tone:${T.tone}">
    <div class="nd-art">${artHTML}</div>
    <div class="nd-panel">
      <div class="nd-kicker">${icon(T.icon)}${T.label}${node.watched && !chapterDef().hunted ? ` <em>${icon('eye')}감시 톱니</em>` : ''}</div>
      <h2 class="nd-title">${title}</h2>
      ${say ? `<div class="nd-say">${say}</div>` : ''}
      <p class="nd-text" id="ndText">${text}</p>
      <div class="nd-body" id="ndBody"></div>
      <div class="nd-foot"><button class="btn-sub" type="button" id="ndLeave">${leaveText}</button></div>
    </div>
    <div class="nd-hud" id="ndHud"></div>
  </div>`;
  q('#ndLeave').addEventListener('click', () => { SFX.click(); leave(); });
  hud();
}
// 아래로 더 있으면 끝을 흐리게 — 스크롤할 수 있다는 표시
function moreBelow(b) { b.classList.toggle('more', b.scrollHeight - b.scrollTop - b.clientHeight > 4); }
function hud() {
  if (!root || !q('#ndHud')) return;
  const mh = maxHp();
  let hearts = '';
  for (let i = 0; i < mh; i++) hearts += `<svg class="heart${i < RUN.hp ? '' : ' empty'}"><use href="#i-heart"/></svg>`;
  q('#ndHud').innerHTML = `<span class="hearts">${hearts}</span><span class="res parts">${icon('parts')}${RUN.parts}<small>부품</small></span><span class="res shard">${icon('shard')}${RUN.shards}<small>톱니 조각</small></span><span class="alert-g">${icon('eye')}<span class="bar${RUN.alert >= 70 ? ' hot' : ''}" style="--v:${RUN.alert / 100}"><i></i></span><b>${RUN.alert}</b></span>
    <button class="icon-btn" type="button" id="ndDeck">${icon('deck')}덱 ${RUN.deck.length}</button>`;
  q('#ndDeck').addEventListener('click', () => { SFX.click(); openDeck(RUN.deck); });
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
function setText(html) { const t = q('#ndText'); if (t) t.innerHTML = html; }
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
// 카드 여러 장 중 하나 (보상과 같은 모양, 화면 안에)
function cardPick(ids, { onPick, skip = '건너뛴다', title = '한 장을 고르세요', lead = '' } = {}) {
  const b = body(`${lead}<p class="nd-sub">${title}</p><div class="nd-cards">${ids.map(id => bigCardHTML(id, { pick: true, extra: `data-id="${id}"` })).join('')}</div>`);
  b.querySelector('.nd-cards').addEventListener('click', e => {
    const c = e.target.closest('.card[data-id]');
    if (!c) return;
    addCard(c.dataset.id);
    SFX.gain();
    b.querySelectorAll('.card').forEach(x => { x.classList.toggle('taken', x === c); x.classList.toggle('off', x !== c); x.style.pointerEvents = 'none'; });
    autosave(); hud();
    if (onPick) onPick(c.dataset.id);
  });
  leaveLabel(skip);
}
const relicHTML = id => `<span class="relic r-${RELICS[id].rarity}" data-tip="relic:${id}">${icon(RELICS[id].icon)}</span>`;

/* ═════════════ 칸마다 ═════════════ */
const HANDLERS = {
  // ── 휴식 (기습 확률)
  rest() {
    const ch = chapterDef();
    const h = Math.max(1, 2 + dm().restHeal + mods().restHeal);
    const p = Math.min(0.9, 0.10 + RUN.alert * 0.004 + dm().restAmbush);
    const al = ch.hunted ? 15 : 10;
    frame({ title: '무너진 벽 아래', text: `몸을 숨길 만한 자리가 있다. 잠시 눈을 붙일 수 있을 것 같다.<br><span class="dim">기습 확률 ${Math.round(p * 100)}% — 경계도가 높을수록 올라간다.</span>`, artHTML: glyph('flame'), leave: '쉬지 않고 떠난다' });
    opts([
      { label: `쉰다 — HP +${h}`, desc: `경계도 +${al} · 기습 확률 ${Math.round(p * 100)}%${RUN.hp >= maxHp() ? ' · 이미 HP가 가득 차 있다' : ''}`, on: async () => {
        addAlert(al);
        if (R.chance(p)) {
          SFX.alarm();
          body(`<p class="nd-alarm">${icon('burst')} 기습! 쉬는 사이 감시 기계가 들이닥쳤다.</p><div class="nd-opts"><button class="nd-opt main" type="button" id="ndFight"><b>맞서 싸운다</b><small>이기면 그 뒤에 쉰다 · 적이 먼저 움직인다</small></button></div>`);
          leaveLabel('');
          q('#ndLeave').hidden = true;
          q('#ndFight').addEventListener('click', () => fight(encounterFor({ id: node.id + '#amb', type: 'battle' }, { ambushed: true, sub: '휴식 중 기습' }), { after: 'rest' }));
          hud(); autosave();
          return;
        }
        const got = heal(h);
        SFX.heal(); hud(); autosave();
        body(`<p class="nd-result">${icon('flame')} 잠시 눈을 붙였다. ${got ? `HP +${got}.` : '몸은 이미 멀쩡했다.'}</p>`);
        leaveLabel('떠난다');
      } },
    ]);
  },

  // ── 상점 — "뭐 필요한 거 있어?"
  shop() {
    const mul = dm().shopMul * mods().shopMul;
    const price = base => Math.round(base * mul);
    const cardP = { common: 45, rare: 80, legend: 150 };
    const relicP = { common: 140, rare: 200 };
    if (!node.stock) {
      node.stock = {
        cards: cardChoices(R, 'shop', 5).map(id => ({ id, price: price(cardP[CARDS[id].rarity] || 60), sold: false })),
        relics: relicChoice(R, [['common', 60], ['rare', 40]], 2).map(id => ({ id, price: price(relicP[RELICS[id].rarity] || 160), sold: false })),
        removed: false,
      };
    }
    frame({ title: '상점', say: '뭐 필요한 거 있어?', artHTML: charArt('shopkeeper', 'bag') });
    renderShop();
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
    frame({ title: '강화소', text: '낡은 모루와 식지 않은 화로. 누군가 오래전 이곳에서 태엽을 벼렸다.', artHTML: glyph('anvil') });
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

  // ── 심연
  abyss() {
    frame({ title: '심연', text: '발밑이 끝없이 가라앉는다. 심연은 무엇이든 돌려준다. 아니면 앗아간다.', artHTML: glyph('vortex') });
    opts([
      { label: '발을 디딘다', desc: '좋은 일 셋 · 나쁜 일 셋 중 하나', on: () => {
        const out = R.pick(['parts', 'heal', 'relic', 'hurt', 'lose', 'curse']);
        let t = '';
        if (out === 'parts') { const n = R.int(50, 90); gainParts(n); t = `부품 ${n}개가 손에 쥐어져 있었다.`; }
        if (out === 'heal') { const n = heal(2); t = `심연이 상처를 메웠다. HP +${n}.`; }
        if (out === 'relic') { const id = relicChoice(R, [['common', 55], ['rare', 45]])[0]; if (id) { addRelic(id); t = `어둠 속에서 「${RELICS[id].name}」${eulreul(RELICS[id].name)} 건져 올렸다.`; } else { gainParts(60); t = '부품 60개가 떠올랐다.'; } }
        if (out === 'hurt') { if (RUN.hp > 1) { hurt(1); t = '무언가가 살을 베어 갔다. HP −1.'; } else { addAlert(20); t = '비명이 새어 나갔다. 경계도 +20.'; } }
        if (out === 'lose') { const n = Math.min(RUN.parts, R.int(30, 50)); gainParts(-n); t = `주머니가 가벼워졌다. 부품 −${n}.`; }
        if (out === 'curse') { addCard('rust'); t = '녹이 스며들었다. 저주 카드 「녹」이 덱에 들어갔다.'; }
        (['hurt', 'lose', 'curse'].includes(out) ? SFX.hurt : SFX.gain)();
        hud(); autosave();
        body(`<p class="nd-result">${icon('vortex')} ${t}</p>`);
        leaveLabel('떠난다');
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
    const kind = node.alley;
    if (kind === 'hide') {
      frame({ title: '숨을 틈', text: '좁은 골목 안쪽, 감시가 닿지 않는 틈이 있다. 잠시 숨을 죽이면 흔적이 흐려질 것이다.', artHTML: glyph('alley') });
      opts([{ label: '숨는다 — 경계도 −30', desc: ch.hunted ? '추격대에게 들킬 수도 있다 (30%)' : '감시의 눈이 멀어진다', on: () => {
        if (ch.hunted && R.chance(0.3)) { SFX.alarm(); body(`<p class="nd-alarm">${icon('burst')} 들켰다!</p>`); setTimeout(() => fight(encounterFor({ id: node.id + '#found', type: 'battle' }, { sub: '골목 — 발각' })), 900); return; }
        addAlert(-30); SFX.cool(); hud(); autosave();
        body(`<p class="nd-result">${icon('eye')} 숨을 죽였다. 경계도가 내려갔다 (지금 ${RUN.alert}).</p>`);
      } }]);
    } else if (kind === 'narrow') {
      frame({ title: '좁은 골목', text: '양옆 벽이 바짝 붙은 골목. 기계들이 길을 막고 있다 — 판의 양 끝 세로줄이 막힌 채로 싸운다.<br><span class="dim">피할 곳이 적은 대신 부품 보상 ×1.5</span>', artHTML: glyph('alley'), leave: '돌아간다' });
      opts([{ label: '뚫고 지나간다', desc: '좁은 판 전투', on: () => fight(encounterFor({ id: node.id + '#narrow', type: 'battle', enc: { foes: R.pick(chapterDef().encounters.easy).slice() } }, { narrow: true, partsMul: 1.5, sub: '좁은 골목' })) }]);
    } else if (kind === 'deal') {
      frame({ title: '뒷골목 거래', say: '카드 한 장을 내놓으면, 더 좋은 걸 주지.', text: '두건을 깊이 눌러쓴 거래상이 손바닥을 펼친다. 얼굴은 보이지 않는다.', artHTML: glyph('mask') });
      opts([{ label: '카드 한 장을 내놓는다', desc: '덱에서 한 장을 없애고, 희귀 · 전설 카드 3장 중 1장을 받는다', on: () => pickFromDeck({ title: '내놓을 카드', filter: c => CARDS[c.id].rarity !== 'curse' || true, onPick: uid => {
        const c = removeCard(uid);
        SFX.coin(); hud(); autosave();
        setText(`「${cardDef(c).name}」${eulreul(cardDef(c).name)} 내주었다. 거래상이 품에서 카드 세 장을 꺼낸다.`);
        cardPick(cardChoices(R, 'high', 3), { skip: '떠난다', title: '하나를 고르세요' });
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
    frame({ title: '신도들의 천막', say: `“${esc(line)}”`, text: `당신을 알아본 신도들이 무릎을 꿇는다. "${esc(RUN.name)}${isiyeo(RUN.name)}, 무엇을 드릴까요."`, artHTML: charArt('believer', 'tent') });
    const next = nextEliteBoss();
    opts([
      { label: '기도 — HP +2', desc: `지금 ${RUN.hp} / ${maxHp()}`, on: () => { const n = heal(2); SFX.heal(); hud(); autosave(); body(`<p class="nd-result">${icon('chalice')} 신도들의 기도가 몸을 감쌌다. HP +${n}.</p>`); } },
      { label: '성물 — 사이비 카드 한 장', desc: '신도들이 간직해 온 기도문 세 장 중 하나', on: () => { setText('신도들이 낡은 기도문을 조심스레 펼쳐 보인다.'); cardPick(cardChoices(R, 'cult', 3), { skip: '떠난다' }); } },
      { label: '속삭임 — 앞길의 정보', desc: '다음 정예 · 보스에 대해 듣고 경계도 −15', on: () => { addAlert(-15); hud(); autosave(); SFX.page(); body(`<div class="nd-result">${next}</div>`); } },
    ]);
  },

  // ── 사건
  event() {
    const E = EVENTS[node.event] || Object.values(EVENTS)[0];
    frame({ title: E.title, text: E.text, artHTML: glyph(E.icon || 'help') });
    const pending = [];
    const G = {
      parts: n => gainParts(n), shards: n => gainShards(n), heal: n => heal(n), hurt: n => hurt(n), alert: n => addAlert(n),
      chance: p => R.chance(p), hp: () => RUN.hp, partsNow: () => RUN.parts,
      curse: id => addCard(id),
      canUpgrade: () => RUN.deck.some(canUpgrade),
      upgradeRandom: () => { const c = R.pick(RUN.deck.filter(canUpgrade)); upgradeCard(c.uid); return cardDef(c).name; },
      relic: tier => { const id = relicChoice(R, [[tier, 100]])[0]; if (!id) { gainParts(50); return '부품 50'; } addRelic(id); return RELICS[id].name; },
      removePick: () => pending.push({ t: 'remove' }),
      cardPick: tier => pending.push({ t: 'cards', tier }),
      fight: enc => pending.push({ t: 'fight', enc }),
    };
    const list = E.options.map(o => ({ label: o.label, desc: o.desc, dis: o.cond ? !o.cond(G) : false, on: () => {
      const text = o.run(G);
      hud(); autosave();
      const lead = `<p class="nd-result">${esc(text)}</p>`;
      q('#ndLeave').hidden = false;
      leaveLabel('떠난다');
      const p = pending.shift();
      if (!p) { body(lead); return; }
      // 이어지는 일 — 결과 글은 위에 남겨 두고 그 아래에
      if (p.t === 'cards') { cardPick(cardChoices(R, p.tier, 3), { skip: '떠난다', lead }); return; }
      if (p.t === 'remove') {
        const pick = () => pickFromDeck({ title: '맡길 카드 (덱에서 없어짐)', onPick: uid => {
          const c = removeCard(uid); hud(); autosave();
          body(`${lead}<p class="nd-result">「${esc(cardDef(c).name)}」${eulreul(cardDef(c).name)} 맡겼다.</p>`);
        } });
        body(`${lead}<div class="nd-opts"><button class="nd-opt main" type="button" id="ndRemove"><b>맡길 카드를 고른다</b><small>덱에서 한 장이 없어진다 · 그냥 떠나도 된다</small></button></div>`);
        q('#ndRemove').addEventListener('click', () => { SFX.click(); pick(); });
        pick();
        return;
      }
      if (p.t === 'fight') {
        body(`${lead}<div class="nd-opts"><button class="nd-opt main" type="button" id="ndFight"><b>싸운다</b></button></div>`);
        q('#ndLeave').hidden = true;
        q('#ndFight').addEventListener('click', () => fight(encounterFor({ id: node.id + '#ev', type: 'battle', enc: { foes: p.enc.foes } }, { bonusParts: p.enc.bonusParts || 0, sub: E.title })));
      }
    } }));
    opts(list);
    q('#ndLeave').hidden = true;   // 사건은 하나를 골라야 떠날 수 있다
  },

  // ── 유물 제단 — 2개 중 1개
  shrine() {
    if (!node.offer) node.offer = relicChoice(R, [['common', 55], ['rare', 45]], 2);
    frame({ title: '유물 제단', text: '먼지 쌓인 제단 위에 두 개의 물건이 놓여 있다. 하나를 집으면 다른 하나는 바스러질 것이다.', artHTML: glyph('gem') });
    const b = body(`<div class="nd-relics">${node.offer.map(id => `<button class="rw-relic" type="button" data-id="${id}"><span class="relic big r-${RELICS[id].rarity}">${icon(RELICS[id].icon)}</span><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></button>`).join('')}</div>`);
    b.addEventListener('click', e => {
      const x = e.target.closest('.rw-relic');
      if (!x || x.disabled) return;
      addRelic(x.dataset.id); SFX.gain(); hud(); autosave();
      b.querySelectorAll('.rw-relic').forEach(y => { y.disabled = true; y.classList.toggle('taken', y === x); });
      setText(`「${RELICS[x.dataset.id].name}」${eulreul(RELICS[x.dataset.id].name)} 집었다. 다른 하나는 먼지가 되었다.`);
    });
  },
};

// 천막 속삭임 — 다음 정예 · 보스
function nextEliteBoss() {
  const ch = chapterDef();
  const map = RUN.map;
  const reach = new Set(), stack = [...map.nodes[RUN.pos].next];
  while (stack.length) { const id = stack.pop(); if (reach.has(id)) continue; reach.add(id); stack.push(...map.nodes[id].next); }
  const elites = [...reach].map(id => map.nodes[id]).filter(n => n.type === 'elite');
  const lines = [];
  const TIPS = {
    gatekeeper: '수문장은 정면의 방패판이 단단합니다. 옆이나 뒤로 도세요. 앞 두 줄을 한꺼번에 내려찍으니 거리를 두시고요.',
    alpha: '사냥개 우두머리는 두 칸씩 달려옵니다. 바로 옆에 서면 물립니다 — 대각선도요. 무리를 먼저 흩으소서.',
  };
  const seen = new Set();
  for (const n of elites) {
    const e = ch.encounters.elite[(n.eliteIdx || 0) % ch.encounters.elite.length];
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    lines.push(`<p><b>정예 · ${FOES[e.foes[0]].name}</b> — ${TIPS[e.id] || FOES[e.foes[0]].desc}</p>`);
  }
  const bd = BOSSES[ch.encounters.boss.boss];
  lines.push(`<p><b>보스 · ${bd.name}</b> — 루프마다 턴 공격 하나를 예고하고, 마지막 행동 뒤에 쏩니다. 「역류 주입」 같은 교란으로 과부하시키면 4코스트 동안 멈춥니다.</p>`);
  return lines.join('');
}

// 상점 그리기
function renderShop() {
  const s = node.stock;
  const canBuy = p => RUN.parts >= p;
  const b = body(`<div class="shop">
    <div class="shop-cards">${s.cards.map((c, i) => `<div class="shop-item${c.sold ? ' sold' : ''}">${bigCardHTML(c.id, { pick: !c.sold, extra: `data-ci="${i}"` })}<span class="price${canBuy(c.price) ? '' : ' no'}">${icon('parts')}${c.price}</span></div>`).join('')}</div>
    <div class="shop-side">
      ${s.relics.map((r, i) => `<button class="shop-relic${r.sold ? ' sold' : ''}" type="button" data-ri="${i}"${r.sold ? ' disabled' : ''}>${relicHTML(r.id)}<span><b>${RELICS[r.id].name}</b><small>${RELICS[r.id].desc}</small></span><span class="price${canBuy(r.price) ? '' : ' no'}">${icon('parts')}${r.price}</span></button>`).join('')}
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
function renderForge() {
  const free = node.free;
  const up = RUN.deck.filter(canUpgrade);
  setText(`낡은 모루와 식지 않은 화로. <b>무료 강화 ${free}번</b> 남음 · 그 뒤로는 톱니 조각 1개당 한 장 (지금 ${RUN.shards}개).`);
  if (!up.length) { body('<p class="nd-result">강화할 수 있는 카드가 없어요.</p>'); return; }
  const b = body(`<p class="nd-sub">강화된 모습과 바뀌는 점을 보여 줘요. 누르면 강화해요.</p><div class="deck-grid pick">${up.map(c => bigCardHTML(Object.assign({}, c, { up: 1 }), { pick: true, mid: true, showUp: true, extra: `data-uid="${c.uid}"` })).join('')}</div>`, { keepScroll: true });
  b.addEventListener('click', e => {
    const el = e.target.closest('.card[data-uid]');
    if (!el) return;
    if (node.free <= 0 && RUN.shards <= 0) { toast('톱니 조각이 없어요'); SFX.deny(); return; }
    if (node.free > 0) node.free--; else gainShards(-1);
    upgradeCard(+el.dataset.uid);
    SFX.gain(); hud(); autosave(); renderForge();
  });
}

// 이식소 그리기
function renderImplant() {
  const cost = 2;
  if (node.done) { body(`<p class="nd-result">${icon('chip')} 「${IMPLANTS[node.done].name}」 — 이식이 끝났다. 몸 안에서 낯선 톱니가 돈다.</p>`); return; }
  const b = body(`<div class="nd-relics">${node.offer.map(id => `<button class="rw-relic implant" type="button" data-id="${id}"${RUN.shards < cost ? ' disabled' : ''}><span class="relic big r-implant implant">${icon(IMPLANTS[id].icon)}</span><b>${IMPLANTS[id].name}</b><small>${IMPLANTS[id].desc}</small><span class="price${RUN.shards >= cost ? '' : ' no'}">${icon('shard')}${cost}</span></button>`).join('')}</div>
    ${RUN.shards < cost ? `<p class="nd-sub">톱니 조각이 ${cost}개 필요해요 (지금 ${RUN.shards}개). 정예 · 보스 · 시험에서 얻을 수 있어요.</p>` : '<p class="nd-sub">한 곳에서 하나만 이식할 수 있어요.</p>'}`, { keepScroll: true });
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
  h();
}
function onKey(e) {
  if (e.key === 'Escape') {
    pauseMenu().then(v => { if (v === 'settings') openSettings(); if (v === 'help') openHelp(); if (v === 'title') { autosave(); go('title'); } });
    return true;
  }
  if (e.code === 'KeyM') { toggleSound(); return true; }
  if (e.code === 'KeyD') { openDeck(RUN.deck); return true; }
  return false;
}
register('node', { mount, onKey, unmount() { alive = false; hideTip(); root = null; shownAlert = null; } });
