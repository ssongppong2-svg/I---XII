// 대사 장면 — 프롤로그 · 정예/보스 이야기 · 재귀 · 천막
// 대사 = { who, face?, text } · 선택지 = { choice: [{ label, then }] } · 챕터 카드 = { card: { num, title } }
// 이름 입력 = { input: 'name', prompt, sub } · 연출 = { tint, place, fx, exit } · 조건 = { when: () => bool }
import { $, el, esc, iga, eulreul, eunneun, irago, ah, iyeo, isiyeo, iya } from '../core/util.js';
import { SET, AUTO_SPEED } from '../core/settings.js';
import { typeInto } from '../ui/typewriter.js';
import { SFX } from '../ui/sfx.js';
import { art, faceUrl, load } from '../ui/assets.js';
import { foeArtHTML } from '../ui/foeart.js';
import { FOES } from '../data/foes.js';
import { RUN } from '../game/run.js';

// 조사: {name|이라고} 처럼 받침이 있을 때의 꼴을 적으면 받침에 맞춰 바꾼다
const PARTICLE = { '이라고': irago, '은': eunneun, '이': iga, '을': eulreul, '아': ah, '이여': iyeo, '이시여': isiyeo, '이야': iya };
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
  believer: { name: '신도', pt: 'guest', cls: 'voice', art: 'believer' },
  merchant: { name: '상점 주인', pt: 'guest', cls: 'merchant', art: 'shopkeeper' },
  black: { name: '암시장 상인', pt: 'guest', cls: 'black', art: 'blackmarket' },
};
const NAME_SUGGEST = ['크로노스', '아르케', '엘리오스', '호라', '제로', '시계공', '카이로스', '루멘', '에온', '헤임'];

const SC = { queue: [], full: '', plain: '', tw: null, who: 'nar', typing: false, choosing: null, inputting: false, carding: false, auto: false, log: [], onEnd: null, autoT: 0, cardT: 0, placeT: 0, bossName: '대형 감시기계', onName: null };
let dom = null;
const q = s => dom.querySelector(s);

