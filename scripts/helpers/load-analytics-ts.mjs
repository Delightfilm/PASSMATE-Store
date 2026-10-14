import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {Script} from 'node:vm';import ts from 'typescript';
export function loadAnalyticsTs(relative,globals={},overrides={}){
 const root=path.resolve(import.meta.dirname,'../..'),cache=new Map();
 function load(file){for(const suffix of ['','.ts','.tsx','.mjs','.json'])if(fs.existsSync(file+suffix)){file+=suffix;break;}if(/\.(mjs|json)$/.test(file))return createRequire(import.meta.url)(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const require=name=>Object.hasOwn(overrides,name)?overrides[name]:name.startsWith('@/')?load(path.join(root,name.slice(2))):name.startsWith('.')?load(path.resolve(path.dirname(file),name)):createRequire(file)(name);
 new Script(`(function(require,module,exports){${code}\n})`,{filename:file}).runInNewContext({console,process:{env:{}},URL,AbortController,AbortSignal,TextEncoder,Event,...globals})(require,module,module.exports);return module.exports;
 }
 return load(path.join(root,relative));
}
