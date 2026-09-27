// 전리품 — 부품 · 톱니 조각 · 유물은 바로 들어오고, 카드는 3장 중 1장 (건너뛰기 가능), 보스 유물은 3개 중 1개
// 받을 것은 RUN.reward 에 적혀 있다 — 이 화면에서 꺼도 이어 할 때 다시 여기로, 두 번 받지 않게
import { register, go } from '../ui/router.js';
import { RUN, gainParts, gainShards, addRelic, addCard, heal, dm, mods } from '../game/run.js';
import { autosave } from '../game/save.js';
import { finishNode, storyOf, sceneOpts } from '../game/flow.js';
import { RELICS } from '../data/relics.js';
import { icon } from '../ui/icons.js';
import { bigCardHTML, relicTip } from '../ui/menus.js';
import { bindTips, hideTip } from '../ui/overlay.js';
import { playScene } from '../scenes/scene.js';
import { SFX } from '../ui/sfx.js';

let root = null, W = null;

async function mount(holder) {
  root = holder;
  W = RUN.reward;
  if (!W) { finishNode(); return; }
  // 승리 대사를 보다가 껐다 — 대사부터
  if (W.win) {
    const st = storyOf(RUN.chapter)[W.win.story];
    if (st && st.win) await playScene(st.win, sceneOpts(W.win.boss));
    if (root !== holder) return;
    W.win = null;
    autosave();
  }
  const rw = W.rewards;
  // 바로 들어오는 것 (한 번만)
  if (!W.granted) {
    gainParts(rw.parts);
    if (rw.shards) gainShards(rw.shards);
    rw.relics.forEach(id => addRelic(id));
    if (rw.after === 'rest') W.restGot = heal(Math.max(1, 2 + dm().restHeal + mods().restHeal));
    W.granted = true;
    autosave();
    SFX.coin();
  }
  const restNote = rw.after === 'rest' ? `기습을 물리친 뒤 쉬었다 — ${W.restGot ? `HP +${W.restGot}` : 'HP는 이미 가득 차 있었다'}` : '';
  const rows = [
    `<div class="rw-row">${icon('parts')}<b>부품 +${rw.parts}</b><small>지금 ${RUN.parts}</small></div>`,
    rw.shards ? `<div class="rw-row shard">${icon('shard')}<b>톱니 조각 +${rw.shards}</b><small>지금 ${RUN.shards}</small></div>` : '',
    ...rw.relics.map(id => `<div class="rw-row relic-r"><span class="relic r-${RELICS[id].rarity}" data-tip="relic:${id}">${icon(RELICS[id].icon)}</span><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></div>`),
    ...rw.note.map(t => `<div class="rw-row note">${icon('hourglass')}<b>${t}</b></div>`),
    restNote ? `<div class="rw-row note">${icon('flame')}<b>${restNote}</b></div>` : '',
  ].join('');
  holder.innerHTML = `<div class="rw">
    <p class="rw-kick">교전 종료</p>
    <h2 class="rw-title">${W.boss ? '보스 격파' : W.caught ? '포위를 뚫었다' : '승리'}</h2>
    <div class="rw-list">${rows}</div>
    ${rw.relicPick.length ? `<h3 class="rw-h">보스 유물 — 하나를 고르세요</h3><div class="rw-relics">${rw.relicPick.map(id => `<button class="rw-relic" type="button" data-id="${id}"><span class="relic big r-${RELICS[id].rarity}">${icon(RELICS[id].icon)}</span><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></button>`).join('')}</div>` : ''}
    ${rw.cards.length ? `<h3 class="rw-h">카드 한 장을 덱에 넣을 수 있어요</h3><div class="rw-cards">${rw.cards.map(id => bigCardHTML(id, { pick: true, extra: `data-id="${id}"` })).join('')}</div>` : ''}
    <div class="rw-foot"><button class="btn-sub" type="button" id="rwSkip">카드 건너뛰기</button><button class="btn-main" type="button" id="rwGo">계속</button></div>
  </div>`;
  holder.querySelector('.rw-cards')?.addEventListener('click', e => { const c = e.target.closest('.card[data-id]'); if (c) takeCard(c.dataset.id); });
  holder.querySelector('.rw-relics')?.addEventListener('click', e => { const b = e.target.closest('.rw-relic'); if (b) takeRelic(b.dataset.id); });
  holder.querySelector('#rwSkip').addEventListener('click', () => { SFX.click(); W.cardTaken = false; autosave(); refresh(); });
  holder.querySelector('#rwGo').addEventListener('click', proceed);
  bindTips(holder.querySelector('.rw-list'), t => relicTip(t.dataset.tip));
  refresh();
}

const needBoss = () => W.rewards.relicPick.length > 0 && !W.bossPick;
function refresh() {
  if (!root) return;
  const go = root.querySelector('#rwGo');
  go.disabled = needBoss();
  go.textContent = needBoss() ? '보스 유물을 고르세요' : W.cardTaken === null && W.rewards.cards.length ? '카드 없이 계속' : '계속';
  root.querySelectorAll('.rw-cards .card').forEach(c => {
    c.classList.toggle('taken', W.cardTaken === c.dataset.id);
    c.classList.toggle('off', W.cardTaken !== null && W.cardTaken !== c.dataset.id);
  });
  root.querySelectorAll('.rw-relic').forEach(b => { b.classList.toggle('taken', b.dataset.id === W.bossPick); b.disabled = !!W.bossPick; });
  root.querySelector('#rwSkip').hidden = !W.rewards.cards.length || W.cardTaken !== null;
}
function takeCard(id) {
  if (W.cardTaken !== null) return;
  addCard(id);
  W.cardTaken = id;
  SFX.gain();
  autosave();
  refresh();
}
function takeRelic(id) {
  if (W.bossPick) return;
  addRelic(id);
  W.bossPick = id;
  SFX.gain();
  autosave();
  refresh();
}
function proceed() {
  if (!W || needBoss()) return;
  SFX.click();
  hideTip();
  const boss = W.boss;
  RUN.reward = null;
  if (boss) { RUN.pending = null; RUN.cleared = RUN.chapter; autosave(); go('chapterend', { clear: true }); return; }
  finishNode();
}
function onKey(e) {
  if (!W || !root || !root.querySelector('.rw')) return false;
  if (e.key === 'Enter') { e.preventDefault(); proceed(); return true; }
  const m = /^(?:Digit|Numpad)([1-3])$/.exec(e.code);
  if (m && W.rewards.cards[+m[1] - 1]) { takeCard(W.rewards.cards[+m[1] - 1]); return true; }
  return false;
}
register('reward', { mount, onKey, unmount() { hideTip(); root = null; W = null; } });
