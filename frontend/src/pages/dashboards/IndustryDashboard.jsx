import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

export default function IndustryDashboard({ user }) {
    const [jobs, setJobs] = useState([])
    const [candidates, setCandidates] = useState([])
    const [loading, setLoading] = useState(true)
    const [showPostModal, setShowPostModal] = useState(false)
    const [newJob, setNewJob] = useState({
        title: '',
        company_name: user?.company || '',
        description: '',
        required_skills: '',
        stipend: 25000,
        location: 'Remote',
        type: 'internship'
    })
    const [posting, setPosting] = useState(false)

    useEffect(() => {
        fetchIndustryData()
    }, [user])

    const fetchIndustryData = async () => {
        try {
            setLoading(true)
            // 1. Fetch real verified candidates queried directly from backend User & AssessmentResult tables
            const candRes = await axios.get(`${API_BASE_URL}/industry/candidates`)
            setCandidates(candRes.data?.candidates || [])

            // 2. Fetch real active jobs from DB
            const jobsRes = await axios.get(`${API_BASE_URL}/internships`)
            const jobsData = jobsRes.data?.internships || jobsRes.data || []
            setJobs(Array.isArray(jobsData) ? jobsData : [])
        } catch (err) {
            console.error('Error fetching industry dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateJob = async (e) => {
        e.preventDefault()
        setPosting(true)
        try {
            const skillsArray = newJob.required_skills.split(',').map(s => s.trim()).filter(Boolean)
            await axios.post(`${API_BASE_URL}/internships`, {
                title: newJob.title,
                company_name: newJob.company_name || user?.company || 'Industry Partner',
                description: newJob.description,
                required_skills: JSON.stringify(skillsArray),
                stipend: Number(newJob.stipend),
                location: newJob.location,
                type: newJob.type
            })
            alert('Job/Challenge posted successfully into database!')
            setShowPostModal(false)
            setNewJob({
                title: '',
                company_name: user?.company || '',
                description: '',
                required_skills: '',
                stipend: 25000,
                location: 'Remote',
                type: 'internship'
            })
            fetchIndustryData()
        } catch (err) {
            alert('Failed to post job: ' + (err.response?.data?.detail || err.message))
        } finally {
            setPosting(false)
        }
    }

    const verifiedCount = candidates.filter(c => c.assessments_count > 0).length

    return (
        <div>
            {/* Header Banner */}
            <div className="glass-card" style={{
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)',
                borderColor: 'rgba(6, 182, 212, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-industry">🏢 Industry Portal</span>
                        {user?.company && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {user.company}</span>}
                        {user?.designation && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {user.designation}</span>}
                    </div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', textAlign: 'left' }}>
                        Recruiter Talent & Challenge Portal 🎯
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        View registered student candidates with their actual verified scores from database assessments.
                    </p>
                </div>
                <button
                    onClick={() => setShowPostModal(true)}
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)' }}
                >
                    ➕ Post New Job / Challenge
                </button>
            </div>

            {/* Metric Cards - Direct from DB queries */}
            <div className="grid-stats">
                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Active Postings (DB)</span>
                        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>💼</div>
                    </div>
                    <div className="stat-value">{jobs.length}</div>
                    <div className="stat-subtext">Postings stored in database</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Registered Students (DB)</span>
                        <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>👥</div>
                    </div>
                    <div className="stat-value">{candidates.length}</div>
                    <div className="stat-subtext">Live student accounts in system</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Assessed Candidates</span>
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>⚡</div>
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>{verifiedCount}</div>
                    <div className="stat-subtext">Students with test records</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Pipeline Ready</span>
                        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>📈</div>
                    </div>
                    <div className="stat-value" style={{ color: '#fbbf24' }}>
                        {candidates.filter(c => c.average_score >= 70).length}
                    </div>
                    <div className="stat-subtext">Score &gt;= 70% in assessments</div>
                </div>
            </div>

            {/* Main Content: Real Candidate Talent Pool */}
            <div className="grid-2col">
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', textAlign: 'left' }}>🌟 Registered Student Candidates (Live DB)</h2>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{candidates.length} Total</span>
                    </div>

                    {loading ? (
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Fetching candidate records from database...
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No student accounts registered in the database yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {candidates.map((c) => (
                                <div key={c.id} className="glass-card glass-card-interactive" style={{ padding: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{c.full_name}</h3>
                                                {c.assessments_count > 0 ? (
                                                    <>
                                                        <span className="badge badge-success">✓ Verified {c.average_score}%</span>
                                                        <span className="badge" style={{
                                                            background: c.proctoring_status === 'Flagged' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                            color: c.proctoring_status === 'Flagged' ? '#f87171' : '#34d399',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)'
                                                        }}>
                                                            🛡️ {c.integrity_score}% Integrity ({c.proctoring_status})
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>Unassessed</span>
                                                )}
                                            </div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0' }}>
                                                🎓 {c.college} • {c.branch} (Year {c.year}) • CGPA: {c.cgpa}
                                            </div>
                                        </div>
                                        <div style={{
                                            background: 'rgba(99, 102, 241, 0.15)',
                                            color: '#a5b4fc',
                                            border: '1px solid rgba(99, 102, 241, 0.3)',
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: '0.5rem',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                        }}>
                                            {c.readiness}
                                        </div>
                                    </div>

                                    {/* Verified Skills from DB */}
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
                                        {c.verified_skills.length === 0 ? (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No assessments taken yet</span>
                                        ) : (
                                            c.verified_skills.map((s, i) => (
                                                <span key={i} style={{
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '0.4rem',
                                                    fontSize: '0.75rem',
                                                    color: '#cbd5e1',
                                                    border: '1px solid var(--border-color)',
                                                }}>
                                                    ⚡ {s.skill_name}: {s.score}%
                                                </span>
                                            ))
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => alert(`Candidate Contact: ${c.email}`)}>
                                            📧 Contact Candidate
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Active Postings from DB */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="glass-card" style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.15rem' }}>📋 Live Postings in DB</h2>
                            <button
                                onClick={() => setShowPostModal(true)}
                                style={{ background: 'none', border: 'none', color: '#06b6d4', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                            >
                                + New
                            </button>
                        </div>

                        {loading ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading postings...</p>
                        ) : jobs.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No postings in DB. Click above to post your first opportunity.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {jobs.slice(0, 5).map((j, idx) => (
                                    <div key={j.id || idx} style={{
                                        padding: '0.75rem',
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        borderRadius: '0.5rem',
                                        border: '1px solid var(--border-color)',
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{j.title}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                            <span>📍 {j.location || 'Remote'}</span>
                                            <span>💰 {j.stipend ? `₹${Number(j.stipend).toLocaleString()}/mo` : 'Competitive'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Post Job Modal */}
            {showPostModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    padding: '1rem',
                }}>
                    <div className="glass-card" style={{
                        maxWidth: '550px',
                        width: '100%',
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>➕ Post New Opportunity to DB</h2>
                            <button
                                onClick={() => setShowPostModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateJob}>
                            <div className="form-group">
                                <label className="form-label">Job / Challenge Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Backend Engineer Intern (FastAPI & SQL)"
                                    value={newJob.title}
                                    onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Company Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Acme Tech Solutions"
                                    value={newJob.company_name}
                                    onChange={(e) => setNewJob({ ...newJob, company_name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Required Skills (comma-separated)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Python, FastAPI, React, SQL"
                                    value={newJob.required_skills}
                                    onChange={(e) => setNewJob({ ...newJob, required_skills: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Monthly Stipend (₹)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={newJob.stipend}
                                        onChange={(e) => setNewJob({ ...newJob, stipend: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newJob.location}
                                        onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role Description</label>
                                <textarea
                                    className="form-textarea"
                                    rows="4"
                                    placeholder="Outline requirements and responsibilities..."
                                    value={newJob.description}
                                    onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowPostModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={posting}
                                >
                                    {posting ? 'Saving to Database...' : '🚀 Publish to DB'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
