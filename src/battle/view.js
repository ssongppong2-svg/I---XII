// 전투 화면 — DOM 만들기 · 그리기 · 연출
import {
  B, H, K, RC, COLS, DIRS, DIR_LABEL, inArea, liveFoes, foeAt, foeById, T, dueIn, validDirs, aimFor, shapeCells,
  strikeTargets, reachText, leapOf, inFront, ambushOn, cardDamage, nextOl, wait, manh, helpers,
} from './core.js';
import { cardDef, SHAPES, KINDS, effectLine } from '../data/cards.js';
import { FOE_BARKS, ELITE_TRAITS } from '../data/foes.js';
import { RELICS, IMPLANTS } from '../data/relics.js';
import { icon } from '../ui/icons.js';
import { art, faceUrl, faceKeyOf, FACES, FACE_CENTER, bgImgHTML } from '../ui/assets.js';
import { foeSdHTML } from '../ui/foeart.js';
import { SFX } from '../ui/sfx.js';
import { $, esc, clamp, RM, flash } from '../core/util.js';
import { SET } from '../core/settings.js';
import { typeInto } from '../ui/typewriter.js';

let root = null;
const q = s => root.querySelector(s);
const CELLS = {}, BCELLS = [];
const FOE_EL = new Map();
let handSig = '', beamSig = '', markSig = '', rosterSig = '', logSig = '', relicSig = '', logSeen = -1;
export let lastPointer = window.matchMedia && window.matchMedia('(hover: hover)').matches ? 'mouse' : 'touch';
document.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; }, true);

const HERO_SVG = `<svg class="hero-svg" viewBox="0 0 100 130" aria-hidden="true"><ellipse cx="50" cy="124" rx="25" ry="5" fill="#000" opacity=".5"/><g class="halo"><circle cx="50" cy="44" r="36" fill="none" stroke="#D6AE62" stroke-width="4" stroke-dasharray="5.6 3.8"/><circle cx="50" cy="44" r="30.5" fill="none" stroke="#7C6234" stroke-width="1.2"/></g><path d="M30 122 C31 98 38 86 50 84 C62 86 69 98 70 122 Z" fill="#2A2340" stroke="#D6AE62" stroke-width="1.6"/><path d="M50 86 V122" stroke="#D6AE62" stroke-width="1.2" opacity=".55"/><circle cx="31" cy="104" r="5.5" fill="#EFE8DC"/><circle cx="69" cy="104" r="5.5" fill="#EFE8DC"/><rect x="21" y="14" width="58" height="60" rx="27" fill="#F2ECE2"/><rect x="27" y="34" width="46" height="19" rx="9.5" fill="#15121D"/><circle class="eye" cx="40" cy="43.5" r="4.2" fill="#5FE3D2"/><circle class="eye" cx="60" cy="43.5" r="4.2" fill="#5FE3D2"/><path d="M50 3 L55 15 H45 Z" fill="#D6AE62"/></svg>`;
const BOSS_SVG = `<svg class="boss-svg" viewBox="0 0 520 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="bgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B6572"/><stop offset=".5" stop-color="#2E353F"/><stop offset="1" stop-color="#15191F"/></linearGradient><pattern id="haz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="12" fill="#D9A23C"/><rect x="6" width="6" height="12" fill="#17191D"/></pattern></defs><path d="M14 12 H506 L518 30 V60 L500 74 H20 L2 60 V30 Z" fill="url(#bgA)" stroke="#8793A1" stroke-width="1.5"/><rect x="22" y="64" width="476" height="7" fill="url(#haz)" opacity=".85"/>${[0, 1, 2, 3, 4].map(c => `<g class="brl" data-c="${c}"><rect x="${42 + c * 104}" y="70" width="20" height="17" rx="2" fill="#1C2027" stroke="#8793A1"/><rect x="${47 + c * 104}" y="86" width="10" height="11" fill="#0A0C0F" stroke="#8793A1"/><circle class="muz" cx="${52 + c * 104}" cy="97" r="4.5"/></g>`).join('')}<g><circle class="lamp" cx="52" cy="42" r="5"/><circle class="lamp" cx="156" cy="42" r="5"/><circle class="lamp" cx="364" cy="42" r="5"/><circle class="lamp" cx="468" cy="42" r="5"/></g><circle cx="260" cy="38" r="23" fill="#0F1318" stroke="#A7B2BF" stroke-width="3"/><circle class="eye" cx="260" cy="38" r="13"/><circle cx="260" cy="38" r="5" fill="#07090B"/></svg>`;

export function mountView(holder, { theme = '', chapterNum = 'I', title = '', sub = '' } = {}) {
  root = document.createElement('div');
  root.className = `battle ${theme}`;
  const bg = bgImgHTML('bg-battle');
  if (bg) root.classList.add('has-bg');
  root.innerHTML = `${bg ? `<div class="battle-bg" aria-hidden="true">${bg}</div>` : ''}
  <header class="topbar">
    <div class="tb-left"><div class="tb-ch">${chapterNum}</div><div class="tb-mode"><b id="modeLabel">${esc(title)}</b><span id="loopLabel">${esc(sub)}</span></div></div>
    <div class="loop-wrap" title="이동 · 카드 · 뽑기는 모두 1코스트. 다 쓰면 다음 루프"><div class="loop-gear" id="loopGear">${icon('sigil')}<b id="loopNum">0</b></div><div class="loop-meta"><b id="loopCost">—</b><span id="loopSub">루프</span></div></div>
    <div class="hud-btns">
      <button class="icon-btn" id="bDeck" type="button">${icon('deck')}덱</button>
      <button class="icon-btn" id="bHelp" type="button">${icon('help')}규칙<kbd>H</kbd></button>
      <button class="icon-btn" id="bSnd" type="button">${icon('snd')}소리<kbd>M</kbd></button>
      <button class="icon-btn" id="bMenu" type="button">${icon('menu')}메뉴<kbd>Esc</kbd></button>
    </div>
  </header>
  <aside class="side side-l">
    <section class="panel me-panel">
      <div class="me-head"><div class="me-face" id="meFace" aria-hidden="true"></div><div class="me-id"><div class="me-name" id="meName"></div><div class="me-sub" id="meSub"></div></div></div>
      <div class="vitals" id="vitals"><span id="hearts" style="display:contents"></span><span class="shield" id="shield"></span></div>
      <div class="olw"><div class="ol-top"><span>과부하</span><span id="olTxt"></span></div><div class="bar pol" id="olBar"><i></i></div></div>
      <div class="b-relics" id="bRelics"></div>
    </section>
    <section class="panel detail-panel"><h5 class="p-title" id="detailTitle">설명</h5><div class="detail" id="detail"></div></section>
    <section class="panel keys"><h5 class="p-title">조작</h5><div class="k-grid">
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>이동 (카드를 고른 뒤엔 조준)</span>
      <span><kbd>1</kbd>–<kbd>6</kbd></span><span>카드 고르기 · 한 번 더 누르면 사용</span>
      <span><kbd>Q</kbd></span><span>카드 1장 뽑기</span>
      <span><kbd>클릭</kbd></span><span>옆 칸으로 이동 · 카드 사용</span>
    </div></section>
  </aside>
  <aside class="side side-r">
    <section class="panel foe-head"><div class="boss-name"><div class="bname" id="bossName"></div><div class="bsub" id="bossSub"></div></div>
      <div class="boss-bars"><div class="bar hp" id="bossHp"><i></i><b></b></div><div class="bar bol" id="bossOl"><i></i><b></b></div></div></section>
    <div class="intent" id="intent"><div class="mini" id="intMini" aria-hidden="true"></div>
      <div class="int-txt"><span class="int-label"><svg><use href="#i-hazard" id="intIcon"/></svg><span id="intTitle"></span><span class="int-meta" id="intMeta"></span></span><span class="int-main"><b id="intName">—</b><span class="int-chips" id="intChips"></span></span></div>
      <div class="amb-chip" id="ambChip"></div></div>
    <section class="panel roster" id="roster" hidden><h5 class="p-title"><span id="rosterTitle">적 목록</span><small>올리면 판에서 짚어 줘요</small></h5><div class="ro-list" id="roList"></div></section>
    <section class="panel log-panel"><h5 class="p-title">전투 기록</h5><div class="log" id="log" aria-live="polite"></div></section>
  </aside>
  <div class="center">
    <main class="board" id="board">
      <div class="boss-row" id="bossRow"><div class="searchlight" aria-hidden="true"></div><div class="boss-art" id="bossArt">${BOSS_SVG}</div><div class="bcells" id="bcells"></div><div class="stun-tag" id="stunTag" hidden></div><div class="bark" id="bark" hidden></div></div>
      <div class="beams" id="beams"></div>
      <div class="foes" id="foes"></div>
      <div class="unit" id="player"><div class="ward"></div><div class="hero-art" id="heroArt">${HERO_SVG}</div>
        <svg class="sparks" viewBox="0 0 100 100" aria-hidden="true"><path d="M18 30 L28 40 L22 44 L34 56 M82 26 L72 38 L79 42 L66 58 M40 12 L46 22 L40 26 L48 34 M60 80 L54 88 L61 92 L52 99" fill="none" stroke="#C9B0FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="frz-badge" id="frzBadge"></span></div>
      <div class="fmarks" id="fmarks"></div>
      <div class="fx" id="fx"></div>
      <div class="b-toast" id="bToast" hidden></div>
    </main>
    <div class="timeline"><div class="pips" id="pips" aria-label="이번 루프 코스트"></div><div class="coach" id="coach"></div></div>
  </div>
  <section class="hand-row"><div class="hand" id="hand"></div><button class="draw-btn" id="drawBtn" type="button" tabindex="-1"></button></section>`;
  holder.appendChild(root);
  Object.keys(CELLS).forEach(k => delete CELLS[k]); BCELLS.length = 0; FOE_EL.clear();
  handSig = beamSig = markSig = rosterSig = logSig = relicSig = ''; logSeen = -1;
  buildBoard();
  // 그림 슬롯
  const sd = art('hero-sd');
  if (sd) { q('#heroArt').innerHTML = `<img src="${sd}" alt="" draggable="false">`; q('#heroArt').classList.add('sd'); }
  if (art('hero')) q('#meFace').innerHTML = '<img id="meFaceImg" alt="" draggable="false">';
  return root;
}
export const viewRoot = () => root;

