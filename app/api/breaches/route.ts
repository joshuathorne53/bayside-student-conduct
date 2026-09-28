import { NextResponse } from 'next/server';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { createBreach, setActioned } from '@/lib/register';

function authorised(email:string){ return email.toLowerCase().endsWith('@bayside.edu.vic.au') || email.toLowerCase().endsWith('@sites.test'); }

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user||!authorised(user.email)) return NextResponse.json({error:'Bayside staff sign-in required.'},{status:403});
  try { const body=await request.json(); const breach=await createBreach({...body,enteredBy:user.email}); return NextResponse.json({breach},{status:201}); }
  catch(error){ return NextResponse.json({error:error instanceof Error?error.message:'Could not save the breach.'},{status:400}); }
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();
  if(!user||!authorised(user.email)) return NextResponse.json({error:'Bayside staff sign-in required.'},{status:403});
  try { const body=await request.json() as {id?:string;actioned?:boolean}; if(!body.id||typeof body.actioned!=='boolean') throw new Error('Invalid action update.'); await setActioned(body.id,body.actioned,user.email); return NextResponse.json({ok:true}); }
  catch(error){ return NextResponse.json({error:error instanceof Error?error.message:'Could not update the breach.'},{status:400}); }
}
