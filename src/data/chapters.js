// 챕터 정의 — 지도 모양 · 칸 비율 · 적 구성 · 보상
// 13장: 1장 각성(1시) · 2~12장 시(時) 보스 · 13장 결말. 지금은 1장만 있다
// fixed의 'story:s02' = 이야기 칸 (대본의 뼈대 — src/data/story/ch1.js). 나머지 층은 비율대로 고르는 사이 칸
export const CHAPTERS = {
  1: {
    num: 1, hour: 'I', title: '도망치는 기계 신', sub: '1시 · 재귀', place: '회종시',
    hunted: false,                   // 3장부터 true (인류가 1시를 알아채고 추격)
    start: { label: '폐기 보관소', desc: '끝났어야 할 박자가 다시 울린 곳. 여기서 첫 톱니가 돈다.' },   // 시작 톱니의 이름표 · 설명
    layers: 18,                      // 톱니 층 수 (0 = 깨어난 곳, 마지막 = 보스)
    width: [2, 2],                   // 사이 층의 톱니 수 (이야기 칸 사이를 위아래로 갈라 고른다)
    // 대본 02~11이 뼈대 — 바로 이어지는 장면(02→03 · 05→06 · 07→08 · 10→11)은 붙이고, 그 밖에는 사이 층 1~2개
    fixed: {
      0: ['start'],
      1: ['story:s02'], 2: ['story:s03'],
      5: ['story:s04'],
      7: ['story:s05'], 8: ['story:s06'],
      11: ['story:s07'], 12: ['story:s08'],
      14: ['story:s09'],
      16: ['story:s10'],
      17: ['boss'],
    },
    weights: {                       // 사이 칸의 비율 (정예는 2장부터)
      battle: 28, event: 18, rest: 5, shop: 3, alley: 7, tent: 6, abyss: 4,
      trial: 4, forge: 5, implant: 3, shrine: 4, blackmarket: 3, ambush: 5,
    },
    atLeast: { battle: 3, event: 3, forge: 1, tent: 1, alley: 1, rest: 1 },   // 지도 전체에 최소 이만큼은
    from: { ambush: 6, blackmarket: 6, implant: 6, trial: 4, abyss: 4 },       // 이 층부터 나온다
    noRepeat: ['rest', 'shop', 'blackmarket', 'forge', 'implant', 'shrine', 'tent'],   // 연결된 두 칸에 연달아 두지 않는다
    watched: 0.28,                   // 감시 톱니(눈 표시) 비율 — 3시 전에만. 이야기 칸 · 보스는 빼고
    encounters: {
      // 1장 적은 대본의 세 기계뿐 — 감시 시계 · 돌진 기계 · 곡사포 기계 (방벽 기계 · 사냥개 · 딱정벌레 · 정예는 2장용으로 보관)
      easy: [['watcher', 'charger'], ['watcher', 'watcher'], ['charger', 'charger'], ['mortar', 'watcher'], ['charger', 'mortar']],
      normal: [['watcher', 'charger', 'mortar'], ['charger', 'charger', 'watcher'], ['mortar', 'watcher', 'watcher'], ['mortar', 'mortar', 'charger'], ['watcher', 'watcher', 'charger']],
      hardFrom: 9,                   // 이 층부터 normal
      elite: [],
      boss: { boss: 'watchtower', adds: ['watcher', 'charger'], story: 'boss1' },
      reinforce: ['watcher', 'charger'],            // 경계도 50 이상일 때 한 명 더
      caught: ['charger', 'watcher', 'mortar'],     // 경계도 100 — 발각 전투
    },
    ambush: { normal: 6, elite: 7, boss: 8 },          // 기습 폭격 칸 수
    parts: { normal: [12, 18], elite: [25, 35], boss: [70, 90] },
    end: { next: 2, done: '1장 완료', title: '도망치는 기계 신', dest: 'II 귀속 시설', teaser: '다음 목적지 — II 귀속 시설' },
  },
};
export const LAST_CHAPTER = 13;
