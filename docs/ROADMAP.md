# PASSMATE Final Roadmap

> 목표: 자격증 요약 PDF를 자사몰에서 판매하고, 결제부터 구매자료 제공까지 안정적으로 운영할 수 있는 기반을 만든다.
>
> 운영 원칙: 고객 화면에는 학습 효용과 상품 정보만 노출한다. 내부 발행·운영 구조는 고객 UI의 마케팅 메시지로 사용하지 않는다.

## Version Roadmap

| Version | Goal | Scope | Exit Gate |
|---|---|---|---|
| V0 ✅ | 브랜드·자사몰 기반 | PASSMATE 브랜드, Concept B 로고 방향, GitHub, Vercel, 반응형 Storefront | Production 배포 성공 |
| V1 🚧 | 회원·상품·주문 DB 기반 | Supabase, Auth 연동 기반, profiles/products/product_versions/orders/order_items/entitlements, RLS | 스키마 적용 + 테스트 데이터 CRUD 검증 |
| V2 | 고객 계정 | 회원가입/로그인/로그아웃, 비밀번호 재설정, 내 자료 UI | 로그인 사용자별 화면 정상 |
| V3 | 결제 | 국내 PG 선정, 주문/결제 성공·취소·실패 처리, 중복 처리 방지 | 테스트 결제 → paid 주문 기록 |
| V4 | NAS 발행 엔진 | NAS Docker Worker, MASTER 관리, 발행 Queue, PDF 생성 | 테스트 주문 → NAS 발행 성공 |
| V5 | 자동 다운로드 | 발행 완료 → 임시 다운로드 저장 → 만료 링크 → 내 자료 | 구매 후 자동 다운로드 성공 |
| V6 | 내부 발행 관리 | 발행 식별정보, 무결성 정보, 운영 로그를 백오피스에서 관리 | 고객 UI 비노출 + 내부 추적 가능 |
| V7 | 관리자 | 상품/주문/발행/재시도/버전 관리 Admin | SSH 없이 주요 운영 가능 |
| V8 | 1호 상품 출시 | 컴활 2급 CORE / CRAM / SHEET / CHECK | 결제~다운로드 E2E 통과 후 판매 오픈 |
| V9 | 판매 최적화 | 상세페이지, 미리보기, 후기, 쿠폰, SEO | 판매 데이터 기반 개선 가능 |
| V10 | 외부 채널 | 크몽 등 외부몰 주문 관리 | 자사몰/외부몰 주문 통합 관리 |
| V11 | 시리즈 확장 | 컴활1급, 산업안전기사, 정보처리기사 등 | 상품 추가만으로 확장 가능 |
| V12 | 유출 대응 | 공개 웹 모니터링 및 내부 발행기록 대조 | 의심 자료 발견 시 내부 조사 가능 |

## Product Format

PASSMATE 상품은 기본적으로 아래 4종 패키지를 사용한다.

- **CORE** — 핵심요약 20~30P
- **CRAM** — 시험직전 벼락치기 약 10P
- **SHEET** — 함수·공식·암기 치트시트
- **CHECK** — 시험직전 실수방지 체크리스트

## Release Gate

실판매 버튼은 아래가 모두 통과한 뒤 활성화한다.

1. 콘텐츠 검수 완료
2. PDF 디자인 완료
3. 테스트 결제 성공
4. 자동 발행 성공
5. 다운로드 성공
6. 주문/발행 로그 정상

## Collaboration

- **Owner**: 상품 방향, 가격, 최종 승인
- **ChatGPT**: 인프라, 데이터 구조, 자동화, 콘텐츠 구조화·검수, QA
- **Claude**: PDF 편집디자인·레이아웃

## Progress Logging Rule

모든 개발 세션에서 아래 문서를 갱신한다.

- `docs/STATUS.md` — 현재 버전/진척도/다음 우선순위
- `docs/SESSION_LOG.md` — 한 일 / 막힌 것 / 다음 할 일

Roadmap 변경이 생기면 이 문서도 함께 업데이트한다.
