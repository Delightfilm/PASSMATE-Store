# PASSMATE Design System

## 1. 기본 원칙

PASSMATE의 핵심노트와 시험대비 완성패키지는 **같은 디자인 시스템의 Light / Dark Variant**로 운영한다.

서로 다른 브랜드처럼 디자인하지 않는다.

공통:
- 동일한 Typography
- 동일한 Grid
- 동일한 Header/Footer
- 동일한 표 스타일
- 동일한 도식 스타일
- 동일한 Badge 체계
- 동일한 기하학적 디자인 언어

## 2. 상품별 테마

### 시험대비 완성패키지 — Dark Variant

키워드:
- Dark
- Deep
- Full Study

주요 색:
- Deep Navy
- Blue
- White

표지는 어두운 Navy 중심으로 유지한다.

### 핵심노트 — Light Variant

키워드:
- Light
- Fast
- Quick Review

주요 색:
- White / Very Light Blue
- Deep Navy Typography
- Bright Blue Accent

시험대비 완성패키지 표지와 **레이아웃은 동일하게 유지하고 배색과 상품 문구만 변경**한다.

## 3. 번호 체계

점 표기 대신 하이픈 표기를 사용한다.

### 핵심노트

```text
1-1
1-2
1-3
```

### 시험대비 완성패키지

```text
2-1
2-2
2-3
```

하위 요소는 필요에 따라 `1`, `2`, `3`으로 단순화하거나, 반드시 필요할 때만 `2-1-1` 형식을 사용한다.

## 4. 출제이력

고객용 표준 표현:

```text
관련 기출 11문항 | 최근 출제 26회
출제회차 18 · 19 · 20 · 22 · 23 · 25 · 26회
```

금지:
- `출제 11회`처럼 문항 수와 시험 회차가 혼동되는 표현
- 실제 적중을 의미하지 않는 `적중 N문항`

## 5. 판매본에서 금지하는 내부 용어

아래는 제작/QA 내부 용어이므로 고객에게 노출하지 않는다.

- MASTER
- MASTER VERIFIED
- VERIFIED
- QA
- Evidence Map
- SOURCE-SUPPORTED
- TRAP-xx
- 내부 관리 ID

고객용으로 변환:

- 기출 기반
- 기출 확인
- 출제이력
- 기출 함정
- 자주 틀리는 포인트

## 6. 페이지 구성

### Header

좌측:
`PASSMATE`

우측:
현재 Chapter/Section

얇은 구분선을 사용한다.

### Footer

좌측:
페이지 번호

우측:
`PASSMATE`

## 7. 정보 위계

### Chapter
큰 숫자 + 큰 제목.

### Section
예: `2-2 음향물리`

### Subsection
예: `1 주파수와 파장`

페이지마다 동일한 규칙을 유지한다.

## 8. 박스

박스 사용은 제한한다.

허용:
- 핵심 공식
- 핵심 개념
- 기출 함정
- TIP
- 숫자 암기
- 정답
- 핵심 포인트

일반 설명과 해설은 가능한 흰 배경 위에 자연스럽게 배치한다.

## 9. 도식

사진보다 자체 도식을 우선한다.

예:
- 파장
- 거리감쇠
- Signal Flow
- 마이크 지향패턴
- AB / XY / ORTF / MS
- Filter Curve
- Compressor Curve
- Feedback Loop
- 직렬/병렬 연결

도식은 Navy / Blue Line 중심으로 단순하게 표현한다.

## 10. 특수문자

최종 PDF에서 아래 표기는 반드시 정상 렌더링되는지 QA한다.

- dBu
- dBV
- dBFS
- dBSPL
- dB(A)
- LUFS
- Hz
- kHz
- Ω
- λ
- log₁₀
- m/s
- V
- W

## 11. 무대음향 3급 표지 기준

### 시험대비 완성패키지

- 현재 승인된 Dark/Navy 표지 레이아웃 유지
- 문구: `시험대비 완성패키지`
- 부제 예: `상세 개념해설 + 단원별 확인문제·해설`

### 핵심노트

- 시험대비 완성패키지와 동일한 레이아웃
- Light Theme으로 명도 전환
- 문구: `핵심노트`
- 부제 예: `핵심개념 · 공식·수치 · 시험 직전 체크`

공통 메타 예:

```text
기출 600문항 분석 · 2026 EDITION
```

`공통 60 + 전공 40`은 시험 한 회 구성 정보이므로 표지의 600문항 분석 문구와 같은 문장에 섞지 않는다.
