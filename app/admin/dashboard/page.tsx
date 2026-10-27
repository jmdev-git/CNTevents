'use client';

import { useEffect, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import Topbar from '../../components/Topbar';

const BUSINESS_UNITS = [
  'All Units',
  'CNT Group',
  'CNT Promo Ads & Specialists',
  'CNT International',
  'Lyfe Marketing',
  'LYFE Land',
  'Frontier',
  'Synergy',
  'Framoto Philippines Inc.',
];

interface RegistrationRecord {
  id: string;
  name: string;
  email: string;
  birthday: string;
  department: string;
  businessUnit: string;
  registeredAt: string;
}

interface AttendanceRecord {
  id: string;
  registrationId: string;
  name: string;
  email: string;
  birthday: string;
  department: string;
  businessUnit: string;
  scannedAt: string;
}

type Tab = 'registrations' | 'attendance' | 'allowedEmails';

export default function DashboardPage() {
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  // initialLoading is true only on the very first load — never set back to true after that
  const [initialLoading, setInitialLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('registrations');
  const [selectedUnit, setSelectedUnit] = useState('All Units');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Allowed emails state
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  // emailsInitialLoading is true only before the first fetch of allowed emails
  const [emailsInitialLoading, setEmailsInitialLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [regRes, attRes] = await Promise.all([
        fetch('/api/registrations'),
        fetch('/api/attendance'),
      ]);
      // Only update state if the response is valid — never wipe existing data on error
      if (regRes.ok) {
        const data = await regRes.json();
        if (Array.isArray(data)) setRegistrations(data);
      }
      if (attRes.ok) {
        const data = await attRes.json();
        if (Array.isArray(data)) setAttendance(data);
      }
      setLastRefresh(new Date());
    } catch { /* ignore — keep existing data on network error */ }
    finally { setInitialLoading(false); }
  }, []);

  // Fetch once on mount — NO auto-refresh interval (was causing flicker every 15s)
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchAllowedEmails = useCallback(async () => {
    // Do NOT set a loading flag that clears the list — just silently update in background
    try {
      const res = await fetch('/api/allowed-emails');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setAllowedEmails(data);
      }
    } catch { /* ignore — keep existing data */ }
    finally { setEmailsInitialLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'allowedEmails') fetchAllowedEmails();
  }, [tab, fetchAllowedEmails]);

  async function handleAddEmail() {
    setAddError('');
    setImportStatus('');
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError('Invalid email address.');
      return;
    }
    const res = await fetch('/api/allowed-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: [email] }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.duplicates === 1) {
        setAddError(`"${email}" is already in the list.`);
      } else {
        setNewEmail('');
        setImportStatus(`✓ "${email}" added successfully.`);
        fetchAllowedEmails();
      }
    }
  }

  async function handleDeleteEmail(email: string) {
    await fetch('/api/allowed-emails', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    fetchAllowedEmails();
  }

  async function handleDeleteAll() {
    if (!confirm(`Delete all ${allowedEmails.length} allowed emails? This cannot be undone.`)) return;
    await fetch('/api/allowed-emails', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true }),
    });
    setImportStatus('');
    setAddError('');
    fetchAllowedEmails();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('');
    setAddError('');

    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = async (ev) => {
      let emails: string[] = [];

      if (isExcel) {
        // Parse Excel with xlsx
        const { read, utils } = await import('xlsx');
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        // Scan every sheet, every cell for anything that looks like an email
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows: string[][] = utils.sheet_to_json(sheet, { header: 1, raw: false });
          for (const row of rows) {
            for (const cell of row) {
              const val = String(cell ?? '').trim().toLowerCase();
              if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) emails.push(val);
            }
          }
        }
      } else {
        // Plain text / CSV
        const text = ev.target?.result as string;
        emails = text
          .split(/[\n,;\r]+/)
          .map(s => s.trim().toLowerCase())
          .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      }

      if (emails.length === 0) {
        setImportStatus('No valid emails found in file.');
        return;
      }

      const res = await fetch('/api/allowed-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      if (res.ok) {
        const data = await res.json();
        const parts = [`✓ ${data.added} new email(s) added. Total: ${data.total}.`];
        if (data.duplicates > 0) parts.push(`${data.duplicates} already existed (skipped).`);
        setImportStatus(parts.join(' '));
        fetchAllowedEmails();
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = '';
  }

  // Attendance emails for quick lookup
  const attendedEmails = new Set(attendance.map(a => a.email.toLowerCase()));

  // Filter helpers
  const filteredRegs = selectedUnit === 'All Units'
    ? registrations
    : registrations.filter(r => r.businessUnit === selectedUnit);

  const filteredAtt = selectedUnit === 'All Units'
    ? attendance
    : attendance.filter(r => r.businessUnit === selectedUnit);

  // Breakdown by unit (registrations)
  const byUnit: Record<string, { registered: number; attended: number }> = {};
  registrations.forEach(r => {
    const u = r.businessUnit || 'Unknown';
    if (!byUnit[u]) byUnit[u] = { registered: 0, attended: 0 };
    byUnit[u].registered++;
    if (attendedEmails.has(r.email.toLowerCase())) byUnit[u].attended++;
  });

  const tabStyle = (t: Tab) => ({
    padding: '8px 20px',
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--red)' : '2px solid transparent',
    background: 'none',
    color: tab === t ? 'var(--ink)' : 'var(--muted)',
    fontWeight: tab === t ? 600 : 400,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Topbar
        tag="Admin"
        actions={
          <>
            <Link href="/admin/scanner" className="topbar-btn">Scanner</Link>
            <button className="topbar-btn" onClick={() => signOut({ callbackUrl: '/admin/login' })}>Sign Out</button>
          </>
        }
      />

      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 32px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--red)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              Attendance Dashboard
            </p>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: '0.04em', color: 'var(--ink)', lineHeight: 1 }}>
              Official Launch of Pulse 2.0 &amp; the New CNT Official Website
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
              October 28, 2026 · 5:00 PM · 7th Floor
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lastRefresh && (
              <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace" }}>
                {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchAll}
              style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: 'pointer', color: 'var(--ink)', letterSpacing: '0.06em' }}
            >
              ↻ Refresh
            </button>
            <button
              onClick={async () => {
                if (!confirm('Reset ALL attendance check-ins? This cannot be undone.')) return;
                await fetch('/api/attendance', { method: 'DELETE' });
                fetchAll();
              }}
              style={{ background: 'var(--white)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: 'pointer', color: 'var(--muted)', letterSpacing: '0.06em' }}
            >
              ✕ Reset Check-ins
            </button>
            <button
              onClick={async () => {
                if (!confirm('Reset ALL registrations AND check-ins? This cannot be undone.')) return;
                await Promise.all([
                  fetch('/api/registrations', { method: 'DELETE' }),
                  fetch('/api/attendance', { method: 'DELETE' }),
                ]);
                fetchAll();
              }}
              style={{ background: 'var(--red)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: 'pointer', color: '#fff', letterSpacing: '0.06em' }}
            >
              ✕ Reset All Registrations
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Registered</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: 'var(--ink)', lineHeight: 1 }}>{initialLoading ? '—' : registrations.length}</p>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Checked In</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: 'var(--red)', lineHeight: 1 }}>{initialLoading ? '—' : attendance.length}</p>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Not Yet In</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: 'var(--ink)', lineHeight: 1 }}>
              {initialLoading ? '—' : Math.max(0, registrations.length - attendance.length)}
            </p>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Business Units</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: 'var(--ink)', lineHeight: 1 }}>{initialLoading ? '—' : Object.keys(byUnit).length}</p>
          </div>
        </div>

        {/* Business unit breakdown */}
        {Object.keys(byUnit).length > 0 && (
          <div className="card" style={{ marginBottom: 28 }}>
            <div className="card-header">
              <div className="card-header-left">
                <span className="card-header-title">By Business Unit</span>
              </div>
              <span className="card-header-badge">BREAKDOWN</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {Object.entries(byUnit).sort((a, b) => b[1].registered - a[1].registered).map(([unit, counts]) => (
                <button
                  key={unit}
                  onClick={() => setSelectedUnit(selectedUnit === unit ? 'All Units' : unit)}
                  style={{
                    background: selectedUnit === unit ? 'var(--ink)' : 'var(--bg)',
                    borderRadius: 8, padding: '12px 14px',
                    border: selectedUnit === unit ? '0.5px solid var(--ink)' : '0.5px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  }}
                >
                  <p style={{ fontSize: 10, color: selectedUnit === unit ? 'rgba(255,255,255,0.5)' : 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {unit}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: selectedUnit === unit ? '#fff' : 'var(--ink)', lineHeight: 1 }}>
                      {counts.attended}
                    </span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: selectedUnit === unit ? 'rgba(255,255,255,0.4)' : 'var(--muted)' }}>
                      / {counts.registered}
                    </span>
                  </div>
                  <p style={{ fontSize: 9, color: selectedUnit === unit ? 'rgba(255,255,255,0.35)' : 'var(--muted)', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    checked in / registered
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs + filter */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', paddingRight: 18 }}>
            <div style={{ display: 'flex' }}>
              <button style={tabStyle('registrations')} onClick={() => setTab('registrations')}>
                Registrations ({filteredRegs.length})
              </button>
              <button style={tabStyle('attendance')} onClick={() => setTab('attendance')}>
                Checked In ({filteredAtt.length})
              </button>
              <button style={tabStyle('allowedEmails')} onClick={() => setTab('allowedEmails')}>
                Allowed Emails ({allowedEmails.length})
              </button>
            </div>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              style={{
                background: 'var(--bg)', border: '0.5px solid var(--border)',
                color: 'var(--ink)', borderRadius: 4, padding: '4px 10px',
                fontSize: 11, fontFamily: "'DM Mono', monospace",
                cursor: 'pointer', outline: 'none',
              }}
            >
              {BUSINESS_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {initialLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                // Loading...
              </div>
            ) : tab === 'allowedEmails' ? (
              <div style={{ padding: 24 }}>
                {/* Import + Add row */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Import file */}
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--ink)', color: '#fff', borderRadius: 6,
                    padding: '8px 16px', fontSize: 11, fontFamily: "'DM Mono', monospace",
                    cursor: 'pointer', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>
                    ↑ Import Excel / CSV
                    <input
                      type="file" accept=".xlsx,.xls,.csv,.txt,text/plain,text/csv"
                      style={{ display: 'none' }}
                      onChange={handleImportFile}
                    />
                  </label>

                  {/* Delete All */}
                  {allowedEmails.length > 0 && (
                    <button
                      onClick={handleDeleteAll}
                      style={{
                        background: 'none', border: '0.5px solid var(--red)',
                        color: 'var(--red)', borderRadius: 6, padding: '8px 16px',
                        fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                        letterSpacing: '0.06em', whiteSpace: 'nowrap',
                      }}
                    >
                      ✕ Delete All ({allowedEmails.length})
                    </button>
                  )}

                  {/* Manual add */}
                  <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 260 }}>
                    <input
                      type="email"
                      placeholder="Add single email..."
                      value={newEmail}
                      onChange={e => { setNewEmail(e.target.value); setAddError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 12,
                        fontFamily: "'DM Mono', monospace",
                        border: addError ? '1px solid var(--red)' : '0.5px solid var(--border)',
                        borderRadius: 6, background: 'var(--bg)', color: 'var(--ink)', outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleAddEmail}
                      style={{
                        background: 'var(--red)', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '8px 16px', fontSize: 11,
                        fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                        letterSpacing: '0.06em', whiteSpace: 'nowrap',
                      }}
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {addError && (
                  <p style={{ fontSize: 11, color: 'var(--red)', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
                    // {addError}
                  </p>
                )}
                {importStatus && (
                  <p style={{ fontSize: 11, color: '#00a050', fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>
                    // {importStatus}
                  </p>
                )}

                <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'DM Mono', monospace", marginBottom: 14, letterSpacing: '0.06em' }}>
                  TOTAL: {allowedEmails.length} EMAIL{allowedEmails.length !== 1 ? 'S' : ''} — only these addresses can register.
                </p>

                {/* Show spinner only on the very first load of this tab, keep data visible on re-fetches */}
                {emailsInitialLoading ? (
                  <div style={{ color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>// Loading...</div>
                ) : allowedEmails.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>// No allowed emails yet.</div>
                ) : (
                  <div style={{ maxHeight: 420, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '8px 14px', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border)' }}>#</th>
                          <th style={{ padding: '8px 14px', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border)' }}>Email</th>
                          <th style={{ padding: '8px 14px', textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border)' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allowedEmails.map((email, i) => (
                          <tr key={email} style={{ borderBottom: '0.5px solid var(--border)', background: i % 2 === 0 ? 'var(--white)' : 'var(--bg)' }}>
                            <td style={{ padding: '8px 14px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{i + 1}</td>
                            <td style={{ padding: '8px 14px', color: 'var(--ink)', fontFamily: "'DM Mono', monospace" }}>{email}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleDeleteEmail(email)}
                                style={{
                                  background: 'none', border: '0.5px solid var(--border)',
                                  color: 'var(--muted)', borderRadius: 4, padding: '3px 10px',
                                  fontSize: 10, fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : tab === 'registrations' ? (
              filteredRegs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                  // No registrations yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      {['#', 'Name', 'Email', 'Birthday', 'Department', 'Business Unit', 'Status', 'Registered At'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredRegs].reverse().map((r, i) => {
                      const hasAttended = attendedEmails.has(r.email.toLowerCase());
                      const d = new Date(r.registeredAt);
                      return (
                        <tr key={r.id} style={{ borderBottom: '0.5px solid var(--border)', background: i % 2 === 0 ? 'var(--white)' : 'var(--bg)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{filteredRegs.length - i}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{r.email}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: 'nowrap' }}>
                            {r.birthday ? new Date(r.birthday + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.department || '—'}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ background: 'var(--red-light)', color: 'var(--red-deeper)', fontSize: 11, padding: '2px 8px', borderRadius: 3, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
                              {r.businessUnit || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{
                              fontSize: 10, padding: '3px 8px', borderRadius: 3,
                              fontFamily: "'DM Mono', monospace", fontWeight: 700, whiteSpace: 'nowrap',
                              background: hasAttended ? 'rgba(0,180,80,0.1)' : 'rgba(237,150,0,0.1)',
                              color: hasAttended ? '#00a050' : '#b07000',
                              border: `0.5px solid ${hasAttended ? 'rgba(0,180,80,0.3)' : 'rgba(237,150,0,0.3)'}`,
                            }}>
                              {hasAttended ? '✓ Checked In' : '⏳ Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 11, whiteSpace: 'nowrap' }}>
                            {d.toLocaleDateString([], { month: 'short', day: 'numeric' })} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : (
              filteredAtt.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                  {attendance.length === 0 ? '// No check-ins recorded yet.' : `// No check-ins for ${selectedUnit}.`}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                      {['#', 'Name', 'Email', 'Birthday', 'Department', 'Business Unit', 'Date', 'Time'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredAtt].reverse().map((r, i) => {
                      const d = new Date(r.scannedAt);
                      return (
                        <tr key={r.id} style={{ borderBottom: '0.5px solid var(--border)', background: i % 2 === 0 ? 'var(--white)' : 'var(--bg)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{filteredAtt.length - i}</td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.name || '—'}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{r.email}</td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: 'nowrap' }}>
                            {r.birthday ? new Date(r.birthday + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.department || '—'}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{ background: 'var(--red-light)', color: 'var(--red-deeper)', fontSize: 11, padding: '2px 8px', borderRadius: 3, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' }}>
                              {r.businessUnit || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)', fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: 'nowrap' }}>
                            {d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--red)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                            {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
