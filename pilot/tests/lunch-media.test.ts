import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoId,validLunchMedia,shouldReplaceMedia} from '../lib/lunch-media';
test('lunch media accepts canonical YouTube video links without accepting arbitrary embeds or search playlists',()=>{
 const id='M7lc1UVf-VE';
 for(const input of [id,`https://youtu.be/${id}?t=3`,`https://www.youtube.com/watch?v=${id}&list=ignored`,`https://m.youtube.com/shorts/${id}`,`https://www.youtube-nocookie.com/embed/${id}`,`https://youtube.com/live/${id}`])assert.equal(youtubeVideoId(input),id);
 for(const input of ['周杰倫 稻香','javascript:alert(1)','http://youtu.be/'+id,'https://youtube.com.evil.example/watch?v='+id,'https://evil.example/youtube.com/watch?v='+id,'https://youtube.com@evil.example/watch?v='+id,'https://user:pass@youtube.com/watch?v='+id,'https://youtube.com:123/watch?v='+id,'https://youtube.com/playlist?list=abc','https://youtube.com/embed?listType=search&list=test','https://youtu.be/'+id+'/extra','https://youtube.com/watch?v=short','<iframe src="https://youtu.be/'+id+'"></iframe>'])assert.equal(youtubeVideoId(input),null,input);
});
test('media snapshots reject malformed versions and titles before rendering',()=>{
 assert.equal(validLunchMedia({video_id:null,title:'',version:0}),true);
 assert.equal(validLunchMedia({video_id:'M7lc1UVf-VE',title:'虛構影片',version:2}),true);
 for(const value of [null,[],{video_id:'bad',title:'x',version:1},{video_id:null,title:'x',version:-1},{video_id:null,title:'x',version:1.5},{video_id:null,title:'x'.repeat(121),version:0}])assert.equal(validLunchMedia(value),false);
});
test('late media responses cannot replace a newer teacher selection; disabled modules can hide the same version',()=>{
 const current={video_id:'M7lc1UVf-VE',title:'目前影片',version:3};
 assert.equal(shouldReplaceMedia(current,{video_id:null,title:'',version:2}),false);
 assert.equal(shouldReplaceMedia(current,{...current}),false);
 assert.equal(shouldReplaceMedia(current,{video_id:null,title:'',version:3}),true);
 assert.equal(shouldReplaceMedia(current,{...current,version:4}),true);
});
