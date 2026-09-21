import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Assessment from './pages/Assessment'
import Jobs from './pages/Jobs'
import Skills from './pages/Skills'
import LearningPath from './pages/LearningPath'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Main Application Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/learning-path"
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <LearningPath />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assessment/:skillId"
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <Assessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <Jobs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/skills"
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <Skills />
              </ProtectedRoute>
            }
          />

          {/* Fallback & Root Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App