function buildBoard() {
  const board = q('#board'), beams = q('#beams');
  for (let r = 0; r <= 4; r++) for (let c = 0; c < COLS; c++) {
    const el = document.createElement('div');
    el.className = 'cell' + (r === 0 ? ' r0' : '');
    el.style.gridRow = r + 1; el.style.gridColumn = c + 1;
    el.innerHTML = `<i class="fmark"></i>${c === 0 && r > 0 ? `<span class="dist">${r}</span>` : ''}`;
    el.dataset.r = r; el.dataset.c = c;
    board.insertBefore(el, beams);
    CELLS[K(r, c)] = el;
  }
  const bc = q('#bcells');
  for (let c = 0; c < COLS; c++) {
    const d = document.createElement('div');
    d.className = 'bcell'; d.dataset.r = 0; d.dataset.c = c;
    bc.appendChild(d); BCELLS.push(d);
  }
}

// 전투가 정해진 뒤 판 모양 (보스 줄 · 막힌 칸) 반영
export function setupBoard() {
  const board = q('#board');
  board.classList.toggle('mode-boss', B.mode === 'boss');
  board.classList.toggle('mode-normal', B.mode !== 'boss');
  for (let r = 0; r <= 4; r++) for (let c = 0; c < COLS; c++) CELLS[K(r, c)].classList.toggle('blk', !!(B.blocked && B.blocked.has(K(r, c))));
  q('#foes').innerHTML = ''; FOE_EL.clear();
  if (B.mode === 'boss') {
    const strip = art(B.boss.def.art);
    if (strip) { q('#bossArt').innerHTML = `<img class="strip" src="${strip}" alt="" draggable="false">`; q('#bossRow').classList.add('has-art'); }
  }
  q('#meName').textContent = B.name;
  handSig = beamSig = markSig = rosterSig = logSig = relicSig = ''; logSeen = -1;
}

/* ═════════════ 그리기 ═════════════ */
export function render() {
  if (!root || !B.enc) return;
  renderHud(); renderIntent(); renderBoard(); renderStatus(); renderHand(); renderFoot(); renderRoster();
}
function setBar(el, v, html) { el.style.setProperty('--v', clamp(v, 0, 1)); if (html !== undefined) el.querySelector('b').innerHTML = html; }

const ambCancelled = () => !!(B.amb && !B.ambFired && B.ambushAt - B.spent >= 1 && B.boss && B.ambushAt - B.spent <= B.boss.stun);
const atkCancelled = () => !!(B.intent && B.loopCost - B.spent >= 1 && B.boss && B.loopCost - B.spent <= B.boss.stun);

function renderHud() {
  q('#loopNum').textContent = B.loop;
  q('#loopCost').textContent = !B.started ? '교전 대기' : B.over ? '교전 종료' : `남은 코스트 ${B.costLeft} / ${B.loopCost}`;
  q('#loopSub').textContent = B.started && !B.over ? `루프 ${B.loop}${ambushOn() ? ` · 기습 ${B.ambushAt}번째 행동 뒤` : ''}` : '루프';
  const alive = liveFoes().length, total = B.foes.length;
  const ol = q('#bossOl');
  if (B.mode === 'boss') {
    q('#bossName').textContent = B.boss.def.name;
    q('#bossSub').textContent = total ? `${B.boss.def.sub} · 졸개 ${alive} / ${total}` : B.boss.def.sub;
    setBar(q('#bossHp'), B.boss.hp / B.boss.max, `<span>HP</span><span>${B.boss.hp} / ${B.boss.max}</span>`);
    ol.classList.remove('kills');
    setBar(ol, B.boss.ol / 100, `<span>과부하</span><span>${B.boss.ol} / 100</span>`);
  } else {
    const hp = B.foes.reduce((s, f) => s + f.hp, 0), max = B.foes.reduce((s, f) => s + f.max, 0) || 1;
    q('#bossName').textContent = B.enc.foeTitle || '적';
    q('#bossSub').textContent = `남은 적 ${alive} / ${total}`;
    setBar(q('#bossHp'), hp / max, `<span>적 HP 합계</span><span>${hp} / ${max}</span>`);
    ol.classList.add('kills');
    setBar(ol, total ? (total - alive) / total : 0, `<span>처치</span><span>${total - alive} / ${total}</span>`);
  }
  const tag = q('#stunTag');
  tag.hidden = !(B.boss && B.boss.stun > 0);
  if (B.boss) tag.textContent = `과부하 정지 · ${B.boss.stun}코`;
  const snd = q('#bSnd');
  snd.querySelector('use').setAttribute('href', SET.sound ? '#i-snd' : '#i-mute');
}

