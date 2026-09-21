import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config'

const API_BASE = API_BASE_URL

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token') || null)
    const [loading, setLoading] = useState(true)

    // Set auth header for axios
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
            fetchUserProfile()
        } else {
            delete axios.defaults.headers.common['Authorization']
            setUser(null)
            setLoading(false)
        }
    }, [token])

    const fetchUserProfile = async () => {
        try {
            const res = await axios.get(`${API_BASE}/auth/me`)
            setUser(res.data)
        } catch (err) {
            console.error('Failed to fetch user profile:', err)
            logout()
        } finally {
            setLoading(false)
        }
    }

    const login = async (email, password, role = 'student') => {
        const res = await axios.post(`${API_BASE}/auth/login`, {
            email: email.trim(),
            password,
            role
        })
        const { access_token, user: userData } = res.data
        localStorage.setItem('token', access_token)
        axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        setToken(access_token)
        setUser(userData)
        return userData
    }

    const register = async (userData) => {
        const res = await axios.post(`${API_BASE}/auth/register`, userData)
        if (res.data.access_token) {
            localStorage.setItem('token', res.data.access_token)
            axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`
            setToken(res.data.access_token)
            setUser(res.data.user)
        }
        return res.data
    }

    const logout = () => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
        delete axios.defaults.headers.common['Authorization']
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                role: user?.role || 'student',
                isAuthenticated: !!token && !!user,
                loading,
                login,
                register,
                logout,
                fetchUserProfile
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
