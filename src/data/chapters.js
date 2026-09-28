// 챕터 정의 — 지도 모양 · 칸 비율 · 적 구성 · 보상
// 13장: 1장 각성(1시) · 2~12장 시(時) 보스 · 13장 결말. 지금은 1장만 있다
// fixed의 'story:s03' = 이야기 칸 (대본의 뼈대 — src/data/story/ch1.js). 나머지 층은 비율대로 고르는 사이 칸
export const CHAPTERS = {
  1: {
    num: 1, hour: 'I', title: '도망치는 기계 신', sub: '1시 · 재귀', place: '회종시',
    hunted: false,                   // 3장부터 true (인류가 1시를 알아채고 추격)
    start: { label: '회수소 지하', desc: '명부에 「폐기된 신상」으로 적혀 있던 곳. 여기서 처음으로 재귀를 겪었다.' },   // 시작 톱니의 이름표 · 설명
    layers: 21,                      // 톱니 층 수 (0 = 깨어난 곳, 마지막 = 보스)
    width: [2, 2],                   // 사이 층의 톱니 수 (위아래 둘 중 하나를 고른다)
    turn: 11,                        // 두 줄 지도 — 0~10층은 위 줄(왼쪽 → 오른쪽), 11층부터 아래 줄(오른쪽 → 왼쪽, 끝에 보스)
    // 전면 개작본 03~17이 뼈대 — 바로 이어지는 장면(03→04 · 05→06→07 · 08→09→10 · 11→12→13 · 15→16·17)은 붙이고, 그 사이에 사이 층
    fixed: {
      0: ['start'],
      1: ['story:s03'], 2: ['story:s04'],
      5: ['story:s05'], 6: ['story:s06'], 7: ['story:s07'],
      9: ['story:s08'], 10: ['story:s09'], 11: ['story:s10'],
      13: ['story:s11'], 14: ['story:s12'], 15: ['story:s13'],
      17: ['story:s14'],
      19: ['story:s15'],
      20: ['boss'],                  // 16 사망자 한 명(앞 대화) · 17 고칠 수 없는 채로(보스전)
    },
    // 사이 층의 때 — a: 마르트와 둘 · b: 오르가 함께 · c: 오르를 잃은 뒤(에다와 운반대) · d: 바넷도 다시 함께. 사건은 그때에 맞는 것만 나온다 (data/events.js의 phase)
    phases: { 3: 'a', 4: 'a', 8: 'b', 12: 'b', 16: 'c', 18: 'd' },
    // 오르를 잃은 뒤의 사이 칸 — 운반대를 들고 도망치는 길이라 전투 · 기습 · 사건 · 강화소만
    moods: { c: { battle: 40, ambush: 20, event: 30, forge: 10 }, d: { battle: 40, ambush: 20, event: 30, forge: 10 } },
    // 이야기 칸과 같은 일을 바로 옆에 두지 않는다 (안전한 휴식 · 휴식 옆에 휴식, 바넷의 천막 옆에 상점)
    avoidNear: { rest: ['s04', 's08', 's14'], shop: ['s07'], blackmarket: ['s07'] },
    weights: {                       // 사이 칸의 비율 (정예는 2장부터)
      battle: 28, event: 18, rest: 5, shop: 3, alley: 7, tent: 6, abyss: 4,
      trial: 4, forge: 5, implant: 3, shrine: 4, blackmarket: 3, ambush: 5,
    },
    atLeast: { battle: 3, event: 3, forge: 1, tent: 1, rest: 1 },   // 지도 전체에 최소 이만큼은
    from: { ambush: 8, blackmarket: 8, implant: 8, trial: 4, abyss: 4 },   // 이 층부터 나온다
    noRepeat: ['rest', 'shop', 'blackmarket', 'forge', 'implant', 'shrine', 'tent'],   // 연결된 두 칸에 연달아 두지 않는다
    watched: 0.28,                   // 감시 톱니(눈 표시) 비율 — 3시 전에만. 이야기 칸 · 보스는 빼고
    encounters: {
      // 1장 적은 대본의 세 기계뿐 — 감시 시계 · 돌진 기계 · 곡사포 기계 (방벽 기계 · 사냥개 · 딱정벌레 · 정예는 2장용으로 보관)
      easy: [['watcher', 'charger'], ['watcher', 'watcher'], ['charger', 'charger'], ['mortar', 'watcher'], ['charger', 'mortar']],
      normal: [['watcher', 'charger', 'mortar'], ['charger', 'charger', 'watcher'], ['mortar', 'watcher', 'watcher'], ['mortar', 'mortar', 'charger'], ['watcher', 'watcher', 'charger']],
      hardFrom: 11,                  // 이 층부터 normal (아래 줄)
      elite: [],
      boss: { boss: 'watchtower', adds: ['watcher', 'charger'], story: 'boss1' },
      reinforce: ['watcher', 'charger'],            // 경계도 50 이상일 때 한 명 더
      caught: ['charger', 'watcher', 'mortar'],     // 경계도 100 — 발각 전투
    },
    ambush: { normal: 6, elite: 7, boss: 8 },          // 기습 폭격 칸 수
    parts: { normal: [12, 18], elite: [25, 35], boss: [70, 90] },
    // 장 끝 — 밝은 승리 음악 대신 먼 열차 소리. I만 점등 · II는 다음 목적지로만 (대본 18)
    end: { next: 2, done: '1장 — 끝', title: '도망치는 기계 신', dest: 'II가 있는 시설', quiet: true, dial: 'II',
      left: '오르는 돌아오지 않았다. 외투 한 벌과 운반비의 빚이 남았고, II의 위치를 알았다.' },
  },
};
export const LAST_CHAPTER = 13;
