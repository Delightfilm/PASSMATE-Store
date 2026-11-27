# Search Console 색인 알림 점검 — 2026-11-27

Search Console 알림 2건(`찾을 수 없음(404)` 2026-11-19, `적절한 표준 태그가 포함된 대체 페이지` 2026-11-26)을 코드·라이브 사이트 기준으로 점검한 기록이다. Search Console 보고서 자체는 Google 로그인이 필요해 열지 못했으므로, 영향 URL 목록은 여전히 미확인이다.

## 확인한 상태

- `main` 55240dc(운영 배포본) 기준 로컬 프로덕션 빌드에서 `sitemap.xml`의 507개 URL 전부 HTTP 200, `<link rel="canonical">`이 자기 URL과 일치. `sitemap.txt`도 같은 목록이다.
- 공개 페이지에서 크롤러가 따라갈 수 있는 내부 링크 중 200이 아닌 응답 없음.
- 카탈로그 스냅샷(cbt-home-catalog.generated.json)은 2026-10-05 이후 변경되지 않았다. 사이트맵 URL 집합이 바뀌어 생긴 404는 아니다.
- 삭제된 라우트는 `/admin/products/[code]/preview/`(관리자, robots 차단)와 `/api/health` 두 개뿐이다.
- 스토어 중단(STORE_ENABLED=false) 상태의 `/store/`, `/products/`, `/products/<slug>/`는 404가 아니라 200 + `noindex, follow`다.
- 일반 자동화 HTTP 클라이언트는 여전히 Vercel Bot Protection challenge(429)를 받는다. 로그인·브라우저 세션 없이 curl로 운영 HTML을 받을 수 없어, 대량 확인은 로컬 프로덕션 빌드로 수행했다.

## 대체 페이지(canonical) 원인 — 코드 결함

자격증 상세 상단 학습 안내(`QualificationStudyGuide`)와 학습 안내 페이지가 `?tab=mock`, `?tab=subjects`, `?tab=records` 앵커를 서버 렌더링하고 있었다. 이 URL은 200으로 열리고 canonical은 쿼리 없는 `/cbt/<종목>/`이므로 Google에는 "대체 페이지"로 기록된다. 리다이렉트 오류가 아니라 같은 내용을 가리키는 두 번째 URL을 사이트가 스스로 만든 경우다.

- 대상: 우선 종목 11개(전기기능사, 지게차운전기능사, 무대음향·무대기계·무대조명 1~3급) + 학습 안내 3개 → 크롤 가능한 중복 URL 약 35개
- 라이브 확인: `https://www.mypassmate.com/cbt/전기기능사/?tab=mock` → 200, canonical `https://www.mypassmate.com/cbt/전기기능사/`

## 404 원인

영향 URL 목록을 볼 수 없어 단정할 수 없다. 확인 가능한 사실은 위의 "확인한 상태"뿐이고, 코드로 재현되는 404는 다음 두 가지다.

1. **한글 슬러그의 정규화 변형** — 분해형(NFD) 한글, 호환 문자, 공백 표기가 정본 슬러그와 문자열로 달라 조회에 실패해 404가 됐다. 라이브에서 `/cbt/전기기능사/`(NFD) 404 확인. 한국어 URL을 복사·붙여넣기하거나 macOS에서 링크를 만들 때 생기는 형태다.
2. **404 화면 품질** — Next.js 기본 영어 화면("404 This page could not be found.")이 그대로 노출됐다. 상태 코드는 맞지만 방문자에게 한국어 안내도, 사이트로 돌아갈 경로도 없다.

## 변경

- `components/cbt-public-content.tsx`, `app/cbt/[certSlug]/guide/page.tsx`: 탭 링크를 `#mock` 등 fragment로 변경. fragment는 서버로 전송되지 않아 색인 대상 URL을 만들지 않는다.
- `components/question-bank-client.tsx`: 학습 탭 상태를 fragment에서 읽고 쓰도록 변경. 기존 `?tab=` 링크는 계속 동작한다(호환 유지). 허브의 맞춤 시험지 링크도 `#builder`.
- `lib/cbt-home-catalog.ts`, `app/cbt/[certSlug]/page.tsx`, `app/cbt/[certSlug]/guide/page.tsx`, `lib/public-learning-guides.ts`: 요청 슬러그를 NFKC 정규화하고 공백을 정리한 뒤 조회. 정본과 다르면 308로 정본 URL로 보낸다. 존재하지 않는 종목은 그대로 404다(색인 대상 아님).
- `app/not-found.tsx`: 한국어 404 화면(문제은행·홈·학습 안내 링크), `noindex`, 제목 `페이지를 찾을 수 없습니다 | PASSMATE`. HTTP 상태 코드는 404를 유지한다.
- `scripts/test-cbt-public-content.mjs`: 쿼리 탭 링크 금지, 정규화 변형 308, 404 화면 문구·noindex를 검사하도록 갱신.

## 검증

- `npm run check`, `npx tsc --noEmit`, `next build` 통과.
- 로컬 프로덕션 빌드에서 sitemap 507개 URL 전부 200·canonical 일치, 공개 페이지의 `?tab=` 링크 0개, fragment 링크 노출 확인.
- NFD 슬러그 308 → 정본, `무대음향 3급` 308 → `무대음향-3급`, 존재하지 않는 슬러그 404 + 한국어 404 화면.

## 남은 확인

- Search Console 색인 생성 보고서의 404 영향 URL 목록은 미확인. 보고서를 열 수 있으면 1번(정규화 변형)으로 설명되는지, 아니면 외부 링크의 옛 주소인지 구분할 수 있다.
- 배포 후 Search Console에서 "수정 확인" 요청과 재수집이 필요하다. 이 저장소의 변경만으로 색인 상태가 즉시 바뀌지는 않는다.
- `/cbt/?cat=<카테고리>`는 클라이언트가 주소에 기록하는 값이라 서버 렌더링 링크로는 노출되지 않는다. 사용자가 공유한 주소만 중복이 될 수 있어 이번 변경 범위에서 제외했다.
