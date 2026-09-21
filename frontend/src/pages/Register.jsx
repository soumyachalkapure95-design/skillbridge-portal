import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
    const [role, setRole] = useState('student')
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        // Student fields
        branch: 'Computer Science',
        year: 3,
        college: '',
        cgpa: 8.5,
        // Industry fields
        company: '',
        designation: '',
        // Academia fields
        institution: '',
        department: 'Computer Science & Engineering',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { register } = useAuth()
    const navigate = useNavigate()

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'year' || name === 'cgpa' ? Number(value) : value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await register({
                ...formData,
                role
            })
            navigate('/dashboard')
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Please check your details.')
        } finally {
            setLoading(false)
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
                maxWidth: '520px',
                width: '100%',
                padding: '2.5rem',
                border: '1px solid rgba(255, 255, 255, 0.12)',
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                        Create SkillBridge Account
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Select your role to personalize your platform experience
                    </p>
                </div>

                {/* Role Tabs */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.35rem',
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '0.35rem',
                    borderRadius: '0.75rem',
                    marginBottom: '1.5rem',
                    border: '1px solid var(--border-color)',
                }}>
                    {[
                        { id: 'student', label: 'Student', icon: '🎓' },
                        { id: 'industry', label: 'Industry', icon: '🏢' },
                        { id: 'academia', label: 'Faculty', icon: '🏛️' },
                        { id: 'admin', label: 'Admin', icon: '🛡️' },
                    ].map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setRole(t.id)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.2rem',
                                padding: '0.5rem 0.25rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                background: role === t.id ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                                color: role === t.id ? '#fff' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>

                {error && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '0.5rem',
                        color: '#fca5a5',
                        fontSize: '0.85rem',
                        marginBottom: '1.25rem',
                        textAlign: 'left',
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Common Fields */}
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                            type="text"
                            name="full_name"
                            className="form-input"
                            placeholder="John Doe"
                            value={formData.full_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            name="email"
                            className="form-input"
                            placeholder="user@skillbridge.edu"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* Role Specific Fields: Student */}
                    {role === 'student' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">College / University</label>
                                <input
                                    type="text"
                                    name="college"
                                    className="form-input"
                                    placeholder="e.g. National Institute of Technology"
                                    value={formData.college}
                                    onChange={handleChange}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Branch</label>
                                    <input
                                        type="text"
                                        name="branch"
                                        className="form-input"
                                        value={formData.branch}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Year</label>
                                    <input
                                        type="number"
                                        name="year"
                                        min="1"
                                        max="5"
                                        className="form-input"
                                        value={formData.year}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">CGPA</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="cgpa"
                                        min="0"
                                        max="10"
                                        className="form-input"
                                        value={formData.cgpa}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Role Specific Fields: Industry */}
                    {role === 'industry' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Company Name</label>
                                <input
                                    type="text"
                                    name="company"
                                    className="form-input"
                                    placeholder="e.g. Google, Microsoft, Startup"
                                    value={formData.company}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Designation</label>
                                <input
                                    type="text"
                                    name="designation"
                                    className="form-input"
                                    placeholder="e.g. Lead Recruiter / Eng Manager"
                                    value={formData.designation}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {/* Role Specific Fields: Academia */}
                    {role === 'academia' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">Institution / College</label>
                                <input
                                    type="text"
                                    name="institution"
                                    className="form-input"
                                    placeholder="e.g. State University of Tech"
                                    value={formData.institution}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Department</label>
                                <input
                                    type="text"
                                    name="department"
                                    className="form-input"
                                    placeholder="e.g. CSE / IT"
                                    value={formData.department}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '0.85rem', marginTop: '0.75rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : `Register as ${role.toUpperCase()}`}
                    </button>
                </form>

                <p style={{ marginTop: '1.75rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Already registered?{' '}
                    <Link to="/login" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
                        Sign In here
                    </Link>
                </p>
            </div>
        </div>
    )
}