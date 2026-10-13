export const CONSENT_KEY: string;
export type PublicQualification = {slug:string;title:string};
export type SafePage = {location:string;title:string;qualificationSlug?:string};
export function sanitizePage(rawUrl:string, publicQualifications:PublicQualification[]):SafePage|null;
export function sanitizeReferrer(raw:string):string;
export function sanitizeCampaign(rawUrl:string):Record<string,string>;
export function sanitizeEvent(name:string,params:unknown):{name:string;params:Record<string,string>}|null;
