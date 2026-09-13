'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '../../lib/supabase';

export default function Login(){
  const router=useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [err,setErr]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setErr('');setLoading(true);try{const sb=supabaseBrowser();const {data,error}=await sb.auth.signInWithPassword({email,password});if(error||!data.user)throw new Error(error?.message||'Sign in failed');const {data:profile,error:pe}=await sb.from('profiles').select('role').eq('id',data.user.id).maybeSingle();if(pe)throw new Error(pe.message);if(!profile||!['admin','accountant'].includes(profile.role)){await sb.auth.signOut();throw new Error('This account is not authorized for the school admin portal.');}router.replace('/admin');}catch(x){setErr(x instanceof Error?x.message:'Unexpected sign-in error');}finally{setLoading(false)}}
  return <main className="login-wrap"><section className="login-card"><div style={{marginBottom:24}}><h1>Admin Login</h1><p className="muted">Use your school admin account.</p></div><form className="form" onSubmit={submit}><label className="label">Email<input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@school.com" required/></label><label className="label">Password<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{err&&<div className="error"><strong>Error:</strong> {err}</div>}<button className="btn" disabled={loading}>{loading?'Signing in…':'Sign in'}</button></form></section></main>
}
