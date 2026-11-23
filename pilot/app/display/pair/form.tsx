"use client";
import {useActionState} from 'react';
import {pairDisplay} from './actions';
export function DisplayPairForm(){const [state,action,pending]=useActionState(pairDisplay,{});return <form action={action}><label>一次性配對碼 <input name="code" autoComplete="off" maxLength={32} required spellCheck={false}/></label> <button disabled={pending}>{pending?'配對中…':'配對這台白板'}</button>{state.error&&<p role="alert">{state.error}</p>}</form>;}
