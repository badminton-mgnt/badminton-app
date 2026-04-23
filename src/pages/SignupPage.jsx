import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Card, Badge } from '../components'
import { signup } from '../lib/api'
import { motion } from 'framer-motion'
import { CheckCircle, Circle } from 'lucide-react'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export const SignupPage = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showVerification, setShowVerification] = useState(false)

  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  })

  useEffect(() => {
    const password = formData.password
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z\d]/.test(password),
    })
  }, [formData.password])

  const isPasswordValid = PASSWORD_REGEX.test(formData.password)
  const isPasswordMatching = formData.password === formData.confirmPassword && formData.password
  const isFormValid = formData.name && formData.email && isPasswordValid && isPasswordMatching

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signup(formData.email, formData.password, formData.name)
      setShowVerification(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (showVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-400 to-primary-400 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.6 }}
            className="mb-4"
          >
            <CheckCircle size={64} className="text-success-700 mx-auto" />
          </motion.div>
          <h2 className="text-2xl font-bold mb-2">Check your email</h2>
          <p className="text-neutral-600 mb-6">
            We've sent a verification link to <strong>{formData.email}</strong>
          </p>
          <p className="text-sm text-neutral-500 mb-6">
            Please click the link to verify your email address
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Go to Login
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4">
      <div className="container-mobile">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-400 mb-2">Badminton App</h1>
          <p className="text-neutral-600">Create your account</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Your name"
            />

            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
            />

            <div>
              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
              <div className="mt-3 space-y-2">
                <PasswordCheck
                  checked={passwordChecks.length}
                  label="8+ characters"
                />
                <PasswordCheck
                  checked={passwordChecks.uppercase}
                  label="Uppercase letter"
                />
                <PasswordCheck
                  checked={passwordChecks.lowercase}
                  label="Lowercase letter"
                />
                <PasswordCheck
                  checked={passwordChecks.number}
                  label="Number"
                />
                <PasswordCheck
                  checked={passwordChecks.special}
                  label="Special character"
                />
              </div>
            </div>

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              error={
                formData.confirmPassword && !isPasswordMatching
                  ? 'Passwords do not match'
                  : ''
              }
            />

            {error && (
              <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!isFormValid || loading}
              loading={loading}
              className="w-full"
            >
              Sign Up
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-neutral-600">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-primary-400 font-semibold hover:underline"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  )
}

const PasswordCheck = ({ checked, label }) => (
  <div className="flex items-center gap-2">
    {checked ? (
      <CheckCircle size={16} className="text-success-700" />
    ) : (
      <Circle size={16} className="text-neutral-300" />
    )}
    <span className={`text-xs ${checked ? 'text-neutral-700' : 'text-neutral-400'}`}>
      {label}
    </span>
  </div>
)
