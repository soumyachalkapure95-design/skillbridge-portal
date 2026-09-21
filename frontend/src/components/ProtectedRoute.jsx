import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
    const { isAuthenticated, role, loading } = useAuth()

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '60vh',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(99, 102, 241, 0.2)',
                    borderTop: '3px solid var(--primary)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading your SkillBridge session...</p>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}
