export type HomeQualification = { code: string; title: string; slug: string; questions: number; exams: number };
export type HomeCatalogSnapshot = { snapshotSchemaVersion: string; releaseId: string; sourceSha256: string; generatedAt: string; qualifications: HomeQualification[] };
export const SNAPSHOT_SCHEMA: string;
export function validateSnapshot(value: unknown): HomeCatalogSnapshot;
