import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Header, Card, Button, BottomNav, Modal, Input } from '../components'
import { getUserProfile, logout, getTeams, getPaymentInfo, setPaymentInfo } from '../lib/api'
import { getVisibleUserEmail } from '../lib/accountIdentity'
import { formatVietnamDate } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { LogOut, Edit2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTheme } from '../contexts/ThemeContext'

const TEXT_INPUT_MAX_LENGTH = 100
const NUMERIC_INPUT_MAX_LENGTH = 20

export const ProfilePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { language, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [paymentInfo, setPaymentInfoState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [qrUploadError, setQrUploadError] = useState('')
  const [paymentForm, setPaymentForm] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    qr_url: '',
  })
  const visibleEmail = getVisibleUserEmail(user?.email)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  useEffect(() => {
    if (!location.state?.navRefreshAt || !user) return

    loadData()
  }, [location.state?.navRefreshAt])

  const loadData = async () => {
    try {
      const [profileData, teamsData, paymentData] = await Promise.all([
        getUserProfile(user.id),
        getTeams(user.id),
        getPaymentInfo(user.id),
      ])

      setProfile(profileData)
      setTeams(teamsData)
      if (paymentData) {
        setPaymentInfoState(paymentData)
        setPaymentForm({
          bank_name: paymentData.bank_name || '',
          account_number: paymentData.account_number || '',
          account_name: paymentData.account_name || '',
          qr_url: paymentData.qr_url || '',
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePaymentInfo = async () => {
    try {
      await setPaymentInfo(user.id, paymentForm)
      setPaymentModalOpen(false)
      loadData()
    } catch (error) {
      console.error('Error saving payment info:', error)
    }
  }

  const handleQrImageChange = (event) => {
    const file = event.target.files?.[0]
    setQrUploadError('')

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setQrUploadError(tx('Please select an image file.', 'Vui lòng chọn một tệp hình ảnh.'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPaymentForm((prev) => ({ ...prev, qr_url: String(reader.result || '') }))
    }
    reader.onerror = () => {
      setQrUploadError(tx('Unable to read this image. Please try another file.', 'Không thể đọc ảnh này. Vui lòng thử ảnh khác.'))
    }
    reader.readAsDataURL(file)
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-24"
    >
      <Header title={t('profile.title')} action={
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
        >
          <LogOut size={20} className="text-white" />
        </button>
      } />

      <div className="container-mobile py-6 space-y-6">
        {/* Profile Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-neutral-600">{tx('Name', 'Tên')}</p>
                <p className="text-lg font-semibold">{profile?.name}</p>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-neutral-600">{tx('Role', 'Vai trò')}</p>
              <p className="text-lg font-semibold capitalize">
                {profile?.role?.replace('_', ' ') || tx('User', 'Người dùng')}
              </p>
            </div>
            {visibleEmail ? (
              <div>
                <p className="text-sm text-neutral-600">{tx('Email', 'Email')}</p>
                <p className="text-lg font-semibold">{visibleEmail}</p>
              </div>
            ) : null}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card>
            <div className="space-y-3">
              <p className="text-lg font-semibold">{tx('Appearance', 'Giao diện')}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-neutral-700">{tx('Theme', 'Chủ đề')}</p>
                <div className="w-full sm:w-52">
                <select
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  className="input-field"
                >
                  <option value="light">{tx('Light Mode', 'Chế độ sáng')}</option>
                  <option value="dark">{tx('Dark Mode', 'Chế độ tối')}</option>
                </select>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Payment Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-600 uppercase">
              {tx('Payment Information', 'Thông tin thanh toán')}
            </h2>
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="p-2 hover:bg-neutral-200 rounded-lg transition"
            >
              <Edit2 size={18} className="text-primary-400" />
            </button>
          </div>
          {paymentInfo ? (
            <Card className="space-y-3">
              <div>
                <p className="text-xs text-neutral-600">{tx('Bank Name', 'Tên ngân hàng')}</p>
                <p className="font-semibold">{paymentInfo.bank_name}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">{tx('Account Name', 'Tên tài khoản')}</p>
                <p className="font-semibold">{paymentInfo.account_name}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">{tx('Account Number', 'Số tài khoản')}</p>
                <p className="font-mono text-sm font-semibold">{paymentInfo.account_number}</p>
              </div>
              {paymentInfo.qr_url && (
                <div>
                  <p className="text-xs text-neutral-600 mb-2">{tx('QR Code', 'Mã QR')}</p>
                  <img
                    src={paymentInfo.qr_url}
                    alt={tx('Payment QR', 'QR thanh toán')}
                    className="w-full max-w-56 rounded-lg border border-neutral-200"
                  />
                </div>
              )}
            </Card>
          ) : (
            <Card className="text-center py-8">
              <p className="text-neutral-600 mb-3">{tx('No payment info set yet', 'Chưa có thông tin thanh toán')}</p>
              <Button
                onClick={() => setPaymentModalOpen(true)}
                variant="secondary"
                className="w-full"
              >
                {tx('Add Payment Info', 'Thêm thông tin thanh toán')}
              </Button>
            </Card>
          )}
        </motion.div>

        {/* Teams */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
            {tx('Teams', 'Các team')} ({teams.length})
          </h2>
          <div className="space-y-3">
            {teams.map((team) => (
              <Card
                key={team.team_id}
                onClick={() => navigate(`/team/${team.team_id}`)}
                className="cursor-pointer hover:shadow-lg transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{team.teams.name}</p>
                    <p className="text-xs text-neutral-600">
                      {tx('Joined', 'Tham gia')} {formatVietnamDate(team.joined_at, '-')}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Payment Info Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={tx('Payment Information', 'Thông tin thanh toán')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPaymentModalOpen(false)}
              className="flex-1"
            >
              {tx('Cancel', 'Hủy')}
            </Button>
            <Button
              onClick={handleSavePaymentInfo}
              className="flex-1"
            >
              {tx('Save', 'Lưu')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={tx('Bank Name', 'Tên ngân hàng')}
            value={paymentForm.bank_name}
            onChange={(e) => setPaymentForm(prev => ({ ...prev, bank_name: e.target.value.slice(0, TEXT_INPUT_MAX_LENGTH) }))}
            maxLength={TEXT_INPUT_MAX_LENGTH}
            placeholder={tx('e.g., HDFC Bank', 'ví dụ: Vietcombank')}
          />
          <Input
            label={tx('Account Name', 'Tên tài khoản')}
            value={paymentForm.account_name}
            onChange={(e) => setPaymentForm(prev => ({ ...prev, account_name: e.target.value.slice(0, TEXT_INPUT_MAX_LENGTH) }))}
            maxLength={TEXT_INPUT_MAX_LENGTH}
            placeholder={tx('Your name', 'Tên của bạn')}
          />
          <Input
            label={tx('Account Number', 'Số tài khoản')}
            value={paymentForm.account_number}
            onChange={(e) => setPaymentForm(prev => ({
              ...prev,
              account_number: e.target.value.replace(/\D/g, '').slice(0, NUMERIC_INPUT_MAX_LENGTH),
            }))}
            maxLength={NUMERIC_INPUT_MAX_LENGTH}
            placeholder="1234567890"
          />
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              {tx('Attach QR Image', 'Đính kèm ảnh QR')}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleQrImageChange}
              className="input-field"
            />
            {qrUploadError && (
              <p className="text-xs text-error-800 mt-1">{qrUploadError}</p>
            )}
            {paymentForm.qr_url && (
              <img
                src={paymentForm.qr_url}
                alt={tx('QR preview', 'Xem trước QR')}
                className="mt-3 w-full max-w-56 rounded-lg border border-neutral-200"
              />
            )}
          </div>
        </div>
      </Modal>

      <BottomNav />
    </motion.div>
  )
}
