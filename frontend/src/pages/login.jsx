import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
    const [role, setRole] = useState('student')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { login } = useAuth()
    const navigate = useNavigate()

    const roleOptions = [
        { id: 'student', label: 'Student', icon: '🎓', desc: 'Assessments, AI Roadmaps & Jobs' },
        { id: 'industry', label: 'Industry', icon: '🏢', desc: 'Talent Pool & Challenge Posting' },
        { id: 'academia', label: 'Faculty', icon: '🏛️', desc: 'Institutional Analytics & Skill Gaps' },
        { id: 'admin', label: 'Admin', icon: '🛡️', desc: 'System Telemetry & Controls' },
    ]

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(email, password, role)
            navigate('/dashboard')
        } catch (err) {
            const detail = err.response?.data?.detail
            if (typeof detail === 'string') {
                setError(detail)
            } else if (Array.isArray(detail)) {
                setError(detail.map(d => d.msg || d).join(', '))
            } else {
                setError('Invalid credentials or unauthorized role access.')
            }
        } finally {
            setLoading(false)
        }
    }

    const getRoleThemeGradient = () => {
        switch (role) {
            case 'industry':
                return 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
            case 'academia':
                return 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)'
            case 'admin':
                return 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
            case 'student':
            default:
                return 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)'
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
        }}>
            <div className="glass-card" style={{
                maxWidth: '480px',
                width: '100%',
                padding: '2.5rem',
                border: '1px solid rgba(255, 255, 255, 0.12)',
            }}>
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '14px',
                        background: getRoleThemeGradient(),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto',
                        fontSize: '1.6rem',
                        boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
                        transition: 'all 0.3s ease'
                    }}>
                        ⚡
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.4rem 0', letterSpacing: '-0.02em' }}>
                        SkillBridge Portal
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Select your verified portal role to sign in
                    </p>
                </div>

                {/* Role Tabs */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.4rem',
                    background: 'rgba(15, 23, 42, 0.65)',
                    padding: '0.35rem',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border-color)',
                }}>
                    {roleOptions.map(t => {
                        const isSelected = role === t.id
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                    setRole(t.id)
                                    setError('')
                                }}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.6rem 0.2rem',
                                    borderRadius: '0.5rem',
                                    border: isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                                    background: isSelected ? getRoleThemeGradient() : 'transparent',
                                    color: isSelected ? '#fff' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none'
                                }}
                            >
                                <span style={{ fontSize: '1.15rem' }}>{t.icon}</span>
                                <span>{t.label}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Role Description Badge */}
                <div style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: '0.5rem',
                    border: '1px dashed var(--border-color)'
                }}>
                    Logging in to: <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{role} Portal</strong> — {roleOptions.find(r => r.id === role)?.desc}
                </div>

                {error && (
                    <div style={{
                        padding: '0.85rem 1rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '0.6rem',
                        color: '#fca5a5',
                        fontSize: '0.85rem',
                        marginBottom: '1.25rem',
                        textAlign: 'left',
                        lineHeight: 1.4
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Registered Email</label>
                        <input
                            type="email"
                            className="form-input"
                            placeholder={`${role}@skillbridge.edu`}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '0.85rem',
                            marginTop: '0.5rem',
                            background: getRoleThemeGradient()
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Verifying Credentials...' : `Sign In as ${role.toUpperCase()}`}
                    </button>
                </form>

                {/* Footer link */}
                <p style={{ marginTop: '1.75rem', fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Need a new account?{' '}
                    <Link to="/register" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
                        Register here
                    </Link>
                </p>
            </div>
        </div>
    )
}