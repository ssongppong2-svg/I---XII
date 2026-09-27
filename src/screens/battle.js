// 전투 화면 — 칸의 전투를 런(HP · 덱 · 유물)과 이어 붙인다. 보스는 앞뒤로 이야기, 이야기 칸의 전투는 뒤에 승리 대사(앞 대사는 칸 화면에서)
import { register, go } from '../ui/router.js';
import { RUN, maxHp, mods, dm, chapterDef, bag, alertStageUp } from '../game/run.js';
import { autosave } from '../game/save.js';
import { encounterFor, rewardsFor, sceneOpts as sceneOptsFor, storyOf, TRIALS } from '../game/flow.js';
import { B, H, setupBattle, startBattle, log } from '../battle/core.js';
import { mountView, setupBoard, render, wireHooks, viewRoot } from '../battle/view.js';
import { bindInput, battleKey } from '../battle/input.js';
import { startTutorial, stopTutorial } from '../battle/tutorial.js';
import { playScene } from '../scenes/scene.js';
import { loadAll } from '../ui/assets.js';
import { foeArtKeys, storyArtKeys } from '../ui/foeart.js';
import { BOSSES } from '../data/foes.js';
import { SET } from '../core/settings.js';
import { openDeck, openHelp, openSettings, pauseMenu, relicTip, toggleSound } from '../ui/menus.js';
import { bindTips, hideTip, confirmBox } from '../ui/overlay.js';
import { SFX } from '../ui/sfx.js';

let ctx = null, alive = false;

const sceneOpts = enc => sceneOptsFor(enc.boss);

async function mount(holder, params = {}) {
  alive = true;
  const node = params.caught ? { id: `${RUN.pos}#caught${RUN.visited.length}`, type: 'caught' } : RUN.map.nodes[params.nodeId];
  const enc = params.enc || encounterFor(node, params.extra || {});
  ctx = { node, enc, params };
  // 그림 확인 (적 스탠딩 · SD · 보스)
  const keys = foeArtKeys(enc.foes || []);
  if (enc.boss) keys.push(BOSSES[enc.boss].art, BOSSES[enc.boss].artFull);
  const cast = storyOf(RUN.chapter).cast || {};
  for (const sc of [enc.intro, enc.win, ...Object.values(enc.interludes || {})]) if (sc) keys.push(...storyArtKeys(sc, cast));
  await loadAll(keys);
  if (!alive) return;
  const theme = enc.kind === 'boss' ? 'theme-boss' : enc.elite ? 'theme-elite' : '';
  const ch = chapterDef();
  mountView(holder, { theme, chapterNum: ch.hour, title: enc.kind === 'boss' ? `보스 · ${BOSSES[enc.boss].name}` : enc.elite ? '정예 전투' : enc.sub || '전투', sub: `${ch.num}장 「${ch.title}」 · ${ch.place}` });
  wireHooks();
  H.scene = script => playScene(script, sceneOpts(enc));
  H.tut = () => {};
  // 전투 중 이야기(보스 단계 대사 · 과부하)는 한 판에 한 번 — 재도전해도 다시 멈추지 않는다
  const ilKey = k => `il:${enc.story || ''}:${k}`;
  const seenIl = Object.keys(enc.interludes || {}).filter(k => (RUN.flags.seen || {})[ilKey(k)]);
  H.onInterlude = k => { RUN.flags.seen = Object.assign({}, RUN.flags.seen, { [ilKey(k)]: true }); };
  setupBattle(enc, { hp: RUN.hp, maxHp: maxHp(), deck: RUN.deck, mods: mods(), diff: dm(), seed: enc.seed, name: RUN.name, items: bag(), seen: seenIl });
  B.relicIds = RUN.relics.slice(); B.implantIds = RUN.implants.slice();
  B.onEnd = win => onEnd(win);
  if (params.alertGained > 0) log(`${chapterDef().hunted ? '추격' : '감시 톱니'} — 경계도 +${params.alertGained} (지금 ${RUN.alert})`, 'bad');
  setupBoard();
  bindInput();
  const vr = viewRoot();
  vr.querySelector('#bDeck').addEventListener('click', () => { SFX.click(); openDeck(RUN.deck, { title: '덱 (이번 판 전체)' }); });
  vr.querySelector('#bHelp').addEventListener('click', () => openHelp());
  vr.querySelector('#bSnd').addEventListener('click', e => { e.currentTarget.blur(); toggleSound(); render(); });
  vr.querySelector('#bMenu').addEventListener('click', () => menu());
  bindTips(vr.querySelector('#bRelics'), t => relicTip(t.dataset.tip));
  if (enc.trial) {
    const T = TRIALS[enc.trial];
    const tag = document.createElement('div');
    tag.className = 'trial-tag'; tag.id = 'trialTag';
    tag.textContent = `시험 「${T.name}」 — ${T.desc}`;
    vr.querySelector('.timeline').appendChild(tag);
  }
  render();
  if (enc.intro) { await playScene(enc.intro, sceneOpts(enc)); if (!alive) return; }
  startBattle();
  if (enc.kind === 'boss') setTimeout(() => H.bark('start'), 400);
  if (enc.tut && SET.tutorial && !(RUN.flags.tutorial || {})[enc.tut]) {
    startTutorial(enc.tut, () => { RUN.flags.tutorial = Object.assign({}, RUN.flags.tutorial, { [enc.tut]: true }); });
  }
}

