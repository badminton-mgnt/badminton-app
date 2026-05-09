import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Card, Button, BottomNav, Input, Modal } from '../components'
import {
  createAppSignupSecret,
  revokeAppSignupSecret,
  deleteUserProfile,
  getAllTeams,
  getNotificationsRetentionDays,
  getAppSignupSecrets,
  getAppUsers,
  getUserProfile,
  updateNotificationsRetentionDays,
  updateUserRole,
} from '../lib/api'
import { formatVietnamDate, formatVietnamDateTime, toUnixTimestamp } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

const maskAppSecretKey = (secretKey) => {
  const key = String(secretKey || '')
  if (!key) return ''
  if (key.length <= 10) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

export const ManagePage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { language } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [appSecrets, setAppSecrets] = useState([])
  const [activeTab, setActiveTab] = useState('teams')
  const [actionTargetId, setActionTargetId] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [notificationsRetentionDays, setNotificationsRetentionDays] = useState('10')
  const [notificationsRetentionFeedback, setNotificationsRetentionFeedback] = useState('')
  const [notificationsRetentionError, setNotificationsRetentionError] = useState('')
  const [secretFeedback, setSecretFeedback] = useState('')
  const [secretError, setSecretError] = useState('')
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [nextRole, setNextRole] = useState('user')
  const [modalActionLoading, setModalActionLoading] = useState(false)
  const [deleteUserConfirmOpen, setDeleteUserConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const profileData = await getUserProfile(user.id)
      setProfile(profileData)

      const isAdminRole = (profileData.role || '').toLowerCase() === 'admin'

      let nextTeams = []
      let nextUsers = []
      let nextSecrets = []
      let nextNotificationsRetentionDays = 10

      if (isAdminRole) {
        const [teamsData, usersData, secretsData, retentionDaysData] = await Promise.allSettled([
          getAllTeams(),
          getAppUsers(),
          getAppSignupSecrets(),
          getNotificationsRetentionDays(),
        ])

        if (teamsData.status === 'fulfilled') {
          nextTeams = teamsData.value
        } else {
          console.error('Error loading teams:', teamsData.reason)
        }

        if (usersData.status === 'fulfilled') {
          nextUsers = usersData.value
        } else {
          console.error('Error loading users:', usersData.reason)
        }

        if (secretsData.status === 'fulfilled') {
          nextSecrets = secretsData.value
        } else {
          console.error('Error loading app secrets:', secretsData.reason)
        }

        if (retentionDaysData.status === 'fulfilled') {
          nextNotificationsRetentionDays = retentionDaysData.value
        } else {
          console.error('Error loading notifications retention days:', retentionDaysData.reason)
        }
      }

      setTeams(nextTeams)
      setAppUsers(nextUsers)
      setAppSecrets(nextSecrets)
      setNotificationsRetentionDays(String(nextNotificationsRetentionDays))
    } catch (error) {
      console.error('Error loading manage data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openUserModal = (targetUser) => {
    setSelectedUser(targetUser)
    setNextRole((targetUser.role || 'user').toLowerCase())
    setUserModalOpen(true)
  }

  const closeUserModal = () => {
    setUserModalOpen(false)
    setDeleteUserConfirmOpen(false)
    setSelectedUser(null)
    setNextRole('user')
    setModalActionLoading(false)
  }

  const handleRequestDeleteUser = () => {
    if (!selectedUser) return
    setDeleteUserConfirmOpen(true)
  }

  const handleSaveRole = async () => {
    if (!selectedUser) return

    try {
      setModalActionLoading(true)
      setActionTargetId(`role-${selectedUser.id}`)
      await updateUserRole(selectedUser.id, nextRole)
      await loadData()
      closeUserModal()
    } catch (error) {
      console.error('Error updating user role:', error)
      setModalActionLoading(false)
    } finally {
      setActionTargetId(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      setModalActionLoading(true)
      setActionTargetId(`delete-${selectedUser.id}`)
      await deleteUserProfile(selectedUser.id)
      await loadData()
      closeUserModal()
    } catch (error) {
      console.error('Error deleting user:', error)
      setModalActionLoading(false)
    } finally {
      setActionTargetId(null)
    }
  }

  const handleGenerateSecret = async () => {
    try {
      setActionTargetId('secret-generate')
      setSecretFeedback('')
      setSecretError('')
      const createdSecret = await createAppSignupSecret({ maxUses: 10, expiresInHours: 1 })
      setAppSecrets((prev) => [createdSecret, ...prev])
      setSecretFeedback(tx('Key created', 'Đã tạo key'))
    } catch (error) {
      console.error('Error generating app secret:', error)
      setSecretError(error?.message || tx('Unable to generate app secret key.', 'Không thể tạo app secret key.'))
    } finally {
      setActionTargetId(null)
    }
  }

  const handleRevokeSecret = async (secretId) => {
    const targetSecret = appSecrets.find((secret) => secret.id === secretId)
    if (!targetSecret) return

    const expiresAtMs = toUnixTimestamp(targetSecret.expires_at)
    const isExpired = expiresAtMs === null ? false : expiresAtMs <= Date.now()
    const isUsedUp = Number(targetSecret.used_count || 0) >= Number(targetSecret.max_uses || 0)
    const canRevoke = Boolean(targetSecret.is_active) && !isExpired && !isUsedUp

    if (!canRevoke) {
      return
    }

    try {
      setActionTargetId(`secret-revoke-${secretId}`)
      setSecretFeedback('')
      setSecretError('')
      const revokedSecret = await revokeAppSignupSecret(secretId)
      setAppSecrets((prev) => prev.map((secret) => (
        secret.id === secretId
          ? {
            ...secret,
            is_active: false,
            revoked_at: revokedSecret?.revoked_at || new Date().toISOString(),
            revoked_by: revokedSecret?.revoked_by || secret.revoked_by,
          }
          : secret
      )))
    } catch (error) {
      console.error('Error revoking app secret:', error)
      setSecretError(error?.message || tx('Unable to revoke this key.', 'Không thể vô hiệu key này.'))
    } finally {
      setActionTargetId(null)
    }
  }

  const handleCopySecret = async (secretKey) => {
    try {
      await navigator.clipboard.writeText(secretKey)
      setSecretFeedback(tx('Key copied', 'Đã sao chép key'))
      setSecretError('')
    } catch (error) {
      console.error('Error copying app secret:', error)
      setSecretError(tx('Unable to copy key to clipboard.', 'Không thể sao chép key vào clipboard.'))
    }
  }

  const handleSaveNotificationsRetentionDays = async () => {
    try {
      setActionTargetId('notifications-retention-save')
      setNotificationsRetentionFeedback('')
      setNotificationsRetentionError('')

      const savedDays = await updateNotificationsRetentionDays(notificationsRetentionDays)
      setNotificationsRetentionDays(String(savedDays))
      setNotificationsRetentionFeedback(tx('Saved', 'Đã lưu'))
    } catch (error) {
      console.error('Error updating notifications retention days:', error)
      setNotificationsRetentionError(error?.message || tx('Unable to update notifications retention days.', 'Không thể cập nhật số ngày lưu thông báo.'))
    } finally {
      setActionTargetId(null)
    }
  }

  const isAdmin = (profile?.role || '').toLowerCase() === 'admin'
  const normalizedUserSearch = userSearch.trim().toLowerCase()
  const filteredAppUsers = useMemo(
    () => appUsers.filter((appUser) => appUser.name.toLowerCase().includes(normalizedUserSearch)),
    [appUsers, normalizedUserSearch]
  )

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
      <Header title={tx('Manage', 'Quản lý')} subtitle={isAdmin ? tx('Admin tools', 'Công cụ quản trị') : tx('Access limited', 'Truy cập hạn chế')} />

      <div className="container-mobile py-6 space-y-6">
        {!isAdmin ? (
          <Card className="text-center py-8">
            <p className="text-neutral-600 mb-3">
              {tx('Only admin users can access management tools.', 'Chỉ admin mới có quyền truy cập công cụ quản lý.')}
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
              className="w-full"
            >
              {tx('Back Home', 'Về Trang chủ')}
            </Button>
          </Card>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-primary-50 p-3">
                    <Settings2 size={22} className="text-primary-400" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-600">{tx('Management Area', 'Khu vực quản lý')}</p>
                    <p className="font-semibold">{tx('Teams, users and app-secret admin tools', 'Quản lý team, người dùng và app secret')}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-2 space-y-2 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 px-2">
                  {tx('Sections', 'Danh mục')}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === 'teams'
                        ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    onClick={() => setActiveTab('teams')}
                  >
                    {tx('Teams', 'Team')}
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === 'users'
                        ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    onClick={() => setActiveTab('users')}
                  >
                    {tx('Users', 'Người dùng')}
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === 'app-secrets'
                        ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    onClick={() => setActiveTab('app-secrets')}
                  >
                    {tx('App Secrets', 'App Secret')}
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === 'app-settings'
                        ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    onClick={() => setActiveTab('app-settings')}
                  >
                    {tx('App Settings', 'Cài đặt app')}
                  </button>
                </div>
              </Card>

              {activeTab === 'teams' ? (
                <>
                  <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                    {tx(`Teams (${teams.length})`, `Team (${teams.length})`)}
                  </h2>
                  <div className="space-y-3">
                    {teams.length === 0 ? (
                      <Card className="text-center py-6">
                        <p className="text-neutral-600">{tx('No teams available to manage.', 'Không có team nào để quản lý.')}</p>
                      </Card>
                    ) : (
                      teams.map((team) => (
                        <Card
                          key={team.id}
                          onClick={() => navigate(`/team/${team.id}`)}
                          className="cursor-pointer hover:shadow-lg transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{team.name}</p>
                              <p className="text-xs text-neutral-600">
                                {tx('Created', 'Tạo')} {formatVietnamDate(team.created_at, '-')}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/team/${team.id}`)
                              }}
                            >
                              {tx('Manage', 'Quản lý')}
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </>
              ) : activeTab === 'users' ? (
                <div className="space-y-4">
                  <Card className="space-y-3">
                    <h3 className="text-sm font-semibold text-neutral-700 uppercase">
                      {tx(`App Users (${filteredAppUsers.length})`, `Người dùng app (${filteredAppUsers.length})`)}
                    </h3>
                    <Input
                      label={tx('Search user', 'Tìm người dùng')}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={tx('Type a name', 'Nhập tên')}
                    />
                    <div className="space-y-2">
                      {filteredAppUsers.map((appUser) => {
                        return (
                          <button
                            key={appUser.id}
                            type="button"
                            className="w-full text-left flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                            onClick={() => openUserModal(appUser)}
                          >
                            <div>
                              <p className="font-semibold text-sm">{appUser.name}</p>
                              <p className="text-xs text-neutral-600 uppercase">{tx('Role', 'Vai trò')}: {String(appUser.role || 'user').toLowerCase()}</p>
                            </div>
                            <span className="text-xs text-neutral-500">{tx('Manage', 'Quản lý')}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              ) : activeTab === 'app-secrets' ? (
                <div className="space-y-4">
                  <Card className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 uppercase">{tx('App Secret Keys', 'App Secret Key')}</h3>
                        <p className="text-xs text-neutral-500">{tx('Generated by admin. Each key: max 10 users, expires in 1 hour.', 'Tạo bởi admin. Mỗi key: tối đa 10 người dùng, hết hạn sau 1 giờ.')}</p>
                      </div>
                      <Button
                        onClick={handleGenerateSecret}
                        loading={actionTargetId === 'secret-generate'}
                        disabled={actionTargetId === 'secret-generate'}
                      >
                        {tx('Generate Key', 'Tạo key')}
                      </Button>
                    </div>

                    {secretFeedback ? (
                      <div className="bg-success-50 text-success-800 p-3 rounded-xl text-sm">{secretFeedback}</div>
                    ) : null}

                    {secretError ? (
                      <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">{secretError}</div>
                    ) : null}

                    <div className="space-y-3">
                      {appSecrets.length === 0 ? (
                        <p className="text-sm text-neutral-600">{tx('No app secret keys yet.', 'Chưa có app secret key.')}</p>
                      ) : (
                        appSecrets.map((secret) => {
                          const expiresAtMs = toUnixTimestamp(secret.expires_at)
                          const isExpired = expiresAtMs === null ? false : expiresAtMs <= Date.now()
                          const isUsedUp = Number(secret.used_count || 0) >= Number(secret.max_uses || 0)
                          const canRevoke = Boolean(secret.is_active) && !isExpired && !isUsedUp
                          const shouldShowActions = Boolean(secret.is_active) && !isExpired
                          const usageLabel = `${secret.used_count}/${secret.max_uses}`
                          const statusLabel = !secret.is_active
                            ? tx('Revoked', 'Đã vô hiệu')
                            : isExpired
                              ? tx('Expired', 'Hết hạn')
                              : isUsedUp
                                ? tx('Used up', 'Hết lượt')
                                : tx('Active', 'Đang hoạt động')

                          return (
                            <Card key={secret.id} className="border border-neutral-200">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-sm break-all">{maskAppSecretKey(secret.secret_key)}</p>
                                    <p className="text-xs text-neutral-500">
                                      {tx('Created by', 'Tạo bởi')} {secret.users?.name || 'Admin'} • {formatVietnamDateTime(secret.created_at, '-')}
                                    </p>
                                  </div>
                                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-700">
                                    {statusLabel}
                                  </span>
                                </div>

                                <div className="text-xs text-neutral-600 flex flex-wrap gap-x-4 gap-y-1">
                                  <span>{tx('Usage', 'Lượt dùng')}: {usageLabel}</span>
                                  <span>{tx('Expires', 'Hết hạn')}: {formatVietnamDateTime(secret.expires_at, '-')}</span>
                                  {secret.revoked_at ? <span>{tx('Revoked', 'Vô hiệu')}: {formatVietnamDateTime(secret.revoked_at, '-')}</span> : null}
                                </div>

                                {shouldShowActions ? (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="secondary"
                                      className="flex-1"
                                      onClick={() => handleCopySecret(secret.secret_key)}
                                    >
                                      {tx('Copy', 'Sao chép')}
                                    </Button>
                                    <Button
                                      variant="danger"
                                      className="flex-1"
                                      onClick={() => handleRevokeSecret(secret.id)}
                                      loading={actionTargetId === `secret-revoke-${secret.id}`}
                                      disabled={!canRevoke || actionTargetId === `secret-revoke-${secret.id}`}
                                    >
                                      {tx('Revoke', 'Vô hiệu')}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            </Card>
                          )
                        })
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 uppercase">{tx('App Settings', 'Cài đặt app')}</h3>
                      <p className="text-xs text-neutral-500">{tx('Global settings for app behavior.', 'Cài đặt toàn cục cho hành vi ứng dụng.')}</p>
                    </div>

                    <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">{tx('Notifications Retention Days', 'Số ngày lưu thông báo')}</p>
                        <p className="text-xs text-neutral-600">{tx('Notifications older than this value are deleted automatically by cron.', 'Thông báo cũ hơn mốc này sẽ được cron tự động xóa.')}</p>
                      </div>

                      <Input
                        label={tx('Retention Days', 'Số ngày lưu')}
                        type="number"
                        min={1}
                        max={365}
                        value={notificationsRetentionDays}
                        onChange={(e) => setNotificationsRetentionDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                        placeholder="10"
                      />

                      {notificationsRetentionFeedback ? (
                        <div className="bg-success-50 text-success-800 p-3 rounded-xl text-sm">{notificationsRetentionFeedback}</div>
                      ) : null}

                      {notificationsRetentionError ? (
                        <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">{notificationsRetentionError}</div>
                      ) : null}

                      <Button
                        onClick={handleSaveNotificationsRetentionDays}
                        loading={actionTargetId === 'notifications-retention-save'}
                        disabled={!notificationsRetentionDays || actionTargetId === 'notifications-retention-save'}
                        className="w-full"
                      >
                        {tx('Save', 'Lưu')}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>

      <Modal
        isOpen={userModalOpen}
        onClose={closeUserModal}
        title={tx('Manage User', 'Quản lý người dùng')}
        footer={(
          <div className="flex gap-2 w-full">
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleRequestDeleteUser}
              loading={modalActionLoading && actionTargetId === `delete-${selectedUser?.id}`}
              disabled={!selectedUser || String(selectedUser.id) === String(user.id) || (selectedUser?.role || '').toLowerCase() === 'admin'}
            >
              {tx('Delete User', 'Xóa người dùng')}
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveRole}
              loading={modalActionLoading && actionTargetId === `role-${selectedUser?.id}`}
              disabled={!selectedUser || String(selectedUser.id) === String(user.id)}
            >
              {tx('Save Role', 'Lưu vai trò')}
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-600">{tx('User', 'Người dùng')}</p>
            <p className="font-semibold">{selectedUser?.name || '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">{tx('Role', 'Vai trò')}</label>
            <select
              className="input-field"
              value={nextRole}
              onChange={(e) => setNextRole(e.target.value)}
              disabled={!selectedUser || String(selectedUser.id) === String(user.id)}
            >
              <option value="user">user</option>
              <option value="sub_admin">sub_admin</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteUserConfirmOpen}
        onClose={() => setDeleteUserConfirmOpen(false)}
        title={tx('Delete User', 'Xóa người dùng')}
        footer={(
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteUserConfirmOpen(false)}
              disabled={modalActionLoading && actionTargetId === `delete-${selectedUser?.id}`}
            >
              {tx('Cancel', 'Hủy')}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteUser}
              loading={modalActionLoading && actionTargetId === `delete-${selectedUser?.id}`}
              disabled={!selectedUser || String(selectedUser.id) === String(user.id) || (selectedUser?.role || '').toLowerCase() === 'admin'}
            >
              {tx('Delete', 'Xóa')}
            </Button>
          </div>
        )}
      >
        <p className="text-sm text-neutral-600">
          {tx(
            `Are you sure you want to delete user "${selectedUser?.name || ''}"? This action cannot be undone.`,
            `Bạn có chắc muốn xóa người dùng "${selectedUser?.name || ''}"? Hành động này không thể hoàn tác.`
          )}
        </p>
      </Modal>

      <BottomNav />
    </motion.div>
  )
}
