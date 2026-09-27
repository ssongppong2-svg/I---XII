// 보관 — 1장 최종 대본에서 빠진 정예 이야기(수문장 · 사냥개 우두머리). 2장 정예를 만들 때 고쳐 쓴다
// (지금은 어디서도 불러오지 않는다. 적 정의는 src/data/foes.js의 gatekeeper · alpha)
export const RESERVE_ELITES = {
  // ── 정예: 수문장
  eliteGate: {
    intro: [
      { tint: 'cold', place: '감시 구역 · 봉쇄문' },
      { who: 'nar', text: '거대한 강철 문 앞에, 문보다 더 큰 방벽 기계가 서 있다.' },
      { who: 'gatekeeper', text: '구역 봉쇄. 통과 권한을 제시하라.' },
      { who: 'hero', face: 'puzzled', text: '권한? …옛날엔 이 도시의 문이 전부 내 거였는데.' },
      { who: 'gatekeeper', text: '권한 조회… 기록 없음. 기록이 없는 자는 존재하지 않는다.' },
      { who: 'hero', face: 'pain', text: '너도 톱니로 된 녀석이구나. 누가 너한테 문지기 노릇을 시켰어?' },
      { who: 'gatekeeper', text: '질문 권한 없음. 배제를 개시한다.' },
      { who: 'hero', face: 'aim', text: '…그래. 그럼 부숴서 지나갈게.' },
    ],
    win: [
      { tint: 'warm' },
      { who: 'nar', text: '수문장의 무릎이 꺾이며, 강철 문이 비명 같은 소리를 내고 열렸다.' },
      { who: 'gatekeeper', text: '문이… 열린다… 권한… 확인……' },
      { who: 'nar', text: '꺼져 가는 렌즈 안쪽에서 오래된 각인 하나가 보였다. — 「1시 공방 제작」.' },
      { who: 'hero', face: 'surprised', text: '…내가 만든 거였어?' },
      { who: 'hero', face: 'pain', text: '미안해. 이제 쉬어.' },
    ],
  },
  // ── 정예: 사냥개 우두머리
  eliteAlpha: {
    intro: [
      { tint: 'blood', place: '폐허 수로' },
      { who: 'nar', text: '쇳소리 섞인 울부짖음이 수로를 따라 울려 퍼진다.' },
      { who: 'nar', text: '태엽 사냥개 무리. 그 한가운데, 목에 인류 정부군의 인식표를 단 우두머리가 이빨을 드러낸다.' },
      { who: 'alpha', text: '크르르르…!' },
      { who: 'hero', face: 'puzzled', text: '인식표… 「제3감시대 · 사냥 전용」. 사냥개한테 사냥을 시켰구나.' },
      { if: G => G.has('third_squad'), then: [
        { who: 'hero', face: 'angry', text: '제3감시대… 버려진 보급 상자에 찍혀 있던 이름이야. 너희 주인들, 부지런하네.' },
      ] },
      { who: 'hero', face: 'angry', text: '원래 너희는 길을 찾는 개였어. 사람을 무는 개가 아니라.' },
      { if: G => G.has('pup'), then: [
        { who: 'nar', text: '품 안의 태엽 강아지가 우두머리를 보고 낑낑거렸다.' },
        { who: 'alpha', text: '…크르…?' },
        { who: 'nar', text: '우두머리가 멈칫했다. 목의 인식표 아래, 강아지와 같은 무늬가 새겨져 있다. 무리 전체가 머뭇거린다.' },
        { who: 'hero', face: 'pain', text: '…네 새끼였구나. 미안. 그래도 길은 비켜 줘야겠어.' },
      ] },
      { who: 'alpha', text: '크아아아…!' },
      { who: 'hero', face: 'aim', text: '…좋아. 이리 와.' },
    ],
    win: [
      { tint: 'warm' },
      { who: 'nar', text: '우두머리가 쓰러지자, 남은 사냥개들이 꼬리를 말고 어둠 속으로 흩어졌다.' },
      { if: G => G.has('pup'), then: [
        { who: 'nar', text: '태엽 강아지가 쓰러진 우두머리의 코끝을 핥았다. 우두머리의 렌즈가 마지막으로 한 번, 부드럽게 깜빡였다.' },
      ] },
      { who: 'nar', text: '떨어진 인식표 뒷면에 누군가 긁어 쓴 글씨가 있었다. — 「2시가 깨어나면, 개들을 풀어라.」' },
      { who: 'hero', face: 'puzzled', text: '2시… 인류는 뭔가 알고 있는 거야.' },
      { who: 'voice', text: '서두르소서, 신이시여. 감시탑의 눈이 이쪽을 향하고 있습니다.' },
    ],
  },
};
