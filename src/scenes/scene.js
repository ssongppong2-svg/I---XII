// 대사 장면 — 프롤로그 · 정예/보스 이야기 · 재귀 · 사건
// 대사 = { who, face?, name?, vo?, text } — text는 글 또는 ctx => 글. name을 적으면 그 이름으로 말한다 · vo = 모습 없이 목소리만(대본의 「스탠딩 없음」)
// 선택지 = { choice: [{ label, desc?, when?, cond?, lack?, then }] } — when이 거짓이면 숨기고, cond가 거짓이면 흐리게 막는다(lack = 이유, 글 또는 G => 글)
// 갈림 = { if: ctx => bool, then: [...], else: [...] } · 운 = { roll: 0.5, win: [...], lose: [...] }
// 효과 = { act: ctx => {} } · 결과 한 줄 = { after: '…' } (장면이 끝난 뒤 사건 화면에 남는 글)
// 챕터 카드 = { card: { num, title, sub? } } · 이름 카드 = { card: { kick, title, sub } } (보스 이름 등)
// 이름 입력 = { input: 'name', prompt, sub, def } · 연출 = { tint, place, fx, exit } · 조건 = { when: ctx => bool }
// 배경 바꾸기 = { bg: '그림 이름' | { slot, base } | null } — slot 그림이 있으면 slot, 없으면 base
// 한 장 그림 = { cg: '그림 이름' | null } · 권능 문자판 = { dial: 'I' | null, pulse: 'II' }
// 멈춤 = { wait: ms } (누르면 바로 넘어간다) · 대사창 비우기 = { blank: true }
// 종이 기록 = { paper: '제목', text, emblem?: 'I' } — 낡은 종이 패널 위에 글 (대사창 대신)
// 권한 패널 = { panel: '제목', text, tone?: 'deny' } — 기계의 화면(설비 조작 · 철회된 권한). 종이 기록처럼 누르면 넘어간다
// 상태 한 줄 = { sys: '글' } — 위쪽에 잠깐 떴다 사라진다(멈추지 않는다) · 배경 소리 = { amb: 'work' | 'fire' | 'wind' | 'hum' | 'street' | 'drip' | null }
// 주인공 자세 = { hero: 'low' | '' } (스탠딩을 조금 낮춘다) · 물러나기 = { exit: 'hero' | 'guest'(손님 모두) | 'boss' | 인물 이름 }
// 문자판 흔들림 = { dial: 'I', flicker: true } · 작은 그림 = { cg: '그림', small: true } · 보스 화면 손상 = { bossDmg: 1 | 2 | 0 }
// 손님 칸은 둘 — 세 사람이 이야기할 때 둘째 손님은 가운데에. 새로 말하는 사람은 빈 칸, 없으면 가장 오래 말 안 한 사람 자리에 선다
// ctx = playScene(…, { ctx })로 넘긴 도우미 (사건이면 부품 · 경계도 · 깃발 등 — screens/node.js)
import { $, el, esc, iga, eulreul, eunneun, irago, ah, iyeo, isiyeo, iya, gwawa, euro, RM } from '../core/util.js';
import { SET, AUTO_SPEED } from '../core/settings.js';
import { typeInto } from '../ui/typewriter.js';
import { SFX } from '../ui/sfx.js';
import { art, faceUrl, load, bgImgHTML } from '../ui/assets.js';
import { icon } from '../ui/icons.js';
import { foeArtHTML } from '../ui/foeart.js';
import { FOES } from '../data/foes.js';
import { RUN } from '../game/run.js';

// 조사: {name|이라고} 처럼 받침이 있을 때의 꼴을 적으면 받침에 맞춰 바꾼다
const PARTICLE = { '이라고': irago, '은': eunneun, '이': iga, '을': eulreul, '아': ah, '이여': iyeo, '이시여': isiyeo, '이야': iya, '과': gwawa, '으로': euro };
export function fmt(text, name) {
  const nm = name || (RUN && RUN.name) || '???';
  return esc(text)
    .replace(/\{name\|([^}]+)\}/g, (_, p) => PARTICLE[p] ? PARTICLE[p](nm) : p)
    .replace(/\{name\}/g, `<b class="nm">${esc(nm)}</b>`);
}

