import Link from 'next/link';
const steps=[
 {title:'建立班級與選擇功能',text:'使用 Google 註冊後，輸入班級名稱並新增座號、姓名。只開啟自己需要的模組；之後仍可調整。首版每班最多 15 位學生。',href:'/workspace',label:'班級與名冊'},
 {title:'設定學期與上課日',text:'建立學期並啟用，填寫實際起訖日期，不必是星期一或星期五。在月曆設定放假、補課與活動；聯絡簿作業的繳交日會依下一個上課日計算。',href:'/workspace/calendar',label:'學期與行事曆'},
 {title:'準備作業、值日與獎勵',text:'有使用作業功能時，先建立簿本；有使用值日時，先檢查工作人數再預覽發布。使用金幣時先確認班級規則，自動獎勵與逾期扣點需要分別開啟。',href:'/workspace/exports',label:'檢查目前設定'},
 {title:'讓教室白板配對',text:'在後台產生一次性配對碼，到白板開啟配對頁輸入。配對後白板可使用本班已開放的功能；老師可在後台調整字級、顯示分頁及撤銷裝置。',href:'/workspace/displays',label:'白板設定與配對'},
 {title:'開始一天的使用',text:'先到 Today 查看進度並另外登記出缺席。學生在白板選座號後可完成任務、繳交今天應繳的作業。學生繳交先進入待確認；老師再檢查完成或訂正。今天聯絡簿新指派的作業，會到下一個上課日才成為應繳。',href:'/workspace/today',label:'Today 日常總覽'},
 {title:'處理商店、背包與保存資料',text:'老師開放商店後，符合條件的學生可直接購買，扣幣並放入永久背包。使用申請需老師確認核銷；這不是購買核准。定期下載班級資料檔並檢查，保存到自己的裝置。',href:'/workspace/backpacks/requests',label:'全班待核銷申請'},
];
export default function Guide(){return <main style={{maxWidth:900,margin:'auto',padding:24,lineHeight:1.9}}><Link href="/">← 首頁</Link> · <Link href="/workspace">導師工作台</Link><h1>第一次使用，從這裡開始</h1><p>可先花幾分鐘用<Link href="/demo">虛構班級試玩</Link>，熟悉學生繳交、老師確認、購買與獎品使用。示範不會改動自己的班級。</p><ol style={{paddingLeft:24}}>{steps.map(step=><li key={step.title} style={{padding:'8px 0 20px'}}><h2>{step.title}</h2><p>{step.text}</p><Link href={step.href}>{step.label} →</Link></li>)}</ol><section style={{border:'1px solid #cbd5e1',borderRadius:12,padding:20}}><h2>第一次讓學生操作前</h2><ul><li>在實際白板確認文字、觸控位置與影音聲音。</li><li>確認日期、學期、名冊、商店開關及各項獎勵設定。</li><li>用示範模式先講解「已交」與「老師已確認完成」的差異。</li></ul><p><Link href="/workspace/exports">前往設定檢查與資料匯出</Link></p></section></main>;}
