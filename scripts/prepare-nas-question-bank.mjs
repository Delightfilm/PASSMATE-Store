import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const cli = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith("--")) continue;
  const next = process.argv[index + 1];
  cli.set(token.slice(2), next && !next.startsWith("--") ? (index += 1, next) : true);
}

const releaseId = String(cli.get("release") || new Date().toISOString().slice(0, 10));
if (!/^[0-9A-Za-z._-]+$/.test(releaseId)) throw new Error("release must contain only letters, numbers, dot, underscore, or dash");
const sourceRoot = path.resolve(String(cli.get("source") || process.env.PASSMATE_CBTBANK_ROOT || "C:/Users/Delight/Documents/PASSMATE_CBTBANK_ALL_EXAMS"));
const outputRoot = path.resolve(String(cli.get("output") || path.join(sourceRoot, "05_NAS_RELEASES", releaseId)));
const bundleRoot = path.resolve(String(cli.get("bundle-root") || path.join(sourceRoot, "03_PRODUCTS", "admin-import")));
const sourceImageRoot = path.join(sourceRoot, "01_RAW", "images");
const bundleOutput = path.join(outputRoot, "bundles");
const imageOutput = path.join(outputRoot, "images");
const limit = Math.max(0, Number(cli.get("limit") || 0));
const skipImages = cli.has("skip-images");

mkdirSync(bundleOutput, { recursive: true });
if (!skipImages) mkdirSync(imageOutput, { recursive: true });

const labels = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const safeText = (value) => value == null ? "" : String(value).trim();
const verifiedImages = new Set();

function answerIndex(question) {
  const explicit = Number(question.answer_no);
  if (Number.isInteger(explicit) && explicit >= 1) return explicit - 1;
  const candidate = Number(question.answer);
  if (!Number.isInteger(candidate)) return -1;
  return candidate >= 1 ? candidate - 1 : candidate;
}

function normalizeChoices(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") return { label: labels[index] || String(index + 1), text: item.trim() };
    const record = item && typeof item === "object" ? item : {};
    return { label: safeText(record.label) || labels[index] || String(index + 1), text: safeText(record.text ?? record.choice_text ?? record.value) };
  }); // Answer indexes refer to original positions, never filtered positions.
}

function materializeImage(asset, imageSet) {
  const hash = safeText(asset?.sha256).toLowerCase();
  const rawPath = safeText(asset?.raw_path);
  if (!/^[a-f0-9]{64}$/.test(hash) || !rawPath) return null;
  const source = path.resolve(sourceRoot, rawPath.replaceAll("\\", path.sep));
  if (!source.startsWith(sourceRoot + path.sep) || !existsSync(source)) return null;
  if (!verifiedImages.has(hash)) {
    if (sha256(readFileSync(source)) !== hash) throw new Error(`Image hash mismatch: ${rawPath}`);
    verifiedImages.add(hash);
  }
  const extension = path.extname(source).toLowerCase() || ".bin";
  const relative = `images/${hash.slice(0, 2)}/${hash}${extension}`;
  imageSet.add(relative);
  if (skipImages) return relative;
  const destination = path.join(outputRoot, ...relative.split("/"));
  if (existsSync(destination)) return relative;
  mkdirSync(path.dirname(destination), { recursive: true });
  try { linkSync(source, destination); }
  catch { copyFileSync(source, destination); }
  return relative;
}

const files = Array.from(new Set(
  (await import("node:fs")).readdirSync(bundleRoot)
    .filter((name) => name.endsWith("_problem_bank_bundle.json"))
    .sort()
)).slice(0, limit || undefined);

if (!files.length) throw new Error(`No admin bundles found in ${bundleRoot}`);

const qualifications = [];
const allImages = new Set();
const excludedRows = [];
let totalExams = 0;
let totalSourceQuestions = 0;
let totalQuestions = 0;
let totalExcludedQuestions = 0;
let totalCompressedBytes = 0;

