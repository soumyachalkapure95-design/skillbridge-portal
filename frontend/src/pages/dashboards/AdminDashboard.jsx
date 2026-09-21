import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

export default function AdminDashboard({ user }) {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAdminStats()
    }, [user])

    const fetchAdminStats = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_BASE_URL}/admin/stats`)
            setStats(res.data)
        } catch (err) {
            console.error('Error fetching admin stats from DB:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            {/* Header Banner */}
            <div className="glass-card" style={{
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)',
                borderColor: 'rgba(244, 63, 94, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-admin">🛡️ Administrator Console</span>
                    </div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', textAlign: 'left' }}>
                        SkillBridge Control Center ⚙️
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Live platform health and real record counts queried directly from the SQLite database.
                    </p>
                </div>
                <button
                    onClick={fetchAdminStats}
                    className="btn btn-secondary"
                >
                    🔄 Refresh Real-time Stats
                </button>
            </div>

            {/* Metrics - Direct SQL Counts */}
            <div className="grid-stats">
                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Students in DB</span>
                        <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>🎓</div>
                    </div>
                    <div className="stat-value">{stats?.students_count ?? 0}</div>
                    <div className="stat-subtext">SELECT WHERE role='student'</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Industry Accounts</span>
                        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>🏢</div>
                    </div>
                    <div className="stat-value">{stats?.industry_count ?? 0}</div>
                    <div className="stat-subtext">SELECT WHERE role='industry'</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Academia Accounts</span>
                        <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>🏛️</div>
                    </div>
                    <div className="stat-value">{stats?.academia_count ?? 0}</div>
                    <div className="stat-subtext">SELECT WHERE role='academia'</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Assessments in DB</span>
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>⚡</div>
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>{stats?.assessments_count ?? 0}</div>
                    <div className="stat-subtext">Completed assessment records</div>
                </div>
            </div>

            {/* System Status & Moderation */}
            <div className="grid-2col">
                <div className="glass-card" style={{ textAlign: 'left' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>📡 Database & API Telemetry</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem' }}>
                            <span>Active Job Records in DB</span>
                            <span style={{ fontWeight: 700, color: '#38bdf8' }}>{stats?.jobs_count ?? 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem' }}>
                            <span>Controlled Skills in Catalog</span>
                            <span style={{ fontWeight: 700, color: '#818cf8' }}>{stats?.skills_count ?? 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem' }}>
                            <span>Database Engine</span>
                            <span className="badge badge-success">SQLite (skillbridge.db)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '0.5rem' }}>
                            <span>FastAPI REST Server</span>
                            <span className="badge badge-success">Online (Port 8000)</span>
                        </div>
                    </div>
                </div>

                <div className="glass-card" style={{ textAlign: 'left' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>⚡ Platform Actions</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ justifyContent: 'flex-start' }}
                            onClick={async () => {
                                try {
                                    const r = await axios.post(`${API_BASE_URL}/skills/seed-catalog`)
                                    alert(`Catalog Seeded: ${r.data.message} (${r.data.added} added, ${r.data.skipped_existing} existing)`)
                                    fetchAdminStats()
                                } catch (e) {
                                    alert('Failed to seed catalog: ' + e.message)
                                }
                            }}
                        >
                            🏷️ Seed / Verify Skill Catalog
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
