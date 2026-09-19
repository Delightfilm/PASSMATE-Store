# AGENTS.md

## PASSMATE fixed project rules

PASSMATE 작업을 시작할 때 아래 문서를 먼저 읽어 현재 결정과 실제 상태를 복원한다.

1. `docs/PRODUCT_STRUCTURE.md`
2. `docs/ROADMAP.md`
3. `docs/STATUS.md`
4. `docs/CONTENT_PIPELINE.md`
5. `docs/DESIGN_SYSTEM.md`

도메인 작업 시 해당 계약 문서(`PAYMENT_CONTRACT.md`, `PORTONE_KCP_INTEGRATION.md`, `NAS_JOB_CONTRACT.md`, `ADMIN_CONSOLE.md` 등)를 추가로 읽는다.

대화 기록이나 모델 기억보다 위 문서를 우선한다. 문서와 대화가 충돌하면 문서를 기준으로 진행하고, 결정이 바뀌면 문서를 먼저 갱신한다.

## Verification rule

- Work/Codex/채팅에서 완료했다고 보고된 작업도 GitHub `main`, live Supabase, Vercel 등 해당 Source of Truth에서 확인하기 전에는 완료로 기록하지 않는다.
- 외부 작업이 진행 중일 때는 현재 코드와 충돌하는 병렬 수정은 피한다.
- Vercel 무료 배포를 불필요하게 반복하지 않는다. 관련 변경은 가능한 한 한 커밋/한 검증 묶음으로 정리한다.

## Product rules

- 판매 상품은 **핵심요약 패키지**와 **합격팩** 2개만 운영한다.
- 핵심요약 패키지 가격 기준: **5,900원**
- 합격팩 가격 기준: **9,900원**
- 핵심요약 패키지 = CORE + SHEET + CHECK
- 합격팩 = PASS PACK + CORE + SHEET + CHECK
- 별도 `CRAM` / `벼락치기` PDF/상품은 만들지 않는다.
- 벼락치기 성격의 콘텐츠는 CORE 마지막의 `D-1 / 시험 직전 암기` 파트에 포함한다.
- 모든 판매 원고는 MASTER에서 파생한다.
- 기출 회차, 출제 빈도, 문항 수는 근거 없이 임의 생성하지 않는다.

## Content ownership

- 원본 기출 PDF, 대용량 디자인 원본, 최종 배포 PDF 등 바이너리/대용량 파일은 NAS를 Source of Truth로 관리한다.
- GitHub에는 Markdown 원고, 문서, 설정, 작은 구조화 데이터만 저장한다.
- 제3자 저작물은 표현/문장/표/구성을 그대로 복제하지 않는다. 참고가 필요한 경우 개념 범위 확인 및 사실 교차검증 용도로만 사용한다.

## Release rule

`SOURCE → MASTER → PRODUCT MANUSCRIPT → DESIGN → QA → RELEASE`

판매본은 QA 완료 전 RELEASE로 간주하지 않는다.

공개 판매는 `docs/ROADMAP.md`의 V8 Release Gate 전체 통과 후에만 활성화한다.
