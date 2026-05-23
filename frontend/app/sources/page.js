'use client';
import { useState, useEffect, useCallback } from 'react';
import RoleGuard from '../../components/RoleGuard';
import AppLayout from '../../components/AppLayout';
import api from '../../lib/api';

export default function SourcesPage() {
  const [sources, setSources]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [polling, setPolling]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', url: '', type: 'MOCK' });
  const [formLoading, setFormLoading] = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchSources = useCallback(async () => {
    try {
      const res = await api.get('/api/sources');
      setSources(res.data.sources || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handlePoll = async (source) => {
    setPolling(source.id);
    try {
      await api.post(`/api/sources/${source.id}/poll`);
      showToast(`✅ Polling triggered for ${source.name}`);
      setTimeout(fetchSources, 1500);
    } catch (err) {
      showToast('❌ Failed to trigger poll');
    } finally {
      setPolling(null);
    }
  };

  const handleAddSource = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      await api.post('/api/sources', form);
      setShowForm(false);
      setForm({ name: '', url: '', type: 'MOCK' });
      fetchSources();
      showToast('✅ Source added');
    } catch (err) {
      showToast('❌ Failed to add source');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete source "${name}"?`)) return;
    try {
      await api.delete(`/api/sources/${id}`);
      fetchSources();
      showToast('✅ Source deleted');
    } catch (err) {
      showToast('❌ Failed to delete');
    }
  };

  return (
    <AppLayout>
      <RoleGuard roles={['ADMIN', 'ENGINEER']}>
      <div className="fade-in">
        {toast && <div className={`alert ${toast.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 999, width: 'auto', minWidth: 280 }}>{toast}</div>}

        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">⚡ API Sources</h1>
              <p className="page-subtitle">Manage data ingestion sources · Monitor polling status</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)} id="add-source-btn">
              {showForm ? '✕ Cancel' : '+ Add Source'}
            </button>
          </div>
        </div>

        {/* Info Banners */}
        <div className="info-banner" style={{ marginBottom: '0.75rem' }}>
          <strong>🗄 What are API Sources?</strong><br />
          API Sources are the registered data endpoints that this system polls for network alarms.
          Each source has a <em>type</em> (MOCK = simulated, REST = external HTTP, SNMP = network traps) and a <em>URL</em>.
          The system polls all <code>mock://</code> sources every <strong>10 seconds</strong> automatically and transforms the raw data through the normalization → correlation pipeline.
          You can add new sources (e.g., a real REST endpoint) and they&apos;ll be included in future polling cycles.
        </div>

        <div className="info-banner" style={{ marginBottom: '1.25rem' }}>
          <strong>⚡ What does &quot;Poll Now&quot; do?</strong><br />
          Clicking <em>Poll Now</em> on a source immediately triggers <strong>one full ingestion cycle</strong> for that source: generate/fetch alarms → normalize format → run the 3-rule correlation engine → update site statuses.
          It&apos;s identical to what happens automatically every 10s, but on-demand.
          Use it to see results instantly when testing or demoing.
        </div>

        {/* Pipeline Diagram */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header"><span className="card-title">📊 Ingestion Pipeline</span></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', padding: '1rem 0' }}>
            {[
              { step: '1', label: 'Mock Sources', icon: '📡', color: 'var(--accent-blue)' },
              { arrow: true },
              { step: '2', label: 'Normalization', icon: '🔄', color: 'var(--accent-purple)' },
              { arrow: true },
              { step: '3', label: 'Correlation Engine', icon: '🧠', color: 'var(--critical)' },
              { arrow: true },
              { step: '4', label: 'Presentation', icon: '📺', color: 'var(--ok)' },
            ].map((item, i) =>
              item.arrow ? (
                <span key={i} style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>→</span>
              ) : (
                <div key={i} style={{ textAlign: 'center', background: `${item.color}15`, border: `1px solid ${item.color}33`, borderRadius: 'var(--radius-md)', padding: '0.75rem 1.25rem', minWidth: 120 }}>
                  <div style={{ fontSize: '1.5rem' }}>{item.icon}</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: item.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.25rem' }}>{item.label}</div>
                </div>
              )
            )}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Runs every <strong style={{ color: 'var(--accent-blue)' }}>10 seconds</strong> automatically. Manual polling available below.
          </p>
        </div>

        {/* Add Source Form */}
        {showForm && (
          <div className="card fade-in" style={{ marginBottom: '1.25rem', borderColor: 'var(--accent-blue)' }}>
            <div className="card-header"><span className="card-title">Add New API Source</span></div>
            <form onSubmit={handleAddSource}>
              <div className="grid-3">
                <div className="form-group">
                  <label htmlFor="src-name">Source Name</label>
                  <input id="src-name" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Source C" required />
                </div>
                <div className="form-group">
                  <label htmlFor="src-url">URL / Endpoint</label>
                  <input id="src-url" type="text" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="mock://sourceC" required />
                </div>
                <div className="form-group">
                  <label htmlFor="src-type">Type</label>
                  <select id="src-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="MOCK">MOCK</option>
                    <option value="REST">REST</option>
                    <option value="SNMP">SNMP</option>
                    <option value="KAFKA">KAFKA</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} id="cancel-source">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} id="save-source">{formLoading ? 'Saving…' : 'Add Source'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Sources List */}
        {loading ? (
          <div className="loading-state"><div className="spinner" /></div>
        ) : (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Registered Sources ({sources.length})</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Name</th><th>URL</th><th>Type</th><th>Status</th><th>Last Polled</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sources.map((src) => (
                    <tr key={src.id} id={`source-row-${src.id}`}>
                      <td style={{ fontWeight: 500 }}>{src.name}</td>
                      <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{src.url}</td>
                      <td><span className="badge badge-info">{src.type}</span></td>
                      <td>
                        <span className={`badge ${src.status === 'ACTIVE' ? 'badge-ok' : 'badge-warning'}`}>
                          {src.status === 'ACTIVE' && <span className="pulse-dot" style={{ marginRight: '4px', background: 'var(--ok)', width: 6, height: 6 }} />}
                          {src.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {src.lastPolledAt ? new Date(src.lastPolledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }) : 'Never'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handlePoll(src)} disabled={polling === src.id} id={`poll-${src.id}`}>
                            {polling === src.id ? 'Polling…' : '⚡ Poll Now'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(src.id, src.name)} id={`delete-source-${src.id}`}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </RoleGuard>
    </AppLayout>
  );
}
