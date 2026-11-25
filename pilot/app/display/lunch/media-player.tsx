'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {validLunchMedia,shouldReplaceMedia,type LunchMedia} from '../../../lib/lunch-media';
type Player={destroy():void;playVideo():void};
type YouTube={Player:new(element:HTMLElement,options:{videoId:string;width:string;height:string;playerVars:Record<string,string|number>;events:{onReady:(event:{target:Player})=>void;onStateChange:(event:{data:number})=>void;onError:()=>void;onAutoplayBlocked:()=>void}})=>Player};
declare global{interface Window{YT?:YouTube;onYouTubeIframeAPIReady?:()=>void;}}
let api:Promise<YouTube>|null=null;
function loadAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(!api)api=new Promise<YouTube>((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{previous?.();if(window.YT)resolve(window.YT);else reject(new Error('Player unavailable'));};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>{api=null;reject(new Error('Player unavailable'));};document.head.appendChild(script);
 });
 return api;
}
function Video({media,onEnded}:{media:LunchMedia&{video_id:string};onEnded:(version:number)=>void}){
 const mount=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{
  let disposed=false;const node=document.createElement('div');mount.current?.appendChild(node);
  void loadAPI().then(YT=>{if(disposed)return;player.current=new YT.Player(node,{videoId:media.video_id,width:'100%',height:'100%',playerVars:{autoplay:1,playsinline:1,rel:0,origin:window.location.origin},events:{onReady:e=>e.target.playVideo(),onStateChange:e=>{if(e.data===1)setMessage('');if(e.data===0)onEnded(media.version);},onError:()=>setMessage('影片無法播放或不允許嵌入，請老師更換影片連結。'),onAutoplayBlocked:()=>setMessage('請點播放器的播放鍵開始。')}});}).catch(()=>{if(!disposed)setMessage('播放器暫時無法載入，請檢查連線後重新整理。');});
  return()=>{disposed=true;player.current?.destroy();player.current=null;node.remove();};
 },[media.video_id,media.version,onEnded]);
 return <section style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column',background:'#000',color:'#fff'}} aria-label={media.title||'午餐影音'}>{message&&<p role="status" style={{margin:0,padding:12}}>{message}</p>}<div ref={mount} style={{flex:1,minHeight:0,width:'100%'}}/></section>;
}
export function LunchMediaSurface({initial,fallback,preview=false}:{initial:LunchMedia;fallback:ReactNode;preview?:boolean}){
 const [media,setMedia]=useState(initial),[message,setMessage]=useState(''),[retry,setRetry]=useState<number|null>(null),router=useRouter(),currentMedia=useRef(initial);
 useEffect(()=>{currentMedia.current=media;},[media]);
 useEffect(()=>setMedia(current=>initial.version>=current.version?initial:current),[initial]);
 useEffect(()=>{
  if(preview)return;
  let disposed=false;const controller=new AbortController();
  const poll=async()=>{if(document.hidden)return;try{const response=await fetch('/display/lunch/media',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error();const next:unknown=await response.json();if(!validLunchMedia(next))throw new Error();if(!disposed&&shouldReplaceMedia(currentMedia.current,next)){currentMedia.current=next;setMedia(next);setMessage('');setRetry(null);router.refresh();}}catch{if(!disposed)setMessage('影音狀態暫時無法同步，請檢查連線。');}};
  const timer=setInterval(()=>void poll(),10000);document.addEventListener('visibilitychange',poll);
  return()=>{disposed=true;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',poll);};
 },[router,preview]);
 const ended=useCallback((version:number)=>{
  if(preview){setMedia({video_id:null,title:'',version:version+1});return;}
  setRetry(null);setMessage('播放完畢，正在恢復午餐工作畫面…');
  void fetch('/display/lunch/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version})}).then(async response=>{if(!response.ok)throw new Error();const current=await fetch('/display/lunch/media',{cache:'no-store'});if(!current.ok)throw new Error();const next:unknown=await current.json();if(!validLunchMedia(next))throw new Error();setMedia(current=>next.version>=current.version?next:current);setMessage('');router.refresh();}).catch(()=>{setRetry(version);setMessage('播放完畢，但清空未成功；請重試。');});
 },[router,preview]);
 return <div style={{height:'100%',minHeight:0,display:'flex',flexDirection:'column'}}>{message&&<p role="status" style={{margin:0,padding:8,color:'#fde68a'}}>{message}{retry!==null&&<button onClick={()=>ended(retry)} style={{marginLeft:12,padding:10}}>重試清空</button>}</p>}<div style={{flex:1,minHeight:0}}>{media.video_id?<Video key={media.version} media={{...media,video_id:media.video_id}} onEnded={ended}/>:fallback}</div></div>;
}
