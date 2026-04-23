import { createContext, useContext, useEffect, useState } from 'react'
import { getAllTeams, getTeams } from '../lib/api'
import { useAuth } from './AuthContext'

const ACTIVE_TEAM_STORAGE_KEY = 'badminton-app.active-team-id'
const TeamContext = createContext()

export const TeamProvider = ({ children }) => {
  const { user } = useAuth()
  const [teams, setTeams] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [currentTeam, setCurrentTeamState] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setTeams([])
      setAllTeams([])
      setCurrentTeamState(null)
      setLoading(false)
      return
    }

    refreshTeams()
  }, [user])

  const refreshTeams = async () => {
    if (!user) return

    try {
      setLoading(true)
      const [teamsData, allTeamsData] = await Promise.all([
        getTeams(user.id),
        getAllTeams(),
      ])

      setTeams(teamsData)
      setAllTeams(allTeamsData)

      const savedTeamId = localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY)
      const nextTeam =
        teamsData.find((team) => team.team_id === savedTeamId) ||
        teamsData[0] ||
        null

      setCurrentTeamState(nextTeam)

      if (nextTeam) {
        localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, nextTeam.team_id)
      } else {
        localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY)
      }
    } catch (error) {
      console.error('Error loading team context:', error)
      setTeams([])
      setAllTeams([])
      setCurrentTeamState(null)
    } finally {
      setLoading(false)
    }
  }

  const setCurrentTeam = (team) => {
    setCurrentTeamState(team)

    if (team?.team_id) {
      localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, team.team_id)
    } else {
      localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY)
    }
  }

  return (
    <TeamContext.Provider
      value={{
        teams,
        allTeams,
        currentTeam,
        loading,
        refreshTeams,
        setCurrentTeam,
      }}
    >
      {children}
    </TeamContext.Provider>
  )
}

export const useTeam = () => {
  const context = useContext(TeamContext)

  if (!context) {
    throw new Error('useTeam must be used within TeamProvider')
  }

  return context
}
