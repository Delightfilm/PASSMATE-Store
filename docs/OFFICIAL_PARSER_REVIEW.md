# Official exam presentation review — 2026-10-05

## Confirmed defect

The stage importer attached a full source question crop as if it were a separate
diagram. Learning screens repeated both the stem and all options. Some driving
questions used the same full-crop representation. Bar questions have no such
images.

## Correction contract

- Audit all 18,054 admitted official questions against retained source documents.
- Verify original document and image hashes, MASTER/provenance text and answers,
  HWP nested text accounting, and native PDF text coverage.
- Select text display only when native characters are all accounted for and the
  source has no graphics, tables, equation typography or unmapped glyphs.
- Otherwise display the complete original problem and options once, with numbered
  answer controls. Scanned/OCR questions retain their original visual content.
- Keep original source assets and extracted text in MASTER for evidence/search.
  Text display exports do not include the redundant full source crop.
- Preserve question IDs, answer positions, provisional/candidate labels, final
  multiple answers and personal study record references.
- The automated review is a presentation/content-accounting audit; it does not
  claim that every legal or technical statement has been manually re-solved.

## Verified local result

- 18,054 questions: 17,235 stage arts, 669 driving, 150 bar selective.
- 12,358 text presentations; 5,696 full original presentations. The final scan
  also checks individual vector lines, excluding native word underlines and the
  driving bank's outer layout rules.
- 253 original question documents and 10,394 source crops verified by SHA-256.
- All 669 driving stems/options/inline keys rechecked using a separate PDF text
  extraction path. All 150 bar source bodies and final keys rechecked from HWP.
  All 17,235 stage accepted positions match the archived official key table.
- Driving question 965: excluded the previous question's explanation, while
  retaining the complete current road sign. Fixed the whitespace-consuming anchor.
- Stage audio grade 1, round 10, major question 19: restored the numerator of the
  first-line 1/3 octave expression. Preserve above-baseline equation glyphs in the
  parser's future crops. The other six graphic-boundary suspects were visually
  reviewed and contain the complete relevant graphic (image padding caused flags).
- Full 18,054-question rendered regression passed: stable IDs, source hashes,
  choices, all accepted/inferred answers and labels; legacy diagrams retained.
- Local MASTER question/choice/answer metadata tables match the pre-repair backup.
  Separate presentation metadata applied to MASTER and stage staging DB, with
  backups. Original source images and before/after repair history retained.
- Final production build and all existing application contract checks passed.
  Correction-overlay compatibility and all 18,054 real rendered questions passed.

## Delivery status

Prepared additive NAS release `release-2026-10-05-official-presentation-v2`.
Existing 727 qualifications and immutable old image URLs remain preserved.
Code/data production deployment and live UI verification are pending the browser
connection used for the authenticated NAS management session.

When an administrator changes a source-image question's text, show the corrected
text and offer its preserved original image in a closed reference disclosure;
answer-only corrections keep the source presentation. This prevents hiding newer
corrections behind the original image.