function miniGrid(cells, cells2) {
  let h = '';
  const me = K(B.p.r, B.p.c);
  for (let r = B.top; r <= 4; r++) for (let c = 0; c < COLS; c++) {
    const k = K(r, c);
    if (!inArea(r, c)) { h += '<i class="blk"></i>'; continue; }
    h += `<i class="${cells.has(k) ? 'on' : cells2 && cells2.has(k) ? 'on2' : ''}${k === me ? ' me' : foeAt(r, c) ? ' foe' : ''}"></i>`;
  }
  return h;
}

function renderIntent() {
  const n = B.amb ? B.amb.cells.size : B.ambushCells;
  const ac = q('#ambChip');
  ac.classList.toggle('off', !ambushOn());
  ac.innerHTML = ambushOn() ? `${icon('cross')}<span>기습 <b>${n}</b>칸</span><span>${B.ambushAt}번째 뒤</span>` : `${icon('cross')}<span>기습</span><span>없음</span>`;
  q('#intMini').classList.toggle('foe-mode', B.mode !== 'boss');
  q('#intMini').style.gridTemplateRows = `repeat(${5 - B.top},12px)`;
  if (B.mode !== 'boss') { renderFoeIntent(); return; }
  q('#intIcon').setAttribute('href', '#i-hazard');
  q('#intTitle').textContent = '턴 공격 예고';
  const it = B.intent;
  if (!it) { q('#intName').textContent = '교전 대기'; q('#intMeta').innerHTML = ''; q('#intChips').innerHTML = ''; q('#intMini').innerHTML = miniGrid(new Set()); q('#intent').classList.remove('live'); return; }
  const pat = it.pat;
  const cells = B.atk || new Set(pat.make(B.p, it.q, helpers));
  q('#intName').textContent = `「${pat.name}」`;
  q('#intMeta').innerHTML = `<span class="chip c-warn">피해 ${pat.dmg + (B.diff.bossDmg || 0)}</span>${pat.nail ? '<span class="chip c-volt">못총 과부하</span>' : ''}`;
  q('#intChips').innerHTML = atkCancelled() ? '<span class="chip c-ok">무력화 예정</span>' : B.atk ? '<span class="chip c-warn">범위 공개</span>' : pat.aimed ? '<span class="chip c-dim" title="기습이 터지는 순간 내 위치를 기준으로 범위가 정해진다">조준형</span>' : '';
  q('#intMini').innerHTML = miniGrid(cells);
  q('#intent').classList.toggle('live', !!B.atk);
}
function renderFoeIntent() {
  q('#intIcon').setAttribute('href', '#i-target');
  q('#intTitle').textContent = '적 행동 예고';
  const alive = liveFoes();
  const acting = alive.filter(f => f.intent && f.intent.kind !== 'wait');
  const soon = acting.filter(f => dueIn(f) === 1);
  const group = soon.length ? soon : acting;
  const z1 = new Set(), z2 = new Set();
  for (const f of acting) if (f.intent.kind === 'atk') for (const k of f.intent.cells) (dueIn(f) === 1 ? z1 : z2).add(k);
  q('#intMini').innerHTML = miniGrid(z1, z2);
  q('#intMeta').innerHTML = `<span class="chip c-dim">남은 적 ${alive.length}</span>`;
  if (!alive.length) { q('#intName').textContent = '적 전멸'; q('#intChips').innerHTML = ''; q('#intent').classList.remove('live'); return; }
  q('#intName').textContent = !group.length ? '모두 대기' : soon.length ? '다음 행동 뒤' : '2번째 행동 뒤';
  q('#intChips').innerHTML = group.map(f => { const D = T(f), atk = f.intent.kind === 'atk'; return `<span class="chip ${atk ? 'c-foe' : 'c-dim'}">${D.short} ${atk ? D.atkShort : '이동'}</span>`; }).join('');
  q('#intent').classList.toggle('live', soon.some(f => f.intent.kind === 'atk'));
}

const selectedDef = () => B.sel !== null && B.hand[B.sel] ? cardDef(B.hand[B.sel]) : null;
export { selectedDef };

export function preview() {
  const i = B.sel !== null ? B.sel : B.hover;
  const out = { cells: new Set(), alt: new Set(), bcols: new Set(), leap: new Map(), back: null, dir: null };
  if (i === null || !B.hand[i] || !B.started || B.over) return out;
  const def = cardDef(B.hand[i]);
  if (def.shape) {
    const dir = aimFor(def) || B.aim || 'up';
    out.dir = dir;
    for (const d of validDirs(def)) {
      if (d === dir) continue;
      for (const [r, c] of shapeCells(def.shape, B.p, d)) if (inArea(r, c)) out.alt.add(K(r, c));
    }
    for (const [r, c] of shapeCells(def.shape, B.p, dir)) {
      if (B.mode === 'boss' && r === 0) out.bcols.add(c); else if (inArea(r, c)) out.cells.add(K(r, c));
    }
  }
  if (def.leap && !def.shape) {
    const max = leapOf(def);
    for (const [dir, [dr, dc]] of Object.entries(DIRS)) {
      for (let d = 1; d <= max; d++) {
        const r = B.p.r + dr * d, c = B.p.c + dc * d;
        if (r < B.top || r > 4 || c < 0 || c >= COLS) break;
        if (!inArea(r, c)) continue;
        if (!foeAt(r, c)) out.leap.set(K(r, c), { dir, dist: d });
      }
    }
  }
  if (def.back) out.back = K(B.loopStartP.r, B.loopStartP.c);
  return out;
}

function foeZones() {
  const m = new Map();
  for (const f of liveFoes()) {
    if (!f.intent || f.intent.kind !== 'atk') continue;
    const n = dueIn(f);
    for (const k of f.intent.cells) { const z = m.get(k); if (!z || n < z.n) m.set(k, { n, focus: false }); }
  }
  const fi = B.inspect && foeById(B.inspect);
  if (fi && fi.intent && fi.intent.kind === 'atk') for (const k of fi.intent.cells) { const z = m.get(k); if (z) z.focus = true; }
  return m;
}

export function renderBoard() {
  const pv = preview();
  const live = B.started && !B.over;
  const showMv = live && B.sel === null && B.hover === null;
  const fz = live ? foeZones() : new Map();
  const dests = new Set();
  if (live) for (const f of liveFoes()) if (f.intent && f.intent.kind === 'move') dests.add(K(f.intent.to.r, f.intent.to.c));
  for (const k of B.area) {
    const [r, c] = RC(k);
    const el = CELLS[k];
    const z = fz.get(k);
    el.classList.toggle('amb', !!(B.amb && B.amb.cells.has(k)));
    el.classList.toggle('atk', !!(B.atk && B.atk.has(k)));
    el.classList.toggle('rng', pv.cells.has(k));
    el.classList.toggle('rng2', pv.alt.has(k) && !pv.cells.has(k));
    el.classList.toggle('leapd', pv.leap.has(k));
    el.classList.toggle('backd', pv.back === k);
    el.classList.toggle('fz1', !!z && z.n === 1);
    el.classList.toggle('fz2', !!z && z.n === 2);
    el.classList.toggle('fzf', !!z && z.focus);
    el.classList.toggle('fdest', dests.has(k));
    el.classList.toggle('mv', showMv && Math.abs(r - B.p.r) + Math.abs(c - B.p.c) === 1 && !foeAt(r, c));
  }
  BCELLS.forEach((b, c) => b.classList.toggle('rng', pv.bcols.has(c)));
  const board = q('#board');
  board.classList.toggle('amb-off', ambCancelled());
  board.classList.toggle('atk-off', !!B.atk && atkCancelled());
  renderBeams(); renderFoes(); renderFoeMarks();
  const pl = q('#player');
  pl.style.setProperty('--r', B.p.r); pl.style.setProperty('--c', B.p.c);
  pl.style.zIndex = 10 + B.p.r;
  pl.classList.toggle('face-l', B.faceL);
  pl.classList.toggle('frozen', B.freeze > 0);
  pl.classList.toggle('warded', B.shield > 0);
  pl.classList.toggle('won', B.over && B.won);
  pl.classList.toggle('down', B.over && !B.won);
  q('#frzBadge').textContent = B.freeze > 0 ? B.freeze : '';
  renderPose();
  if (B.boss) q('#bossRow').classList.toggle('stunned', B.boss.stun > 0);
}