const SPEAKERS = {
  nar: { name: '', cls: 'nar' },
  hero: { pt: 'hero' },
  voice: { name: '신도들의 속삭임', pt: 'voice', cls: 'voice' },
  boss: { pt: 'boss', cls: 'boss' },
  believer: { name: '이름 없는 신도', pt: 'guest', cls: 'voice', art: 'believer' },
  merchant: { name: '상점 주인', pt: 'guest', cls: 'merchant', art: 'shopkeeper' },
  black: { name: '암시장 상인', pt: 'guest', cls: 'black', art: 'blackmarket' },
  // 모습 없이 목소리만 (이름은 { name } 으로 바꿀 수 있다)
  blackv: { name: '암시장 상인의 목소리', cls: 'black', voice: 'barnett' },
  human: { name: '인간의 목소리', cls: 'human', voice: 'human' },
  broadcast: { name: '녹음 방송', cls: 'broadcast', voice: 'machine' },
  announce: { name: '자동 안내', cls: 'broadcast', voice: 'machine' },
  unknown: { name: '알 수 없는 목소리', cls: 'unknown', voice: 'unknown' },
};
// 권능 문자판 — 열두 시 가운데 lit만 켜지고, pulse는 테두리만 잠깐 반응
const RN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function dialSVG(lit = 'I', pulse = '') {
  const pos = i => { const a = (i + 1) / 12 * Math.PI * 2 - Math.PI / 2; return [100 + Math.cos(a) * 72, 100 + Math.sin(a) * 72]; };
  const [hx, hy] = pos(RN.indexOf(lit) >= 0 ? RN.indexOf(lit) : 0);
  const marks = RN.map((n, i) => { const [x, y] = pos(i); return `<g class="dn${n === lit ? ' on' : ''}${n === pulse ? ' pulse' : ''}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15"/><text x="${x.toFixed(1)}" y="${(y + 1).toFixed(1)}">${n}</text></g>`; }).join('');
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><circle class="dring" cx="100" cy="100" r="95"/><circle class="dring2" cx="100" cy="100" r="50"/><line class="dhand" x1="100" y1="100" x2="${(100 + (hx - 100) * 0.62).toFixed(1)}" y2="${(100 + (hy - 100) * 0.62).toFixed(1)}"/><circle class="dcore" cx="100" cy="100" r="7"/>${marks}</svg>`;
}
const NAME_SUGGEST = ['크로노스', '아르케', '엘리오스', '호라', '제로', '시계공', '카이로스', '루멘', '에온', '헤임'];

const SC = { queue: [], full: '', plain: '', tw: null, who: 'nar', typing: false, choosing: null, inputting: false, carding: false, waiting: false, auto: false, log: [], onEnd: null, autoT: 0, cardT: 0, placeT: 0, waitT: 0, sysT: 0, bossName: '대형 감시기계', onName: null, ctx: null, cast: {}, onChoice: null,
  slot: { a: null, b: null }, slotT: { a: 0, b: 0 }, clock: 0 };
// 손님 칸 — a: 오른쪽(첫 손님) · b: 가운데(셋이 이야기할 때)
const SLOT_EL = { a: 'ptGuest', b: 'ptGuest2' };
let dom = null;
const q = s => dom.querySelector(s);
// ctx를 따로 넘기지 않은 장면(정예 · 보스 이야기)도 사건에서 세운 깃발은 볼 수 있다 — { when: G => G.has('pup') }
// 이야기 전투의 승리 대사처럼 사건 도우미가 없는 장면에서도 깃발 · 목표는 쓸 수 있다
const BASE_CTX = {
  has: k => !!(RUN && RUN.flags && (RUN.flags.ev || {})[k]),
  flag(k, v = true) { if (RUN) RUN.flags.ev = Object.assign({}, RUN.flags.ev, { [k]: v }); },
  goal(t) { if (RUN) RUN.goal = t; },
};
const ctxOf = () => SC.ctx || BASE_CTX;

export function initScene() {
  dom = el(`<div class="scene" id="scene" hidden>
    <div class="sc-wrap">
      <div class="sc-bg" id="scBg" aria-hidden="true"></div>
      <div class="sc-notes" id="scNotes" aria-live="polite"></div>
      <div class="sc-tools"><button type="button" id="scLogBtn">로그</button><button type="button" id="scAutoBtn">자동</button><button type="button" id="scSkipBtn">건너뛰기 ▸▸</button></div>
      <div class="sc-place" id="scPlace" hidden></div>
      <div class="sc-sys" id="scSys" hidden></div>
      <div class="pt pt-voice" id="ptVoice"><div class="pt-art" id="ptVoiceArt"></div></div>
      <div class="pt pt-hero" id="ptHero"><div class="pt-art" id="ptHeroArt"></div></div>
      <div class="pt pt-guest pt-g2" id="ptGuest2"><div class="pt-art" id="ptGuest2Art"></div></div>
      <div class="pt pt-guest" id="ptGuest"><div class="pt-art" id="ptGuestArt"></div></div>
      <div class="sc-stage">
        <div class="pt pt-boss" id="ptBoss"><div class="mon"><div class="mon-screen" id="ptBossArt"></div><div class="mon-bar"><i class="rec"></i><span id="ptBossBar">감시망 방송</span></div></div></div>
        <div class="sc-choices" id="scChoices" hidden></div>
        <form class="sc-input" id="scInput" hidden autocomplete="off">
          <b id="scInPrompt"></b><small id="scInSub"></small>
          <div class="sc-in-row"><input id="scInName" maxlength="8" spellcheck="false" placeholder="이름 (1~8자)"><button type="button" class="btn-sub" id="scInSuggest">추천</button></div>
          <p class="sc-in-err" id="scInErr"></p>
          <button type="submit" class="btn-main" id="scInOk">이 이름으로</button>
        </form>
      </div>
      <div class="dbox" id="dbox"><div class="dname" id="dname" hidden></div><p class="dtext" id="dtext"></p><span class="dnext" aria-hidden="true"></span></div>
      <div class="sc-card" id="scCard" hidden></div>
      <div class="sc-cg" id="scCg" hidden></div>
      <div class="sc-dial" id="scDial" hidden></div>
      <div class="sc-paper" id="scPaper" hidden><b id="scPaperT"></b><div class="sp-emb" id="scPaperE"></div><p id="scPaperX"></p></div>
      <div class="sc-logp" id="scLogPanel" hidden><div class="sheet-head"><h3>대사 기록</h3><button class="icon-btn x" type="button" id="scLogClose" aria-label="닫기">×</button></div><div class="lg-list" id="scLogList"></div></div>
    </div></div>`);
  $('#app').appendChild(dom);
  dom.addEventListener('click', e => {
    if (e.target.closest('.sc-tools, .sc-logp, .sc-input')) return;
    const choice = e.target.closest('.sc-choices button');
    if (choice) { chooseOption(+choice.dataset.i); return; }
    if (e.target.closest('.sc-choices')) return;
    advance();
  });
  q('#scLogBtn').addEventListener('click', e => { e.currentTarget.blur(); toggleLog(true); });
  q('#scLogClose').addEventListener('click', () => toggleLog(false));
  q('#scAutoBtn').addEventListener('click', e => { e.currentTarget.blur(); toggleAuto(); });
  q('#scSkipBtn').addEventListener('click', e => { e.currentTarget.blur(); skip(); });
  q('#scInput').addEventListener('submit', e => { e.preventDefault(); submitName(); });
  q('#scInSuggest').addEventListener('click', () => { const i = q('#scInName'); i.value = NAME_SUGGEST[Math.floor(Math.random() * NAME_SUGGEST.length)]; i.focus(); SFX.click(); });
  q('#scInName').addEventListener('keydown', e => e.stopPropagation());
}

export const sceneOpen = () => dom && !dom.hidden;

// 대사 장면 재생 — 끝나면 풀리는 Promise
// opt: { bossName, bossArt, bossBar, onName(name), ctx, cast: { 이름: { name, art?, icon?, foe? } }, bg: 배경 그림 이름, onChoice(label) }
export function playScene(script, opt = {}) {
  return new Promise(res => {
    Object.assign(SC, { queue: (script || []).slice(), log: [], onEnd: res, choosing: null, carding: false, typing: false, inputting: false, bossName: opt.bossName || '대형 감시기계', onName: opt.onName || null,
      ctx: opt.ctx || null, cast: opt.cast || {}, onChoice: opt.onChoice || null });
    // 배경 그림 (사건) — 없으면 아래 화면이 어둡게 비친다
    const bk = bgKey(opt.bg);
    const bg = bk ? bgImgHTML(bk) : '';
    q('#scBg').innerHTML = bg;
    q('#scBg').dataset.key = bg ? bk : '';
    dom.classList.toggle('has-bg', !!bg);
    q('#scNotes').innerHTML = '';
    for (const id of ['scCg', 'scDial', 'scPaper']) q('#' + id).hidden = true;
    q('#scCg').innerHTML = ''; SC.papering = false;
    for (const id of ['ptHero', 'ptGuest', 'ptGuest2', 'ptBoss', 'ptVoice']) q('#' + id).classList.remove('in', 'on', 'off', 'swap', 'low');
    q('#ptGuestArt').dataset.who = ''; q('#ptGuest2Art').dataset.who = '';
    SC.slot = { a: null, b: null }; SC.slotT = { a: 0, b: 0 };
    q('#ptBoss').dataset.dmg = '';
    q('#scSys').hidden = true;
    // 초상화 그림
    const hu = faceUrl('idle');
    q('#ptHero').classList.toggle('img', !!hu);
    q('#ptHeroArt').innerHTML = hu ? '<img id="ptHeroImg" alt="" draggable="false">' : '<div class="pt-sil"></div>';
    const bossArt = opt.bossArt ? art(opt.bossArt) : null;
    q('#ptBossArt').innerHTML = bossArt ? `<img class="full" src="${bossArt}" alt="" draggable="false">` : '<div class="mon-eye"></div>';
    q('#ptBossBar').textContent = opt.bossBar || '감시망 방송';
    const bel = art('believer');
    q('#ptVoiceArt').innerHTML = bel ? `<img src="${bel}" alt="" draggable="false">` : '';
    setHeroFace('idle');
    dom.dataset.tint = '';
    dom.classList.remove('duo', 'trio', 'solo-b');
    q('#scPlace').hidden = true;
    q('#dname').hidden = true;
    q('#dtext').innerHTML = '';
    q('#dbox').className = 'dbox blank';
    SC.waiting = false; clearTimeout(SC.waitT);
    q('#scChoices').hidden = true;
    q('#scInput').hidden = true;
    q('#scLogPanel').hidden = true;
    q('#scCard').hidden = true;
    q('#scAutoBtn').classList.toggle('on', SC.auto);
    dom.hidden = false;
    $('#app').classList.add('in-scene');
    next();
  });
}

// 보이지 않는 줄 — 갈림 · 운 · 효과 · 결과 한 줄. 처리했으면 true (건너뛰기에서도 똑같이 쓴다)
function silent(step) {
  const ctx = ctxOf();
  if (step.if) { SC.queue.unshift(...((step.if(ctx) ? step.then : step.else) || [])); return true; }
  if (step.roll !== undefined) {
    const ok = ctx.chance ? ctx.chance(step.roll) : Math.random() < step.roll;
    SC.queue.unshift(...((ok ? step.win : step.lose) || []));
    return true;
  }
  if (step.act) step.act(ctx);
  if (step.after !== undefined && SC.ctx) SC.ctx.afterText = typeof step.after === 'function' ? step.after(ctx) : step.after;
  return false;
}

// 무대 바꾸기 — 배경 · 한 장 그림 · 권능 문자판 (건너뛰기에서도 똑같이)
function stage(step) {
  if (step.bg !== undefined) {
    const key = bgKey(step.bg);
    const cur = q('#scBg').dataset.key || '';
    if (key !== cur) {
      const bg = key ? bgImgHTML(key, cur ? 'fade' : '') : '';
      q('#scBg').innerHTML = bg;
      q('#scBg').dataset.key = bg ? key : '';
      dom.classList.toggle('has-bg', !!bg);
    }
  }
  if (step.cg !== undefined) {
    const u = step.cg && art(step.cg);
    q('#scCg').innerHTML = u ? `<img src="${u}" alt="" draggable="false">` : '';
    q('#scCg').hidden = !u;
  }
  if (step.dial !== undefined) {
    q('#scDial').innerHTML = step.dial ? dialSVG(step.dial, step.pulse || '') : '';
    q('#scDial').hidden = !step.dial;
    q('#scDial').classList.toggle('flicker', !!step.flicker);
  }
  if (step.cg !== undefined) q('#scCg').classList.toggle('small', !!step.small);
  if (step.hero !== undefined) q('#ptHero').classList.toggle('low', step.hero === 'low');
  if (step.bossDmg !== undefined) q('#ptBoss').dataset.dmg = step.bossDmg || '';
  if (step.amb !== undefined) SFX.amb(step.amb);
}
// 배경 이름 — { slot, base }면 slot 그림이 있을 때 slot (이야기 칸 전용 배경 bg-st-…)
const bgKey = b => (!b ? '' : typeof b === 'string' ? b : art(b.slot) ? b.slot : b.base || '');
function blankBox() {
  if (SC.tw) SC.tw.stop();
  q('#dtext').innerHTML = ''; q('#dname').hidden = true;
  q('#dbox').classList.add('blank');
}
function hidePaper() {
  if (!SC.papering) return;
  SC.papering = false;
  q('#scPaper').hidden = true;
  q('#scPaper').classList.remove('panel', 'deny');
  q('#dbox').classList.remove('paper');
}

function next() {
  clearTimeout(SC.autoT);
  hidePaper();
  for (;;) {
    const step = SC.queue.shift();
    if (!step) { end(); return; }
    if (step.when && !step.when(ctxOf())) continue;
    if (silent(step)) continue;
    stage(step);
    if (step.tint !== undefined) dom.dataset.tint = step.tint;
    if (step.place) showPlace(step.place);
    if (step.sys) showSys(step.sys);
    if (step.fx) sceneFx(step.fx);
    if (step.exit) { exitPortrait(step.exit); }
    if (step.blank) blankBox();
    if (step.card) { showCard(step.card); return; }
    if (step.wait) { waitFor(step.wait); return; }
    if (step.input) { showInput(step); return; }
    if (step.choice) { showChoice(step.choice); return; }
    if (step.paper || step.panel) { showPaper(step); return; }
    if (step.text) { showLine(step); return; }
  }
}

function showPlace(text) {
  const p = q('#scPlace');
  p.textContent = text; p.hidden = false;
  p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  clearTimeout(SC.placeT);
  SC.placeT = setTimeout(() => { p.hidden = true; }, 3000);
}
// 상태 한 줄 — 기계의 표시 (외부 송신 격리 등). 멈추지 않고 잠깐 떴다 사라진다
function showSys(text) {
  const p = q('#scSys');
  p.textContent = text; p.hidden = false;
  p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
  clearTimeout(SC.sysT);
  SC.sysT = setTimeout(() => { p.hidden = true; }, 4200);
  SFX.panel();
}
function sceneFx(kind) {
  const fl = cls => { dom.classList.remove(cls); void dom.offsetWidth; dom.classList.add(cls); setTimeout(() => dom.classList.remove(cls), 820); };
  if (kind === 'shake') { if (SET.shake) { const w = q('.sc-wrap'); w.classList.remove('sc-shake'); void w.offsetWidth; w.classList.add('sc-shake'); setTimeout(() => w.classList.remove('sc-shake'), 480); } SFX.boom(); }
  if (kind === 'flash') { fl('sc-flash'); SFX.warn(); }
  if (kind === 'red') { fl('sc-red'); SFX.hurt(); }
  if (kind === 'tick') SFX.tick();
  if (kind === 'shot') { fl('sc-flash'); SFX.nail(); if (SET.shake) { const w = q('.sc-wrap'); w.classList.remove('sc-shake'); void w.offsetWidth; w.classList.add('sc-shake'); setTimeout(() => w.classList.remove('sc-shake'), 480); } }
  if (kind === 'bell') SFX.bell();
  if (kind === 'gears') SFX.gears();
  if (kind === 'wheel') SFX.wheel();
  if (kind === 'clocks') SFX.clocks();
  if (kind === 'beat2') SFX.beat2();
  if (kind === 'door') { SFX.door(); if (SET.shake) { const w = q('.sc-wrap'); w.classList.remove('sc-shake'); void w.offsetWidth; w.classList.add('sc-shake'); setTimeout(() => w.classList.remove('sc-shake'), 480); } }
  if (kind === 'clank') SFX.clank();
  if (kind === 'wind') SFX.wind();
  if (kind === 'steps') SFX.steps();
  // 1장 대본 연출 — 소리만 (흔들림 · 번쩍임이 붙은 것은 따로)
  if (['rumble', 'tickodd', 'cloth', 'breath', 'bells', 'whistle', 'announce', 'lights', 'murmur', 'train', 'sign', 'clink', 'powerdown'].includes(kind)) SFX[kind]();
  if (kind === 'shutter') { SFX.shutter(); fl('sc-flicker'); if (SET.shake) { const w = q('.sc-wrap'); w.classList.remove('sc-shake'); void w.offsetWidth; w.classList.add('sc-shake'); setTimeout(() => w.classList.remove('sc-shake'), 480); } }
  if (kind === 'collapse') { SFX.collapse(); fl('sc-red'); if (SET.shake) { const w = q('.sc-wrap'); w.classList.remove('sc-shake', 'sc-shake-l'); void w.offsetWidth; w.classList.add('sc-shake-l'); setTimeout(() => w.classList.remove('sc-shake-l'), 900); } }
  if (kind === 'crack') { SFX.crack(); fl('sc-flash'); }
  if (kind === 'hush') SFX.amb(null);   // 소리 작아짐 — 깔린 소리를 거둔다
  // 붉은 감시 빛 · 흰 탐조등이 화면을 한 번 훑는다
  if (kind === 'sweep' || kind === 'search') {
    const sw = document.createElement('div');
    sw.className = 'sc-sweep' + (kind === 'search' ? ' white' : '');
    q('.sc-wrap').appendChild(sw);
    setTimeout(() => sw.remove(), 2900);
    SFX.beam();
  }
}
// 멈춤 — 정해진 시간이 지나거나 누르면 다음으로
function waitFor(ms) {
  SC.waiting = true;
  clearTimeout(SC.waitT);
  SC.waitT = setTimeout(() => { if (!SC.waiting) return; SC.waiting = false; next(); }, RM.matches ? Math.min(ms, 700) : ms);
}
// 물러나기 — 'hero' · 'boss' · 'guest'(손님 모두) · 인물 이름(그 사람만)
function exitPortrait(which) {
  if (which === 'hero' || which === 'boss') { q(which === 'hero' ? '#ptHero' : '#ptBoss').classList.remove('in', 'on'); updateDuo(); return; }
  for (const s of ['a', 'b']) {
    if (which !== 'guest' && SC.slot[s] !== which) continue;
    q('#' + SLOT_EL[s]).classList.remove('in', 'on');
    SC.slot[s] = null;
  }
  updateDuo();
}
// 손님이 하나면 오른쪽, 둘이면 가운데 · 오른쪽 (가운데 칸만 남으면 오른쪽 자리로 옮겨 선다)
function updateDuo() {
  const a = q('#ptGuest').classList.contains('in'), b = q('#ptGuest2').classList.contains('in');
  dom.classList.toggle('duo', a || b);
  dom.classList.toggle('trio', a && b);
  dom.classList.toggle('solo-b', b && !a);
}
function slotOf(who) { return SC.slot.a === who ? 'a' : SC.slot.b === who ? 'b' : null; }
function takeSlot(who) {
  let s = slotOf(who);
  if (!s) s = !SC.slot.a ? 'a' : !SC.slot.b ? 'b' : (SC.slotT.a <= SC.slotT.b ? 'a' : 'b');
  SC.slot[s] = who;
  SC.slotT[s] = ++SC.clock;
  return s;
}

// 말하는 사람 — 장면마다 따로 부른 사람(cast) → 늘 있는 사람 → 적 이름
function speakerOf(who) {
  const c = SC.cast[who];
  if (c) return c.foe ? { name: c.name || FOES[c.foe].name, pt: 'guest', cls: 'foe', foe: c.foe, voice: 'machine' }
    : { name: c.name || '', pt: c.pt === undefined ? 'guest' : c.pt, cls: c.cls || 'npc', art: c.art, alt: c.alt, tone: c.tone, icon: c.icon, voice: c.voice };
  if (SPEAKERS[who]) return SPEAKERS[who];
  if (FOES[who]) return { name: FOES[who].name, pt: 'guest', cls: 'foe', foe: who, voice: 'machine' };
  return SPEAKERS.nar;
}
const heroName = () => (RUN && RUN.name) || '???';
const lineText = step => typeof step.text === 'function' ? step.text(ctxOf()) : step.text;
// instant = 건너뛰기로 멈춘 자리에서 바로 앞 대사를 한 번에 보여 줄 때
function showLine(step, instant = false) {
  const who = step.who;
  const sp = speakerOf(who);
  const name = step.name || (who === 'hero' ? heroName() : who === 'boss' ? SC.bossName : sp.name || '');
  const pt = step.vo ? null : sp.pt || null;
  const gs = pt === 'guest' ? takeSlot(who) : null;
  if (gs) setGuest(gs, who, sp);
  const els = { hero: q('#ptHero'), boss: q('#ptBoss'), voice: q('#ptVoice') };
  for (const [key, e] of Object.entries(els)) {
    if (key === 'voice') e.classList.toggle('in', pt === key);
    else if (pt === key) e.classList.add('in');
    e.classList.toggle('on', pt === key);
    e.classList.toggle('off', pt !== key);
  }
  for (const s of ['a', 'b']) {
    const e = q('#' + SLOT_EL[s]);
    e.classList.toggle('on', gs === s);
    e.classList.toggle('off', gs !== s);
  }
  updateDuo();
  const nm = q('#dname');
  nm.textContent = name;
  nm.hidden = !name;
  nm.className = 'dname' + (sp.cls && who !== 'nar' ? ' ' + sp.cls : '');
  q('#dtext').className = 'dtext' + (sp.cls ? ' ' + sp.cls : '');
  if (who === 'hero') setHeroFace(step.face || 'idle');
  const html = fmt(lineText(step));
  if (!instant) SC.log.push({ who, name, html, cls: sp.cls || '' });
  SC.who = who === 'hero' || who === 'boss' || who === 'voice' ? who : sp.voice || who;
  q('#dbox').classList.remove('blank');
  if (instant) { if (SC.tw) SC.tw.stop(); q('#dtext').innerHTML = html; SC.typing = false; q('#dbox').classList.add('done'); return; }
  typeText(html);
}
// 종이 기록 — 낡은 종이 패널에 글을 찍는다. 대사창은 비우고, 인물은 뒤로 물린다
function showPaper(step) {
  const p = q('#scPaper');
  const panel = !!step.panel;
  q('#scPaperT').textContent = step.panel || step.paper;
  q('#scPaperE').innerHTML = step.emblem ? dialSVG(step.emblem) : '';
  q('#scPaperE').hidden = !step.emblem;
  p.classList.toggle('panel', panel);
  p.classList.toggle('deny', panel && step.tone === 'deny');
  p.hidden = false; p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
  q('#dname').hidden = true; q('#dtext').innerHTML = '';
  q('#dbox').classList.add('paper');
  q('#dbox').classList.remove('blank');
  for (const id of ['ptHero', 'ptGuest', 'ptBoss']) q('#' + id).classList.add('off');
  const html = fmt(lineText(step));
  SC.log.push({ who: 'paper', name: step.panel || step.paper, html });
  SC.who = 'nar'; SC.papering = true;
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  SC.full = html; SC.plain = tmp.textContent; SC.typing = true;
  q('#dbox').classList.remove('done');
  if (!panel) SFX.page(); else if (step.tone === 'deny') SFX.refuse(); else SFX.panel();
  SC.tw = typeInto(q('#scPaperX'), html, { sound: 'soft', onDone: finishType });
}
// 손님 칸에 인물을 세운다 — 전용 그림(art)이 없으면 대신 쓸 그림(alt)에 색조(tone)를 입힌다 (오르 · 에다 = 신도 그림)
function setGuest(s, who, sp) {
  const g = q('#' + SLOT_EL[s]), box = g.querySelector('.pt-art');
  const own = sp.art && art(sp.art);
  g.dataset.who = sp.foe ? 'foe' : SPEAKERS[who] ? who : sp.cls || 'npc';
  g.dataset.tone = !own && sp.tone ? sp.tone : '';
  g.classList.add('in');
  if (box.dataset.who === who) return;
  box.dataset.who = who;
  if (sp.foe) box.innerHTML = foeArtHTML(sp.foe);
  else {
    // 그림이 오기 전의 사람 · 물건은 실루엣 대신 상징 그림으로
    const u = own || (sp.alt && art(sp.alt));
    box.innerHTML = u ? `<img src="${u}" alt="" draggable="false">` : sp.icon ? `<div class="pt-glyph">${icon(sp.icon)}</div>` : '<div class="pt-sil"></div>';
  }
  g.classList.remove('swap'); void g.offsetWidth; g.classList.add('swap');
}
function setHeroFace(face) {
  const img = q('#ptHeroImg');
  if (!img) return;
  const u = faceUrl(face);
  if (u && img.getAttribute('src') !== u) { img.setAttribute('src', u); const h = q('#ptHero'); h.classList.remove('swap'); void h.offsetWidth; h.classList.add('swap'); }
}

// 타자기처럼 한 글자씩 — 이름 색 같은 꾸밈은 처음부터 그대로, 글자마다 딸깍
function typeText(html) {
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  SC.full = html; SC.plain = tmp.textContent; SC.typing = true;
  q('#dbox').classList.remove('done');
  SC.tw = typeInto(q('#dtext'), html, { sound: 'voice', who: SC.who, onDone: finishType });
}
function finishType() {
  if (SC.tw && SC.tw.typing) { SC.tw.finish(); return; }   // finish()가 다시 여기로 온다
  SC.typing = false;
  q('#dbox').classList.add('done');
  if (SC.auto) SC.autoT = setTimeout(next, (1000 + SC.plain.length * 35) * AUTO_SPEED[SET.autoSpeed]);
}

export function advance() {
  if (!q('#scLogPanel').hidden || SC.choosing || SC.inputting) return;
  if (SC.carding) { hideCard(); return; }
  if (SC.waiting) { SC.waiting = false; clearTimeout(SC.waitT); next(); return; }
  if (SC.typing) finishType();
  else { SFX.page(); next(); }
}

function showCard(c) {
  SC.carding = true;
  const card = q('#scCard');
  card.innerHTML = c.kick || !c.num
    ? `<div class="nm-card"><small>${esc(c.kick || '')}</small><b>${esc(c.title)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}</div>`
    : `<div><b>${esc(c.num)}</b><i></i><span>${esc(c.title)}</span>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</div>`;
  card.hidden = false;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  SFX.chime();
  SC.cardT = setTimeout(hideCard, 2300);
}
function hideCard() { clearTimeout(SC.cardT); SC.carding = false; q('#scCard').hidden = true; next(); }

// 선택지 — when이 거짓이면 숨기고, cond가 거짓이면 막아 두고 이유(lack)를 보여 준다. desc = 무엇을 얻고 잃는지
function showChoice(opts) {
  const ctx = ctxOf();
  const list = opts.filter(o => !o.when || o.when(ctx)).map(o => ({ o, dis: !!(o.cond && !o.cond(ctx)) }));
  SC.choosing = list;
  q('#dbox').classList.add('choosing');
  const box = q('#scChoices');
  box.innerHTML = list.map(({ o, dis }, i) => {
    const desc = typeof o.desc === 'function' ? o.desc(ctx) : o.desc;
    const lack = typeof o.lack === 'function' ? o.lack(ctx) : o.lack;
    const sub = dis && lack ? lack : desc;
    return `<button type="button" data-i="${i}"${dis ? ' disabled' : ''}><kbd>${i + 1}</kbd><span class="ch-t"><span class="ch-l">${fmt(o.label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
  }).join('');
  box.classList.toggle('many', list.length > 3);
  box.hidden = false;
}
function chooseOption(i) {
  const list = SC.choosing;
  if (!list || !list[i]) return;
  if (list[i].dis) { SFX.deny(); return; }
  const o = list[i].o;
  SC.choosing = null;
  q('#scChoices').hidden = true;
  q('#dbox').classList.remove('choosing');
  SC.log.push({ who: 'pick', name: '선택', html: fmt(o.label) });
  if (SC.onChoice) SC.onChoice(o.label);
  SC.queue.unshift(...(o.then || []));
  SFX.card();
  next();
}

