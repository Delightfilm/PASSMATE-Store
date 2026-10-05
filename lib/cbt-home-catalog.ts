import snapshot from "@/data/cbt-home-catalog.generated.json";
import { validateSnapshot } from "./cbt-home-catalog-schema.mjs";
export type { HomeQualification, HomeCatalogSnapshot } from "./cbt-home-catalog-schema.mjs";

// Pure local validation also runs when Next loads the server layout for a build.
export const homeCatalog = validateSnapshot(snapshot);
export function qualificationHref(slug: string) { return `/cbt/${encodeURIComponent(slug)}/`; }
const initials = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
export function normalizeSearch(value: string) { return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, ""); }
function initialSearch(value: string) {
  return [...value].map(letter => {
    const n = letter.charCodeAt(0) - 0xac00;
    return n >= 0 && n <= 11171 ? initials[Math.floor(n / 588)] : letter;
  }).join("");
}
export function searchQualifications(query: string, limit = 6) {
  const needle = normalizeSearch(query).replace(/컴활/g, "컴퓨터활용능력");
  if (!needle) return [];
  return homeCatalog.qualifications.filter(item => {
    const title = normalizeSearch(item.title);
    return title.includes(needle) || normalizeSearch(initialSearch(title)).includes(needle) || normalizeSearch(item.code).includes(needle);
  }).slice(0, limit);
}
export const quickQualifications = homeCatalog.qualifications.filter(item => item.questions > 0 && item.exams > 0).sort((a, b) => b.questions - a.questions || (a.code < b.code ? -1 : 1)).slice(0, 6);
