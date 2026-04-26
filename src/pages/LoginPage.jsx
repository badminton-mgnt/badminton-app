import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Card } from '../components'
import { login } from '../lib/api'
import { motion } from 'framer-motion'

export const LoginPage = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(formData.identifier, formData.password)
      navigate('/')
    } catch (err) {
      if (err.message.includes('Email not confirmed')) {
        setError('Please verify your email before logging in')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
      setFormData((prev) => ({ ...prev, password: '' }))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-neutral-100 py-8 px-4"
    >
      <div className="container-mobile">
        <div className="mb-12 mt-16">
          <h1 className="text-4xl font-bold text-primary-400 mb-2">Badminton</h1>
          <p className="text-neutral-600">Welcome back</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email or Username"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              placeholder="you@example.com or your.username"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
            />

            {error && (
              <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!formData.identifier || !formData.password || loading}
              loading={loading}
              className="w-full"
            >
              Login
            </Button>
          </form>
        </Card>

        <div className="space-y-3 text-center text-sm">
          <button
            onClick={() => navigate('/forgot-password')}
            className="text-primary-400 hover:underline block w-full"
          >
            Forgot password?
          </button>
          <p className="text-neutral-600">
            Don't have an account?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary-400 font-semibold hover:underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  )
}
