import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'

export default function Jobs() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const [jobs, setJobs] = useState([])
    const [githubProfile, setGithubProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [analyzingGithub, setAnalyzingGithub] = useState(false)
    const [customGithubInput, setCustomGithubInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [filterMatchTier, setFilterMatchTier] = useState('all') // 'all', 'high', 'moderate'
    const [expandedJobId, setExpandedJobId] = useState(null)

    useEffect(() => {
        const initialGithubHandle = user?.github_url || user?.name?.toLowerCase().replace(/\s+/g, '') || 'developer'
        setCustomGithubInput(initialGithubHandle)
        fetchMatchedJobs(initialGithubHandle)
    }, [user])

    const fetchMatchedJobs = async (ghHandle = '') => {
        setLoading(true)
        try {
            const handleToUse = ghHandle || customGithubInput || user?.github_url || 'developer'
            const res = await axios.post(`${API_BASE_URL}/jobs/github-match`, {
                username: handleToUse,
                user_id: user?.id
            })

            if (res.data) {
                setJobs(res.data.jobs || [])
                setGithubProfile(res.data.github_profile || null)
            }
        } catch (err) {
            console.error('Error fetching matched jobs with GitHub:', err)
            // Fallback to standard jobs endpoint
            try {
                const fallbackRes = await axios.get(`${API_BASE_URL}/internships`)
                const fallbackJobs = (fallbackRes.data?.internships || []).map(j => ({
                    ...j,
                    match_score: 75,
                    matched_skills: [],
                    missing_skills: []
                }))
                setJobs(fallbackJobs)
            } catch (e) {
                console.error('Fallback failed:', e)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleSyncGithub = async (e) => {
        e.preventDefault()
        if (!customGithubInput.trim()) return
        setAnalyzingGithub(true)
        try {
            await fetchMatchedJobs(customGithubInput.trim())
        } finally {
            setAnalyzingGithub(false)
        }
    }

    const fetchFreshRemoteJobs = async () => {
        setLoading(true)
        try {
            await axios.get(`${API_BASE_URL}/jobs/fetch/remotive`)
            await fetchMatchedJobs(customGithubInput)
            alert('✅ Live industry jobs fetched from Remotive API and matched with your profile!')
        } catch (err) {
            console.error('Failed to fetch fresh remote jobs:', err)
            alert('Failed to refresh external jobs.')
            setLoading(false)
        }
    }

    // Filter and search logic
    const filteredJobs = jobs.filter(job => {
        const matchesSearch =
            job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            job.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            job.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (job.required_skills || []).some(s => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(searchQuery.toLowerCase()))

        if (!matchesSearch) return false

        if (filterMatchTier === 'high') return job.match_score >= 80
        if (filterMatchTier === 'moderate') return job.match_score >= 60 && job.match_score < 80
        return true
    })

    const getMatchColor = (score) => {
        if (score >= 80) return '#10b981' // Emerald
        if (score >= 60) return '#06b6d4' // Cyan
        if (score >= 45) return '#f59e0b' // Amber
        return '#94a3b8' // Slate
    }

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1240px', margin: '0 auto' }}>
            {/* Header Banner */}
            <div className="glass-card" style={{
                marginBottom: '1.75rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem'
            }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span className="badge badge-student">💼 Intelligent Career Match</span>
                        <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8' }}>
                            🐙 GitHub + ⚡ Proctored Telemetry
                        </span>
                    </div>
                    <h1 style={{ fontSize: '1.85rem', margin: '0 0 0.4rem 0' }}>
                        GitHub-Powered Career & Internship Matches 🎯
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, maxWidth: '720px', lineHeight: 1.5 }}>
                        Jobs are matched by analyzing your real GitHub code repositories, proctored assessment scores, and required tech stacks.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={fetchFreshRemoteJobs}
                        disabled={loading}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        <span>🔄</span>
                        <span>Fetch Fresh Live Jobs</span>
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn btn-secondary btn-sm"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* GitHub Profile Connector & Real-Time Repo Analysis Bar */}
            <div className="glass-card" style={{
                marginBottom: '1.75rem',
                padding: '1.25rem 1.5rem',
                background: 'rgba(15, 23, 42, 0.75)',
                borderColor: 'rgba(99, 102, 241, 0.25)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1.25rem'
                }}>
                    {/* Left: Input Form to Connect or Change GitHub Profile */}
                    <form onSubmit={handleSyncGithub} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.4rem' }}>🐙</span>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>Connected GitHub:</span>
                        </div>
                        <input
                            type="text"
                            value={customGithubInput}
                            onChange={(e) => setCustomGithubInput(e.target.value)}
                            placeholder="Enter GitHub username (e.g. torvalds)"
                            className="form-input"
                            style={{
                                width: '220px',
                                padding: '0.45rem 0.75rem',
                                fontSize: '0.88rem',
                                background: 'rgba(30, 41, 59, 0.8)'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={analyzingGithub || loading}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                        >
                            {analyzingGithub ? 'Analyzing Repos...' : '⚡ Re-Analyze & Match'}
                        </button>
                    </form>

                    {/* Right: Analyzed Profile Stats Chips */}
                    {githubProfile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <div style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.8rem',
                                color: '#a5b4fc',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                <span>📦</span>
                                <span><strong>{githubProfile.public_repos}</strong> Repositories</span>
                            </div>

                            <div style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.8rem',
                                color: '#fbbf24',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                <span>⭐</span>
                                <span><strong>{githubProfile.total_stars}</strong> Stars</span>
                            </div>

                            {githubProfile.languages && githubProfile.languages.length > 0 && (
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.8rem',
                                    color: '#34d399',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}>
                                    <span>💻</span>
                                    <span>Top: <strong>{githubProfile.languages.slice(0, 2).map(l => l.language).join(', ')}</strong></span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setFilterMatchTier('all')}
                        className={`btn btn-sm ${filterMatchTier === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        All Opportunities ({jobs.length})
                    </button>
                    <button
                        onClick={() => setFilterMatchTier('high')}
                        className={`btn btn-sm ${filterMatchTier === 'high' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                            background: filterMatchTier === 'high' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined
                        }}
                    >
                        ⚡ High Match (80%+) ({jobs.filter(j => j.match_score >= 80).length})
                    </button>
                    <button
                        onClick={() => setFilterMatchTier('moderate')}
                        className={`btn btn-sm ${filterMatchTier === 'moderate' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        🎯 Moderate Match (60-79%) ({jobs.filter(j => j.match_score >= 60 && j.match_score < 80).length})
                    </button>
                </div>

                <div style={{ width: '280px' }}>
                    <input
                        type="text"
                        placeholder="Search by role, company, skill..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ width: '100%', padding: '0.45rem 0.85rem', fontSize: '0.88rem' }}
                    />
                </div>
            </div>

            {/* Job Opportunities Grid */}
            {loading ? (
                <div className="glass-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        border: '3px solid rgba(99, 102, 241, 0.3)',
                        borderTop: '3px solid #818cf8',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem auto'
                    }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Matching jobs with your GitHub repositories and verified test scores...
                    </p>
                </div>
            ) : filteredJobs.length === 0 ? (
                <div className="glass-card" style={{ padding: '3.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>No matching job postings found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto 1.5rem auto' }}>
                        Try adjusting your search query or refreshing live postings from the Remotive API.
                    </p>
                    <button onClick={fetchFreshRemoteJobs} className="btn btn-primary btn-sm">
                        🔄 Fetch Fresh Remote Jobs
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {filteredJobs.map((job) => {
                        const matchColor = getMatchColor(job.match_score)
                        const isExpanded = expandedJobId === job.id

                        return (
                            <div
                                key={job.id}
                                className="glass-card glass-card-interactive"
                                style={{
                                    padding: '1.5rem',
                                    borderLeft: `4px solid ${matchColor}`,
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    flexWrap: 'wrap',
                                    gap: '1rem'
                                }}>
                                    {/* Left: Job Info */}
                                    <div style={{ flex: '1 1 500px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                                            <h2 style={{ fontSize: '1.3rem', margin: 0, color: '#fff', fontWeight: 700 }}>
                                                {job.title}
                                            </h2>
                                            {job.is_live && (
                                                <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8', fontSize: '0.72rem' }}>
                                                    🌐 Live External Job
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.88rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                                            <span>🏢 <strong>{job.company || 'Enterprise Partner'}</strong></span>
                                            <span>📍 {job.location || 'Remote'}</span>
                                            <span>💰 {job.stipend ? `₹${Number(job.stipend).toLocaleString()}/mo` : 'Competitive'}</span>
                                            {job.type && <span style={{ textTransform: 'capitalize' }}>• {job.type}</span>}
                                        </div>

                                        {/* Matched Skills Pills with Evidence Badges */}
                                        {job.matched_skills && job.matched_skills.length > 0 && (
                                            <div style={{ marginBottom: '0.85rem' }}>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.35rem', fontWeight: 600 }}>
                                                    VERIFIED SKILL OVERLAP:
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                                    {job.matched_skills.map((s, idx) => (
                                                        <span
                                                            key={idx}
                                                            style={{
                                                                background: s.is_verified ? 'rgba(16, 185, 129, 0.18)' : 'rgba(99, 102, 241, 0.18)',
                                                                color: s.is_verified ? '#34d399' : '#a5b4fc',
                                                                border: s.is_verified ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(99, 102, 241, 0.35)',
                                                                padding: '0.25rem 0.65rem',
                                                                borderRadius: '0.45rem',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 600,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.35rem'
                                                            }}
                                                            title={s.sources?.join(' • ')}
                                                        >
                                                            <span>{s.is_verified ? '⚡' : '🐙'}</span>
                                                            <span>{s.skill_name}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* GitHub Evidence Repos */}
                                        {job.github_evidence_repos && job.github_evidence_repos.length > 0 && (
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: '#a5b4fc',
                                                background: 'rgba(99, 102, 241, 0.08)',
                                                padding: '0.4rem 0.75rem',
                                                borderRadius: '0.4rem',
                                                marginBottom: '0.85rem',
                                                border: '1px dashed rgba(99, 102, 241, 0.25)'
                                            }}>
                                                🐙 <strong>Verified in GitHub Repos:</strong> {job.github_evidence_repos.join(', ')}
                                            </div>
                                        )}

                                        {/* Actionable Learning Path Recommendation */}
                                        {job.learning_recommendation && (
                                            <div style={{
                                                fontSize: '0.82rem',
                                                color: '#fef08a',
                                                background: 'rgba(234, 179, 8, 0.1)',
                                                padding: '0.5rem 0.85rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '0.5rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span>💡</span>
                                                    <span>{job.learning_recommendation}</span>
                                                </div>
                                                <Link
                                                    to="/learning-path"
                                                    style={{
                                                        color: '#38bdf8',
                                                        fontWeight: 700,
                                                        textDecoration: 'none',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    View AI Roadmap →
                                                </Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Match Score Gauge & Quick Actions */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: '150px',
                                        padding: '0.75rem 1.25rem',
                                        background: 'rgba(15, 23, 42, 0.65)',
                                        borderRadius: '0.75rem',
                                        border: `1px solid ${matchColor}44`,
                                        textAlign: 'center'
                                    }}>
                                        <div style={{
                                            fontSize: '2.2rem',
                                            fontWeight: 900,
                                            color: matchColor,
                                            lineHeight: 1
                                        }}>
                                            {job.match_score}%
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.35rem', fontWeight: 600 }}>
                                            Profile Match
                                        </div>
                                        <div style={{
                                            fontSize: '0.68rem',
                                            color: 'var(--text-muted)',
                                            marginTop: '0.2rem'
                                        }}>
                                            Code + Exam Score
                                        </div>

                                        <div style={{ width: '100%', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {job.external_url ? (
                                                <a
                                                    href={job.external_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-primary btn-sm"
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'center',
                                                        textDecoration: 'none',
                                                        background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)'
                                                    }}
                                                >
                                                    Apply Direct 🚀
                                                </a>
                                            ) : (
                                                <button
                                                    onClick={() => alert(`Application recorded for ${job.title} at ${job.company}!`)}
                                                    className="btn btn-primary btn-sm"
                                                    style={{ width: '100%' }}
                                                >
                                                    Apply via Portal 🚀
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                                                className="btn btn-secondary btn-sm"
                                                style={{ width: '100%', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                                            >
                                                {isExpanded ? 'Hide Details' : 'View Description'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expandable Description */}
                                {isExpanded && (
                                    <div style={{
                                        marginTop: '1.25rem',
                                        paddingTop: '1.25rem',
                                        borderTop: '1px solid var(--border-color)',
                                        fontSize: '0.9rem',
                                        lineHeight: 1.6,
                                        color: '#cbd5e1'
                                    }}>
                                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff' }}>Role Description & Responsibilities:</h4>
                                        <p style={{ whiteSpace: 'pre-line', margin: 0 }}>
                                            {job.description || 'No detailed description provided by recruiter.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}