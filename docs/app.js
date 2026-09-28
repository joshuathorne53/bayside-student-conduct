import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getFirestore, limit, onSnapshot, orderBy, query, runTransaction, setDoc, Timestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { allowedDomains, firebaseConfig } from './firebase-config.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account', hd: allowedDomains[0] });

const HOMEGROUPS = ['7A','7B','8A','8B','9A','9B','9C','10A','10B','11A','11B','12A','12B','Unsorted'];
const BREACH_TYPES = ['Incorrect shoes','Missing blazer','Incorrect shirt or polo','Non-uniform jumper','Jewellery','Other uniform breach'];
const state = { user:null, breaches:[], students:[], kind:'uniform', filter:'open', group:'All homegroups', unsubscribe:null, studentUnsubscribe:null, notice:'' };
const root = document.querySelector('#app');

onAuthStateChanged(auth, async user => {
  if (!user) { teardown(); renderLogin(); return; }
  if (!allowedEmail(user.email)) {
    await signOut(auth);
    renderLogin(`Access is limited to ${allowedDomains.map(d=>`@${d}`).join(' or ')} accounts.`);
    return;
  }
  state.user = user;
  state.group = await loadDefaultHomegroup(user.uid);
  renderApp();
  subscribeToData();
});

function renderLogin(error='') {
  root.className='';
  root.innerHTML=`<main class="login-page"><section class="login-card"><span class="brand-mark">B</span><p class="eyebrow">Bayside College</p><h1>Student Conduct Register</h1><p>Sign in with your school Google account to record and action uniform and phone breaches.</p><button class="google-button" id="sign-in"><span class="google-g">G</span> Continue with Google</button>${error?`<p class="auth-error">${escapeHtml(error)}</p>`:''}<div class="login-note"><span>⌾</span><span>Staff-only access. Firebase Authentication verifies your Google account before Firestore allows any student records to be read.</span></div></section></main>`;
  document.querySelector('#sign-in').addEventListener('click', async()=>{
    try { await signInWithPopup(auth,provider); }
    catch(error) { renderLogin(friendlyError(error)); }
  });
}

