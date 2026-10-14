import type {AggregatePacket} from '../supabase/functions/_shared/traffic-aggregate-contract.mjs';
import type {TrafficChoice} from './traffic-aggregate-policy.mjs';
export type TrafficAggregateCollector={navigate:(pathname:string,referrer:string)=>void;setActivity:(state:{visible:boolean;focused:boolean})=>void;setChoice:(choice:TrafficChoice)=>void;tick:()=>void;flush:()=>Promise<void>;dispose:()=>void};
export function createTrafficAggregateCollector(deps:{now:()=>number;send:(packet:AggregatePacket)=>Promise<boolean>;randomNonce:()=>string;onError?:()=>void},options:{enabled:boolean;publicQualifications:readonly {slug:string}[];choice:TrafficChoice}):TrafficAggregateCollector;
