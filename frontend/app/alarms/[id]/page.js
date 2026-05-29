'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import RoleGuard from '../../../components/RoleGuard';
import AppLayout from '../../../components/AppLayout';
import AlarmTable from '../../../components/AlarmTable';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../lib/api';
import { ChevronLeft, Zap, MapPin, Building2, Link2, ChevronDown, ChevronUp, Lock, Bot, RefreshCw } from 'lucide-react';

const RULE_LABELS = {
  RULE_1_SAME_SITE_DEVICE:   { label: 'Rule 1 – Same Site & Device within 5 minutes', icon: '📍', color: 'var(--accent-blue)' },
  RULE_2_SITE_WIDE_CRITICAL: { label: 'Rule 2 – Site-Wide Critical/Major within 10 minutes', icon: '🏢', color: 'var(--critical)' },
  RULE_3_STANDALONE:         { label: 'Rule 3 – Standalone Alarm (no group match)', icon: '⚡', color: 'var(--warning)' },
};

/* ── Mock AI summaries based on correlation rule ─────────────────────────── */
function buildMockSummary(event) {
  const device    = event.deviceId || 'unknown device';
  const site      = event.site?.name || 'the affected site';
  const region    = event.site?.region || 'the region';
  const severity  = event.severity || 'CRITICAL';
  const count     = event.alarmIds?.length || 1;
  const layer     = event.networkLayer || 'TRANSPORT';
  const rule      = event.correlationRule;

  const ts = new Date(event.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (rule === 'RULE_1_SAME_SITE_DEVICE') {
    return {
      summary: `Between ${ts} and now, **${count} alarms** have been raised against device **${device}** at **${site}** (${region} Region). All alarms share the same device fingerprint, indicating a persistent or recurring fault rather than a transient spike.`,
      rootCause: `The repeated alarm pattern on a single device strongly suggests a **hardware degradation** or **software fault** on ${device}. Common causes include:\n• Memory leak or process crash causing recurring restarts\n• NIC/port flapping due to faulty SFP module or cable\n• Configuration drift causing repeated authentication failures\n• Thermal throttling due to inadequate cooling at ${site}`,
      nextSteps: [
        `SSH into **${device}** and run \`show log | grep ALARM\` to check recent fault history`,
        `Check device uptime — repeated reboots indicate watchdog or OOM conditions`,
        `Verify physical layer: inspect SFP module health, optical power levels, and cable integrity`,
        `Review configuration changes pushed in the last 2 hours via your NEMS change log`,
        `If no root cause found, schedule maintenance window and hot-swap the line card`,
      ],
      confidence: 91,
      impactLevel: severity === 'CRITICAL' ? 'High' : severity === 'MEDIUM' ? 'Medium' : 'Low',
    };
  }

  if (rule === 'RULE_2_SITE_WIDE_CRITICAL') {
    return {
      summary: `A **site-wide event** has been detected at **${site}** (${region} Region) involving **${count} alarms** across multiple devices within a 10-minute window. This pattern is characteristic of a shared infrastructure failure — power, backhaul, or upstream transport degradation — rather than individual device faults.`,
      rootCause: `Multiple devices failing simultaneously at a single site almost always points to a **common dependency failure**. Most probable causes:\n• **Power event**: UPS switchover failure or mains power fluctuation causing cascaded device restarts\n• **Upstream backhaul loss**: If the ${layer} link to this site is degraded, all dependent nodes will alarm simultaneously\n• **Environmental**: AC failure causing thermal shutdown across co-located equipment\n• **BGP/OSPF route withdrawal**: A routing change upstream triggering mass reachability loss`,
      nextSteps: [
        `Check **power monitoring** at ${site} — verify UPS status and mains supply via site management system`,
        `Ping the **gateway/PE router** for ${site} from NOC — if unreachable, escalate to transport team immediately`,
        `Cross-reference with **weather/environmental alerts** for ${region} (storm, grid outage)`,
        `Review SNMP traps from the site switch/aggregation node for port-down events`,
        `Dispatch field engineer if site is unreachable remotely — this may require physical intervention`,
        `Open a P1 incident ticket if alarm count continues to grow — this qualifies as an outage`,
      ],
      confidence: 87,
      impactLevel: 'High',
    };
  }

  // RULE_3_STANDALONE
  return {
    summary: `A **standalone alarm** was raised by **${device}** at **${site}** (${region} Region). This alarm did not correlate with any other recent events on the same device or site, suggesting it may be an **isolated, transient fault** or an early signal of a developing issue.`,
    rootCause: `Without corroborating alarms, this is likely one of:\n• A **transient fault** (brief packet loss, momentary signal drop) that self-resolved\n• An **early-warning indicator** of degradation that hasn't yet manifested broadly\n• A **misconfigured threshold** producing spurious alarms (false positive)\n• A **test or maintenance action** that briefly triggered the alarm condition`,
    nextSteps: [
      `Monitor **${device}** for the next 15 minutes — if no further alarms, mark as transient and close`,
      `Check current performance counters: BER, packet loss %, and signal strength via your NMS`,
      `Review whether a **maintenance window or configuration push** was active at the time of the alarm`,
      `If alarm recurs within 1 hour, escalate to Rule 1 handling and investigate hardware`,
      `Consider adjusting alarm thresholds if this device is a known false-positive source`,
    ],
    confidence: 74,
    impactLevel: severity === 'CRITICAL' ? 'Medium' : 'Low',
  };
}

/* ── Typewriter hook ─────────────────────────────────────────────────────── */
function useTypewriter(fullText, speed = 18, started = false) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    if (!started || !fullText) return;
    idxRef.current = 0;
    setDisplayed('');
    setDone(false);
    const interval = setInterval(() => {
      idxRef.current += 1;
      setDisplayed(fullText.slice(0, idxRef.current));
      if (idxRef.current >= fullText.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [fullText, started, speed]);

  return { displayed, done };
}

/* ── Render inline markdown-lite (bold, newlines, bullets) ──────────────── */
function MdText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
          : p.split('\n').map((line, j) => (
              <span key={`${i}-${j}`}>
                {j > 0 && <br />}
                {line}
              </span>
            ))
      )}
    </>
  );
}

