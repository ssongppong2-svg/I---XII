// 재귀 — 쓰러지면 마지막 저장으로. 챕터 끝 · 준비 중 화면도 여기
import { register, go } from '../ui/router.js';
import { RUN, chapterDef, maxHp } from '../game/run.js';
import { rewind, autosave } from '../game/save.js';
import { nextChapter, startChapter, storyOf, sceneOpts } from '../game/flow.js';
import { playScene } from '../scenes/scene.js';
import { loadAll } from '../ui/assets.js';
import { storyArtKeys } from '../ui/foeart.js';
import { REWIND } from '../data/story/prologue.js';
import { CHAPTERS, LAST_CHAPTER } from '../data/chapters.js';
import { SFX } from '../ui/sfx.js';
import { toast } from '../ui/overlay.js';
import { roman, esc } from '../core/util.js';
import { icon } from '../ui/icons.js';

register('rewind', {
  async mount(holder) {
    holder.innerHTML = '<div class="rewind-bg"><div class="rw-hands"><i></i><i></i></div></div>';
    SFX.rewind();
    await playScene(REWIND, {});
    const ok = rewind();
    if (!ok) { RUN.fallen = false; RUN.hp = maxHp(); startChapter(RUN.chapter); return; }   // 재귀 지점이 없으면 이 장의 처음으로
    // 이야기 전투 직전 · 보스 앞에 새겨진 재귀 지점 — 지도가 아니라 그 칸으로 곧장
    const at = RUN.pending && RUN.map && RUN.map.nodes[RUN.pending];
    if (at) {
      toast(at.type === 'boss' ? '재귀 — 보스 앞으로 돌아왔어요' : '재귀 — 전투 직전으로 돌아왔어요', 'gold');
      go(at.type === 'boss' ? 'battle' : 'node', { nodeId: at.id, retry: true });
      return;
    }
    toast(`재귀 — 마지막 저장으로 돌아왔어요 · 남은 저장 ${RUN.saves.left}번`, 'gold');
    go('map', { rewound: true });
  },
});

const fmtTime = ms => { const m = Math.floor((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };

let ceHolder = null;
register('chapterend', {
  async mount(holder, params = {}) {
    ceHolder = holder;
    const st = RUN.stats;
    if (params.clear) {
      const ch = chapterDef();
      // 장 끝 장면(1장 = 대본 12 「문밖의 한 시」) — 한 번만. 보다가 끄면 이어 할 때 다시
      const S = storyOf(ch.num), key = `end:${ch.num}`;
      if (S.ending && !(RUN.flags.seen || {})[key]) {
        holder.innerHTML = '<div class="ce-dark"></div>';
        await loadAll(storyArtKeys(S.ending, S.cast));
        if (ceHolder !== holder) return;
        await playScene(S.ending, sceneOpts(chapterDef().encounters.boss.boss));
        if (ceHolder !== holder) return;
        RUN.flags.seen = Object.assign({}, RUN.flags.seen, { [key]: true });
        autosave();
      }
      const end = ch.end || {};
      holder.innerHTML = `<div class="ce">
        <p class="ce-kick">${esc(RUN.name)}의 여정 · ${esc(end.done || `${ch.num}장 완료`)}</p>
        <div class="ce-num">${ch.hour}</div>
        <h2 class="ce-title">${esc(ch.title)}</h2>
        <p class="ce-sub">${end.dest ? `다음 목적지 — ${esc(end.dest)}` : `${ch.sub} — 권능 하나를 향해, 첫 번째 톱니가 맞물렸다.`}</p>
        <dl class="ce-stats">
          <div><dt>플레이 시간</dt><dd>${fmtTime(RUN.playMs)}</dd></div><div><dt>전투</dt><dd>${st.battles}</dd></div>
          <div><dt>처치</dt><dd>${st.kills}</dd></div><div><dt>재귀(쓰러짐)</dt><dd>${st.deaths}</dd></div>
          <div><dt>덱</dt><dd>${RUN.deck.length}장</dd></div><div><dt>유물</dt><dd>${RUN.relics.length}</dd></div>
        </dl>
        <button class="btn-main" type="button" id="ceGo">${icon('play')}다음 장으로</button></div>`;
      SFX.win();
      holder.querySelector('#ceGo').addEventListener('click', () => { SFX.click(); nextChapter(); });
      return;
    }
    // 준비 중 — 다음 챕터가 아직 없다
    const n = RUN ? RUN.chapter : 2;
    holder.innerHTML = `<div class="ce">
      <p class="ce-kick">${RUN ? esc(RUN.name) + '의 여정 · 저장됨' : ''}</p>
      <div class="ce-num">${roman(n)}</div>
      <h2 class="ce-title">${n}시 — 준비 중</h2>
      <p class="ce-sub">${n <= LAST_CHAPTER ? `${n}장은 아직 만들고 있어요. 지금까지의 여정은 저장돼 있어서, ${n}장이 추가되면 「이어 하기」로 바로 이어져요.` : '끝.'}</p>
      <button class="btn-main" type="button" id="ceTitle">타이틀로</button></div>`;
    if (RUN) autosave();
    holder.querySelector('#ceTitle').addEventListener('click', () => { SFX.click(); go('title'); });
  },
  unmount() { ceHolder = null; },
});
export const hasChapter = n => !!CHAPTERS[n];
