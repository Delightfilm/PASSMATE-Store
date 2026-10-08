import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(file,stubs={}){const mod={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext('(function(require,module,exports){'+js+'\n})')(name=>Object.hasOwn(stubs,name)?stubs[name]:name==='@/lib/question-bank-groups'?load('lib/question-bank-groups.ts'):require(name),mod,mod.exports);return mod.exports;}
function hooks(){const state=[],refs=[],effects=[];let s=0,r=0,e=0;return{state,reset(){s=r=e=0;},unmount(){effects.forEach(fn=>fn?.());},react:{useState(value){const i=s++;if(!(i in state))state[i]=typeof value==='function'?value():value;return[state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];},useRef(value){const i=r++;return refs[i]??={current:value};},useEffect(effect){const i=e++;if(!(i in effects))effects[i]=effect();},useMemo(factory){return factory();}}};}
function nodes(value){if(Array.isArray(value))return value.flatMap(nodes);return value&&typeof value==='object'?[value,...nodes(value.props?.children)]:[];}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const review=load('supabase/functions/question-bank-admin/question-review.ts');
const image='https://content.mypassmate.com/images/aa/'+'a'.repeat(64)+'.png';
const asset='https://content.mypassmate.com/admin-images/'+'b'.repeat(64)+'.png';
const question={id:'a'.repeat(20),certId:'aa',no:1,sourceHash:'source',stem:'stem',images:[image],displayMode:'source_image',choices:['A','B','C','D'].map((text,i)=>({label:review.choiceLabel(i),text})),answer:0,explanation:''};
const originalFetch=globalThis.fetch;
const body=load('components/question-body.tsx');
const choiceView=load('components/question-choice-content.tsx',{'next/image':{default:({unoptimized,onError,...props})=>React.createElement('img',props)}});
const views={'./question-body':body,'./question-choice-content':choiceView};
const examUi=load('components/cbt-exam-ui.tsx');
const examViews={...views,'./cbt-exam-ui':examUi};
const examComponent=load('components/question-exam-review.tsx',{...examViews});
// Real browsing uses the learner renderers and local-only answer selection.
{
 const h=hooks();let picked;const component=load('components/question-exam-review.tsx',{react:h.react,...examViews});
 let questions=[{...question,displayMode:'text',no:41},{...question,id:'b'.repeat(20),no:42,stem:'second full stem',choices:[...question.choices,{label:'⑤',text:'fifth choice'}],acceptedAnswers:[0,4]}];
 let props={questions,title:'sample exam',busy:false,onEdit:q=>{picked=q;}};
 const render=()=>{h.reset();return nodes(component.QuestionExamReview(props));};
 const button=(tree,label)=>tree.find(n=>n.type==='button'&&n.props['aria-label']===label);
 let tree=render();assert.equal(tree.filter(n=>n.type===body.QuestionBody).length,1);assert.equal(tree.filter(n=>n.type===choiceView.QuestionChoiceContent).length,4);
 assert.equal(tree.find(n=>n.type==='button'&&n.props.children==='← 이전').props.disabled,true);
 tree.find(n=>n.type==='button'&&n.props.children==='다음 →').props.onClick();tree=render();assert.equal(tree.find(n=>n.type===body.QuestionBody).props.question.id,questions[1].id);assert.equal(tree.filter(n=>n.type===choiceView.QuestionChoiceContent).length,5);
 button(tree,'현재 문항 수정').props.onClick();assert.equal(picked.id,questions[1].id);
 tree.filter(n=>n.type==='button'&&n.props.className?.startsWith('choice-button'))[4].props.onClick();tree=render();assert.ok(tree.some(n=>n.type==='strong'&&n.props.children==='정답입니다.'),'multiple accepted answers work');
 button(tree,'41번 문항으로 이동').props.onClick();button(render(),'42번 문항으로 이동').props.onClick();assert.equal(render().filter(n=>n.type==='button'&&n.props.className?.startsWith('choice-button'))[4].props['aria-pressed'],true,'navigation retains local preview answer');
 tree=render();tree.find(n=>n.type==='input').props.onChange({target:{value:'41'}});render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(render().find(n=>n.type===body.QuestionBody).props.question.no,41,'search jumps in full exam rather than filtering to a snippet');
 questions=questions.map(q=>q.no===41?{...q,stem:'saved full stem'}:q);props={...props,questions};assert.equal(render().find(n=>n.type===body.QuestionBody).props.question.stem,'saved full stem','save refresh preserves current question');
 props={...props,editor:React.createElement('section',{id:'embedded-edit'})};tree=render();assert.ok(!tree.some(n=>n.type===body.QuestionBody));const navigation=button(tree,'42번 문항으로 이동');assert.equal(navigation.props.disabled,true);navigation.props.onClick();props={...props,editor:undefined};assert.equal(render().find(n=>n.type===body.QuestionBody).props.question.no,41,'editing locks navigation and keeps position');
 assert.ok(!tree.some(n=>n.type==='dialog'),'browse and embedded editor do not introduce a modal');
 const source=fs.readFileSync('components/question-exam-review.tsx','utf8');assert.ok(!/\b(fetch|localStorage|sessionStorage|saveStore|finish|requestAiExplanation)\s*[.(]/.test(source),'review cannot write learning state or call AI');
}
// Catch always-expanded editing, lost drafts, and answer/choice reindex regressions.
{
 const h=hooks();let saved;const component=load('components/question-review-editor.tsx',{react:h.react,'@/supabase/functions/question-bank-admin/question-review':review,'./question-image-editor':{},...views});
 const data={question:{...question,images:[],displayMode:'text'},version:0,sourceHash:'source'};
 let closed=0;
 const render=()=>{h.reset();return nodes(component.ReviewEditor({data,busy:false,onMediaBusy(){},hasReport:false,onSave:async(...args)=>{saved=args;},onReload(){},onClose(){closed++;}}));};
 const button=(tree,label)=>tree.find(n=>n.type==='button'&&n.props['aria-label']===label);
 let tree=render();assert.equal(tree.filter(n=>n.type==='textarea').length,1,'only save reason expanded initially');
 assert.ok(tree.some(n=>n.type==='dialog'),'editor declares a dialog; browser tests verify modal behavior');
 button(tree,'문항 편집 닫기').props.onClick();assert.equal(closed,1,'close returns to question list');
 assert.ok(tree.some(n=>n.type===body.QuestionBody),'real learner stem renderer reused');
 button(tree,'문제 본문 수정').props.onClick();tree=render();tree.find(n=>n.type==='textarea'&&n.props['aria-label']==='문제 본문').props.onChange({target:{value:'changed stem'}});
 button(render(),'본문 수정 닫기').props.onClick();tree=render();assert.equal(tree.find(n=>n.type===body.QuestionBody).props.question.stem,'changed stem','closing field retains draft preview');
 const row=tree.find(n=>n.props?.['data-choice-key']==='1');assert.ok(nodes(row).some(n=>n.type==='input'&&n.props.type==='checkbox'),'answer checkbox belongs to choice');
 tree.find(n=>n.type==='input'&&n.props['aria-label']==='② 정답').props.onChange({target:{checked:true}});
 button(render(),'① 보기 수정').props.onClick();tree=render();tree.find(n=>n.type==='textarea'&&n.props['aria-label']==='① 보기 텍스트').props.onChange({target:{value:'edited A'}});
 tree=render();tree.find(n=>n.type==='button'&&n.props['aria-label']==='① 보기 삭제').props.onClick();tree=render();assert.equal(tree.find(n=>n.type==='input'&&n.props['aria-label']==='① 정답').props.checked,true,'accepted answer follows choice on delete');
 tree.find(n=>n.type==='textarea'&&n.props.maxLength===2000).props.onChange({target:{value:'manual reason'}});tree=render();tree.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(saved[0].stem,'changed stem');assert.deepEqual(saved[0].acceptedAnswers,[0]);assert.equal(saved[0].choices.length,3);assert.equal(saved[1],'manual reason');assert.equal(saved[2],false);
 const fh=hooks(),full=load('components/question-review-editor.tsx',{react:fh.react,'@/supabase/functions/question-bank-admin/question-review':review,'./question-image-editor':{},...views});let fd={...data,question};
 const fr=()=>{fh.reset();return nodes(full.ReviewEditor({data:fd,busy:false,onMediaBusy(){},onSave:async()=>{},onReload(){}}));};
 tree=fr();assert.equal(tree.find(n=>n.type===body.QuestionBody).props.question.displayMode,'source_image','full source image initially shown once');
 button(tree,'문제 본문 수정').props.onClick();tree=fr();tree.find(n=>n.type==='textarea'&&n.props['aria-label']==='문제 본문').props.onChange({target:{value:'corrected source stem'}});button(fr(),'본문 수정 닫기').props.onClick();
 assert.equal(fr().find(n=>n.type===body.QuestionBody).props.question.displayMode,'corrected_source');
 fd={...fd,question:{...question,stem:'corrected source stem'},version:1};assert.equal(fr().find(n=>n.type===body.QuestionBody).props.question.displayMode,'corrected_source','save cannot hide edited source text again');
}
// Save outcomes must remain beside the sticky controls on long questions.
// Manual browsing embeds editing in the same exam card, without a modal.
{
 const h=hooks();const component=load('components/question-review-editor.tsx',{react:h.react,'@/supabase/functions/question-bank-admin/question-review':review,'./question-image-editor':{},...views});
 const tree=nodes(component.ReviewEditor({data:{question,version:0,sourceHash:'source'},embedded:true,busy:false,onMediaBusy(){},onSave:async()=>{},onReload(){}}));
 assert.ok(!tree.some(n=>n.type==='dialog'),'manual exam editing must stay inline, not open a new dialog');
 assert.ok(tree.some(n=>n.type==='form'),'embedded editor retains the real save form');
}
{
 const h=hooks();const component=load('components/question-review-editor.tsx',{react:h.react,'@/supabase/functions/question-bank-admin/question-review':review,'./question-image-editor':{},...views});
 const render=props=>{h.reset();return nodes(component.ReviewEditor({data:{question,version:0,sourceHash:'source'},busy:false,onMediaBusy(){},onSave:async()=>{},onReload(){},...props}));};
 for(const props of [{notice:'saved successfully'},{error:'save failed'}]){const tree=render(props),bar=tree.find(n=>n.props?.className==='question-editor-savebar');assert.ok(nodes(bar).some(n=>n.props?.children===(props.notice||props.error)),'sticky savebar contains latest outcome');}
 const tree=render({busy:true,notice:'stale saved successfully'});assert.ok(!nodes(tree.find(n=>n.props?.className==='question-editor-savebar')).some(n=>n.props?.children==='stale saved successfully'),'busy status overrides stale outcome');
}
try{
 const parent=hooks(),child=hooks();let rootBusy=false,saves=0,release,signal;
 const media=load('components/question-image-editor.tsx',{react:child.react,'@/lib/supabase-browser':{getSupabaseBrowserClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}})}})}});
 const editor=load('components/question-review-editor.tsx',{react:parent.react,'@/supabase/functions/question-bank-admin/question-review':review,'./question-image-editor':media,...views});
 const data={question:{...question,images:[]},version:0,sourceHash:'source'};
 const render=()=>{parent.reset();return editor.ReviewEditor({data,busy:false,onMediaBusy:value=>{rootBusy=value;},onSave:async()=>{saves++;},onReload(){}});};
 const upload=props=>{child.reset();nodes(media.QuestionImageEditor(props)).find(n=>n.type==='input'&&n.props['aria-label']==='사진 추가').props.onChange({target:{files:[new File(['fixture'],'image.png',{type:'image/png'})],value:'image.png'}});};
 globalThis.fetch=(_url,options)=>{signal=options.signal;return new Promise(resolve=>{release=resolve;});};
 let tree=nodes(render());tree.find(n=>n.type==='textarea'&&n.props.maxLength===2000).props.onChange({target:{value:'fixture reason'}});tree=nodes(render());const stale=tree.find(n=>n.type==='form');
 upload(tree.filter(n=>n.type===media.QuestionImageEditor)[2].props);stale.props.onSubmit({preventDefault(){}});assert.equal(saves,0,'synchronous submit during upload blocked');await flush();tree=nodes(render());assert.equal(rootBusy,true);assert.equal(tree.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);
 const remove=tree.find(n=>n.type==='button'&&n.props['aria-label']==='① 보기 삭제');assert.equal(remove.props.disabled,true);remove.props.onClick();release({ok:true,json:async()=>({url:asset})});await flush();
 tree=nodes(render());const mediaNodes=tree.filter(n=>n.type===media.QuestionImageEditor);assert.deepEqual(mediaNodes[2].props.images,[asset]);assert.deepEqual(mediaNodes[3].props.images,[]);assert.equal(rootBusy,false);
 upload(mediaNodes[1].props);await flush();child.unmount();assert.equal(signal.aborted,true);const before=JSON.stringify(parent.state.slice(1));release({ok:true,json:async()=>({url:asset.replace(/b{64}/,'c'.repeat(64))})});await flush();assert.equal(rootBusy,false);assert.equal(JSON.stringify(parent.state.slice(1)),before);
 const ph=hooks();let legacyReads=0,correctionReads=0,picked;const legacy={...question,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',certId:'legacy',examId:'legacy-exam'};
 const picker=load('components/question-bank-picker.tsx',{react:ph.react,'./question-exam-review':examComponent,'@/lib/question-bank-content':{loadContentCatalog:async()=>({qualifications:[]}),loadContentBundle:async()=>{throw Error('unexpected NAS read');}},'@/lib/question-bank':{loadPublishedDataset:async()=>{legacyReads++;return{certs:[],subjects:[],exams:[{id:'legacy-exam',title:'legacy exam'}],questions:[legacy]};}},'@/lib/question-bank-corrections':{loadQuestionCorrections:async value=>{correctionReads++;return{...value,questions:value.questions.map(q=>({...q,stem:'corrected legacy'}))};}}});
 const updates={[legacy.id]:{...legacy,stem:'older locally saved correction'}};
 const pr=()=>{ph.reset();return picker.QuestionBankPicker({busy:false,updates,onSelect:q=>{picked=q;}});};tree=nodes(pr());tree.find(n=>n.type==='select').props.onChange({target:{value:'__legacy__'}});await flush();tree=nodes(pr());assert.equal(legacyReads,1);assert.equal(correctionReads,1);const preview=tree.find(n=>n.type===examComponent.QuestionExamReview);assert.equal(preview.props.questions[0].stem,'corrected legacy','fresh server corrections must supersede older session saves');preview.props.onEdit(preview.props.questions[0]);assert.equal(picked.id,legacy.id);assert.equal(picked.stem,'corrected legacy');ph.unmount();
}finally{globalThis.fetch=originalFetch;}
const choices=load('lib/question-bank-choices.ts');const corrections=load('lib/question-bank-corrections.ts',{'./supabase-browser':{},'./question-bank-choices':choices,'../supabase/functions/question-bank-admin/question-review':review});
const patch={...question,schemaVersion:2,images:[],acceptedAnswers:[0],choices:question.choices.map((c,i)=>({...c,images:i===0?[asset]:[]}))};
const apply=content=>corrections.applyCorrections({questions:[question]},[{question_ref:question.id,source_hash:'source',content}]).questions[0];
const edited=apply(patch);assert.equal(edited.displayMode,'corrected_source');const renderer=load('components/question-choice-content.tsx',{'next/image':{default:({unoptimized,onError,...props})=>React.createElement('img',props)}});assert.ok(renderToStaticMarkup(React.createElement(renderer.QuestionChoiceContent,{choice:edited.choices[0],sourceImage:false})).includes(asset));assert.equal(apply({...patch,images:[image],choices:patch.choices.slice(0,3)}).displayMode,'corrected_source');assert.equal(apply({...patch,images:[image],choices:question.choices.map(c=>({...c,images:[]}))}).displayMode,'source_image');
const contract=load('lib/ai-explanation-contract.ts');const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');const baseline=hash({version:'answer-locked-v1',model:'alibaba/qwen3.7-flash',id:question.id,certId:question.certId,sourceHash:question.sourceHash,stem:question.stem,choices:question.choices,answer:question.answer,images:question.images,explanation:question.explanation});
for(const q of [question,{...question,acceptedAnswers:[0]}])assert.equal(hash(contract.explanationInput(q)),baseline);
for(const q of [{...question,acceptedAnswers:[0,1]},{...question,images:[asset]},{...question,stem:'new'}])assert.notEqual(hash(contract.explanationInput(q)),baseline);
console.log('Editor UI regressions PASS: upload locking/stable keys/unmount, legacy discovery, image rendering, paid cache preservation');
