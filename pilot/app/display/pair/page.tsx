import {DisplayPairForm} from './form';
export const dynamic='force-dynamic';
export default function Pair(){return <main style={{maxWidth:700,margin:'auto',padding:32,lineHeight:1.8}}><h1>教室白板配對</h1><p>請老師在工作台的「白板配對」建立配對碼，再貼到這裡。配對後不需要學生登入老師帳號。</p>{process.env.PILOT_DISPLAY_PAIRING_ENABLED==='true'?<DisplayPairForm/>:<p>白板配對尚未開放。</p>}</main>;}