/* ── AI Panel Component ──────────────────────────────────────────────────── */
function AISummaryPanel({ event, canAccess }) {
  const [phase, setPhase]   = useState('idle'); // idle | thinking | streaming | done | error
  const [summary, setSummary] = useState(null);
  const [streamText, setStreamText] = useState('');
  const streamRef = useRef(null);

  const fullText = summary
    ? `**SUMMARY**\n${summary.summary}\n\n**ROOT CAUSE ANALYSIS**\n${summary.rootCause}\n\n**RECOMMENDED NEXT STEPS**\n${summary.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  const { displayed, done } = useTypewriter(fullText, 12, phase === 'streaming');

  useEffect(() => {
    if (done && phase === 'streaming') setPhase('done');
  }, [done, phase]);

  const handleSummarize = () => {
    if (phase !== 'idle' && phase !== 'error') return;
    setPhase('thinking');
    setSummary(null);
    // Simulate "Claude thinking" delay (1.8s), then stream
    setTimeout(() => {
      setSummary(buildMockSummary(event));
      setPhase('streaming');
    }, 1800);
  };

  const handleReset = () => {
    setPhase('idle');
    setSummary(null);
  };

  if (!canAccess) return null;

  const confColor = summary?.confidence >= 85 ? '#10b981' : summary?.confidence >= 70 ? '#f59e0b' : '#ef4444';
  const impactColor = {
    High: '#ef4444', Medium: '#f97316', Low: '#10b981',
  }[summary?.impactLevel] || '#6b7280';

  return (
    <div className="card fade-in" style={{
      marginBottom: '1.25rem',
      borderColor: phase === 'done' ? 'rgba(99,102,241,0.4)' : phase === 'thinking' || phase === 'streaming' ? 'rgba(99,102,241,0.25)' : 'var(--border-color)',
      background: phase === 'idle' ? 'var(--bg-card)' : 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, var(--bg-card) 100%)',
      transition: 'border-color 0.4s, background 0.4s',
    }}>
      {/* ── Header ── */}
      <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', flexShrink: 0,
            boxShadow: phase !== 'idle' ? '0 0 12px rgba(99,102,241,0.5)' : 'none',
            transition: 'box-shadow 0.4s',
          }}>
            🤖
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              AI Alarm Intelligence
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Powered by Claude (Anthropic) · Agentic Analysis
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {phase === 'done' && (
            <button className="btn btn-secondary btn-sm" onClick={handleReset} id="ai-reset-btn">
              ↺ Re-analyze
            </button>
          )}
          {(phase === 'idle' || phase === 'error') && (
            <button
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
              onClick={handleSummarize}
              id="ai-summarize-btn"
            >
              ✨ Summarize with AI
            </button>
          )}
          {(phase === 'thinking' || phase === 'streaming') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a855f7', fontSize: '0.82rem', fontWeight: 500 }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: '#a855f7', borderTopColor: 'transparent' }} />
              {phase === 'thinking' ? 'Claude is analyzing…' : 'Generating response…'}
            </div>
          )}
        </div>
      </div>

      {/* ── Idle placeholder ── */}
      {phase === 'idle' && (
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem', fontSize: '0.95rem' }}>
            AI-Powered Root Cause Analysis
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Click <strong>Summarize with AI</strong> to get a plain-English explanation of this correlated event,
            a likely root cause, and recommended remediation steps — generated by Claude.
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Root Cause', 'Plain English', 'Next Steps', 'Impact Assessment'].map((tag) => (
              <span key={tag} style={{
                fontSize: '0.72rem', padding: '3px 10px',
                borderRadius: 100, border: '1px solid rgba(99,102,241,0.3)',
                color: '#a78bfa', background: 'rgba(99,102,241,0.08)',
              }}>✓ {tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Thinking skeleton ── */}
      {phase === 'thinking' && (
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '0.6rem', fontWeight: 500 }}>
                Analyzing {event.alarmIds?.length || 0} alarms · Checking correlation patterns · Assessing impact…
              </div>
              {[100, 80, 95, 60].map((w, i) => (
                <div key={i} style={{
                  height: 10, width: `${w}%`, borderRadius: 6, marginBottom: 8,
                  background: 'linear-gradient(90deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.15) 50%, rgba(99,102,241,0.2) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.4s ease-in-out infinite',
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Streaming / Done output ── */}
      {(phase === 'streaming' || phase === 'done') && summary && (
        <div style={{ padding: '1.25rem' }}>
          {/* Confidence + Impact badges */}
          {phase === 'done' && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '4px 12px', borderRadius: 100,
                background: `${confColor}18`, border: `1px solid ${confColor}44`,
                fontSize: '0.75rem', fontWeight: 600, color: confColor,
              }}>
                <span>🎯</span> {summary.confidence}% Confidence
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '4px 12px', borderRadius: 100,
                background: `${impactColor}18`, border: `1px solid ${impactColor}44`,
                fontSize: '0.75rem', fontWeight: 600, color: impactColor,
              }}>
                <span>⚡</span> {summary.impactLevel} Impact
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '4px 12px', borderRadius: 100,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                fontSize: '0.75rem', fontWeight: 600, color: '#a78bfa',
              }}>
                <span>🤖</span> Claude 3.5 Sonnet
              </div>
            </div>
          )}

          {/* Chat bubble with typewriter */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
            }}>🤖</div>
            <div style={{
              flex: 1,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: '0 12px 12px 12px',
              padding: '1rem 1.1rem',
              fontSize: '0.85rem', lineHeight: 1.75,
              color: 'var(--text-secondary)',
              minHeight: 60,
            }}>
              <MdText text={displayed} />
              {phase === 'streaming' && (
                <span style={{
                  display: 'inline-block', width: 2, height: '1em',
                  background: '#a78bfa', marginLeft: 2, verticalAlign: 'text-bottom',
                  animation: 'blink 0.7s steps(1) infinite',
                }} />
              )}
            </div>
          </div>

          {/* Next Steps cards (shown after streaming done) */}
          {phase === 'done' && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                🎯 Recommended Next Steps
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {summary.nextSteps.map((step, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                    padding: '0.6rem 0.9rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    animation: `fadeSlideIn 0.3s ease ${i * 0.08}s both`,
                  }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      color: '#fff', fontWeight: 700, fontSize: '0.7rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <MdText text={step} />
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <div style={{
                marginTop: '1rem', padding: '0.6rem 0.9rem',
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 8, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5,
              }}>
                ⚠️ <strong>AI Disclaimer:</strong> This analysis is generated by an AI model and should be validated by a qualified network engineer before taking action.
                Confidence scores are indicative, not absolute. Always follow your organisation's incident management procedures.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CSS for shimmer + blink + fadeSlideIn ── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function AlarmDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const canSeeRawAlarms = user?.role !== 'VIEWER';
  const canUseAI        = user?.role === 'ADMIN' || user?.role === 'ENGINEER';
  const [event, setEvent]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/api/alarms/correlated/${params.id}`);
        setEvent(res.data.event);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [params.id]);

  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (error)   return <div className="alert alert-error">⚠ {error}</div>;
  if (!event)  return null;

  const rule = RULE_LABELS[event.correlationRule];

  return (
    <AppLayout>
      <RoleGuard module="ALARM" redirect>
      <div className="fade-in">
        {/* Back + Header */}
        <div className="page-header">
          <Link href="/alarms" className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem' }} id="back-to-alarms">
            <ChevronLeft size={14} /> Back to Alarms
          </Link>
          <div className="flex-between">
            <div>
              <h1 className="page-title">
                <span className="page-title-icon"><Zap size={22} /></span>
                Correlated Event
              </h1>
              <p className="page-subtitle mono" style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>{event.groupKey}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className={`badge badge-${event.severity?.toLowerCase()}`}>{event.severity}</span>
              <span className={`badge badge-${event.status?.toLowerCase()}`}>{event.status}</span>
            </div>
          </div>
        </div>

        {/* Correlation Rule Banner */}
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: rule?.color || 'var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>{rule?.icon || '🔗'}</span>
            <div>
              <div style={{ fontWeight: 600, color: rule?.color || 'var(--text-primary)', fontSize: '0.95rem' }}>
                {rule?.label || event.correlationRule}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Correlation Rule Applied
              </div>
            </div>
          </div>
        </div>

        {/* Event Details */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <span className="card-title">Event Details</span>
          </div>
          <div className="detail-grid">
            <div className="detail-item"><label>Group Key</label><div className="value mono">{event.groupKey}</div></div>
            <div className="detail-item"><label>Device</label><div className="value" style={{ color: 'var(--accent-cyan)' }}>{event.deviceId}</div></div>
            <div className="detail-item"><label>Site</label><div className="value">{event.site?.name || event.siteId?.slice(0, 8) + '…'}</div></div>
            <div className="detail-item"><label>Region</label><div className="value">{event.site?.region || '—'}</div></div>
            <div className="detail-item"><label>Start Time</label><div className="value">{new Date(event.startTime).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><label>End Time</label><div className="value">{new Date(event.endTime).toLocaleString('en-IN')}</div></div>
            <div className="detail-item"><label>Duration</label><div className="value">{Math.round((new Date(event.endTime) - new Date(event.startTime)) / 1000)}s</div></div>
            <div className="detail-item"><label>Total Alarms</label><div className="value">{event.alarmIds?.length || 0}</div></div>
          </div>
        </div>

        {/* ── AI Summary Panel ── */}
        <AISummaryPanel event={event} canAccess={canUseAI} />

        {/* Viewer notice */}
        {!canUseAI && (
          <div className="info-banner" style={{ marginBottom: '1.25rem' }}>
            🤖 <strong>AI Analysis</strong> is available to Admin and Engineer roles.
          </div>
        )}

        {/* Raw Alarms Drill-Down — Admin & Engineer only */}
        {canSeeRawAlarms && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Raw Alarms ({event.rawAlarms?.length || 0})</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setExpanded((v) => !v)} id="toggle-raw-alarms">
                {expanded ? <><ChevronUp size={13} /> Collapse</> : <><ChevronDown size={13} /> Expand</>}
              </button>
            </div>
            {expanded && (
              <AlarmTable
                alarms={event.rawAlarms || []}
                emptyMessage="No raw alarms found for this event"
              />
            )}
          </div>
        )}
        {!canSeeRawAlarms && (
          <div className="info-banner" style={{ marginBottom: 0 }}>
            🔒 <strong>Raw alarm data</strong> is restricted to Admin and Engineer roles.
            Contact your administrator to escalate access.
          </div>
        )}
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
