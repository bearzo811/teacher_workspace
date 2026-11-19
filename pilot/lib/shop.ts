export const shopLimits={price:10000,minLevel:1000,stock:100000,retained:200} as const;
export function shopInteger(value:unknown,min:number,max:number){
 if(typeof value!=="string"||!/^[-]?\d{1,7}$/.test(value))return null;
 const result=Number(value);return Number.isInteger(result)&&result>=min&&result<=max?result:null;
}
export function validShopKind(value:string){return value==="physical"||value==="privilege";}
