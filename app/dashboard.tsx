'use client';

import { FormEvent, useMemo, useState } from 'react';
import type { Breach, RegisterData } from '@/lib/register';

const HOMEGROUPS = ['7A','7B','8A','8B','9A','9B','9C','10A','10B','11A','11B','12A','12B','Unsorted'];

export default function Dashboard({ initialData, user }: { initialData: RegisterData; user: { email:string; name:string; signOut:string } }) {
  const [breaches,setBreaches] = useState(initialData.breaches);
  const [kind,setKind] = useState<'uniform'|'phone'>('uniform');
  const [studentName,setStudentName] = useState('');
  const [homegroup,setHomegroup] = useState('');
  const [breachType,setBreachType] = useState('');
  const [notes,setNotes] = useState('');
  const [filter,setFilter] = useState<'open'|'all'|'actioned'>('open');
  const [groupFilter,setGroupFilter] = useState('All homegroups');
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState('');
  const [emailDraft,setEmailDraft] = useState<Breach|null>(null);

  const todayKey = new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne'}).format(new Date());
  const today = breaches.filter(b => new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne'}).format(new Date(b.occurredAt)) === todayKey);
  const visible = breaches.filter(b => (filter==='all'||(filter==='open'?!b.actioned:b.actioned)) && (groupFilter==='All homegroups'||b.homegroup===groupFilter));
  const firstName = user.name.split(/\s+/)[0] || 'there';
  const todayLabel = new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'Australia/Melbourne'}).format(new Date());
  const matchedStudent = useMemo(() => initialData.students.find(s => s.name.toLowerCase()===studentName.trim().toLowerCase()),[studentName,initialData.students]);
  function studentChanged(value:string) { setStudentName(value); const match=initialData.students.find(s=>s.name.toLowerCase()===value.toLowerCase()); if(match) setHomegroup(match.homegroup); }

  async function submit(event:FormEvent) {
    event.preventDefault(); setNotice('');
    if(!studentName.trim()||!homegroup||(kind==='uniform'&&!breachType)){ setNotice('Complete the student, homegroup and breach fields.'); return; }
    setSaving(true);
    try {
      const response=await fetch('/api/breaches',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,studentName,homegroup,breachType,notes})});
      const payload=await response.json() as {breach?:Breach;error?:string};
      if(!response.ok||!payload.breach) throw new Error(payload.error||'Could not save the breach.');
      setBreaches(current=>[payload.breach!,...current]); setStudentName(''); setHomegroup(''); setBreachType(''); setNotes('');
      setNotice(`${payload.breach.studentName} recorded${payload.breach.level ? ` — Day ${payload.breach.dayCount}, Level ${payload.breach.level}`:''}.`);
    } catch(error) { setNotice(error instanceof Error?error.message:'Could not save the breach.'); } finally { setSaving(false); }
  }

  async function toggleActioned(item:Breach) {
    const next=!item.actioned; setBreaches(current=>current.map(b=>b.id===item.id?{...b,actioned:next}:b));
    const response=await fetch('/api/breaches',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:item.id,actioned:next})});
    if(!response.ok){ setBreaches(current=>current.map(b=>b.id===item.id?item:b)); setNotice('Could not update that record. Please try again.'); }
  }

  return <main className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">B</span><span>Bayside<br/><small>College</small></span></div><nav aria-label="Main navigation"><a className="nav-item active" href="#dashboard"><span>⌂</span>Dashboard</a><a className="nav-item" href="#record"><span>＋</span>Record breach</a><a className="nav-item" href="#register"><span>▤</span>Action register</a></nav><div className="sidebar-bottom"><a className="nav-item" href={user.signOut}><span>↪</span>Sign out</a></div></aside>
    <section className="workspace"><header className="topbar"><button className="mobile-menu" aria-label="Open menu">☰</button><div className="school-title">Student conduct register</div><div className="profile"><div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div><div className="avatar">{initials(user.name)}</div></div></header>
      <div className="content" id="dashboard">
        <div className="welcome-row"><div><p className="eyebrow">{todayLabel}</p><h1>Good morning, {firstName}.</h1><p>Record, review and resolve student conduct breaches.</p></div><a className="primary-button" href="#record"><span>＋</span> Record a breach</a></div>
        <div className="stats" aria-label="Today's breach summary"><article className="stat-card"><span className="stat-icon lilac">▤</span><div><span>Today’s breaches</span><strong>{today.length}</strong><small>{today.filter(b=>b.kind==='uniform').length} uniform · {today.filter(b=>b.kind==='phone').length} phone</small></div></article><article className="stat-card"><span className="stat-icon amber">!</span><div><span>Awaiting action</span><strong>{breaches.filter(b=>!b.actioned).length}</strong><small>Across {new Set(breaches.filter(b=>!b.actioned).map(b=>b.homegroup)).size} homegroups</small></div></article><article className="stat-card"><span className="stat-icon mint">✓</span><div><span>Actioned today</span><strong>{today.filter(b=>b.actioned).length}</strong><small>{today.length?Math.round(today.filter(b=>b.actioned).length/today.length*100):0}% completion</small></div></article></div>
        <div className="main-grid">
          <section className="panel" id="record"><div className="panel-heading"><div><p className="eyebrow">Quick entry</p><h2>Record a breach</h2></div><div className="segmented"><button className={kind==='uniform'?'selected':''} onClick={()=>setKind('uniform')} type="button">Uniform</button><button className={kind==='phone'?'selected':''} onClick={()=>setKind('phone')} type="button">Phone</button></div></div>
            <form className="entry-form" onSubmit={submit}><label>Student<input list="student-roster" value={studentName} onChange={e=>studentChanged(e.target.value)} placeholder="Search or enter student name…" autoComplete="off"/><datalist id="student-roster">{initialData.students.map(s=><option key={s.name} value={s.name}>{s.homegroup}</option>)}</datalist></label><div className="form-row"><label>Homegroup<select value={matchedStudent?.homegroup||homegroup} onChange={e=>setHomegroup(e.target.value)}><option value="">Select homegroup</option>{HOMEGROUPS.map(g=><option key={g}>{g}</option>)}</select></label>{kind==='uniform'?<label>Breach type<select value={breachType} onChange={e=>setBreachType(e.target.value)}><option value="">Select type</option>{initialData.breachTypes.map(t=><option key={t}>{t}</option>)}</select></label>:<label>Type<input value="Phone use" disabled readOnly/></label>}</div><label>Notes <span>Optional</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add relevant context for the follow-up…"/></label>{notice&&<p className="form-notice" role="status">{notice}</p>}<button disabled={saving} className="submit-button">{saving?'Recording…':`Record ${kind} breach`} <span>→</span></button></form>
          </section>
          <aside className="panel recent"><div className="panel-heading"><div><p className="eyebrow">Live register</p><h2>Recent breaches</h2></div><a href="#register">View all</a></div>{breaches.length?<div className="breach-list">{breaches.slice(0,4).map(item=><article className="breach-item" key={item.id}><div className="student-avatar">{initials(item.studentName)}</div><div className="breach-copy"><strong>{item.studentName}</strong><span>{item.breachType} · {item.homegroup}</span></div><div className="breach-meta">{item.level&&<span className={`level level-${Math.min(item.level,3)}`}>L{item.level}</span>}<small>{formatTime(item.occurredAt)}</small></div></article>)}</div>:<Empty compact/>}<div className="privacy-note"><span>⌾</span><p><strong>Staff-only register</strong><br/>Only signed-in Bayside College staff can view or change records.</p></div></aside>
        </div>
        <section className="panel register-panel" id="register"><div className="register-heading"><div><p className="eyebrow">Follow-up</p><h2>Action register</h2><p>Tick a record once the required response has been completed.</p></div><div className="filters"><select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option>All homegroups</option>{HOMEGROUPS.map(g=><option key={g}>{g}</option>)}</select><div className="segmented">{(['open','all','actioned'] as const).map(f=><button type="button" key={f} className={filter===f?'selected':''} onClick={()=>setFilter(f)}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div></div></div>
          {visible.length?<div className="table-scroll"><table><thead><tr><th>Actioned</th><th>Student</th><th>Homegroup</th><th>Breach</th><th>Recorded</th><th>Level</th><th>Parent email</th></tr></thead><tbody>{visible.map(item=><tr key={item.id} className={item.actioned?'done':''}><td><input className="action-checkbox" type="checkbox" checked={item.actioned} onChange={()=>toggleActioned(item)} aria-label={`Mark ${item.studentName} actioned`}/></td><td><strong>{item.studentName}</strong><small>#{item.recordNumber}</small></td><td>{item.homegroup}</td><td><span className={`kind-pill ${item.kind}`}>{item.kind}</span>{item.breachType}</td><td>{formatDate(item.occurredAt)}</td><td>{item.level?<span className={`level level-${Math.min(item.level,3)}`}>Level {item.level}</span>:'—'}</td><td>{item.parentEmailDraft?<button className="text-button" onClick={()=>setEmailDraft(item)}>View draft</button>:'—'}</td></tr>)}</tbody></table></div>:<Empty/>}
        </section>
      </div></section>
    {emailDraft&&<div className="modal-backdrop" onClick={()=>setEmailDraft(null)}><section className="email-modal" role="dialog" aria-modal="true" aria-label="Parent email draft" onClick={e=>e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">Ready to copy</p><h2>Parent/carer email</h2></div><button onClick={()=>setEmailDraft(null)} aria-label="Close">×</button></div><pre>{emailDraft.parentEmailDraft}</pre><button className="submit-button" onClick={async()=>{await navigator.clipboard.writeText(emailDraft.parentEmailDraft||'');setNotice('Email draft copied to clipboard.');setEmailDraft(null)}}>Copy email draft <span>⧉</span></button></section></div>}
  </main>;
}

function Empty({compact=false}:{compact?:boolean}) { return <div className={compact?'empty compact-empty':'empty'}><span>✓</span><strong>Nothing waiting here</strong><p>{compact?'New records will appear as staff add them.':'No records match these filters.'}</p></div>; }
function initials(name:string){return name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()||'BC';}
function formatTime(value:string){return new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date(value));}
function formatDate(value:string){return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date(value));}