for (let index = 0; index < files.length; index += 1) {
  const fileName = files[index];
  const source = JSON.parse(readFileSync(path.join(bundleRoot, fileName), "utf8"));
  const code = safeText(source.qualification?.code);
  const title = safeText(source.qualification?.title) || code;
  const sourceQuestionCount = Array.isArray(source.questions) ? source.questions.length : 0;
  if (!/^[0-9A-Za-z_-]+$/.test(code)) throw new Error(`Unsafe qualification code in ${fileName}`);

  const separateChoices = new Map();
  for (const item of source.choices || []) {
    const questionId = safeText(item.question_uid);
    if (!questionId) continue;
    const values = separateChoices.get(questionId) || [];
    values.push({
      position: Number(item.choice_no) || values.length + 1,
      label: labels[(Number(item.choice_no) || values.length + 1) - 1] || safeText(item.choice_no),
      text: safeText(item.choice_text),
      assets: Array.isArray(item.choice_assets) ? item.choice_assets : [],
    });
    separateChoices.set(questionId, values);
  }
  for (const values of separateChoices.values()) values.sort((left, right) => left.position - right.position);

  const examCounts = new Map();
  const questions = [];
  for (const [rowIndex, row] of (source.questions || []).entries()) {
    const id = safeText(row.question_uid);
    const examId = safeText(row.exam_id);
    const stem = safeText(row.stem ?? row.question);
    const positional = separateChoices.get(id);
    const values = positional?.length ? positional : normalizeChoices(row.choices).map((choice, index) => ({ ...choice, position: index + 1,
      assets: Array.isArray(row.choice_assets?.[index]) ? row.choice_assets[index] : [] }));
    const reasons = [];
    const usedImages = new Set();
    if (values.some((value, index) => value.position !== index + 1)) reasons.push("non_contiguous_choice_positions");
    const choices = values.map((value) => {
      const images = value.assets.map((asset) => materializeImage(asset, usedImages));
      if (images.some((image) => !image)) reasons.push("missing_choice_image_asset");
      return { label: value.label, text: value.text, ...(images.length ? { images: images.filter(Boolean) } : {}) };
    });
    const answer = answerIndex(row);
    if (!id) reasons.push("missing_question_uid");
    if (!examId) reasons.push("missing_exam_id");
    if (!stem) reasons.push("missing_stem");
    if (choices.length < 2) reasons.push("fewer_than_two_choices");
    if (choices.some((choice) => !choice.text && !choice.images?.length)) reasons.push("empty_choice_without_image");
    if (answer < 0 || answer >= choices.length) reasons.push("answer_out_of_range");
    const images = [];
    for (const asset of Array.isArray(row.visual_assets) ? row.visual_assets : []) {
      const relative = materializeImage(asset, usedImages);
      if (!relative) reasons.push("missing_stem_image_asset");
      else if (!images.includes(relative)) images.push(relative);
    }
    if (reasons.length) {
      excludedRows.push({ qualificationCode: code, row: rowIndex + 1, questionId: id, examId, questionNo: Number(row.question_no ?? row.no) || null, reasons: [...new Set(reasons)] });
      continue;
    }
    usedImages.forEach((image) => allImages.add(image));
    questions.push({
      id,
      examId,
      certId: code,
      no: Number(row.question_no ?? row.no),
      subjectId: safeText(row.subject_id),
      stem,
      images,
      choices,
      answer,
      explanation: safeText(row.explanation),
      sourceHash: safeText(row.sourceHash ?? row.source_hash ?? row.content_hash) || sha256(JSON.stringify({ stem, choices, answer })),
    });
    examCounts.set(examId, (examCounts.get(examId) || 0) + 1);
  }

  questions.sort((left, right) => left.examId.localeCompare(right.examId) || left.no - right.no);
  const exams = (source.exam_sessions || []).map((item) => {
    const id = safeText(item.exam_id);
    const questionCount = examCounts.get(id) || 0;
    return {
      id,
      certId: code,
      year: Number(item.year) || Number(safeText(item.exam_date).slice(0, 4)) || 0,
      round: Number.isFinite(Number(item.round)) ? `${Number(item.round)}회` : safeText(item.round) || "기출",
      title: safeText(item.title) || `${title} 기출문제`,
      durationMinutes: Math.max(20, Math.min(120, questionCount || 60)),
      passScore: 60,
      questionCount,
    };
  }).filter((item) => item.id && item.questionCount > 0);
  const subjects = (source.subjects || []).map((item) => ({
    id: safeText(item.subject_id),
    certId: code,
    name: safeText(item.name) || "미분류",
  })).filter((item) => item.id);

  const runtime = {
    schemaVersion: "passmate.question-bank.bundle.v1",
    releaseId,
    generatedAt: new Date().toISOString(),
    qualification: { code, title },
    exams,
    subjects,
    questions,
  };
  const compressed = gzipSync(Buffer.from(JSON.stringify(runtime)), { level: 9 });
  const bundleName = `${code}.json.gz`;
  const destination = path.join(bundleOutput, bundleName);
  const temporary = `${destination}.tmp`;
  writeFileSync(temporary, compressed);
  renameSync(temporary, destination);

  const imageCount = new Set(questions.flatMap((question) => [...question.images, ...question.choices.flatMap((choice) => choice.images || [])])).size;
  qualifications.push({
    code,
    title,
    bundle: `bundles/${bundleName}`,
    sha256: sha256(compressed),
    compressedBytes: compressed.length,
    sourceQuestions: sourceQuestionCount,
    questions: questions.length,
    excludedQuestions: sourceQuestionCount - questions.length,
    exams: exams.length,
    subjects: subjects.length,
    images: imageCount,
  });
  totalExams += exams.length;
  totalSourceQuestions += sourceQuestionCount;
  totalQuestions += questions.length;
  totalExcludedQuestions += sourceQuestionCount - questions.length;
  totalCompressedBytes += compressed.length;
  if ((index + 1) % 10 === 0 || index + 1 === files.length) {
    console.log(`packaged ${index + 1}/${files.length} qualifications, ${totalQuestions.toLocaleString()} questions`);
  }
}

