import {createHash} from "node:crypto";
import {NextResponse} from "next/server";
import {getPublicSupabaseConfig} from "@/lib/public-supabase-config";
import {normalizedImage,type CropRect} from "@/lib/question-image-server";
export const runtime="nodejs";
export const maxDuration=60;
const ORIGIN="https://content.mypassmate.com";
async function boundedBody(response:Response,max:number){
 if(!response.body||Number(response.headers.get("content-length")||0)>max)throw new Error("image_too_large");
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max)throw new Error("image_too_large");chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
export async function POST(request:Request){
 const authorization=request.headers.get("authorization")||"";
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))return NextResponse.json({error:"관리자 로그인이 필요합니다."},{status:401});
 const {url,key}=getPublicSupabaseConfig();
 const edge=async(body:Record<string,unknown>)=>{const response=await fetch(`${url}/functions/v1/question-bank-admin`,{method:"POST",headers:{Authorization:authorization,apikey:key,"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(35_000)});const payload=await response.json();if(!response.ok)throw new Error(response.status===403||response.status===401?"admin_required":"source_failed");return payload;};
 try{
  if(Number(request.headers.get("content-length")||0)>4_200_000)throw new Error("image_too_large");
  let ref:string,code:string,input:Buffer,crop:CropRect|undefined;
  const json=request.headers.get("content-type")?.includes("application/json");
  if(json){const body=JSON.parse((await boundedBody(new Response(request.body),10_000)).toString());ref=String(body.questionRef||"");code=String(body.qualificationCode||"");
    // The Edge verifies designated admin, source membership, and current/registered asset references.
    await edge({action:"authorize_edit_image",questionRef:ref,qualificationCode:code,src:body.src});
    const response=await fetch(body.src,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15_000)});if(!response.ok)throw new Error("source_failed");input=await boundedBody(response,4_000_000);crop=body.crop;
  }else{
    // Bound actual bytes too; a missing Content-Length is not a bypass.
    const body=await boundedBody(new Response(request.body),4_200_000);const form=await new Response(body,{headers:{"Content-Type":request.headers.get("content-type")||""}}).formData();
    ref=String(form.get("questionRef")||"");code=String(form.get("qualificationCode")||"");const file=form.get("file");
    await edge({action:"get_question",questionRef:ref,qualificationCode:code});
    if(!(file instanceof File)||file.size>4_000_000)throw new Error("invalid_image");input=Buffer.from(await file.arrayBuffer());
  }
  const bytes=await normalizedImage(input,crop);const hash=createHash("sha256").update(bytes).digest("hex");
  const token=process.env.PASSMATE_EDIT_ASSET_TOKEN;if(!token||token.length<32)throw new Error("storage_unavailable");
  const response=await fetch(`${ORIGIN}/edit-assets/v1/${hash}`,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"image/png"},body:new Uint8Array(bytes),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20_000)});
  if(!response.ok)throw new Error("storage_unavailable");
  await edge({action:"register_edit_asset",questionRef:ref,qualificationCode:code,sha256:hash,byteSize:bytes.length});
  return NextResponse.json({url:`${ORIGIN}/admin-images/${hash}.png`},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const kind=error instanceof Error?error.message:"failed";const status=kind==="admin_required"?403:kind==="storage_unavailable"?503:400;
  return NextResponse.json({error:kind==="admin_required"?"관리자 권한이 필요합니다.":kind==="storage_unavailable"?"NAS 이미지 저장소에 연결하지 못했습니다. 입력은 유지됩니다.":kind==="invalid_crop"?"자르기 범위를 확인해 주세요.":"이미지를 처리하지 못했습니다. 파일 형식·크기와 로그인 상태를 확인해 주세요."},{status,headers:{"Cache-Control":"no-store"}});
 }
}
