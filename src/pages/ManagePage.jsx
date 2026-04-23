import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Card, Button, BottomNav, Input, Modal } from '../components'
import {
  deleteUserProfile,
  getAllTeams,
  getAppUsers,
  getUserProfile,
  updateUserRole,
} from '../lib/api'
import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export const ManagePage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [activeTab, setActiveTab] = useState('teams')
  const [actionTargetId, setActionTargetId] = useState(null)
  const [userSearch, setUserSearch] = useState('')
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
      const [profileData, teamsData, usersData] = await Promise.all([
        getUserProfile(user.id),
        getAllTeams(),
        getAppUsers(),
      ])

      const isAdminRole = (profileData.role || '').toLowerCase() === 'admin'
      const nextTeams = isAdminRole ? teamsData : []

      setProfile(profileData)
      setTeams(nextTeams)
      setAppUsers(isAdminRole ? usersData : [])
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
                    <p className="font-semibold">Teams and users admin tools</p>
                  </div>
                </div>
              </Card>

              <Card className="p-2 space-y-2 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 px-2">
                  Sections
                </p>
                <div className="grid grid-cols-2 gap-2">
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
                                Created {new Date(team.created_at).toLocaleDateString()}
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
              ) : (
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
