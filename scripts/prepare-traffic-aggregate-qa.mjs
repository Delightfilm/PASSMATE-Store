import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const allowed=new Set(['traffic_aggregate_daily','traffic_aggregate_receipts','traffic_aggregate_state','ingest_traffic_aggregates','read_traffic_aggregate_report','cleanup_traffic_aggregates']);
export function buildTrafficQaMigration(sql){
 for(const match of sql.matchAll(/\b(public|auth|storage|cron|extensions)\s*\.\s*([a-z_][a-z_0-9]*)/gi))if(match[1].toLowerCase()!=='public'||!allowed.has(match[2].toLowerCase()))throw Error('Foreign database object');
 const mapped=sql.replace(/\bpublic\.(traffic_aggregate_daily|traffic_aggregate_receipts|traffic_aggregate_state|ingest_traffic_aggregates|read_traffic_aggregate_report|cleanup_traffic_aggregates)\b/g,'traffic_aggregate_qa.$1').replace(/search_path\s*=\s*public\s*,\s*pg_temp/gi,'search_path = traffic_aggregate_qa, pg_temp');
 return 'create schema if not exists traffic_aggregate_qa;\nrevoke all on schema traffic_aggregate_qa from PUBLIC,anon,authenticated;\ngrant usage on schema traffic_aggregate_qa to service_role;\n'+mapped;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(buildTrafficQaMigration(readFileSync(process.argv[2],'utf8')));
