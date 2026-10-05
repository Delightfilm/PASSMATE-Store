# Qualification display grouping — 2026-10-05

Approved: group period/subject cards inside one qualification, including technical
qualifications and civil-service collections. This is presentation only; NAS
catalog/bundles, SQLite, question/exam/subject/qualification IDs, answers,
corrections, reports, scores, learning records and AI cache remain unchanged.

- Keep 기사/산업기사/기능사, stages and grades separate. Strip `(구)` from card
  names but show `개편 전 기출` on source-specific exam/subject selections.
- Group the reviewed period-based professional exams and old/current variants.
  Do not fabricate periods for integrated management-consultant exams.
- Group civil-service subjects by their explicit grade, recruiting authority and
  hiring type. Seoul, veteran, cadastral and source-specific grade qualifiers
  remain separate. Unknown job series are not inferred. These are subject
  collections, not a complete official examination.
- Keep security-supervisor common/general/mechanical second-stage collections
  separate. Labor-consultant and civil-service mock practice uses an explicitly
  selected source, never an automatic mixture of alternative subjects.
- Exact same-title old/current technical qualifications share a card; this is
  not a claim that every old subject remains on the current syllabus. Former
  radio electronics/communications technician titles map to the verified
  successor title with their source identity retained in selection labels.
- Date and original round remain selectable. Some historical exams occurred
  twice in a year. Card session counts sum source papers; they are not a count
  of unique annual sittings.
- Raw certification rows remain in Dataset. Groups retain all member IDs.
  Old source-ID/name/slug links resolve to the containing group. New attempts
  store `sourceCertIds` for exact hydration; old attempts infer sources only
  from existing date-based exam IDs, with no migration/regrading.
- Home/quick-search use the same grouping. Catalog generation still validates
  and stores the unmodified NAS snapshot. Group detail loads member bundles
  sequentially with existing abort/retry/cache/correction behavior.

Validation: grouping unit tests and mocked NAS hydration tests; full-catalog
count/ID/grade partition checks; existing question-bank suites, TypeScript,
production build and desktop/mobile browser checks. Local checks are not live
deployment proof. Production status is recorded only after live verification.

## Verified locally

- Full snapshot: 727 source qualifications -> 489 display cards. Every source
  belongs to exactly one group; question and source-paper totals are unchanged.
- `npm run build` passed all checks and the Next production build. Six existing
  legal-information warnings remain unrelated to this change.
- Real NAS-backed browser: appraiser 2025 1st/2nd periods under one title;
  consultant 2025 remains one integrated paper; old chemical-engineer URL
  resolves to the grouped current title with historical guidance.
- National 9th-grade collection shows 49 independently selected source subjects
  in mock practice, without an automatic all-subject option.
- A legacy-format local guest attempt (no `sourceCertIds`) reopens the exact two
  original questions. No answers were submitted, AI generated or account data
  modified during browser verification.
- Desktop screenshot inspected; 360/390/430px appraiser views have no horizontal
  overflow. These are Chromium checks, not an all-device compatibility claim.
