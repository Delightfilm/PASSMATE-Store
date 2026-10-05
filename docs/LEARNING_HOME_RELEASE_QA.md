# PASSMATE 학습 홈 1단계 구현·검증 — 2026-10-05

사용자의 “수정도 하고 배포까지” 지시에 따라 C0의 확정 정보, C1~C3을 구현했다. 과거 모바일·문구·오류 수정은 `58b712f`로 보존한 뒤 최신 main에 `2c2ac2e`로 반영했다. 병행 작업의 AI 설명 개선 `37ecbc7`과 CBT 개선 `836b2cd`·`f684ff3`도 병합하여 보존했다. 해당 작업의 DB 마이그레이션을 추가 실행하지 않았다. 실제 운영 배포 결과는 배포 완료 후 별도 보고서에 기록한다.

## 구현 결과

| 구분 | 전 | 후 |
|---|---|---|
| `/` | 상품과 가격 중심 | 정적 학습 홈, 자격증 검색, 바로가기, 스토어 보조 링크 |
| `/store/` | 없음 | 기존 대표 상품·비교·학습 순서·가격·CTA 보존 |
| 홈 데이터 | 서버 상품·가격 조회 | Git에 포함한 JSON; 홈에서 NAS·가격 요청 없음 |
| 검색 | 홈에 없음 | 이름·코드·초성·컴활 별칭, 6개 결과, 방향키/Enter/Escape |
| 자격증 바로가기 | 없음 | 실제 문제 수 기준; 모바일 4개, PC 6개; 인기 통계로 표기하지 않음 |
| 서비스 전환 | 스토어 `/` | 스토어 `/store/`, 루트는 문제은행 선택 |
| 사업자 정보 | 없음 | 서버 HTML에 딜라이트 커머스 / 876-59-00934 표시, 빈 필드는 숨김 |
| 법적 문서 | 본문 미확정 | 임의 본문·404 링크 없음; C0 문서/목차/정책 메뉴는 본문 확정 후 진행 |

### Snapshot

- 실제 공개 catalog에서 명시적으로 `npm run catalog:snapshot -- --source-url https://content.mypassmate.com`을 실행했다.
- `releaseId`: `2026-10-04-image-choices`, 자격증 727개.
- `sourceSha256`: `70ef3b68bcfdb64e30725d12b3b4b1b32b8b8ae8255d506de61cb2c6a9c779b5`.
- JSON은 Git 추적. dev/check/tsc/build에 자동 생성 훅 없음. `next.config.ts`와 `.gitignore`는 변경하지 않았다.
- 생성 요청 timeout 5초 / 재시도 1회, 임시 파일 검증 후 교체, 실패하면 이전 파일 유지. 동일 SHA면 생성 시각과 파일을 다시 쓰지 않는다. 모의 요청 테스트로 검증했다.
- 빌드가 기존 상품 정적 경로/페이지 생성 때 Supabase를 조회하던 문제를 수정했다. `/products/`·`/store/`는 요청 시 SSR, 상품 상세는 기존 동적 렌더링을 유지하며 정적 경로 열거를 제거했다. 가격·SKU 검증 계약은 유지한다.

## 파일과 커밋

| 단위 | 커밋 | 주요 파일 | 되돌릴 영향 |
|---|---|---|---|
| C0 확정 사업자 정보 | `8868113`, `fd81826`, `9fc19d2` | `lib/business-info.ts`, `components/business-information.tsx`, `site-footer.tsx`, `app/legal.css`, `scripts/validate-legal.mjs` | 독립 단위; 사업자 표시/법적 검사만 제거 |
| C1 스토어 보존 | `09689cc` | `app/store/page.tsx`, `components/site-header.tsx` | `/store/` 제거; C3를 먼저 되돌려 링크 보존 |
| C2 Snapshot | `664e226` | `data/cbt-home-catalog.generated.json`, `lib/cbt-home-catalog*`, 생성/검증/테스트 스크립트, `package.json`, `app/layout.tsx` | C3를 먼저 되돌린 뒤 revert; 같은 releaseId 산출물은 Git 이력으로 복원 |
| 외부 조회 없는 빌드 | `3b6863f` | `app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/store/page.tsx` | 이전 정적 빌드 조회 복귀 가능; 단독 롤백은 권장하지 않음 |
| C3 학습 홈 | `5bd9a20` | `app/page.tsx`, `app/learning-home.css`, 검색/홈 컴포넌트, 서비스 전환, 폰트 guard, QA 도구 | `git revert 5bd9a20`; 기존 홈 복구, C0/C1/C2 유지 |
| C4 동의 기록 | 구현 안 함 | 계획 문서만 존재 | DB·결제 계약 변경 없음 |

`passmate-learning-home-rollback-qa` 별도 worktree에서 C3를 revert해 기존 홈 복구, `/store/` 존재, 사업자 푸터 유지, snapshot releaseId/SHA 동일을 확인했다. 소스 복원 검증이며 롤백한 전체 빌드·운영 배포까지 실행한 것은 아니다.

