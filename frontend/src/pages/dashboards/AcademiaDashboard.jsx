import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

export default function AcademiaDashboard({ user }) {
    const [analytics, setAnalytics] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAcademiaAnalytics()
    }, [user])

    const fetchAcademiaAnalytics = async () => {
        try {
            setLoading(true)
            const res = await axios.get(`${API_BASE_URL}/academia/analytics`)
            setAnalytics(res.data)
        } catch (err) {
            console.error('Error fetching academia analytics from DB:', err)
        } finally {
            setLoading(false)
        }
    }

    const skillGaps = analytics?.skill_gap_analysis || []

    return (
        <div>
            {/* Header Banner */}
            <div className="glass-card" style={{
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-academia">🏛️ Faculty Portal</span>
                        {user?.institution && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {user.institution}</span>}
                        {user?.department && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {user.department}</span>}
                    </div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', textAlign: 'left' }}>
                        Institutional Analytics & Outcomes 📊
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Live analytics aggregated directly from student assessments and active industry job requirements in the database.
                    </p>
                </div>
            </div>

            {/* Metric Cards - Real SQL aggregates */}
            <div className="grid-stats">
                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Enrolled Students (DB)</span>
                        <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>🎓</div>
                    </div>
                    <div className="stat-value">{analytics?.total_enrolled_students ?? 0}</div>
                    <div className="stat-subtext">Registered student accounts</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Total Assessments (DB)</span>
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>📈</div>
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>{analytics?.total_assessments_taken ?? 0}</div>
                    <div className="stat-subtext">Tests recorded in SQLite</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Cohort Average Score</span>
                        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>🎯</div>
                    </div>
                    <div className="stat-value" style={{ color: '#38bdf8' }}>{analytics?.cohort_average_score ?? 0}%</div>
                    <div className="stat-subtext">Across all student tests</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Placement Readiness</span>
                        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>📊</div>
                    </div>
                    <div className="stat-value" style={{ color: '#fbbf24' }}>{analytics?.readiness_rate ?? '0%'}</div>
                    <div className="stat-subtext">Students with score &gt;= 70%</div>
                </div>
            </div>

            {/* Live Cross-Referenced Skill Gap Table */}
            <div className="glass-card" style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>⚡ Real Skill Gap Analysis (DB Cross-Reference)</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Calculated by comparing actual student average test scores with required skills extracted from active job postings in the database.
                    </p>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Computing real analytics from database...</p>
                ) : skillGaps.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No skill gap data available. Students need to take assessments to generate gap telemetry.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {skillGaps.map((item, idx) => (
                            <div key={idx} style={{
                                padding: '1rem',
                                background: 'rgba(15, 23, 42, 0.5)',
                                borderRadius: '0.625rem',
                                border: '1px solid var(--border-color)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>{item.skill_name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>({item.category})</span>
                                    </div>
                                    <span className={`badge ${item.gap > 25 ? 'badge-admin' : item.cohort_average_score >= 70 ? 'badge-success' : 'badge-student'}`}>
                                        {item.gap > 25 ? 'High Gap' : item.cohort_average_score >= 70 ? 'Proficient' : 'Moderate'}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Student Cohort Average:</span>
                                            <span style={{ color: '#818cf8', fontWeight: 700 }}>{item.cohort_average_score}% ({item.students_tested} tested)</span>
                                        </div>
                                        <div className="progress-container">
                                            <div className="progress-bar" style={{ width: `${item.cohort_average_score}%`, background: '#818cf8' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Live Job Demand Frequency:</span>
                                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{item.industry_demand_percentage}%</span>
                                        </div>
                                        <div className="progress-container">
                                            <div className="progress-bar" style={{ width: `${item.industry_demand_percentage}%`, background: '#38bdf8' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
