import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Button, Card, Input } from '../components'
import { updatePassword } from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const isPasswordValid = PASSWORD_REGEX.test(password)
  const isPasswordMatching = password === confirmPassword

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!isPasswordValid) {
      setError(tx(
        'Password must include uppercase, lowercase, number, special char, and 8+ characters.',
        'Mật khẩu phải có chữ hoa, chữ thường, số, ký tự đặc biệt và tối thiểu 8 ký tự.'
      ))
      return
    }

    if (!isPasswordMatching) {
      setError(tx('Passwords do not match.', 'Mật khẩu xác nhận không khớp.'))
      return
    }

    try {
      setLoading(true)
      await updatePassword(password)
      setSuccess(true)
    } catch (submitError) {
      setError(submitError.message || tx('Unable to update password right now.', 'Không thể cập nhật mật khẩu lúc này.'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-400 to-primary-400 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
        >
          <h2 className="text-2xl font-bold mb-2">{tx('Password updated', 'Đã cập nhật mật khẩu')}</h2>
          <p className="text-neutral-600 mb-6">{tx('Your password has been changed successfully.', 'Mật khẩu của bạn đã được thay đổi thành công.')}</p>
          <Button onClick={() => navigate('/login')} className="w-full">
            {tx('Go to Login', 'Đi đến đăng nhập')}
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
          {tx('Back to Login', 'Quay lại đăng nhập')}
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary-400 mb-2">{tx('Set New Password', 'Đặt mật khẩu mới')}</h1>
          <p className="text-neutral-600">{tx('Enter your new password to finish recovery.', 'Nhập mật khẩu mới để hoàn tất khôi phục.')}</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={tx('New Password', 'Mật khẩu mới')}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              error={
                password && !isPasswordValid
                  ? tx(
                    'Password must include uppercase, lowercase, number, special char, and 8+ characters.',
                    'Mật khẩu phải có chữ hoa, chữ thường, số, ký tự đặc biệt và tối thiểu 8 ký tự.'
                  )
                  : ''
              }
            />
            <Input
              label={tx('Confirm New Password', 'Xác nhận mật khẩu mới')}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              error={confirmPassword && !isPasswordMatching ? tx('Passwords do not match', 'Mật khẩu xác nhận không khớp') : ''}
            />

            {error && (
              <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!password || !confirmPassword || !isPasswordValid || !isPasswordMatching || loading}
              className="w-full"
            >
              {tx('Update Password', 'Cập nhật mật khẩu')}
            </Button>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
