import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Button, Card } from '../components'
import { isUsernameTaken, signupWithAppSecret, signupWithEmail } from '../lib/api'
import { motion } from 'framer-motion'
import { CheckCircle, Circle } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/

export const SignupPage = () => {
  const navigate = useNavigate()
  const { language, setLanguage } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const usernameCheckRequestRef = useRef(0)
  const [signupMode, setSignupMode] = useState('email')
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    appSecret: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showVerification, setShowVerification] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [usernameCheckState, setUsernameCheckState] = useState('idle')
  const [usernameSuggestions, setUsernameSuggestions] = useState([])

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
  const normalizedUsername = String(formData.username || '').trim().toLowerCase()
  const trimmedName = String(formData.name || '').trim()
  const trimmedEmail = String(formData.email || '').trim()
  const trimmedAppSecret = String(formData.appSecret || '').trim()
  const isUsernameValid = USERNAME_REGEX.test(normalizedUsername)
  const isEmailMode = signupMode === 'email'
  const isUsernameAvailable = isUsernameValid && usernameCheckState !== 'taken'
  const isFormValid = isEmailMode
    ? trimmedName && trimmedEmail && isPasswordValid && isPasswordMatching
    : trimmedName && trimmedAppSecret && isUsernameAvailable && isPasswordValid && isPasswordMatching

  const getSuggestedUsernames = async (baseUsername) => {
    const base = String(baseUsername || '').trim().toLowerCase()
    if (!base) return []

    const candidateSet = new Set([
      `${base}1`,
      `${base}01`,
      `${base}2026`,
      `${base}_01`,
      `${base}.01`,
      `${base}${Math.floor(Math.random() * 90) + 10}`,
    ])

    const candidates = Array.from(candidateSet)
      .map((username) => username.slice(0, 30))
      .filter((username) => USERNAME_REGEX.test(username) && username !== base)
      .slice(0, 6)

    const checks = await Promise.all(candidates.map(async (candidate) => ({
      candidate,
      taken: await isUsernameTaken(candidate),
    })))

    return checks
      .filter((item) => !item.taken)
      .map((item) => item.candidate)
      .slice(0, 3)
  }

  useEffect(() => {
    if (isEmailMode) {
      setUsernameCheckState('idle')
      setUsernameSuggestions([])
      return
    }

    if (!normalizedUsername) {
      setUsernameCheckState('idle')
      setUsernameSuggestions([])
      return
    }

    if (!isUsernameValid) {
      setUsernameCheckState('idle')
      setUsernameSuggestions([])
      return
    }

    const requestId = ++usernameCheckRequestRef.current
    setUsernameCheckState('checking')
    setUsernameSuggestions([])

    const timeoutId = window.setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(normalizedUsername)
        if (requestId !== usernameCheckRequestRef.current) return

        if (!taken) {
          setUsernameCheckState('available')
          return
        }

        setUsernameCheckState('taken')
        const suggestions = await getSuggestedUsernames(normalizedUsername)
        if (requestId !== usernameCheckRequestRef.current) return
        setUsernameSuggestions(suggestions)
      } catch (checkError) {
        console.error('Error checking username:', checkError)
        if (requestId !== usernameCheckRequestRef.current) return
        setUsernameCheckState('error')
        setUsernameSuggestions([])
      }
    }, 350)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isEmailMode, isUsernameValid, normalizedUsername])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleModeChange = (mode) => {
    setSignupMode(mode)
    setError('')
    setUsernameCheckState('idle')
    setUsernameSuggestions([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isEmailMode) {
        await signupWithEmail(trimmedEmail, formData.password, trimmedName)
        setVerificationMessage(tx(
          `We've sent a verification link to ${trimmedEmail}`,
          `Chúng tôi đã gửi link xác minh tới ${trimmedEmail}`
        ))
      } else {
        const usernameTaken = await isUsernameTaken(normalizedUsername)
        if (usernameTaken) {
          setError(tx('Username is already taken. Please choose another one.', 'Tên người dùng đã tồn tại. Vui lòng chọn tên khác.'))
          return
        }

        await signupWithAppSecret(normalizedUsername, formData.password, trimmedName, trimmedAppSecret)
        setVerificationMessage(tx(
          'Your account has been created with app secret. You can login now.',
          'Tài khoản đã được tạo bằng app secret. Bạn có thể đăng nhập ngay.'
        ))
      }
      setShowVerification(true)
    } catch (err) {
      const message = String(err?.message || '')
      const normalizedMessage = message.toLowerCase()
      if (
        normalizedMessage.includes('username is already taken') ||
        normalizedMessage.includes('users_username_unique_idx') ||
        normalizedMessage.includes('duplicate key')
      ) {
        setError(tx('Username is already taken. Please choose another one.', 'Tên người dùng đã tồn tại. Vui lòng chọn tên khác.'))
      } else if (
        normalizedMessage.includes('invalid app secret') ||
        normalizedMessage.includes('app secret has expired') ||
        normalizedMessage.includes('revoked') ||
        normalizedMessage.includes('inactive') ||
        normalizedMessage.includes('database error saving new user') ||
        normalizedMessage.includes('unexpected_failure')
      ) {
        setError(tx('Invalid app secret. Please check with admin.', 'App secret không hợp lệ. Vui lòng liên hệ admin.'))
      } else if (normalizedMessage.includes('app secret usage limit reached')) {
        setError(tx(
          'This app secret already reached the usage limit. Ask admin for a new key.',
          'App secret này đã hết lượt sử dụng. Hãy xin admin key mới.'
        ))
      } else {
        setError(message || tx('Unable to create account right now.', 'Không thể tạo tài khoản lúc này.'))
      }
    } finally {
      setLoading(false)
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '', appSecret: '' }))
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
          <h2 className="text-2xl font-bold mb-2">
            {isEmailMode ? tx('Check your email', 'Kiểm tra email của bạn') : tx('Account created', 'Đã tạo tài khoản')}
          </h2>
          <p className="text-neutral-600 mb-6">
            {verificationMessage}
          </p>
          {isEmailMode ? (
            <p className="text-sm text-neutral-500 mb-6">
              {tx('Please click the link to verify your email address', 'Vui lòng bấm vào link để xác minh địa chỉ email của bạn')}
            </p>
          ) : null}
          <Button onClick={() => navigate('/login')} className="w-full">
            {tx('Go to Login', 'Đi đến đăng nhập')}
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4">
      <div className="container-mobile">
        <div className="mb-8">
          <div className="mb-2 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold text-primary-400">Badminton App</h1>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="language-select"
            >
              <option value="en">EN</option>
              <option value="vi">VI</option>
            </select>
          </div>
          <p className="text-neutral-600">{tx('Create your account', 'Tạo tài khoản của bạn')}</p>
        </div>

        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleModeChange('email')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isEmailMode ? 'bg-white text-primary-400 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                {tx('Email Signup', 'Đăng ký bằng email')}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('app_secret')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  !isEmailMode ? 'bg-white text-primary-400 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
                }`}
              >
                {tx('App Secret Signup', 'Đăng ký bằng app secret')}
              </button>
            </div>

            <Input
              label={tx('Full Name', 'Họ và tên')}
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={tx('Your name', 'Tên của bạn')}
            />

            {isEmailMode ? (
              <Input
                label={tx('Email', 'Email')}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />
            ) : (
              <>
                <Input
                  label={tx('Username', 'Tên người dùng')}
                  name="username"
                  value={formData.username}
                  onChange={(e) => {
                    const nextValue = String(e.target.value || '').toLowerCase().replace(/\s+/g, '')
                    setFormData((prev) => ({ ...prev, username: nextValue }))
                  }}
                  placeholder="your.username"
                  error={
                    formData.username && !isUsernameValid
                      ? tx(
                        'Use 3-30 chars: a-z, 0-9, dot, underscore, hyphen',
                        'Dùng 3-30 ký tự: a-z, 0-9, dấu chấm, gạch dưới, gạch ngang'
                      )
                      : ''
                  }
                />

                {formData.username && isUsernameValid ? (
                  <div className="-mt-2">
                    {usernameCheckState === 'checking' ? (
                      <p className="text-xs text-neutral-500">{tx('Checking username...', 'Đang kiểm tra tên người dùng...')}</p>
                    ) : null}
                    {usernameCheckState === 'available' ? (
                      <p className="text-xs text-success-700">{tx('Username is available.', 'Tên người dùng khả dụng.')}</p>
                    ) : null}
                    {usernameCheckState === 'taken' ? (
                      <div className="space-y-2">
                        <p className="text-xs text-error-800">{tx('Username is already taken.', 'Tên người dùng đã tồn tại.')}</p>
                        {usernameSuggestions.length ? (
                          <div className="flex flex-wrap gap-2">
                            {usernameSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                className="text-xs px-2 py-1 rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                                onClick={() => setFormData((prev) => ({ ...prev, username: suggestion }))}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {usernameCheckState === 'error' ? (
                      <p className="text-xs text-neutral-500">{tx('Could not check username now. You can still submit.', 'Hiện không thể kiểm tra tên người dùng. Bạn vẫn có thể gửi biểu mẫu.')}</p>
                    ) : null}
                  </div>
                ) : null}

                <Input
                  label={tx('App Secret', 'App secret')}
                  type="password"
                  name="appSecret"
                  value={formData.appSecret}
                  onChange={handleChange}
                  placeholder={tx('Provided by admin', 'Do admin cung cấp')}
                />

                <p className="text-xs text-neutral-500 -mt-2">
                  {tx('Please contact the administrator to obtain the key.', 'Vui lòng liên hệ quản trị viên để nhận key.')}
                </p>
              </>
            )}

            <div>
              <Input
                label={tx('Password', 'Mật khẩu')}
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
              />
              <div className="mt-3 space-y-2">
                <PasswordCheck
                  checked={passwordChecks.length}
                  label={tx('8+ characters', 'Tối thiểu 8 ký tự')}
                />
                <PasswordCheck
                  checked={passwordChecks.uppercase}
                  label={tx('Uppercase letter', 'Có chữ hoa')}
                />
                <PasswordCheck
                  checked={passwordChecks.lowercase}
                  label={tx('Lowercase letter', 'Có chữ thường')}
                />
                <PasswordCheck
                  checked={passwordChecks.number}
                  label={tx('Number', 'Có số')}
                />
                <PasswordCheck
                  checked={passwordChecks.special}
                  label={tx('Special character', 'Có ký tự đặc biệt')}
                />
              </div>
            </div>

            <Input
              label={tx('Confirm Password', 'Xác nhận mật khẩu')}
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              error={
                formData.confirmPassword && !isPasswordMatching
                  ? tx('Passwords do not match', 'Mật khẩu xác nhận không khớp')
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
              {isEmailMode
                ? tx('Sign Up with Email', 'Đăng ký bằng email')
                : tx('Sign Up with App Secret', 'Đăng ký bằng app secret')}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-neutral-600">
          {tx('Already have an account?', 'Đã có tài khoản?')}{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-primary-400 font-semibold hover:underline"
          >
            {tx('Login', 'Đăng nhập')}
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
