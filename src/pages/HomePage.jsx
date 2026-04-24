import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Button, Card, Badge, BottomNav, Modal } from '../components'
import {
  checkinParticipant,
  getEventExpenses,
  getEventPaymentTransfers,
  getEventParticipants,
  getEvents,
  joinTeam,
  logout,
  getUserProfile,
} from '../lib/api'
import {
  forgetCheckedInEvent,
  forgetDismissedCheckInEvent,
  hasCheckedInEvent,
  hasDismissedCheckInEvent,
  rememberCheckedInEvent,
  rememberDismissedCheckInEvent,
} from '../lib/checkinCache'
import { formatVndAmount } from '../lib/currency'
import { formatBangkokDateTime, getBangkokDateKey } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { LogOut, Plus, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/TeamContext'

const CHECKIN_PAYMENT_WINDOW_DAYS = 3
const DAY_IN_MS = 24 * 60 * 60 * 1000
const isJoiningLockedStatus = (status) => ['FINALIZED', 'COMPLETED', 'CANCELLED'].includes(String(status || '').toUpperCase())

export const HomePage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { teams, allTeams, currentTeam, loading: teamsLoading, refreshTeams, setCurrentTeam } = useTeam()
  const [availableTeams, setAvailableTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [joiningTeamId, setJoiningTeamId] = useState(null)
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [switchTeamModalOpen, setSwitchTeamModalOpen] = useState(false)
  const [checkInModalOpen, setCheckInModalOpen] = useState(false)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [paymentSummary, setPaymentSummary] = useState({
    status: 'No team selected',
    amount: 0,
    tone: 'default',
    label: 'No Team',
  })
  const [todayEvent, setTodayEvent] = useState(null)
  const [todayEventCheckedIn, setTodayEventCheckedIn] = useState(false)
  const [pendingPastCheckInEvents, setPendingPastCheckInEvents] = useState([])
  const [pendingCheckInModalOpen, setPendingCheckInModalOpen] = useState(false)
  const [selectedCheckInEvent, setSelectedCheckInEvent] = useState(null)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [hasUpcoming, setHasUpcoming] = useState(false)

  const getPaymentBadgeClassName = () => {
    switch (paymentSummary.label) {
      case 'Pending':
        return 'bg-warning-50 text-warning-900'
      case 'Credit':
        return 'bg-success-50 text-success-700'
      case 'Settled':
        return 'bg-white/20 text-white border border-white/20'
      default:
        return 'bg-white/20 text-white border border-white/20'
    }
  }

  const getPaymentCardClassName = () => {
    switch (paymentSummary.tone) {
      case 'warning':
        return 'bg-error-50 border-error-800 text-error-800'
      case 'success':
        return 'bg-success-50 border-success-700 text-success-700'
      default:
        return 'bg-gradient-to-r from-primary-400 to-primary-400 text-white'
    }
  }

  const isParticipantCheckedIn = (participant) =>
    Boolean(participant?.checked_in)

  const canCheckInEvent = (event) => !isJoiningLockedStatus(event?.status)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  useEffect(() => {
    const joinedTeamIds = new Set(teams.map((team) => team.team_id))
    setAvailableTeams(allTeams.filter((team) => !joinedTeamIds.has(team.id)))
  }, [allTeams, teams])

  useEffect(() => {
    if (!currentTeam) {
      setTodayEvent(null)
      setTodayEventCheckedIn(false)
      setPendingPastCheckInEvents([])
      setPendingCheckInModalOpen(false)
      setSelectedCheckInEvent(null)
      setUpcomingCount(0)
      setHasUpcoming(false)
      setPaymentSummary({
        status: teams.length === 0 ? 'Join or create a team to get started' : 'Pick a team to view balances',
        amount: 0,
        tone: 'default',
        label: teams.length === 0 ? 'Get Started' : 'Select Team',
      })
      return
    }

    loadTeamOverview()
  }, [currentTeam?.team_id, teams.length, user?.id])

  const loadData = async () => {
    try {
      const userProfile = await getUserProfile(user.id)
      setUserName(userProfile.name)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamOverview = async () => {
    try {
      const eventsData = await getEvents(currentTeam.team_id)
      const activeEvents = eventsData.filter((event) => event.status !== 'CANCELLED')
      const todayKey = getBangkokDateKey(new Date())
      const now = Date.now()
      const todayMatch = activeEvents.find((event) => getBangkokDateKey(event.date) === todayKey)
      const upcomingEvents = activeEvents.filter((event) => getBangkokDateKey(event.date) > todayKey)
      const pastEventsInGraceWindow = activeEvents.filter((event) => {
        if (!canCheckInEvent(event)) return false
        const eventTime = new Date(event.date).getTime()
        if (!Number.isFinite(eventTime) || eventTime >= now) return false
        return now <= eventTime + (CHECKIN_PAYMENT_WINDOW_DAYS * DAY_IN_MS)
      })
      const pastEventsBeyondGraceWindow = activeEvents.filter((event) => {
        if (!canCheckInEvent(event)) return false
        const eventTime = new Date(event.date).getTime()
        if (!Number.isFinite(eventTime) || eventTime >= now) return false
        return now > eventTime + (CHECKIN_PAYMENT_WINDOW_DAYS * DAY_IN_MS)
      })

      setTodayEvent(todayMatch || null)
      setUpcomingCount(upcomingEvents.length)
      setHasUpcoming(upcomingEvents.length > 0)
      setTodayEventCheckedIn(todayMatch ? hasCheckedInEvent(user.id, todayMatch.id) : false)
      setPendingPastCheckInEvents([])

      if (todayMatch) {
        try {
          const todayParticipantsData = await getEventParticipants(todayMatch.id)
          const userCheckedIn = todayParticipantsData.some(
            (participant) => String(participant.user_id) === String(user.id) && isParticipantCheckedIn(participant)
          )

          if (userCheckedIn) {
            rememberCheckedInEvent(user.id, todayMatch.id)
            forgetDismissedCheckInEvent(user.id, todayMatch.id)
          } else {
            forgetCheckedInEvent(user.id, todayMatch.id)
          }

          setTodayEventCheckedIn(
            userCheckedIn
          )
        } catch (error) {
          console.error('Error loading today event participants:', error)
          setTodayEventCheckedIn(hasCheckedInEvent(user.id, todayMatch.id))
        }
      }

      const pendingCheckInEvents = []
      if (
        todayMatch &&
        canCheckInEvent(todayMatch) &&
        !hasDismissedCheckInEvent(user.id, todayMatch.id) &&
        !hasCheckedInEvent(user.id, todayMatch.id) &&
        !todayEventCheckedIn
      ) {
        pendingCheckInEvents.push(todayMatch)
      }

      if (pastEventsInGraceWindow.length > 0) {
        const pastEventStatuses = await Promise.all(
          pastEventsInGraceWindow.map(async (event) => {
            try {
              const participants = await getEventParticipants(event.id)
              const userCheckedIn = participants.some(
                (participant) => String(participant.user_id) === String(user.id) && isParticipantCheckedIn(participant)
              )

              if (userCheckedIn) {
                rememberCheckedInEvent(user.id, event.id)
                forgetDismissedCheckInEvent(user.id, event.id)
              } else {
                forgetCheckedInEvent(user.id, event.id)
              }

              return { event, userCheckedIn }
            } catch (error) {
              console.error('Error loading past event participants:', error)
              return { event, userCheckedIn: hasCheckedInEvent(user.id, event.id) }
            }
          })
        )

        const pendingPastEvents = pastEventStatuses
          .filter((item) => !item.userCheckedIn && !hasDismissedCheckInEvent(user.id, item.event.id))
          .map((item) => item.event)
          .sort((a, b) => new Date(b.date) - new Date(a.date))

        const pendingIds = new Set(pendingCheckInEvents.map((event) => String(event.id)))
        pendingPastEvents.forEach((event) => {
          if (!pendingIds.has(String(event.id))) {
            pendingCheckInEvents.push(event)
          }
        })
      }

      if (pastEventsBeyondGraceWindow.length > 0) {
        await Promise.all(
          pastEventsBeyondGraceWindow.map(async (event) => {
            try {
              const participants = await getEventParticipants(event.id)
              const userCheckedIn = participants.some(
                (participant) => String(participant.user_id) === String(user.id) && isParticipantCheckedIn(participant)
              )

              if (userCheckedIn) {
                rememberCheckedInEvent(user.id, event.id)
                forgetDismissedCheckInEvent(user.id, event.id)
              } else {
                rememberDismissedCheckInEvent(user.id, event.id)
                forgetCheckedInEvent(user.id, event.id)
              }
            } catch (error) {
              console.error('Error loading expired event participants:', error)
              if (!hasCheckedInEvent(user.id, event.id)) {
                rememberDismissedCheckInEvent(user.id, event.id)
              }
            }
          })
        )
      }

      setPendingPastCheckInEvents(pendingCheckInEvents)

      if (activeEvents.length === 0) {
        setPaymentSummary({
          status: `No events yet in ${currentTeam.teams.name}`,
          amount: 0,
          tone: 'default',
          label: 'No Events',
        })
        return
      }

      const settlementReadyEvents = activeEvents
        .filter((event) => ['FINALIZED', 'COMPLETED'].includes(String(event.status || '').toUpperCase()))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      const paymentEvent = settlementReadyEvents[0]
      const teamTreasurerId = currentTeam?.teams?.treasurer_id

      if (!paymentEvent) {
        setPaymentSummary({
          status: `Waiting admin/treasurer to mark Joining Closed in ${currentTeam.teams.name}`,
          amount: 0,
          tone: 'default',
          label: 'Joining Open',
        })
        return
      }

      if (!teamTreasurerId) {
        setPaymentSummary({
          status: `Set a treasurer for ${currentTeam.teams.name} to enable settlements`,
          amount: 0,
          tone: 'default',
          label: 'No Treasurer',
        })
        return
      }

      try {
        const [participantsData, expensesData, transfersData] = await Promise.all([
          getEventParticipants(paymentEvent.id),
          getEventExpenses(paymentEvent.id),
          getEventPaymentTransfers(paymentEvent.id),
        ])

        const checkedInCount = participantsData.filter((participant) => participant.checked_in).length
        const approvedExpenses = expensesData.filter((expense) => expense.status === 'APPROVED')
        const totalExpense = approvedExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
        const share = checkedInCount > 0 ? totalExpense / checkedInCount : 0
        const transferStatus = (status) => String(status || '').toUpperCase()
        const transferDirection = (direction) => String(direction || '').toUpperCase().trim()
        const isTransferConfirmed = (status) => ['CONFIRMED', 'COMPLETE', 'COMPLETED'].includes(transferStatus(status))
        const isToTreasuryDirection = (direction) => transferDirection(direction) === 'TO_TREASURY'
        const isFromTreasuryDirection = (direction) => transferDirection(direction) === 'FROM_TREASURY'
        const isToTreasuryTransfer = (transfer) =>
          isToTreasuryDirection(transfer.direction) || (!transfer.direction && String(transfer.to_user_id) === String(teamTreasurerId))
        const isFromTreasuryTransfer = (transfer) =>
          isFromTreasuryDirection(transfer.direction) || (!transfer.direction && String(transfer.from_user_id) === String(teamTreasurerId))

        const userPaymentTransfers = transfersData.filter(
          (transfer) =>
            String(transfer.from_user_id) === String(user.id) &&
            String(transfer.to_user_id) === String(teamTreasurerId) &&
            isToTreasuryTransfer(transfer) &&
            isTransferConfirmed(transfer.status)
        )

        const confirmedIncomingPayoutAmount = transfersData
          .filter(
            (transfer) =>
              String(transfer.from_user_id) === String(teamTreasurerId) &&
              String(transfer.to_user_id) === String(user.id) &&
              isFromTreasuryTransfer(transfer) &&
              isTransferConfirmed(transfer.status)
          )
          .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

        const confirmedOutgoingFromTreasuryAmount = transfersData
          .filter(
            (transfer) =>
              String(transfer.from_user_id) === String(user.id) &&
              isFromTreasuryTransfer(transfer) &&
              isTransferConfirmed(transfer.status)
          )
          .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

        const confirmedIncomingToTreasuryAmount = transfersData
          .filter(
            (transfer) =>
              String(transfer.to_user_id) === String(user.id) &&
              isToTreasuryTransfer(transfer) &&
              isTransferConfirmed(transfer.status)
          )
          .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

        const settlementPaymentAmount = userPaymentTransfers.reduce(
          (sum, transfer) => sum + Number(transfer.amount || 0),
          0
        )

        const userApprovedExpenseTotal = approvedExpenses
          .filter((expense) => String(expense.user_id) === String(user.id))
          .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
        const isCurrentUserTreasurer = String(user.id) === String(teamTreasurerId)
        const cachedCheckedIn = hasCheckedInEvent(user.id, paymentEvent.id)
        const userIsCheckedIn = participantsData.some(
          (participant) => String(participant.user_id) === String(user.id) && isParticipantCheckedIn(participant)
        ) || cachedCheckedIn

        if (participantsData.some((participant) => String(participant.user_id) === String(user.id) && isParticipantCheckedIn(participant))) {
          rememberCheckedInEvent(user.id, paymentEvent.id)
          forgetDismissedCheckInEvent(user.id, paymentEvent.id)
        } else {
          forgetCheckedInEvent(user.id, paymentEvent.id)
        }

        const userContributionAmount = isCurrentUserTreasurer
          ? userApprovedExpenseTotal + confirmedOutgoingFromTreasuryAmount - confirmedIncomingToTreasuryAmount
          : settlementPaymentAmount + userApprovedExpenseTotal - confirmedIncomingPayoutAmount

        const balance = userIsCheckedIn
          ? userContributionAmount - share
          : 0

        if (!userIsCheckedIn) {
          setPaymentSummary({
            status: `No payment needed for ${currentTeam.teams.name}`,
            amount: 0,
            tone: 'default',
            label: 'Settled',
          })
        } else if (balance < 0) {
          setPaymentSummary({
            status: `You owe in ${currentTeam.teams.name}`,
            amount: Math.abs(balance),
            tone: 'warning',
            label: 'Pending',
          })
        } else if (balance > 0) {
          setPaymentSummary({
            status: `${currentTeam.teams.name} owes you`,
            amount: balance,
            tone: 'success',
            label: 'Credit',
          })
        } else {
          setPaymentSummary({
            status: `All settled for ${currentTeam.teams.name}`,
            amount: 0,
            tone: 'success',
            label: 'Settled',
          })
        }
      } catch (error) {
        console.error('Error loading payment summary:', error)
        setPaymentSummary({
          status: 'Unable to load team balance',
          amount: 0,
          tone: 'default',
          label: 'Unavailable',
        })
      }
    } catch (error) {
      console.error('Error loading team overview:', error)
      setTodayEvent(null)
      setTodayEventCheckedIn(false)
      setUpcomingCount(0)
      setHasUpcoming(false)
      setPaymentSummary({
        status: 'Unable to load team balance',
        amount: 0,
        tone: 'default',
        label: 'Unavailable',
      })
    }
  }

  const handleTodayEventClick = () => {
    if (!todayEvent) return
    handleEventCheckInClick(todayEvent, todayEventCheckedIn)
  }

  const handleEventCheckInClick = (event, alreadyCheckedIn = false) => {
    if (!event) return

    if (!canCheckInEvent(event)) {
      navigate(`/event/${event.id}`)
      return
    }

    if (alreadyCheckedIn) {
      navigate(`/event/${event.id}`)
      return
    }

    setSelectedCheckInEvent(event)
    setCheckInModalOpen(true)
  }

  const handleDismissCheckIn = (eventToDismiss) => {
    if (!eventToDismiss) return

    rememberDismissedCheckInEvent(user.id, eventToDismiss.id)
    forgetCheckedInEvent(user.id, eventToDismiss.id)

    if (todayEvent && eventToDismiss.id === todayEvent.id) {
      setTodayEventCheckedIn(false)
    }

    setPendingPastCheckInEvents((prev) => prev.filter((event) => event.id !== eventToDismiss.id))

    if (selectedCheckInEvent && selectedCheckInEvent.id === eventToDismiss.id) {
      setCheckInModalOpen(false)
      setSelectedCheckInEvent(null)
    }
  }

  const handleCheckInForEvent = async (eventToCheckIn, navigateAfterCheckIn = false) => {
    if (!eventToCheckIn || !canCheckInEvent(eventToCheckIn)) return

    try {
      setCheckInLoading(true)
      await checkinParticipant(eventToCheckIn.id, user.id)
      rememberCheckedInEvent(user.id, eventToCheckIn.id)
      forgetDismissedCheckInEvent(user.id, eventToCheckIn.id)
      if (todayEvent && eventToCheckIn.id === todayEvent.id) {
        setTodayEventCheckedIn(true)
      }
      setPendingPastCheckInEvents((prev) => prev.filter((event) => event.id !== eventToCheckIn.id))
      setCheckInModalOpen(false)
      setSelectedCheckInEvent(null)
      if (navigateAfterCheckIn) {
        navigate(`/event/${eventToCheckIn.id}`)
      }
    } catch (error) {
      console.error('Check-in error:', error)
    } finally {
      setCheckInLoading(false)
    }
  }

  const handleConfirmCheckIn = async () => {
    if (!selectedCheckInEvent) return
    await handleCheckInForEvent(selectedCheckInEvent, true)
  }

  const handleJoinTeam = async (teamId) => {
    try {
      setJoiningTeamId(teamId)
      await joinTeam(teamId, user.id)
      await refreshTeams()
      setJoinModalOpen(false)
    } catch (error) {
      console.error('Join team error:', error)
    } finally {
      setJoiningTeamId(null)
    }
  }

  const handleHeaderTeamClick = () => {
    if (teams.length > 0) {
      setSwitchTeamModalOpen(true)
      return
    }

    if (allTeams.length > 0) {
      setJoinModalOpen(true)
      return
    }

    navigate('/teams/create')
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading || teamsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-24"
    >
      <Header
        title={`Hello, ${userName}!`}
        subtitleContent={
          <button
            onClick={handleHeaderTeamClick}
            className="mt-2 inline-flex rounded-full transition hover:opacity-90"
          >
            <Badge
              status={currentTeam?.teams?.name ? 'success' : 'warning'}
              className="cursor-pointer bg-white/15 text-white border border-white/20"
            >
              {currentTeam?.teams?.name || (allTeams.length > 0 ? 'No team yet, tap to join' : 'No team yet, tap to create')}
            </Badge>
          </button>
        }
        action={
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <LogOut size={20} className="text-white" />
          </button>
        }
      />

      <div className="container-mobile py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
            Payment Status
          </h2>
          <Card className={getPaymentCardClassName()}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-sm ${paymentSummary.tone === 'default' ? 'opacity-90' : 'opacity-100'}`}>{paymentSummary.status}</p>
                <p className="text-4xl font-bold">
                  {`đ ${formatVndAmount(paymentSummary.amount)}`}
                </p>
              </div>
              <Badge status="default" className={getPaymentBadgeClassName()}>
                {paymentSummary.label}
              </Badge>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {pendingPastCheckInEvents.length > 0 && (
            <Card className="mb-3 border border-warning-300 bg-warning-50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-warning-900">
                    Check-in Warning
                  </p>
                  <p className="text-sm text-warning-900">
                    {`You have ${pendingPastCheckInEvents.length} event${pendingPastCheckInEvents.length > 1 ? 's' : ''} pending check-in.`}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="border border-warning-300"
                  onClick={() => setPendingCheckInModalOpen(true)}
                >
                  Review
                </Button>
              </div>
            </Card>
          )}

          <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
            Today&apos;s Team Event
          </h2>
          {!currentTeam ? (
            <Card>
              <p className="text-neutral-600">Select a team to view its events.</p>
            </Card>
          ) : todayEvent ? (
            (() => {
              const todayEventCanCheckIn = canCheckInEvent(todayEvent)
              return (
            <Card onClick={handleTodayEventClick} className="cursor-pointer hover:shadow-lg transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{todayEvent.title}</h3>
                  <p className="text-sm text-neutral-600">
                    {todayEvent.location || 'Location not set'}
                    {todayEvent.court_number ? ` - Court ${todayEvent.court_number}` : ''}
                  </p>
                </div>
                <Badge status={todayEventCanCheckIn ? (todayEventCheckedIn ? 'success' : 'warning') : 'default'}>
                  {todayEventCanCheckIn
                    ? (todayEventCheckedIn ? 'Checked In' : 'Check In')
                    : String(todayEvent.status || '').toUpperCase() === 'COMPLETED'
                    ? 'Completed'
                    : 'Joining Closed'}
                </Badge>
              </div>
              <p className="text-sm text-neutral-600">{formatBangkokDateTime(todayEvent.date)}</p>
              <p className="text-xs text-neutral-500 mt-2">
                {todayEventCanCheckIn
                  ? (todayEventCheckedIn ? 'Tap to view event details.' : 'Tap to confirm check-in and open this event.')
                  : 'Tap to view event details.'}
              </p>
            </Card>
              )
            })()
          ) : (
            <Card
              onClick={() => navigate('/events', { state: { openCreateEvent: !hasUpcoming } })}
              className="cursor-pointer hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {hasUpcoming ? `${upcomingCount} upcoming event${upcomingCount > 1 ? 's' : ''}` : 'No event today'}
                  </h3>
                  {hasUpcoming ? (
                    <div className="text-sm text-neutral-600">
                      <p>No event today.</p>
                      <p>Tap to see upcoming events.</p>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-600">
                      No upcoming events. Tap to create one.
                    </p>
                  )}
                </div>
                <Badge status={hasUpcoming ? 'warning' : 'default'}>
                  {hasUpcoming ? 'Upcoming' : 'Create'}
                </Badge>
              </div>
            </Card>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-600 uppercase">
              Your Teams
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setJoinModalOpen(true)}
                className="p-2 hover:bg-neutral-200 rounded-lg transition"
                title="Join a team"
              >
                <Users size={20} className="text-primary-400" />
              </button>
              <button
                onClick={() => navigate('/teams/create')}
                className="p-2 hover:bg-neutral-200 rounded-lg transition"
                title="Create a team"
              >
                <Plus size={20} className="text-primary-400" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {teams.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-neutral-600 mb-3">No teams yet</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => setJoinModalOpen(true)}
                    variant="secondary"
                    className="w-full"
                  >
                    Join Existing Team
                  </Button>
                  <Button
                    onClick={() => navigate('/teams/create')}
                    variant="primary"
                    className="w-full"
                  >
                    Create Team
                  </Button>
                </div>
              </Card>
            ) : (
              teams.map((team) => (
                <motion.div
                  key={team.team_id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/team/${team.team_id}`)}
                  className="cursor-pointer"
                >
                  <Card className="hover:shadow-lg transition">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{team.teams.name}</h3>
                        <p className="text-xs text-neutral-600">
                          Joined {new Date(team.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <Modal
        isOpen={checkInModalOpen}
        onClose={() => {
          setCheckInModalOpen(false)
          setSelectedCheckInEvent(null)
        }}
        title="Confirm Check-In"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCheckInModalOpen(false)
                setSelectedCheckInEvent(null)
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDismissCheckIn(selectedCheckInEvent)}
              className="flex-1"
              disabled={!selectedCheckInEvent || checkInLoading}
            >
              I Didn&apos;t Join
            </Button>
            <Button
              onClick={handleConfirmCheckIn}
              className="flex-1"
              loading={checkInLoading}
            >
              Check In
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            {selectedCheckInEvent && hasDismissedCheckInEvent(user.id, selectedCheckInEvent.id)
              ? 'You marked this event as not joined. You cannot open event details unless you check in now.'
              : 'Check in to join this event and open its details.'}
          </p>
          {selectedCheckInEvent && (
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="font-semibold">{selectedCheckInEvent.title}</p>
              <p className="text-sm text-neutral-600 mt-1">{formatBangkokDateTime(selectedCheckInEvent.date)}</p>
              <p className="text-sm text-neutral-600">
                {selectedCheckInEvent.location || 'Location not set'}
                {selectedCheckInEvent.court_number ? ` - Court ${selectedCheckInEvent.court_number}` : ''}
              </p>
            </div>
          )}
          <p className="text-xs text-neutral-500">
            Check in is allowed up to {CHECKIN_PAYMENT_WINDOW_DAYS} days after event date. If you do not check in, this event will not be included in your settlement.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={pendingCheckInModalOpen}
        onClose={() => setPendingCheckInModalOpen(false)}
        title={`Pending Check-In (${pendingPastCheckInEvents.length})`}
        footer={
          <Button
            variant="secondary"
            onClick={() => setPendingCheckInModalOpen(false)}
            className="w-full"
          >
            Close
          </Button>
        }
      >
        {pendingPastCheckInEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">No pending check-in events.</p>
        ) : (
          <div className="space-y-3">
            {pendingPastCheckInEvents.map((event) => (
              <Card key={event.id} className="border border-warning-200 bg-warning-50">
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold">{event.title}</p>
                    <p className="text-sm text-neutral-600">{formatBangkokDateTime(event.date)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => handleDismissCheckIn(event)}
                      disabled={checkInLoading}
                    >
                      I Didn&apos;t Join
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleCheckInForEvent(event)}
                      loading={checkInLoading}
                      disabled={checkInLoading}
                    >
                      Check In
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={switchTeamModalOpen}
        onClose={() => setSwitchTeamModalOpen(false)}
        title="Select Team"
        footer={
          <Button
            variant="secondary"
            onClick={() => setSwitchTeamModalOpen(false)}
            className="w-full"
          >
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          {teams.map((team) => (
            <Card
              key={team.team_id}
              className={`cursor-pointer transition ${
                currentTeam?.team_id === team.team_id ? 'ring-2 ring-primary-400' : ''
              }`}
              onClick={() => {
                setCurrentTeam(team)
                setSwitchTeamModalOpen(false)
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{team.teams.name}</p>
                  <p className="text-xs text-neutral-600">
                    Joined {new Date(team.joined_at).toLocaleDateString()}
                  </p>
                </div>
                {currentTeam?.team_id === team.team_id && (
                  <span className="text-xs font-semibold uppercase text-primary-400">
                    Current
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="Join Team"
        footer={
          <Button
            variant="secondary"
            onClick={() => setJoinModalOpen(false)}
            className="w-full"
          >
            Close
          </Button>
        }
      >
        {allTeams.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No teams have been created yet.
          </p>
        ) : availableTeams.length === 0 ? (
          <p className="text-sm text-neutral-600">
            You already joined all available teams.
          </p>
        ) : (
          <div className="space-y-3">
            {availableTeams.map((team) => (
              <Card key={team.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-xs text-neutral-600">
                    Created {new Date(team.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  onClick={() => handleJoinTeam(team.id)}
                  loading={joiningTeamId === team.id}
                >
                  Join
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Modal>

      <BottomNav />
    </motion.div>
  )
}


