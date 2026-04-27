import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Card, Button, BottomNav, Input, Modal } from '../components'
import {
  createAppSignupSecret,
  revokeAppSignupSecret,
  deleteUserProfile,
  getAllTeams,
  getAppSignupSecrets,
  getAppUsers,
  getUserProfile,
  updateUserRole,
} from '../lib/api'
import { formatVietnamDate, formatVietnamDateTime, toUnixTimestamp } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const maskAppSecretKey = (secretKey) => {
  const key = String(secretKey || '')
  if (!key) return ''
  if (key.length <= 10) return key
  return `${key.slice(0, 8)}...${key.slice(-4)}`
}

export const ManagePage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [appSecrets, setAppSecrets] = useState([])
  const [activeTab, setActiveTab] = useState('teams')
  const [actionTargetId, setActionTargetId] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [secretFeedback, setSecretFeedback] = useState('')
  const [secretError, setSecretError] = useState('')
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [nextRole, setNextRole] = useState('user')
  const [modalActionLoading, setModalActionLoading] = useState(false)
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

      if (isAdminRole) {
        const [teamsData, usersData, secretsData] = await Promise.allSettled([
          getAllTeams(),
          getAppUsers(),
          getAppSignupSecrets(),
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
      }

      setTeams(nextTeams)
      setAppUsers(nextUsers)
      setAppSecrets(nextSecrets)
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
    setSelectedUser(null)
    setNextRole('user')
    setModalActionLoading(false)
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
      setSecretFeedback('Key created')
    } catch (error) {
      console.error('Error generating app secret:', error)
      setSecretError(error?.message || 'Unable to generate app secret key.')
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
      setSecretError(error?.message || 'Unable to revoke this key.')
    } finally {
      setActionTargetId(null)
    }
  }

  const handleCopySecret = async (secretKey) => {
    try {
      await navigator.clipboard.writeText(secretKey)
      setSecretFeedback('Key copied')
      setSecretError('')
    } catch (error) {
      console.error('Error copying app secret:', error)
      setSecretError('Unable to copy key to clipboard.')
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
      <Header title="Manage" subtitle={isAdmin ? 'Admin tools' : 'Access limited'} />

      <div className="container-mobile py-6 space-y-6">
        {!isAdmin ? (
          <Card className="text-center py-8">
            <p className="text-neutral-600 mb-3">
              Only admin users can access management tools.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Back Home
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
                    <p className="text-sm text-neutral-600">Management Area</p>
                    <p className="font-semibold">Teams, users and app-secret admin tools</p>
                  </div>
                </div>
              </Card>

              <Card className="p-2 space-y-2 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 px-2">
                  Sections
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === 'teams'
                        ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    onClick={() => setActiveTab('teams')}
                  >
                    Teams
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
                    Users
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
                    App Secrets
                  </button>
                </div>
              </Card>

              {activeTab === 'teams' ? (
                <>
                  <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                    Teams ({teams.length})
                  </h2>
                  <div className="space-y-3">
                    {teams.length === 0 ? (
                      <Card className="text-center py-6">
                        <p className="text-neutral-600">No teams available to manage.</p>
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
                                Created {formatVietnamDate(team.created_at, '-')}
                              </p>
                            </div>
                            <Button
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/team/${team.id}`)
                              }}
                            >
                              Manage
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
                      App Users ({filteredAppUsers.length})
                    </h3>
                    <Input
                      label="Search user"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Type a name"
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
                              <p className="text-xs text-neutral-600 uppercase">Role: {String(appUser.role || 'user').toLowerCase()}</p>
                            </div>
                            <span className="text-xs text-neutral-500">Manage</span>
                          </button>
                        )
                      })}
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <Card className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-700 uppercase">App Secret Keys</h3>
                        <p className="text-xs text-neutral-500">Generated by admin. Each key: max 10 users, expires in 1 hour.</p>
                      </div>
                      <Button
                        onClick={handleGenerateSecret}
                        loading={actionTargetId === 'secret-generate'}
                        disabled={actionTargetId === 'secret-generate'}
                      >
                        Generate Key
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
                        <p className="text-sm text-neutral-600">No app secret keys yet.</p>
                      ) : (
                        appSecrets.map((secret) => {
                          const expiresAtMs = toUnixTimestamp(secret.expires_at)
                          const isExpired = expiresAtMs === null ? false : expiresAtMs <= Date.now()
                          const isUsedUp = Number(secret.used_count || 0) >= Number(secret.max_uses || 0)
                          const canRevoke = Boolean(secret.is_active) && !isExpired && !isUsedUp
                          const shouldShowActions = Boolean(secret.is_active) && !isExpired
                          const usageLabel = `${secret.used_count}/${secret.max_uses}`
                          const statusLabel = !secret.is_active
                            ? 'Revoked'
                            : isExpired
                              ? 'Expired'
                              : isUsedUp
                                ? 'Used up'
                                : 'Active'

                          return (
                            <Card key={secret.id} className="border border-neutral-200">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-sm break-all">{maskAppSecretKey(secret.secret_key)}</p>
                                    <p className="text-xs text-neutral-500">
                                      Created by {secret.users?.name || 'Admin'} • {formatVietnamDateTime(secret.created_at, '-')}
                                    </p>
                                  </div>
                                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-700">
                                    {statusLabel}
                                  </span>
                                </div>

                                <div className="text-xs text-neutral-600 flex flex-wrap gap-x-4 gap-y-1">
                                  <span>Usage: {usageLabel}</span>
                                  <span>Expires: {formatVietnamDateTime(secret.expires_at, '-')}</span>
                                  {secret.revoked_at ? <span>Revoked: {formatVietnamDateTime(secret.revoked_at, '-')}</span> : null}
                                </div>

                                {shouldShowActions ? (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="secondary"
                                      className="flex-1"
                                      onClick={() => handleCopySecret(secret.secret_key)}
                                    >
                                      Copy
                                    </Button>
                                    <Button
                                      variant="danger"
                                      className="flex-1"
                                      onClick={() => handleRevokeSecret(secret.id)}
                                      loading={actionTargetId === `secret-revoke-${secret.id}`}
                                      disabled={!canRevoke || actionTargetId === `secret-revoke-${secret.id}`}
                                    >
                                      Revoke
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
              )}
            </motion.div>
          </>
        )}
      </div>

      <Modal
        isOpen={userModalOpen}
        onClose={closeUserModal}
        title="Manage User"
        footer={(
          <div className="flex gap-2 w-full">
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteUser}
              loading={modalActionLoading && actionTargetId === `delete-${selectedUser?.id}`}
              disabled={!selectedUser || String(selectedUser.id) === String(user.id) || (selectedUser?.role || '').toLowerCase() === 'admin'}
            >
              Delete User
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveRole}
              loading={modalActionLoading && actionTargetId === `role-${selectedUser?.id}`}
              disabled={!selectedUser || String(selectedUser.id) === String(user.id)}
            >
              Save Role
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-neutral-600">User</p>
            <p className="font-semibold">{selectedUser?.name || '-'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Role</label>
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

      <BottomNav />
    </motion.div>
  )
}
