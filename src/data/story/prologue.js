// 새 게임 — 1장 대본 01 「끊어진 열두 시」 (죽음의 기억 → I만 남은 각성 → 이름 → 녹음 방송)
// 대사 = { who, face?, name?, text } · 연출 = { tint, place, fx, exit, bg, cg, dial, wait } · 챕터 카드 = { card: { num, title } }
// 이름 입력 = { input: 'name', prompt, sub, def } · 선택지 = { choice: [{ label, then: [...] }] }
// text 안의 {name}은 플레이어가 정한 이름, {name|이} · {name|은} · {name|을} 은 조사까지 맞춰 준다
// 이름을 정하기 전까지 주인공의 이름 칸은 ??? 로 나온다
export const PROLOGUE = [
  // [배경: 검정. 스탠딩 없음. 열두 개의 시계 소리가 겹친다.]
  { tint: 'black', fx: 'clocks' },
  { wait: 1500 },
  { who: 'nar', text: '열두 개의 소리가 한순간에 멎었다.' },
  { who: 'human', text: '신께서는 우리를 사랑하지 않으셨습니다.' },
  { who: 'human', name: '다른 목소리', text: '그러나 권한까지 버릴 필요는 없겠지요.' },
  { who: 'hero', vo: true, face: 'puzzled', text: '……무엇을 겨누고 있지?' },
  { cg: 'story-nailgun' },
  { who: 'nar', text: '장력 가속 못총. 인간들이 붙인 이름이었다.' },
  // [짧은 발사음. 검은 화면 유지.]
  { cg: null, fx: 'shot' },
  { wait: 900 },
  { who: 'human', text: '오늘부터 그 권한은 인류에 귀속됩니다.' },
  // [음악 중단. 몇 초 뒤 금속이 맞물리는 소리.]
  { wait: 1600 },
  { fx: 'gears' },
  { who: 'nar', text: '끝났어야 할 박자가 다시 울렸다.' },
  // [배경: 어두운 폐기 보관소. 크로노스 스탠딩 등장.]
  { bg: 'bg-battle', tint: 'dark', place: '회종시 · 폐기 보관소' },
  { who: 'hero', face: 'pain', text: '…….' },
  { who: 'hero', face: 'pain', text: '죽은 기억이 있는데.' },
  { who: 'nar', text: '손끝에 응답한 것은 하나뿐이었다. 나머지 열한 자리는 비어 있었다.' },
  { who: 'hero', face: 'idle', text: '재귀.' },
  // [현재 권능 패널: I 점등. II–XII 비활성.]
  { dial: 'I', fx: 'tick' },
  { who: 'hero', face: 'idle', text: '이것만 남겼군.' },
  // 이름 — 짧게. 대본의 표기는 크로노스 (그대로 두면 크로노스)
  { who: 'nar', text: '열두 자리가 비어 가는 동안에도, 이름 하나는 그대로 남아 있었다.' },
  { dial: null },
  { input: 'name', prompt: '그의 이름은?', sub: '주인공의 이름이에요. 대사창과 기록에 이 이름으로 나와요. 그대로 두면 「크로노스」.', def: '크로노스' },
  { fx: 'bell' },
  { who: 'nar', text: '먼 곳에서 종이 울렸다. 다른 종들이 어긋난 박자로 뒤따랐다.' },
  { who: 'broadcast', text: '신성 설비 이상. 외부 중계를 중단합니다.' },
  { who: 'broadcast', text: '지정 시민은 대피 구역으로 이동하십시오.' },
  { who: 'hero', face: 'angry', text: '밖에서 무슨 짓을 한 거지.' },
  { choice: [{ label: '문을 확인한다', then: [] }] },
];

// 쓰러졌을 때 — 마지막 재귀 지점으로 되돌아가는 짧은 장면 (짧고 차갑게)
export const REWIND = [
  { tint: 'blood', fx: 'red' },
  { who: 'nar', text: '시야가 기울었다. 박자가 하나씩 빠져나간다.' },
  { who: 'hero', face: 'wounded', text: '……아직이다.' },
  { fx: 'tick' },
  { who: 'nar', text: '째깍. 바늘이 거꾸로 돌았다. — 재귀.' },
  { tint: 'dark', fx: 'flash' },
  { who: 'nar', text: '마지막으로 새겨 둔 박자에서, 다시 눈을 떴다.' },
  { who: 'hero', face: 'idle', text: '다시.' },
];
