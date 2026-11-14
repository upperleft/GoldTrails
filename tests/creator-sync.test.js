import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {reconcileCreatorResearch} from '../app/creator-sync.js';

const path=new URL('../app/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('creator-catalog.json',path),'utf8'));
const library=JSON.parse(await readFile(new URL('creator-video-library.json',path),'utf8'));
const creator={
 name:'New River Channel',channelId:'UC1234567890123456789012',channelUrl:'https://www.youtube.com/channel/UC1234567890123456789012',
 videos:[{id:'AbCdEf12345',title:'Sampling a New Creek',url:'https://www.youtube.com/watch?v=AbCdEf12345',channelId:'UC1234567890123456789012',checkedAt:'2026-11-14',subject:'Sampling',tags:['sampling','placer gold']}]
};

test('adds a new channel as a research lead and records source-checked videos once',()=>{
 const result=reconcileCreatorResearch({version:1,creators:[creator]},catalog,library,{today:'2026-11-14'});
 assert.equal(result.summary.addedCreators,1);
 assert.equal(result.summary.addedVideos,1);
 const profile=result.catalog.find(row=>row.youtube_channel_id===creator.channelId);
 assert.equal(profile.name,creator.name);
 assert.equal(profile.status,'lead');
 assert.equal(profile.checked_at,'2026-11-14');
 const channel=result.library.creators.find(row=>row.channelId===creator.channelId);
 assert.equal(channel.slug,profile.slug);
 assert.equal(channel.videos[0].ownershipStatus,'source_checked');
 assert.equal(channel.videos[0].checkedAt,'2026-11-14');
 const repeated=reconcileCreatorResearch({version:1,creators:[creator]},result.catalog,result.library,{today:'2026-11-14'});
 assert.equal(repeated.summary.addedCreators,0);
 assert.equal(repeated.summary.addedVideos,0);
 assert.equal(repeated.summary.preservedVideos,1);
});

test('updates an existing stable channel match without duplicating the profile',()=>{
 const known=library.creators[0];
 const incoming={name:known.name,channelId:known.channelId,channelUrl:known.channelUrl,videos:[{id:'A1b2C3d4E5F',title:'A newly indexed test video',url:'https://www.youtube.com/watch?v=A1b2C3d4E5F',channelId:known.channelId,checkedAt:'2026-11-13',subject:'Field test',tags:['sampling']}]};
 const result=reconcileCreatorResearch({version:1,creators:[incoming]},catalog,library,{today:'2026-11-14'});
 assert.equal(result.summary.addedCreators,0);
 assert.equal(result.summary.addedVideos,1);
 assert.equal(result.library.creators.filter(row=>row.channelId===known.channelId).length,1);
});

test('holds a name-only profile collision for review instead of duplicating it',()=>{
 const existing=[...catalog,{slug:'new-river-channel',name:creator.name,official_url:'https://example.com/',status:'lead',checked_at:'2026-11-01'}];
 const result=reconcileCreatorResearch({version:1,creators:[creator]},existing,library,{today:'2026-11-14'});
 assert.equal(result.summary.addedCreators,0);
 assert.equal(result.summary.addedVideos,0);
 assert.equal(result.exceptions[0].reason,'matching creator name exists without a confirmed channel-ID match');
});

test('refuses a video ID already owned by a different YouTube channel',()=>{
 const existing=library.creators[0];
 const incoming={...creator,videos:[{...creator.videos[0],id:existing.videos[0].id,url:existing.videos[0].url}]};
 const result=reconcileCreatorResearch({version:1,creators:[incoming]},catalog,library,{today:'2026-11-14'});
 assert.equal(result.summary.addedVideos,0);
 assert.equal(result.exceptions[0].reason,'video ID already belongs to a different or ambiguous channel, or its existing title differs');
});

test('rejects malformed channel and video identifiers before changing data',()=>{
 assert.throws(()=>reconcileCreatorResearch({version:1,creators:[{...creator,channelId:'fake'}]},catalog,library),/canonical channel ID/);
 assert.throws(()=>reconcileCreatorResearch({version:1,creators:[{...creator,videos:[{...creator.videos[0],id:'bad'}]}]},catalog,library),/Invalid video evidence/);
});
