# PASSMATE 검색 등록 및 메타 정보

확인일: 2026-10-12 (Asia/Seoul).

## 대표 주소와 문구

- 대표 주소: `https://www.mypassmate.com/`. `https://mypassmate.com/`은 운영에서 www 주소로 이동한다.
- 홈 제목: **패스메이트 PASSMATE | 자격증 기출문제·CBT 문제은행**
- 홈 설명: **패스메이트에서 자격증·공무원 시험 기출문제를 풀어보세요. 회차별 문제풀이와 모의고사, AI 해설, 오답노트로 학습하고 복습할 수 있습니다.**
- 홈·종목 목록·유효한 종목 상세에 각각 고유 title/description/canonical/OG/Twitter 정보를 제공한다.
- 실제 서비스에 맞춰 판매 준비 중인 스토어 홍보 문구와 특정 2027 상품 설명을 제거했다.

## 사이트맵 및 검색 수집

- 사이트맵: `https://www.mypassmate.com/sitemap.xml`
- 로봇 설정: `https://www.mypassmate.com/robots.txt`
- 로컬 catalog와 실제 화면의 종목 그룹을 재사용한다. 기출 회차와 문항이 모두 있는 500종목, 홈, 종목 목록을 합쳐 502개의 고유 URL을 생성한다.
- 로그인/계정/관리자/내 자료/장바구니/결제/개인 풀이 기록/북마크/오답노트/풀이 세션은 noindex로 설정한다.
- 준비 중인 스토어와 상품 페이지는 noindex다. 판매 활성화 플래그의 기존 동작은 보존한다.
- robots.txt는 공개 페이지 수집을 허용하고 `/api/`, `/admin/`을 제외하며 사이트맵을 명시한다. 사용자 페이지는 수집을 허용하여 검색엔진이 noindex를 확인할 수 있게 한다.
- 변경일을 매 요청 시각으로 임의 생성하지 않는다. 확인할 수 없는 lastmod는 생략한다.
- 변경 전 운영 robots.txt/sitemap.xml은 모두 404였다.

## 검색 관리 도구

- Google Search Console: `https://www.mypassmate.com/` URL 접두어 속성의 인증 메타태그를 추가했다. 운영 배포 후 소유권 확인과 사이트맵 제출을 수행한다.
- 네이버 서치어드바이저: 첫 이용약관 동의 화면을 확인했다. 법적 약관에 대한 사용자 확인을 요청했으며, 응답 전에는 동의·사이트 등록을 진행하지 않는다.
- 사이트맵 제출 및 소유권 확인과 검색 색인/노출 완료는 다른 상태다. 검색엔진 처리 결과에 따라 노출 제목·설명이 달라질 수 있다.

## 로컬 검증

- `npm run build`: 기존 전체 계약 검사, 타입 검사, Next.js 빌드 통과.
- 빌드된 XML: 502개 URL, 중복 0, 모두 HTTPS www 대표 주소, 비공개/준비 중 페이지 0.
- 빌드된 robots.txt: 공개 허용, API/관리자 제외, 사이트맵 주소 일치.
- 로컬 실제 HTTP: 502/502 정상 200, 제목 502개 고유, URL별 canonical 일치, 공개 URL noindex 0. 네이버 Yeti 요청의 종목 제목도 HTML head에서 확인했다.
- 로그인·내 자료·개인 학습 기록·풀이 세션·준비 중인 스토어/상품 9개 표본은 모두 noindex다.
- 기존 약관 원문 4종과 사업자 전화/운영시간 미확인 경고 6개는 이번 SEO 작업과 별개로 남아 있다.
- 배포 및 검색 관리 도구의 최종 결과는 아래 운영 결과에 추가한다.

## 운영 결과

진행 중: 운영 배포·HTTP 검증·검색 관리 도구 제출 결과를 확인 후 기록한다.

## 참고

- [네이버 SEO 기본 가이드](https://searchadvisor.naver.com/guide/seo-help)
- [네이버 콘텐츠 작성 권장 사항](https://searchadvisor.naver.com/guide/content-basic)
- [Google 사이트맵 작성 및 제출](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google 검색 설명문](https://developers.google.com/search/docs/appearance/snippet)

## 복구

기준 운영 배포: `dpl_F8PJbQxinDZWpQV74kmgNDfMAoak`, Git 기준 `cd27b1373f2482a42bc2398a4556ef90d86ef117`.
문제 발생 시 이번 SEO 커밋만 revert한 뒤 재배포한다. 기존 학습 데이터, 원본 문제은행, NAS, 인증/결제 계약은 수정하지 않았다.
