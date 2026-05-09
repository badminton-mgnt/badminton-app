import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Card } from '../components'
import { login } from '../lib/api'
import { motion } from 'framer-motion'
import { useLanguage } from '../contexts/LanguageContext'

export const LoginPage = () => {
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
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
        setError(tx('Please verify your email before logging in', 'Vui lòng xác minh email trước khi đăng nhập'))
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
          <div className="mb-2 flex items-start justify-between gap-3">
            <h1 className="text-4xl font-bold text-primary-400">Badminton</h1>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-xs font-semibold text-neutral-700 outline-none"
            >
              <option value="en">EN</option>
              <option value="vi">VI</option>
            </select>
          </div>
          <p className="text-neutral-600">{tx('Welcome back', 'Chào mừng bạn quay lại')}</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={tx('Email or Username', 'Email hoặc tên người dùng')}
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
              placeholder={tx('you@example.com or your.username', 'you@example.com hoặc your.username')}
            />

            <Input
              label={tx('Password', 'Mật khẩu')}
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
              {tx('Login', 'Đăng nhập')}
            </Button>
          </form>
        </Card>

        <div className="space-y-3 text-center text-sm">
          <button
            onClick={() => navigate('/forgot-password')}
            className="text-primary-400 hover:underline block w-full"
          >
            {tx('Forgot password?', 'Quên mật khẩu?')}
          </button>
          <p className="text-neutral-600">
            {tx("Don't have an account?", 'Chưa có tài khoản?')}{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-primary-400 font-semibold hover:underline"
            >
              {tx('Sign up', 'Đăng ký')}
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  )
}
