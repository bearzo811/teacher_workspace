export function validWeeks(first:number,last:number,max=25){return Number.isInteger(first)&&Number.isInteger(last)&&first>=1&&last>=first&&last<=Math.min(25,max);}
export function passportWeeks(first:number,last:number){return validWeeks(first,last)?Array.from({length:last-first+1},(_,index)=>first+index):[];}