function foeEl(f) {
  let el = FOE_EL.get(f.uid);
  if (!el) {
    el = document.createElement('div');
    const D = T(f);
    el.className = `unit foe t-${f.type}${D.guard ? ' guard' : ''}${D.elite ? ' elite' : ''}`;
    el.innerHTML = `<div class="foe-art">${foeSdHTML(f.type)}</div><svg class="foe-face"><use href="#i-shield"/></svg><span class="foe-due"></span><span class="foe-hp"><i><i></i></i><b></b></span>`;
    q('#foes').appendChild(el);
    FOE_EL.set(f.uid, el);
  }
  return el;
}
export const foeElOf = f => foeEl(f);
function renderFoes() {
  for (const f of B.foes) {
    const el = foeEl(f);
    el.style.setProperty('--r', f.r); el.style.setProperty('--c', f.c);
    el.style.zIndex = 10 + f.r;
    el.classList.toggle('flip', !!f.flip);
    el.classList.toggle('dead', f.hp <= 0);
    el.classList.toggle('focus', B.inspect === f.uid);
    el.classList.toggle('stalled', !!(f.intent && f.intent.skipped));
    el.dataset.face = f.face;
    const it = f.intent, n = dueIn(f);
    const due = el.querySelector('.foe-due');
    const show = f.hp > 0 && B.started && !B.over && it && (it.kind !== 'wait' || it.skipped);
    if (it && it.skipped) {
      due.className = `foe-due skip${show ? ' on' : ''}`;
      due.innerHTML = show ? '멈춤' : '';
      due.title = '다음 행동을 건너뛴다';
    } else {
      due.className = `foe-due ${it ? it.kind : 'wait'} n${n}${show ? ' on' : ''}`;
      due.innerHTML = show ? `${icon(it.kind === 'atk' ? 'target' : 'step')}${n}` : '';
      due.title = show ? `${n}번째 행동 뒤 ${it.kind === 'atk' ? T(f).atk : '이동'}` : '';
    }
    el.querySelector('.foe-hp > i > i').style.width = `${f.hp / f.max * 100}%`;
    el.querySelector('.foe-hp b').textContent = f.hp;
  }
}
function renderFoeMarks() {
  const parts = [];
  if (B.started && !B.over) for (const f of liveFoes()) {
    const it = f.intent;
    if (!it) continue;
    const n = dueIn(f), ai = T(f).ai;
    if (it.kind === 'move') parts.push(`<i class="farrow ${it.dir} n${n}${it.dist > 1 ? ' d2' : ''}" style="--r:${it.to.r};--c:${it.to.c}"></i>`);
    else if (it.kind === 'atk' && ai === 'line' && it.cells.size) {
      const cells = [...it.cells].map(RC);
      const r0 = Math.min(...cells.map(x => x[0])), c0 = Math.min(...cells.map(x => x[1]));
      parts.push(DIRS[it.dir][0]
        ? `<i class="laser v n${n}" style="--x:${f.c};--y:${r0};--n:${cells.length}"></i>`
        : `<i class="laser h n${n}" style="--x:${c0};--y:${f.r};--n:${cells.length}"></i>`);
    } else if (it.kind === 'atk' && ai === 'bomber') parts.push(`<i class="fbomb n${n}" style="--r:${it.center.r};--c:${it.center.c}"></i>`);
  }
  const html = parts.join('');
  if (html !== markSig) { markSig = html; q('#fmarks').innerHTML = html; }
}
function renderBeams() {
  const sig = B.amb ? B.amb.key : '';
  if (sig === beamSig) return;
  beamSig = sig;
  q('#beams').innerHTML = B.amb ? B.amb.segs.map(s => s.horiz
    ? `<i class="beam h" style="--x:${s.start};--y:${s.idx};--n:${s.len}"></i>`
    : `<i class="beam v" style="--x:${s.idx};--y:${s.start};--n:${s.len}"></i>`).join('') : '';
}

// 코스트 칸 · 코치
function foesAfter(j) {
  if (j <= B.spent || !B.started || B.over) return [];
  const t = B.totalP + (j - B.spent);
  return liveFoes().filter(f => f.intent && f.intent.kind !== 'wait' && B.totalP + dueIn(f) === t);
}
function pipTitle(j, n, fs) {
  const t = [];
  if (j === B.ambushAt && ambushOn()) t.push(`${j}번째 행동이 끝나면 기습 폭발`);
  if (j === n && B.mode === 'boss') t.push(`${j}번째 행동이 끝나면 턴 공격`);
  if (fs.length) t.push(fs.map(f => `${T(f).short} ${f.intent.kind === 'atk' ? T(f).atkShort : '이동'}`).join(' · '));
  return t.join(' / ') || `${j}번째 코스트`;
}
function renderStatus() {
  let h = '';
  for (let i = 0; i < B.maxHp; i++) h += `<svg class="heart${i < B.hp ? '' : ' empty'}"><use href="#i-heart"/></svg>`;
  q('#hearts').innerHTML = h;
  q('#shield').innerHTML = B.shield > 0 ? `${icon('shield')}${B.shield}` : '';
  const n = B.loopCost;
  let p = '';
  for (let j = 1; j <= n; j++) {
    const spent = j <= B.spent, ahead = j - B.spent;
    const cls = ['pip'];
    let ic = '';
    if (j === B.ambushAt && ambushOn()) { cls.push('m-amb'); ic = 'cross'; }
    if (j === n && B.mode === 'boss') { cls.push('m-atk'); ic = 'hazard'; }
    if (spent) cls.push('spent');
    else {
      if (ahead === 1 && B.started && !B.over) cls.push('next');
      if (ahead <= B.freeze) cls.push('frz');
      if (ic && B.boss && ahead <= B.boss.stun) cls.push('stn');
    }
    const fs = foesAfter(j);
    const dots = fs.length ? `<span class="fdots">${fs.map(f => `<i class="${f.intent.kind === 'atk' ? 'a' : 'm'}"></i>`).join('')}</span>` : '';
    p += `<span class="${cls.join(' ')}" title="${pipTitle(j, n, fs)}">${ic ? icon(ic) : `<i>${j}</i>`}${dots}</span>`;
  }
  q('#pips').innerHTML = p;
  const ob = q('#olBar');
  ob.style.setProperty('--v', B.ol / B.olMax);
  ob.classList.toggle('hot', B.ol >= B.olMax * 0.7);
  q('#olTxt').innerHTML = B.freeze > 0 ? `<b class="frz-t">시스템 정지 ${B.freeze}코</b>` : `<b>${B.ol}</b> / ${B.olMax}`;
  const ms = q('#meSub');
  ms.textContent = B.freeze > 0 ? `시스템 정지 — ${B.freeze}코스트 동안 마비` : B.hp <= 1 && B.started ? '위태로움 — 한 번만 더 맞으면 쓰러진다' : '1시 · 재귀의 권능';
  ms.className = 'me-sub' + (B.freeze > 0 ? ' frz' : B.hp <= 1 && B.started ? ' low' : '');
  const co = coach();
  const ce = q('#coach');
  ce.textContent = co.t; ce.title = co.t;
  ce.className = 'coach' + (co.tone ? ' t-' + co.tone : '');
  // 유물 · 이식
  const rs = [...B.relicIds || [], '|', ...B.implantIds || []].join(',');
  if (rs !== relicSig) {
    relicSig = rs;
    q('#bRelics').innerHTML = (B.relicIds || []).map(id => { const R = RELICS[id]; return `<span class="relic r-${R.rarity}" data-tip="relic:${id}">${icon(R.icon)}</span>`; }).join('')
      + (B.implantIds || []).map(id => { const R = IMPLANTS[id]; return `<span class="relic r-implant implant" data-tip="implant:${id}">${icon(R.icon)}</span>`; }).join('');
  }
}