qualifications.sort((left, right) => left.title.localeCompare(right.title, "ko"));
const excludedBytes = gzipSync(Buffer.from(excludedRows.map((row) => JSON.stringify(row)).join("\n") + "\n"), { level: 9 });
const excludedName = "excluded-questions.jsonl.gz";
writeFileSync(path.join(outputRoot, excludedName), excludedBytes);
const catalog = {
  schemaVersion: "passmate.question-bank.catalog.v1",
  releaseId,
  generatedAt: new Date().toISOString(),
  totals: {
    qualifications: qualifications.length,
    exams: totalExams,
    sourceQuestions: totalSourceQuestions,
    questions: totalQuestions,
    excludedQuestions: totalExcludedQuestions,
    images: allImages.size,
    compressedBytes: totalCompressedBytes,
  },
  excludedReport: {
    path: excludedName,
    sha256: sha256(excludedBytes),
    compressedBytes: excludedBytes.length,
    rows: excludedRows.length,
  },
  qualifications,
};

const catalogPath = path.join(outputRoot, "catalog.json");
writeFileSync(`${catalogPath}.tmp`, JSON.stringify(catalog));
renameSync(`${catalogPath}.tmp`, catalogPath);
writeFileSync(path.join(outputRoot, "health.json"), JSON.stringify({ status: "ok", releaseId, generatedAt: catalog.generatedAt }));

for (const entry of qualifications) {
  const bytes = readFileSync(path.join(outputRoot, ...entry.bundle.split("/")));
  if (sha256(bytes) !== entry.sha256) throw new Error(`Bundle hash mismatch: ${entry.code}`);
  const parsed = JSON.parse(gunzipSync(bytes));
  if (parsed.questions.length !== entry.questions) throw new Error(`Bundle count mismatch: ${entry.code}`);
}

console.log(JSON.stringify({ outputRoot, ...catalog.totals, outputBytes: statSync(catalogPath).size + totalCompressedBytes }, null, 2));
