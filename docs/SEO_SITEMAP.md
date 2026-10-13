# 사이트맵 수집 진단 — 2026-10-13

Google Search Console 실시간 URL 검사에서 `/sitemap.xml`은 HTTP 200과 실제 XML로 확인됐지만, 제출된 사이트맵 보고서는 `가져올 수 없음`, 발견된 페이지 0을 표시한다. 실시간 검사와 사이트맵 처리 결과는 별도이며, XML 접근 성공만으로 보고서 해결을 선언하지 않는다.

## 확인한 범위

- XML은 표준 `http://www.sitemaps.org/schemas/sitemap/0.9` namespace를 사용하고 503개의 고유 공개 canonical URL을 포함한다.
- Next.js 15.5.24이며 해당 namespace 회귀는 적용되지 않는다. middleware에서 사이트맵을 가로채는 코드가 없다.
- `/sitemap.xml`은 직접 200을 응답한다. `trailingSlash: true`의 파일 예외 때문에 `/sitemap.xml/`은 오히려 `/sitemap.xml`로 리디렉션되는 구조다.
- robots.txt는 사이트맵을 차단하지 않는다. Search Console 직접 조치는 감지되지 않았다.
- 일반 자동화 HTTP 클라이언트는 Vercel Bot Protection challenge를 받을 수 있다. 이 결과만으로 Googlebot 차단을 단정하지 않는다.
- 방화벽의 `botName: googlebot` 통계는 allow를 표시하지만 HTTP 응답 코드나 검증 여부까지 증명하지 않는다. 상세 HTTP 상태와 `bot_verified` 관측 쿼리는 Observability Plus 필요 응답으로 현재 요금제에서 조회하지 못했다.

## 대체 수집 경로

Google이 지원하는 UTF-8 텍스트 사이트맵 `/sitemap.txt`를 추가했다. `app/sitemap.ts`의 동일 URL 목록을 재사용하고 빌드 시 정적으로 생성하므로 XML과 목록이 자동으로 일치한다. 기존 `/sitemap.xml`과 robots.txt의 XML 안내는 유지한다.

이는 정상 처리되는 대체 경로를 확보하기 위한 조치이며, 과거 실패 원인이 XML 파서라고 확정한 수정은 아니다. Google에 제출한 뒤 각 형식의 상태를 비교한다. 양쪽 모두 실패하면 일반 클라이언트의 429만으로 보안을 완화하지 않고 Google 처리·수집 수요 또는 개별 크롤러 접근 문제를 계속 구분한다.

## 검증 및 되돌리기

- 전체 `npm run build` 통과.
- 빌드 후 로컬 production 서버에서 `node scripts/test-sitemap-http.mjs` 통과: XML과 텍스트 모두 직접 200, 올바른 Content-Type, 503개 동일 URL, 중복 없음, 우선 종목 11개 포함, 비공개 경로 제외.
- 배포 확인과 Search Console 처리 성공은 이 문서 작성 시 아직 확인 전이다. 실제 결과는 작업 보고서에 기록한다.
- 되돌리기: 추가한 `app/sitemap.txt/route.ts`를 제거하고 재배포한다. 기존 XML에는 영향이 없다. Google 제출 기록 제거는 별도 작업이며 페이지나 색인을 삭제하지 않는다.

공식 문서: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
