import { validDate } from "./calendar";
export type CalendarEvent = { id:string; title:string; day:string; note:string; countdown:boolean; archived:boolean };
export function daysUntil(today:string,day:string) {
  if (!validDate(today) || !validDate(day)) return null;
  return Math.round((Date.parse(day)-Date.parse(today))/86_400_000);
}
export function upcomingEvents(events:readonly CalendarEvent[],today:string) {
  if (!validDate(today)) return [];
  return events.filter(event=>!event.archived&&event.countdown&&validDate(event.day)&&event.day>=today)
    .sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
}
