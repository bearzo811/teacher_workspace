"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {serverClient} from '../../../lib/supabase';
import {validDate} from '../../../lib/calendar';
import {parseDutyJobs,dutyJobIssues} from '../../../lib/duty';
export async function publishDuty(form:FormData){
 if(process.env.PILOT_DUTY_PLANNER_ENABLED!=='true')redirect('/workspace');
 const client=await serverClient(true),{data:{user},error}=await client.auth.getUser();if(error||!user||user.app_metadata.provider!=='google')redirect('/login');
 const id=(key:string)=>String(form.get(key)??''),first=id('from'),revision=Number(form.get('revision'));
 if(!['class','term','request'].every(key=>/^[a-f0-9-]{36}$/i.test(id(key)))||!validDate(first)||!Number.isInteger(revision)||revision<0||form.get('confirm')!=='yes')redirect('/workspace/duty?error=input');
 const raw=id('schedule');if(raw.length>3000000)redirect('/workspace/duty?error=size');
 let jobs,rows,roster;
 try{jobs=parseDutyJobs(JSON.parse(id('jobs')));rows=JSON.parse(raw);roster=JSON.parse(id('roster'));}catch{redirect('/workspace/duty?error=input');}
 if(!jobs||!Array.isArray(rows)||rows.length>20000||!Array.isArray(roster)||roster.length>15||dutyJobIssues(jobs,roster.length).length)redirect('/workspace/duty?error=input');
 const result=await client.rpc('publish_pilot_duty_plan',{target_class:id('class'),target_term:id('term'),starts_on:first,job_specs:jobs,schedule:rows,expected_roster:roster,expected_revision:revision,request_key:id('request')});
 revalidatePath('/workspace/duty');
 redirect(`/workspace/duty?term=${id('term')}&month=${first.slice(0,7)}&${result.error?`error=${result.error.code==='40001'?'changed':'publish'}`:'notice=published'}`);
}