function renderApp() {
  const user=state.user; const todayLabel=new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'Australia/Melbourne'}).format(new Date());
  root.className='';
  root.innerHTML=`<main class="app-shell">
    <aside class="sidebar"><div class="brand"><span class="brand-mark">B</span><span>Bayside<br><small>College</small></span></div><nav><a class="nav-item active" href="#dashboard"><span>⌂</span>Dashboard</a><a class="nav-item" href="#record"><span>＋</span>Record breach</a><a class="nav-item" href="#register"><span>▤</span>Action register</a></nav><div class="sidebar-bottom"><button class="nav-item" id="sign-out"><span>↪</span>Sign out</button></div></aside>
    <section class="workspace"><header class="topbar"><button class="mobile-menu" aria-label="Open menu">☰</button><div class="school-title">Student conduct register</div><div class="profile"><div class="profile-copy"><strong>${escapeHtml(user.displayName||user.email)}</strong><span>${escapeHtml(user.email)}</span></div><div class="avatar">${initials(user.displayName||user.email)}</div></div></header>
      <div class="content" id="dashboard"><div class="welcome-row"><div><p class="eyebrow">${todayLabel}</p><h1>Good morning, ${escapeHtml(firstName(user.displayName||user.email))}.</h1><p>Record, review and resolve student conduct breaches.</p></div><a class="primary-button" href="#record"><span>＋</span> Record a breach</a></div>
        <div id="stats" class="stats"></div>
        <div class="main-grid"><section class="panel" id="record"><div class="panel-heading"><div><p class="eyebrow">Quick entry</p><h2>Record a breach</h2></div><div class="segmented"><button type="button" data-kind="uniform" class="selected">Uniform</button><button type="button" data-kind="phone">Phone</button></div></div>
          <form class="entry-form" id="breach-form"><label>Student<input id="student-name" list="student-roster" placeholder="Search or enter student name…" required autocomplete="off"><datalist id="student-roster"></datalist></label><div class="form-row"><label>Homegroup<select id="homegroup" required><option value="">Select homegroup</option>${HOMEGROUPS.map(g=>`<option>${g}</option>`).join('')}</select></label><label id="type-field">Breach type<select id="breach-type" required><option value="">Select type</option>${BREACH_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></label></div><label>Notes <span>Optional</span><textarea id="notes" placeholder="Add relevant context for the follow-up…"></textarea></label><p id="form-notice" class="form-notice" hidden></p><button class="submit-button" id="submit-breach">Record uniform breach <span>→</span></button></form>
        </section><aside class="panel recent"><div class="panel-heading"><div><p class="eyebrow">Live register</p><h2>Recent breaches</h2></div><a href="#register">View all</a></div><div id="recent"></div><div class="privacy-note"><span>⌾</span><p><strong>Firebase protected</strong><br>Only signed-in Bayside staff can read or change Firestore records.</p></div></aside></div>
        <section class="panel register-panel" id="register"><div class="register-heading"><div><p class="eyebrow">Follow-up</p><h2>Action register</h2><p>Tick a record once the required response has been completed.</p></div><div class="filters"><div class="homegroup-preference"><select id="group-filter" aria-label="Action register homegroup"><option ${state.group==='All homegroups'?'selected':''}>All homegroups</option>${HOMEGROUPS.map(g=>`<option ${state.group===g?'selected':''}>${g}</option>`).join('')}</select><button type="button" id="save-default-group" class="default-button" title="Use this homegroup whenever you sign in">☆ Set as default</button></div><div class="segmented"><button data-filter="open" class="selected">Open</button><button data-filter="all">All</button><button data-filter="actioned">Actioned</button></div></div></div><div id="register-content"></div></section>
      </div></section></main><div id="modal-root"></div>`;
  bindAppEvents(); renderData();
}

function bindAppEvents() {
  document.querySelector('#sign-out').addEventListener('click',()=>signOut(auth));
  document.querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',()=>{state.kind=button.dataset.kind;document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('selected',b===button));renderTypeField();}));
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===button));renderRegister();}));
  document.querySelector('#group-filter').addEventListener('change',event=>{state.group=event.target.value;renderStats();renderRegister();});
  document.querySelector('#save-default-group').addEventListener('click',saveDefaultHomegroup);
  document.querySelector('#breach-form').addEventListener('submit',submitBreach);
  document.querySelector('#student-name').addEventListener('input',event=>{const match=state.students.find(s=>s.name.toLowerCase()===event.target.value.trim().toLowerCase());if(match)document.querySelector('#homegroup').value=match.homegroup;});
}

function subscribeToData() {
  if(state.unsubscribe)state.unsubscribe();
  if(state.studentUnsubscribe)state.studentUnsubscribe();
  state.unsubscribe=onSnapshot(query(collection(db,'breaches'),orderBy('createdAt','desc'),limit(250)),snapshot=>{state.breaches=snapshot.docs.map(item=>({id:item.id,...item.data()}));renderData();},error=>showToast(friendlyError(error)));
  state.studentUnsubscribe=onSnapshot(query(collection(db,'students'),orderBy('name')),snapshot=>{state.students=snapshot.docs.map(item=>({id:item.id,...item.data()})).filter(s=>s.active!==false);renderRoster();},()=>{});
}

function teardown(){if(state.unsubscribe){state.unsubscribe();state.unsubscribe=null;}if(state.studentUnsubscribe){state.studentUnsubscribe();state.studentUnsubscribe=null;}state.user=null;state.breaches=[];state.students=[];}

