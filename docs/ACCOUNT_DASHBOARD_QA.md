# 내 계정 학습 대시보드 · 2026-10-10

## 숫자·그래프 모션 보완 (2026-10-10)

| 이전 | 이후 | 이유 |
| --- | --- | --- |
| 최종 숫자만 표시 | 화면에 보일 때 850ms 동안 0부터 증가 | 사용자가 요청한 학습 성과 표현 |
| 정적인 그래프 | 왼쪽부터 선·점이 한 번 그려짐 | 변화 흐름을 읽기 쉽게 표현 |
| 수치는 별도 목록에서 확인 | 호버·터치·키보드로 날짜/회차/정답률 툴팁 + 기존 목록 유지 | 그래프에서 바로 확인, 대체 접근 보존 |

- `components/use-account-reveal.ts`: 한 번의 viewport 진입, RAF ease-out, reduced-motion/실시간 설정 변경 및 정리. RAF 시각이 시작 시각보다 이른 첫 프레임도 진행도를 0~1로 제한한다.
- `components/account-study.tsx`: 세 요약 수치의 시각 카운터/고정 접근성 최종 값. `components/account-accuracy-chart.tsx`: SVG clip reveal, 최근 시험 선택·툴팁·접근성. `app/account.css`: tabular-nums, 선택점·조작 영역·툴팁만 추가. 기존 기본/767px 레이아웃은 유지한다.
- 로컬 production build에서 Edge/WebKit 각각 360/390/430/768/1280px: 증가/그리기 중간 프레임과 최종 값, 재생 반복 없음, 호버 35회, 키보드 25회, 터치 5회 확인. 빈 기록/한 회/실제 0점/100점, reduced-motion, 실행 중 설정 변경, 페이지 이동도 확인했다.
- 기존 계정 회귀 검사도 두 엔진 각각 5개 폭·추가 9건·타 화면 헤더 20건 통과: 넘침 0, 터치 위반 0, 보조 최소 14px, 대비 7.56:1. 모든 인증·학습 응답은 synthetic fixture이며 실제 사용자 기록·DB·결제·다운로드를 쓰거나 변경하지 않았다.
- `npm run check`, `npx tsc --noEmit`, `npx next build` 통과. 새로운 의존성은 없다. 캡처/영상/실행 도구/운영 검증: 외곽 워크스페이스 `reports/account-motion-20261010/`; 기존 UI 회귀 결과 `reports/account-ui-20261010/motion-built-*.json`.
- 전체 페이지 CLS=0을 주장하지 않는다. 변경 전에도 인증·기록 로딩 전환에 Chromium layout shift가 존재하며 WebKit은 관측 API 미지원이다. 모션은 기존 레이아웃 크기를 바꾸지 않지만 초기 로딩 레이아웃 안정화와 iOS 실기기 확인은 별도 남은 항목이다.
- 롤백: 이번 `feat(account)` 커밋만 `git revert`하면 카운터/그리기/툴팁 추가를 되돌린다. 학습 대시보드·이름 인사·원래 통계와 데이터 계약은 유지하며 DB 복원은 필요 없다. 배포 완료 증거는 워크스페이스 결과 문서에 별도로 기록한다.

> 최신 인사 보완: 사용자 피드백에 따라 두 줄 인사는 `김주환 님 👋` 한 줄로 간소화했다. 이름 없는 계정은 `내 계정 👋`다. 기존 사람 아이콘/인사 문장은 제거하고 손 이모지는 aria-hidden 처리한다. Edge·WebKit의 5개 폭, 긴/없는 이름, 기존 계정 동작과 다른 화면 헤더 검증 및 check/tsc/build가 통과했다. 아래 두 줄 인사 설명은 최초 대시보드 변경 당시 기록이다.

## 변경

- 기존 한 카드의 이름 폼·이메일·숫자·여러 버튼을 학습 현황 / 최근 정답률 / 다음 복습 / 최근 학습 표 / 계정 설정으로 나눈다.
- PC 본문 최대 1040px, 모바일 좌우 16px. 모바일 요약 3열, 그래프·복습·설정은 세로 배치한다. 본문 16px, 보조 최소 14px, 제목 700 / 섹션 제목 600, 컨트롤 최소 44px. 기존 Pretendard와 파랑·네이비 토큰을 그대로 참조한다.
- 헤더의 로그인 계정 메뉴를 실제 표시 이름 + `반갑습니다!` 두 줄로 표시한다. 프로필 이름이 우선이며 OAuth metadata의 full_name/name/nickname을 보조로 사용한다. 이름이 없으면 `반갑습니다!`만 표시하고 이메일을 이름으로 대신 쓰지 않는다. 긴 이름은 화면에서 생략하고 접근성 이름에는 전체 인사와 `계정 메뉴`를 유지한다. 메뉴의 기존 `내 계정` 링크는 보존한다.
- 성공한 이름 저장 후 같은 페이지의 헤더 인사를 즉시 갱신한다. 저장 SQL과 인증 SDK는 기존 경로를 사용한다. 로그아웃 시 계정 감시의 로그인 이동이 홈 이동과 경쟁하지 않도록 UI 이동을 조율한다.

## 통계 의미와 데이터 범위

