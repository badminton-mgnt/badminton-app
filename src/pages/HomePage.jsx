import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Header, Button, Card, Badge, BottomNav, Modal } from '../components'
import {
  checkinParticipant,
  getEventExpenses,
  getPaymentInfo,
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
import { ChevronDown, ChevronUp, LogOut, Plus, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useTeam } from '../contexts/TeamContext'

const CHECKIN_PAYMENT_WINDOW_DAYS = 3
const DAY_IN_MS = 24 * 60 * 60 * 1000
const isJoiningLockedStatus = (status) => ['FINALIZED', 'COMPLETED', 'CANCELLED'].includes(String(status || '').toUpperCase())

export const HomePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { language, setLanguage, t } = useLanguage()
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
    status: t('home.payment_status.pick_team'),
    amount: 0,
    tone: 'default',
    label: 'NO_TEAM',
  })
  const [todayEvents, setTodayEvents] = useState([])
  const [todayEventsExpanded, setTodayEventsExpanded] = useState(false)
  const [todayEventCheckedInMap, setTodayEventCheckedInMap] = useState({})
  const [pendingPastCheckInEvents, setPendingPastCheckInEvents] = useState([])
  const [pendingCheckInModalOpen, setPendingCheckInModalOpen] = useState(false)
  const [selectedCheckInEvent, setSelectedCheckInEvent] = useState(null)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [hasUpcoming, setHasUpcoming] = useState(false)
  const [showPaymentSetupWarning, setShowPaymentSetupWarning] = useState(false)

  const getPaymentBadgeClassName = () => {
    switch (paymentSummary.label) {
      case 'PENDING':
        return 'bg-warning-50 text-warning-900'
      case 'CREDIT':
        return 'bg-white text-success-800 border border-success-200'
      case 'SETTLED':
        return 'bg-success-700 text-white border border-success-800'
      default:
        return 'bg-white/20 text-white border border-white/20'
    }
  }

  const getPluralSuffix = (count) => {
    if (language !== 'en') return ''
    return Number(count) > 1 ? 's' : ''
  }

  const getPaymentSummaryLabel = () => {
    switch (paymentSummary.label) {
      case 'GET_STARTED':
        return t('home.payment_label.get_started')
      case 'SELECT_TEAM':
        return t('home.payment_label.select_team')
      case 'NO_EVENTS':
        return t('home.payment_label.no_events')
      case 'EXPENSE_OPEN':
        return t('home.payment_label.expense_open')
      case 'JOINING_OPEN':
        return t('home.payment_label.joining_open')
      case 'NO_TREASURER':
        return t('home.payment_label.no_treasurer')
      case 'SETTLED':
        return t('home.payment_label.settled')
      case 'PENDING':
        return t('home.payment_label.pending')
      case 'CREDIT':
        return t('home.payment_label.credit')
      case 'UNAVAILABLE':
        return t('home.payment_label.unavailable')
      default:
        return t('home.payment_label.no_team')
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
      setTodayEvents([])
      setTodayEventsExpanded(false)
      setTodayEventCheckedInMap({})
      setPendingPastCheckInEvents([])
      setPendingCheckInModalOpen(false)
      setSelectedCheckInEvent(null)
      setUpcomingCount(0)
      setHasUpcoming(false)
      setPaymentSummary({
        status: teams.length === 0
          ? t('home.payment_status.join_or_create')
          : t('home.payment_status.pick_team'),
        amount: 0,
        tone: 'default',
        label: teams.length === 0 ? 'GET_STARTED' : 'SELECT_TEAM',
      })
      return
    }

    loadTeamOverview()
  }, [currentTeam?.team_id, teams.length, user?.id, language])

  useEffect(() => {
    if (!location.state?.navRefreshAt || !user) return

    loadData()
    if (currentTeam) {
      loadTeamOverview()
    }
  }, [location.state?.navRefreshAt])

  const loadData = async () => {
    try {
      const [userProfile, paymentData] = await Promise.all([
        getUserProfile(user.id),
        getPaymentInfo(user.id),
      ])
      setUserName(userProfile.name)

      const hasPaymentSetup = Boolean(
        paymentData &&
        (
          paymentData.bank_name ||
          paymentData.account_number ||
          paymentData.account_name ||
          paymentData.qr_url
        )
      )
      setShowPaymentSetupWarning(!hasPaymentSetup)
    } catch (error) {
      console.error('Error loading data:', error)
      setShowPaymentSetupWarning(false)
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
      const todayMatches = activeEvents
        .filter((event) => getBangkokDateKey(event.date) === todayKey)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
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

      setTodayEvents(todayMatches)
      setTodayEventsExpanded(todayMatches.length <= 1)
      setUpcomingCount(upcomingEvents.length)
      setHasUpcoming(upcomingEvents.length > 0)
      setTodayEventCheckedInMap(
        Object.fromEntries(
          todayMatches.map((event) => [String(event.id), hasCheckedInEvent(user.id, event.id)])
        )
      )
      setPendingPastCheckInEvents([])

      const todayEventStatuses = await Promise.all(
        todayMatches.map(async (event) => {
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
            console.error('Error loading today event participants:', error)
            return { event, userCheckedIn: hasCheckedInEvent(user.id, event.id) }
          }
        })
      )

      setTodayEventCheckedInMap(
        Object.fromEntries(
          todayEventStatuses.map((item) => [String(item.event.id), item.userCheckedIn])
        )
      )

      const pendingCheckInEvents = []
      todayEventStatuses.forEach(({ event, userCheckedIn }) => {
        if (
          canCheckInEvent(event) &&
          !hasDismissedCheckInEvent(user.id, event.id) &&
          !userCheckedIn
        ) {
          pendingCheckInEvents.push(event)
        }
      })

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
          status: t('home.payment_status.no_events_in_team', { team: currentTeam.teams.name }),
          amount: 0,
          tone: 'default',
          label: 'NO_EVENTS',
        })
        return
      }

      const settlementReadyEvents = activeEvents
        .filter(
          (event) =>
            ['FINALIZED', 'COMPLETED'].includes(String(event.status || '').toUpperCase()) &&
            (Boolean(event.expenses_closed_at) || String(event.status || '').toUpperCase() === 'COMPLETED')
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      const paymentEvent = settlementReadyEvents[0]
      const teamTreasurerId = currentTeam?.teams?.treasurer_id

      const joiningClosedEvents = activeEvents
        .filter((event) => ['FINALIZED', 'COMPLETED'].includes(String(event.status || '').toUpperCase()))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      const waitingExpenseCloseEvent = joiningClosedEvents.find(
        (event) => !event.expenses_closed_at && String(event.status || '').toUpperCase() !== 'COMPLETED'
      )

      if (!paymentEvent) {
        setPaymentSummary({
          status: waitingExpenseCloseEvent
            ? t('home.payment_status.waiting_expense_close', { team: currentTeam.teams.name })
            : t('home.payment_status.waiting_joining_close', { team: currentTeam.teams.name }),
          amount: 0,
          tone: 'default',
          label: waitingExpenseCloseEvent ? 'EXPENSE_OPEN' : 'JOINING_OPEN',
        })
        return
      }

      if (!teamTreasurerId) {
        setPaymentSummary({
          status: t('home.payment_status.set_treasurer', { team: currentTeam.teams.name }),
          amount: 0,
          tone: 'default',
          label: 'NO_TREASURER',
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
        const share = checkedInCount > 0 ? Math.round((totalExpense / checkedInCount) * 100) / 100 : 0
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

        const settlementPaymentAmount = userPaymentTransfers.reduce(
          (sum, transfer) => sum + Number(transfer.amount || 0),
          0
        )

        const userApprovedExpenseTotal = approvedExpenses
          .filter((expense) => String(expense.user_id) === String(user.id))
          .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
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

        const preSettlementBalance = userApprovedExpenseTotal - share

        const balance = userIsCheckedIn
          ? Math.round((preSettlementBalance + settlementPaymentAmount - confirmedIncomingPayoutAmount) * 100) / 100
          : 0

        const normalizedBalance = Math.abs(balance) < 1.0 ? 0 : balance

        if (!userIsCheckedIn) {
          setPaymentSummary({
            status: t('home.payment_status.no_payment_needed', { team: currentTeam.teams.name }),
            amount: 0,
            tone: 'default',
            label: 'SETTLED',
          })
        } else if (normalizedBalance < 0) {
          setPaymentSummary({
            status: t('home.payment_status.you_owe', { team: currentTeam.teams.name }),
            amount: Math.abs(normalizedBalance),
            tone: 'warning',
            label: 'PENDING',
          })
        } else if (normalizedBalance > 0) {
          setPaymentSummary({
            status: t('home.payment_status.team_owes_you', { team: currentTeam.teams.name }),
            amount: normalizedBalance,
            tone: 'success',
            label: 'CREDIT',
          })
        } else {
          setPaymentSummary({
            status: t('home.payment_status.all_settled', { team: currentTeam.teams.name }),
            amount: 0,
            tone: 'success',
            label: 'SETTLED',
          })
        }
      } catch (error) {
        console.error('Error loading payment summary:', error)
        setPaymentSummary({
          status: t('home.payment_status.unavailable'),
          amount: 0,
          tone: 'default',
          label: 'UNAVAILABLE',
        })
      }
    } catch (error) {
      console.error('Error loading team overview:', error)
      setTodayEvents([])
      setTodayEventCheckedInMap({})
      setUpcomingCount(0)
      setHasUpcoming(false)
      setPaymentSummary({
        status: t('home.payment_status.unavailable'),
        amount: 0,
        tone: 'default',
        label: 'UNAVAILABLE',
      })
    }
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
    setTodayEventCheckedInMap((prev) => ({ ...prev, [String(eventToDismiss.id)]: false }))

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
      setTodayEventCheckedInMap((prev) => ({ ...prev, [String(eventToCheckIn.id)]: true }))
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
          <p className="text-neutral-600">{t('home.loading')}</p>
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
        title={t('home.hello', { name: userName })}
        subtitleContent={
          <button
            onClick={handleHeaderTeamClick}
            className="mt-2 inline-flex rounded-full transition hover:opacity-90"
          >
            <Badge
              status={currentTeam?.teams?.name ? 'success' : 'warning'}
              className="cursor-pointer bg-white/15 text-white border border-white/20"
            >
              {currentTeam?.teams?.name || (allTeams.length > 0 ? t('home.no_team_join') : t('home.no_team_create'))}
            </Badge>
          </button>
        }
        action={
          <div className="flex items-center gap-2">
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-9 rounded-lg border border-white/20 bg-white/10 px-2 text-xs font-semibold text-white outline-none"
            >
              <option value="en" className="text-neutral-800">EN</option>
              <option value="vi" className="text-neutral-800">VI</option>
            </select>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
            >
              <LogOut size={20} className="text-white" />
            </button>
          </div>
        }
      />

      <div className="container-mobile py-6 space-y-6">
        {showPaymentSetupWarning && (
          <Card
            className="border border-warning-300 bg-warning-50 cursor-pointer"
            onClick={() => navigate('/me')}
          >
            <p className="text-sm font-semibold text-warning-900">{t('home.payment_setup_title')}</p>
            <p className="text-xs text-warning-900 mt-1">{t('home.payment_setup_hint')}</p>
          </Card>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
            {t('home.payment_status')}
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
                {getPaymentSummaryLabel()}
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
                    {t('home.checkin_warning')}
                  </p>
                  <p className="text-sm text-warning-900">
                    {t('home.pending_checkin', {
                      count: pendingPastCheckInEvents.length,
                      plural: getPluralSuffix(pendingPastCheckInEvents.length),
                    })}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="border border-warning-300"
                  onClick={() => setPendingCheckInModalOpen(true)}
                >
                  {t('home.review')}
                </Button>
              </div>
            </Card>
          )}

          <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
            {t('home.todays_team_event')}
          </h2>
          {!currentTeam ? (
            <Card>
              <p className="text-neutral-600">{t('home.select_team_events')}</p>
            </Card>
          ) : todayEvents.length > 0 ? (
            <Card className="space-y-3">
              {todayEvents.length > 1 ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3"
                  onClick={() => setTodayEventsExpanded((prev) => !prev)}
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-neutral-700">{t('home.todays_team_events')}</p>
                    <p className="text-xs text-neutral-500">{t('home.events_today', { count: todayEvents.length })}</p>
                  </div>
                  <span className="text-neutral-500">
                    {todayEventsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </button>
              ) : (
                <p className="text-sm font-semibold text-neutral-700">{t('home.todays_team_events')}</p>
              )}

              {(todayEvents.length === 1 || todayEventsExpanded) && (
                <div className={`space-y-3 ${todayEvents.length > 1 ? 'border-t border-neutral-200 pt-3' : ''}`}>
                  {todayEvents.map((todayEvent) => {
                    const todayEventCanCheckIn = canCheckInEvent(todayEvent)
                    const todayEventCheckedIn = Boolean(todayEventCheckedInMap[String(todayEvent.id)])

                    return (
                      <Card
                        key={todayEvent.id}
                        onClick={() => handleEventCheckInClick(todayEvent, todayEventCheckedIn)}
                        className="cursor-pointer hover:shadow-lg transition"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{todayEvent.title}</h3>
                            <p className="text-sm text-neutral-600">
                              {todayEvent.location || t('home.location_not_set')}
                              {todayEvent.court_number ? ` - ${t('home.court')} ${todayEvent.court_number}` : ''}
                            </p>
                          </div>
                          <Badge status={todayEventCanCheckIn ? (todayEventCheckedIn ? 'success' : 'warning') : 'default'}>
                            {todayEventCanCheckIn
                              ? (todayEventCheckedIn ? t('home.checked_in') : t('home.check_in'))
                              : String(todayEvent.status || '').toUpperCase() === 'COMPLETED'
                              ? t('home.completed')
                              : t('home.joining_closed')}
                          </Badge>
                        </div>
                        <p className="text-sm text-neutral-600">{formatBangkokDateTime(todayEvent.date)}</p>
                        <p className="text-xs text-neutral-500 mt-2">
                          {todayEventCanCheckIn
                            ? (todayEventCheckedIn ? t('home.tap_view_event') : t('home.tap_checkin_open_event'))
                            : t('home.tap_view_event')}
                        </p>
                      </Card>
                    )
                  })}
                </div>
              )}
            </Card>
          ) : (
            <Card
              onClick={() => navigate('/events', { state: { openCreateEvent: !hasUpcoming } })}
              className="cursor-pointer hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {hasUpcoming
                      ? t('home.upcoming_events', { count: upcomingCount, plural: getPluralSuffix(upcomingCount) })
                      : t('home.no_event_today')}
                  </h3>
                  {hasUpcoming ? (
                    <div className="text-sm text-neutral-600">
                      <p>{t('home.no_event_today_hint')}</p>
                      <p>{t('home.tap_see_upcoming')}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-600">
                      {t('home.no_upcoming_tap_create')}
                    </p>
                  )}
                </div>
                <Badge status={hasUpcoming ? 'warning' : 'default'}>
                  {hasUpcoming ? t('home.upcoming') : t('home.create')}
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
              {t('home.your_teams')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setJoinModalOpen(true)}
                className="p-2 hover:bg-neutral-200 rounded-lg transition"
                title={t('home.join_team_title')}
              >
                <Users size={20} className="text-primary-400" />
              </button>
              <button
                onClick={() => navigate('/teams/create')}
                className="p-2 hover:bg-neutral-200 rounded-lg transition"
                title={t('home.create_team_title')}
              >
                <Plus size={20} className="text-primary-400" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {teams.length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-neutral-600 mb-3">{t('home.no_teams_yet')}</p>
                <div className="space-y-3">
                  <Button
                    onClick={() => setJoinModalOpen(true)}
                    variant="secondary"
                    className="w-full"
                  >
                    {t('home.join_existing_team')}
                  </Button>
                  <Button
                    onClick={() => navigate('/teams/create')}
                    variant="primary"
                    className="w-full"
                  >
                    {t('home.create_team')}
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
                          {t('home.joined_on', { date: new Date(team.joined_at).toLocaleDateString() })}
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
        title={t('home.confirm_checkin')}
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
              {t('home.cancel')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDismissCheckIn(selectedCheckInEvent)}
              className="flex-1"
              disabled={!selectedCheckInEvent || checkInLoading}
            >
              {t('home.did_not_join')}
            </Button>
            <Button
              onClick={handleConfirmCheckIn}
              className="flex-1"
              loading={checkInLoading}
            >
              {t('home.check_in')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            {selectedCheckInEvent && hasDismissedCheckInEvent(user.id, selectedCheckInEvent.id)
              ? t('home.checkin_not_joined_warning')
              : t('home.checkin_join_hint')}
          </p>
          {selectedCheckInEvent && (
            <div className="rounded-2xl bg-neutral-50 p-4">
              <p className="font-semibold">{selectedCheckInEvent.title}</p>
              <p className="text-sm text-neutral-600 mt-1">{formatBangkokDateTime(selectedCheckInEvent.date)}</p>
              <p className="text-sm text-neutral-600">
                {selectedCheckInEvent.location || t('home.location_not_set')}
                {selectedCheckInEvent.court_number ? ` - ${t('home.court')} ${selectedCheckInEvent.court_number}` : ''}
              </p>
            </div>
          )}
          <p className="text-xs text-neutral-500">
            {t('home.checkin_allowed_days', { days: CHECKIN_PAYMENT_WINDOW_DAYS })}
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={pendingCheckInModalOpen}
        onClose={() => setPendingCheckInModalOpen(false)}
        title={t('home.pending_checkin_title', { count: pendingPastCheckInEvents.length })}
        footer={
          <Button
            variant="secondary"
            onClick={() => setPendingCheckInModalOpen(false)}
            className="w-full"
          >
            {t('home.close')}
          </Button>
        }
      >
        {pendingPastCheckInEvents.length === 0 ? (
          <p className="text-sm text-neutral-600">{t('home.no_pending_checkin')}</p>
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
                      {t('home.did_not_join')}
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleCheckInForEvent(event)}
                      loading={checkInLoading}
                      disabled={checkInLoading}
                    >
                      {t('home.check_in')}
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
        title={t('home.select_team')}
        footer={
          <Button
            variant="secondary"
            onClick={() => setSwitchTeamModalOpen(false)}
            className="w-full"
          >
            {t('home.close')}
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
                    {t('home.joined_on', { date: new Date(team.joined_at).toLocaleDateString() })}
                  </p>
                </div>
                {currentTeam?.team_id === team.team_id && (
                  <span className="text-xs font-semibold uppercase text-primary-400">
                    {t('home.current')}
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
        title={t('home.join_team')}
        footer={
          <Button
            variant="secondary"
            onClick={() => setJoinModalOpen(false)}
            className="w-full"
          >
            {t('home.close')}
          </Button>
        }
      >
        {allTeams.length === 0 ? (
          <p className="text-sm text-neutral-600">
            {t('home.no_teams_created')}
          </p>
        ) : availableTeams.length === 0 ? (
          <p className="text-sm text-neutral-600">
            {t('home.joined_all_teams')}
          </p>
        ) : (
          <div className="space-y-3">
            {availableTeams.map((team) => (
              <Card key={team.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-xs text-neutral-600">
                    {t('home.created_on', { date: new Date(team.created_at).toLocaleDateString() })}
                  </p>
                </div>
                <Button
                  onClick={() => handleJoinTeam(team.id)}
                  loading={joiningTeamId === team.id}
                >
                  {t('home.join')}
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


