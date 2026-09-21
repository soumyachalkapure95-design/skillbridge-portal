import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'

export default function Skills() {
    const { user } = useAuth()
    const [skills, setSkills] = useState([])
    const [userResults, setUserResults] = useState({})
    const [selectedCategory, setSelectedCategory] = useState('All')
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchData()
    }, [user])

    const fetchData = async () => {
        try {
            setLoading(true)
            // 1. Fetch platform skills catalog
            const res = await axios.get(`${API_BASE_URL}/skills`)
            setSkills(res.data?.skills || [])

            // 2. If student, fetch student's verified scores
            if (user?.id) {
                try {
                    const resultsRes = await axios.get(`${API_BASE_URL}/assessment/results/${user.id}`)
                    const results = resultsRes.data?.results || []
                    const scoresMap = {}
                    results.forEach(r => {
                        scoresMap[r.skill_id] = r.score
                    })
                    setUserResults(scoresMap)
                } catch (e) {
                    console.error('Failed to load user results:', e)
                }
            }
        } catch (err) {
            console.error('Error fetching skills data:', err)
        } finally {
            setLoading(false)
        }
    }

    const categories = ['All', 'Programming', 'Frontend', 'Backend', 'Database', 'AI and Data', 'Developer Tools', 'CS Fundamentals', 'Professional Skills']

    const filteredSkills = skills.filter(skill => {
        const matchesCat = selectedCategory === 'All' || skill.category === selectedCategory
        const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (skill.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        return matchesCat && matchesSearch
    })

    const assessedCount = Object.keys(userResults).length
    const avgScore = assessedCount > 0
        ? Math.round(Object.values(userResults).reduce((a, b) => a + b, 0) / assessedCount)
        : 0

    return (
        <main className="app-container">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-student">⚡ Skill Matrix</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• Standardized Assessments</span>
                    </div>
                    <h1 className="dashboard-title">
                        Verified Technical Skill Catalog 📚
                    </h1>
                    <p className="dashboard-subtitle">
                        Select a domain skill to take an AI-rubric assessment, earn verified badges, and boost your job match score.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <Link to="/dashboard" className="btn btn-primary">
                        📊 Dashboard
                    </Link>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid-stats" style={{ marginBottom: '1.75rem' }}>
                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Controlled Skill Catalog</span>
                        <div className="stat-icon">🏷️</div>
                    </div>
                    <div className="stat-value">{skills.length}</div>
                    <div className="stat-subtext">Standardized competencies</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Your Verified Skills</span>
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>✓</div>
                    </div>
                    <div className="stat-value" style={{ color: '#34d399' }}>{assessedCount}</div>
                    <div className="stat-subtext">Recorded in database</div>
                </div>

                <div className="glass-card stat-card">
                    <div className="stat-header">
                        <span>Average Verified Score</span>
                        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>🎯</div>
                    </div>
                    <div className="stat-value" style={{ color: '#38bdf8' }}>{avgScore}%</div>
                    <div className="stat-subtext">Pass threshold: 75%</div>
                </div>
            </div>

            {/* Search and Category Filter Bar */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                    <input
                        type="text"
                        placeholder="🔍 Search skills (e.g. Python, React, Docker, SQL)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ maxWidth: '400px', margin: 0 }}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        Showing <strong>{filteredSkills.length}</strong> of {skills.length} competencies
                    </span>
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            style={{
                                padding: '0.4rem 0.85rem',
                                borderRadius: '9999px',
                                border: '1px solid var(--border-color)',
                                background: selectedCategory === cat ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(15, 23, 42, 0.6)',
                                color: selectedCategory === cat ? '#fff' : 'var(--text-muted)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Skills Grid */}
            {loading ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading technical competencies...
                </div>
            ) : filteredSkills.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No skills matched your search criteria.
                </div>
            ) : (
                <div className="grid-cards">
                    {filteredSkills.map(skill => {
                        const verifiedScore = userResults[skill.id]
                        const isAssessed = verifiedScore !== undefined
                        const isProficient = verifiedScore >= 75

                        return (
                            <div
                                key={skill.id}
                                className="glass-card glass-card-interactive"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    textAlign: 'left',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', fontSize: '0.75rem' }}>
                                            {skill.category}
                                        </span>

                                        {isAssessed && (
                                            <span className={`badge ${isProficient ? 'badge-success' : 'badge-student'}`}>
                                                {isProficient ? '✓ Verified ' : 'Developing '}{verifiedScore}%
                                            </span>
                                        )}
                                    </div>

                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                                        {skill.name}
                                    </h3>

                                    <p style={{
                                        color: 'var(--text-muted)',
                                        fontSize: '0.85rem',
                                        lineHeight: 1.45,
                                        marginBottom: '1rem',
                                        minHeight: '45px',
                                    }}>
                                        {skill.description || 'Core engineering proficiency and problem-solving evaluation.'}
                                    </p>
                                </div>

                                <div>
                                    {isAssessed && (
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.2rem' }}>
                                                <span>Proficiency Score:</span>
                                                <strong style={{ color: isProficient ? '#34d399' : '#38bdf8' }}>{verifiedScore}%</strong>
                                            </div>
                                            <div className="progress-container" style={{ height: '0.35rem' }}>
                                                <div className="progress-bar" style={{
                                                    width: `${verifiedScore}%`,
                                                    background: isProficient ? '#10b981' : '#6366f1'
                                                }} />
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => navigate(`/assessment/${skill.id}`)}
                                        className={`btn ${isAssessed ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                                        style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem' }}
                                    >
                                        {isAssessed ? '🔄 Retake Assessment' : '⚡ Take Assessment'}
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
