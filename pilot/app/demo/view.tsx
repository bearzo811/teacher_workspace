"use client";
import {useState} from 'react';
type Status='missing'|'pending'|'correction'|'completed';
type Reward='available'|'requested'|'redeemed';
type Student={name:string;status:Status;coins:number;rewards:Reward[]};
const initial=():Student[]=>Array.from({length:4},(_,i)=>({name:`示範學生${i+1}`,status:'missing',coins:20,rewards:[]}));
const labels:Record<Status,string>={missing:'未交',pending:'待老師確認',correction:'待訂正',completed:'已完成'};
export function Demo(){
 const [students,setStudents]=useState(initial),[selected,setSelected]=useState(0),[tab,setTab]=useState<'teacher'|'display'|'shop'>('display'),[message,setMessage]=useState('先選座號，試著繳交作業。'),[stock,setStock]=useState(4),[open,setOpen]=useState(true);
 const student=students[selected];
 function update(fn:(s:Student)=>Student){setStudents(current=>current.map((s,i)=>i===selected?fn(s):s));}
 function status(next:Status){update(s=>({...s,status:next,coins:s.coins+(next==='completed'&&s.status!=='completed'?2:s.status==='completed'&&next!=='completed'?-2:0)}));setMessage(next==='completed'?'示範老師已確認，模擬獎勵 +2 金幣。':`作業已改為${labels[next]}。`);}
 function buy(){if(!open||stock<=0||student.coins<10||student.status==='missing'){setMessage('目前無法購買，請先交作業並確認金幣、庫存與商店開放狀態。');return;}update(s=>({...s,coins:s.coins-10,rewards:[...s.rewards,'available']}));setStock(n=>n-1);setMessage('模擬購買成功：扣除 10 金幣，點歌一次已放入背包。');}
 const card={border:'1px solid #cbd5e1',borderRadius:14,padding:20,minWidth:0},button={padding:'10px 16px',margin:4,borderRadius:8,border:'1px solid #94a3b8',cursor:'pointer'};
 return <>
 <p style={{padding:12,background:'#fef3c7',borderRadius:10}}>示範規則：完成作業 +2 金幣；點歌一次 10 金幣。這些數值只用於試玩，正式班級由老師另外設定。</p>
 <nav aria-label="示範操作角色">{(['display','teacher','shop'] as const).map(t=><button key={t} type="button" aria-pressed={tab===t} style={{...button,background:tab===t?'#dbeafe':'white'}} onClick={()=>{setTab(t);setMessage(t==='teacher'?'老師可確認繳交狀態；待確認與待訂正都算已交。':t==='shop'?'交出作業後可試買商品，再申請使用背包獎品。':'學生繳交只會改為待確認，不會直接取得完成獎勵。');}}>{t==='teacher'?'2 · 老師確認':t==='display'?'1 · 學生繳交':'3 · 商店與背包'}</button>)}</nav>
 <p>選擇學生：{students.map((s,i)=><button key={s.name} type="button" style={{...button,background:selected===i?'#dbeafe':'white'}} aria-pressed={selected===i} onClick={()=>{setSelected(i);setMessage(`已選擇 ${s.name}。`);}}>{i+1} 號</button>)}</p>
 <p role="status" aria-live="polite" style={{padding:12,background:'#ecfdf5',borderRadius:10}}>{message}</p>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16}}>
 <section style={card}><h2>{selected+1} 號 {student.name}</h2><p><strong>{student.coins} 金幣</strong> · {student.status==='missing'?'作業未交，商店暫停':'作業已交，商店學習條件通過'}</p>
 {tab!=='shop'?<><h3>數學習作 p.12–13</h3><p>目前狀態：<strong>{labels[student.status]}</strong></p>{tab==='display'?<button style={button} disabled={student.status!=='missing'} onClick={()=>status('pending')}>{student.status==='missing'?'我已經交作業':'已記錄繳交'}</button>:<><label>老師調整狀態 <select value={student.status} onChange={e=>status(e.target.value as Status)}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><p>完成狀態重複選取不重複發幣；退回其他狀態會回沖示範獎勵。</p></>}</>:<><h3>🎤 點歌一次</h3><p>10 金幣 · 剩餘 {stock} 份 · {open?'商店開放':'商店關閉'}</p><button style={button} disabled={!open||stock<=0||student.coins<10||student.status==='missing'} onClick={buy}>購買並放入背包</button><p><label><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/>模擬老師開放商店</label></p></>}
 </section>
 <section style={card}><h2>{tab==='shop'?'永久背包':'全班狀態'}</h2>{tab==='shop'?<>{!student.rewards.length&&<p>尚無獎品，先購買一份試試看。</p>}{student.rewards.map((reward,i)=><article key={i} style={{borderTop:'1px solid #cbd5e1',padding:12}}><strong>🎤 點歌一次 · 第 {i+1} 份</strong><p>{reward==='available'?'可使用':reward==='requested'?'已申請，待老師核銷':'已使用'}</p>{reward!=='redeemed'&&<button style={button} onClick={()=>{update(s=>({...s,rewards:s.rewards.map((r,j)=>j===i?(r==='available'?'requested':'redeemed'):r)}));setMessage(reward==='available'?'已模擬送出使用申請，不會再次扣幣。':'已模擬老師確認使用；正式班級只有老師可核銷。');}}>{reward==='available'?'學生申請使用':'模擬老師確認已使用'}</button>}</article>)}</>:<ul>{students.map((s,i)=><li key={s.name}>{i+1} 號 {s.name}：{labels[s.status]} · {s.coins} 金幣</li>)}</ul>}</section>
 </div><p><button style={button} onClick={()=>{setStudents(initial());setSelected(0);setStock(4);setOpen(true);setMessage('示範已重設，沒有改動任何班級資料。');}}>重設示範資料</button></p>
 </>;
}
