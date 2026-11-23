export const displaySections=[{id:'contact',label:'聯絡簿'},{id:'learning',label:'護照與閱讀'},{id:'lunch',label:'午餐'},{id:'students',label:'學生資訊'},{id:'debts',label:'待完成作業'},{id:'calendar',label:'行事曆'}] as const;
export type DisplaySettings={base_font:number;visible_sections:string[];version:number};
export const defaultDisplaySettings:DisplaySettings={base_font:22,visible_sections:displaySections.map(x=>x.id),version:0};
export function validDisplayFont(value:number){return Number.isInteger(value)&&value>=16&&value<=32;}
export function displayText(value:number|string){return `calc(${typeof value==='number'?`${value}px`:value} * var(--pilot-display-scale, 1))`;}