function coach() {
  if (!B.started || B.over) return { t: '', tone: '' };
  const me = K(B.p.r, B.p.c);
  if (B.freeze > 0) return { t: `시스템 정지 — 눌러도 코스트만 빠진다 (남은 ${B.freeze}코)`, tone: 'volt' };
  const next = B.spent + 1;
  const soonAll = [], soonHit = [];
  const add = (name, hit) => { soonAll.push(name); if (hit) soonHit.push(name); };
  if (B.amb && !B.ambFired && next === B.ambushAt && !ambCancelled()) add('기습', B.amb.cells.has(me));
  if (B.atk && B.costLeft === 1 && !atkCancelled()) add('턴 공격', B.atk.has(me));
  for (const f of liveFoes()) if (f.intent && f.intent.kind === 'atk' && dueIn(f) === 1) add(`${T(f).short} ${T(f).atkShort}`, f.intent.cells.has(me));
  if (soonHit.length) return { t: `다음 행동 뒤 ${soonHit.join('·')} — 이 칸 밖에서 끝내기`, tone: 'danger' };
  if (soonAll.length) return { t: `다음 행동 뒤 ${soonAll.join('·')} — 여기서 끝내면 안전`, tone: 'ok' };
  if (B.amb && !B.ambFired && next === B.ambushAt && ambCancelled()) return { t: '기습 차례 — 보스 정지로 무력화', tone: 'ok' };
  if (B.atk && B.costLeft === 1 && atkCancelled()) return { t: '턴 공격 차례 — 보스 정지로 무력화', tone: 'ok' };
  if (B.amb && !B.ambFired && B.amb.cells.has(me)) return { t: `빨간 줄 위 — ${B.ambushAt}번째 행동까지 대피하세요`, tone: 'danger' };
  const later = liveFoes().filter(f => f.intent && f.intent.kind === 'atk' && dueIn(f) === 2 && f.intent.cells.has(me));
  if (later.length) return { t: `${later.map(f => T(f).short).join('·')} 조준 중 — 2번째 행동 뒤 공격`, tone: 'warn' };
  if (B.atk && B.atk.has(me)) return { t: '주황 범위 안 — 턴 공격 전에 벗어나세요', tone: 'warn' };
  if (B.amb && !B.ambFired) return { t: `안전 지대 — 기습은 ${B.ambushAt}번째 행동 뒤에 폭발`, tone: 'ok' };
  if (B.atk) return { t: '주황 범위 밖 — 공격할 타이밍', tone: 'ok' };
  if (liveFoes().length) return { t: '적 공격 범위 밖 — 공격할 타이밍', tone: 'ok' };
  return { t: '', tone: '' };
}

// 카드
export function cardStatHTML(def, live) {
  if (def.junk) return '<b>—</b><small>저주</small>';
  if (def.shape) { const d = live ? cardDamage(def) : def.dmg; return `<b>${d}</b><small>${def.hot && live && B.ol >= 50 ? `과열 ×${def.hot}` : '피해'}</small>`; }
  if (def.shield) return `<b>+${def.shield}</b><small>실드</small>`;
  if (def.leap) return `<b>${live ? leapOf(def) : def.leap}</b><small>칸 도약</small>`;
  if (def.heal) return `<b>+${def.heal}</b><small>HP</small>`;
  if (def.draw) return `<b>+${def.draw}</b><small>뽑기</small>`;
  if (def.cool) return `<b>−${def.cool}</b><small>과부하</small>`;
  if (def.delayAll) return '<b>Ⅱ</b><small>행동 정지</small>';
  if (def.back) return '<b>↺</b><small>되감기</small>';
  return '';
}
export function cardTagsHTML(def, id, live) {
  const t = [];
  const ol = live ? nextOl(def, id) : (def.ol || 0);
  if (def.rapid) t.push('<em class="t-rap">연사</em>');
  if (def.persist) t.push('<em class="t-per">상주</em>');
  if (def.exhaust) t.push('<em class="t-exh">소멸</em>');
  if (ol) t.push(`<em class="t-ol">${icon('bolt')}${ol}</em>`);
  if (def.bossOl) t.push(`<em class="t-bol">보스+${def.bossOl}</em>`);
  if (def.push) t.push('<em>밀치기</em>');
  if (def.delay) t.push('<em>정지</em>');
  return t.join('');
}
export function miniRangeHTML(def) {
  if (!def.shape) return `<span class="c-mini icon">${icon(KINDS[def.kind].icon)}</span>`;
  const on = new Set(SHAPES[def.shape].cells.map(([dr, dc]) => `${dr},${dc}`));
  const rows = SHAPES[def.shape].cells.some(([dr]) => dr > 0) ? [-2, 1] : [-4, 0];
  const cols = SHAPES[def.shape].cells.some(([, dc]) => Math.abs(dc) > 1) ? [-2, 2] : [-1, 1];
  let h = '';
  for (let dr = rows[0]; dr <= rows[1]; dr++) for (let dc = cols[0]; dc <= cols[1]; dc++) h += `<i class="${dr === 0 && dc === 0 ? 'me' : on.has(`${dr},${dc}`) ? 'on' : ''}"></i>`;
  return `<span class="c-mini" style="grid-template-columns:repeat(${cols[1] - cols[0] + 1},9px)">${h}</span>`;
}

