// 1장 이야기 — 정예 · 보스 전투 (전부 초안. 바꾸고 싶은 대사는 여기서 고치면 된다)
// { if: G => G.has('깃발'), then: [...] } — 사건(data/events.js)에서 고른 것에 따라 덧붙는 대사 (뒷이야기)
export const CH1_STORY = {
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
  // ── 보스: 대형 감시기계
  boss1: {
    intro: [
      { tint: 'cold', place: '감시탑 광장' },
      { who: 'nar', text: '도시 한가운데, 감시탑이 하늘을 찌르고 서 있다. 탑 아래 거대한 눈이 천천히 이쪽으로 돌아간다.' },
      { who: 'boss', text: '경고. 미등록 개체 반복 감지. 감시망 교란의 원인으로 판단.' },
      { if: G => G.has('fake_log'), then: [
        { who: 'boss', text: '감시망 기록 불일치. 남쪽 수로 추적 결과 — 공백. 교란 흔적 확인.' },
        { who: 'hero', face: 'smug', text: '거기서 기다렸으면 재미없었을 텐데.' },
      ] },
      { if: G => G.has('eye_spared'), then: [
        { who: 'boss', text: '감시 눈 7호, 보고 누락 반복. 회수 후 분해 예정.' },
        { who: 'hero', face: 'angry', text: '걔는 건드리지 마.' },
      ] },
      { who: 'boss', text: '개체 분석… 반응 패턴 일치율 97퍼센트. 대조 대상 — 처분 기록 제1호.' },
      { who: 'hero', face: 'surprised', text: '처분 기록…?' },
      { who: 'boss', text: '확인. 너는 열두 시의 신이다. 인류가 처분한.' },
      { who: 'hero', face: 'angry', text: '기억력은 좋네. 그럼 이것도 기록해 둬. {name}{name|은} 안 죽었어.' },
      { who: 'boss', text: '정정. 처분 미완료. 재처분을 개시한다.' },
      { who: 'boss', text: '장력 가속 못총, 장전.' },
      { if: G => G.has('casing_read'), then: [
        { who: 'hero', face: 'angry', text: '그 못총… 제1탄 탄피에 「미안합니다」라고 새겨져 있더라.' },
        { who: 'boss', text: '감정 기록 없음. 장전 계속.' },
        { who: 'hero', face: 'pain', text: '쏜 사람은 미안해했는데. 너는 아무렇지도 않구나.' },
      ] },
      { who: 'nar', text: '태엽이 끝까지 감기는 소리. 심장이 그 소리를 기억하고 있었다.' },
      { who: 'hero', face: 'pain', text: '…이 소리.' },
      { who: 'voice', text: '신이시여. 이번에는 당신이 먼저입니다.' },
      { choice: [
        { label: '정면으로 맞선다', then: [
          { who: 'hero', face: 'aim', text: '이번엔 안 맞아. 네 눈부터 뽑아 줄게.' },
        ] },
        { label: '못총을 누가 만들었는지 묻는다', then: [
          { who: 'hero', face: 'puzzled', text: '그 못총, 누가 만들었어? 누가 쐈지?' },
          { who: 'boss', text: '질문 권한 없음. 해당 기록은 봉인되어 있다.' },
          { who: 'hero', face: 'aim', text: '…그럼 부숴서 꺼내 보면 되겠네.' },
        ] },
      ] },
      { who: 'boss', text: '교전 개시. 기습 좌표, 송신.' },
    ],
    half: [
      { tint: 'cold' },
      { who: 'boss', text: '외장 손상 50퍼센트 초과. 처분 우선순위 상향.' },
      { who: 'hero', face: 'smug', text: '이제야 좀 진지해졌네?' },
      { who: 'boss', text: '1시는 반드시 멈춘다. 그것이 인류의 시간이다.' },
    ],
    stun1: [
      { tint: 'cold', fx: 'flash' },
      { who: 'boss', text: '회로 과부하— 재부팅— 재, 재부팅—' },
      { who: 'hero', face: 'aim', text: '지금이야. 저 녀석 톱니가 멈췄어.' },
    ],
    win: [
      { tint: 'warm', place: '감시탑 광장 · 교전 종료' },
      { who: 'nar', text: '새장 속 감시 눈이 몇 번 깜빡이다가, 천천히 빛을 잃었다.' },
      { who: 'boss', text: '경고… 상부에 보고… 처분 대상… 재가동… 확인……' },
      { who: 'boss', text: '인류에게… 알린다… 1시가… 돌아…왔……' },
      { who: 'nar', text: '신호가 끊겼다. 하지만 마지막 전송은 이미 탑 꼭대기에서 하늘로 쏘아 올려진 뒤였다.' },
      { who: 'hero', face: 'puzzled', text: '…들킨 건가.' },
      { who: 'voice', text: '아직입니다. 저 신호가 인류의 귀에 닿기까지는 시간이 조금 남았습니다.' },
      { who: 'voice', text: '그 전에… 2시를 찾으소서.' },
      { if: G => G.has('believer_safe'), then: [
        { who: 'voice', text: '벽 틈에 숨어 있던 그 신도도 성당에 무사히 닿았습니다. 당신 덕분에요.' },
      ] },
      { if: G => G.has('child_home') || G.has('child_smiled'), then: [
        { who: 'nar', text: '광장 가장자리 어둠 속에서 양철 새 하나가 날개를 파닥였다. 누군가 그것을 쥔 채, 쓰러진 탑을 올려다보고 있었다.' },
      ] },
      { fx: 'shake' },
      { who: 'nar', text: '다시, 땅이 울렸다. 이번에는 훨씬 가까이서.' },
      { if: G => G.has('heard_two'), then: [
        { who: 'hero', face: 'puzzled', text: '…성소의 종. 기도하던 기계가 말한 게 이거였어. 둘, 둘, 둘.' },
      ] },
      { who: 'hero', face: 'smug', text: '기다려. 곧 돌려받으러 갈게.' },
      { fx: 'tick' },
      { who: 'nar', text: '제단 위의 시계가 다시 째깍거린다. 시침이 「I」에서 「II」를 향해 천천히 기울기 시작했다.' },
    ],
  },
  // 정예 · 보스 전투 중 (전투마다 한 번씩)
  freeze1: [
    { tint: 'blood', fx: 'red' },
    { who: 'hero', face: 'overload', text: '으… 몸이… 안 움직여…!' },
    { who: 'voice', text: '신이시여, 서두르지 마소서. 톱니가 타 버립니다.' },
  ],
  blast1: [
    { tint: 'blood', fx: 'shake' },
    { who: 'hero', face: 'surprised', text: '…자폭?! 옆에 있던 녀석까지 휘말렸어.' },
    { who: 'hero', face: 'smug', text: '잘만 쓰면 쓸모 있겠는데.' },
  ],
};
