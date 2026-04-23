import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Card } from '../components'
import { resetPassword } from '../lib/api'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

export const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-400 to-primary-400 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
        >
          <h2 className="text-2xl font-bold mb-2">Check your email</h2>
          <p className="text-neutral-600 mb-6">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Back to Login
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-neutral-100 py-8 px-4"
    >
      <div className="container-mobile">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-primary-400 mb-8 hover:text-primary-600 transition"
        >
          <ArrowLeft size={20} />
          Back to Login
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-400 mb-2">Reset Password</h1>
          <p className="text-neutral-600">Enter your email to receive a reset link</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            {error && (
              <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!email || loading}
              loading={loading}
              className="w-full"
            >
              Send Reset Link
            </Button>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
