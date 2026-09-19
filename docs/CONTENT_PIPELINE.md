# PASSMATE Content Pipeline

## 1. 전체 흐름

```text
SOURCE
  ↓
MASTER
  ↓
PRODUCT MANUSCRIPT
  ├─ CORE
  ├─ PASS PACK
  ├─ SHEET
  └─ CHECK
  ↓
DESIGN
  ↓
QA
  ↓
RELEASE
```

## 2. SOURCE

원본 자료 영역.

예:
- 공식 기출문제 PDF
- 공식 정답
- 공식 법령/고시
- 시험 시행기관 자료
- 참고자료

원본 대용량 자료는 NAS에 저장한다.

GitHub에는 원본 PDF를 기본적으로 저장하지 않는다.

## 3. MASTER

모든 상품 원고의 단일 기준 데이터.

MASTER에서 관리할 정보:

- 자료 인벤토리
- 시험 구조
- 문항 인덱스
- 개념 분류
- 출제 빈도
- 관련 기출 문항 수
- 최근 출제 회차
- 출제회차
- 공식/숫자/단위
- 기출 함정 패턴
- 이미지/도면 의존 문항
- 정답 검증 상태
- 법규 최신성
- 상품 반영 위치
- QA 상태

### 출제이력 표현

판매본에서는 아래 형식을 사용한다.

```text
관련 기출 11문항 | 최근 출제 26회
출제회차 18 · 19 · 20 · 22 · 23 · 25 · 26회
```

주의:
- `관련 기출 N문항` = 문항 개수
- `최근 출제 N회` = 가장 최근 시험 회차
- `출제회차` = 실제 등장한 시험 회차 목록

세 값을 혼동하지 않는다.

## 4. PRODUCT MANUSCRIPT

MASTER를 바탕으로 파생 원고를 만든다.

### CORE
핵심 개념을 압축한다.

### PASS PACK
상세 설명과 문제풀이까지 확장한다.

### SHEET
공식/숫자/단위만 초압축한다.

### CHECK
시험 직전 자가점검 문장으로 변환한다.

파생 원고에서 새로운 사실을 임의 생성하지 않는다.

## 5. DESIGN

디자인 단계에서는 내용 자체를 임의 수정하지 않는다.

허용:
- 줄바꿈
- 시각적 그룹핑
- 표/박스 배치
- 자체 도식
- 정보 위계 조정

금지:
- 정답 임의 변경
- 숫자/공식 수정
- 출제회차 추정
- 원고에 없는 내용 추가
- 제3자 기출/참고자료 이미지 그대로 복제

## 6. QA

최종 판매 전 다음을 검증한다.

- 정답
- 공식
- 숫자
- 단위
- 출제회차
- 관련 기출 문항 수
- 최근 출제 회차
- 법규 최신성
- 이미지/도면 재구성 정확성
- 디자인 과정의 내용 누락
- 특수문자 렌더링
- PDF 페이지 잘림/깨짐
- 예상문제 정답과 해설 일치

## 7. RELEASE

QA 완료 후 판매용 버전을 만든다.

권장 메타데이터:

- product
- certification
- version
- revision_date
- source_cutoff
- qa_status
- release_date

## 8. 저장 위치 원칙

### NAS

Source of Truth:
- 원본 기출 PDF
- 공식 정답
- 대용량 이미지
- 디자인 작업파일
- 최종 Release PDF
- 보관용 Archive

### GitHub

버전 관리:
- MASTER Markdown
- CORE Markdown
- PASS PACK Markdown
- SHEET Markdown
- CHECK Markdown
- QA 문서
- 설계/운영 문서
- 작은 구조화 데이터
- 자동화 코드/설정

## 9. 권장 콘텐츠 구조

```text
content/
└─ STAGE_SOUND_L3/
   ├─ MASTER/
   ├─ CORE/
   ├─ PASS_PACK/
   ├─ SHEET/
   ├─ CHECK/
   └─ QA/
```

실제 파일이 생길 때 폴더를 추가한다. 빈 폴더를 유지하기 위한 불필요한 파일은 만들지 않아도 된다.
