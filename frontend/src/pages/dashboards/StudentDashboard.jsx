import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { API_BASE_URL } from '../../config'

export default function StudentDashboard({ user }) {
    const [jobs, setJobs] = useState([])
    const [userSkills, setUserSkills] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchStudentData()
    }, [user])

    const fetchStudentData = async () => {
        try {
            setLoading(true)
            // 1. Fetch real assessment results for this student from backend API
            if (user?.id) {
                try {
                    const skillRes = await axios.get(`${API_BASE_URL}/assessment/results/${user.id}`)
                    const results = skillRes.data?.results || []
                    setUserSkills(results)
                } catch (err) {
                    console.error('Failed to fetch user assessment results from DB:', err)
                    setUserSkills([])
                }
            }

            // 2. Fetch live internships from database
            const jobsRes = await axios.get(`${API_BASE_URL}/internships`)
            const jobsData = jobsRes.data?.internships || jobsRes.data || []
            setJobs(Array.isArray(jobsData) ? jobsData : [])
        } catch (err) {
            console.error('Error fetching student dashboard data:', err)
        } finally {
            setLoading(false)
        }
    }

    // Real skill match calculation against live job required_skills
    const calculateMatch = (job) => {
        if (!userSkills || userSkills.length === 0) return 0

        let required = []
        try {
            if (typeof job.required_skills === 'string') {
                required = JSON.parse(job.required_skills)
            } else if (Array.isArray(job.required_skills)) {
                required = job.required_skills
            }
        } catch {
            required = []
        }

        const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase()
        let matchedCount = 0

        userSkills.forEach(s => {
            const skillName = (s.skill_name || '').toLowerCase()
            if (
                jobText.includes(skillName) ||
                required.some(r => (typeof r === 'string' ? r : r?.name || '').toLowerCase().includes(skillName))
            ) {
                matchedCount++
            }
        })

        if (required.length > 0) {
            return Math.min(100, Math.round((matchedCount / required.length) * 100))
        }

        return Math.min(100, Math.round((matchedCount / userSkills.length) * 100))
    }

    const avgSkillScore = userSkills.length > 0
        ? Math.round(userSkills.reduce((acc, curr) => acc + (curr.score || 0), 0) / userSkills.length)
        : 0

    return (
        <div>
            {/* Top Welcome Banner */}
            <div className="glass-card" style={{
                marginBottom: '2rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.5rem',
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-student">🎓 Student Profile</span>
                        {user?.college && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {user.college}</span>}
                        {user?.branch && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• {user.branch}</span>}
                    </div>
                    <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', textAlign: 'left' }}>
                        Welcome back, {user?.name || user?.full_name || 'Student'}! 🚀
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Live platform tracking your verified assessments and matching with active industry postings.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Link to="/skills" className="btn btn-primary">
                        ⚡ Take Assessment
                    </Link>
                    <Link to="/jobs" className="btn btn-secondary">
                        💼 Browse Live Jobs
                    </Link>
                </div>
            </div>

            {/* Stat Cards - Powered by real DB data */}
            <div className="grid-stats">
                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Verified Skills (DB)</span>
                        <div className="stat-icon">⚡</div>
                    </div>
                    <div className="stat-value">{userSkills.length}</div>
                    <div className="stat-subtext">Completed assessments in SQLite</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Average Verified Score</span>
                        <div className="stat-icon">🎯</div>
                    </div>
                    <div className="stat-value" style={{ color: avgSkillScore >= 75 ? '#34d399' : '#fbbf24' }}>
                        {avgSkillScore}%
                    </div>
                    <div className="stat-subtext">{userSkills.length === 0 ? 'No tests taken yet' : 'Calculated from DB results'}</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Active Job Database</span>
                        <div className="stat-icon">💼</div>
                    </div>
                    <div className="stat-value">{jobs.length}</div>
                    <div className="stat-subtext">Live opportunities in system</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Profile Status</span>
                        <div className="stat-icon">📈</div>
                    </div>
                    <div className="stat-value" style={{ fontSize: '1.25rem', color: userSkills.length > 0 ? '#34d399' : '#f59e0b' }}>
                        {userSkills.length > 0 ? 'Verified' : 'Unassessed'}
                    </div>
                    <div className="stat-subtext">{userSkills.length > 0 ? 'Ready for recruiter discovery' : 'Take tests to verify skills'}</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid-2col">
                {/* Left: Real Jobs from Database */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.25rem', textAlign: 'left' }}>🎯 Live Opportunities (From DB)</h2>
                        <Link to="/jobs" style={{ color: '#06b6d4', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                            View All ({jobs.length}) →
                        </Link>
                    </div>

                    {loading ? (
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Fetching real opportunities from backend...
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No active jobs found in the database.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {jobs.slice(0, 6).map((job, idx) => {
                                const matchScore = calculateMatch(job)
                                return (
                                    <div key={job.id || idx} className="glass-card glass-card-interactive" style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                            <div style={{ textAlign: 'left' }}>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
                                                    {job.title}
                                                </h3>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                                    🏢 {job.company || job.company_name || 'Organization'} • 📍 {job.location || 'Remote'}
                                                </div>
                                            </div>
                                            <div style={{
                                                background: matchScore >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                color: matchScore >= 70 ? '#6ee7b7' : '#fcd34d',
                                                border: `1px solid ${matchScore >= 70 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '0.5rem',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {userSkills.length === 0 ? 'N/A' : `${matchScore}% Match`}
                                            </div>
                                        </div>

                                        <p style={{
                                            color: 'var(--text-muted)',
                                            fontSize: '0.85rem',
                                            margin: '0.5rem 0',
                                            textAlign: 'left',
                                        }}>
                                            {job.description}
                                        </p>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                                                💰 {job.stipend ? `₹${Number(job.stipend).toLocaleString()}/mo` : 'Competitive'}
                                            </span>
                                            <Link to="/jobs" className="btn btn-secondary btn-sm">
                                                View & Apply
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Right: Actual DB Verified Skills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="glass-card" style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.15rem' }}>⚡ Verified Skill Scores</h2>
                            <Link to="/skills" style={{ fontSize: '0.8rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
                                + Take Assessment
                            </Link>
                        </div>

                        {userSkills.length === 0 ? (
                            <div style={{ padding: '1rem 0', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                    No assessments recorded in database yet for this account.
                                </p>
                                <Link to="/skills" className="btn btn-primary btn-sm">
                                    Take Skill Assessment Now
                                </Link>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {userSkills.map((s, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{s.skill_name}</span>
                                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{s.score}%</span>
                                        </div>
                                        <div className="progress-container">
                                            <div className="progress-bar" style={{ width: `${s.score}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* GitHub Code Evidence Card */}
                    <div className="glass-card" style={{
                        textAlign: 'left',
                        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.8) 100%)',
                        borderColor: 'rgba(6, 182, 212, 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>🐙</span>
                                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>GitHub Code Evidence</h2>
                            </div>
                            <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8', fontSize: '0.72rem' }}>
                                Connected
                            </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                            Your repositories and code languages are actively synced for personalized career matching.
                        </p>
                        <Link to="/jobs" className="btn btn-secondary btn-sm" style={{ width: '100%', borderColor: 'rgba(6, 182, 212, 0.4)' }}>
                            💼 Explore Matched Jobs & Internships →
                        </Link>
                    </div>

                    {/* AI Learning Roadmap CTA Card */}
                    <div className="glass-card" style={{ textAlign: 'left', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>🤖</span>
                            <h2 style={{ fontSize: '1.15rem' }}>Personalized Learning Roadmap</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            Analyze your exact skill gaps against target industry tracks and follow milestone-based action paths.
                        </p>
                        <Link to="/learning-path" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                            🚀 Open AI Learning Roadmap
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
