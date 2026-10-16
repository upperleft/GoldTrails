import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {processEventPhoto} from '../app/connections/photos.js';
test('photo uploads reject scripts, corrupt files and oversized inputs',async()=>{for(const input of [Buffer.from('<svg onload="alert(1)"></svg>'),Buffer.from('%PDF fake'),Buffer.from([255,216,255,0]),Buffer.alloc(5*1024*1024+1)])await assert.rejects(()=>processEventPhoto(input));});
test('valid photos are decoded, resized and re-encoded without location/camera metadata',async()=>{const input=await sharp({create:{width:2000,height:100,channels:3,background:'#c9a65e'}}).withMetadata({exif:{IFD0:{Artist:'Private test artist'}}}).png().toBuffer(),result=await processEventPhoto(input),meta=await sharp(result).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.width,1600);assert.ok(!meta.exif);assert.ok(!meta.xmp);});