function renderHand() {
  const frozen = B.freeze > 0;
  const foeSig = B.foes.map(f => f.hp > 0 ? `${f.r}${f.c}` : '-').join('');
  const sig = [B.hand.map(h => h.uid).join(','), B.p.r, B.p.c, foeSig, frozen, B.sel, B.over, B.started, B.lastAct, B.chain, B.ol >= 50, B.hp, B.firstStrikeUsed].join('|');
  if (sig !== handSig) {
    handSig = sig;
    q('#hand').innerHTML = B.hand.map((inst, i) => {
      const def = cardDef(inst);
      const kind = KINDS[def.kind];
      const reach = def.shape ? validDirs(def).length > 0 : true;
      const cls = ['card', 'k-' + def.kind, 'r-' + def.rarity];
      if (def.upgraded) cls.push('up');
      if (B.sel === i) cls.push('sel');
      if (frozen) cls.push('frz'); else if (!reach) cls.push('off');
      const flag = frozen ? '<span class="c-flag frz">마비</span>' : !reach ? '<span class="c-flag off">사거리 밖</span>' : def.junk ? '<span class="c-flag junk">1코로 치우기</span>' : '';
      return `<button class="${cls.join(' ')}" type="button" tabindex="-1" data-i="${i}" aria-label="${def.name} · ${kind.label}">
        <span class="c-top"><span class="c-cost">1</span><span class="c-kind">${icon(kind.icon)}${kind.label}</span><span class="c-key">${i + 1}</span></span>
        <span class="c-name">${def.name}</span>
        <span class="c-mid">${miniRangeHTML(def)}<span class="c-stat">${cardStatHTML(def, true)}</span></span>
        <span class="c-tags">${cardTagsHTML(def, inst.id, true)}</span>${flag}</button>`;
    }).join('');
    fitHand();
  }
  const db = q('#drawBtn');
  const canDraw = B.hand.length < B.handMax && (B.deck.length + B.discard.length) > 0;
  db.classList.toggle('dis', B.freeze <= 0 && !canDraw);
  db.innerHTML = `<kbd>Q</kbd><span class="c-cost">1</span>${icon('deck')}<b>뽑기</b><small>덱 ${B.deck.length}<br>버림 ${B.discard.length}</small>`;
}
function fitHand() {
  const hand = q('#hand');
  const n = B.hand.length;
  if (!n) return;
  const w = 140, gap = 10, avail = 960;
  const natural = n * w + (n - 1) * gap;
  hand.style.setProperty('--ov', (natural <= avail || n < 2 ? gap : Math.floor((avail - n * w) / (n - 1))) + 'px');
}

// 설명 칸 · 전투 기록
const DETAIL_EMPTY = '<p class="d-empty"><b>카드</b>에 마우스를 올리면 범위와 효과가, <b>적</b>에 올리면 체력과 다음 행동이 여기에 나와요.<br>카드를 고른 뒤 판의 칸을 누르면 그 방향으로 조준해요.</p>';
function renderFoot() {
  const i = B.sel !== null ? B.sel : B.hover;
  const live = B.started && !B.over;
  const fi = B.inspect && foeById(B.inspect);
  const card = live && i !== null && !!B.hand[i];
  const foe = live && !card && !!fi && fi.hp > 0;
  q('#detailTitle').textContent = card ? (B.sel !== null ? '고른 카드' : '카드') : foe ? '적 정보' : '설명';
  q('#detail').innerHTML = card ? detailHTML(i) : foe ? foeDetailHTML(fi) : DETAIL_EMPTY;
  const sig = `${B.logSeq}|${B.logs.length}`;
  if (sig !== logSig) {
    const fresh = B.logSeq !== logSeen;
    logSig = sig; logSeen = B.logSeq;
    const box = q('#log');
    box.innerHTML = B.logs.slice(-14).map(l => `<p class="${l.cls ? 'l-' + l.cls : ''}">${esc(l.t)}</p>`).join('');
    // 새로 적힌 줄은 타자로
    const last = box.lastElementChild;
    if (fresh && last) typeInto(last, last.innerHTML, { mul: 0.25, cursor: false });
  }
}
function targetsText(t) {
  const names = [];
  if (t.boss) names.push('보스');
  for (const f of t.foes) names.push(T(f).short + (T(f).guard && inFront(f, B.p) ? '(방패)' : ''));
  return names.length > 2 ? `${names.slice(0, 2).join('·')} 외 ${names.length - 2}` : names.join('·');
}
function detailHTML(i) {
  const inst = B.hand[i], def = cardDef(inst), kind = KINDS[def.kind];
  const frozen = B.freeze > 0;
  let range = '자신', state = '<span class="st good">사용 가능</span>';
  const eff = [];
  let multi = false;
  if (def.shape) {
    const v = validDirs(def);
    const dir = aimFor(def);
    multi = v.length > 1;
    range = `${SHAPES[def.shape].label}${dir ? ` · ${DIR_LABEL[dir]}쪽` : ''}${multi ? ` · 방향 ${v.length}곳` : ''}`;
    state = dir ? `<span class="st good">명중 ${targetsText(strikeTargets(def.shape, B.p, dir))}</span>` : `<span class="st bad">사거리 밖${B.mode === 'boss' ? ` · 보스는 ${reachText(def.shape)}` : ''}</span>`;
    eff.push(`피해 <b>${cardDamage(def)}</b>`);
    const ol = nextOl(def, inst.id);
    if (ol) eff.push(`내 과부하 <b class="v">+${ol}</b>`);
    if (def.bossOl && B.mode === 'boss') eff.push(`보스 과부하 <b class="g">+${def.bossOl}</b>`);
  } else if (def.leap) {
    range = `상하좌우 최대 ${leapOf(def)}칸`;
    state = '<span class="st good">방향을 고르세요</span>';
  }
  const rest = effectLine(Object.assign({}, def, { shape: null, dmg: null, ol: def.shape ? null : def.ol, bossOl: def.shape ? null : def.bossOl }));
  if (rest) eff.push(rest);
  if (frozen) state = '<span class="st frz">마비 중 — 코스트만 소모</span>';
  const use = lastPointer !== 'mouse'
    ? `<button class="btn-use" type="button" id="btnUse">${def.leap && !def.shape && !frozen ? '칸을 눌러 도약' : '사용 · 1코'}</button>`
    : `<span class="hint">${def.leap && !def.shape && !frozen ? 'WASD로 방향 선택' : multi && !frozen ? 'WASD·칸으로 방향 → 클릭/Space' : '클릭 또는 Space로 사용'}</span>`;
  return `<div class="d-head"><span class="d-kind k-${def.kind}">${icon(kind.icon)}${kind.label} · 1코스트</span><span class="d-key">${i + 1}</span></div>
    <b class="d-name">${def.name}</b>
    <p class="d-text">${def.desc}</p>
    <dl class="d-facts"><dt>범위</dt><dd>${range}</dd><dt>효과</dt><dd>${eff.join(' · ') || '—'}</dd></dl>
    <div class="d-foot">${state}${use}</div>`;
}
function foeDetailHTML(f) {
  const D = T(f), it = f.intent, n = dueIn(f);
  const next = it && it.skipped ? '<b class="g">행동을 건너뜀</b>' : !it || it.kind === 'wait' ? '대기' : it.kind === 'atk' ? `<b class="fo">${D.atk}</b> · 피해 ${D.dmg}` : `${DIR_LABEL[it.dir]}쪽으로 ${it.dist > 1 ? `${it.dist}칸 ` : ''}이동`;
  const guard = D.guard ? (inFront(f, B.p) ? '<span class="st bad">지금 정면 · 피해 ½</span>' : '<span class="st good">옆·뒤 · 피해 그대로</span>') : '';
  const traits = f.traits.map(t => `<span class="st bad">${ELITE_TRAITS[t].name} — ${ELITE_TRAITS[t].desc}</span>`).join('');
  return `<div class="d-head"><span class="d-kind k-foe">${icon('foe')}${D.elite ? '정예' : D.machine ? '기계' : '인류'}</span></div>
    <div class="d-title"><span class="d-sd">${foeSdHTML(f.type)}</span><b class="d-name">${D.name}</b></div>
    <p class="d-text">${D.desc}</p>
    <dl class="d-facts"><dt>체력</dt><dd><b>${f.hp}</b> / ${f.max}</dd><dt>순번</dt><dd>${f.ph ? '1·3' : '2·4'}번째 행동 뒤에 움직임</dd><dt>다음</dt><dd><b>${n}</b>번째 행동 뒤 ${next}</dd></dl>
    ${guard || traits ? `<div class="d-foot">${guard}${traits}</div>` : ''}`;
}

