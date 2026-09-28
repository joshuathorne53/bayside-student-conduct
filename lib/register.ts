import { env } from 'cloudflare:workers';

export type Breach = {
  id: string; recordNumber: number; kind: 'uniform' | 'phone'; occurredAt: string;
  studentName: string; homegroup: string; breachType: string; notes: string;
  enteredBy: string; dayCount: number | null; level: number | null;
  parentEmailDraft: string | null; actioned: boolean;
  actionedBy: string | null; actionedAt: string | null;
};

export type RegisterData = {
  breaches: Breach[];
  students: { name: string; homegroup: string }[];
  breachTypes: string[];
};

const HOMEGROUPS = ['7A','7B','8A','8B','9A','9B','9C','10A','10B','11A','11B','12A','12B','Unsorted'];

function db() {
  if (!env.DB) throw new Error('The register database is unavailable.');
  return env.DB;
}

export async function ensureDatabase() {
  const d1 = db();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, homegroup TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS breach_types (
      id TEXT PRIMARY KEY, label TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS breaches (
      id TEXT PRIMARY KEY, record_number INTEGER NOT NULL, kind TEXT NOT NULL,
      occurred_at TEXT NOT NULL, occurrence_date TEXT NOT NULL,
      student_name TEXT NOT NULL, homegroup TEXT NOT NULL, breach_type TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '', entered_by TEXT NOT NULL,
      day_count INTEGER, level INTEGER, parent_email_draft TEXT,
      actioned INTEGER NOT NULL DEFAULT 0, actioned_by TEXT, actioned_at TEXT
    )`),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_breaches_student_date ON breaches(student_name, occurrence_date)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_breaches_homegroup_actioned ON breaches(homegroup, actioned)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_breaches_occurred_at ON breaches(occurred_at)'),
  ]);

  const defaults = ['Incorrect shoes','Missing blazer','Incorrect shirt or polo','Non-uniform jumper','Jewellery','Other uniform breach'];
  await d1.batch(defaults.map((label, index) => d1.prepare(
    'INSERT OR IGNORE INTO breach_types (id, label, active) VALUES (?, ?, 1)'
  ).bind(`uniform-${index + 1}`, label)));
}

export async function getRegisterData(): Promise<RegisterData> {
  await ensureDatabase();
  const d1 = db();
  const [breachesResult, studentsResult, typesResult] = await Promise.all([
    d1.prepare(`SELECT id, record_number, kind, occurred_at, student_name, homegroup,
      breach_type, notes, entered_by, day_count, level, parent_email_draft,
      actioned, actioned_by, actioned_at FROM breaches ORDER BY occurred_at DESC LIMIT 200`).all(),
    d1.prepare('SELECT name, homegroup FROM students WHERE active = 1 ORDER BY name').all(),
    d1.prepare('SELECT label FROM breach_types WHERE active = 1 ORDER BY label').all(),
  ]);
  return {
    breaches: (breachesResult.results as Record<string, unknown>[]).map(rowToBreach),
    students: breachesResult.success ? studentsResult.results as { name: string; homegroup: string }[] : [],
    breachTypes: (typesResult.results as { label: string }[]).map(row => row.label),
  };
}

export async function createBreach(input: {
  kind: 'uniform' | 'phone'; studentName: string; homegroup: string;
  breachType?: string; notes?: string; enteredBy: string;
}): Promise<Breach> {
  await ensureDatabase();
  const studentName = clean(input.studentName);
  const homegroup = HOMEGROUPS.includes(clean(input.homegroup)) ? clean(input.homegroup) : 'Unsorted';
  const breachType = input.kind === 'phone' ? 'Phone use' : clean(input.breachType);
  if (!studentName || !breachType) throw new Error('Student and breach type are required.');

  const d1 = db();
  const now = new Date();
  const occurredAt = now.toISOString();
  const occurrenceDate = new Intl.DateTimeFormat('en-CA', { timeZone:'Australia/Melbourne', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  let dayCount: number | null = null;
  let level: number | null = null;
  let parentEmailDraft: string | null = null;

  if (input.kind === 'uniform') {
    const days = await d1.prepare(`SELECT COUNT(DISTINCT occurrence_date) AS count FROM breaches
      WHERE kind = 'uniform' AND lower(student_name) = lower(?)`).bind(studentName).first<{ count: number }>();
    const alreadyToday = await d1.prepare(`SELECT 1 AS found FROM breaches WHERE kind = 'uniform'
      AND lower(student_name) = lower(?) AND occurrence_date = ? LIMIT 1`).bind(studentName, occurrenceDate).first();
    dayCount = Number(days?.count ?? 0) + (alreadyToday ? 0 : 1);
    level = dayCount === 4 ? 2 : dayCount === 5 ? 3 : dayCount === 6 ? 4 : dayCount >= 7 ? 5 : 1;
    parentEmailDraft = buildParentEmail(studentName, breachType, dayCount, level, !alreadyToday);
  }

  const next = await d1.prepare('SELECT COALESCE(MAX(record_number), 0) + 1 AS next FROM breaches').first<{ next: number }>();
  const id = crypto.randomUUID();
  await d1.prepare(`INSERT INTO breaches (
    id, record_number, kind, occurred_at, occurrence_date, student_name, homegroup,
    breach_type, notes, entered_by, day_count, level, parent_email_draft, actioned
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).bind(
    id, Number(next?.next ?? 1), input.kind, occurredAt, occurrenceDate, studentName,
    homegroup, breachType, clean(input.notes), input.enteredBy, dayCount, level, parentEmailDraft
  ).run();
  const row = await d1.prepare(`SELECT id, record_number, kind, occurred_at, student_name,
    homegroup, breach_type, notes, entered_by, day_count, level, parent_email_draft,
    actioned, actioned_by, actioned_at FROM breaches WHERE id = ?`).bind(id).first<Record<string, unknown>>();
  if (!row) throw new Error('The breach could not be saved.');
  return rowToBreach(row);
}

export async function setActioned(id: string, actioned: boolean, userEmail: string): Promise<void> {
  await ensureDatabase();
  const result = await db().prepare('UPDATE breaches SET actioned = ?, actioned_by = ?, actioned_at = ? WHERE id = ?')
    .bind(actioned ? 1 : 0, actioned ? userEmail : null, actioned ? new Date().toISOString() : null, id).run();
  if (!result.meta.changes) throw new Error('Breach record not found.');
}

function rowToBreach(row: Record<string, unknown>): Breach {
  return {
    id:String(row.id), recordNumber:Number(row.record_number), kind:row.kind as 'uniform'|'phone',
    occurredAt:String(row.occurred_at), studentName:String(row.student_name), homegroup:String(row.homegroup),
    breachType:String(row.breach_type), notes:String(row.notes ?? ''), enteredBy:String(row.entered_by),
    dayCount:row.day_count == null ? null : Number(row.day_count), level:row.level == null ? null : Number(row.level),
    parentEmailDraft:row.parent_email_draft == null ? null : String(row.parent_email_draft),
    actioned:Boolean(row.actioned), actionedBy:row.actioned_by == null ? null : String(row.actioned_by),
    actionedAt:row.actioned_at == null ? null : String(row.actioned_at),
  };
}

function buildParentEmail(name: string, breach: string, dayCount: number, level: number, isNewDay: boolean) {
  const firstName = name.split(/\s+/)[0] || name;
  const daySentence = `${isNewDay ? 'This is the' : 'This is still the'} ${ordinalDay(dayCount)} separate day this term that ${firstName} has been recorded out of uniform.`;
  const messages: Record<number,string> = {
    1:'', 2:`${firstName} will complete a lunchtime community service or a reflection task.`,
    3:`${firstName} will complete a lunchtime community service or reflection task, and a coordinator will discuss correct uniform with ${firstName}.`,
    4:`This is a Level 4 response. A coordinator will follow up with the parent/carer, and ${firstName} will complete two lunchtime community services or an after-school consequence.`,
    5:'A coordinator will contact you to discuss the next steps.',
  };
  return `Subject: Uniform breach – ${name} – Day ${dayCount} this term\n\nDear Parent/Carer,\n\nI am writing to let you know that ${firstName} was recorded out of uniform today for: ${breach}.\n\n${daySentence} ${messages[level]}\n\nPlease support ${firstName} in attending school in the correct uniform.\n\nPlease contact the school if you have any questions.`;
}

function ordinalDay(n:number) {
  const words = ['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
  if (words[n]) return words[n];
  const mod100=n%100; const suffix=mod100>=11&&mod100<=13?'th':({1:'st',2:'nd',3:'rd'} as Record<number,string>)[n%10]||'th';
  return `${n}${suffix}`;
}

function clean(value: unknown) { return String(value ?? '').trim(); }
