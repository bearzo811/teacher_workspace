import {createClient} from '@supabase/supabase-js';
import {pilotConfig} from './config';
export const displayCookie='teacher-pilot-display';
export function displayClient(){const {url,key}=pilotConfig();return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