let rosterPrevLive = null;
function renderRoster() {
  const box = q('#roster');
  box.hidden = !B.foes.length;
  if (!B.foes.length) return;
  const live = B.started && !B.over;
  const sig = [B.mode, live, B.inspect, B.totalP, ...B.foes.map(f => `${f.uid}:${f.hp}:${f.intent ? f.intent.kind + (f.intent.dir || '') + (f.intent.skipped ? 's' : '') : '-'}`)].join('|');
  if (sig === rosterSig) return;
  rosterSig = sig;
  const alive = liveFoes().length;
  q('#rosterTitle').textContent = `${B.mode === 'boss' ? '졸개' : '적'} ${alive} / ${B.foes.length}`;
  q('#roList').innerHTML = B.foes.map(f => {
    const D = T(f), it = f.intent, n = dueIn(f), dead = f.hp <= 0;
    const act = dead ? '<span class="ro-next">쓰러짐</span>'
      : it && it.skipped ? '<span class="ro-next skip">멈춤</span>'
      : !live || !it || it.kind === 'wait' ? '<span class="ro-next">대기</span>'
      : `<span class="ro-next ${it.kind} n${n}" title="${n}번째 행동 뒤 ${it.kind === 'atk' ? D.atk : '이동'}"><b>${n}</b>${it.kind === 'atk' ? D.atkShort : '이동'}</span>`;
    return `<div class="ro-row${dead ? ' dead' : ''}${B.inspect === f.uid ? ' on' : ''}" data-uid="${f.uid}">
      <span class="ro-art">${foeSdHTML(f.type)}</span>
      <span class="ro-main"><span class="ro-name">${D.name}${D.elite ? '<span class="elite">정예</span>' : ''}<small>${f.ph ? '1·3' : '2·4'}번째 뒤</small></span><span class="ro-hp"><i><i style="width:${f.hp / f.max * 100}%"></i></i>${f.hp}</span></span>
      ${act}</div>`;
  }).join('');
}

/* ═════════════ 표정 (왼쪽 얼굴 칸 · SD 자세) ═════════════ */
let poseTemp = null, poseTimer = 0;
export function flashPose(face, ms) {
  poseTemp = face;
  clearTimeout(poseTimer);
  poseTimer = setTimeout(() => { poseTemp = null; renderPose(); }, ms);
  renderPose();
}
function currentPose() {
  if (B.over) return B.won ? 'smug' : 'wounded';
  if (poseTemp) return poseTemp;
  if (B.freeze > 0) return 'overload';
  return 'idle';
}
function renderPose() {
  if (!root) return;
  const pose = currentPose();
  q('#player').dataset.pose = pose;
  const url = faceUrl(pose);
  const mf = q('#meFaceImg');
  if (mf && url && mf.getAttribute('src') !== url) {
    const key = faceKeyOf(url);
    const [fx, fy] = (FACES[key] && FACES[key].center) || FACE_CENTER;
    mf.style.left = `${((0.5 - 4 * fx) * 100).toFixed(1)}%`;
    mf.style.top = `${((0.5 - 6 * fy) * 100).toFixed(1)}%`;
    mf.setAttribute('src', url);
    flash(q('#meFace'), 'swap', 280);
  }
}

/* ═════════════ 알림 · 말풍선 ═════════════ */
let toastT = 0;
export function btoast(msg) {
  const el = q('#bToast');
  if (!el) return;
  el.hidden = false;
  typeInto(el, esc(msg), { mul: 0.3, cursor: false });
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, 1600);
}
let barkT = 0;
export function bark(kind) {
  if (B.mode !== 'boss' || !B.boss) return;
  const lines = B.boss.def.barks[kind];
  if (!lines) return;
  const el = q('#bark');
  el.textContent = lines[Math.floor(Math.random() * lines.length)];
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(barkT);
  barkT = setTimeout(() => { el.hidden = true; }, 2300);
}
export function foeSay(f, kind) {
  const lines = FOE_BARKS[f.type] && FOE_BARKS[f.type][kind];
  if (lines) FX.say(f, lines[Math.floor(Math.random() * lines.length)]);
}

