import sharp from 'sharp';
import {ConnectionsError} from './model.js';
let processing=0;
export async function processEventPhoto(buffer){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>5*1024*1024)throw new ConnectionsError('Upload a photo up to 5 MB.',413);
 // Do not pass SVG/PDF/TIFF or remote file paths to an image decoder.
 const jpeg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255,png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),webp=buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
 if(!jpeg&&!png&&!webp)throw new ConnectionsError('Use a JPEG, PNG or WebP photo.');
 if(processing>=2)throw new ConnectionsError('Photo processing is busy. Try again shortly.',429);
 processing++;
 try{const image=sharp(buffer,{failOn:'warning',limitInputPixels:20000000,pages:1}).timeout({seconds:8}),meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||!meta.width||!meta.height||meta.pages>1)throw Error('Unsupported image');
  const output=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff9ec'}).jpeg({quality:82,mozjpeg:true}).toBuffer();if(output.length>1500000)throw new ConnectionsError('Choose a smaller or less detailed photo.');return output;
 }catch(e){if(e instanceof ConnectionsError)throw e;throw new ConnectionsError('The photo could not be decoded. Choose a valid JPEG, PNG or WebP.');}finally{processing--;}
}
