# PASSMATE Final PDF Processor Contract

## Purpose

이 문서는 NAS Worker가 MASTER PDF를 실제 고객 발행본으로 만들 때 지켜야 할 경계를 정의한다.

현재 구현은 **파이프라인/검증/저장 경계만 고정**하고, 최종 PDF 변환 로직은 `PdfTransformer` 인터페이스로 분리한다.

## MASTER layout

```text
/PASSMATE/01_MASTER/
└── PM-C2/
    └── 2027-v1.0/
        ├── master.pdf
        └── manifest.json
```

`manifest.json`은 다음을 고정한다.

- product_code
- product_version
- edition_year
- master_file
- master_sha256

Worker는 실제 파일의 SHA-256과 manifest를 비교한 뒤에만 처리한다.

## Processing pipeline

```text
claim job
→ MASTER manifest 검증
→ MASTER hash 검증
→ temporary workdir
→ PdfTransformer.transform()
→ output 존재/크기 검증
→ MASTER와 byte-identical 여부 검증
→ ArtifactStore.put()
→ storage key/hash/size 반환
→ complete_issuance_job()
```

## Safety rules

- MASTER mount는 read-only
- MASTER hash mismatch 시 즉시 중단
- 실판매 모드에서 MASTER byte-for-byte 복사본은 발행 금지
- 작업 파일은 임시 디렉터리에서 생성
- storage key는 절대경로 및 `..` 금지
- storage path에 고객 이메일/이름/전화번호 등 PII 금지
- DB에는 permanent public URL이 아니라 storage key만 저장
- stale lease completion이 거절되면 저장된 artifact도 삭제 가능해야 함

## Transformer boundary

`PdfTransformer`는 향후 다음 내부 처리만 담당한다.

- 고객별 내부 식별정보 삽입
- 필요한 PDF 메타데이터 처리
- 페이지-level 발행 패턴
- 최종 PDF 최적화

이 내용은 고객용 웹사이트 마케팅 문구로 노출하지 않는다.

## Storage boundary

현재 `LocalArtifactStore`는 NAS/local integration test용이다.

향후 production storage adapter는 같은 인터페이스로 다음을 구현한다.

- private object storage upload
- overwrite protection
- delete/revoke
- short-lived signed download URL은 웹/API 계층에서 생성

NAS Worker는 고객에게 직접 URL을 제공하지 않는다.

## Source of truth

- `config/pdf-processor-contract.json`
- `worker/passmate_worker/manifest.py`
- `worker/passmate_worker/final_processor.py`
- `worker/passmate_worker/storage.py`
- `worker/tests/test_final_processor.py`


## Production private Storage adapter

V5 선행작업에서 \`SupabaseArtifactStore\`가 추가되었다.

- bucket: \`passmate-artifacts\` (private)
- NAS Worker의 service-role credential만 사용
- object key는 기존 PII-free \`issued/...pdf\` 규칙 유지
- public URL을 생성하거나 DB에 저장하지 않음
- 고객 다운로드 URL 생성은 Worker가 아니라 \`download-url\` Edge Function 책임
