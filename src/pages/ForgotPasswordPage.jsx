import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Card } from '../components'
import { getPasswordResetMode, resetPassword, resetPasswordWithAppSecret } from '../lib/api'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const { language } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const [identifier, setIdentifier] = useState('')
  const [resetMode, setResetMode] = useState('')
  const [resolvedEmail, setResolvedEmail] = useState('')
  const [resolvedUsername, setResolvedUsername] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const normalizedIdentifier = String(identifier || '').trim()

    if (!normalizedIdentifier) {
      setResetMode('')
      setResolvedEmail('')
      setResolvedUsername('')
      setError('')
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await resolveMode(normalizedIdentifier)
        setError('')
      } catch {
        setResetMode('')
        setResolvedEmail('')
        setResolvedUsername('')
        setError(tx('Account not found', 'Không tìm thấy tài khoản'))
      }
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [identifier])

  const resolveMode = async (rawIdentifier) => {
    const normalizedIdentifier = String(rawIdentifier || '').trim().toLowerCase()
    if (!normalizedIdentifier) {
      throw new Error(tx('Please enter email or username first.', 'Vui lòng nhập email hoặc tên người dùng trước.'))
    }

    const modeData = await getPasswordResetMode(normalizedIdentifier)
    const nextMode = String(modeData?.mode || '').toLowerCase()

    if (!['email', 'app_secret'].includes(nextMode)) {
      throw new Error(tx('Unable to detect account type.', 'Không thể xác định loại tài khoản.'))
    }

    setResetMode(nextMode)
    setResolvedEmail(String(modeData?.email || ''))
    setResolvedUsername(String(modeData?.username || normalizedIdentifier))

    return {
      mode: nextMode,
      email: String(modeData?.email || ''),
      username: String(modeData?.username || normalizedIdentifier),
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let mode = resetMode
      let targetEmail = resolvedEmail
      let targetUsername = resolvedUsername

      if (!mode) {
        const resolved = await resolveMode(identifier)
        mode = resolved.mode
        targetEmail = resolved.email
        targetUsername = resolved.username
      }

      if (mode === 'app_secret') {
        if (!secretKey.trim()) {
          throw new Error(tx('Please enter secret key.', 'Vui lòng nhập secret key.'))
        }

        if (!newPassword) {
          throw new Error(tx('Please enter new password.', 'Vui lòng nhập mật khẩu mới.'))
        }

        if (!PASSWORD_REGEX.test(newPassword)) {
          throw new Error(tx(
            'Password must include uppercase, lowercase, number, special character and be at least 8 characters.',
            'Mật khẩu phải có chữ hoa, chữ thường, số, ký tự đặc biệt và tối thiểu 8 ký tự.'
          ))
        }

        if (newPassword !== confirmPassword) {
          throw new Error(tx('Passwords do not match.', 'Mật khẩu xác nhận không khớp.'))
        }

        await resetPasswordWithAppSecret({
          username: targetUsername,
          secretKey,
          newPassword,
        })

        setSuccessMessage(tx('Password has been reset successfully. You can login now.', 'Đã đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.'))
        setSuccess(true)
      } else {
        const resetEmail = targetEmail || String(identifier || '').trim().toLowerCase()
        await resetPassword(resetEmail)
        window.alert(tx(
          `Password reset link has been sent to ${resetEmail}. Please check your email to reset password.`,
          `Đã gửi link đặt lại mật khẩu tới ${resetEmail}. Vui lòng kiểm tra email để đặt lại mật khẩu.`
        ))
      }
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
          <h2 className="text-2xl font-bold mb-2">{tx('Check your email', 'Kiểm tra email của bạn')}</h2>
          <p className="text-neutral-600 mb-6">
            {successMessage}
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            {tx('Back to Login', 'Quay lại đăng nhập')}
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
          <h1 className="text-3xl font-bold text-primary-400 mb-2">{tx('Reset Password', 'Đặt lại mật khẩu')}</h1>
          <p className="text-neutral-600">{tx('Enter email or username to continue', 'Nhập email hoặc tên người dùng để tiếp tục')}</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                label={tx('Email or Username', 'Email hoặc tên người dùng')}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value)
                  setResetMode('')
                  setResolvedEmail('')
                  setResolvedUsername('')
                  setError('')
                  setSecretKey('')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                placeholder={tx('you@example.com or your.username', 'you@example.com hoặc your.username')}
              />
            </div>

            {resetMode === 'email' && (
              <p className="text-xs text-neutral-600">
                {tx(
                  `This account uses email reset. We will send a reset link to ${resolvedEmail || String(identifier || '').trim().toLowerCase()}.`,
                  `Tài khoản này dùng reset qua email. Chúng tôi sẽ gửi link đặt lại tới ${resolvedEmail || String(identifier || '').trim().toLowerCase()}.`
                )}
              </p>
            )}

            {resetMode === 'app_secret' && (
              <>
                <p className="text-xs text-neutral-600">
                  {tx(
                    `Account ${resolvedUsername || String(identifier || '').trim().toLowerCase()} uses app secret reset. Enter a valid secret key and new password.`,
                    `Tài khoản ${resolvedUsername || String(identifier || '').trim().toLowerCase()} dùng reset bằng app secret. Hãy nhập secret key hợp lệ và mật khẩu mới.`
                  )}
                </p>
                <Input
                  label={tx('Secret Key', 'Secret key')}
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder={tx('Provided by admin', 'Do admin cung cấp')}
                />
                <Input
                  label={tx('New Password', 'Mật khẩu mới')}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <Input
                  label={tx('Confirm New Password', 'Xác nhận mật khẩu mới')}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  error={
                    confirmPassword && confirmPassword !== newPassword
                      ? tx('Passwords do not match', 'Mật khẩu xác nhận không khớp')
                      : ''
                  }
                />
              </>
            )}

            {error && (
              <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={
                !identifier.trim()
                || loading
                || (resetMode === 'app_secret' && (!secretKey.trim() || !newPassword || !confirmPassword))
              }
              loading={loading}
              className="w-full"
            >
              {tx('Reset Password', 'Đặt lại mật khẩu')}
            </Button>
          </form>
        </Card>
      </div>
    </motion.div>
  )
}