## 검증 결과

| 검사 | 결과 / 범위 |
|---|---|
| `npm run check` | 기존 가격·SKU·결제·인증·다운로드·시험 검사 포함 통과 |
| `npx tsc --noEmit` | 통과 |
| `npx next build` | 최신 병합 코드로 통과; 외부 socket 차단·기록 도구에서 외부 연결 0건 |
| Chromium | 9개 경로 × 360/390/430/768/1280 = 45건 |
| WebKit | 9개 경로 × 360/390/430 = 27건 |
| 가로 넘침 / JS 오류 | 전체 72건에서 0 |
| 44px / 14px | 새 학습 홈 컨트롤·사업자 링크, 홈/푸터 보조 텍스트 위반 0; 모든 기존 페이지 컨트롤의 재인증을 의미하지 않음 |
| 대비 | 홈/푸터 측정 최저 4.878:1 |
| 모바일 첫 화면 | 높이 700px에서 3개 폭 모두 스토어 CTA 노출 |
| 홈 CLS (Chromium) | 360: .003034 / 390: .000311 / 430: .000282 / 768: .000755 / 1280: .002817 |
| WebKit CLS | layout-shift 관측 미지원; 수치 0을 측정 결과로 주장하지 않음 |
| 폰트 실패 / 검색 | 양 엔진 360/390/430/1280: 화면 노출, 이름·초성·별칭, 키보드 이동, 빈 결과 통과 |
| 홈 초기 HTML | 사업자 정보와 `/store/` 링크 포함, NAS·가격 대기 없음 |
| 개발 서버 | 홈 200, NAS·가격 요청 0; Next 15.5.24 자체 npm 버전 확인 1건은 차단됨. literal 전체 외부 요청 0 기준은 미달 |
| `LEGAL_STRICT=1` | 의도대로 실패: 4개 문서와 6개 미확정 사업자 필드. 기본 모드는 경고 후 통과 |
| 운영 데이터 변경 | 본 QA는 읽기/모의 실패만 수행; 운영 DB 쓰기·실결제·다운로드 발급 없음 |

검증 경로: `/`, `/store/`, `/products/`, `/products/computer-literacy-2/`, `/cbt/`, `/library/`, `/cart/`, `/checkout/`, `/account/login/`. 로컬 브라우저 외부 요청은 의도적으로 차단했으므로 NAS·가격 실패 상태의 회복력 검증이며 실서비스 연결 성공 증거와 구분한다.

## 전후 캡처

원본 PNG·측정 JSON은 `../reports/learning-home-release-20261005`에 보관한다. `before-*`는 전환 전 로컬 기준, `production-before-*`는 실제 운영 기준, `after-*`는 최종 구현 기준이다.

| 폭 | 전 홈 | 후 홈 | 후 스토어 |
|---|---|---|---|
| 360 | `before-chromium-home-360.png` | `after-chromium-home-360.png` | `after-chromium-store-360.png` |
| 390 | `before-chromium-home-390.png` | `after-chromium-home-390.png` | `after-chromium-store-390.png` |
| 430 | `before-chromium-home-430.png` | `after-chromium-home-430.png` | `after-chromium-store-430.png` |

다른 경로와 WebKit도 같은 파일명 규칙으로 전체 캡처를 남겼다. 실제 배포 후 캡처는 `production-after-*`로 별도 보관한다.

## 남은 사항

- 4개 정책 Markdown, 대표자명·주소·이메일·전화·통신판매업 신고번호·운영시간이 확정되지 않았다. 정책 페이지, 개인정보 목차, 정책 메뉴, 문의 링크는 아직 만들지 않았다. 따라서 법적 준비 완료를 주장하지 않는다.
- 기존 게스트 자료/장바구니 페이지의 768px에서 인증 확인 중 CLS 약 .137이 남았다. 새 학습 홈은 .004 미만이며, 인증 계약을 이번에 변경하지 않았다.
- Next 개발 서버 자체 버전 확인을 없애려면 별도 개발 도구 정책이 필요하다. 홈 데이터 생성은 개발 서버와 완전히 분리했다.
- 실기기 iOS 주소창/safe-area 검증은 별도 필요. WebKit 자동화와 실제 iPhone 검증은 같지 않다.
- C4 동의 시각·정책 버전 저장은 DB 변경 승인 이후 별도 작업이다. 미확정 약관을 결제 동의에 연결하지 않았다.
- 배포 장애 시 배포 직전 Ready URL `https://passmate-store-iqt6qu085-cueits-projects.vercel.app`로 플랫폼 롤백하거나 C3 커밋 revert로 홈만 복구한다. 정책 본문 확정 이후의 판매 심사 적합성은 이 UI 배포로 판단하지 않는다.
