import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const module = { exports: {} };
const source = fs.readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Script(`(function(require,module,exports){${js}\n})`).runInThisContext()(require, module, module.exports);
const configured = module.exports.default.htmlLimitedBots;
assert.ok(configured instanceof RegExp, 'SE audit must receive blocking head metadata');
const { HTML_LIMITED_BOT_UA_RE: defaults } = require('next/dist/shared/lib/router/utils/html-bots');
assert.equal(configured.source, `${defaults.source}|SEBot-WA`, 'Preserve the complete installed Next bot list; review this snapshot on Next upgrades');
assert.equal(configured.flags, 'i');
for (const ua of ['SEBot-WA', 'Yeti/1.1', 'Google-InspectionTool', 'Bingbot', 'Twitterbot']) assert.ok(configured.test(ua), ua);
for (const ua of ['Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36', 'Mozilla/5.0 Version/18.0 Safari/605.1.15']) assert.ok(!configured.test(ua), 'Ordinary browser streaming must remain unchanged');
console.log('SEO bot delivery policy PASS: SE audit added, complete upstream list retained, ordinary browsers unchanged');
