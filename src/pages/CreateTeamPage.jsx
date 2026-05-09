import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Card, Button, Input } from '../components'
import { createTeam } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTeam } from '../contexts/TeamContext'
import { motion } from 'framer-motion'

export const CreateTeamPage = () => {
  const maxTeamNameLength = 20
  const navigate = useNavigate()
  const { user } = useAuth()
  const { language } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const { refreshTeams, setCurrentTeam } = useTeam()
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateTeam = async (e) => {
    e.preventDefault()
    if (!teamName.trim()) return
    if (teamName.trim().length > maxTeamNameLength) {
      setError(tx(
        `Team name must be ${maxTeamNameLength} characters or fewer.`,
        `Tên team phải có tối đa ${maxTeamNameLength} ký tự.`
      ))
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
      navigate('/', { state: { success: true, message: tx('Team created successfully!', 'Tạo team thành công!') } })
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
      <Header title={tx('Create Team', 'Tạo team')} />

      <div className="container-mobile py-8">
        <Card className="mb-6">
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <Input
              label={tx('Team Name', 'Tên team')}
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value)
                if (error) {
                  setError('')
                }
              }}
              placeholder={tx('e.g., Morning Club', 'ví dụ: Morning Club')}
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
              {tx('Create Team', 'Tạo team')}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              className="w-full"
            >
              {tx('Cancel', 'Hủy')}
            </Button>
          </form>
        </Card>

        <Card className="bg-neutral-100 border-0 shadow-none">
          <p className="text-sm text-neutral-600">
            {tx(
              'Tip: After creating a team, you\'ll automatically join it and other users can join or be added later.',
              'Mẹo: Sau khi tạo team, bạn sẽ tự động tham gia và có thể thêm hoặc mời người khác vào sau.'
            )}
          </p>
        </Card>
      </div>
    </motion.div>
  )
}
