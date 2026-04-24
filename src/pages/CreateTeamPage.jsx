import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Card, Button, Input } from '../components'
import { createTeam } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/TeamContext'
import { motion } from 'framer-motion'

export const CreateTeamPage = () => {
  const maxTeamNameLength = 20
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshTeams, setCurrentTeam } = useTeam()
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!teamName.trim()) return
    if (teamName.trim().length > maxTeamNameLength) {
      setError(`Team name must be ${maxTeamNameLength} characters or fewer.`)
      return
    }

    setError('')
    setLoading(true)

    try {
      const createdTeam = await createTeam(teamName, user.id)
      setCurrentTeam({
        team_id: createdTeam.id,
        teams: createdTeam,
      })
      await refreshTeams()
      navigate('/', { state: { success: true, message: 'Team created successfully!' } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-neutral-100"
    >
      <Header title="Create Team" />

      <div className="container-mobile py-8">
        <Card className="mb-6">
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <Input
              label="Team Name"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value)
                if (error) {
                  setError('')
                }
              }}
              placeholder="e.g., Morning Club"
              maxLength={maxTeamNameLength}
              autoFocus
            />
            <p className="text-xs text-neutral-600 text-right">
              {teamName.length}/{maxTeamNameLength}
            </p>

            {error && (
              <div className="bg-error-50 text-error-800 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!teamName.trim() || loading}
              loading={loading}
              className="w-full"
            >
              Create Team
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              className="w-full"
            >
              Cancel
            </Button>
          </form>
        </Card>

        <Card className="bg-neutral-100 border-0 shadow-none">
          <p className="text-sm text-neutral-600">
            Tip: After creating a team, you&apos;ll automatically join it and other users can join or be added later.
          </p>
        </Card>
      </div>
    </motion.div>
  )
}
