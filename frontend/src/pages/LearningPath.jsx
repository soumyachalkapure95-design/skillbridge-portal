import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'

export default function LearningPath() {
    const { user } = useAuth()
    const [roles, setRoles] = useState([])
    const [selectedRole, setSelectedRole] = useState('full-stack')
    const [gapAnalysis, setGapAnalysis] = useState(null)
    const [roadmap, setRoadmap] = useState(null)
    const [loading, setLoading] = useState(true)
    const [savingMilestone, setSavingMilestone] = useState(null)

    useEffect(() => {
        fetchRolesAndInitialData()
    }, [user])

    const fetchRolesAndInitialData = async () => {
        try {
            setLoading(true)
            // 1. Fetch available career roles
            const rolesRes = await axios.get(`${API_BASE_URL}/learning-paths/roles`)
            const availableRoles = rolesRes.data?.roles || []
            setRoles(availableRoles)

            // 2. Fetch student's saved target role from DB
            let activeRole = 'full-stack'
            if (user?.id) {
                try {
                    const progRes = await axios.get(`${API_BASE_URL}/learning-paths/progress/${user.id}`)
                    if (progRes.data?.target_role) {
                        activeRole = progRes.data.target_role
                    }
                } catch (e) {
                    console.error('Failed to load user progress record:', e)
                }
            }
            setSelectedRole(activeRole)
            await loadRoleAnalysisAndRoadmap(activeRole)
        } catch (err) {
            console.error('Error loading learning path data:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadRoleAnalysisAndRoadmap = async (roleId) => {
        if (!user?.id) return
        try {
            setLoading(true)
            // Call skill gap analyzer endpoint
            const analyzeRes = await axios.post(`${API_BASE_URL}/learning-paths/analyze`, {
                user_id: user.id,
                role_id: roleId
            })
            setGapAnalysis(analyzeRes.data)

            // Call roadmap generator endpoint
            const roadmapRes = await axios.post(`${API_BASE_URL}/learning-paths/generate`, {
                user_id: user.id,
                role_id: roleId
            })
            setRoadmap(roadmapRes.data)
        } catch (err) {
            console.error('Failed to compute gap analysis or roadmap:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (roleId) => {
        setSelectedRole(roleId)
        await loadRoleAnalysisAndRoadmap(roleId)
    }

    const toggleMilestone = async (milestoneId, currentStatus) => {
        if (!user?.id) return
        setSavingMilestone(milestoneId)
        const newStatus = !currentStatus
        try {
            await axios.post(`${API_BASE_URL}/learning-paths/progress`, {
                user_id: user.id,
                target_role: selectedRole,
                milestone_id: milestoneId,
                completed: newStatus
            })

            // Update local state
            setRoadmap(prev => {
                if (!prev) return prev
                const updated = prev.milestones.map(m => {
                    if (m.id === milestoneId) {
                        return { ...m, is_completed: newStatus, status: newStatus ? 'Completed' : (m.current_score > 0 ? 'In Progress' : 'Pending') }
                    }
                    return m
                })
                return {
                    ...prev,
                    completed_count: updated.filter(m => m.is_completed).length,
                    milestones: updated
                }
            })
        } catch (err) {
            alert('Failed to save milestone progress: ' + err.message)
        } finally {
            setSavingMilestone(null)
        }
    }

    const readinessScore = gapAnalysis?.overall_readiness_percentage ?? 0

    return (
        <main className="app-container">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <span className="badge badge-student">🤖 AI Career Navigator</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>• Dynamic Roadmap Engine</span>
                    </div>
                    <h1 className="dashboard-title">
                        Personalized AI Skill Gap & Learning Roadmap 🗺️
                    </h1>
                    <p className="dashboard-subtitle">
                        Compare your real database assessment scores with industry benchmarks to follow a milestone-based roadmap.
                    </p>
                </div>
            </div>

            {/* Target Role Selector */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.2rem', textAlign: 'left' }}>🎯 Select Your Target Career Role</h2>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {roles.length} Industry Tracks Available
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                }}>
                    {roles.map(r => {
                        const isSelected = selectedRole === r.id
                        return (
                            <div
                                key={r.id}
                                onClick={() => handleRoleChange(r.id)}
                                className="glass-card glass-card-interactive"
                                style={{
                                    cursor: 'pointer',
                                    padding: '1.25rem',
                                    textAlign: 'left',
                                    border: isSelected ? '2px solid #6366f1' : '1px solid var(--border-color)',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-card)',
                                    boxShadow: isSelected ? '0 8px 24px rgba(99, 102, 241, 0.35)' : 'none',
                                }}
                            >
                                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{r.icon}</div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: isSelected ? '#fff' : '#cbd5e1', marginBottom: '0.25rem' }}>
                                    {r.title}
                                </h3>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                                    {r.description}
                                </p>
                                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(255, 255, 255, 0.08)' }}>
                                        {r.required_skills?.length || 0} Required Skills
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {loading ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Computing AI skill gap and generating personalized milestones...
                </div>
            ) : (
                <>
                    {/* Skill Gap Analysis Overview */}
                    <div className="glass-card" style={{ marginBottom: '2rem', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <span className="badge badge-student">Role Evaluation</span>
                                <h2 style={{ fontSize: '1.4rem', margin: '0.35rem 0' }}>
                                    {gapAnalysis?.role_title} • Readiness Score
                                </h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Evaluated against verified scores from your completed assessments in the database.
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                background: 'rgba(15, 23, 42, 0.6)',
                                padding: '0.85rem 1.25rem',
                                borderRadius: '0.75rem',
                                border: '1px solid var(--border-color)',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Overall Readiness</div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: readinessScore >= 75 ? '#34d399' : readinessScore >= 45 ? '#38bdf8' : '#fbbf24' }}>
                                        {readinessScore}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skill Breakdown Chips / Table */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {gapAnalysis?.skill_breakdown?.map((item, idx) => {
                                const isProficient = item.status === 'Proficient'
                                const isDeveloping = item.status === 'Developing'
                                return (
                                    <div key={idx} style={{
                                        padding: '1rem',
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        borderRadius: '0.75rem',
                                        border: '1px solid var(--border-color)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{item.skill_name}</span>
                                            <span className={`badge ${isProficient ? 'badge-success' : isDeveloping ? 'badge-student' : 'badge-admin'}`}>
                                                {item.status}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                            <span>Your Score: <strong style={{ color: item.current_score > 0 ? '#38bdf8' : '#94a3b8' }}>{item.current_score}%</strong></span>
                                            <span>Target: <strong>{item.benchmark_score}%</strong></span>
                                        </div>

                                        <div className="progress-container">
                                            <div className="progress-bar" style={{
                                                width: `${Math.min(100, Math.round((item.current_score / item.benchmark_score) * 100))}%`,
                                                background: isProficient ? '#10b981' : isDeveloping ? '#6366f1' : '#f43f5e'
                                            }} />
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Priority: {item.priority}</span>
                                            <Link to="/skills" style={{ fontSize: '0.75rem', color: '#06b6d4', textDecoration: 'none', fontWeight: 600 }}>
                                                {item.has_assessment ? 'Re-take Test →' : 'Take Test →'}
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Milestone-Based Interactive Roadmap */}
                    <div className="glass-card" style={{ textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', margin: 0 }}>📍 Step-by-Step Personalized Learning Roadmap</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Progressively bridge your skill gaps with curated documentation and real-world project challenges.
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Completed: <strong>{roadmap?.completed_count || 0}</strong> / {roadmap?.total_milestones || 0}
                                </span>
                            </div>
                        </div>

                        {/* Milestones List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {roadmap?.milestones?.map((m) => (
                                <div
                                    key={m.id}
                                    style={{
                                        padding: '1.25rem',
                                        background: m.is_completed ? 'rgba(16, 185, 129, 0.06)' : 'rgba(15, 23, 42, 0.55)',
                                        borderRadius: '0.75rem',
                                        border: m.is_completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    {/* Milestone Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={m.is_completed}
                                                disabled={savingMilestone === m.id}
                                                onChange={() => toggleMilestone(m.id, m.is_completed)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    Step {m.step_number} • {m.stage}
                                                </div>
                                                <h3 style={{
                                                    fontSize: '1.15rem',
                                                    fontWeight: 700,
                                                    color: m.is_completed ? '#a7f3d0' : '#fff',
                                                    textDecoration: m.is_completed ? 'line-through' : 'none',
                                                    margin: '0.15rem 0'
                                                }}>
                                                    Master {m.skill_name} ({m.category})
                                                </h3>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <span className={`badge ${m.is_completed ? 'badge-success' : 'badge-student'}`}>
                                                {m.status}
                                            </span>
                                            <Link to="/skills" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                                                ⚡ Verify Skill
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Core Topics Checklist */}
                                    <div style={{ marginTop: '0.85rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                            KEY CONCEPTS TO MASTER:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {m.topics?.map((topic, i) => (
                                                <span key={i} style={{
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    padding: '0.2rem 0.6rem',
                                                    borderRadius: '0.35rem',
                                                    fontSize: '0.75rem',
                                                    color: '#cbd5e1',
                                                    border: '1px solid var(--border-color)',
                                                }}>
                                                    • {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Curated Resources */}
                                    <div style={{ marginTop: '0.85rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '0.35rem' }}>
                                            CURATED LEARNING GUIDES & DOCUMENTATION:
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                                            {m.resources?.map((res, i) => (
                                                <a
                                                    key={i}
                                                    href={res.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        fontSize: '0.8rem',
                                                        color: '#38bdf8',
                                                        textDecoration: 'none',
                                                        background: 'rgba(56, 189, 248, 0.1)',
                                                        padding: '0.25rem 0.65rem',
                                                        borderRadius: '0.4rem',
                                                        border: '1px solid rgba(56, 189, 248, 0.25)',
                                                    }}
                                                >
                                                    📖 {res.title} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>({res.type})</span> ↗
                                                </a>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Practical Project Challenge */}
                                    <div style={{
                                        marginTop: '0.85rem',
                                        padding: '0.65rem 0.85rem',
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        borderRadius: '0.5rem',
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                        fontSize: '0.8rem',
                                    }}>
                                        <strong style={{ color: '#a5b4fc' }}>🛠️ Hands-on Challenge:</strong>{' '}
                                        <span style={{ color: '#e2e8f0' }}>{m.hands_on_project}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </main>
    )
}