async function submitBreach(event) {
  event.preventDefault(); const submit=document.querySelector('#submit-breach'); submit.disabled=true;
  const currentUser=auth.currentUser||state.user;
  if(!currentUser){setNotice('Your sign-in expired. Please refresh and sign in again.');submit.disabled=false;return;}
  const studentName=document.querySelector('#student-name').value.trim(); const homegroup=document.querySelector('#homegroup').value; const notes=document.querySelector('#notes').value.trim(); const breachType=state.kind==='phone'?'Phone use':document.querySelector('#breach-type').value;
  if(!studentName||!homegroup||!breachType){setNotice('Complete the student, homegroup and breach fields.');submit.disabled=false;return;}
  try {
    const now=Timestamp.now(); const dateKey=melbourneDate(now.toDate()); const base={kind:state.kind,studentName,studentKey:normaliseName(studentName),homegroup,breachType,notes,enteredBy:currentUser.email,enteredByUid:currentUser.uid,createdAt:now,occurrenceDate:dateKey,actioned:false,actionedBy:null,actionedAt:null};
    let result={dayCount:null,level:null,parentEmailDraft:null};
    if(state.kind==='uniform'){
      const statRef=doc(db,'studentStats',await stableKey(studentName)); const breachRef=doc(collection(db,'breaches'));
      result=await runTransaction(db,async transaction=>{const snap=await transaction.get(statRef);const days={...(snap.exists()?snap.data().days:{})};const isNewDay=!days[dateKey];days[dateKey]=true;const dayCount=Object.keys(days).length;const level=levelFor(dayCount);const parentEmailDraft=buildParentEmail(studentName,breachType,dayCount,level,isNewDay);transaction.set(statRef,{studentName,studentKey:normaliseName(studentName),days,dayCount,updatedAt:now},{merge:true});transaction.set(breachRef,{...base,dayCount,level,parentEmailDraft});return{dayCount,level,parentEmailDraft};});
    } else { await addDoc(collection(db,'breaches'),{...base,...result}); }
    event.target.reset(); setNotice(`${studentName} recorded${result.level?` — Day ${result.dayCount}, Level ${result.level}`:''}.`);
  } catch(error){setNotice(friendlyError(error));} finally {submit.disabled=false;}
}

