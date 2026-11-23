import {displayText} from '../../../lib/display-settings';
import {randomUUID} from 'node:crypto';
import {Submit} from '../../workspace/submit';
import {completeLearning} from './actions';
export function Complete({student,plan,week,kind,month,label}:{student:string;plan?:string;week?:number;kind?:string;month?:string;label:string}){
 return <form action={completeLearning}>
  <input type="hidden" name="student" value={student}/><input type="hidden" name="request" value={randomUUID()}/>
  <input type="hidden" name="source" value={plan?'passport':'reading'}/>
  {plan&&<><input type="hidden" name="plan" value={plan}/><input type="hidden" name="week" value={week}/></>}
  {kind&&<><input type="hidden" name="kind" value={kind}/><input type="hidden" name="month" value={month}/></>}
  <Submit pendingLabel="登記中…" fontSize={displayText(20)}>{label}</Submit>
 </form>;
}
