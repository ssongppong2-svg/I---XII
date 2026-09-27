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
  // 장면 끝까지 — 건너뛰기는 선택지 앞에서 멈추므로, 선택지가 뜨면 고를 수 있는 첫 번째를 누른다
  const clearScene = async () => {
    for (let i = 0; i < 100 && await sceneOpen(); i++) {
      if (await page.evaluate(() => !document.querySelector('#scChoices').hidden)) await page.click('#scChoices button:not([disabled])').catch(() => {});
      else await page.click('#scSkipBtn').catch(() => {});
      await page.waitForTimeout(250);
    }
  };
  const choicesShown = () => page.evaluate(() => !document.querySelector('#scChoices').hidden);
  const logText = async () => { await page.keyboard.press('KeyL'); const t = await page.evaluate(() => document.querySelector('#scLogList').textContent); await page.keyboard.press('Escape'); return t; };
  const waitScreen = (cls, timeout = 20000) => page.waitForFunction(c => { const s = document.querySelector('#screen .screen'); return s && s.classList.contains(c); }, cls, { timeout });
  const waitMap = () => page.waitForFunction(() => document.querySelector('.scr-map .gn.avail'), null, { timeout: 25000 });
  const battleReady = () => page.waitForFunction(() => I12.B.started && !I12.B.over && !I12.B.busy && document.querySelector('#scene').hidden, null, { timeout: 15000 });
  const toTitleAndContinue = async () => {
    await page.reload();
    await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title .ti-item'));
    await page.click('.ti-item[data-a="start"]');
    await page.click('.ti-item[data-a="continue"]');
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
  await page.waitForSelector('.scr-title .ti-item');
  check(await page.evaluate(() => !!document.querySelector('.scr-title img.scr-bg')), '타이틀 배경 그림');
  check(await page.evaluate(() => [...document.querySelectorAll('.ti-item')].map(b => b.textContent.trim()).join(',')) === 'Start,Settings,Credits,Exit', '타이틀 메뉴 Start · Settings · Credits · Exit');
  await page.click('.ti-item[data-a="credits"]');
  check(await page.evaluate(() => !document.querySelector('#tiCredits').hidden && document.querySelectorAll('.tc-board dt').length === 4), 'Credits — 역할 4줄');
  await page.keyboard.press('Escape');
  await shot('01-title');
  await page.click('.ti-item[data-a="start"]');   // 저장이 없으면 바로 난이도로
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
  check(await page.evaluate(() => document.querySelectorAll('.mech .lk').length > 20 && document.querySelectorAll('.mech .idl').length === 0), '지도: 톱니를 축으로 잇는다 (사이 톱니 없음)');
  await page.click(`.gn.avail[data-id="${nodes.tutorial[0]}"]`);
  await waitScreen('scr-battle');
  await page.waitForSelector('.tut', { timeout: 10000 });
  check(true, '튜토리얼 안내가 뜬다');
  check(await page.evaluate(() => !!document.querySelector('.battle-bg img.scr-bg')), '전투 배경 그림');
  check(await page.evaluate(() => I12.B.rows === 6 && document.querySelectorAll('#board .cell').length === 36 && I12.B.p.r === 5 && I12.B.p.c === 2), '6×6 판 · 맨 아랫줄 가운데에서 시작');
  const cardBg = await page.evaluate(() => getComputedStyle(document.querySelector('.hand .card')).backgroundImage);
  const bgOk = await page.evaluate(async u => { const m = /url\("([^"]*card-bg[^"]*)"\)/.exec(u); if (!m) return false; const r = await fetch(m[1]); return r.ok; }, cardBg);
  check(bgOk, `카드에 양피지 그림이 실제로 깔린다`);
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
    if (['rest', 'shop', 'alley'].includes(t)) check(await page.evaluate(() => !!document.querySelector('.nd.has-bg .scr-bg')), `${t}: 배경 그림`);
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

  console.log('3b. 사건 — 대사 장면 · 결과 · 새로고침 · 건너뛰기 · 기시감');
  const evIds = nodes.event || [];
  const evNames = await page.evaluate(ids => ids.map(id => I12.RUN.map.nodes[id].event), evIds);
  check(evIds.length >= 4 && new Set(evNames).size === evNames.length, `지도: 사건 칸 ${evIds.length}개 · 같은 사건 없음`);
  // (1) 끝까지 한 줄씩 → 결과 화면 → 새로고침해도 결과만
  await page.evaluate(id => { I12.RUN.alert = 0; I12.RUN.parts = 300; I12.RUN.hp = 3; I12.flow.enterNode(id); }, evIds[0]);
  await waitScreen('scr-node');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  check(await page.evaluate(() => !!document.querySelector('#scBg img.scr-bg') && document.querySelector('#scene').classList.contains('has-bg')), '사건: 대사 장면에 배경 그림');
  for (let i = 0; i < 80 && !(await choicesShown()); i++) { await page.click('#dbox'); await page.waitForTimeout(120); }
  const chs = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => !!b.querySelector('small')));
  check(chs.length >= 2 && chs.every(Boolean), `사건: 선택지 ${chs.length}개 — 모두 얻고 잃는 것 표시`);
  await shot('06-event-choice');
  await page.click('#scChoices button:not([disabled])');
  for (let i = 0; i < 60 && await sceneOpen(); i++) { if (await choicesShown()) await page.click('#scChoices button:not([disabled])'); else await page.click('#dbox'); await page.waitForTimeout(120); }
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot('06-event-result');
  const e1 = await run();
  check(e1.map.nodes[evIds[0]].ev && e1.map.nodes[evIds[0]].ev.done && e1.flags.seen['ev:' + evNames[0]], '사건: 끝나면 결과가 저장된다');
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none'), null, { timeout: 10000 });
  const e2 = await run();
  check(!(await sceneOpen()) && e2.parts === e1.parts && e2.hp === e1.hp && e2.alert === e1.alert && e2.deck.length === e1.deck.length && e2.relics.length === e1.relics.length, '사건: 새로고침해도 장면을 다시 보거나 두 번 받지 않는다');
  const leaveEvent = async () => {
    if (await page.$('#ndFight')) { await page.click('#ndFight'); await winToReward(); await page.click('#rwGo'); }
    else await page.click('#ndLeave');
    await waitMap();
  };
  await leaveEvent();
  // (2) 장면 도중에 끄면 처음부터 — 효과는 한 번만
  await page.evaluate(id => { I12.RUN.alert = 10; I12.RUN.parts = 300; I12.RUN.hp = 3; I12.flow.enterNode(id); }, evIds[1]);
  await waitScreen('scr-node');
  const pre = await run();
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check(true, '사건: 건너뛰기는 선택지 앞에서 멈춘다');
  await page.click('#scChoices button:not([disabled])');
  await page.click('#dbox');
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  const post = await run();
  check(post.parts === pre.parts && post.alert === pre.alert && post.hp === pre.hp && post.deck.length === pre.deck.length && !post.map.nodes[evIds[1]].ev, '사건: 장면 도중에 끄면 처음부터 — 효과가 두 번 들어가지 않는다');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none'), null, { timeout: 15000 });
  await leaveEvent();
  // (3) 재귀 전에 본 사건 — 기시감
  await page.evaluate(([id, name]) => { I12.RUN.alert = 0; I12.RUN.flags.seen['ev:' + name] = '지난번의 선택'; I12.flow.enterNode(id); }, [evIds[2], evNames[2]]);
  await waitScreen('scr-node');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check((await logText()).includes('재귀하기 전의 기억'), '사건: 재귀 전에 본 사건이면 기시감 대사');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none'), null, { timeout: 15000 });
  await leaveEvent();

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
  // 사건에서 「톱니 조각 주머니」(정예 · 보스 조각 +1)를 얻었을 수도 있다
  const shardGain = 1 + (before.relics.includes('shard_pouch') ? 1 : 0);
  check(a1.parts > before.parts && a1.shards === before.shards + shardGain && a1.relics.length === before.relics.length + 1, `정예 보상: 부품 · 조각 ${shardGain} · 유물 1 (부품 ${before.parts}→${a1.parts} · 조각 ${before.shards}→${a1.shards} · 유물 ${before.relics.length}→${a1.relics.length})`);
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
  await page.evaluate(id => { I12.RUN.alert = 0; I12.RUN.flags.ev = Object.assign({}, I12.RUN.flags.ev, { casing_read: true }); I12.flow.enterNode(id); }, nodes.boss[0]);
  await waitScreen('scr-battle');
  await page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 10000 });
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check((await logText()).includes('미안합니다'), '보스: 사건에서 세운 깃발로 대사가 달라진다 (탄피 각인)');
  await clearScene();
  await battleReady();
  const lay = await page.evaluate(() => { const b = document.querySelector('#board').getBoundingClientRect(), t = document.querySelector('.timeline').getBoundingClientRect(), h = document.querySelector('.hand-row').getBoundingClientRect(); return { rows: I12.B.rows, cells: document.querySelectorAll('#board .cell').length, r: I12.B.p.r, fit: b.bottom <= t.top + 1 && t.bottom <= h.top + 1 }; });
  check(lay.rows === 7 && lay.cells === 42 && lay.r === 6 && lay.fit, '보스전: 보스 줄 + 6×6 (7줄) · 카드 줄과 겹치지 않음');
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
