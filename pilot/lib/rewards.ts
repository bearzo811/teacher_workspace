export function rewardAdjustment(value:unknown){
 if(typeof value!=="string"||!/^[-+]?\d{1,5}$/.test(value))return null;
 const amount=Number(value);return Number.isInteger(amount)&&Math.abs(amount)<=10000?amount:null;
}
export function rewardDisplay(coinNet:unknown,xpTotal:unknown){
 const coins=Number(coinNet??0),xp=Number(xpTotal??0);
 if(!Number.isSafeInteger(coins)||Math.abs(coins)>1000000000||!Number.isSafeInteger(xp)||xp<0||xp>1000000000)return null;
 return {coinNet:coins,coins:Math.max(0,coins),xp};
}
