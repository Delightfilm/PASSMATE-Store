import sharp from "sharp";
export type CropRect={left:number;top:number;width:number;height:number};
export async function normalizedImage(bytes:Buffer,crop?:CropRect):Promise<Buffer>{
 if(bytes.length>4_000_000)throw new Error("image_too_large");
 const image=sharp(bytes,{animated:false,limitInputPixels:4_000_000});
 let meta;try{meta=await image.metadata();}catch{throw new Error("invalid_image");}
 if(!["png","jpeg","webp","gif"].includes(meta.format||"")||!meta.width||!meta.height)throw new Error("invalid_image");
 let output=image.rotate();
 if(crop){const {left,top,width,height}=crop;
  if(![left,top,width,height].every(Number.isFinite)||left<0||top<0||width<=0||height<=0||left+width>100||top+height>100)throw new Error("invalid_crop");
  // Decode EXIF orientation first; crop coordinates match what the browser displays.
  const oriented=await output.png().toBuffer();const orientedMeta=await sharp(oriented).metadata();
  const w=orientedMeta.width!,h=orientedMeta.height!;const x=Math.floor(left*w/100),y=Math.floor(top*h/100);
  output=sharp(oriented).extract({left:x,top:y,width:Math.max(1,Math.min(w-x,Math.round(width*w/100))),height:Math.max(1,Math.min(h-y,Math.round(height*h/100)))});
 }
 const result=await output.png().toBuffer();if(result.length>5_000_000)throw new Error("image_too_large");return result;
}
