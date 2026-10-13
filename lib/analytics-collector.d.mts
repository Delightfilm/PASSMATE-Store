import type {PublicQualification} from './analytics-policy.mjs';
export type AnalyticsCollector = {setConsent(value:'granted'|'denied'):void;visit(rawUrl:string,referrer:string):void;track(name:string,params:unknown,dedupeKey?:string):boolean;dispose():void};
export function createAnalyticsCollector(deps:{loadTag:()=>Promise<void>;send:(command:unknown[])=>void;setDisabled:(value:boolean)=>void;storage:Pick<Storage,'getItem'|'setItem'>|null},options:{enabled:boolean;measurementId:string;publicQualifications:PublicQualification[]}):AnalyticsCollector;
