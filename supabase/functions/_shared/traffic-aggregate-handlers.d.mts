import type {AggregatePacket} from './traffic-aggregate-contract.mjs';
import type {AggregateRequest} from './traffic-aggregate-contract.mjs';
export function emptyTrafficResponse(status:number):Response;
export function readTrafficPacket(request:Request):Promise<{status:number;packet?:never}|{packet:AggregatePacket;status?:never}>;
export function createTrafficIngestHandler(deps:{getConfig:()=>{enabled:boolean;ingestToken:string};ingest:(digest:string,packet:AggregatePacket)=>Promise<boolean>;sha256:(nonce:string)=>Promise<string>;now?:()=>number}):(request:Request)=>Promise<Response>;
export function createAdminTrafficAggregateHandler(deps:{resolveAdmin:(request:Request)=>Promise<true|401|403>;getConfig:()=>{enabled:boolean};readReport:(request:AggregateRequest)=>Promise<unknown>;now?:()=>Date}):(request:Request)=>Promise<Response>;