/* ═════════════ 연출 ═════════════ */
const shakeOk = () => SET.shake;
export const FX = {
  at(r, c, cls, life = 600) {
    const d = document.createElement('div');
    d.className = 'fx-cell ' + cls;
    d.style.setProperty('--r', r); d.style.setProperty('--c', c);
    q('#fx').appendChild(d);
    setTimeout(() => d.remove(), life);
  },
  num(r, c, text, cls = '') {
    const d = document.createElement('div');
    d.className = 'fx-num ' + cls;
    d.innerHTML = text;
    d.style.left = `calc(${c} * (var(--cs) + var(--gap)) + var(--cs) / 2)`;
    d.style.top = `calc(${r} * (var(--cs) + var(--gap)) + var(--cs) * .32)`;
    q('#fx').appendChild(d);
    setTimeout(() => d.remove(), 1000);
  },
  shake(level) { if (shakeOk()) flash(q('#board'), 'shake-' + level, 480); },
  arming() { flash(q('#board'), 'arming', 520); flash(q('#loopGear'), 'turn', 520); },
  reveal() { flash(q('#board'), 'revealing', 420); },
  hop() { flash(q('#player'), 'hop', 200); },
  bump(f) { flash(foeEl(f), 'bump', 300); },
  ward() { flash(q('#player'), 'blocked', 420); },
  heal() { SFX.heal(); this.num(B.p.r, B.p.c, '+HP', 'ok'); },
  foeHeal(f) { flash(foeEl(f), 'healed', 520); this.num(f.r, f.c, '+2', 'ok'); },
  timeStop() {
    SFX.stun();
    const d = document.createElement('div'); d.className = 'fx-stop'; q('#fx').appendChild(d); setTimeout(() => d.remove(), 720);
    for (const f of liveFoes()) this.num(f.r, f.c, '멈춤', 'ok');
  },
  barrels(cols) { root.querySelectorAll('#bossArt .brl').forEach(g => { if (cols.includes(+g.dataset.c)) flash(g, 'fire', 320); }); },
  async ambushBlast(amb) {
    let i = 0;
    for (const s of amb.segs) for (let j = 0; j < s.len; j++) {
      const r = s.horiz ? s.idx : s.start + j, c = s.horiz ? s.start + j : s.idx;
      setTimeout(() => this.at(r, c, 'fx-boom', 560), (i++) * 26);
    }
    SFX.boom(); this.shake('m');
    await wait(Math.min(460, 200 + i * 26));
  },
  async attackBlast(cells, pat) {
    const arr = [...cells];
    const cols = [...new Set(arr.map(k => RC(k)[1]))];
    this.barrels(cols);
    if (pat.nail) { SFX.nail(); cols.forEach((c, i) => setTimeout(() => this.nail(c), i * 45)); await wait(150); }
    arr.forEach(k => { const [r, c] = RC(k); setTimeout(() => this.at(r, c, 'fx-boom amber', 620), (r - 1) * 55); });
    SFX.heavy(); this.shake('l');
    await wait(470);
  },
  nail(c) {
    const d = document.createElement('div');
    d.className = 'fx-nail';
    d.style.left = `calc(${c} * (var(--cs) + var(--gap)) + var(--cs) / 2)`;
    d.style.top = 'calc(var(--cs) * .9)';
    d.style.height = 'calc(4 * (var(--cs) + var(--gap)))';
    q('#fx').appendChild(d);
    setTimeout(() => d.remove(), 420);
  },
  async cancel(cells) {
    [...(cells || [])].forEach(k => { const [r, c] = RC(k); this.at(r, c, 'fx-void', 520); });
    this.num(0, 2, '무력화', 'ok');
    SFX.stun();
    await wait(360);
  },
  async cardStrike(cells, def) {
    SFX.card();
    const list = cells.slice().sort((a, b) => manh({ r: a[0], c: a[1] }, B.p) - manh({ r: b[0], c: b[1] }, B.p));
    const cls = def.kind === 'cult' ? 'fx-zap cult' : def.hot && B.ol >= 50 ? 'fx-zap hot' : 'fx-zap';
    list.forEach(([r, c], i) => setTimeout(() => this.at(r, c, cls, 420), i * 40));
    this.hop();
    await wait(130 + list.length * 40);
  },
  foeHit(f, dmg, o) {
    flash(foeEl(f), 'hit', 440);
    this.num(f.r, f.c, `−${dmg}${o.guarded ? '<small>방패 ½</small>' : ''}`, o.big ? 'big' : '');
    if (o.guarded) SFX.block();
  },
  foeDie(f) { SFX.foeDie(); this.at(f.r, f.c, 'fx-boom rose', 560); },
  async foeAttack(f, it) {
    const el = foeEl(f);
    flash(el, 'lunge', 360);
    const cells = [...it.cells].map(RC);
    const ai = T(f).ai;
    if (ai === 'line') {
      T(f).machine ? SFX.beam() : SFX.shot();
      this.at(f.r, f.c, 'fx-zap cult', 300);
      if (cells.length) this.tracer(f, it.dir, cells.length);
      cells.sort((a, b) => manh({ r: a[0], c: a[1] }, f) - manh({ r: b[0], c: b[1] }, f));
      cells.forEach(([r, c], i) => setTimeout(() => this.at(r, c, 'fx-boom rose', 420), 60 + i * 30));
      this.shake('s');
      await wait(300);
    } else if (ai === 'guard' || ai === 'chaser') {
      await wait(90);
      ai === 'chaser' ? SFX.bite() : SFX.heavy();
      cells.forEach(([r, c]) => this.at(r, c, 'fx-boom amber', 560));
      this.shake('m');
      await wait(360);
    } else {
      SFX.toss();
      await this.shell(f, it.center);
      SFX.boom();
      cells.forEach(([r, c], i) => setTimeout(() => this.at(r, c, 'fx-boom rose', 520), i * 30));
      this.shake('m');
      await wait(340);
    }
  },
  tracer(f, dir, n) {
    const d = document.createElement('div');
    const [dr, dc] = DIRS[dir];
    const horiz = !dr;
    d.className = 'fx-tracer ' + (horiz ? 'h' : 'v');
    const step = 'var(--cs) + var(--gap)';
    const cx = `calc(${f.c} * (${step}) + var(--cs) / 2)`, cy = `calc(${f.r} * (${step}) + var(--cs) * .42)`;
    const len = `calc(${n} * (${step}))`;
    if (horiz) {
      d.style.top = cy; d.style.width = len;
      d.style.left = dc > 0 ? cx : `calc(${cx} - ${len})`;
      d.style.setProperty('--to', dc > 0 ? 'left' : 'right');
      d.style.setProperty('--tg', dc > 0 ? '90deg' : '270deg');
    } else {
      d.style.left = cx; d.style.height = len;
      d.style.top = dr > 0 ? `calc(${f.r} * (${step}) + var(--cs) / 2)` : `calc(${f.r} * (${step}) + var(--cs) / 2 - ${len})`;
      d.style.setProperty('--to', dr > 0 ? 'top' : 'bottom');
      d.style.setProperty('--tg', dr > 0 ? '180deg' : '0deg');
    }
    q('#fx').appendChild(d);
    setTimeout(() => d.remove(), 320);
  },
  async shell(f, to) {
    const a = CELLS[K(f.r, f.c)], b = CELLS[K(to.r, to.c)];
    const d = document.createElement('div');
    d.className = 'fx-shell';
    const x0 = a.offsetLeft + a.offsetWidth / 2, y0 = a.offsetTop + a.offsetHeight * 0.3;
    const x1 = b.offsetLeft + b.offsetWidth / 2, y1 = b.offsetTop + b.offsetHeight / 2;
    d.style.left = x0 + 'px'; d.style.top = y0 + 'px';
    q('#fx').appendChild(d);
    const lift = Math.max(30, Math.abs(x1 - x0) * 0.35 + 20);
    if (d.animate) d.animate([
      { transform: 'translate(0,0) scale(.8)' },
      { transform: `translate(${(x1 - x0) / 2}px,${(y1 - y0) / 2 - lift}px) scale(1.15)` },
      { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.9)` },
    ], { duration: RM.matches ? 133 : 380, easing: 'ease-in-out', fill: 'forwards' });
    try { await wait(380); } finally { d.remove(); }
  },
  async blast(cells) {
    SFX.boom(); SFX.heavy();
    cells.forEach(([r, c], i) => setTimeout(() => this.at(r, c, 'fx-boom', 600), i * 25));
    this.shake('l');
    flash(root, 'hurt-vig', 560);
    await wait(420);
  },
  say(f, text) {
    const d = document.createElement('div');
    d.className = 'fx-say';
    d.textContent = text;
    d.style.left = `calc(${f.c} * (var(--cs) + var(--gap)) + var(--cs) / 2)`;
    d.style.top = `calc(${f.r} * (var(--cs) + var(--gap)) - var(--cs) * .28)`;
    q('#fx').appendChild(d);
    setTimeout(() => d.remove(), 1950);
  },
  bossHit(cols, dmg, big) {
    flash(q('#bossRow'), 'hit', 340);
    const c = cols.length ? cols[Math.floor(cols.length / 2)] : 2;
    this.num(0, c, `−${dmg}`, big ? 'big' : '');
    this.shake(big ? 'm' : 's');
  },
  async playerHit(dmg) {
    SFX.hurt();
    flash(q('#player'), 'hit', 440);
    flash(root, 'hurt-vig', 560);
    flash(q('#vitals'), 'hurt', 420);
    this.num(B.p.r, B.p.c, dmg ? `−${dmg}` : '0', 'hurt');
    await wait(340);
  },
  async block() { SFX.block(); flash(q('#player'), 'blocked', 420); this.num(B.p.r, B.p.c, '막음', 'block'); await wait(280); },
  freeze() { SFX.zap(); flash(root, 'volt-vig', 700); this.num(B.p.r, B.p.c, '시스템 정지', 'volt'); },
  stun() { SFX.stun(); flash(q('#bossRow'), 'hit', 340); this.num(0, 2, '보스 과부하 정지', 'volt'); },
  fizzle() { flash(q('#player'), 'fizz', 320); this.num(B.p.r, B.p.c, '마비', 'volt'); },
  async bossDown() {
    for (let i = 0; i < 6; i++) setTimeout(() => { this.at(0, i % 5, 'fx-boom', 600); this.shake('l'); }, i * 120);
    SFX.heavy();
    await wait(900);
  },
  async playerDown() { flash(q('#player'), 'hit', 600); this.shake('l'); await wait(700); },
};

// core.js의 H에 연결
export function wireHooks() {
  H.render = render;
  H.renderBoard = () => { renderBoard(); renderFoot(); };
  H.toast = btoast;
  H.bark = bark;
  H.say = foeSay;
  H.pose = flashPose;
  H.fx = FX;
  H.sfx = SFX;
}
export const cellEl = (r, c) => CELLS[K(r, c)];
export { renderFoot, renderRoster };
