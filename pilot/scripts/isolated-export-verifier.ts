import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {validClassExport,inspectClassExport,type ClassExport} from '../lib/class-export';

const identifier=(name:string)=>{if(!/^[a-z][a-z0-9_]*$/.test(name))throw new Error('Unsupported schema identifier');return '"'+name+'"';};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Always creates a fresh in-memory database. No connection string, cloud client or network access. */
export async function verifyIsolatedExport(envelope:ClassExport,classId:string){
 if(!validClassExport(envelope,classId)||createHash('sha256').update(envelope.payload).digest('hex')!==envelope.sha256)throw new Error('Invalid export or checksum');
 const inspection=inspectClassExport(envelope,classId);if(inspection.problems.length)throw new Error('Export inspection failed: '+inspection.problems.join(' '));
 const snapshot=JSON.parse(envelope.payload),tables=Object.keys(snapshot.tables).sort(),db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
   create table auth.identities(user_id uuid,provider text);
   create function auth.uid() returns uuid language sql as 'select null::uuid';
   create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
   grant usage on schema auth to authenticated;`);
  const migrations=new URL('../supabase/migrations/',import.meta.url);
  for(const file of (await readdir(migrations)).filter(name=>/^\d{4}_.*\.sql$/.test(name)&&name.slice(0,4)<='0042'&&!name.startsWith('0021_')).sort())await db.exec(await readFile(new URL(file,migrations),'utf8'));
  const actualTables=(await db.query<{name:string}>("select tablename name from pg_tables where schemaname='public' and tablename like 'pilot_%' order by tablename")).rows.map(r=>r.name);
  const businessTables=actualTables.filter(name=>!['pilot_teachers','pilot_classes','pilot_display_devices','pilot_class_exports'].includes(name));
  if(JSON.stringify(tables)!==JSON.stringify(businessTables))throw new Error('Export table set does not match schema revision');
  const foreignKeys=(await db.query<{table_name:string;constraint_name:string}>("select t.relname table_name,c.conname constraint_name from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and c.contype='f'")).rows;
  // Changes apply only to this disposable instance. FK checks remain active at transaction end.
  for(const fk of foreignKeys)await db.exec(`alter table public.${identifier(fk.table_name)} alter constraint ${identifier(fk.constraint_name)} deferrable initially deferred`);
  for(const table of actualTables)await db.exec(`alter table public.${identifier(table)} disable trigger user`);
  async function references(target:string){
   const columns=(await db.query<{table_name:string;column_name:string}>(`select t.relname table_name,a.attname column_name from pg_constraint c join pg_class t on t.oid=c.conrelid
    cross join lateral unnest(c.conkey,c.confkey) k(src,dst) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.src join pg_attribute b on b.attrelid=c.confrelid and b.attnum=k.dst
    where c.contype='f' and c.confrelid=$1::regclass and b.attname='id'`,[target])).rows;
   const ids=new Set<string>();
   for(const column of columns){
    if(!tables.includes(column.table_name))continue;
    const rows=await db.query<{id:string|null}>("select distinct v->>$3 as id from jsonb_array_elements(($1::jsonb)->'tables'->$2) v",[envelope.payload,column.table_name,column.column_name]);
    for(const row of rows.rows)if(row.id!==null){if(!uuid.test(row.id))throw new Error('Invalid historical reference');ids.add(row.id);}
   }
   return ids;
  }
  const owner=randomUUID(),actors=await references('public.pilot_teachers'),devices=await references('public.pilot_display_devices');actors.add(owner);
  await db.exec('begin;set constraints all deferred');
  for(const actor of actors){await db.query('insert into auth.users(id) values($1)',[actor]);await db.query('insert into public.pilot_teachers(id,active) values($1,false)',[actor]);}
  await db.query("insert into public.pilot_classes select * from jsonb_populate_record(null::public.pilot_classes,(($1::jsonb)->'class')||jsonb_build_object('owner_id',$2::uuid))",[envelope.payload,owner]);
  for(const device of devices)await db.query("insert into public.pilot_display_devices(id,class_id,name,code_expires_at,revoked_at,created_by) values($1,$2,'隔離驗證裝置（停用）',now()-interval '1 second',now(),$3)",[device,classId,owner]);
  for(const table of tables){
   const columns=(await db.query<{column_name:string;is_generated:string}>("select column_name,is_generated from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table])).rows;
   if(columns.some(c=>c.is_generated!=='NEVER'))throw new Error('Generated-column restore requires review');
   const names=columns.map(c=>c.column_name),quoted=names.map(identifier).join(',');
   const malformed=(await db.query<{bad:boolean}>("select exists(select 1 from jsonb_array_elements(($1::jsonb)->'tables'->$2) v where (select count(*) from jsonb_object_keys(v))<>$4 or not(v ?& array(select jsonb_array_elements_text($3::jsonb)))) bad",[envelope.payload,table,JSON.stringify(names),names.length])).rows[0].bad;
   if(malformed)throw new Error('Export columns do not match schema');
   // Pass the original JSON text directly to PostgreSQL: bigint identity values stay exact.
   await db.query(`insert into public.${identifier(table)} (${quoted}) overriding system value select ${quoted} from jsonb_populate_recordset(null::public.${identifier(table)},($1::jsonb)->'tables'->$2)`,[envelope.payload,table]);
  }
  await db.exec('set constraints all immediate');
  for(const table of tables){
   const same=(await db.query<{same:boolean}>(`select coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.${identifier(table)} t),'[]'::jsonb)=coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from jsonb_populate_recordset(null::public.${identifier(table)},($1::jsonb)->'tables'->$2) t),'[]'::jsonb) same`,[envelope.payload,table])).rows[0].same;
   if(!same)throw new Error('Restored business data differs: '+table);
  }
  const sequences=(await db.query<{table_name:string;column_name:string}>("select table_name,column_name from information_schema.columns where table_schema='public' and is_identity='YES'")).rows;
  for(const s of sequences){const seq=(await db.query<{seq:string}>('select pg_get_serial_sequence($1,$2) seq',['public.'+s.table_name,s.column_name])).rows[0].seq;await db.query(`select setval($1::regclass,coalesce((select max(${identifier(s.column_name)}) from public.${identifier(s.table_name)}),1),exists(select 1 from public.${identifier(s.table_name)}))`,[seq]);}
  await db.exec('commit');
  const unsafe=(await db.query<{n:number}>('select count(*)::integer n from public.pilot_display_devices where token_hash is not null or code_hash is not null or revoked_at is null')).rows[0].n;
  const active=(await db.query<{n:number}>('select count(*)::integer n from public.pilot_teachers where active')).rows[0].n;
  if(unsafe||active)throw new Error('Isolated verification unexpectedly restored access');
  return {kind:'local-ephemeral-verification' as const,tables:tables.length,rows:inspection.rows,students:inspection.students,foreignKeys:foreignKeys.length,inactiveActors:actors.size,revokedDevicePlaceholders:devices.size,businessDataMatches:true,restoresLoginAccess:false};
 }finally{await db.close();}
}
