import {readFile,stat} from 'node:fs/promises';
import {maxExportBytes,type ClassExport} from '../lib/class-export';
import {verifyIsolatedExport} from './isolated-export-verifier';

async function main(){
 const [path,expectedHash]=process.argv.slice(2);
 if(!path||!expectedHash||!/^[a-f0-9]{64}$/.test(expectedHash))throw new Error('Usage: node --import tsx pilot/scripts/verify-class-export.ts FILE SHA256_FROM_EXPORT_RECEIPT');
 if((await stat(path)).size>maxExportBytes)throw new Error('Export exceeds verification capacity');
 const bytes=await readFile(path);if(bytes.length>maxExportBytes)throw new Error('Export exceeds verification capacity');
 const payload=new TextDecoder('utf-8',{fatal:true}).decode(bytes),snapshot=JSON.parse(payload);
 if(!snapshot.tables||typeof snapshot.tables!=='object'||Array.isArray(snapshot.tables))throw new Error('Invalid export tables');
 const envelope:ClassExport={id:snapshot.export_id,payload,sha256:expectedHash,bytes:bytes.length,counts:Object.fromEntries(Object.entries(snapshot.tables).map(([name,rows])=>{if(!Array.isArray(rows))throw new Error('Invalid table rows');return [name,rows.length];}))};
 const result=await verifyIsolatedExport(envelope,snapshot.class?.id);
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
void main().catch(error=>{process.stderr.write('Isolated verification failed: '+(error instanceof Error?error.message:'Unknown error')+'\n');process.exitCode=1;});
