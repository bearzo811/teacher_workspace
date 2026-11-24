// Taiwan uses UTC+8 for all dates supported by the pilot. Avoid locale-specific
// punctuation/spacing differences between server-rendered and hydrated text.
export function taipeiTimestamp(value:string){
 const time=Date.parse(value);if(!Number.isFinite(time))return '時間無法顯示';
 return new Date(time+8*60*60*1000).toISOString().slice(0,19).replace('T',' ');
}
