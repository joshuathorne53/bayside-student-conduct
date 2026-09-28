import Dashboard from './dashboard';
import { chatGPTSignOutPath, requireChatGPTUser } from './chatgpt-auth';
import { getRegisterData } from '@/lib/register';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireChatGPTUser('/');
  const allowed = user.email.toLowerCase().endsWith('@bayside.edu.vic.au') || user.email.toLowerCase().endsWith('@sites.test');
  if (!allowed) return <main className="access-page"><section><span className="brand-mark">B</span><p className="eyebrow">Bayside College</p><h1>Staff access only</h1><p>Sign in with your <strong>@bayside.edu.vic.au</strong> account to use the Student Conduct Register.</p><a className="primary-button" href={chatGPTSignOutPath('/')}>Use another account</a></section></main>;
  const data = await getRegisterData();
  return <Dashboard initialData={data} user={{email:user.email,name:user.fullName||user.email.split('@')[0],signOut:chatGPTSignOutPath('/')}}/>;
}