// 얻고 잃은 것 — 장면 위쪽에 잠깐 떴다 사라진다 (사건의 부품 · 경계도 · HP …)
export function sceneNote(html, kind = '') {
  if (!sceneOpen()) return;
  const box = q('#scNotes');
  const n = document.createElement('div');
  n.className = 'sc-note' + (kind ? ' ' + kind : '');
  n.innerHTML = html;
  box.appendChild(n);
  setTimeout(() => n.remove(), 2800);
}

// 이름 입력
function showInput(step) {
  SC.inputting = true;
  q('#dbox').classList.add('choosing');
  q('#scInPrompt').textContent = step.prompt || '당신의 이름은?';
  q('#scInSub').textContent = step.sub || '';
  q('#scInErr').textContent = '';
  const inp = q('#scInName');
  inp.value = (RUN && RUN.name) || step.def || '';
  q('#scInput').hidden = false;
  setTimeout(() => inp.focus(), 60);
}
export function validName(v) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  if (!s) return { ok: false, err: '이름을 적어 주세요.' };
  if ([...s].length > 8) return { ok: false, err: '8자까지 쓸 수 있어요.' };
  if (/[<>{}|\\]/.test(s)) return { ok: false, err: '< > { } | \\ 는 쓸 수 없어요.' };
  return { ok: true, name: s };
}
function submitName() {
  const r = validName(q('#scInName').value);
  if (!r.ok) { q('#scInErr').textContent = r.err; SFX.deny(); return; }
  SC.inputting = false;
  q('#scInput').hidden = true;
  q('#dbox').classList.remove('choosing');
  SC.log.push({ who: 'pick', name: '이름', html: esc(r.name) });
  if (SC.onName) SC.onName(r.name);
  SFX.save();
  next();
}

