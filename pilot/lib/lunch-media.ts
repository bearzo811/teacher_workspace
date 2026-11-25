/** Store a canonical video ID, never arbitrary iframe HTML or a search-playlist URL. */
export function youtubeVideoId(input:string):string|null{
 const value=input.trim();
 if(/^[A-Za-z0-9_-]{11}$/.test(value))return value;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();let id:string|null=null;
  if(host==='youtu.be')id=url.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)){
   if(url.pathname==='/watch')id=url.searchParams.get('v');
   else {const parts=url.pathname.split('/');if(parts.length===3&&['embed','shorts','live'].includes(parts[1]))id=parts[2];}
  }
  return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 }catch{return null;}
}
export type LunchMedia={video_id:string|null;title:string;version:number};
export function shouldReplaceMedia(current:LunchMedia,next:LunchMedia){
 return next.version>=current.version&&(next.version!==current.version||next.video_id!==current.video_id||next.title!==current.title);
}
export function validLunchMedia(value:unknown):value is LunchMedia{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const m=value as LunchMedia;
 return (m.video_id===null||typeof m.video_id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(m.video_id))&&typeof m.title==='string'&&m.title.length<=120&&Number.isSafeInteger(m.version)&&m.version>=0;
}
