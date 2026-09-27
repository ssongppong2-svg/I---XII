// 전투 입력 — 키보드 · 마우스 · 터치
import { B, K, DIR_LABEL, act, aimFor, validDirs, dirAtCell, foeAt } from './core.js';
import { cardDef } from '../data/cards.js';
import { render, renderBoard, renderFoot, renderRoster, preview, selectedDef, lastPointer, btoast, viewRoot } from './view.js';
import { SFX } from '../ui/sfx.js';

let hoverInspect = false;

function onCell(r, c) {
  if (!B.started || B.over) return;
  const def = selectedDef();
  if (def && def.leap && !def.shape) {
    const t = preview().leap.get(K(r, c));
    if (t) { act({ type: 'card', i: B.sel, dir: t.dir, dist: t.dist }); return; }
  }
  if (def && def.shape && B.freeze <= 0) {
    const d = dirAtCell(def, r, c);
    if (d) {
      if (d === aimFor(def)) { act({ type: 'card', i: B.sel, dir: d }); return; }
      B.aim = d; SFX.step(); render();
      return;
    }
  }
  if (r < B.top) return;
  const f = foeAt(r, c);
  if (f) {
    if (hoverInspect && B.inspect === f.uid) hoverInspect = false;
    else { B.inspect = B.inspect === f.uid ? null : f.uid; hoverInspect = false; }
    render();
    return;
  }
  const dr = r - B.p.r, dc = c - B.p.c;
  if (Math.abs(dr) + Math.abs(dc) === 1) { act({ type: 'move', dir: dr < 0 ? 'up' : dr > 0 ? 'down' : dc < 0 ? 'left' : 'right' }); return; }
  if (B.sel !== null || B.inspect) { B.sel = null; B.inspect = null; hoverInspect = false; render(); }
}

function onCellHover(r, c) {
  if (!B.started || B.over) return;
  const def = selectedDef();
  if (def && def.shape && B.freeze <= 0 && r >= 0) {
    const d = dirAtCell(def, r, c);
    if (d && d !== aimFor(def)) { B.aim = d; renderBoard(); renderFoot(); }
    return;
  }
  const f = r >= B.top ? foeAt(r, c) : null;
  if (f && B.hover === null && B.sel === null) {
    if (B.inspect !== f.uid) { B.inspect = f.uid; hoverInspect = true; renderBoard(); renderFoot(); renderRoster(); }
  } else if (hoverInspect && B.inspect) {
    B.inspect = null; hoverInspect = false; renderBoard(); renderFoot(); renderRoster();
  }
}

export function useSelected() {
  if (B.sel === null || !B.hand[B.sel]) return;
  const def = cardDef(B.hand[B.sel]);
  if (def.leap && !def.shape && B.freeze <= 0) { btoast('도약할 방향을 고르세요 — WASD 또는 점선 칸'); return; }
  act({ type: 'card', i: B.sel, dir: def.shape ? aimFor(def) || undefined : undefined });
}
function selectCard(i) {
  B.sel = i; B.hover = null;
  const def = cardDef(B.hand[i]);
  if (def.shape) B.aim = aimFor(def) || B.aim;
  render();
}
function onCardClick(i) {
  if (!B.started || B.over || !B.hand[i]) return;
  const def = cardDef(B.hand[i]);
  if (lastPointer === 'mouse') {
    // 마우스: 올려서 미리보기, 클릭하면 바로 사용. 도약 · 여러 방향 카드는 먼저 선택 → 칸을 눌러 방향
    if (def.leap && !def.shape && B.freeze <= 0) { if (B.sel === i) { B.sel = null; render(); } else selectCard(i); return; }
    if (def.shape && B.freeze <= 0 && B.sel !== i && validDirs(def).length > 1) { selectCard(i); return; }
    act({ type: 'card', i, dir: def.shape ? aimFor(def) || undefined : undefined });
    return;
  }
  if (B.sel === i) useSelected(); else selectCard(i);
}

const CODE_DIR = { KeyW: 'up', KeyA: 'left', KeyS: 'down', KeyD: 'right', ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right' };
// 전투 화면이 받은 키 — 처리했으면 true
export function battleKey(e) {
  if (!B.started || B.over) return false;
  const dir = CODE_DIR[e.code];
  if (dir) {
    e.preventDefault();
    const def = selectedDef();
    if (def && def.leap && !def.shape) act({ type: 'card', i: B.sel, dir });
    else if (def && def.shape && B.freeze <= 0) {
      if (validDirs(def).includes(dir)) { B.aim = dir; SFX.step(); render(); }
      else { btoast(`${DIR_LABEL[dir]}쪽에는 닿는 적이 없어요 — 이동은 Esc 뒤에`); SFX.deny(); }
    }
    else act({ type: 'move', dir });
    return true;
  }
  const dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
  if (dm) {
    const i = +dm[1] - 1;
    if (i < B.hand.length) { if (B.sel === i) useSelected(); else selectCard(i); }
    return true;
  }
  if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); useSelected(); return true; }
  if (e.code === 'KeyQ') { act({ type: 'draw' }); return true; }
  if (e.key === 'Escape' && (B.sel !== null || B.inspect)) { B.sel = null; B.inspect = null; render(); return true; }
  return false;
}

export function bindInput() {
  const root = viewRoot();
  const board = root.querySelector('#board');
  board.addEventListener('click', e => {
    const cell = e.target.closest('.cell, .bcell');
    if (cell) onCell(+cell.dataset.r, +cell.dataset.c);
  });
  board.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const cell = e.target.closest('.cell, .bcell');
    if (cell) onCellHover(+cell.dataset.r, +cell.dataset.c);
  });
  board.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') onCellHover(-1, -1); });
  const hand = root.querySelector('#hand');
  hand.addEventListener('mousedown', e => e.preventDefault());
  hand.addEventListener('click', e => { const b = e.target.closest('.card'); if (b) onCardClick(+b.dataset.i); });
  hand.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const b = e.target.closest('.card');
    if (!b) return;
    const i = +b.dataset.i;
    if (B.hover !== i) { B.hover = i; renderBoard(); renderFoot(); }
  });
  hand.addEventListener('pointerleave', () => { if (B.hover !== null) { B.hover = null; renderBoard(); renderFoot(); } });
  const db = root.querySelector('#drawBtn');
  db.addEventListener('mousedown', e => e.preventDefault());
  db.addEventListener('click', () => act({ type: 'draw' }));
  root.querySelector('#detail').addEventListener('click', e => { if (e.target.closest('#btnUse')) useSelected(); });
  // 적 목록: 올리면 판에서 짚고, 누르면 고정
  const rl = root.querySelector('#roList');
  const rowOf = e => { const row = e.target.closest('.ro-row:not(.dead)'); return row && B.started && !B.over ? +row.dataset.uid : null; };
  rl.addEventListener('pointerover', e => {
    const uid = rowOf(e);
    if (uid === null || B.inspect === uid || (B.inspect && !hoverInspect)) return;
    B.inspect = uid; hoverInspect = true; renderBoard(); renderFoot(); renderRoster();
  });
  rl.addEventListener('pointerleave', () => { if (hoverInspect && B.inspect) { B.inspect = null; hoverInspect = false; renderBoard(); renderFoot(); renderRoster(); } });
  rl.addEventListener('click', e => {
    const uid = rowOf(e);
    if (uid === null) return;
    if (hoverInspect && B.inspect === uid) hoverInspect = false;
    else { B.inspect = B.inspect === uid ? null : uid; hoverInspect = false; }
    render();
  });
}
