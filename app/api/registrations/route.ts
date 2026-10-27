import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { registrations } from '@/lib/schema';
import { eq, ilike, asc } from 'drizzle-orm';

export interface RegistrationRecord {
  id: string;
  name: string;
  email: string;
  birthday: string;
  department: string;
  businessUnit: string;
  registeredAt: string;
}

// GET — list all (admin) or lookup by email (public)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get('email');

  // Public email lookup — no auth required
  if (emailParam) {
    const row = await getByEmail(emailParam);
    if (!row) return NextResponse.json({ found: false });
    return NextResponse.json({
      found: true,
      record: { ...row, registeredAt: row.registeredAt.toISOString() },
    });
  }

  // Admin-only full list
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select()
    .from(registrations)
    .orderBy(asc(registrations.registeredAt));

  const records: RegistrationRecord[] = rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    birthday: r.birthday,
    department: r.department,
    businessUnit: r.businessUnit,
    registeredAt: r.registeredAt.toISOString(),
  }));

  return NextResponse.json(records);
}

// GET-by-email — public lookup (used by the registration modal)
// Usage: GET /api/registrations?email=foo@bar.com
async function getByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const rows = await db
    .select()
    .from(registrations)
    .where(ilike(registrations.email, normalizedEmail))
    .limit(1);
  return rows[0] ?? null;
}

// POST — save a new registration (public, called on form submit)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, name, email, birthday, department, businessUnit } = body;

  if (!id || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Prevent duplicate registrations by email
  const existing = await db
    .select()
    .from(registrations)
    .where(ilike(registrations.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    const r = existing[0];
    return NextResponse.json({
      duplicate: true,
      record: { ...r, registeredAt: r.registeredAt.toISOString() },
    });
  }

  const [inserted] = await db
    .insert(registrations)
    .values({
      id,
      name: name || '',
      email: normalizedEmail,
      birthday: birthday || '',
      department: department || '',
      businessUnit: businessUnit || '',
    })
    .returning();

  return NextResponse.json({
    success: true,
    record: { ...inserted, registeredAt: inserted.registeredAt.toISOString() },
  });
}

// DELETE — reset all registrations (admin only)
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await db.delete(registrations);
  return NextResponse.json({ success: true });
}
