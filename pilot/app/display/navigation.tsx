"use client";
import {displayText} from '../../lib/display-settings';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
export type DisplayNavItem={href:string;label:string};
export function DisplayNavigation({items}:{items:DisplayNavItem[]}){
 const path=usePathname();if(path==='/display/pair'||!items.length)return null;
 return <nav aria-label="教室大屏分頁" style={{flexShrink:0,display:'flex',gap:10,flexWrap:'wrap',padding:'12px 20px',background:'#030817',borderTop:'1px solid #334155'}}>{items.map(item=>{const selected=path===item.href||(item.href==='/display/students'&&['/display/shop','/display/backpack'].includes(path));return <Link key={item.href} href={item.href} aria-current={selected?'page':undefined} style={{padding:'12px 18px',borderRadius:10,border:'1px solid #475569',background:selected?'#0369a1':'#1e293b',color:'#f8fafc',fontSize:displayText(20),fontWeight:600,textDecoration:'none'}}>{item.label}</Link>;})}</nav>;
}
