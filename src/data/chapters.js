// 챕터 정의 — 지도 모양 · 칸 비율 · 적 구성 · 보상
// 13장: 1장 각성(1시) · 2~12장 시(時) 보스 · 13장 결말. 지금은 1장만 있다
export const CHAPTERS = {
  1: {
    num: 1, hour: 'I', title: '재귀', sub: '1시 · 각성', place: '무너진 성당 · 감시 구역',
    hunted: false,                   // 3장부터 true (인류가 1시를 알아채고 추격)
    layers: 14,                      // 톱니 층 수 (0 = 시작 제단, 마지막 = 보스)
    width: [2, 4],                   // 가운데 층의 톱니 수
    fixed: {                         // 고정된 층
      0: ['start'],
      1: ['tutorial'],
      2: ['tutorial'],
      12: ['rest', 'shop', 'rest'],
      13: ['boss'],
    },
    weights: {                       // 나머지 칸의 비율
      battle: 30, event: 8, rest: 6, shop: 4, elite: 8, alley: 6, tent: 5, abyss: 4,
      trial: 4, forge: 4, implant: 3, shrine: 3, blackmarket: 3, ambush: 4,
    },
    atLeast: {                       // 지도 전체에 최소 이만큼은 있게
      elite: 2, rest: 2, shop: 1, forge: 1, tent: 1, alley: 1, event: 2, abyss: 1,
      trial: 1, implant: 1, shrine: 1, blackmarket: 1, ambush: 1,
    },
    from: { elite: 5, ambush: 4, blackmarket: 4, implant: 4, trial: 4 },   // 이 층부터 나온다
    noRepeat: ['rest', 'shop', 'elite', 'blackmarket', 'forge', 'implant', 'shrine', 'tent'],   // 연결된 두 칸에 연달아 두지 않는다
    watched: 0.28,                   // 감시 톱니(눈 표시) 비율 — 3시 전에만
    encounters: {
      tutorial: [
        { foes: ['watcher'], hpMul: 0.6, ambush: 0, tut: 1 },
        { foes: ['watcher', 'hound'], hpMul: 0.8, ambush: 4, tut: 2 },
      ],
      easy: [['watcher', 'hound'], ['hound', 'hound'], ['watcher', 'beetle'], ['warden'], ['watcher', 'watcher']],
      normal: [['watcher', 'hound', 'beetle'], ['warden', 'watcher'], ['hound', 'hound', 'watcher'], ['warden', 'beetle', 'hound'], ['beetle', 'beetle', 'watcher']],
      hardFrom: 7,                   // 이 층부터 normal
      elite: [
        { id: 'gatekeeper', foes: ['gatekeeper', 'watcher', 'watcher'], story: 'eliteGate' },
        { id: 'alpha', foes: ['alpha', 'hound', 'hound'], story: 'eliteAlpha' },
      ],
      boss: { boss: 'watchtower', adds: ['watcher', 'beetle'], story: 'boss1' },
      reinforce: ['watcher', 'hound', 'beetle'],   // 경계도 50 이상일 때 한 명 더
      caught: ['warden', 'watcher', 'hound'],       // 경계도 100 — 발각 전투
    },
    ambush: { normal: 6, elite: 7, boss: 8 },          // 기습 폭격 칸 수
    parts: { normal: [12, 18], elite: [25, 35], boss: [70, 90] },
    end: { next: 2, teaser: '2시 — 준비 중' },
  },
};
export const LAST_CHAPTER = 13;
