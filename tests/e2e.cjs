// I — XII 흐름 시험 (Playwright)
//   npm i -D playwright   (또는 NODE_PATH로 전역 설치본을 가리키기)
//   node tests/e2e.cjs            — 저장소 폴더를 직접 띄워서 시험한다
//   E2E_URL=http://... node tests/e2e.cjs   — 이미 띄운 주소로 시험
//   E2E_SHOTS=폴더 를 주면 화면을 찍어 둔다
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.E2E_SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split(/[?#]/)[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`); if (!ok) fails.push(msg); };

(async () => {
  let srv = null, base = process.env.E2E_URL;
  if (!base) { srv = await serve(); base = `http://127.0.0.1:${srv.address().port}`; }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));

  const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const sceneOpen = () => page.evaluate(() => !document.querySelector('#scene').hidden);
  const clearScene = async () => {
    for (let i = 0; i < 100 && await sceneOpen(); i++) {
      if (await page.evaluate(() => !document.querySelector('#scChoices').hidden)) await page.keyboard.press('Digit1');
      else await page.click('#scSkipBtn').catch(() => {});
      await page.waitForTimeout(250);
    }
  };
  const waitScreen = (cls, timeout = 20000) => page.waitForFunction(c => { const s = document.querySelector('#screen .screen'); return s && s.classList.contains(c); }, cls, { timeout });
  const waitMap = () => page.waitForFunction(() => document.querySelector('.scr-map .gn.avail'), null, { timeout: 25000 });
  const battleReady = () => page.waitForFunction(() => I12.B.started && !I12.B.over && !I12.B.busy && document.querySelector('#scene').hidden, null, { timeout: 15000 });
  const toTitleAndContinue = async () => {
    await page.reload();
    await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title'));
    await page.click('[data-a="continue"]');
  };
  const winToReward = async () => {
    await battleReady();
    await page.evaluate(() => I12.core.debugWin());
    await page.waitForFunction(() => document.querySelector('.scr-reward') || !document.querySelector('#scene').hidden, null, { timeout: 20000 });
    await clearScene();
    await waitScreen('scr-reward');
  };
  const run = () => page.evaluate(() => JSON.parse(JSON.stringify(I12.RUN)));

  await page.goto(base + '/index.html#debug');
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title'));
  await page.evaluate(() => localStorage.clear());

  console.log('1. 타이틀 → 난이도 → 프롤로그 → 이름 → 지도');
  await page.reload();
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title'));
  await shot('01-title');
  await page.click('.ti-btn[data-a="new"]');
  await waitScreen('scr-difficulty');
  await page.click('.df-num[data-d="4"]');
  await shot('02-difficulty');
  await page.click('#dfGo');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scInput').hidden, null, { timeout: 10000 });
  await shot('03-name');
  await page.fill('#scInName', '크로노스');
  await page.click('#scInOk');
  await page.waitForTimeout(400);
  await clearScene();
  await waitMap();
  await shot('04-map');
  let R = await run();
  check(R.name === '크로노스' && R.diff === 4 && R.chapter === 1, `이름 · 난이도 · 장 (${R.name} · ${R.diff} · ${R.chapter})`);
  check(R.saves.left === R.saves.max && R.saves.max === 5, `난이도 IV 저장 횟수 5 (${R.saves.left}/${R.saves.max})`);
  const nodes = await page.evaluate(() => { const o = {}; for (const n of Object.values(I12.RUN.map.nodes)) (o[n.type] = o[n.type] || []).push(n.id); return o; });
  check(nodes.boss && nodes.boss.length === 1 && nodes.tutorial && nodes.tutorial.length === 2, '지도: 보스 1 · 튜토리얼 전투 2');

  console.log('2. 튜토리얼 전투 → 보상 → 지도');
  await page.click(`.gn.avail[data-id="${nodes.tutorial[0]}"]`);
  await waitScreen('scr-battle');
  await page.waitForSelector('.tut', { timeout: 10000 });
  check(true, '튜토리얼 안내가 뜬다');
  await shot('05-tutorial');
  await winToReward();
  const cards0 = (await run()).deck.length;
  await page.click('.rw-cards .card');
  await page.click('#rwGo');
  await waitMap();
  check((await run()).deck.length === cards0 + 1, '보상 카드가 덱에 들어간다');

  console.log('3. 톱니 칸 화면 — 「떠난다」 버튼으로 나가기');
  for (const t of ['rest', 'shop', 'blackmarket', 'forge', 'implant', 'abyss', 'tent', 'shrine', 'alley']) {
    const id = nodes[t] && nodes[t][0];
    if (!id) { console.log(`  · ${t} 없음 (이번 지도)`); continue; }
    await page.evaluate(([id, t]) => { I12.RUN.alert = 0; I12.RUN.parts = 300; I12.RUN.shards = 3; if (t === 'alley') I12.RUN.map.nodes[id].alley = 'hide'; I12.flow.enterNode(id); }, [id, t]);
    await waitScreen('scr-node');
    await page.waitForTimeout(300);
    if (['rest', 'abyss', 'tent', 'alley'].includes(t)) { await page.click('.nd-opt'); await page.waitForTimeout(300); }
    if (t === 'shop') await page.click('.shop-cards .card');
    if (t === 'forge') { const s0 = (await run()).deck.filter(c => c.up).length; await page.click('.deck-grid .card'); await page.click('.deck-grid .card'); const R1 = await run(); check(R1.deck.filter(c => c.up).length === s0 + 2 && R1.shards === 2, '강화소: 두 번 눌러 두 장 · 조각은 1개만 씀'); }
    if (t === 'shrine') await page.click('.rw-relic');
    await shot(`06-node-${t}`);
    if (await page.$('#ndFight')) { await page.click('#ndFight'); await winToReward(); await page.click('#rwGo'); await waitMap(); check(true, `${t}: 기습 전투 뒤 지도로`); continue; }
    await page.click('#ndLeave');
    await waitMap();
    check(true, `${t}: 떠난다 → 지도`);
  }

  console.log('4. 정예 — 승리 대사 도중 새로고침 · 보상 두 번 받지 않기');
  await page.evaluate(id => { I12.RUN.alert = 0; I12.flow.enterNode(id); }, nodes.elite[0]);
  await waitScreen('scr-battle');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await clearScene();
  await battleReady();
  await shot('07-elite');
  const before = await run();
  await page.evaluate(() => I12.core.debugWin());
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 15000 });
  await toTitleAndContinue();
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await clearScene();
  await waitScreen('scr-reward');
  const a1 = await run();
  await toTitleAndContinue();
  await waitScreen('scr-reward');
  const a2 = await run();
  check(a1.parts > before.parts && a1.shards === before.shards + 1 && a1.relics.length === before.relics.length + 1, '정예 보상: 부품 · 조각 1 · 유물 1');
  check(a1.parts === a2.parts && a1.relics.length === a2.relics.length, '보상 화면에서 새로고침해도 두 번 받지 않는다');
  await page.click('#rwGo');
  await waitMap();

  console.log('5. 직접 저장 → 패배 → 재귀');
  await page.click('#mSave');
  await page.waitForSelector('.modal .btn-main');
  await page.click('.modal .btn-main');
  await page.waitForTimeout(300);
  const saved = await run();
  check(saved.saves.left === 4, `저장 횟수 줄어듦 (${saved.saves.left})`);
  const fightId = await page.evaluate(() => { const c = I12.flow.choices(); const id = c[0]; I12.RUN.map.nodes[id].type = 'battle'; return id; });
  await page.evaluate(id => I12.flow.enterNode(id), fightId);
  await waitScreen('scr-battle');
  await battleReady();
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await clearScene();
  await waitMap();
  const rw = await run();
  check(rw.pos === saved.pos && rw.hp === saved.hp && rw.deck.length === saved.deck.length, '재귀: 저장한 자리 · HP · 덱으로');
  check(rw.recur === saved.recur + 1 && rw.stats.deaths === saved.stats.deaths + 1, '재귀 횟수 · 쓰러짐 +1');

  console.log('6. 경계도 100 → 발각 전투');
  await page.evaluate(() => { I12.RUN.alert = 100; I12.router.go('map', {}); });
  await waitScreen('scr-battle', 25000);
  await winToReward();
  await page.click('#rwGo');
  await waitMap();
  check((await run()).alert === 50, '발각 전투를 이기면 경계도 50');

  console.log('7. 보스 → 보스 유물 → 챕터 끝 → 준비 중');
  await page.evaluate(id => { I12.RUN.alert = 0; I12.flow.enterNode(id); }, nodes.boss[0]);
  await waitScreen('scr-battle');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await clearScene();
  await battleReady();
  await shot('08-boss');
  await winToReward();
  check(await page.evaluate(() => document.querySelector('#rwGo').disabled), '보스 유물을 고르기 전에는 넘어갈 수 없다');
  await page.click('.rw-relic');
  await page.click('#rwGo');
  await waitScreen('scr-chapterend');
  await shot('09-chapterend');
  await toTitleAndContinue();
  await waitScreen('scr-chapterend');
  check(await page.evaluate(() => !!document.querySelector('#ceGo')), '챕터 끝 화면에서 새로고침 → 다시 챕터 끝');
  await page.click('#ceGo');
  await page.waitForSelector('#ceTitle');
  check((await run()).chapter === 2, '2장(준비 중)으로 넘어간다');
  await page.click('#ceTitle');
  await waitScreen('scr-title');

  check(errs.length === 0, `자바스크립트 오류 없음${errs.length ? ' — ' + errs.join(' | ') : ''}`);
  await browser.close();
  if (srv) srv.close();
  console.log(fails.length ? `\n실패 ${fails.length}개` : '\n모두 통과');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('시험 중단:', e); process.exit(1); });
