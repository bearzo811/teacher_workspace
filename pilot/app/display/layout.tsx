import {type ReactNode} from 'react';
import {DisplayNavigation,type DisplayNavItem} from './navigation';
export default function DisplayLayout({children}:{children:ReactNode}){
 const items:DisplayNavItem[]=[];
 if(process.env.PILOT_DISPLAY_CONTACT_ENABLED==='true')items.push({href:'/display/contact-book',label:'聯絡簿'});
 if(process.env.PILOT_DISPLAY_LEARNING_ENABLED==='true')items.push({href:'/display/learning',label:'護照與閱讀'});
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED==='true')items.push({href:'/display/students',label:'學生資訊'},{href:'/display/debts',label:'待完成作業'},{href:'/display/calendar',label:'行事曆'});
 if(!items.some(item=>item.href==='/display/students')){
  if(process.env.PILOT_DISPLAY_SHOP_ENABLED==='true')items.push({href:'/display/shop',label:'商店'});
  if(process.env.PILOT_DISPLAY_BACKPACK_ENABLED==='true')items.push({href:'/display/backpack',label:'背包'});
 }
 return <div style={{height:'100dvh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{flex:1,minHeight:0,overflow:'hidden'}}>{children}</div><DisplayNavigation items={items}/></div>;
}
