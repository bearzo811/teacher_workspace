import {validDate,validRange,termWeek,type Term} from "./calendar";
import {validRewardRules,type RewardRules} from "./reward-rules";
const dayMs=86400000;
export function passportReward(term:Term,week:number,completedOn:string,rules:RewardRules){
 if(!validRange(term.start_date,term.end_date)||!validDate(completedOn)||!Number.isInteger(week)||week<1||week>25||week>(termWeek(term.end_date,term)??0)||!validRewardRules(rules))return null;
 const start=Date.parse(`${term.start_date}T00:00:00Z`);const startWeekday=(new Date(start).getUTCDay()+6)%7;
 const monday=start-startWeekday*dayMs+(week-1)*7*dayMs;
 const first=Math.max(start,monday),last=Math.min(Date.parse(`${term.end_date}T00:00:00Z`),monday+6*dayMs);const date=Date.parse(`${completedOn}T00:00:00Z`);
 if(date<first)return {coins:rules.passport_monday_coins,reason:"early" as const};
 if(date>last)return {coins:0,reason:"late" as const};
 const weekday=new Date(date).getUTCDay();const values=[0,rules.passport_monday_coins,rules.passport_tuesday_coins,rules.passport_wednesday_coins,rules.passport_thursday_coins,rules.passport_friday_coins,0];
 return {coins:values[weekday],reason:weekday===0||weekday===6?"weekend" as const:"weekday" as const};
}
