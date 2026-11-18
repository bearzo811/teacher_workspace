export const rewardRuleFields=[
 {id:"homework_on_time_coins",label:"作業準時完成（金幣）",value:2,min:0},
 {id:"homework_late_coins",label:"作業逾期補交（金幣）",value:1,min:0},
 {id:"homework_missed_coins",label:"作業逾期未交（金幣，負數為扣除）",value:-1,min:-10000},
 {id:"passport_monday_coins",label:"護照提早／週一完成（金幣）",value:8,min:0},
 {id:"passport_tuesday_coins",label:"護照週二完成（金幣）",value:6,min:0},
 {id:"passport_wednesday_coins",label:"護照週三完成（金幣）",value:4,min:0},
 {id:"passport_thursday_coins",label:"護照週四完成（金幣）",value:2,min:0},
 {id:"passport_friday_coins",label:"護照週五完成（金幣）",value:1,min:0},
 {id:"passport_overdue_daily_coins",label:"護照逾週未完成，每上課日（金幣）",value:-1,min:-10000},
 {id:"reading_newspaper_coins",label:"讀報完成（金幣）",value:5,min:0},
 {id:"reading_reflection_coins",label:"閱讀心得完成（金幣）",value:5,min:0},
 {id:"routine_coins",label:"每項生活任務完成（金幣）",value:2,min:0},
 {id:"routine_xp",label:"每項生活任務完成（XP）",value:2,min:0},
 {id:"level_base_xp",label:"升級基數（XP）",value:100,min:1},
 {id:"substitute_coins",label:"老師確認代班完成（金幣）",value:3,min:0},
] as const;
export type RewardRules=Record<typeof rewardRuleFields[number]['id'],number>;
export const defaultRewardRules=Object.fromEntries(rewardRuleFields.map(field=>[field.id,field.value])) as RewardRules;
export function validRewardRules(input:unknown):input is RewardRules{
 if(!input||typeof input!=="object"||Array.isArray(input))return false;
 const record=input as Record<string,unknown>;
 if(Object.keys(record).length!==rewardRuleFields.length)return false;
 if(!rewardRuleFields.every(field=>{const value=record[field.id];return typeof value==="number"&&Number.isInteger(value)&&value>=field.min&&value<=(field.min<0?0:10000);}))return false;
 return ['passport_monday_coins','passport_tuesday_coins','passport_wednesday_coins','passport_thursday_coins'].every((key,index)=>record[key] as number >= (record[['passport_tuesday_coins','passport_wednesday_coins','passport_thursday_coins','passport_friday_coins'][index]] as number));
}