async function onEnd(win) {
  if (!alive) return;
  stopTutorial();
  const { node, enc, params } = ctx;
  RUN.hp = Math.max(0, B.hp);
  RUN.stats.battles++;
  RUN.stats.kills += B.stats.kills;
  RUN.stats.dealt += B.stats.dealt;
  RUN.stats.taken += B.stats.taken;
  if (enc.elite) RUN.stats.elites++;
  if (!win) { RUN.fallen = true; autosave(); go('rewind'); return; }
  bag().potion = B.items.potion;   // 전투에서 쓴 회복약
  for (let i = 0; i < B.signals; i++) alertStageUp();   // 감시 시계가 송신을 끝낸 만큼 경계 한 단계씩 (최대 2)
  if (enc.caught || params.caught) RUN.alert = 50;
  const rewards = rewardsFor(node, enc, { stats: B.stats });
  if (params.after) rewards.after = params.after;
  // 칸 안의 전투(이야기 칸 휴식 습격 등) — 이긴 것을 칸에 적고, 보상 뒤 그 칸 화면으로 돌아간다
  if (params.back) { const real = RUN.map.nodes[params.nodeId]; if (real) real.won = true; rewards.back = params.nodeId; }
  // 전리품을 먼저 적어 둔다 — 승리 대사나 보상 화면에서 꺼도 이어 할 때 그 자리로 (같은 전투를 다시 하지 않게)
  RUN.reward = { nodeId: node.id, rewards, boss: node.type === 'boss', caught: !!params.caught, win: enc.win ? { story: enc.story, boss: enc.boss || null } : null, granted: false, cardTaken: null, bossPick: null };
  autosave();
  if (enc.win) await playScene(enc.win, sceneOpts(enc));
  if (!alive) return;
  RUN.reward.win = null;
  go('reward');
}

async function menu() {
  SFX.click();
  const v = await pauseMenu();
  if (v === 'settings') openSettings();
  if (v === 'help') openHelp();
  if (v === 'title') {
    const ok = await confirmBox({ title: '타이틀로 나갈까요?', text: '이 전투는 다음에 이어 할 때 처음부터 다시 시작해요.', buttons: [{ label: '나간다', value: true, main: true }, { label: '계속 싸운다', value: false }] });
    if (ok) { autosave(); go('title'); }
  }
}

function onKey(e) {
  if (battleKey(e)) return true;
  if (e.code === 'KeyH') { openHelp(); return true; }
  if (e.code === 'KeyM') { toggleSound(); render(); return true; }
  if (e.key === 'Escape') { menu(); return true; }
  return false;
}

function unmount() {
  alive = false;
  stopTutorial();
  hideTip();
  B.tok++;
  B.over = true; B.started = false;
  B.onEnd = null;
  ctx = null;
}

register('battle', { mount, unmount, onKey });
