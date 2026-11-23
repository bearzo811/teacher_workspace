import {type ReactNode,type CSSProperties} from 'react';
import {cookies} from 'next/headers';
import {displayClient,displayCookie} from '../../lib/display';
import {defaultDisplaySettings,type DisplaySettings} from '../../lib/display-settings';
import {DisplayNavigation,type DisplayNavItem} from './navigation';
export default async function DisplayLayout({children}:{children:ReactNode}){
 const items:DisplayNavItem[]=[];
 if(process.env.PILOT_DISPLAY_CONTACT_ENABLED==='true')items.push({href:'/display/contact-book',label:'聯絡簿'});
 if(process.env.PILOT_DISPLAY_LEARNING_ENABLED==='true')items.push({href:'/display/learning',label:'護照與閱讀'});
 if(process.env.PILOT_DISPLAY_OVERVIEWS_ENABLED==='true')items.push({href:'/display/students',label:'學生資訊'},{href:'/display/debts',label:'待完成作業'},{href:'/display/calendar',label:'行事曆'});
 if(!items.some(item=>item.href==='/display/students')){
  if(process.env.PILOT_DISPLAY_SHOP_ENABLED==='true')items.push({href:'/display/shop',label:'商店'});
  if(process.env.PILOT_DISPLAY_BACKPACK_ENABLED==='true')items.push({href:'/display/backpack',label:'背包'});
 }
 let settings:DisplaySettings=defaultDisplaySettings;
 if(process.env.PILOT_DISPLAY_APPEARANCE_ENABLED==='true'){
  const token=(await cookies()).get(displayCookie)?.value;
  if(token){const result=await displayClient().rpc('get_pilot_display_settings',{device_token:token});if(!result.error&&result.data)settings=result.data as DisplaySettings;}
 }
 const keys:Record<string,string>={'/display/contact-book':'contact','/display/learning':'learning','/display/students':'students','/display/debts':'debts','/display/calendar':'calendar','/display/shop':'students','/display/backpack':'students'};
 return <div style={{'--pilot-display-scale':settings.base_font/22,height:'100dvh',display:'flex',flexDirection:'column',overflow:'hidden',fontSize:`${settings.base_font}px`} as CSSProperties}><div style={{flex:1,minHeight:0,overflow:'hidden'}}>{children}</div><DisplayNavigation items={items.filter(item=>settings.visible_sections.includes(keys[item.href]))}/></div>;
}
