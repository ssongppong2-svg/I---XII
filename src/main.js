// I — XII · 시작점
import { $ } from './core/util.js';
import { SET, onSettings } from './core/settings.js';
import { fitStage } from './ui/stage.js';
import { iconSprite } from './ui/icons.js';
import { preloadCore, art } from './ui/assets.js';
import { initAudio } from './ui/sfx.js';
import { initScene, sceneKey } from './scenes/scene.js';
import { routeKey, go } from './ui/router.js';
import { modalKey, sheetKey } from './ui/overlay.js';
import './screens/title.js';
import './screens/difficulty.js';
import './screens/map.js';
import './screens/battle.js';
import './screens/node.js';
import './screens/reward.js';
import './screens/rewind.js';

document.body.insertAdjacentHTML('afterbegin', iconSprite());
fitStage();
window.addEventListener('resize', fitStage);
initScene();

// 키 입력: 확인 창 → 시트 → 대사 장면 → 지금 화면 순서로
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && e.key !== 'Escape') return;
  if (modalKey(e)) return;
  if (sheetKey(e)) return;
  if (sceneKey(e)) return;
  routeKey(e);
});
// 브라우저는 첫 입력 뒤에만 소리를 낼 수 있다
document.addEventListener('pointerdown', () => initAudio(), { once: true, capture: true });
document.addEventListener('keydown', () => initAudio(), { once: true, capture: true });

const applyShake = () => $('#app').classList.toggle('no-shake', !SET.shake);
applyShake();
onSettings(applyShake);

// 개발 · 시험용 연결 (#debug)
if (/debug/.test(location.hash)) {
  Promise.all([import('./game/run.js'), import('./game/save.js'), import('./game/flow.js'), import('./battle/core.js'), import('./map/gen.js'), import('./ui/router.js'), import('./screens/map.js'), import('./data/chapters.js')])
    .then(([run, save, flow, core, gen, router, map, ch]) => {
      window.I12 = { run, save, flow, core, gen, router, map, ch, get RUN() { return run.RUN; }, get B() { return core.B; } };
    });
}

preloadCore().then(() => {
  // 카드 배경 그림(양피지) — 손패 · 보상 · 상점 · 덱 보기의 모든 카드에
  const bg = art('card-bg');
  if (bg) { document.documentElement.style.setProperty('--card-art', `url("${bg}")`); $('#app').classList.add('has-card-art'); }
  go('title', {}, { fade: false });
});
