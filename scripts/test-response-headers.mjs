import assert from 'node:assert/strict';
import {loadAnalyticsTs} from './helpers/load-analytics-ts.mjs';

const config=loadAnalyticsTs('next.config.ts').default;
assert.equal(typeof config.headers,'function','Public and authenticated routes need explicit protective response headers');
const rules=await config.headers();
const global=rules.find(rule=>rule.source==='/:path*');
assert.ok(global,'Protect ordinary, private and static response paths without rewriting them');
const headers=Object.fromEntries(global.headers.map(h=>[h.key.toLowerCase(),h.value]));
assert.equal(headers['x-content-type-options'],'nosniff');
assert.equal(headers['referrer-policy'],'strict-origin-when-cross-origin');
assert.equal(headers['x-frame-options'],'SAMEORIGIN');
assert.equal(config.poweredByHeader,false);
assert.ok(!Object.hasOwn(headers,'cache-control'),'Do not override private/auth cache semantics');
assert.ok(!Object.hasOwn(headers,'access-control-allow-origin'),'Do not expand cross-origin data access');
console.log('Protective response headers PASS: MIME, referrer and same-origin framing; cache/auth/CORS unchanged');
