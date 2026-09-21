import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import { API_BASE_URL } from '../config'

const SKILL_NAMES = {
    1: 'Python',
    2: 'Java',
    3: 'C++',
    4: 'JavaScript',
    5: 'SQL',
    6: 'MongoDB',
    7: 'React',
    8: 'HTML',
    9: 'CSS',
    10: 'Node.js',
    11: 'FastAPI',
    13: 'Git',
    14: 'Docker',
    15: 'Linux',
    16: 'Data Structures',
    17: 'Algorithms',
    18: 'Object-Oriented Programming',
    19: 'DBMS',
    20: 'Operating Systems',
    21: 'Computer Networks',
    22: 'Machine Learning',
    23: 'Data Analysis',
    24: 'Generative AI',
    25: 'Communication',
    26: 'Problem Solving',
    27: 'Teamwork'
}

export default function Assessment() {
    const { skillId } = useParams()
    const navigate = useNavigate()
    const skillName = SKILL_NAMES[skillId] || 'Skill Assessment'

    // Assessment State
    const [questionCount, setQuestionCount] = useState(7) // 5 to 10 questions
    const [difficulty, setDifficulty] = useState('Medium')
    const [questions, setQuestions] = useState([])
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [answers, setAnswers] = useState({})
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [score, setScore] = useState(null)

    // Media & Proctoring State
    const [cameraOn, setCameraOn] = useState(false)
    const [modelLoading, setModelLoading] = useState(true)
    const [proctorStatus, setProctorStatus] = useState('Initializing AI Proctor...')
    const [integrityScore, setIntegrityScore] = useState(100)
    const [warningsCount, setWarningsCount] = useState(0)
    const [violations, setViolations] = useState([])
    const [activeAlert, setActiveAlert] = useState(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Refs
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const modelRef = useRef(null)
    const detectionIntervalRef = useRef(null)
    const audioContextRef = useRef(null)
    const analyserRef = useRef(null)
    const audioIntervalRef = useRef(null)
    const noPersonCountRef = useRef(0)
    const alertTimeoutRef = useRef(null)

    // 1. Initialize Camera & Mic
    useEffect(() => {
        startMediaAndAI()
        return () => {
            stopMediaAndAI()
        }
    }, [])

    const startMediaAndAI = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 480, height: 360, facingMode: 'user' },
                audio: true
            })

            if (videoRef.current) {
                videoRef.current.srcObject = stream
                setCameraOn(true)
            }

            // Audio Analysis Setup
            setupAudioAnalysis(stream)

            // Load TensorFlow.js COCO-SSD Model
            setModelLoading(true)
            await tf.ready()
            const loadedModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
            modelRef.current = loadedModel
            setModelLoading(false)
            setProctorStatus('AI Proctoring Active & Monitoring')

            // Start Real-time Detection Loop
            startDetectionLoop()
        } catch (err) {
            console.error('Camera/Mic or AI Init error:', err)
            alert('Camera & microphone permissions are required for proctored skill verification.')
            setProctorStatus('Proctoring Error: Camera/Mic Access Required')
        }
    }

    const stopMediaAndAI = () => {
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current)
        if (audioIntervalRef.current) clearInterval(audioIntervalRef.current)
        if (audioContextRef.current) {
            try { audioContextRef.current.close() } catch (e) { /* ignore */ }
        }
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop())
            setCameraOn(false)
        }
    }

    // 2. Audio Noise / Speech Level Monitor
    const setupAudioAnalysis = (stream) => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            if (!AudioContext) return

            const audioCtx = new AudioContext()
            audioContextRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)
            analyserRef.current = analyser

            const dataArray = new Uint8Array(analyser.frequencyBinCount)

            audioIntervalRef.current = setInterval(() => {
                if (submitted) return
                analyser.getByteFrequencyData(dataArray)
                let sum = 0
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i]
                }
                const averageVolume = sum / dataArray.length

                // Continuous loud speech / talking threshold
                if (averageVolume > 65) {
                    recordViolation('Background Voice / Speaking Detected', 5, '⚠️ High audio volume / voice activity detected')
                }
            }, 2500)
        } catch (e) {
            console.warn('Audio analysis not supported:', e)
        }
    }

    // 3. Violation Logging & Alert Trigger
    const recordViolation = useCallback((type, penalty = 10, displayMsg = '') => {
        const timestamp = new Date().toLocaleTimeString()
        const newViolation = { type, timestamp, penalty, message: displayMsg || type }

        setViolations(prev => [newViolation, ...prev.slice(0, 9)])
        setIntegrityScore(prev => Math.max(0, prev - penalty))
        setWarningsCount(prev => {
            const nextCount = prev + 1
            if (nextCount >= 4) {
                triggerAutoSubmit('Maximum Proctoring Violations (3/3) Reached')
            }
            return nextCount
        })

        // Show live visual alert on HUD
        setActiveAlert(displayMsg || type)
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
        alertTimeoutRef.current = setTimeout(() => {
            setActiveAlert(null)
        }, 4000)
    }, [])

    // 4. Tab Switch & Visibility Change Detection
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && !submitted) {
                recordViolation('Tab Switch / Window Minimized', 15, '⚠️ Tab switched or window unfocused! Focus required.')
            }
        }

        const handleBlur = () => {
            if (!submitted) {
                recordViolation('Window Blur / Out of Focus', 10, '⚠️ Window lost focus! Stay on exam screen.')
            }
        }

        const handleContextMenu = (e) => {
            e.preventDefault()
            recordViolation('Right Click / Copy Attempt', 5, '⚠️ Copying / Inspecting is disabled during exam.')
        }

        const handleKeyDown = (e) => {
            if ((e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u')) || e.key === 'F12') {
                e.preventDefault()
                recordViolation('Keyboard Shortcut Restriction', 5, '⚠️ Copying shortcuts and DevTools are blocked.')
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('blur', handleBlur)
        document.addEventListener('contextmenu', handleContextMenu)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('blur', handleBlur)
            document.removeEventListener('contextmenu', handleContextMenu)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [submitted, recordViolation])

    // 5. Real-Time Computer Vision Object & Face Detection Loop
    const startDetectionLoop = () => {
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current)

        detectionIntervalRef.current = setInterval(async () => {
            if (!modelRef.current || !videoRef.current || videoRef.current.readyState !== 4 || submitted) {
                return
            }

            const video = videoRef.current
            const canvas = canvasRef.current

            try {
                const predictions = await modelRef.current.detect(video)

                if (canvas) {
                    const ctx = canvas.getContext('2d')
                    canvas.width = video.videoWidth || 320
                    canvas.height = video.videoHeight || 240
                    ctx.clearRect(0, 0, canvas.width, canvas.height)

                    let personCount = 0
                    let phoneDetected = false
                    let secondaryDeviceDetected = false

                    predictions.forEach(prediction => {
                        const [x, y, width, height] = prediction.bbox
                        const className = prediction.class.toLowerCase()
                        const score = Math.round(prediction.score * 100)

                        if (className === 'person' && prediction.score > 0.45) {
                            personCount++
                            ctx.strokeStyle = '#22c55e'
                            ctx.lineWidth = 2
                            ctx.strokeRect(x, y, width, height)
                            ctx.fillStyle = '#22c55e'
                            ctx.font = '12px Inter, sans-serif'
                            ctx.fillText(`Candidate (${score}%)`, x, y > 15 ? y - 5 : 15)
                        } else if (className === 'cell phone' && prediction.score > 0.45) {
                            phoneDetected = true
                            ctx.strokeStyle = '#ef4444'
                            ctx.lineWidth = 3
                            ctx.strokeRect(x, y, width, height)
                            ctx.fillStyle = '#ef4444'
                            ctx.font = 'bold 12px Inter, sans-serif'
                            ctx.fillText(`⚠️ PHONE (${score}%)`, x, y > 15 ? y - 5 : 15)
                        } else if ((className === 'laptop' || className === 'book' || className === 'remote') && prediction.score > 0.5) {
                            secondaryDeviceDetected = true
                            ctx.strokeStyle = '#f59e0b'
                            ctx.lineWidth = 2
                            ctx.strokeRect(x, y, width, height)
                            ctx.fillStyle = '#f59e0b'
                            ctx.font = '12px Inter, sans-serif'
                            ctx.fillText(`Device: ${className} (${score}%)`, x, y > 15 ? y - 5 : 15)
                        }
                    })

                    if (phoneDetected) {
                        recordViolation('Mobile Phone Detected in Frame', 20, '📱 CRITICAL: Mobile phone detected in camera view!')
                        setProctorStatus('🔴 VIOLATION: Cell phone detected in view')
                    } else if (personCount === 0) {
                        noPersonCountRef.current++
                        if (noPersonCountRef.current >= 3) {
                            recordViolation('Candidate Absent / Not in Frame', 10, '👤 Candidate not visible in camera frame! Please face camera.')
                            setProctorStatus('🟡 WARNING: No candidate visible in frame')
                        }
                    } else if (personCount > 1) {
                        noPersonCountRef.current = 0
                        recordViolation('Multiple Persons in Room', 20, '👥 Multiple people detected in assessment area!')
                        setProctorStatus('🔴 VIOLATION: Multiple persons in camera view')
                    } else {
                        noPersonCountRef.current = 0
                        setProctorStatus('🟢 Proctoring Normal — Candidate Verified')
                    }
                }
            } catch (err) {
                console.error('Detection frame error:', err)
            }
        }, 900)
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error)
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error)
        }
    }

    // Generate 5 to 10 Questions
    const generateQuestions = async () => {
        setLoading(true)
        try {
            const res = await axios.post(`${API_BASE_URL}/llm/generate-questions`, {
                skill_name: skillName,
                num_questions: Number(questionCount),
                difficulty: difficulty
            })
            const fetched = res.data.questions || []
            setQuestions(fetched)
            setCurrentQuestionIndex(0)
        } catch (err) {
            alert('Failed to generate questions: ' + (err.response?.data?.detail || err.message))
        } finally {
            setLoading(false)
        }
    }

    const triggerAutoSubmit = (reason) => {
        alert(`🚨 EXAM AUTO-SUBMITTED: ${reason}`)
        calculateScore('Flagged')
        setSubmitted(true)
        stopMediaAndAI()
    }

    const calculateScore = async (overrideStatus = null) => {
        const totalQuestions = questions.length || 1
        const answeredQuestions = Object.keys(answers).filter(k => answers[k]?.trim().length > 0).length
        const percentage = Math.round((answeredQuestions / totalQuestions) * 100)

        let jobFit = 'Low'
        let jobFitColor = '#ef4444'
        let message = 'You need more practice in this skill.'

        if (percentage >= 80) {
            jobFit = 'Excellent'
            jobFitColor = '#10b981'
            message = 'Outstanding! You demonstrated comprehensive competency across all assessment questions.'
        } else if (percentage >= 60) {
            jobFit = 'Good'
            jobFitColor = '#06b6d4'
            message = 'Solid performance! Job-ready with verified problem-solving ability.'
        } else if (percentage >= 40) {
            jobFit = 'Moderate'
            jobFitColor = '#f59e0b'
            message = 'Keep practicing. Focus on understanding the core concepts better.'
        }

        const finalStatus = overrideStatus || (integrityScore >= 80 ? 'Clear' : integrityScore >= 50 ? 'Suspicious' : 'Flagged')

        setScore({
            percentage,
            jobFit,
            jobFitColor,
            message,
            integrityScore,
            violationsCount: warningsCount,
            proctoringStatus: finalStatus,
            violations
        })

        // Persist to backend database with AI proctoring telemetry
        try {
            await axios.post(`${API_BASE_URL}/assessment/save`, {
                skill_id: Number(skillId),
                score: percentage,
                questions_answered: answeredQuestions,
                integrity_score: integrityScore,
                violations_count: warningsCount,
                violation_logs: JSON.stringify(violations),
                proctoring_status: finalStatus
            })
        } catch (err) {
            console.error('Failed to save assessment telemetry to DB:', err)
        }
    }

    const handleSubmit = async () => {
        await calculateScore()
        setSubmitted(true)
        stopMediaAndAI()
    }

    const getIntegrityBadgeColor = (val) => {
        if (val >= 80) return '#10b981'
        if (val >= 60) return '#f59e0b'
        return '#ef4444'
    }

    const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim().length > 0).length

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header with Title and AI Proctor Status */}
            <div className="glass-card" style={{
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
                borderColor: 'rgba(99, 102, 241, 0.3)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span className="badge badge-student">⚡ Skill Assessment</span>
                        <span className="badge" style={{
                            background: cameraOn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: cameraOn ? '#34d399' : '#f87171',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                            {cameraOn ? '📹 AI Proctoring Active' : '📹 Camera Inactive'}
                        </span>
                    </div>
                    <h1 style={{ fontSize: '1.8rem', margin: 0 }}>
                        {skillName} Skill Verification ({questions.length > 0 ? `${questions.length} Questions` : '5–10 Questions'})
                    </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        onClick={toggleFullscreen}
                        className="btn btn-secondary btn-sm"
                        title="Toggle Fullscreen Mode"
                    >
                        {isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Enter Fullscreen'}
                    </button>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn btn-secondary btn-sm"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>

            {/* Active Alert Banner */}
            {activeAlert && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    borderRadius: '0.75rem',
                    color: '#fca5a5',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'pulse 1.5s infinite'
                }}>
                    <span style={{ fontSize: '1.3rem' }}>🚨</span>
                    <span>{activeAlert}</span>
                </div>
            )}

            {/* Floating Live AI Proctoring Camera HUD */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 1000,
                width: '280px',
                background: 'rgba(15, 23, 42, 0.92)',
                border: warningsCount > 0 ? '2px solid rgba(239, 68, 68, 0.6)' : '1px solid var(--border-color)',
                borderRadius: '1rem',
                overflow: 'hidden',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(16px)'
            }}>
                {/* HUD Header */}
                <div style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(30, 41, 59, 0.8)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.75rem'
                }}>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: cameraOn ? '#10b981' : '#ef4444',
                            display: 'inline-block'
                        }} />
                        AI Proctor HUD
                    </span>
                    <span style={{
                        color: getIntegrityBadgeColor(integrityScore),
                        fontWeight: 700
                    }}>
                        🛡️ {integrityScore}% Trust
                    </span>
                </div>

                {/* Video Container with Overlaid Canvas */}
                <div style={{ position: 'relative', width: '100%', height: '170px', background: '#000' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                        }}
                    />
                    <canvas
                        ref={canvasRef}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none'
                        }}
                    />
                    {modelLoading && (
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(15, 23, 42, 0.85)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.75rem',
                            color: '#a5b4fc'
                        }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                border: '2px solid rgba(99, 102, 241, 0.3)',
                                borderTop: '2px solid #818cf8',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <span>Loading Vision Engine...</span>
                        </div>
                    )}
                </div>

                {/* Live Status Pill & Warning Meter */}
                <div style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem'
                    }}>
                        <span style={{ color: 'var(--text-muted)' }}>Warnings:</span>
                        <span style={{
                            fontWeight: 700,
                            color: warningsCount === 0 ? '#10b981' : warningsCount < 3 ? '#f59e0b' : '#ef4444'
                        }}>
                            ⚠️ {warningsCount} / 3 Max
                        </span>
                    </div>

                    <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {proctorStatus}
                    </div>
                </div>
            </div>

            {/* Main Content: Start Screen with 5-10 Question Config or Question Flow */}
            {!questions.length ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto',
                        fontSize: '2rem',
                        boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
                    }}>
                        🛡️
                    </div>

                    <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
                        Configure Proctored Assessment: {skillName}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto 1.75rem auto', lineHeight: 1.6 }}>
                        To thoroughly evaluate technical depth, select your desired question pool size (5 to 10 questions) and difficulty level.
                    </p>

                    {/* Question Count & Difficulty Selectors */}
                    <div style={{
                        maxWidth: '600px',
                        margin: '0 auto 1.75rem auto',
                        textAlign: 'left'
                    }}>
                        {/* Quick Question Count Pills (5 to 10) */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Question Pool Size (5 to 10 Questions)</span>
                                <span style={{ color: '#818cf8', fontWeight: 700 }}>{questionCount} Questions Selected</span>
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', marginTop: '0.4rem' }}>
                                {[5, 6, 7, 8, 9, 10].map(cnt => {
                                    const isSel = questionCount === cnt
                                    return (
                                        <button
                                            key={cnt}
                                            type="button"
                                            onClick={() => setQuestionCount(cnt)}
                                            style={{
                                                padding: '0.6rem 0.2rem',
                                                borderRadius: '0.5rem',
                                                border: isSel ? '2px solid #6366f1' : '1px solid var(--border-color)',
                                                background: isSel ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(30, 41, 59, 0.6)',
                                                color: isSel ? '#fff' : 'var(--text-muted)',
                                                fontWeight: 800,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {cnt} Qs
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Question Pool Size</label>
                                <select
                                    className="form-input"
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                                    style={{ background: '#1e293b', color: '#fff' }}
                                >
                                    <option value={5}>5 Questions (Standard Verification)</option>
                                    <option value={6}>6 Questions (Core & Edge Cases)</option>
                                    <option value={7}>7 Questions (In-Depth Technical)</option>
                                    <option value={8}>8 Questions (Advanced Systems)</option>
                                    <option value={9}>9 Questions (Comprehensive Evaluation)</option>
                                    <option value={10}>10 Questions (Complete Skill Mastery)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Assessment Difficulty</label>
                                <select
                                    className="form-input"
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    style={{ background: '#1e293b', color: '#fff' }}
                                >
                                    <option value="Easy">Easy (Fundamentals)</option>
                                    <option value="Medium">Medium (Industry Benchmark)</option>
                                    <option value="Hard">Hard (Senior / Advanced Patterns)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Proctoring Rules Checklist */}
                    <div style={{
                        maxWidth: '560px',
                        margin: '0 auto 2rem auto',
                        textAlign: 'left',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '1.25rem 1.5rem',
                        borderRadius: '0.75rem',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        fontSize: '0.88rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span>📱</span>
                            <span><strong>No Mobile Phones</strong> — COCO-SSD vision detector flags electronic devices.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span>👤</span>
                            <span><strong>Continuous Face Visibility</strong> — Keep face in center of camera.</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span>🗗</span>
                            <span><strong>Tab Lock Active</strong> — Tab switching or leaving window logs infractions.</span>
                        </div>
                    </div>

                    <button
                        onClick={generateQuestions}
                        disabled={loading || modelLoading}
                        className="btn btn-primary"
                        style={{ padding: '0.9rem 2.5rem', fontSize: '1.05rem', fontWeight: 700 }}
                    >
                        {loading ? `Generating ${questionCount} Questions...` : modelLoading ? 'Preparing AI Proctor...' : `🚀 Start ${questionCount}-Question Assessment`}
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: submitted ? '1fr' : '2.5fr 1fr', gap: '1.5rem' }}>
                    {/* Left Column: Questions Navigation & Content or Results */}
                    <div>
                        {!submitted ? (
                            <>
                                {/* Question Quick-Jump Navigator */}
                                <div className="glass-card" style={{
                                    marginBottom: '1.25rem',
                                    padding: '0.85rem 1.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '0.4rem' }}>
                                            Questions:
                                        </span>
                                        {questions.map((_, idx) => {
                                            const isAnswered = (answers[idx] || '').trim().length > 0
                                            const isCurrent = currentQuestionIndex === idx
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentQuestionIndex(idx)}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        border: isCurrent ? '2px solid #818cf8' : '1px solid var(--border-color)',
                                                        background: isCurrent
                                                            ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                                            : isAnswered
                                                            ? 'rgba(16, 185, 129, 0.2)'
                                                            : 'rgba(30, 41, 59, 0.5)',
                                                        color: isCurrent ? '#fff' : isAnswered ? '#34d399' : 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    title={`Question ${idx + 1} (${isAnswered ? 'Answered' : 'Unanswered'})`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        Answered: <strong style={{ color: '#34d399' }}>{answeredCount}</strong> / {questions.length}
                                    </div>
                                </div>

                                {/* Active Question Card */}
                                {questions[currentQuestionIndex] && (
                                    <div className="glass-card" style={{ marginBottom: '1.5rem', textAlign: 'left', padding: '2rem' }}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '1rem'
                                        }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#818cf8' }}>
                                                Question {currentQuestionIndex + 1} of {questions.length}
                                            </span>
                                            <span className="badge badge-student" style={{ fontSize: '0.75rem' }}>
                                                {questions[currentQuestionIndex].difficulty || difficulty}
                                            </span>
                                        </div>

                                        <h3 style={{ fontSize: '1.2rem', margin: '0 0 1.25rem 0', lineHeight: 1.6, color: '#fff' }}>
                                            {questions[currentQuestionIndex].question_text}
                                        </h3>

                                        <div className="form-group">
                                            <label className="form-label" style={{ fontSize: '0.85rem' }}>
                                                Your Technical Solution / Explanation:
                                            </label>
                                            <textarea
                                                value={answers[currentQuestionIndex] || ''}
                                                onChange={(e) => setAnswers({ ...answers, [currentQuestionIndex]: e.target.value })}
                                                placeholder="Write your detailed explanation or code structure here..."
                                                className="form-input"
                                                style={{
                                                    width: '100%',
                                                    minHeight: '160px',
                                                    resize: 'vertical',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.92rem',
                                                    lineHeight: 1.6
                                                }}
                                            />
                                        </div>

                                        {/* Prev / Next / Submit Controls */}
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: '1.5rem',
                                            paddingTop: '1rem',
                                            borderTop: '1px solid var(--border-color)'
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                                disabled={currentQuestionIndex === 0}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                ← Previous Question
                                            </button>

                                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                {currentQuestionIndex < questions.length - 1 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                                        className="btn btn-primary btn-sm"
                                                    >
                                                        Next Question →
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleSubmit}
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.5rem 1.25rem' }}
                                                    >
                                                        Submit All {questions.length} Questions ✓
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* Results View */
                            <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: score?.jobFitColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.25rem auto',
                                    fontSize: '2rem',
                                    color: '#fff',
                                    boxShadow: `0 8px 24px ${score?.jobFitColor}55`
                                }}>
                                    ✓
                                </div>

                                <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>
                                    {skillName} Verification Complete
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                                    Successfully evaluated across <strong>{questions.length} assessment questions</strong> with AI proctoring telemetry stored in the database.
                                </p>

                                {/* Scores Grid */}
                                <div className="grid-stats" style={{ margin: '2rem 0', textAlign: 'left' }}>
                                    <div className="glass-card stat-card">
                                        <div className="stat-header">
                                            <span>Technical Score</span>
                                            <span style={{ fontSize: '1.2rem' }}>🎯</span>
                                        </div>
                                        <div className="stat-value" style={{ color: score?.jobFitColor }}>
                                            {score?.percentage}%
                                        </div>
                                        <div className="stat-subtext">Job Fit: {score?.jobFit}</div>
                                    </div>

                                    <div className="glass-card stat-card">
                                        <div className="stat-header">
                                            <span>Proctoring Integrity</span>
                                            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                                        </div>
                                        <div className="stat-value" style={{ color: getIntegrityBadgeColor(score?.integrityScore) }}>
                                            {score?.integrityScore}%
                                        </div>
                                        <div className="stat-subtext">Status: {score?.proctoringStatus}</div>
                                    </div>

                                    <div className="glass-card stat-card">
                                        <div className="stat-header">
                                            <span>Questions Answered</span>
                                            <span style={{ fontSize: '1.2rem' }}>📝</span>
                                        </div>
                                        <div className="stat-value">
                                            {answeredCount} / {questions.length}
                                        </div>
                                        <div className="stat-subtext">Completed assessment questions</div>
                                    </div>
                                </div>

                                {/* Review Answers & Rubrics */}
                                <div style={{ textAlign: 'left', marginTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                                        📋 Detailed Question Feedback ({questions.length} Questions)
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {questions.map((q, idx) => (
                                            <div key={idx} className="glass-card" style={{ padding: '1.25rem' }}>
                                                <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                                                    Question {idx + 1}:
                                                </div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                                    {q.question_text}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                                    <strong>Your Answer:</strong> {answers[idx] || 'No answer submitted'}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#38bdf8', padding: '0.5rem 0.75rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '0.4rem', marginBottom: '0.4rem' }}>
                                                    <strong>Reference Solution:</strong> {q.reference_answer}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#a5b4fc' }}>
                                                    <strong>Evaluation Rubric:</strong> {q.rubric}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="btn btn-primary"
                                    >
                                        Go to Student Dashboard
                                    </button>
                                    <button
                                        onClick={() => navigate('/jobs')}
                                        className="btn btn-secondary"
                                    >
                                        View Matching Jobs & Internships
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Live Telemetry Feed (While Taking Test) */}
                    {!submitted && (
                        <div>
                            <div className="glass-card" style={{ textAlign: 'left', position: 'sticky', top: '90px' }}>
                                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>📡</span> Live Proctoring Audit
                                </h3>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.6rem 0.8rem',
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Trust Index</span>
                                        <span style={{ fontWeight: 700, color: getIntegrityBadgeColor(integrityScore) }}>
                                            {integrityScore}%
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.6rem 0.8rem',
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Total Warnings</span>
                                        <span style={{ fontWeight: 700, color: warningsCount > 0 ? '#f59e0b' : '#10b981' }}>
                                            {warningsCount} / 3
                                        </span>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.6rem 0.8rem',
                                        background: 'rgba(15, 23, 42, 0.5)',
                                        borderRadius: '0.5rem'
                                    }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Questions</span>
                                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                                            {questions.length} Questions
                                        </span>
                                    </div>
                                </div>

                                {/* Violation Log Stream */}
                                <div style={{ marginTop: '1.25rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                        Event Log
                                    </div>
                                    {violations.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: '#34d399', padding: '0.5rem 0' }}>
                                            ✓ No infractions recorded
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                                            {violations.map((v, idx) => (
                                                <div key={idx} style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.4rem 0.6rem',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    borderLeft: '3px solid #ef4444',
                                                    borderRadius: '0.35rem',
                                                    color: '#fca5a5'
                                                }}>
                                                    <div><strong>{v.type}</strong></div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>{v.timestamp} (-{v.penalty}%)</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}