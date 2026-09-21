import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
    const { user, role, logout, isAuthenticated } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    if (!isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
        return null
    }

    const getRoleBadgeClass = (r) => {
        switch (r?.toLowerCase()) {
            case 'student': return 'badge-student'
            case 'industry': return 'badge-industry'
            case 'academia': return 'badge-academia'
            case 'admin': return 'badge-admin'
            default: return 'badge-student'
        }
    }

    const getRoleIcon = (r) => {
        switch (r?.toLowerCase()) {
            case 'student': return '🎓'
            case 'industry': return '🏢'
            case 'academia': return '🏛️'
            case 'admin': return '🛡️'
            default: return '👤'
        }
    }

    const getRoleTitle = (r) => {
        switch (r?.toLowerCase()) {
            case 'student': return 'Student'
            case 'industry': return 'Industry Partner'
            case 'academia': return 'Faculty / Academia'
            case 'admin': return 'Administrator'
            default: return 'User'
        }
    }

    // Role-tailored navigation items
    const getNavLinks = () => {
        const userRole = role?.toLowerCase()
        if (userRole === 'industry') {
            return [
                { path: '/dashboard', label: 'Talent & Candidates', icon: '🎯' },
            ]
        } else if (userRole === 'academia') {
            return [
                { path: '/dashboard', label: 'Institutional Analytics', icon: '📊' },
            ]
        } else if (userRole === 'admin') {
            return [
                { path: '/dashboard', label: 'Control Center', icon: '🛡️' },
                { path: '/skills', label: 'Catalog Manager', icon: '⚡' },
                { path: '/jobs', label: 'Jobs Database', icon: '💼' },
            ]
        } else {
            // Default: Student
            return [
                { path: '/dashboard', label: 'Dashboard', icon: '📊' },
                { path: '/skills', label: 'Skill Matrix & Tests', icon: '⚡' },
                { path: '/learning-path', label: 'AI Learning Path', icon: '🗺️' },
                { path: '/jobs', label: 'Jobs & Internships', icon: '💼' },
            ]
        }
    }

    const navLinks = getNavLinks()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0.75rem 1.5rem',
        }}>
            <div style={{
                maxWidth: '1280px',
                margin: '0 auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
            }}>
                {/* Brand Logo */}
                <Link to="/dashboard" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    textDecoration: 'none',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                    letterSpacing: '-0.02em',
                }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                        fontSize: '1.1rem',
                    }}>
                        ⚡
                    </div>
                    <span>Skill<span style={{ color: '#06b6d4' }}>Bridge</span></span>
                </Link>

                {/* Center Nav Links */}
                {isAuthenticated && (
                    <nav style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(30, 41, 59, 0.6)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-color)',
                    }}>
                        {navLinks.map((link) => {
                            const isActive = location.pathname === link.path
                            return (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        padding: '0.45rem 0.9rem',
                                        borderRadius: '0.5rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                        color: isActive ? '#fff' : 'var(--text-muted)',
                                        background: isActive ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                                        boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <span>{link.icon}</span>
                                    <span>{link.label}</span>
                                </Link>
                            )
                        })}
                    </nav>
                )}

                {/* Right Side: Role Badge & Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isAuthenticated ? (
                        <>
                            {/* Verified Role Badge (Non-switchable, authenticated) */}
                            <div
                                className={`badge ${getRoleBadgeClass(role)}`}
                                title={`Logged in as ${getRoleTitle(role)}`}
                                style={{
                                    padding: '0.35rem 0.75rem',
                                    fontSize: '0.8rem',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    userSelect: 'none',
                                    fontWeight: 700
                                }}
                            >
                                <span>{getRoleIcon(role)}</span>
                                <span style={{ textTransform: 'capitalize' }}>{role}</span>
                            </div>

                            {/* User Profile / Logout */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    lineHeight: 1.2,
                                }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                                        {user?.name || user?.full_name || 'User'}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                        {user?.email}
                                    </span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                    title="Sign Out"
                                >
                                    🚪 Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Link to="/login" className="btn btn-secondary btn-sm">Sign In</Link>
                            <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}
