"use client";
import {useEffect,useRef,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase-browser";

export function QuestionImageEditor({images,onChange,questionRef,qualificationCode,disabled,beginWork,endWork}:{images:string[];onChange:(images:string[])=>void;questionRef:string;qualificationCode:string;disabled:boolean;beginWork:()=>boolean;endWork:()=>void}) {
 const live=useRef(true); const abort=useRef<AbortController|null>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;abort.current?.abort();};},[]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [crop,setCrop]=useState<number|null>(null);
 const [rect,setRect]=useState({left:0,top:0,width:100,height:100});
 async function send(body:BodyInit,contentType?:string) {
   const {data}=await getSupabaseBrowserClient().auth.getSession();const token=data.session?.access_token;
   if(!token)throw new Error("로그인이 필요합니다.");
   if(!live.current)throw new Error("편집 취소");
   const response=await fetch("/api/admin/question-images/",{method:"POST",headers:{Authorization:`Bearer ${token}`,...(contentType?{"Content-Type":contentType}:{})},body,signal:abort.current?.signal});
   const result=await response.json();if(!response.ok)throw new Error(result.error||"이미지 저장 실패");return result.url as string;
 }
 async function upload(file:File,index?:number) {
   if(file.size>4_000_000){setError("이미지는 4MB 이하로 선택해 주세요.");return;}
   if(disabled||!beginWork())return;abort.current=new AbortController();setBusy(true);setError("");try{const form=new FormData();form.set("file",file);form.set("questionRef",questionRef);form.set("qualificationCode",qualificationCode);const url=await send(form);if(live.current){onChange(index===undefined?[...images,url]:images.map((src,i)=>i===index?url:src));setCrop(null);}}
   catch(e){if(live.current)setError(e instanceof Error?e.message:"이미지 저장 실패");}finally{if(live.current)setBusy(false);endWork();}
 }
 async function saveCrop(index:number){if(disabled||!beginWork())return;abort.current=new AbortController();setBusy(true);setError("");try{const url=await send(JSON.stringify({questionRef,qualificationCode,src:images[index],crop:rect}),"application/json");if(live.current){onChange(images.map((src,i)=>i===index?url:src));setCrop(null);}}catch(e){if(live.current)setError(e instanceof Error?e.message:"이미지 자르기 실패");}finally{if(live.current)setBusy(false);endWork();}}
 const locked=disabled||busy;
 return <div className="question-image-editor" aria-busy={busy}>
  {images.map((src,index)=><div className="question-image-item" key={`${src}-${index}`}>
   <div className="question-image-preview"><img src={src} alt={`편집 이미지 ${index+1}`} />{crop===index&&<div className="question-image-crop-region" style={{left:`${rect.left}%`,top:`${rect.top}%`,width:`${rect.width}%`,height:`${rect.height}%`}} />}</div>
   <div className="admin-card-actions"><button type="button" className="button button-ghost" disabled={locked} onClick={()=>{setCrop(index);setRect({left:0,top:0,width:100,height:100});}}>사진 자르기</button><label className="button button-ghost">사진 대체<input aria-label={`이미지 ${index+1} 대체`} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={locked} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,index);e.target.value="";}} /></label><button type="button" className="button button-ghost" disabled={locked} onClick={()=>{onChange(images.filter((_,i)=>i!==index));setCrop(null);}}>이 문항에서 삭제</button></div>
   {crop===index&&<div className="question-image-crop-controls">{(["left","top","width","height"] as const).map(key=><label key={key}>{{left:"왼쪽",top:"위쪽",width:"너비",height:"높이"}[key]} (%)<input type="number" min={key==="width"||key==="height"?1:0} max={100} value={rect[key]} disabled={locked} onChange={e=>setRect(r=>({...r,[key]:Number(e.target.value)}))} /></label>)}<button type="button" className="button button-primary" disabled={locked||rect.width<1||rect.height<1||rect.left<0||rect.top<0||rect.left+rect.width>100||rect.top+rect.height>100} onClick={()=>void saveCrop(index)}>잘라낸 사진 사용</button><button type="button" className="button button-ghost" disabled={locked} onClick={()=>setCrop(null)}>자르기 취소</button></div>}
  </div>)}
  <label className="button button-ghost">사진 추가<input aria-label="사진 추가" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={locked||images.length>=10} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value="";}} /></label>
  <p className="admin-help">PNG·JPG·WEBP·GIF, 4MB 이하. 자르기·대체는 새 NAS 파일로 저장하며 원본은 보존됩니다. 문항 수정 저장 전에는 풀이 화면에 반영되지 않습니다.</p>{busy&&<p role="status">사진 처리 중…</p>}{error&&<p className="question-review-error" role="alert">{error}</p>}
 </div>;
}
