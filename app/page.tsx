'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Topbar from './components/Topbar';

const RegistrationModal = dynamic(() => import('./components/RegistrationModal'), { ssr: false });

const STORAGE_KEY_EMAIL = 'cnt_pulse_my_email_2026_aha';
const STORAGE_VERSION_KEY = 'cnt_pulse_storage_version';
const STORAGE_VERSION = 'v2'; // bump this any time you want to force-clear all users

// ── Single source of truth for event details ──
export const EVENT_INFO = {
  title: 'Official Launch of Pulse 2.0 & the New CNT Official Website',
  date: 'October 28, 2026',
  dateShort: 'October 28, 2026 · 5:00 PM',
  time: '5:00 PM',
  venue: '7th Floor',
  audience: 'CNT Employees and Management',
};

export default function EventRegistrationPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'register' | 'view'>('register');
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  useEffect(() => {
    // Force-clear old localStorage if version doesn't match
    try {
      if (localStorage.getItem(STORAGE_VERSION_KEY) !== STORAGE_VERSION) {
        localStorage.clear();
        localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      }
    } catch { /* ignore */ }

    const myEmail = localStorage.getItem(STORAGE_KEY_EMAIL);
    if (!myEmail) return;
    // Verify against DB — don't trust localStorage alone
    fetch(`/api/registrations?email=${encodeURIComponent(myEmail)}`)
      .then(r => r.json())
      .then(data => { if (data.found) setRegisteredEmail(myEmail); })
      .catch(() => { /* ignore */ });
  }, []);

  function openRegister() {
    setModalMode('register');
    setModalOpen(true);
  }

  function openViewQR() {
    setModalMode('view');
    setModalOpen(true);
  }

  function handleRegistered(email: string) {
    setRegisteredEmail(email);
  }

  return (
    <>
      <Topbar
        tag="Corporate Events"
        rightLabel="Event Registration"
        actions={<a href="/admin/login" className="topbar-btn">Admin</a>}
      />

      {/* HERO */}
      <section className="hero">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-inner">
          <div>
            <div className="event-type-pill">Official Launch Event</div>
            <h1>Official Launch of<br /><span>Pulse 2.0</span> &amp; the New<br /><span>CNT Official Website</span></h1>
            <p className="hero-subtitle">
              One connected workplace. A new digital front door for CNT.
            </p>
            <div className="hero-meta">
              <div className="hero-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ed1c24" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              {EVENT_INFO.dateShort}
              </div>
              <div className="hero-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ed1c24" strokeWidth="2" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {EVENT_INFO.venue}
              </div>
              <div className="hero-meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ed1c24" strokeWidth="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
                {EVENT_INFO.audience}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT */}
      <div className="content-area">
        {/* Left: About */}
        <div>
          <p className="section-eyebrow">About This Event</p>
          <p className="about-text">
            Energy. Movement. Progress.
          </p>
          <p className="about-text">
            CNT is taking its next big step in digital transformation, and this time we&apos;re launching two things together.
          </p>
          <p className="about-text">
            <strong>Pulse 2.0</strong> is the next version of CNT&apos;s digital workspace. It&apos;s built around our people and teams,
            and it brings communication, collaboration, and day-to-day work into one connected workplace.
          </p>
          <p className="about-text">
            Also launching: <strong>The New CNT Official Website</strong>, a fresh face for CNT that tells our story and carries our
            mission of &ldquo;A Million Jobs for a Million Filipinos&rdquo; to clients, partners, and future team members.
          </p>
          <p className="about-text">
            This event is our official launch of both platforms. Join us as we introduce what&apos;s new, walk through the
            experience, and mark a milestone in how CNT works, connects, and grows as one organization.
          </p>
          <blockquote className="highlight-quote">
            People. Teams. Growth.<br />
            One connected workplace.<br />
            One stronger, more unified CNT.
          </blockquote>
          <p className="about-text" style={{ marginTop: 8 }}>
            Connect. Collaborate. Achieve. See you there. 🚀
          </p>
        </div>

        {/* Right: Event Card */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-header-left">
                <div className="heart-rate" style={{ width: 50, height: 22 }}>
                  <svg version="1.0" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="50px" height="22px" viewBox="0 0 150 73" xmlSpace="preserve">
                    <polyline fill="none" stroke="#ed1c24" strokeWidth="3" strokeMiterlimit="10" points="0,45.486 38.514,45.486 44.595,33.324 50.676,45.486 57.771,45.486 62.838,55.622 71.959,9 80.067,63.729 84.122,45.486 97.297,45.486 103.379,40.419 110.473,45.486 150,45.486" />
                  </svg>
                  <div className="fade-in"></div>
                  <div className="fade-out"></div>
                </div>
                <span className="card-header-title">Event Details</span>
              </div>
              <span className="card-header-badge">PULSE</span>
            </div>
            <div className="card-body">
              <div className="detail-row">
                <span className="detail-label">Event</span>
                <span className="detail-value">{EVENT_INFO.title}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date</span>
                <span className="detail-value">{EVENT_INFO.date}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Time</span>
                <span className="detail-value">{EVENT_INFO.time}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Venue</span>
                <span className="detail-value">{EVENT_INFO.venue}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Attendance</span>
                <span className="detail-value detail-value-red">Required — All Employees</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Check-in</span>
                <span className="detail-value">QR Code at Gate</span>
              </div>

              {!registeredEmail ? (
                <button className="register-btn" onClick={openRegister}>
                  Register &amp; Get QR Code
                </button>
              ) : (
                <>
                  <button className="register-btn outline" onClick={openViewQR}>
                    View My QR Code
                  </button>
                  <div className="already-banner" role="status">
                    <strong>Already Registered</strong>
                    <span>{registeredEmail}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--white)', borderRadius: 8, border: '0.5px solid var(--border)', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            <strong style={{ display: 'block', color: 'var(--ink)', marginBottom: 3, fontSize: 13 }}>QR Notice</strong>
            Your QR code will be scanned at the event entrance. Present it on your phone or as a printout. Powered by CNT Pulse 2.0.
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <RegistrationModal
          mode={modalMode}
          onClose={() => setModalOpen(false)}
          onRegistered={handleRegistered}
        />
      )}
    </>
  );
}
