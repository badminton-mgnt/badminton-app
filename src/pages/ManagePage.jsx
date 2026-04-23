import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Card, Button, BottomNav } from '../components'
import { getAllTeams, getUserProfile } from '../lib/api'
import { motion } from 'framer-motion'
import { Settings2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export const ManagePage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const [profileData, teamsData] = await Promise.all([
        getUserProfile(user.id),
        getAllTeams(),
      ])

      setProfile(profileData)
      setTeams((profileData.role || '').toLowerCase() === 'admin' ? teamsData : [])
    } catch (error) {
      console.error('Error loading manage data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  const isAdmin = (profile?.role || '').toLowerCase() === 'admin'

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
                    <p className="font-semibold">Teams and future admin tools</p>
                  </div>
                </div>
              </Card>

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
            </motion.div>
          </>
        )}
      </div>

      <BottomNav />
    </motion.div>
  )
}
