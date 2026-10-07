# Manual question editor implementation

Approved scope: retain reports, no automatic inspection; directly edit published questions, stem/choice text and images, variable choices, accepted-answer checkboxes, reason and audit history. User explicitly requested immediate implementation and production release on 2026-10-07.

Architecture: immutable NAS source plus versioned sparse corrections. Source identity and membership are verified server-side. Replacement/cropped images are immutable NAS assets; unlink never erases originals. Only designated administrators may write. Old correction payloads remain compatible. Learner history is not rescored; AI cache fingerprints reflect revised content. No new written corpus import.

- [ ] Contract tests RED then GREEN: variable choices, accepted answers, explicit image unlink, legacy fallback, URL bounds.
- [ ] Add service-only transactional manual save and image registry. Preserve report resolve atomicity and optimistic locking.
- [ ] General question picker by qualification/session/text and editor with checkboxes, add/remove choices, crop/upload/unlink.
- [ ] Dedicated NAS asset service, no exposed management port; Vercel verifies administrator and image decoding before upload.
- [ ] Full checks/type/build, SQL rollback-only concurrency/auth/audit tests, browser workflows and responsive checks.
- [ ] Deploy backend then staged site, verify live, promote; preserve prior deployment/service configs and all data for rollback.

Rollback: restore prior Vercel/Edge and NAS routing; keep additive assets/corrections/logs. Never revert/delete source banks, attempts, scores, cache or reports. Public correction schema version 2 requires new runtime; delay new UI activation until all readers deploy. Existing legal-document warnings are baseline, unrelated to this editor.
