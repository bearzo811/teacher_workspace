export function rewardAdjustment(value:unknown){
 if(typeof value!=="string"||!/^[-+]?\d{1,5}$/.test(value))return null;
 const amount=Number(value);return Number.isInteger(amount)&&Math.abs(amount)<=10000?amount:null;
}
export function rewardDisplay(coinNet:unknown,xpTotal:unknown){
 const coins=Number(coinNet??0),xp=Number(xpTotal??0);
 if(!Number.isSafeInteger(coins)||Math.abs(coins)>1000000000||!Number.isSafeInteger(xp)||xp<0||xp>1000000000)return null;
 return {coinNet:coins,coins:Math.max(0,coins),xp};
}
export function rewardLevel(xp:number,base:number){
 if(!Number.isSafeInteger(xp)||xp<0||xp>1000000000||!Number.isInteger(base)||base<1||base>10000)return null;
 // Cost from level L to L+1 is base × L; cumulative threshold is triangular.
 let level=Math.floor((1+Math.sqrt(1+8*xp/base))/2);
 const threshold=(value:number)=>base*value*(value-1)/2;
 while(threshold(level+1)<=xp)level++;
 while(threshold(level)>xp)level--;
 const currentXp=xp-threshold(level),requiredXp=base*level;
 return {level,currentXp,requiredXp,remainingXp:requiredXp-currentXp,percent:Math.floor(currentXp/requiredXp*100)};
}
