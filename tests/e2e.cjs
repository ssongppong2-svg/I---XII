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
      if (await page.evaluate(() => !document.querySelector('#scChoices').hidden)) await page.click('#scChoices button:not([disabled])', { timeout: 3000 }).catch(() => {});
      else await page.click('#scSkipBtn', { timeout: 3000 }).catch(() => {});
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

  const enterNode = async (sel, patch = '') => {
    const id = await page.evaluate(([s, patch]) => {
      const n = Object.values(I12.RUN.map.nodes).find(x => (s === 'boss' ? x.type === 'boss' : s.startsWith('s') ? x.story === s : x.id === s));
      if (patch) new Function('n', 'RUN', patch)(n, I12.RUN);
      I12.RUN.pos = n.prev[0] || I12.RUN.pos;
      I12.flow.enterNode(n.id);
      return n.id;
    }, [sel, patch]);
    return id;
  };
  const sceneWait = () => page.waitForFunction(() => !document.querySelector('#scene').hidden, null, { timeout: 15000 });
  const recurSnap = () => page.evaluate(() => JSON.parse(localStorage.getItem('i12.run.recur.v1')));
  const afterFightToMap = async () => { await winToReward(); await page.click('#rwGo'); await waitMap(); };

  await page.goto(base + '/index.html#debug');
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title'));
  await page.evaluate(() => localStorage.clear());

  console.log('1. 타이틀 → 예전 판 저장 안내 → 난이도 → 01(못총 · 이름) → 지도');
  // 저장 판 1(1장이 대본대로 바뀌기 전)의 여정 — 이어 할 수 없다고 알려 준다
  await page.evaluate(() => localStorage.setItem('i12.run.auto.v1', JSON.stringify({ v: 1, name: '옛 여정', chapter: 1, diff: 1 })));
  await page.reload();
  await page.waitForFunction(() => window.I12 && document.querySelector('.scr-title'));
  await page.waitForSelector('.scr-title .ti-item');
  check(await page.evaluate(() => !!document.querySelector('.scr-title img.scr-bg')), '타이틀 배경 그림');
  check(await page.evaluate(() => [...document.querySelectorAll('.ti-item')].map(b => b.textContent.trim()).join(',')) === 'Start,Settings,Credits,Exit', '타이틀 메뉴 Start · Settings · Credits · Exit');
  await page.click('.ti-item[data-a="credits"]');
  check(await page.evaluate(() => !document.querySelector('#tiCredits').hidden && document.querySelectorAll('.tc-board dt').length === 4), 'Credits — 역할 4줄');
  await page.keyboard.press('Escape');
  await shot('01-title');
  await page.click('.ti-item[data-a="start"]');
  await page.waitForSelector('.modal .btn-main');
  check(await page.evaluate(() => /예전 판의 여정/.test(document.querySelector('.modal').textContent)), '예전 판 저장 — 이어 할 수 없다고 알려 준다');
  await page.click('.modal .btn-main');
  await waitScreen('scr-difficulty');
  check(await page.evaluate(() => !localStorage.getItem('i12.run.auto.v1')), '새 게임을 고르면 예전 여정은 지워진다');
  await page.click('.df-num[data-d="4"]');
  await shot('02-difficulty');
  await page.click('#dfGo');
  await sceneWait();
  // 01 — 못총 그림이 한 장 뜬다
  for (let i = 0; i < 40 && !(await page.evaluate(() => !document.querySelector('#scCg').hidden)); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(160); }
  check(await page.evaluate(() => !document.querySelector('#scCg').hidden && !!document.querySelector('#scCg img')), '01: 장력 가속 못총 그림');
  await shot('03-nailgun');
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scInput').hidden, null, { timeout: 10000 });
  check(await page.evaluate(() => document.querySelector('#scInName').value) === '크로노스', '이름 입력 — 기본값 「크로노스」');
  await shot('04-name');
  await page.click('#scInOk');
  await page.waitForTimeout(400);
  await clearScene();
  await waitMap();
  await shot('05-map');
  let R = await run();
  check(R.name === '크로노스' && R.diff === 4 && R.chapter === 1 && R.v === 2, `이름 · 난이도 · 장 · 저장 판 (${R.name} · ${R.diff} · ${R.chapter} · v${R.v})`);
  check(R.saves.left === R.saves.max && R.saves.max === 5, `난이도 IV 저장 횟수 5 (${R.saves.left}/${R.saves.max})`);
  const nodes = await page.evaluate(() => { const o = {}; for (const n of Object.values(I12.RUN.map.nodes)) (o[n.type] = o[n.type] || []).push(n.id); return o; });
  const spine = await page.evaluate(() => I12.RUN.map.layers.map(l => l.length === 1 ? (I12.RUN.map.nodes[l[0]].story || I12.RUN.map.nodes[l[0]].type) : '·').join(' '));
  check(R.map.layers.length === 18 && spine === 'start s02 s03 · · s04 · s05 s06 · · s07 s08 · s09 · s10 boss', `지도 18층 — 이야기 칸 뼈대 (${spine})`);
  check(!nodes.elite && nodes.boss.length === 1 && R.map.layers.every(l => l.length <= 2), '1장: 정예 없음 · 사이 층은 톱니 두 개');
  check(await page.evaluate(() => document.querySelectorAll('.mech .gn.t-story .sno').length === 9 && /미등록 동력체/.test(document.querySelector('.mech').textContent)), '지도: 이야기 칸 9개에 대본 번호 · 제목 이름표');
  check(await page.evaluate(() => document.querySelectorAll('.mech .lk').length > 20), '지도: 톱니를 축으로 잇는다');

  console.log('2. 02 미등록 동력체 — 앞 대사 → 재귀 지점 → 학습 전투(튜토리얼) → 쓰러지면 곧장 재도전 → 승리 대사');
  const s02 = R.map.layers[1][0];
  await page.click(`.gn.avail[data-id="${s02}"]`);
  await waitScreen('scr-node');
  await sceneWait();
  check(await page.evaluate(() => document.querySelector('#dname').textContent === '감시 시계'), '02: 감시 시계가 말한다 (대본 02-01)');
  await clearScene();
  await waitScreen('scr-battle');
  await page.waitForSelector('.tut', { timeout: 10000 });
  check(true, '02: 튜토리얼 안내');
  check(await page.evaluate(() => I12.B.rows === 6 && document.querySelectorAll('#board .cell').length === 36 && I12.B.foes.length === 1 && I12.B.foes[0].type === 'watcher'), '02: 6×6 판 · 감시 시계 1기');
  const cardBg = await page.evaluate(() => getComputedStyle(document.querySelector('.hand .card')).backgroundImage);
  check(await page.evaluate(async u => { const m = /url\("([^"]*card-bg[^"]*)"\)/.exec(u); if (!m) return false; const r = await fetch(m[1]); return r.ok; }, cardBg), '카드에 양피지 그림이 실제로 깔린다');
  let snap = await recurSnap();
  check(snap.pending === s02 && snap.map.nodes[s02].preDone && snap.saves.left === 5, '02: 전투 직전 재귀 지점 (저장 횟수는 그대로)');
  await shot('06-s02-battle');
  await battleReady();
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  await clearScene();
  await waitScreen('scr-battle', 15000);
  await page.waitForTimeout(300);
  check(!(await sceneOpen()) && (await run()).stats.deaths === 1, '02: 쓰러지면 앞 대사 없이 곧장 그 전투로 (재귀)');
  await battleReady();
  await page.evaluate(() => I12.core.debugWin());
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForTimeout(300);
  await waitScreen('scr-reward');
  const cards0 = (await run()).deck.length;
  await page.click('.rw-cards .card');
  await page.click('#rwGo');
  await waitMap();
  check((await run()).deck.length === cards0 + 1, '보상 카드가 덱에 들어간다');

  console.log('3. 03 골목의 속삭임 — 보급 선택 · 가방 · 목표 · 새로고침');
  await enterNode('s03');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  const c03 = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => b.textContent));
  check(c03.length === 3 && /지원을 받는다/.test(c03[0]) && /회복약 \+1/.test(c03[0]), '03: 선택 세 가지 — 지원 · 정보 먼저 · 거절 (얻는 것 표시)');
  await page.click('#scChoices button');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res'), null, { timeout: 15000 });
  R = await run();
  check(R.items.potion === 1 && R.items.kit === 1 && R.goal === '정비 철도를 따라 도시 밖으로 나간다', `03: 회복약 1 · 정비 부품 1 · 목표 (${JSON.stringify(R.items)} · ${R.goal})`);
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await page.waitForFunction(() => document.querySelector('.nd .ev-res'), null, { timeout: 10000 });
  check(!(await sceneOpen()) && (await run()).items.potion === 1, '03: 새로고침해도 결과만 (두 번 받지 않는다)');
  await page.click('#ndLeave');
  await waitMap();
  check(await page.evaluate(() => /정비 철도를 따라/.test(document.querySelector('#mapGoal').textContent)), '지도 위쪽에 목표');
  // 가방 — 지도에서 회복약 (HP가 모자랄 때만)
  await page.evaluate(() => { I12.RUN.hp = 2; I12.router.go('map', {}); });
  await waitMap();
  await page.click('#mapRes [data-bag="potion"]');
  await page.waitForTimeout(200);
  R = await run();
  check(R.hp === 4 && R.items.potion === 0, `가방: 지도에서 회복약 — HP +2 (${R.hp}) · 회복약 ${R.items.potion}`);

  console.log('4. 04 녹슨 자동인형 — 정비 부품으로 수리');
  await enterNode('s04');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check(await page.evaluate(() => { const b = document.querySelector('#scChoices button'); return !b.disabled && /정비 부품 1개/.test(b.textContent); }), '04: 수리 — 정비 부품이 있으면 고를 수 있다 (비용 표시)');
  await page.click('#scChoices button');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res'), null, { timeout: 15000 });
  R = await run();
  check(R.items.kit === 0 && R.flags.ev.doll_fixed, '04: 정비 부품 −1 · 자동인형 수리 깃발');
  await page.click('#ndLeave');
  await waitMap();

  console.log('5. 05 영업이 끝난 시장 — 전투 · 튜토리얼 2');
  await enterNode('s05');
  await waitScreen('scr-node');
  await sceneWait();
  check(await page.evaluate(() => { const n = document.querySelector('#dname'); return !!n; }), '05: 장면');
  await clearScene();
  await waitScreen('scr-battle');
  await page.waitForSelector('.tut', { timeout: 10000 });
  check(await page.evaluate(() => I12.B.foes.map(f => f.type).sort().join() === 'charger,watcher'), '05: 감시 시계 + 돌진 기계 · 튜토리얼 2');
  await afterFightToMap();

  console.log('6. 06 천막 아래의 거래 — 질문 두 가지를 들어야 나간다');
  await enterNode('s06');
  await waitScreen('scr-node');
  await sceneWait();
  await clearScene();
  await page.waitForSelector('.st-ask [data-ask]');
  await shot('07-s06');
  await page.click('#ndLeave');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.scr-node')), '06: 묻기 전에는 나갈 수 없다');
  for (const id of ['eyes', 'gate']) { await page.click(`[data-ask="${id}"]`); await sceneWait(); await clearScene(); await page.waitForTimeout(200); }
  check(await page.evaluate(() => !!document.querySelector('.st-ask.done') && !!document.querySelector('.shop-cards .card')), '06: 다 들으면 질문 칸이 한 줄로 접히고 상점은 그대로');
  await page.click('#ndLeave');
  await sceneWait();
  await clearScene();
  await waitMap();
  check(true, '06: 마무리 대사 뒤 지도로');

  console.log('7. 07 눈이 돌아가는 골목 — 중앙 돌파(경계 +1단계) · 송신');
  await page.evaluate(() => { I12.RUN.alert = 0; });
  await enterNode('s07');
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  const c07 = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => b.textContent));
  check(/경계 상승 없음/.test(c07[0]) && /경계 \+1단계/.test(c07[1]), '07: 경로 두 가지 — 결과를 미리 보여 준다');
  await page.click('#scChoices button:nth-child(2)');
  await clearScene();
  await waitScreen('scr-battle');
  await battleReady();
  check((await run()).alert === 34 && await page.evaluate(() => I12.B.foes.some(f => f.type === 'watcher' && f.sig > 0) && !!document.querySelector('.foe-sig')), '07: 경계 1단계 · 감시 시계에 송신 표시');
  await page.evaluate(() => { I12.B.signals = 1; });
  await winToReward();
  check(await page.evaluate(() => I12.run.alertStage()) === 2, '07: 송신이 끝났으면 이긴 뒤 경계 한 단계 더 (2단계)');
  await page.click('#rwGo');
  await waitMap();

  console.log('8. 08 지워진 첫 번째 자리 — 종이 기록 · 목표 갱신');
  await enterNode('s08');
  await waitScreen('scr-node');
  await sceneWait();
  for (let i = 0; i < 40 && !(await page.evaluate(() => !document.querySelector('#scPaper').hidden)); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(120); }
  check(await page.evaluate(() => !document.querySelector('#scPaper').hidden && /회수 기록/.test(document.querySelector('#scPaperT').textContent)), '08: 기록은 낡은 종이 패널에');
  await shot('08-paper');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res'), null, { timeout: 15000 });
  check((await run()).goal === '도시를 탈출해 II 귀속 시설로 향한다', '08: 목표 — II 귀속 시설');
  await page.click('#ndLeave');
  await waitMap();

  console.log('9. 09 꺼지지 않는 화로 — 습격(회복 뒤) → 전투 → 칸으로 돌아와 조용한 대화');
  const s09 = await enterNode('s09', "n.rested = { mode: 'rest', got: 0, ambushed: true };");
  await waitScreen('scr-node');
  await sceneWait();
  await clearScene();   // 앞 대사 → 습격 대사가 이어서 나온다
  await waitScreen('scr-battle');
  check((await recurSnap()).pending === s09, '09: 습격 전투 직전 재귀 지점');
  await winToReward();
  await page.click('#rwGo');
  await waitScreen('scr-node');
  await page.waitForSelector('#ndQuiet');
  check(await page.evaluate(id => I12.RUN.map.nodes[id].won === true && I12.RUN.pending === id, s09), '09: 이긴 뒤 화로 칸으로 돌아온다');
  await page.click('#ndQuiet');
  await sceneWait();
  await clearScene();
  await page.waitForFunction(() => !document.querySelector('#ndQuiet'), null, { timeout: 5000 });
  await page.click('#ndLeave');
  await waitMap();

  console.log('10. 톱니 칸 화면 — 「떠난다」 버튼으로 나가기');
  for (const t of ['rest', 'shop', 'blackmarket', 'forge', 'implant', 'abyss', 'tent', 'shrine', 'alley']) {
    const id = nodes[t] && nodes[t][0];
    if (!id) { console.log(`  · ${t} 없음 (이번 지도)`); continue; }
    await page.evaluate(([id, t]) => { I12.RUN.alert = 0; I12.RUN.parts = 300; I12.RUN.shards = 3; if (t === 'alley') I12.RUN.map.nodes[id].alley = 'hide'; I12.flow.enterNode(id); }, [id, t]);
    await waitScreen('scr-node');
    await page.waitForTimeout(300);
    if (['rest', 'shop', 'alley'].includes(t)) check(await page.evaluate(() => !!document.querySelector('.nd.has-bg .scr-bg')), `${t}: 배경 그림`);
    if (['rest', 'abyss', 'tent', 'alley'].includes(t)) { await page.click('.nd-opt'); await page.waitForTimeout(300); }
    if (t === 'shop') await page.click('.shop-cards .card');
    if (t === 'shrine') await page.click('.rw-relic');
    if (await page.$('#ndFight')) { await page.click('#ndFight'); await afterFightToMap(); check(true, `${t}: 습격 전투 뒤 지도로`); continue; }
    await page.click('#ndLeave');
    await waitMap();
    check(true, `${t}: 떠난다 → 지도`);
  }

  console.log('11. 사건 — 대사 장면 · 결과 · 새로고침 · 건너뛰기 · 기시감');
  const evIds = nodes.event || [];
  const evNames = await page.evaluate(ids => ids.map(id => I12.RUN.map.nodes[id].event), evIds);
  check(evIds.length >= 3 && new Set(evNames).size === evNames.length, `지도: 사건 칸 ${evIds.length}개 · 같은 사건 없음`);
  await page.evaluate(id => { I12.RUN.alert = 0; I12.RUN.parts = 300; I12.RUN.hp = 3; I12.flow.enterNode(id); }, evIds[0]);
  await waitScreen('scr-node');
  await sceneWait();
  check(await page.evaluate(() => !!document.querySelector('#scBg img.scr-bg') && document.querySelector('#scene').classList.contains('has-bg')), '사건: 대사 장면에 배경 그림');
  for (let i = 0; i < 80 && !(await choicesShown()); i++) { await page.click('#dbox'); await page.waitForTimeout(120); }
  const chs = await page.evaluate(() => [...document.querySelectorAll('#scChoices button')].map(b => !!b.querySelector('small')));
  check(chs.length >= 2 && chs.every(Boolean), `사건: 선택지 ${chs.length}개 — 모두 얻고 잃는 것 표시`);
  await page.click('#scChoices button:not([disabled])');
  for (let i = 0; i < 60 && await sceneOpen(); i++) { if (await choicesShown()) await page.click('#scChoices button:not([disabled])'); else await page.click('#dbox'); await page.waitForTimeout(120); }
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none, .nd .nd-cards, .nd .deck-grid, #ndFight'), null, { timeout: 15000 });
  const e1 = await run();
  check(e1.map.nodes[evIds[0]].ev && e1.map.nodes[evIds[0]].ev.done && e1.flags.seen['ev:' + evNames[0]], '사건: 끝나면 결과가 저장된다');
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none, .nd .nd-cards, .nd .deck-grid, #ndFight'), null, { timeout: 10000 });
  const e2 = await run();
  check(!(await sceneOpen()) && e2.parts === e1.parts && e2.hp === e1.hp && e2.alert === e1.alert && e2.deck.length === e1.deck.length && e2.relics.length === e1.relics.length, '사건: 새로고침해도 장면을 다시 보거나 두 번 받지 않는다');
  const leaveEvent = async () => {
    if (await page.$('#ndFight')) { await page.click('#ndFight'); await afterFightToMap(); }
    else { await page.click('#ndLeave'); await waitMap(); }
  };
  await leaveEvent();
  await page.evaluate(id => { I12.RUN.alert = 10; I12.RUN.parts = 300; I12.RUN.hp = 3; I12.flow.enterNode(id); }, evIds[1]);
  await waitScreen('scr-node');
  const pre = await run();
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check(true, '사건: 건너뛰기는 선택지 앞에서 멈춘다');
  await page.click('#scChoices button:not([disabled])');
  await page.click('#dbox');
  await toTitleAndContinue();
  await waitScreen('scr-node');
  await sceneWait();
  const post = await run();
  check(post.parts === pre.parts && post.alert === pre.alert && post.hp === pre.hp && post.deck.length === pre.deck.length && !post.map.nodes[evIds[1]].ev, '사건: 장면 도중에 끄면 처음부터 — 효과가 두 번 들어가지 않는다');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none, .nd .nd-cards, .nd .deck-grid, #ndFight'), null, { timeout: 15000 });
  await leaveEvent();
  await page.evaluate(([id, name]) => { I12.RUN.alert = 0; I12.RUN.flags.seen['ev:' + name] = '지난번의 선택'; I12.flow.enterNode(id); }, [evIds[2], evNames[2]]);
  await waitScreen('scr-node');
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForFunction(() => !document.querySelector('#scChoices').hidden, null, { timeout: 5000 });
  check((await logText()).includes('재귀하기 전의 기억'), '사건: 재귀 전에 본 사건이면 기시감 대사');
  await clearScene();
  await page.waitForFunction(() => document.querySelector('.nd .ev-res, .nd .ev-none, .nd .nd-cards, .nd .deck-grid, #ndFight'), null, { timeout: 15000 });
  await leaveEvent();

  console.log('12. 직접 저장 → 패배 → 재귀(지도로)');
  await page.click('#mSave');
  await page.waitForSelector('.modal .btn-main');
  await page.click('.modal .btn-main');
  await page.waitForTimeout(300);
  const saved = await run();
  check(saved.saves.left === 4, `저장 횟수 줄어듦 (${saved.saves.left})`);
  const fightId = await page.evaluate(() => { const n = Object.values(I12.RUN.map.nodes).find(x => x.type === 'battle' && !I12.RUN.visited.includes(x.id)) || Object.values(I12.RUN.map.nodes).find(x => x.type === 'battle'); return n.id; });
  await page.evaluate(id => I12.flow.enterNode(id), fightId);
  await waitScreen('scr-battle');
  await battleReady();
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  await sceneWait();
  await clearScene();
  await waitMap();
  const rw = await run();
  check(rw.pos === saved.pos && rw.hp === saved.hp && rw.deck.length === saved.deck.length, '재귀: 저장한 자리 · HP · 덱으로');
  check(rw.recur === saved.recur + 1 && rw.stats.deaths === saved.stats.deaths + 1, '재귀 횟수 · 쓰러짐 +1');

  console.log('13. 경계도 100 → 발각 전투');
  await page.evaluate(() => { I12.RUN.alert = 100; I12.router.go('map', {}); });
  await waitScreen('scr-battle', 25000);
  await winToReward();
  await page.click('#rwGo');
  await waitMap();
  check((await run()).alert === 50, '발각 전투를 이기면 경계도 50');

  console.log('14. 10 신호교 — 곡사포 기계 · 고친 자동인형이 합류');
  await page.evaluate(() => { I12.RUN.alert = 0; });
  await enterNode('s10');
  await waitScreen('scr-node');
  await sceneWait();
  await clearScene();
  await waitScreen('scr-battle');
  await battleReady();
  check(await page.evaluate(() => I12.B.foes.map(f => f.type).sort().join() === 'mortar,watcher'), '10: 곡사포 기계 + 감시 시계');
  await page.evaluate(() => I12.core.debugWin());
  await sceneWait();
  await page.click('#scSkipBtn');
  await page.waitForTimeout(300);
  await waitScreen('scr-reward');
  await page.click('#rwGo');
  await waitMap();

  console.log('15. 11 대형 감시기계 — 보스 앞 재귀 지점 · 단계 대사(한 번만) · 재도전');
  const bossId = await enterNode('boss', "RUN.flags.ev = Object.assign({}, RUN.flags.ev, { casing_read: true });");
  await waitScreen('scr-battle');
  await sceneWait();
  check((await recurSnap()).pending === bossId, '보스: 들어가는 순간 재귀 지점');
  let sawCasing = false;
  for (let i = 0; i < 60 && await sceneOpen() && !sawCasing; i++) {
    sawCasing = await page.evaluate(() => /미안하다고/.test(document.querySelector('#dtext').textContent));
    await page.keyboard.press('Space'); await page.waitForTimeout(90);
  }
  check(sawCasing, '보스: 사건에서 세운 깃발로 대사가 달라진다 (탄피 각인)');
  await clearScene();
  await battleReady();
  const lay = await page.evaluate(() => { const b = document.querySelector('#board').getBoundingClientRect(), t = document.querySelector('.timeline').getBoundingClientRect(), h = document.querySelector('.hand-row').getBoundingClientRect(); return { rows: I12.B.rows, cells: document.querySelectorAll('#board .cell').length, r: I12.B.p.r, fit: b.bottom <= t.top + 1 && t.bottom <= h.top + 1 }; });
  check(lay.rows === 7 && lay.cells === 42 && lay.r === 6 && lay.fit, '보스전: 보스 줄 + 6×6 (7줄) · 카드 줄과 겹치지 않음');
  await page.evaluate(() => { I12.core.debugHurtBoss(0.6); });
  await sceneWait();
  check(await page.evaluate(() => I12.B.phase === 1 && /인류 보호 절차/.test(document.querySelector('#dtext').textContent + document.querySelector('#scLogList').textContent + I12.B.logs.map(l => l.t).join())), '보스: 체력 3분의 2 — 2단계 「인류 보호 절차」 대사');
  await clearScene();
  await shot('09-boss');
  await battleReady();
  await page.evaluate(() => I12.core.debugLose());
  await waitScreen('scr-rewind');
  await clearScene();
  await waitScreen('scr-battle', 15000);
  await sceneWait();
  check(true, '보스: 쓰러지면 보스 앞 대화부터 (건너뛸 수 있다)');
  await clearScene();
  await battleReady();
  await page.evaluate(() => { I12.core.debugHurtBoss(0.6); });
  await page.waitForTimeout(700);
  check(!(await sceneOpen()) && await page.evaluate(() => I12.B.phase === 1), '보스: 재도전에서 단계 대사는 다시 멈추지 않는다');
  await winToReward();
  check(await page.evaluate(() => document.querySelector('#rwGo').disabled), '보스 유물을 고르기 전에는 넘어갈 수 없다');
  await page.click('.rw-relic');
  await page.click('#rwGo');

  console.log('16. 12 문밖의 한 시 → 챕터 끝 → 준비 중');
  await sceneWait();
  await page.click('#scSkipBtn');
  await waitScreen('scr-chapterend');
  await page.waitForSelector('#ceGo');
  check(await page.evaluate(() => /다음 목적지 — II 귀속 시설/.test(document.querySelector('.ce').textContent) && /도망치는 기계 신/.test(document.querySelector('.ce').textContent)), '장 끝: 「도망치는 기계 신」 · 다음 목적지 II 귀속 시설');
  await shot('10-chapterend');
  await toTitleAndContinue();
  await waitScreen('scr-chapterend');
  await page.waitForSelector('#ceGo');
  check(!(await sceneOpen()), '장 끝 화면에서 새로고침 → 끝 장면은 다시 보지 않고 장 끝 화면');
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