| 항목 | 산식 / 범위 |
| --- | --- |
| 학습 완료율 | 제출한 시험 수 / 시작한 시험 수. 전체 문제은행 진도율을 의미하지 않는다. 시험이 없으면 `—` |
| 평균 정답률 | 0~100 범위의 유효한 제출 시험 score의 산술 평균. 시험별 평균이며 문항 수 가중 평균이 아니다. 미채점·진행 중·손상된 score는 제외, 실제 0점은 포함 |
| 최근 정답률 | 채점된 최근 시험 최대 7회, 오래된 순서 → 최신. 각 그래프 수치는 별도 펼치기 목록과 SVG 접근성 설명으로 제공 |
| 최근 학습 기록 | 진행 중 / 완료를 포함한 최신 5회. 날짜는 한국 시간 기준. 자격증 이름은 Git에 저장된 catalog snapshot에서 서버가 전달 |
| 남은 오답 / 복습 완료 | wrongCount > 0인 고유 문항 중 mastered=false / true |
| 북마크 | 계정의 legacy/NAS 기록을 문항 ID 기준으로 중복 제거 |

- `question_bank_attempts`, `question_bank_bookmarks`, `question_bank_wrong_notes`, `question_bank_user_question_state`를 현재 user_id로 제한하여 읽는다. 1000행씩 정렬·페이지 조회해 API 기본 제한에 따른 통계 누락을 방지한다.
- 공유 브라우저의 guest localStorage는 개인 통계에 섞지 않고 수정하지 않는다. 로그인 전 기록이나 동기화되지 않은 기기 기록은 계정 통계에 포함되지 않는다. 기존 CBT 동기화·시험 제출·채점·오답·북마크 저장 계약은 변경하지 않는다.
- 계정 학습 조회는 최대 10초 후 오류·재시도로 전환한다. 일부 조회가 실패하면 부분 데이터를 정상 수치로 표시하지 않는다. NAS 문제/이미지·가격 조회를 기다리지 않는다.
- 운영 DB의 네 테이블 RLS 활성화와 SELECT/ALL 정책의 auth.uid()=user_id를 **읽기 전용 메타데이터 SQL**로 확인했다. 운영 학습 데이터와 인증·DB 스키마·정책·결제·다운로드는 변경하지 않았다.

## 검증

- Chromium(Edge) / Playwright WebKit 각각 360/390/430/768/1280px: 가로 넘침 0, 계정 컨트롤·헤더 메뉴·그래프 펼치기 터치 영역 44px 이상, 보조 텍스트 최소 14px, 보조 색 대비 7.56:1.
- 각 엔진 추가 9건: 이름 저장 후 헤더 갱신, 빈 기록, 이름 없음, 긴 이름, 프로필 조회 실패, 학습 조회 실패→재시도, 지연, 비로그인 로그인 이동, 로그아웃 홈 이동. 홈 / 스토어 / 상품 목록 / CBT 헤더는 각 5개 폭에서 영역 겹침을 추가 검사했다.
- 모든 인증/프로필/학습 응답은 **fixture**다. 운영 사용자로 로그인하거나 이름/학습 기록을 쓰지 않았다. 실제 계정의 과거 기록 양과 iOS 실기기 Safari는 수동 확인 대상이다.
- 통계 단위 테스트: 분모, 0점, 누락·손상 score, 불변성, 이름 우선순위·개인 이메일 미사용, user_id 제한, 1001행 페이지 조회, 실패/무사용자 처리.
- 로컬 production build에서도 두 엔진 각각 5개 폭 / 추가 9건 / 다른 화면 헤더 20건을 확인했다. 기존 최근 로그인 기능의 이메일 성공/실패·Google/카카오 성공/취소 각 6건도 두 엔진에서 fixture 회귀 검사했다.
- `npm run check`, `npx tsc --noEmit`, `npx next build` 통과. 기존 법적 문서 4개 본문 / 비공개 전화 / 미확정 운영시간 관련 경고 6개는 이 작업 범위와 독립적으로 유지된다.
- 캡처·재현 도구·각 엔진 JSON: 외곽 워크스페이스 `reports/account-ui-20261010/`. 개발 서버 캡처 `before-*` / `after-*`, production build 캡처 `built-*`, 배포 후 확인 `production-*`는 실제 완료된 파일을 기준으로 본다.

## 변경 파일과 롤백

- 화면: `app/account/page.tsx`, `components/account-client.tsx`, `components/account-study.tsx`.
- 헤더 이름: `components/auth-nav.tsx`, `lib/account-display-name.ts`.
- 계정 통계와 조회: `lib/account-insights.ts`, `lib/account-study.ts`.
- 스타일: `app/account.css`, `app/layout.tsx` import. 기본 PC 규칙 + 1100px 헤더 응답형 + 767px 모바일 계정 배치이며 기존 다른 페이지 카드/푸터에는 적용하지 않는다.
- 검사: `scripts/test-account-insights.mjs`, `package.json`의 기존 check 체인에 추가.
- 이 기능은 한 커밋 `feat(account): personalize study dashboard and account greeting`로 배포한다. 해당 커밋만 `git revert <commit>`하여 기존 계정 UI와 헤더 라벨로 복원한다. DB 마이그레이션이나 데이터 복원은 필요 없다.
- 배포 직전 운영 기준: b730207 / passmate-store-j7ejba047-cueits-projects.vercel.app. 긴급 대응은 기존 Ready deployment 복원 또는 기능 커밋 revert 후 Git 배포를 사용한다.
