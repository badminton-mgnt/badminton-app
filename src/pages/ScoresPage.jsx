import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header, Card, Button, Badge, BottomNav } from '../components'
import { checkinParticipant, createEventMatchScore, getEventMatchScores, getEvents, getTeamMembers } from '../lib/api'
import { formatBangkokDateTime, getBangkokDateKey } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Clock3, Minus, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/TeamContext'

const emptyMatchConfig = {
  matchType: 'DOUBLES',
  teamAPlayer1: '',
  teamAPlayer2: '',
  teamBPlayer1: '',
  teamBPlayer2: '',
}

const formatDuration = (durationSeconds) => {
  const totalSeconds = Math.max(0, Number(durationSeconds) || 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

const formatBangkokDateOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
  }).format(date)
}

const getTeamDisplayName = (playerOne, playerTwo, matchType = 'DOUBLES') => {
  if (matchType === 'SINGLES') {
    return playerOne || 'Unknown'
  }

  if (playerOne && playerTwo) {
    return `${playerOne} & ${playerTwo}`
  }

  return playerOne || 'Unknown'
}

export const ScoresPage = () => {
  const location = useLocation()
  const { user } = useAuth()
  const { currentTeam, loading: teamsLoading } = useTeam()

  const [events, setEvents] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [startingMatch, setStartingMatch] = useState(false)
  const [scoreError, setScoreError] = useState('')
  const [matchConfig, setMatchConfig] = useState(emptyMatchConfig)
  const [activeMatch, setActiveMatch] = useState(null)
  const [expandedHistoryDays, setExpandedHistoryDays] = useState({})

  const selectedEvent = useMemo(
    () => events.find((event) => String(event.id) === String(selectedEventId)) || null,
    [events, selectedEventId]
  )

  const groupedHistoryByDay = useMemo(() => {
    const groupedMap = history.reduce((accumulator, match) => {
      const dayKey = getBangkokDateKey(match.started_at) || 'unknown'
      const currentGroup = accumulator.get(dayKey) || []
      currentGroup.push(match)
      accumulator.set(dayKey, currentGroup)
      return accumulator
    }, new Map())

    return Array.from(groupedMap.entries())
      .sort(([dayA], [dayB]) => dayB.localeCompare(dayA))
      .map(([dayKey, matches]) => ({
        dayKey,
        dayLabel: formatBangkokDateOnly(matches[0]?.started_at),
        matches,
      }))
  }, [history])

  useEffect(() => {
    setExpandedHistoryDays((prev) => {
      const next = {}
      groupedHistoryByDay.forEach((group) => {
        next[group.dayKey] = Boolean(prev[group.dayKey])
      })
      return next
    })
  }, [groupedHistoryByDay])

  useEffect(() => {
    if (!currentTeam || !user) {
      setEvents([])
      setTeamMembers([])
      setSelectedEventId('')
      setHistory([])
      setLoading(false)
      return
    }

    loadInitialData()
  }, [currentTeam?.team_id, user?.id])

  useEffect(() => {
    if (!selectedEventId) {
      setHistory([])
      return
    }

    loadEventHistory(selectedEventId)
  }, [selectedEventId])

  useEffect(() => {
    if (!location.state?.navRefreshAt || !currentTeam || !user) return

    loadInitialData()
  }, [location.state?.navRefreshAt])

  const loadInitialData = async () => {
    if (!currentTeam) return

    setLoading(true)
    try {
      const [eventsData, membersData] = await Promise.all([
        getEvents(currentTeam.team_id),
        getTeamMembers(currentTeam.team_id),
      ])

      const activeEvents = eventsData.filter((event) => {
        const normalizedStatus = String(event.status || '').toUpperCase()
        return normalizedStatus !== 'CANCELLED' && normalizedStatus !== 'COMPLETED'
      })
      const todayKey = getBangkokDateKey(new Date())
      const todayEvents = activeEvents.filter((event) => getBangkokDateKey(event.date) === todayKey)
      const defaultEvent = todayEvents[0] || null

      setEvents(todayEvents)
      setTeamMembers((membersData || []).sort((a, b) => String(a?.users?.name || '').localeCompare(String(b?.users?.name || ''))))
      setSelectedEventId(defaultEvent ? String(defaultEvent.id) : '')
      setScoreError('')
    } catch (error) {
      console.error('Error loading score page data:', error)
      setEvents([])
      setTeamMembers([])
      setSelectedEventId('')
      setHistory([])
      setScoreError('Unable to load score data right now.')
    } finally {
      setLoading(false)
    }
  }

  const loadEventHistory = async (eventId) => {
    try {
      const historyData = await getEventMatchScores(eventId)
      setHistory(historyData)
    } catch (error) {
      console.error('Error loading event match scores:', error)
      setHistory([])
      setScoreError('Unable to load score history for this event.')
    }
  }

  const updateMatchConfig = (field, value) => {
    setMatchConfig((prev) => {
      const next = {
        ...prev,
        [field]: value,
      }

      if (field === 'matchType' && value === 'SINGLES') {
        next.teamAPlayer2 = ''
        next.teamBPlayer2 = ''
      }

      return next
    })
    setScoreError('')
  }

  const handleStartMatch = async () => {
    if (!selectedEventId) {
      setScoreError('Please choose an event first.')
      return
    }

    if (String(selectedEvent?.status || '').toUpperCase() === 'COMPLETED') {
      setScoreError('Completed events cannot be scored.')
      return
    }

    if (!user?.id) {
      setScoreError('Please sign in again to start a match.')
      return
    }

    const requiredPlayerIds = [
      matchConfig.teamAPlayer1,
      matchConfig.teamBPlayer1,
      ...(matchConfig.matchType === 'DOUBLES' ? [matchConfig.teamAPlayer2, matchConfig.teamBPlayer2] : []),
    ]

    if (requiredPlayerIds.some((value) => !value)) {
      setScoreError('Please select all required players before starting.')
      return
    }

    const uniquePlayerIds = new Set(requiredPlayerIds)
    if (uniquePlayerIds.size !== requiredPlayerIds.length) {
      setScoreError('Each player must be unique in this match.')
      return
    }

    const checkInUserIds = Array.from(new Set([user.id, ...requiredPlayerIds]))

    try {
      setStartingMatch(true)
      await Promise.all(
        checkInUserIds.map((participantId) =>
          checkinParticipant(selectedEventId, participantId, user.id)
        )
      )
    } catch (error) {
      console.error('Error auto check-in before match start:', error)
      setScoreError('Unable to check in all players for this match.')
      return
    } finally {
      setStartingMatch(false)
    }

    setActiveMatch({
      ...matchConfig,
      teamAScore: 0,
      teamBScore: 0,
      startedAt: new Date().toISOString(),
    })
    setScoreError('')
  }

  const handleIncreaseScore = (teamKey) => {
    setActiveMatch((prev) => {
      if (!prev) return prev

      if (teamKey === 'A') {
        return { ...prev, teamAScore: prev.teamAScore + 1 }
      }

      return { ...prev, teamBScore: prev.teamBScore + 1 }
    })
  }

  const handleDecreaseScore = (teamKey) => {
    setActiveMatch((prev) => {
      if (!prev) return prev

      if (teamKey === 'A') {
        return { ...prev, teamAScore: Math.max(0, prev.teamAScore - 1) }
      }

      return { ...prev, teamBScore: Math.max(0, prev.teamBScore - 1) }
    })
  }

  const handleDiscardActiveMatch = () => {
    setActiveMatch(null)
    setScoreError('')
  }

  const handleSaveMatch = async () => {
    if (!activeMatch || !selectedEventId || !currentTeam || !user) {
      return
    }

    const endedAt = new Date()
    const startedAtDate = new Date(activeMatch.startedAt)
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAtDate.getTime()) / 1000))

    try {
      setSaving(true)
      const createdMatch = await createEventMatchScore({
        team_id: currentTeam.team_id,
        event_id: selectedEventId,
        match_type: activeMatch.matchType,
        team_a_player_1: activeMatch.teamAPlayer1,
        team_a_player_2: activeMatch.matchType === 'DOUBLES' ? activeMatch.teamAPlayer2 : null,
        team_b_player_1: activeMatch.teamBPlayer1,
        team_b_player_2: activeMatch.matchType === 'DOUBLES' ? activeMatch.teamBPlayer2 : null,
        team_a_score: activeMatch.teamAScore,
        team_b_score: activeMatch.teamBScore,
        started_at: activeMatch.startedAt,
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        created_by: user.id,
      })

      setHistory((prev) => [createdMatch, ...prev])
      setActiveMatch(null)
      setScoreError('')
    } catch (error) {
      console.error('Error saving match score:', error)
      setScoreError('Unable to save match score. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const resolveMemberName = (memberId) => {
    if (!memberId) {
      return ''
    }

    const member = teamMembers.find((item) => String(item.user_id) === String(memberId))
    return member?.users?.name || 'Unknown'
  }

  const toggleHistoryDay = (dayKey, event) => {
    event?.currentTarget?.blur()
    setExpandedHistoryDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }))
  }

  if (teamsLoading || loading) {
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
      className="min-h-screen pb-24"
    >
      <Header
        title="Scores"
        subtitle={selectedEvent ? `${selectedEvent.title} · ${formatBangkokDateTime(selectedEvent.date)}` : 'Only today events can be scored'}
      />

      <div className="container-mobile py-6 space-y-4">
        {!currentTeam ? (
          <Card className="text-center py-12">
            <p className="text-neutral-600 mb-3">Select a team on Home before recording scores.</p>
          </Card>
        ) : (
          <>
            {!activeMatch && (
              <Card className="space-y-3">
                <p className="text-xs text-neutral-600 uppercase">Today Event</p>
                <select
                  className="input-field"
                  value={selectedEventId}
                  onChange={(event) => {
                    setSelectedEventId(event.target.value)
                    setActiveMatch(null)
                    setScoreError('')
                  }}
                >
                  <option value="">Select today event</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{`${event.title} · ${formatBangkokDateTime(event.date)}`}</option>
                  ))}
                </select>
                {!selectedEventId && (
                  <p className="text-xs text-warning-900">No event today. Upcoming/past events are not allowed for scoring.</p>
                )}
              </Card>
            )}

            {selectedEventId && !activeMatch && (
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-600 uppercase">New Match</p>
                  <Badge status="warning">{matchConfig.matchType === 'DOUBLES' ? '2 vs 2' : '1 vs 1'}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={matchConfig.matchType === 'SINGLES' ? 'primary' : 'secondary'}
                    onClick={() => updateMatchConfig('matchType', 'SINGLES')}
                  >
                    1 vs 1
                  </Button>
                  <Button
                    type="button"
                    variant={matchConfig.matchType === 'DOUBLES' ? 'primary' : 'secondary'}
                    onClick={() => updateMatchConfig('matchType', 'DOUBLES')}
                  >
                    2 vs 2
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-neutral-600 uppercase">Team A</p>
                  <select
                    className="input-field"
                    value={matchConfig.teamAPlayer1}
                    onChange={(event) => updateMatchConfig('teamAPlayer1', event.target.value)}
                  >
                    <option value="">Select player 1</option>
                    {teamMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>{member.users?.name || 'Unknown'}</option>
                    ))}
                  </select>
                  {matchConfig.matchType === 'DOUBLES' && (
                    <select
                      className="input-field"
                      value={matchConfig.teamAPlayer2}
                      onChange={(event) => updateMatchConfig('teamAPlayer2', event.target.value)}
                    >
                      <option value="">Select player 2</option>
                      {teamMembers.map((member) => (
                        <option key={`a-${member.user_id}`} value={member.user_id}>{member.users?.name || 'Unknown'}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-neutral-600 uppercase">Team B</p>
                  <select
                    className="input-field"
                    value={matchConfig.teamBPlayer1}
                    onChange={(event) => updateMatchConfig('teamBPlayer1', event.target.value)}
                  >
                    <option value="">Select player 1</option>
                    {teamMembers.map((member) => (
                      <option key={`b-${member.user_id}`} value={member.user_id}>{member.users?.name || 'Unknown'}</option>
                    ))}
                  </select>
                  {matchConfig.matchType === 'DOUBLES' && (
                    <select
                      className="input-field"
                      value={matchConfig.teamBPlayer2}
                      onChange={(event) => updateMatchConfig('teamBPlayer2', event.target.value)}
                    >
                      <option value="">Select player 2</option>
                      {teamMembers.map((member) => (
                        <option key={`d-${member.user_id}`} value={member.user_id}>{member.users?.name || 'Unknown'}</option>
                      ))}
                    </select>
                  )}
                </div>

                <Button onClick={handleStartMatch} loading={startingMatch} className="w-full">
                  Start Score
                </Button>
              </Card>
            )}

            {activeMatch && (
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-600 uppercase">Live Match</p>
                    <p className="text-sm text-neutral-700">Start: {formatBangkokDateTime(activeMatch.startedAt)}</p>
                  </div>
                  <Badge status="success">Running</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-neutral-200 p-3 text-center">
                    <p className="text-xs text-neutral-600 mb-2">{getTeamDisplayName(resolveMemberName(activeMatch.teamAPlayer1), resolveMemberName(activeMatch.teamAPlayer2), activeMatch.matchType)}</p>
                    <p className="text-3xl font-bold text-primary-500">{activeMatch.teamAScore}</p>
                    <div className="grid grid-cols-2 gap-1 mt-3">
                      <Button variant="secondary" className="w-full min-w-0 px-2" onClick={() => handleDecreaseScore('A')}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
                          <Minus size={14} />
                          Undo
                        </span>
                      </Button>
                      <Button className="w-full min-w-0 px-2" onClick={() => handleIncreaseScore('A')}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
                          <Plus size={14} />
                          Add
                        </span>
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-3 text-center">
                    <p className="text-xs text-neutral-600 mb-2">{getTeamDisplayName(resolveMemberName(activeMatch.teamBPlayer1), resolveMemberName(activeMatch.teamBPlayer2), activeMatch.matchType)}</p>
                    <p className="text-3xl font-bold text-primary-500">{activeMatch.teamBScore}</p>
                    <div className="grid grid-cols-2 gap-1 mt-3">
                      <Button variant="secondary" className="w-full min-w-0 px-2" onClick={() => handleDecreaseScore('B')}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
                          <Minus size={14} />
                          Undo
                        </span>
                      </Button>
                      <Button className="w-full min-w-0 px-2" onClick={() => handleIncreaseScore('B')}>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs">
                          <Plus size={14} />
                          Add
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={handleDiscardActiveMatch}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveMatch} loading={saving}>
                    Save Score
                  </Button>
                </div>
              </Card>
            )}

            {scoreError && (
              <Card className="bg-error-50 border-error-200">
                <p className="text-sm text-error-800">{scoreError}</p>
              </Card>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-neutral-600 uppercase">History</p>
                {selectedEvent && <Badge status="success">{selectedEvent.title}</Badge>}
              </div>

              {history.length === 0 ? (
                <Card className="text-center py-8">
                  <Clock3 size={28} className="mx-auto text-neutral-300 mb-2" />
                  <p className="text-sm text-neutral-600">No scores saved for this event yet.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {groupedHistoryByDay.map((group) => (
                    <Card key={group.dayKey} className="p-0 overflow-hidden">
                      <button
                        type="button"
                        onClick={(event) => toggleHistoryDay(group.dayKey, event)}
                        className="w-full bg-white px-3 py-3 text-left"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 uppercase">
                            {expandedHistoryDays[group.dayKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            {group.dayLabel}
                          </span>
                          <Badge status="warning">{group.matches.length} match{group.matches.length > 1 ? 'es' : ''}</Badge>
                        </span>
                      </button>

                      {expandedHistoryDays[group.dayKey] && (
                        <div className="space-y-2 px-3 pb-3">
                          {group.matches.map((match) => (
                            <div key={match.id} className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs text-neutral-600 uppercase">{match.match_type === 'DOUBLES' ? '2 vs 2' : '1 vs 1'}</p>
                                  <p className="text-sm font-semibold text-neutral-800">
                                    {getTeamDisplayName(match.team_a_player_1_user?.name, match.team_a_player_2_user?.name, match.match_type)}
                                    {'  '}
                                    <span className="text-primary-500">{match.team_a_score}</span>
                                    {' - '}
                                    <span className="text-primary-500">{match.team_b_score}</span>
                                    {'  '}
                                    {getTeamDisplayName(match.team_b_player_1_user?.name, match.team_b_player_2_user?.name, match.match_type)}
                                  </p>
                                </div>
                                <Badge status="warning">Saved</Badge>
                              </div>

                              <div className="text-xs text-neutral-600 space-y-1">
                                <p>Start: {formatBangkokDateTime(match.started_at)}</p>
                                <p>Duration: {formatDuration(match.duration_seconds)}</p>
                                <p>Saved by: {match.created_by_user?.name || 'Unknown'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </motion.div>
  )
}
