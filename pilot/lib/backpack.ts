export const rewardStates={available:"可使用",requested:"待老師核銷",redeemed:"已使用",revoked:"已撤回"} as const;
export type RewardState=keyof typeof rewardStates;
export const rewardActions={request:"代登使用申請",return:"退回可使用",redeem:"確認已使用（核銷）",revoke:"撤回獎品"} as const;
export type RewardAction=keyof typeof rewardActions;
export function allowedRewardActions(state:RewardState):RewardAction[]{
 if(state==='available')return ['request','revoke'];
 if(state==='requested')return ['redeem','return','revoke'];
 return [];
}
export function backpackPage(value:unknown){
 if(value===undefined)return 1;
 if(typeof value!=="string"||!/^\d{1,2}$/.test(value))return null;
 const page=Number(value);return page>=1&&page<=20?page:null;
}
