// Centralized API Base URL configuration for both local dev and production deployment
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'
export const BACKEND_URL = API_BASE_URL.replace(/\/api\/?$/, '')

export default API_BASE_URL
