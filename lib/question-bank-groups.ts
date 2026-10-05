import type { Cert, Exam } from "./question-bank";

export type QualificationGroup = Cert & {
  memberIds: string[];
  sourceNames: string[];
  subjectCollection: boolean;
};

export function isHistoricalTitle(title: string) { return /\(구\)/.test(title); }
export function cleanQualificationTitle(title: string) {
  return title.normalize("NFKC").replace(/\(구\)/g, "").replace(/\s+/g, " ").trim();
}

// Presentation only: none of these identities replace source qualification IDs.
export function qualificationIdentity(title: string) {
  const clean = cleanQualificationTitle(title);
  if (/^전파(?:전자|통신)기능사$/.test(clean)) return { name: "전파전자통신기능사", variant: clean, subjectCollection: false };
  const period = clean.match(/^(감정평가사 1차|경영지도사 1차|관광통역안내사|물류관리사|변리사 1차|사회복지사 1급|청소년상담사 [123]급)(?:\s*\(?([123])교시\)?)?$/);
  if (period) return { name: period[1], variant: period[2] ? `${period[2]}교시` : "", subjectCollection: false };
  const labor = clean.match(/^(공인노무사 1차)\((.+)\)$/);
  if (labor) return { name: labor[1], variant: labor[2], subjectCollection: true };
  const security = clean.match(/^(경비지도사 [12]차)\((.+)\)$/);
  if (security) {
    const track = security[1].endsWith("1차") ? "" : /기계경비/.test(security[2]) ? "(기계경비)" : security[2] === "경비업법" ? "(공통)" : "(일반경비)";
    return { name: security[1] + track, variant: security[2], subjectCollection: true };
  }
  const civil = clean.match(/^(\d급 (?:국가직|지방직) 공무원(?: 서울시)?|경찰공무원\([^)]*\)|소방공무원\([^)]*\)|계리직\s*공무원)\s+(.+)$/);
  if (civil) {
    // Do not infer a job series. Source-specific recruiting/grade qualifiers stay separate.
    const qualifier = civil[2].match(/\(([^)]+)\)$/)?.[1];
    const name = civil[1].replace(/^계리직\s*공무원$/, "계리직 공무원") + (qualifier ? ` (${qualifier} 자료)` : "");
    return { name, variant: civil[2], subjectCollection: true };
  }
  return { name: clean, variant: "", subjectCollection: false };
}

const titleKey = (value: string) => value.replace(/\s+/g, "");
const slug = (value: string) => value.trim().replace(/\s+/g, "-");

export function qualificationGroups(certs: Cert[]): QualificationGroup[] {
  const buckets = new Map<string, Cert[]>();
  for (const cert of certs) {
    const key = titleKey(qualificationIdentity(cert.name).name);
    const members = buckets.get(key) || [];
    members.push(cert); buckets.set(key, members);
  }
  return [...buckets.values()].map((members) => {
    const identity = qualificationIdentity(members[0].name);
    const primary = members.find((cert) => !isHistoricalTitle(cert.name) && !qualificationIdentity(cert.name).variant)
      || members.find((cert) => !isHistoricalTitle(cert.name)) || members[0];
    return { ...primary, name: identity.name, slug: slug(identity.name),
      memberIds: members.map((cert) => cert.id), sourceNames: members.map((cert) => cert.name),
      subjectCollection: identity.subjectCollection,
      questionCount: members.every((cert) => cert.questionCount !== undefined) ? members.reduce((sum, cert) => sum + cert.questionCount!, 0) : undefined,
      examCount: members.every((cert) => cert.examCount !== undefined) ? members.reduce((sum, cert) => sum + cert.examCount!, 0) : undefined };
  });
}

export function resolveQualificationGroup(certs: Cert[], value: string): QualificationGroup | undefined {
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return undefined; }
  const groups = qualificationGroups(certs);
  // Source ID/slug aliases keep old direct links and saved attempts working.
  const source = certs.find((cert) => cert.id === decoded || (cert.slug || slug(cert.name)) === decoded);
  return source ? groups.find((group) => group.memberIds.includes(source.id))
    : groups.find((group) => group.slug === decoded || group.name === decoded);
}

export function belongsToQualification(cert: Cert, sourceId: string) {
  return "memberIds" in cert ? (cert as QualificationGroup).memberIds.includes(sourceId) : cert.id === sourceId;
}

export function sourceVariantLabel(cert: Cert) {
  const variant = qualificationIdentity(cert.name).variant;
  return [variant, isHistoricalTitle(cert.name) ? "개편 전 기출" : ""].filter(Boolean).join(" · ");
}

export function examSelectionLabel(exam: Exam, certs: Cert[]) {
  const source = certs.find((cert) => cert.id === exam.certId);
  const date = exam.id.startsWith(exam.certId) ? exam.id.slice(exam.certId.length) : "";
  const validDate = /^\d{8}$/.test(date) && Number(date.slice(0, 4)) === exam.year
    && Number(date.slice(4, 6)) >= 1 && Number(date.slice(4, 6)) <= 12
    && Number(date.slice(6, 8)) >= 1 && Number(date.slice(6, 8)) <= 31;
  const variant = source ? sourceVariantLabel(source) : "";
  // A period is not an annual round. Retain dates for historical twice-yearly exams.
  const periodOnly = variant && /^\d교시(?: · 개편 전 기출)?$/.test(variant) && exam.round === "1회";
  return [periodOnly ? "" : exam.round, variant, validDate ? `${date.slice(4, 6)}.${date.slice(6, 8)}` : ""].filter(Boolean).join(" · ");
}

export function groupSourceIdsForAttempt(certs: Cert[], config: { certId: string; sourceCertIds?: string[]; examIds?: string[] }) {
  const known = new Set(certs.map((cert) => cert.id));
  const ids = new Set((config.sourceCertIds || []).filter((id) => known.has(id)));
  if (known.has(config.certId)) ids.add(config.certId);
  // Derive only from exact date-based source exam IDs; never reinterpret an old attempt.
  for (const examId of config.examIds || []) {
    for (const cert of certs) if (examId.startsWith(cert.id) && /^\d{8}$/.test(examId.slice(cert.id.length))) ids.add(cert.id);
  }
  return [...ids];
}
