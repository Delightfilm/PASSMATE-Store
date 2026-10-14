# 자체 기본 방문 집계

2026-10-14. 사용자 승인 설계/계획에 따른 구현. 운영 활성화와 실수집 결과는 아래 검증 기록에 별도로 남긴다.

## 측정과 선택

공개 메인·문제은행·종목·일반 문제풀이만 측정한다. 관리자·계정·학습 이력·설정·결제는 제외한다. 식별자 없는 메모리 수집기는 조회수, 방문 시작 수, 고정 유입 분류, 보이고 포커스가 있는 화면의 활성 밀리초만 보낸다. 순방문자, 기기/위치, 검색어, 개인별 이동 경로는 이 출처에서 제공하지 않는다. 평균은 총 활성 밀리초/총 조회수다.

새 방문자는 자체 집계만 기본 사용한다. 기존 GA4 granted는 그대로 유지하며 denied는 두 측정기를 중지한다. 새 설정은 모두 중지 / 기본 집계만 사용 / 상세 분석도 허용이다. GPC, 손상된 선택, 저장 실패에서는 두 측정기를 중지한다. 선택만 localStorage에 저장하고 기본 방문자 ID·쿠키·영구 전송 큐는 만들지 않는다. 독립 `/analytics-settings/`는 noindex이며 자동 팝업/배너는 없다.

## 요청·저장 경계

브라우저→같은 출처 Next API→전용 토큰 Edge→원자적 RPC. credentials omit, no-referrer, keepalive, 5초 제한을 적용한다. Next는 Content-Type/apikey/x-passmate-aggregate-token만 전달하고 원 요청 Cookie/Authorization/IP/UA/Referer를 복사하지 않는다. 앱은 원시 요청이나 패킷을 로깅하지 않는다. HTTP 인프라의 요청 처리는 분석 DB 저장과 구분한다. 법적 익명성 인증을 주장하지 않는다.

8KiB, 조회20, 시간60초, 페이지20, 정수·한도·주변 합 일치·추가 필드 거부. 5초 관측, 관측 공백10초 초과는 버림, 20초 전송, 30분 활동 단절은 새 방문 시작. 재시도 패킷은 불변이고 독립 nonce는 같은 패킷 재시도에만 재사용한다. 버퍼5분/동시전송1, 서버 인스턴스 동시처리2. 실패·종료·봇 때문에 누락/오염이 가능하다.

`traffic_aggregate_daily`는 한국 수신일별 total/source/page의 주변 합계다. 사람·페이지×출처 조합 기록은 없다. receipts는 nonce SHA-256와 만료만 저장한다. TTL30분, 수집/조회/일일 작업에서 만료 삭제. 최근 오늘 포함90일을 보관한다. 유지관리 상태는 새 state 표에만 저장한다. `pg_cron` 작업 `passmate-traffic-aggregate-retention`은 UTC `0 20 * * *`이며 새 cleanup RPC만 실행한다. 기존 표·작업을 변경하지 않는다.

RLS와 명시적 권한 철회로 anon/authenticated는 세 표와 세 RPC에 직접 접근할 수 없다. service_role 전용 RPC는 security invoker다. 관리자 함수는 검증된 JWT와 profiles.role=admin을 확인한 후 조회한다. user_metadata를 권한으로 사용하지 않는다.

## 관리자·CSV

방문 분석은 자체 기본 집계, GA4 동의자 분석은 기존 별도 보고서다. 인기 시험은 기존 회원 응시 집계다. 출처를 합산하거나 과거 GA4 값을 자체 집계로 복사하지 않는다. 7/30/90일과 직접 기간, 독립 날짜/유입/페이지 보고서, 요약·추이·CSV를 제공한다. 조회5회 미만 항목은 소량 항목으로 합친다. 이것은 5명이라는 보증이 아니다. 표 상위100행과 전체 합계를 분리한다. 시작 전·연결 전·오류는 0으로 꾸미지 않는다. 오늘/조회 시각/시작 시각/정리 상태/범위를 CSV에도 기록한다.

## 운영 설정과 롤백

- Vercel production 전용 `NEXT_PUBLIC_FIRST_PARTY_ANALYTICS_ENABLED`: 기본 false, 검증 후 true.
- Next/Edge `PASSMATE_FIRST_PARTY_INGEST_ENABLED`: 기본 false.
- Next/Edge `PASSMATE_AGGREGATE_INGEST_TOKEN`: 동일한 보호된 서버 토큰. 공개 변수·코드·로그에 넣지 않는다.
- Edge `PASSMATE_FIRST_PARTY_REPORTS_ENABLED`: 기본 false.
- DB state enabled/started_at: 실제 활성화 시 기록. 안전한 서버·정리 작업 준비 전에는 false.
- 기존 GA4 설정·키·보관·회원/학습/주문 데이터는 유지한다.

롤백: 자체 ingest/report/public 플래그 OFF → 검증된 이전 웹 배포 복원. 기준 이전 운영: `dpl_9CiWSBvtBwjxSV2wRHPkfvHT9Rfp`, `b8c032895f66bde0363218d489be0cba1239b860`. GA4/응시/주문/새 집계표 삭제는 롤백에 포함하지 않는다.

## 검증 기록

- 전체 `npm run build` exit0, 최종 분석81/81, 기존 browser-storage·공개 콘텐츠·회원·보안 검증 통과. 기존 법률/사업자 문서6개 미완료 경고는 그대로다.
- API 비노출 QA 스키마: rollback SQL의 중복·권한·한국 자정·90일·만료 정리 PASS. 독립 SQL 세션 두 번의 같은 digest는 총 조회1/시작1/1000ms. QA는 비활성으로 복귀하고 시험 행만 제거했다.
- 로컬 기본 수집만 활성화, 서버 수집 비활성: 기본 요청의 실제 wire headers에 Cookie/Authorization/Referer 없음, referrerPolicy no-referrer, 허용 패킷만 관측. 신규 GA4 요청0. 이 시험은 DB 저장 성공 증거가 아니다.
- 초기 자동 배너/팝업 없음, 설정 버튼3개·noindex·데스크톱 가로 넘침 없음. 로컬 캡처 `output/first-party-traffic-analytics/local-settings.png`.
- 운영 연결·실수집·관리자·실제 CSV 대조 완료. PR50/51, 검증된 웹 코드 `b2d8b01055a67372a0d32a50a825b67e0de7f704`, READY `dpl_JA171Cr7TzwyPfmaaPThwV9nTBwn`, www/mypassmate.com 별칭 확인. 상세 실제 결과·한계는 [운영 검증·롤백 기록](FIRST_PARTY_ANALYTICS_VERIFICATION_20261014.md)을 따른다.