function renderData(){if(!document.querySelector('#stats'))return;renderStats();renderRecent();renderRegister();renderRoster();}
function renderStats(){const todayKey=melbourneDate(new Date());const today=state.breaches.filter(b=>b.occurrenceDate===todayKey);const scoped=state.group==='All homegroups'?state.breaches:state.breaches.filter(b=>b.homegroup===state.group);const scopedToday=scoped.filter(b=>b.occurrenceDate===todayKey);const waiting=scoped.filter(b=>!b.actioned);const scopeLabel=state.group==='All homegroups'?`Across ${new Set(waiting.map(b=>b.homegroup)).size} homegroups`:`${state.group} homegroup`;document.querySelector('#stats').innerHTML=`<article class="stat-card"><span class="stat-icon lilac">▤</span><div><span>Today’s breaches</span><strong>${today.length}</strong><small>${today.filter(b=>b.kind==='uniform').length} uniform · ${today.filter(b=>b.kind==='phone').length} phone</small></div></article><article class="stat-card"><span class="stat-icon amber">!</span><div><span>Awaiting action</span><strong>${waiting.length}</strong><small>${scopeLabel}</small></div></article><article class="stat-card"><span class="stat-icon mint">✓</span><div><span>Actioned today</span><strong>${scopedToday.filter(b=>b.actioned).length}</strong><small>${state.group==='All homegroups'?'All homegroups':state.group+' homegroup'}</small></div></article>`;}
function renderRecent(){const target=document.querySelector('#recent');const list=state.breaches.slice(0,4);target.innerHTML=list.length?`<div class="breach-list">${list.map(item=>`<article class="breach-item"><div class="student-avatar">${initials(item.studentName)}</div><div class="breach-copy"><strong>${escapeHtml(item.studentName)}</strong><span>${escapeHtml(item.breachType)} · ${escapeHtml(item.homegroup)}</span></div><div class="breach-meta">${item.level?`<span class="level level-${Math.min(item.level,5)}">L${item.level}</span>`:''}<small>${formatTime(item.createdAt)}</small></div></article>`).join('')}</div>`:emptyState(true);}
function renderRoster(){const target=document.querySelector('#student-roster');if(target)target.innerHTML=state.students.map(s=>`<option value="${escapeAttr(s.name)}">${escapeHtml(s.homegroup)}</option>`).join('');}
function renderRegister(){const target=document.querySelector('#register-content');if(!target)return;const visible=state.breaches.filter(b=>(state.filter==='all'||(state.filter==='open'?!b.actioned:b.actioned))&&(state.group==='All homegroups'||b.homegroup===state.group));if(!visible.length){target.innerHTML=emptyState(false);return;}target.innerHTML=`<div class="table-scroll"><table><thead><tr><th>Actioned</th><th>Student</th><th>Homegroup</th><th>Breach</th><th>Recorded</th><th>Level</th><th>Parent email</th></tr></thead><tbody>${visible.map(item=>`<tr class="${item.actioned?'done':''}"><td><input class="action-checkbox" type="checkbox" data-action-id="${item.id}" ${item.actioned?'checked':''} aria-label="Mark ${escapeAttr(item.studentName)} actioned"></td><td><strong>${escapeHtml(item.studentName)}</strong><small>${item.id.slice(0,8)}</small></td><td>${escapeHtml(item.homegroup)}</td><td><span class="kind-pill ${item.kind}">${item.kind}</span>${escapeHtml(item.breachType)}</td><td>${formatDate(item.createdAt)}</td><td>${item.level?`<span class="level level-${Math.min(item.level,5)}">Level ${item.level}</span>`:'—'}</td><td>${item.parentEmailDraft?`<button class="text-button" data-email-id="${item.id}">View draft</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`;target.querySelectorAll('[data-action-id]').forEach(input=>input.addEventListener('change',()=>toggleActioned(input.dataset.actionId,input.checked)));target.querySelectorAll('[data-email-id]').forEach(button=>button.addEventListener('click',()=>openEmail(button.dataset.emailId)));}

async function toggleActioned(id,actioned){const currentUser=auth.currentUser||state.user;if(!currentUser){showToast('Your sign-in expired. Please refresh and sign in again.');return;}try{await updateDoc(doc(db,'breaches',id),{actioned,actionedBy:actioned?currentUser.email:null,actionedAt:actioned?Timestamp.now():null});}catch(error){showToast(friendlyError(error));}}
function openEmail(id){const item=state.breaches.find(b=>b.id===id);if(!item)return;const root=document.querySelector('#modal-root');root.innerHTML=`<div class="modal-backdrop"><section class="email-modal" role="dialog" aria-modal="true"><div class="modal-header"><div><p class="eyebrow">Ready to copy</p><h2>Parent/carer email</h2></div><button id="close-modal" aria-label="Close">×</button></div><pre>${escapeHtml(item.parentEmailDraft)}</pre><button class="submit-button" id="copy-email">Copy email draft <span>⧉</span></button></section></div>`;root.querySelector('#close-modal').addEventListener('click',()=>root.innerHTML='');root.querySelector('.modal-backdrop').addEventListener('click',event=>{if(event.target===event.currentTarget)root.innerHTML='';});root.querySelector('#copy-email').addEventListener('click',async()=>{await navigator.clipboard.writeText(item.parentEmailDraft);root.innerHTML='';showToast('Email draft copied to clipboard.');});}
function renderTypeField(){const field=document.querySelector('#type-field');field.innerHTML=state.kind==='uniform'?`Breach type<select id="breach-type" required><option value="">Select type</option>${BREACH_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>`:'Type<input value="Phone use" disabled>';document.querySelector('#submit-breach').innerHTML=`Record ${state.kind} breach <span>→</span>`;}
function setNotice(message){const node=document.querySelector('#form-notice');node.hidden=false;node.textContent=message;}
function showToast(message){const old=document.querySelector('.toast');if(old)old.remove();const toast=document.createElement('div');toast.className='toast';toast.textContent=message;document.body.append(toast);setTimeout(()=>toast.remove(),4500);}
function preferenceKey(uid){return `bayside-register-default-homegroup:${uid}`;}
async function loadDefaultHomegroup(uid){const local=localStorage.getItem(preferenceKey(uid));try{const snapshot=await getDoc(doc(db,'userPreferences',uid));const saved=snapshot.exists()?snapshot.data().defaultHomegroup:local;return saved==='All homegroups'||HOMEGROUPS.includes(saved)?saved:'All homegroups';}catch{return local==='All homegroups'||HOMEGROUPS.includes(local)?local:'All homegroups';}}
async function saveDefaultHomegroup(){const user=auth.currentUser||state.user;if(!user)return;localStorage.setItem(preferenceKey(user.uid),state.group);try{await setDoc(doc(db,'userPreferences',user.uid),{defaultHomegroup:state.group,updatedAt:Timestamp.now()},{merge:true});showToast(`${state.group} will be your default action homegroup on every device.`);}catch(error){showToast(`Saved on this device. ${friendlyError(error)}`);}}
function emptyState(compact){return `<div class="empty ${compact?'compact-empty':''}"><span>✓</span><strong>Nothing waiting here</strong><p>${compact?'New records will appear as staff add them.':'No records match these filters.'}</p></div>`;}
function allowedEmail(email=''){const domain=email.toLowerCase().split('@')[1]||'';return allowedDomains.includes(domain);}
function normaliseName(value){return value.trim().toLowerCase().replace(/\s+/g,' ');}
async function stableKey(value){const bytes=new TextEncoder().encode(normaliseName(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).slice(0,16).map(b=>b.toString(16).padStart(2,'0')).join('');}
function levelFor(dayCount){return dayCount===4?2:dayCount===5?3:dayCount===6?4:dayCount>=7?5:1;}
function buildParentEmail(name,breach,dayCount,level,isNewDay){const first=firstName(name);const messages={1:'',2:`${first} will complete a lunchtime community service or a reflection task.`,3:`${first} will complete a lunchtime community service or reflection task, and a coordinator will discuss correct uniform with ${first}.`,4:`This is a Level 4 response. A coordinator will follow up with the parent/carer, and ${first} will complete two lunchtime community services or an after-school consequence.`,5:'A coordinator will contact you to discuss the next steps.'};return `Subject: Uniform breach – ${name} – Day ${dayCount} this term\n\nDear Parent/Carer,\n\nI am writing to let you know that ${first} was recorded out of uniform today for: ${breach}.\n\n${isNewDay?'This is the':'This is still the'} ${ordinal(dayCount)} separate day this term that ${first} has been recorded out of uniform. ${messages[level]}\n\nPlease support ${first} in attending school in the correct uniform.\n\nPlease contact the school if you have any questions.`;}
function ordinal(n){const words=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];if(words[n])return words[n];const m=n%100;const s=m>=11&&m<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');return `${n}${s}`;}
function melbourneDate(date){return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Australia/Melbourne'}).format(date);}
function toDate(value){return value?.toDate?value.toDate():new Date(value);}
function formatTime(value){return new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(toDate(value));}
function formatDate(value){return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(toDate(value));}
function firstName(name){return String(name||'there').split(/\s+/)[0];}
function initials(name){return String(name||'BC').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();}
function friendlyError(error){console.error(error);const code=error?.code||'';if(code.includes('popup-closed'))return 'Sign-in was cancelled.';if(code.includes('unauthorized-domain'))return 'This GitHub address still needs to be authorised in Firebase.';if(code.includes('permission-denied'))return 'Your account does not have permission to access these records.';return error?.message?.replace(/^Firebase:\s*/,'')||'Something went wrong. Please try again.';}
function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function escapeAttr(value){return escapeHtml(value).replace(/`/g,'&#96;');}