function toggleLog(open) {
  const panel = q('#scLogPanel');
  if (open) {
    clearTimeout(SC.autoT);
    const list = q('#scLogList');
    list.innerHTML = SC.log.map(l => `<div class="lg-item${l.who === 'nar' ? ' nar' : l.who === 'pick' ? ' pick' : l.who === 'voice' ? ' voice' : l.who === 'paper' ? ' paper' : l.cls ? ' c-' + l.cls : ''}">${l.name ? `<b>${esc(l.name)}</b>` : ''}<p>${l.html}</p></div>`).join('') || '<p class="hint">아직 지나간 대사가 없어요.</p>';
    panel.hidden = false;
    list.scrollTop = list.scrollHeight;
    return;
  }
  panel.hidden = true;
  if (SC.auto && !SC.typing && !SC.choosing && !SC.carding && !SC.inputting && !SC.waiting) SC.autoT = setTimeout(next, 800);
}
function toggleAuto() {
  SC.auto = !SC.auto;
  q('#scAutoBtn').classList.toggle('on', SC.auto);
  clearTimeout(SC.autoT);
  if (SC.auto && !SC.typing && !SC.choosing && !SC.carding && !SC.inputting && !SC.waiting && q('#scLogPanel').hidden) SC.autoT = setTimeout(next, 600);
}
// 건너뛰기 — 선택지 · 이름 입력 앞에서 멈춘다 (고르는 건 건너뛸 수 없다). 지나가는 효과 · 갈림은 그대로 처리하고, 대사는 기록에 남긴다
function skip() {
  if (SC.inputting || SC.choosing) return;
  if (SC.tw) SC.tw.stop();
  hidePaper();
  clearTimeout(SC.autoT); clearTimeout(SC.cardT); clearTimeout(SC.waitT);
  SC.carding = false; SC.waiting = false; q('#scCard').hidden = true;
  let last = null;
  for (;;) {
    const step = SC.queue[0];
    if (!step) break;
    if (step.when && !step.when(ctxOf())) { SC.queue.shift(); continue; }
    if (step.choice || step.input) break;
    SC.queue.shift();
    if (silent(step)) continue;
    stage(step);
    if (step.tint !== undefined) dom.dataset.tint = step.tint;
    if (step.exit) exitPortrait(step.exit);
    if (step.fx === 'hush') SFX.amb(null);
    if (step.blank) last = null;
    if (step.paper || step.panel) { const t = step.panel || step.paper; SC.log.push({ who: 'paper', name: t, html: fmt(lineText(step)) }); last = { who: 'nar', text: `〔${t}〕 ${lineText(step)}` }; continue; }
    if (step.text) {
      const sp = speakerOf(step.who);
      const name = step.name || (step.who === 'hero' ? heroName() : step.who === 'boss' ? SC.bossName : sp.name || '');
      SC.log.push({ who: step.who, name, html: fmt(lineText(step)), cls: sp.cls || '' });
      last = step;
    }
  }
  if (!SC.queue.length) { end(); return; }
  // 멈춘 자리 — 바로 앞 대사를 한 번에 보여 주고(무엇을 고르는지 알 수 있게) 선택지 · 이름 입력으로
  SC.typing = false;
  if (last) showLine(last, true);
  else { q('#dtext').innerHTML = ''; q('#dname').hidden = true; }
  next();
}
function end() {
  if (SC.tw) SC.tw.stop();
  hidePaper();
  clearTimeout(SC.autoT); clearTimeout(SC.cardT); clearTimeout(SC.placeT); clearTimeout(SC.waitT); clearTimeout(SC.sysT);
  q('#scPlace').hidden = true; q('#scSys').hidden = true;
  SFX.amb(null);
  SC.choosing = null; SC.carding = false; SC.typing = false; SC.inputting = false; SC.waiting = false;
  dom.hidden = true;
  $('#app').classList.remove('in-scene');
  const cb = SC.onEnd; SC.onEnd = null;
  if (cb) cb();
}

// 대사 장면이 떠 있을 때 키 입력
export function sceneKey(e) {
  if (!sceneOpen()) return false;
  if (SC.inputting) return true;
  if (!q('#scLogPanel').hidden) { if (e.key === 'Escape' || e.code === 'KeyL') { e.preventDefault(); toggleLog(false); } return true; }
  if (e.code === 'KeyL') { toggleLog(true); return true; }   // 고르는 중에도 기록을 다시 볼 수 있다 (건너뛰고 왔을 때)
  const pick = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (SC.choosing) { if (pick) chooseOption(+pick[1] - 1); return true; }
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); advance(); return true; }
  if (e.code === 'KeyA') { toggleAuto(); return true; }
  return true;
}
export { load as loadArt };
