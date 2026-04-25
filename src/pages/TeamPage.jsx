import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header, Card, Button, BottomNav, Modal, Input, Badge } from '../components'
import { addTeamMember, deleteTeam, getAppUsers, getTeam, getTeamMembers, getUserProfile, leaveTeam, updateTeam, updateTeamTreasurer } from '../lib/api'
import { motion } from 'framer-motion'
import { Edit2, UserPlus, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/TeamContext'
import { formatBangkokDateTime } from '../lib/dateTime'

const TEXT_INPUT_MAX_LENGTH = 100

export const TeamPage = () => {
  const { teamId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshTeams } = useTeam()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [appUsers, setAppUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [teamName, setTeamName] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [addingUserId, setAddingUserId] = useState(null)
  const [currentUserRole, setCurrentUserRole] = useState('user')
  const [savingTeam, setSavingTeam] = useState(false)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [leavingTeam, setLeavingTeam] = useState(false)
  const [assigningTreasurerId, setAssigningTreasurerId] = useState(null)

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    try {
      const [teamData, membersData, usersData, profileData] = await Promise.all([
        getTeam(teamId),
        getTeamMembers(teamId),
        getAppUsers(),
        getUserProfile(user.id),
      ])
      setTeam(teamData)
      setTeamName(teamData.name)
      setMembers(membersData)
      setAppUsers(usersData)
      setCurrentUserRole((profileData.role || 'user').toLowerCase())
    } catch (error) {
      console.error('Error loading team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const canManageTreasurer = ['admin', 'sub_admin'].includes(currentUserRole)
  const hasTreasurer = Boolean(team?.treasurer_id)
  const treasurerMember = members.find((member) => String(member.user_id) === String(team?.treasurer_id))
  const teamCreatedSubtitle = team?.created_at ? `Created at ${formatBangkokDateTime(team.created_at)}` : undefined

  const handleAssignTreasurer = async (memberUserId) => {
    if (!canManageTreasurer || !team?.id) return

    try {
      setAssigningTreasurerId(memberUserId === null ? 'UNSET' : memberUserId)
      await updateTeamTreasurer(team.id, memberUserId)
      await loadData()
      // Refresh the team context to update currentTeam in other components
      await refreshTeams()
    } catch (error) {
      console.error('Error assigning team treasurer:', error)
    } finally {
      setAssigningTreasurerId(null)
    }
  }

  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.user_id))
    return appUsers.filter((appUser) => !memberIds.has(appUser.id))
  }, [appUsers, members])

  const filteredUsers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase()

    if (!keyword) {
      return availableUsers
    }

    return availableUsers.filter((appUser) =>
      appUser.name.toLowerCase().includes(keyword)
    )
  }, [availableUsers, memberSearch])

  const isCurrentUserMember = useMemo(
    () => members.some((member) => member.user_id === user?.id),
    [members, user]
  )

  const handleAddMember = async (userId) => {
    try {
      setAddingUserId(userId)
      await addTeamMember(teamId, userId)
      await loadData()
      setMemberSearch('')
    } catch (error) {
      console.error('Error adding member:', error)
    } finally {
      setAddingUserId(null)
    }
  }

  const handleLeaveTeam = async () => {
    try {
      setLeavingTeam(true)
      await leaveTeam(teamId, user.id)
      navigate('/')
    } catch (error) {
      console.error('Error leaving team:', error)
    } finally {
      setLeavingTeam(false)
    }
  }

  const handleDeleteTeam = async () => {
    try {
      setDeletingTeam(true)
      await deleteTeam(teamId, deleteReason)
      setDeleteModalOpen(false)
      navigate('/')
    } catch (error) {
      console.error('Error deleting team:', error)
    } finally {
      setDeletingTeam(false)
    }
  }

  const handleUpdateTeam = async () => {
    try {
      setSavingTeam(true)
      const updatedTeam = await updateTeam(teamId, teamName)
      setTeam(updatedTeam)
      setTeamName(updatedTeam.name)
      setEditModalOpen(false)
    } catch (error) {
      console.error('Error updating team:', error)
    } finally {
      setSavingTeam(false)
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
      <Header title={team?.name || 'Team Members'} subtitle={teamCreatedSubtitle} />

      <div className="container-mobile py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users size={24} className="text-primary-400" />
                <div>
                  <p className="text-sm text-neutral-600">Total Members</p>
                  <p className="text-2xl font-bold">{members.length}</p>
                </div>
              </div>
              <Button onClick={() => setAddModalOpen(true)}>
                Add User
              </Button>
            </div>
          </Card>

          {currentUserRole === 'admin' && (
            <Card className="mb-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-neutral-600">Admin Team Controls</p>
                  <p className="font-semibold">{team?.name}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setEditModalOpen(true)}
                >
                  <span className="inline-flex items-center gap-2">
                    <Edit2 size={16} />
                    Edit
                  </span>
                </Button>
              </div>
            </Card>
          )}

          {canManageTreasurer && hasTreasurer && (
            <Card className="mb-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-neutral-600">Current Treasurer</p>
                  <p className="font-semibold">{treasurerMember?.users?.name || 'Assigned member'}</p>
                </div>
                <Button
                  variant="secondary"
                  className="!px-3 !py-1.5 text-xs"
                  onClick={() => handleAssignTreasurer(null)}
                  loading={assigningTreasurerId === 'UNSET'}
                  disabled={assigningTreasurerId !== null}
                >
                  Unset Treasurer
                </Button>
              </div>
            </Card>
          )}

          <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
            Members
          </h2>
          <div className="space-y-2">
            {members.map((member) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold">
                      {member.users?.name}
                      {member.user_id === user?.id ? ' (You)' : ''}
                    </p>
                    <p className="text-xs text-neutral-600">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {String(team?.treasurer_id) === String(member.user_id) && (
                      <Badge status="success">Treasurer</Badge>
                    )}
                    {member.users?.role && member.users.role !== 'user' && (
                      <span className="text-xs font-medium uppercase text-primary-400">
                        {member.users.role}
                      </span>
                    )}
                    {canManageTreasurer && !hasTreasurer && String(team?.treasurer_id) !== String(member.user_id) && (
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 text-xs"
                        disabled={assigningTreasurerId === member.user_id}
                        loading={assigningTreasurerId === member.user_id}
                        onClick={() => handleAssignTreasurer(member.user_id)}
                      >
                        Set Treasurer
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="space-y-3">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            className="w-full"
          >
            Back
          </Button>
          {isCurrentUserMember && (
            <Button
              variant="danger"
              onClick={handleLeaveTeam}
              className="w-full"
              loading={leavingTeam}
            >
              Leave Team
            </Button>
          )}
          {currentUserRole === 'admin' && (
            <Button
              variant="danger"
              onClick={() => {
                setDeleteReason('')
                setDeleteModalOpen(true)
              }}
              className="w-full"
            >
              Delete Team
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false)
          setTeamName(team?.name || '')
        }}
        title="Edit Team"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditModalOpen(false)
                setTeamName(team?.name || '')
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTeam}
              className="flex-1"
              loading={savingTeam}
              disabled={!teamName.trim() || teamName.trim() === team?.name}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Team Name"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter team name"
            maxLength={20}
          />
          <p className="text-xs text-neutral-600 text-right">
            {teamName.length}/20
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setDeleteReason('')
        }}
        title="Delete Team"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false)
                setDeleteReason('')
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteTeam}
              className="flex-1"
              loading={deletingTeam}
              disabled={!deleteReason.trim()}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Only admin users can delete a team. Please provide a clear reason before continuing.
          </p>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Delete reason
            </label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value.slice(0, TEXT_INPUT_MAX_LENGTH))}
              maxLength={TEXT_INPUT_MAX_LENGTH}
              placeholder="Explain why this team is being deleted"
              className="input-field min-h-28 resize-none"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add User To Team"
        footer={
          <Button
            variant="secondary"
            onClick={() => setAddModalOpen(false)}
            className="w-full"
          >
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            label="Search user"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Type a name"
          />

          {filteredUsers.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No available users found.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((appUser) => (
                <Card key={appUser.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{appUser.name}</p>
                    <p className="text-xs text-neutral-600 uppercase">
                      App role: {appUser.role}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleAddMember(appUser.id)}
                    loading={addingUserId === appUser.id}
                    className="shrink-0"
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserPlus size={16} />
                      Add
                    </span>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <BottomNav />
    </motion.div>
  )
}
