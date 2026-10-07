import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(file,stubs={}){const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(require,module,exports){'+js+'\n})')(name=>Object.hasOwn(stubs,name)?stubs[name]:require(name),mod,mod.exports);return mod.exports;}
function hooks(){const state=[],refs=[],effects=[];let s=0,r=0,e=0;return{state,reset(){s=r=e=0;},unmount(){effects.forEach(fn=>fn?.());},react:{useState(value){const i=s++;if(!(i in state))state[i]=typeof value==='function'?value():value;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef(value){const i=r++;return refs[i]??={current:value};},useEffect(effect){const i=e++;if(!(i in effects))effects[i]=effect();},useMemo(factory){return factory();}}};}
function nodes(value){if(Array.isArray(value))return value.flatMap(nodes);return value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[];}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const review=load('supabase/functions/question-bank-admin/question-review.ts');
const image='https://content.mypassmate.com/images/aa/'+'a'.repeat(64)+'.png';
const asset='https://content.mypassmate.com/admin-images/'+'b'.repeat(64)+'.png';
const question={id:'a'.repeat(20),certId:'aa',no:1,sourceHash:'source',stem:'stem',images:[image],displayMode:'source_image',choices:['A','B','C','D'].map((text,i)=>({label:review.choiceLabel(i),text})),answer:0,explanation:''};
const originalFetch=globalThis.fetch;
try{
 const parent=hooks(),child=hooks();let rootBusy=false,saves=0,release,signal;
 const media=load('components/question-image-editor.tsx',{react:child.react,'@/lib/supabase-browser':{getSupabaseBrowserClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}})}});
 const editor=load('components/question-review-editor.tsx',{react:parent.react,'@/supabase/functions/question-bank-admin/question-review':review,'./question-image-editor':media});
 const data={question:{...question,images:[]},version:0,sourceHash:'source'};
 const render=()=>{parent.reset();return editor.ReviewEditor({data,busy:false,onMediaBusy:value=>{rootBusy=value;},onSave:async()=>{saves++;},onReload(){}});};
 const upload=props=>{child.reset();nodes(media.QuestionImageEditor(props)).find(n=>n.type==='input'&&n.props['aria-label']==='사진 추가').props.onChange({target:{files:[new File(['fixture'],'image.png',{type:'image/png'})],value:'image.png'}});};
 globalThis.fetch=(_url,options)=>{signal=options.signal;return new Promise(resolve=>{release=resolve;});};
 let tree=nodes(render());tree.find(n=>n.type==='textarea'&&n.props.maxLength===2000).props.onChange({target:{value:'fixture reason'}});tree=nodes(render());const stale=tree.find(n=>n.type==='form');
 upload(tree.filter(n=>n.type===media.QuestionImageEditor)[2].props);stale.props.onSubmit({preventDefault(){}});assert.equal(saves,0,'synchronous submit during upload blocked');await flush();tree=nodes(render());assert.equal(rootBusy,true);assert.equal(tree.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);
 const remove=tree.find(n=>n.type==='button'&&[].concat(n.props.children).join('')==='① 보기 삭제');assert.equal(remove.props.disabled,true);remove.props.onClick();release({ok:true,json:async()=>({url:asset})});await flush();
 tree=nodes(render());const mediaNodes=tree.filter(n=>n.type===media.QuestionImageEditor);assert.deepEqual(mediaNodes[1].props.images,[asset]);assert.deepEqual(mediaNodes[2].props.images,[]);assert.equal(rootBusy,false);
 upload(mediaNodes[1].props);await flush();child.unmount();assert.equal(signal.aborted,true);const before=JSON.stringify(parent.state.slice(1));release({ok:true,json:async()=>({url:asset.replace(/b{64}/,'c'.repeat(64))})});await flush();assert.equal(rootBusy,false);assert.equal(JSON.stringify(parent.state.slice(1)),before);
 const ph=hooks();let legacyReads=0,correctionReads=0,picked;const legacy={...question,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',certId:'legacy',examId:'legacy-exam'};
 const picker=load('components/question-bank-picker.tsx',{react:ph.react,'@/lib/question-bank-content':{loadContentCatalog:async()=>({qualifications:[]}),loadContentBundle:async()=>{throw Error('unexpected NAS read');}},'@/lib/question-bank':{loadPublishedDataset:async()=>{legacyReads++;return{certs:[],subjects:[],exams:[{id:'legacy-exam',title:'legacy exam'}],questions:[legacy]};}},'@/lib/question-bank-corrections':{loadQuestionCorrections:async value=>{correctionReads++;return{...value,questions:value.questions.map(q=>({...q,stem:'corrected legacy'}))};}}});
 const pr=()=>{ph.reset();return picker.QuestionBankPicker({busy:false,onSelect:q=>{picked=q;}});};tree=nodes(pr());tree.find(n=>n.type==='select').props.onChange({target:{value:'__legacy__'}});await flush();tree=nodes(pr());assert.equal(legacyReads,1);assert.equal(correctionReads,1);tree.find(n=>n.type==='button'&&n.props.children==='직접 수정').props.onClick();assert.equal(picked.id,legacy.id);assert.equal(picked.stem,'corrected legacy');ph.unmount();
}finally{globalThis.fetch=originalFetch;}
const choices=load('lib/question-bank-choices.ts');const corrections=load('lib/question-bank-corrections.ts',{'./supabase-browser':{},'./question-bank-choices':choices,'../supabase/functions/question-bank-admin/question-review':review});
const patch={...question,schemaVersion:2,images:[],acceptedAnswers:[0],choices:question.choices.map((c,i)=>({...c,images:i===0?[asset]:[]}))};
const apply=content=>corrections.applyCorrections({questions:[question]},[{question_ref:question.id,source_hash:'source',content}]).questions[0];
const edited=apply(patch);assert.equal(edited.displayMode,'corrected_source');const renderer=load('components/question-choice-content.tsx',{'next/image':{default:({unoptimized,onError,...props})=>React.createElement('img',props)}});assert.ok(renderToStaticMarkup(React.createElement(renderer.QuestionChoiceContent,{choice:edited.choices[0],sourceImage:false})).includes(asset));assert.equal(apply({...patch,images:[image],choices:patch.choices.slice(0,3)}).displayMode,'corrected_source');assert.equal(apply({...patch,images:[image],choices:question.choices.map(c=>({...c,images:[]}))}).displayMode,'source_image');
const contract=load('lib/ai-explanation-contract.ts');const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');const baseline=hash({version:'answer-locked-v1',model:'alibaba/qwen3.7-flash',id:question.id,certId:question.certId,sourceHash:question.sourceHash,stem:question.stem,choices:question.choices,answer:question.answer,images:question.images,explanation:question.explanation});
for(const q of [question,{...question,acceptedAnswers:[0]}])assert.equal(hash(contract.explanationInput(q)),baseline);
for(const q of [{...question,acceptedAnswers:[0,1]},{...question,images:[asset]},{...question,stem:'new'}])assert.notEqual(hash(contract.explanationInput(q)),baseline);
console.log('Editor UI regressions PASS: upload locking/stable keys/unmount, legacy discovery, image rendering, paid cache preservation');