export function initScene() {
  dom = el(`<div class="scene" id="scene" hidden>
    <div class="sc-wrap">
      <div class="sc-tools"><button type="button" id="scLogBtn">로그</button><button type="button" id="scAutoBtn">자동</button><button type="button" id="scSkipBtn">건너뛰기 ▸▸</button></div>
      <div class="sc-place" id="scPlace" hidden></div>
      <div class="pt pt-voice" id="ptVoice"><div class="pt-art" id="ptVoiceArt"></div></div>
      <div class="pt pt-hero" id="ptHero"><div class="pt-art" id="ptHeroArt"></div></div>
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
// opt: { bossName, bossArt, bossBar, onName(name) }
export function playScene(script, opt = {}) {
  return new Promise(res => {
    Object.assign(SC, { queue: (script || []).slice(), log: [], onEnd: res, choosing: null, carding: false, typing: false, inputting: false, bossName: opt.bossName || '대형 감시기계', onName: opt.onName || null });
    for (const id of ['ptHero', 'ptGuest', 'ptBoss', 'ptVoice']) q('#' + id).classList.remove('in', 'on', 'off', 'swap');
    q('#ptGuestArt').dataset.who = '';
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
    dom.classList.remove('duo');
    q('#scPlace').hidden = true;
    q('#dname').hidden = true;
    q('#dtext').innerHTML = '';
    q('#dbox').className = 'dbox';
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

function next() {
  clearTimeout(SC.autoT);
  for (;;) {
    const step = SC.queue.shift();
    if (!step) { end(); return; }
    if (step.when && !step.when()) continue;
    if (step.tint !== undefined) dom.dataset.tint = step.tint;
    if (step.place) showPlace(step.place);
    if (step.fx) sceneFx(step.fx);
    if (step.exit) { exitPortrait(step.exit); }
    if (step.card) { showCard(step.card); return; }
    if (step.input) { showInput(step); return; }
    if (step.choice) { showChoice(step.choice); return; }
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
function sceneFx(kind) {
  const fl = cls => { dom.classList.remove(cls); void dom.offsetWidth; dom.classList.add(cls); setTimeout(() => dom.classList.remove(cls), 820); };
  if (kind === 'shake') { if (SET.shake) { const w = q('.sc-wrap'); w.classList.remove('sc-shake'); void w.offsetWidth; w.classList.add('sc-shake'); setTimeout(() => w.classList.remove('sc-shake'), 480); } SFX.boom(); }
  if (kind === 'flash') { fl('sc-flash'); SFX.warn(); }
  if (kind === 'red') { fl('sc-red'); SFX.hurt(); }
  if (kind === 'tick') SFX.tick();
}
function exitPortrait(which) {
  const id = which === 'hero' ? 'ptHero' : which === 'boss' ? 'ptBoss' : 'ptGuest';
  q('#' + id).classList.remove('in', 'on');
  updateDuo();
}
function updateDuo() { dom.classList.toggle('duo', q('#ptGuest').classList.contains('in')); }

function speakerOf(who) {
  if (SPEAKERS[who]) return SPEAKERS[who];
  if (FOES[who]) return { name: FOES[who].name, pt: 'guest', cls: 'foe', foe: who };
  return SPEAKERS.nar;
}
function showLine(step) {
  const who = step.who;
  const sp = speakerOf(who);
  const name = who === 'hero' ? (RUN && RUN.name) || '???' : who === 'boss' ? SC.bossName : sp.name || '';
  const pt = sp.pt || null;
  if (pt === 'guest') setGuest(who, sp);
  const els = { hero: q('#ptHero'), guest: q('#ptGuest'), boss: q('#ptBoss'), voice: q('#ptVoice') };
  for (const [key, e] of Object.entries(els)) {
    if (key === 'voice') e.classList.toggle('in', pt === key);
    else if (pt === key) e.classList.add('in');
    e.classList.toggle('on', pt === key);
    e.classList.toggle('off', pt !== key);
  }
  updateDuo();
  const nm = q('#dname');
  nm.textContent = name;
  nm.hidden = !name;
  nm.className = 'dname' + (sp.cls && who !== 'nar' ? ' ' + sp.cls : '');
  q('#dtext').className = 'dtext' + (sp.cls ? ' ' + sp.cls : '');
  if (who === 'hero') setHeroFace(step.face || 'idle');
  const html = fmt(step.text);
  SC.log.push({ who, name, html });
  SC.who = who;
  typeText(html);
}
function setGuest(who, sp) {
  const box = q('#ptGuestArt');
  q('#ptGuest').dataset.who = sp.foe ? 'foe' : who;
  if (box.dataset.who === who) return;
  box.dataset.who = who;
  if (sp.foe) box.innerHTML = foeArtHTML(sp.foe);
  else { const u = art(sp.art); box.innerHTML = u ? `<img src="${u}" alt="" draggable="false">` : '<div class="pt-sil"></div>'; }
  const g = q('#ptGuest'); g.classList.remove('swap'); void g.offsetWidth; g.classList.add('swap');
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
  if (SC.typing) finishType();
  else { SFX.page(); next(); }
}

function showCard(c) {
  SC.carding = true;
  const card = q('#scCard');
  card.innerHTML = `<div><b>${esc(c.num)}</b><i></i><span>${esc(c.title)}</span></div>`;
  card.hidden = false;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  SFX.chime();
  SC.cardT = setTimeout(hideCard, 2300);
}
function hideCard() { clearTimeout(SC.cardT); SC.carding = false; q('#scCard').hidden = true; next(); }

function showChoice(opts) {
  SC.choosing = opts;
  q('#dbox').classList.add('choosing');
  const box = q('#scChoices');
  box.innerHTML = opts.map((o, i) => `<button type="button" data-i="${i}"><kbd>${i + 1}</kbd>${esc(o.label)}</button>`).join('');
  box.hidden = false;
}
function chooseOption(i) {
  const opts = SC.choosing;
  if (!opts || !opts[i]) return;
  SC.choosing = null;
  q('#scChoices').hidden = true;
  q('#dbox').classList.remove('choosing');
  SC.log.push({ who: 'pick', name: '선택', html: esc(opts[i].label) });
  SC.queue.unshift(...opts[i].then);
  SFX.card();
  next();
}

// 이름 입력
function showInput(step) {
  SC.inputting = true;
  q('#dbox').classList.add('choosing');
  q('#scInPrompt').textContent = step.prompt || '당신의 이름은?';
  q('#scInSub').textContent = step.sub || '';
  q('#scInErr').textContent = '';
  const inp = q('#scInName');
  inp.value = (RUN && RUN.name) || '';
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
    list.innerHTML = SC.log.map(l => `<div class="lg-item${l.who === 'nar' ? ' nar' : l.who === 'pick' ? ' pick' : l.who === 'voice' ? ' voice' : ''}">${l.name ? `<b>${esc(l.name)}</b>` : ''}<p>${l.html}</p></div>`).join('') || '<p class="hint">아직 지나간 대사가 없어요.</p>';
    panel.hidden = false;
    list.scrollTop = list.scrollHeight;
    return;
  }
  panel.hidden = true;
  if (SC.auto && !SC.typing && !SC.choosing && !SC.carding && !SC.inputting) SC.autoT = setTimeout(next, 800);
}
function toggleAuto() {
  SC.auto = !SC.auto;
  q('#scAutoBtn').classList.toggle('on', SC.auto);
  clearTimeout(SC.autoT);
  if (SC.auto && !SC.typing && !SC.choosing && !SC.carding && !SC.inputting && q('#scLogPanel').hidden) SC.autoT = setTimeout(next, 600);
}
// 건너뛰기 — 이름 입력이 남아 있으면 거기까지만 건너뛴다
function skip() {
  if (SC.inputting) return;
  const idx = SC.queue.findIndex(s => s.input);
  if (SC.tw) SC.tw.stop();
  clearTimeout(SC.autoT); clearTimeout(SC.cardT);
  SC.carding = false; q('#scCard').hidden = true;
  SC.choosing = null; q('#scChoices').hidden = true; q('#dbox').classList.remove('choosing');
  if (idx >= 0) {
    SC.queue.splice(0, idx);
    SC.typing = false;
    // 건너뛴 대사가 반쯤 찍힌 채 남지 않게
    q('#dtext').innerHTML = '';
    q('#dname').hidden = true;
    next();
    return;
  }
  end();
}
function end() {
  if (SC.tw) SC.tw.stop();
  clearTimeout(SC.autoT); clearTimeout(SC.cardT); clearTimeout(SC.placeT);
  q('#scPlace').hidden = true;
  SC.choosing = null; SC.carding = false; SC.typing = false; SC.inputting = false;
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
  const pick = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (SC.choosing) { if (pick) chooseOption(+pick[1] - 1); return true; }
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); advance(); return true; }
  if (e.code === 'KeyL') { toggleLog(true); return true; }
  if (e.code === 'KeyA') { toggleAuto(); return true; }
  return true;
}
export { load as loadArt };
