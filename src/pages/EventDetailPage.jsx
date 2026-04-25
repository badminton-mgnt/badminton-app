import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header, Card, Button, Badge, BottomNav, Modal, Input } from '../components'
import {
  checkinParticipant,
  confirmPaymentTransfer,
  createPaymentTransfer,
  createExpense,
  getEventDetail,
  getEventExpenses,
  getEventPaymentTransfers,
  getEventParticipants,
  getTeam,
  getTeamMembers,
  getPaymentInfo,
  removeEventParticipant,
  getUserProfile,
  updateExpenseStatus,
  updateEvent,
  updatePaymentTransfer,
} from '../lib/api'
import {
  forgetCheckedInEvent,
  hasCheckedInEvent,
  rememberCheckedInEvent,
} from '../lib/checkinCache'
import { formatVndAmount } from '../lib/currency'
import { formatBangkokDateTime, getBangkokDateKey, toDateTimeLocalValue, toSupabaseDateTime } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { CheckCircle2, QrCode } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const CHECKIN_PAYMENT_WINDOW_DAYS = 3
const DAY_IN_MS = 24 * 60 * 60 * 1000
const TEXT_INPUT_MAX_LENGTH = 100
const COURT_NUMBER_MAX_LENGTH = 2
const NUMERIC_INPUT_MAX_LENGTH = 20

export const EventDetailPage = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [teamMemberCount, setTeamMemberCount] = useState(0)
  const [expenses, setExpenses] = useState([])
  const [paymentTransfers, setPaymentTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('user')
  const [currentUserName, setCurrentUserName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [expenseActionId, setExpenseActionId] = useState(null)
  const [paymentActionId, setPaymentActionId] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '' })
  const [receiverPaymentInfo, setReceiverPaymentInfo] = useState(null)
  const [receiverName, setReceiverName] = useState('Treasurer')
  const [teamTreasurerId, setTeamTreasurerId] = useState(null)
  const [paymentModalMode, setPaymentModalMode] = useState('PAY_TREASURER')
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentTargetInfo, setPaymentTargetInfo] = useState(null)
  const [loadingReceiverInfo, setLoadingReceiverInfo] = useState(false)
  const [receiverPaymentInfoError, setReceiverPaymentInfoError] = useState('')
  const [activeTab, setActiveTab] = useState('settlement')
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState([])
  const [participantActionLoading, setParticipantActionLoading] = useState(false)
  const [joiningClosing, setJoiningClosing] = useState(false)
  const [expenseClosing, setExpenseClosing] = useState(false)
  const [settlementCompleting, setSettlementCompleting] = useState(false)
  const [settlementHelpKey, setSettlementHelpKey] = useState(null)
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    location: '',
    court_number: '',
  })

  useEffect(() => {
    loadData()
  }, [eventId])

  const isParticipantCheckedIn = (participant) =>
    Boolean(participant?.checked_in)

  const syncTreasurerContributionTransfer = async ({
    eventData,
    participantsData,
    expensesData,
    transfersData,
    treasuryUserId,
  }) => {
    const normalizedEventStatus = String(eventData?.status || '').toUpperCase()
    const canSyncSettlement = ['FINALIZED', 'COMPLETED'].includes(normalizedEventStatus)

    if (!canSyncSettlement || !treasuryUserId) {
      return transfersData
    }

    const checkedInParticipants = (participantsData || []).filter((participant) => isParticipantCheckedIn(participant))
    const treasurerCheckedIn = checkedInParticipants.some(
      (participant) => String(participant.user_id) === String(treasuryUserId)
    )

    if (!treasurerCheckedIn) {
      return transfersData
    }

    const approvedExpenses = (expensesData || []).filter((expense) => expense.status === 'APPROVED')
    const totalExpense = approvedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    const treasurerShareAmount = checkedInParticipants.length > 0
      ? Math.round((totalExpense / checkedInParticipants.length) * 100) / 100
      : 0

    const treasurerApprovedExpenseTotal = approvedExpenses
      .filter((expense) => String(expense.user_id) === String(treasuryUserId))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    const treasurerPreSettlementBalance = treasurerApprovedExpenseTotal - treasurerShareAmount
    const desiredDirection = treasurerPreSettlementBalance > 0
      ? 'FROM_TREASURY'
      : treasurerPreSettlementBalance < 0
      ? 'TO_TREASURY'
      : null
    const desiredAmount = Math.round(Math.abs(treasurerPreSettlementBalance) * 100) / 100

    const implicitTransfer = (transfersData || []).find(
      (transfer) =>
        String(transfer.from_user_id) === String(treasuryUserId) &&
        String(transfer.to_user_id) === String(treasuryUserId) &&
        ['FROM_TREASURY', 'TO_TREASURY'].includes(String(transfer.direction || '').toUpperCase())
    )

    if (!desiredDirection || desiredAmount <= 0.01) {
      if (!implicitTransfer) {
        return transfersData
      }

      const shouldResetAmount = Math.abs(Number(implicitTransfer.amount || 0)) >= 0.01
      const shouldUpdateStatus = String(implicitTransfer.status || '').toUpperCase() !== 'CONFIRMED'

      if (!shouldResetAmount && !shouldUpdateStatus) {
        return transfersData
      }

      await updatePaymentTransfer(implicitTransfer.id, {
        amount: 0,
        status: 'CONFIRMED',
        confirmed_at: implicitTransfer.confirmed_at || new Date().toISOString(),
      })

      return getEventPaymentTransfers(eventId)
    }

    if (implicitTransfer) {
      const shouldUpdateAmount = Math.abs(Number(implicitTransfer.amount || 0) - desiredAmount) >= 0.01
      const shouldUpdateDirection = String(implicitTransfer.direction || '').toUpperCase() !== desiredDirection
      const shouldUpdateStatus = String(implicitTransfer.status || '').toUpperCase() !== 'CONFIRMED'

      if (!shouldUpdateAmount && !shouldUpdateDirection && !shouldUpdateStatus) {
        return transfersData
      }

      await updatePaymentTransfer(implicitTransfer.id, {
        amount: desiredAmount,
        direction: desiredDirection,
        status: 'CONFIRMED',
        confirmed_at: implicitTransfer.confirmed_at || new Date().toISOString(),
      })

      return getEventPaymentTransfers(eventId)
    }

    await createPaymentTransfer({
      team_id: eventData.team_id,
      event_id: eventId,
      from_user_id: treasuryUserId,
      to_user_id: treasuryUserId,
      amount: desiredAmount,
      direction: desiredDirection,
      status: 'CONFIRMED',
      confirmed_at: new Date().toISOString(),
    })

    return getEventPaymentTransfers(eventId)
  }

  const loadData = async () => {
    try {
      setLoadError('')
      const [eventResult, participantsResult, expensesResult, transfersResult, profileResult] = await Promise.allSettled([
        getEventDetail(eventId),
        getEventParticipants(eventId),
        getEventExpenses(eventId),
        getEventPaymentTransfers(eventId),
        getUserProfile(user.id),
      ])

      if (eventResult.status !== 'fulfilled') {
        throw eventResult.reason
      }

      const eventData = eventResult.value
      const participantsData = participantsResult.status === 'fulfilled' ? participantsResult.value : null
      const expensesData = expensesResult.status === 'fulfilled' ? expensesResult.value : null
      let transfersData = transfersResult.status === 'fulfilled' ? transfersResult.value : null
      const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null

      setEvent(eventData)
      let treasuryUserId = null
      if (eventData?.team_id) {
        const [teamMembersResult, teamResult] = await Promise.allSettled([
          getTeamMembers(eventData.team_id),
          getTeam(eventData.team_id),
        ])

        if (teamMembersResult.status === 'fulfilled') {
          setTeamMembers(teamMembersResult.value)
          setTeamMemberCount(teamMembersResult.value.length)
        } else {
          console.error('Error loading team members:', teamMembersResult.reason)
          setTeamMembers([])
          setTeamMemberCount(0)
        }

        if (teamResult.status === 'fulfilled') {
          treasuryUserId = teamResult.value?.treasurer_id || null
          setTeamTreasurerId(treasuryUserId)
        } else {
          console.error('Error loading team detail:', teamResult.reason)
          setTeamTreasurerId(null)
        }
      } else {
        setTeamMembers([])
        setTeamMemberCount(0)
        setTeamTreasurerId(null)
      }

      if (eventData?.team_id && participantsData && expensesData && transfersData && treasuryUserId) {
        try {
          transfersData = await syncTreasurerContributionTransfer({
            eventData,
            participantsData,
            expensesData,
            transfersData,
            treasuryUserId,
          })
        } catch (syncError) {
          console.warn('Treasury contribution sync warning:', syncError)
        }
      }

      if (participantsData) {
        setParticipants(participantsData)
        const userCheckedIn = participantsData.some(
          (participant) => String(participant.user_id) === String(user.id) && isParticipantCheckedIn(participant)
        )

        if (userCheckedIn) {
          rememberCheckedInEvent(user.id, eventId)
        } else {
          forgetCheckedInEvent(user.id, eventId)
        }
      }
      if (expensesData) {
        setExpenses(expensesData)
      }
      if (transfersData) {
        setPaymentTransfers(transfersData)
      }
      if (profileData) {
        setCurrentUserRole((profileData.role || 'user').toLowerCase())
        setCurrentUserName(profileData.name || '')
      }

      if (treasuryUserId) {
        setReceiverPaymentInfoError('')
        const [receiverProfileResult, receiverPaymentInfoResult] = await Promise.allSettled([
          getUserProfile(treasuryUserId),
          getPaymentInfo(treasuryUserId),
        ])

        if (receiverProfileResult.status === 'fulfilled') {
          setReceiverName(receiverProfileResult.value?.name || 'Treasurer')
        } else {
          setReceiverName('Treasurer')
        }

        if (receiverPaymentInfoResult.status === 'fulfilled') {
          setReceiverPaymentInfo(receiverPaymentInfoResult.value)
        } else {
          setReceiverPaymentInfo(null)
          setReceiverPaymentInfoError(receiverPaymentInfoResult.reason?.message || 'Unable to load treasurer payment info.')
        }
      } else {
        setReceiverName('Treasurer not set')
        setReceiverPaymentInfo(null)
        setReceiverPaymentInfoError('')
      }

      setEventForm({
        title: eventData.title || '',
        date: toDateTimeLocalValue(eventData.date),
        location: eventData.location || '',
        court_number: eventData.court_number ? String(eventData.court_number) : '',
      })
    } catch (error) {
      console.error('Error loading event:', error)
      setLoadError('Unable to load this event right now.')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionTabClick = (nextTab) => {
    setActiveTab(nextTab)
    loadData()
  }

  const handleOpenTreasuryTransferModal = async () => {
    if (!canRunSettlement) {
      return
    }

    setPaymentModalMode('PAY_TREASURER')
    setPaymentTarget(null)
    setPaymentTargetInfo(null)
    setReceiverPaymentInfoError('')
    if (teamTreasurerId) {
      try {
        setLoadingReceiverInfo(true)
        const [receiverProfileResult, receiverPaymentInfoResult] = await Promise.allSettled([
          getUserProfile(teamTreasurerId),
          getPaymentInfo(teamTreasurerId),
        ])

        if (receiverProfileResult.status === 'fulfilled') {
          setReceiverName(receiverProfileResult.value?.name || 'Treasurer')
        }

        if (receiverPaymentInfoResult.status === 'fulfilled') {
          setReceiverPaymentInfo(receiverPaymentInfoResult.value)
        } else {
          setReceiverPaymentInfo(null)
          setReceiverPaymentInfoError(receiverPaymentInfoResult.reason?.message || 'Unable to load treasurer payment info.')
        }
      } catch (error) {
        console.error('Error loading treasurer payment info:', error)
        setReceiverPaymentInfo(null)
        setReceiverPaymentInfoError(error.message || 'Unable to load treasurer payment info.')
      } finally {
        setLoadingReceiverInfo(false)
      }
    }
    setPaymentModalOpen(true)
  }

  const handleOpenPayoutModal = async (target) => {
    if (!canRunSettlement) {
      return
    }

    try {
      setActionLoading(true)
      setPaymentModalMode('PAY_MEMBER')
      setPaymentTarget(target)
      const info = await getPaymentInfo(target.user_id)
      setPaymentTargetInfo(info)
      setPaymentModalOpen(true)
    } catch (error) {
      console.error('Error loading payout target info:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const isTeamTreasurer =
    Boolean(teamTreasurerId) &&
    Boolean(user?.id) &&
    String(teamTreasurerId).toLowerCase() === String(user.id).toLowerCase()
  const canBypassCheckInGate = currentUserRole === 'admin'
  const canManageParticipantCheckIn = ['admin', 'sub_admin'].includes(currentUserRole) || isTeamTreasurer
  const canAutoApproveExpense = ['admin', 'sub_admin'].includes(currentUserRole) || isTeamTreasurer
  const canManageTreasury = isTeamTreasurer
  const normalizedEventStatus = String(event?.status || '').toUpperCase()
  const isSettlementCompleted = normalizedEventStatus === 'COMPLETED'
  const isJoiningClosed = ['FINALIZED', 'COMPLETED'].includes(normalizedEventStatus)
  const isExpenseAddingClosed = Boolean(event?.expenses_closed_at) || isSettlementCompleted
  const canCloseJoining = ['admin', 'sub_admin'].includes(currentUserRole) || isTeamTreasurer
  const canCloseExpenseAdding = isTeamTreasurer && isJoiningClosed && !isExpenseAddingClosed && !isSettlementCompleted

  const eventStartAtMs = event?.date ? new Date(event.date).getTime() : Number.NaN
  const hasValidEventStartAt = Number.isFinite(eventStartAtMs)
  const isEventPast = hasValidEventStartAt ? eventStartAtMs < Date.now() : false
  const checkInDeadlineAtMs = hasValidEventStartAt
    ? eventStartAtMs + (CHECKIN_PAYMENT_WINDOW_DAYS * DAY_IN_MS)
    : Number.NaN
  const isWithinCheckInWindow = Number.isFinite(checkInDeadlineAtMs)
    ? Date.now() <= checkInDeadlineAtMs
    : false
  const isToday = event?.date ? getBangkokDateKey(event.date) === getBangkokDateKey(new Date()) : false
  const isUpcomingEvent = hasValidEventStartAt ? eventStartAtMs > Date.now() : false
  const requiresCheckInForDetails = !['CANCELLED', 'FINALIZED', 'COMPLETED'].includes(normalizedEventStatus)
  const shouldRequireCheckInForAccess =
    !canBypassCheckInGate &&
    requiresCheckInForDetails &&
    (isToday || (isEventPast && isWithinCheckInWindow))
  const headerStatusLabel = isToday ? 'Today' : isUpcomingEvent ? 'Upcoming' : ''
  const headerStatusBadge = isToday ? 'success' : isUpcomingEvent ? 'warning' : 'default'
  const currentParticipant = participants.find((participant) => String(participant.user_id) === String(user.id))
  const isCheckedIn = isParticipantCheckedIn(currentParticipant) || hasCheckedInEvent(user.id, eventId)
  const canViewProtectedDetails = !shouldRequireCheckInForAccess || isCheckedIn
  const checkedInAtLabel = currentParticipant?.checked_in_at
    ? formatBangkokDateTime(currentParticipant.checked_in_at)
    : ''
  const checkedInByName = currentParticipant?.checked_in_by_user?.name || ''
  const checkedInBySelf = Boolean(currentParticipant?.checked_in_by) && String(currentParticipant.checked_in_by) === String(user.id)
  const checkedInParticipantIdSet = new Set(participants.map((participant) => String(participant.user_id)))
  const addableTeamMembers = teamMembers.filter((member) => !checkedInParticipantIdSet.has(String(member.user_id)))

  const handleCheckIn = async () => {
    if (!isWithinCheckInWindow || isJoiningClosed) {
      return
    }

    try {
      setActionLoading(true)
      const participant = await checkinParticipant(eventId, user.id)
      rememberCheckedInEvent(user.id, eventId)
      setParticipants((prev) => {
        const nextParticipant = {
          ...participant,
          user_id: user.id,
          checked_in: true,
          users: {
            id: user.id,
            name: currentUserName || 'You',
          },
        }
        const existingIndex = prev.findIndex((item) => String(item.user_id) === String(user.id))

        if (existingIndex >= 0) {
          const next = [...prev]
          next[existingIndex] = { ...next[existingIndex], ...nextParticipant }
          return next
        }

        return [...prev, nextParticipant]
      })
      await loadData()
    } catch (error) {
      console.error('Error checking in:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddParticipantAsCheckedIn = async () => {
    if (selectedMembersToAdd.length === 0 || !canManageParticipantCheckIn || isJoiningClosed) {
      return
    }

    try {
      setParticipantActionLoading(true)
      await Promise.all(
        selectedMembersToAdd.map((memberUserId) => checkinParticipant(eventId, memberUserId, user.id))
      )
      setSelectedMembersToAdd([])
      await loadData()
    } catch (error) {
      console.error('Error adding participant to event:', error)
    } finally {
      setParticipantActionLoading(false)
    }
  }

  const handleRemoveParticipant = async (participantId) => {
    if (!participantId || currentUserRole !== 'admin' || isJoiningClosed) {
      return
    }

    try {
      setParticipantActionLoading(true)
      await removeEventParticipant(participantId)
      await loadData()
    } catch (error) {
      console.error('Error removing event participant:', error)
    } finally {
      setParticipantActionLoading(false)
    }
  }

  const handleConfirmPaymentReceived = async (transferId) => {
    try {
      setPaymentActionId(transferId)
      await confirmPaymentTransfer(transferId)
      await loadData()
    } catch (error) {
      console.error('Error confirming payment:', error)
    } finally {
      setPaymentActionId(null)
    }
  }

  const handleCreateExpense = async () => {
    if (!isJoiningClosed || isExpenseAddingClosed) {
      setExpenseModalOpen(false)
      return
    }

    try {
      setActionLoading(true)
      await createExpense({
        event_id: eventId,
        user_id: user.id,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        team_id: event.team_id,
        status: canAutoApproveExpense ? 'APPROVED' : 'PENDING',
      })
      setExpenseForm({ amount: '', description: '' })
      setExpenseModalOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error creating expense:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSavePayment = async () => {
    if (!canRunSettlement) {
      setPaymentModalOpen(false)
      return
    }

    try {
      setActionLoading(true)

      if (paymentModalMode === 'PAY_TREASURER') {
        if (!isCheckedIn || transferAmount <= 0 || !teamTreasurerId) {
          setPaymentModalOpen(false)
          return
        }

        await createPaymentTransfer({
          team_id: event.team_id,
          event_id: eventId,
          from_user_id: user.id,
          to_user_id: teamTreasurerId,
          amount: transferAmount,
          direction: 'TO_TREASURY',
          status: 'WAITING_CONFIRM',
        })
      } else if (paymentModalMode === 'PAY_MEMBER') {
        if (!paymentTarget?.user_id || payoutTransferAmount <= 0 || !teamTreasurerId) {
          setPaymentModalOpen(false)
          return
        }

        await createPaymentTransfer({
          team_id: event.team_id,
          event_id: eventId,
          from_user_id: teamTreasurerId,
          to_user_id: paymentTarget.user_id,
          amount: payoutTransferAmount,
          direction: 'FROM_TREASURY',
          status: 'WAITING_CONFIRM',
        })
      } else {
        setPaymentModalOpen(false)
        return
      }

      setPaymentModalOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error saving payment:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleExpenseStatusChange = async (expenseId, status) => {
    try {
      setExpenseActionId(expenseId)
      await updateExpenseStatus(expenseId, status, user.id)
      await loadData()
    } catch (error) {
      console.error(`Error updating expense to ${status}:`, error)
    } finally {
      setExpenseActionId(null)
    }
  }

  const handleSaveEvent = async () => {
    try {
      setActionLoading(true)
      await updateEvent(eventId, {
        title: eventForm.title,
        date: toSupabaseDateTime(eventForm.date),
        location: eventForm.location,
        court_number: eventForm.court_number ? parseInt(eventForm.court_number, 10) : null,
      })
      setEditModalOpen(false)
      await loadData()
    } catch (error) {
      console.error('Error updating event:', error)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!event) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="pb-24"
      >
        <Header title="Event Detail" subtitle="Unavailable" />
        <div className="container-mobile py-6">
          <Card className="space-y-4">
            <p className="text-sm text-neutral-600">
              {loadError || 'Unable to load this event right now.'}
            </p>
            <Button variant="secondary" onClick={() => navigate('/events')}>
              Back to Events
            </Button>
          </Card>
        </div>
        <BottomNav />
      </motion.div>
    )
  }

  const checkedInCount = participants.filter((participant) => isParticipantCheckedIn(participant)).length
  const approvedExpenses = expenses.filter((expense) => expense.status === 'APPROVED')
  const totalExpense = approvedExpenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
  const canRunSettlement = isJoiningClosed && isExpenseAddingClosed
  const share = canRunSettlement && checkedInCount > 0 ? Math.round((totalExpense / checkedInCount) * 100) / 100 : 0
  const userShare = isCheckedIn ? share : 0
  const treasuryUserId = teamTreasurerId
  const transferStatus = (status) => String(status || '').toUpperCase()
  const transferDirection = (direction) => String(direction || '').toUpperCase().trim()
  const isTransferConfirmed = (status) => ['CONFIRMED', 'COMPLETE', 'COMPLETED'].includes(transferStatus(status))
  const isTransferWaiting = (status) => ['WAITING_CONFIRM', 'WAITING', 'PENDING'].includes(transferStatus(status))
  const isToTreasuryDirection = (direction) => transferDirection(direction) === 'TO_TREASURY'
  const isFromTreasuryDirection = (direction) => transferDirection(direction) === 'FROM_TREASURY'
  const isToTreasuryTransfer = (transfer) =>
    isToTreasuryDirection(transfer.direction) || (!transfer.direction && String(transfer.to_user_id) === String(treasuryUserId))
  const isFromTreasuryTransfer = (transfer) =>
    isFromTreasuryDirection(transfer.direction) || (!transfer.direction && String(transfer.from_user_id) === String(treasuryUserId))
  const getParticipantSettlement = (participantUserId, participantCheckedIn = true) => {
    if (!participantCheckedIn || !canRunSettlement) {
      return {
        approvedExpenseTotal: 0,
        confirmedPaidToTreasury: 0,
        confirmedReimbursedFromTreasury: 0,
        waitingToTreasuryAmount: 0,
        latestWaitingToTreasuryTransfer: null,
        waitingIncomingPayoutTransfer: null,
        preSettlementBalance: 0,
        normalizedPreSettlementBalance: 0,
        contributionAmount: 0,
        balance: 0,
        normalizedBalance: 0,
      }
    }

    const approvedExpenseTotal = approvedExpenses
      .filter((expense) => String(expense.user_id) === String(participantUserId))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

    const confirmedPaidToTreasury = paymentTransfers
      .filter(
        (transfer) =>
          String(transfer.from_user_id) === String(participantUserId) &&
          String(transfer.to_user_id) === String(treasuryUserId) &&
          isToTreasuryTransfer(transfer) &&
          isTransferConfirmed(transfer.status)
      )
      .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

    const waitingToTreasuryTransfers = paymentTransfers.filter(
      (transfer) =>
        String(transfer.from_user_id) === String(participantUserId) &&
        String(transfer.to_user_id) === String(treasuryUserId) &&
        isToTreasuryTransfer(transfer) &&
        isTransferWaiting(transfer.status)
    )

    const confirmedReimbursedFromTreasury = paymentTransfers
      .filter(
        (transfer) =>
          String(transfer.from_user_id) === String(treasuryUserId) &&
          String(transfer.to_user_id) === String(participantUserId) &&
          isFromTreasuryTransfer(transfer) &&
          isTransferConfirmed(transfer.status)
      )
      .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

    const waitingIncomingPayoutTransfer = paymentTransfers.find(
      (transfer) =>
        String(transfer.from_user_id) === String(treasuryUserId) &&
        String(transfer.to_user_id) === String(participantUserId) &&
        isFromTreasuryTransfer(transfer) &&
        isTransferWaiting(transfer.status)
    ) || null

    const preSettlementBalance = approvedExpenseTotal - share
    const normalizedPreSettlementBalance = Math.abs(preSettlementBalance) < 1.0 ? 0 : preSettlementBalance
    const contributionAmount = approvedExpenseTotal + confirmedPaidToTreasury - confirmedReimbursedFromTreasury
    const balance = preSettlementBalance + confirmedPaidToTreasury - confirmedReimbursedFromTreasury
    const normalizedBalance = Math.abs(balance) < 1.0 ? 0 : balance

    return {
      approvedExpenseTotal,
      confirmedPaidToTreasury,
      confirmedReimbursedFromTreasury,
      waitingToTreasuryAmount: waitingToTreasuryTransfers.reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0),
      latestWaitingToTreasuryTransfer: waitingToTreasuryTransfers[0] || null,
      waitingIncomingPayoutTransfer,
      preSettlementBalance,
      normalizedPreSettlementBalance,
      contributionAmount,
      balance,
      normalizedBalance,
    }
  }

  const currentUserSettlement = getParticipantSettlement(user.id, isCheckedIn)
  const confirmedUserToTreasuryAmount = currentUserSettlement.confirmedPaidToTreasury
  const waitingUserToTreasuryAmount = currentUserSettlement.waitingToTreasuryAmount
  const latestWaitingUserToTreasuryTransfer = currentUserSettlement.latestWaitingToTreasuryTransfer
  const userApprovedExpenseTotal = currentUserSettlement.approvedExpenseTotal
  const transferAmount = canRunSettlement
    ? Math.max(-currentUserSettlement.balance, 0)
    : 0

  const userPaymentStatus =
    !canRunSettlement
      ? 'joining_open'
      : transferAmount <= 0
      ? 'complete'
      : waitingUserToTreasuryAmount > 0
      ? 'waiting_confirm'
      : 'pending'

  const confirmedIncomingPayoutAmount = currentUserSettlement.confirmedReimbursedFromTreasury
  const normalizedBalance = currentUserSettlement.normalizedBalance

  const waitingConfirmationPayments = paymentTransfers.filter(
    (transfer) =>
      String(transfer.to_user_id) === String(treasuryUserId) &&
      isToTreasuryTransfer(transfer) &&
      isTransferWaiting(transfer.status)
  )

  const waitingIncomingPayoutTransfer = currentUserSettlement.waitingIncomingPayoutTransfer

  const checkedInParticipants = participants.filter((participant) => isParticipantCheckedIn(participant))
  const participantSettlements = canRunSettlement
    ? checkedInParticipants.map((participant) => ({
      participant,
      settlement: getParticipantSettlement(participant.user_id, true),
    }))
    : []

  const membersNeedingPayout = canRunSettlement
    ? participantSettlements
      .map(({ participant, settlement }) => ({
        user_id: participant.user_id,
        name: participant.users?.name || 'Member',
        payoutNeeded: Math.max(settlement.normalizedBalance, 0),
        waitingTransfer: settlement.waitingIncomingPayoutTransfer,
      }))
      .filter((member) => String(member.user_id) !== String(treasuryUserId) && member.payoutNeeded > 0)
    : []

  const payoutTransferAmount = paymentTarget
    ? Math.max(paymentTarget.payoutNeeded - (Number(paymentTarget?.waitingTransfer?.amount || 0)), 0)
    : 0

  const confirmedToTreasuryAmount = paymentTransfers
    .filter(
      (transfer) =>
        String(transfer.to_user_id) === String(treasuryUserId) &&
        isToTreasuryTransfer(transfer) &&
        isTransferConfirmed(transfer.status)
    )
    .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

  const confirmedFromTreasuryAmount = paymentTransfers
    .filter(
      (transfer) =>
        String(transfer.from_user_id) === String(treasuryUserId) &&
        isFromTreasuryTransfer(transfer) &&
        isTransferConfirmed(transfer.status)
    )
    .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)
  const confirmedPayoutFromTreasuryAmount = paymentTransfers
    .filter(
      (transfer) =>
        String(transfer.from_user_id) === String(treasuryUserId) &&
        String(transfer.to_user_id) !== String(treasuryUserId) &&
        isFromTreasuryTransfer(transfer) &&
        isTransferConfirmed(transfer.status)
    )
    .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

  const treasurySentAmount = confirmedFromTreasuryAmount
  const treasuryExpenseTotal = totalExpense
  const treasuryNetFund = confirmedToTreasuryAmount - treasurySentAmount
  const normalizedTreasuryNetFund = Math.abs(treasuryNetFund) < 1.0 ? 0 : treasuryNetFund
  const confirmedTreasuryReceivedTransfers = paymentTransfers.filter(
    (transfer) =>
      String(transfer.to_user_id) === String(treasuryUserId) &&
      isToTreasuryTransfer(transfer) &&
      isTransferConfirmed(transfer.status)
  )
  const confirmedTreasurySentTransfers = paymentTransfers.filter(
    (transfer) =>
      String(transfer.from_user_id) === String(treasuryUserId) &&
      isFromTreasuryTransfer(transfer) &&
      isTransferConfirmed(transfer.status)
  )

  const userPaymentStatusLabel =
    userPaymentStatus === 'joining_open'
      ? 'Joining Open'
      : userPaymentStatus === 'complete'
      ? 'Complete'
      : userPaymentStatus === 'waiting_confirm'
      ? 'Waiting Confirm'
      : 'Pending'

  const userPaymentStatusBadge =
    userPaymentStatus === 'joining_open'
      ? 'default'
      : userPaymentStatus === 'complete'
      ? 'success'
      : userPaymentStatus === 'waiting_confirm'
      ? 'warning'
      : 'warning'

  const paymentActionLabel =
    userPaymentStatus === 'joining_open'
      ? 'Joining Open'
      : userPaymentStatus === 'complete'
      ? 'View Transfer Info'
      : userPaymentStatus === 'waiting_confirm'
      ? 'Waiting Confirm'
      : 'Transfer & Confirm'

  const paymentStatusBadgeClassName =
    userPaymentStatus === 'joining_open'
      ? 'border border-neutral-300 bg-white'
      : userPaymentStatus === 'complete'
      ? 'border border-success-300 bg-white'
      : 'border border-warning-300'

  const paymentStatusHint =
    userPaymentStatus === 'joining_open'
      ? 'Settlement is locked until admin/treasurer marks Joining Closed.'
      : userPaymentStatus === 'waiting_confirm'
      ? `Transferred đ ${formatVndAmount(Number(latestWaitingUserToTreasuryTransfer?.amount || waitingUserToTreasuryAmount || 0))} - waiting for treasurer confirmation`
      : isTeamTreasurer
      ? 'Treasurer payments are managed in the Treasury section.'
      : normalizedBalance < 0
      ? 'You need to pay this amount.'
      : normalizedBalance > 0
      ? 'The fund will reimburse this amount to you, so you do not need to transfer more.'
      : 'No additional transfer is needed.'

  const settlementHelpContent = {
    totalExpense: {
      title: 'Total Expense',
      description: 'The total approved expense amount for this event. This value is split across checked-in participants to calculate each person\'s share.',
    },
    yourShare: {
      title: 'Your Share',
      description: 'Your share = Total Expense / number of checked-in participants. This is your expected contribution for the event.',
    },
    yourExpenseTotal: {
      title: 'Your Expense Total',
      description: 'The total amount you personally paid and got approved as expenses in this event. It does not include settlement transfers.',
    },
    yourBalance: {
      title: 'Your Balance',
      description: 'Your remaining settlement balance after combining your share, approved expenses, transfers to treasury, and reimbursements from treasury. Negative means you still need to pay, positive means you should receive, and zero means fully settled.',
    },
  }
  const activeSettlementHelp = settlementHelpKey ? settlementHelpContent[settlementHelpKey] : null

  const isSettlementReadyToComplete =
    isTeamTreasurer &&
    canRunSettlement &&
    waitingConfirmationPayments.length === 0 &&
    participantSettlements.every(({ settlement }) => settlement.normalizedBalance === 0)

  const handleMarkJoiningClosed = async () => {
    if (!canCloseJoining || isJoiningClosed) {
      return
    }

    try {
      setJoiningClosing(true)
      const updatedEvent = await updateEvent(eventId, { status: 'FINALIZED' })
      setEvent((prev) => ({
        ...(prev || {}),
        ...(updatedEvent || {}),
        status: updatedEvent?.status || 'FINALIZED',
      }))
      await loadData()
    } catch (error) {
      console.error('Error marking joining closed:', error)
    } finally {
      setJoiningClosing(false)
    }
  }

  const handleCloseExpenseAdding = async () => {
    if (!canCloseExpenseAdding) {
      return
    }

    try {
      setExpenseClosing(true)
      const closedAt = new Date().toISOString()
      const updatedEvent = await updateEvent(eventId, {
        expenses_closed_at: closedAt,
        expenses_closed_by: user.id,
      })
      setEvent((prev) => ({
        ...(prev || {}),
        ...(updatedEvent || {}),
        expenses_closed_at: updatedEvent?.expenses_closed_at || closedAt,
        expenses_closed_by: updatedEvent?.expenses_closed_by || user.id,
      }))
      await loadData()
    } catch (error) {
      console.error('Error closing expense adding:', error)
    } finally {
      setExpenseClosing(false)
    }
  }

  const handleMarkSettlementCompleted = async () => {
    if (!isTeamTreasurer || isSettlementCompleted || !isSettlementReadyToComplete) {
      return
    }

    try {
      setSettlementCompleting(true)
      const updatedEvent = await updateEvent(eventId, { status: 'COMPLETED' })
      setEvent((prev) => ({
        ...(prev || {}),
        ...(updatedEvent || {}),
        status: updatedEvent?.status || 'COMPLETED',
      }))
    } catch (error) {
      console.error('Error completing settlement:', error)
    } finally {
      setSettlementCompleting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-24"
    >
      <Header
        title={event?.title || 'Event Detail'}
        action={
          headerStatusLabel ? (
            <Badge status={headerStatusBadge}>
              {headerStatusLabel}
            </Badge>
          ) : null
        }
        subtitleContent={(
          <div className="text-sm opacity-90 space-y-1">
            <p>{formatBangkokDateTime(event?.date)}</p>
            <p>{`Location: ${event?.court_number ? `Court ${event.court_number}` : 'Court not assigned'}`} - {`${event?.location || 'Location not set'}`}</p>
          </div>
        )}
      />

      <div className="container-mobile py-6 space-y-6">
        {isCheckedIn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={isCheckedIn ? 'bg-success-50 border-success-700' : 'bg-warning-50 border-warning-900'}>
              <div className="flex items-center justify-between gap-3">
                <div>    
                  <p className="font-semibold">
                    {isCheckedIn ? 'You are checked in for this event.' : 'Check in to include this event in settlement.'}
                  </p>
                  {isCheckedIn && checkedInAtLabel && (
                    <p className="text-xs text-neutral-600 mt-1">
                      {checkedInByName && !checkedInBySelf
                        ? `Checked in at ${checkedInAtLabel} by ${checkedInByName}`
                        : `Checked in at ${checkedInAtLabel}`}
                    </p>
                  )}
                </div>
                {isCheckedIn ? (
                  <Badge status="success">Checked In</Badge>
                ) : (
                  <Button onClick={handleCheckIn} loading={actionLoading}>
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      Check In
                    </span>
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {!canViewProtectedDetails ? (
          <Card className="space-y-4">
            <p className="text-sm text-neutral-600">
              {isEventPast
                ? 'You did not check in for this event, so you cannot view this event details page.'
                : 'You need to check in before opening this event details page.'}
            </p>
            <p className="text-sm text-neutral-600">
              {`Your amount stays at đ ${formatVndAmount(0)} if you do not check in for this event.`}
            </p>
            <div className="space-y-3 pt-1">
              {isWithinCheckInWindow && (
                <Button onClick={handleCheckIn} loading={actionLoading} className="w-full">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Check In
                  </span>
                </Button>
              )}
              <Button variant="secondary" onClick={() => navigate('/')} className="w-full">
                Back to Home
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="p-2 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 px-2">
                Sections
              </p>
              <div className={`grid gap-2 ${(canAutoApproveExpense || canManageTreasury) ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                    activeTab === 'settlement'
                      ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => handleSectionTabClick('settlement')}
                >
                  Settlement
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                    activeTab === 'participants'
                      ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => handleSectionTabClick('participants')}
                >
                  {`Participants`}
                </button>
                <button
                  type="button"
                  className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                    activeTab === 'expenses'
                      ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                  onClick={() => handleSectionTabClick('expenses')}
                >
                  {`Expenses`}
                </button>
                {(canAutoApproveExpense || canManageTreasury) && (
                  <button
                    type="button"
                    className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                      activeTab === 'treasury'
                        ? 'border-primary-400 bg-primary-400 text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                    onClick={() => handleSectionTabClick('treasury')}
                  >
                    Treasury
                  </button>
                )}
              </div>
            </Card>

            {activeTab === 'settlement' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
              {!isJoiningClosed && (
                <Card className="mb-3 bg-warning-50 border-warning-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-neutral-600 uppercase">Joining Status</p>
                      <p className="text-sm font-semibold text-neutral-800">
                        {canCloseJoining
                          ? 'Joining Open - mark Joining Closed after all players have joined.'
                          : 'Joining Open - payment is calculated only after all admin/treasurer marks Joining Closed.'}
                      </p>
                    </div>
                    {canCloseJoining && (
                      <Button
                        onClick={handleMarkJoiningClosed}
                        loading={joiningClosing}
                        disabled={joiningClosing || isSettlementCompleted}
                        className="w-full sm:w-auto shrink-0 whitespace-nowrap"
                      >
                        Lock
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {isJoiningClosed && !isExpenseAddingClosed && (
                <Card className="mb-3 bg-warning-50 border-warning-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-neutral-600 uppercase">Expense Adding Status</p>
                      <p className="text-sm font-semibold text-neutral-800">
                        {canCloseExpenseAdding
                          ? 'Expense adding is open. Lock it before settlement.'
                          : isTeamTreasurer
                          ? 'Lock expenses before settlement.'
                          : 'Expense adding is still open. You still have time to add expenses before treasurer locks settlement.'}
                      </p>
                    </div>
                    {canCloseExpenseAdding && (
                      <Button
                        onClick={handleCloseExpenseAdding}
                        loading={expenseClosing}
                        disabled={expenseClosing || isSettlementCompleted}
                        className="w-full sm:w-auto shrink-0 whitespace-nowrap"
                      >
                        Lock Expenses
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {canRunSettlement && (
                <p className="mb-3 text-xs text-neutral-600">
                  Expense adding is closed. Settlement numbers are now locked for calculation.
                </p>
              )}

              <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                Settlement
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-600">Total Expense</p>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100"
                      onClick={() => setSettlementHelpKey('totalExpense')}
                      aria-label="Explain Total Expense"
                    >
                      ?
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-primary-400">{`đ ${formatVndAmount(totalExpense)}`}</p>
                </Card>
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-600">Your Share</p>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100"
                      onClick={() => setSettlementHelpKey('yourShare')}
                      aria-label="Explain Your Share"
                    >
                      ?
                    </button>
                  </div>
                  <p className="text-2xl font-bold">{`đ ${formatVndAmount(userShare)}`}</p>
                </Card>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-600">Your Expense Total</p>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100"
                      onClick={() => setSettlementHelpKey('yourExpenseTotal')}
                      aria-label="Explain Your Expense Total"
                    >
                      ?
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-primary-400">
                    {`đ ${formatVndAmount(userApprovedExpenseTotal)}`}
                  </p>
                  {!isCheckedIn && !isUpcomingEvent && (
                    <p className="text-xs text-neutral-600 mt-3">
                      {`You did not join this event, so your payment amount stays at đ ${formatVndAmount(0)}.`}
                    </p>
                  )}
                </Card>

                <Card className={normalizedBalance < 0 ? 'bg-error-50' : 'bg-success-50'}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-600">Your Balance</p>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-semibold text-neutral-600 hover:bg-white/70"
                      onClick={() => setSettlementHelpKey('yourBalance')}
                      aria-label="Explain Your Balance"
                    >
                      ?
                    </button>
                  </div>
                  <p className={`text-2xl font-bold ${normalizedBalance < 0 ? 'text-error-800' : 'text-success-700'}`}>
                    {normalizedBalance < 0
                      ? `đ -${formatVndAmount(Math.abs(normalizedBalance))}`
                      : `đ ${formatVndAmount(normalizedBalance)}`}
                  </p>
                  {isTeamTreasurer && normalizedBalance < 0 && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {`You need to contribute đ${formatVndAmount(Math.abs(normalizedBalance))} to the treasury.`}
                    </p>
                  )}
                  {isTeamTreasurer && normalizedBalance > 0 && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {`Members still owe đ${formatVndAmount(normalizedBalance)} to the treasury.`}
                    </p>
                  )}
                  {isTeamTreasurer && normalizedBalance === 0 && canRunSettlement && confirmedToTreasuryAmount > 0 && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {`Members paid đ${formatVndAmount(confirmedToTreasuryAmount)} to the treasury.`}
                    </p>
                  )}
                  {isTeamTreasurer && normalizedBalance === 0 && canRunSettlement && confirmedPayoutFromTreasuryAmount > 0 && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {`The treasury paid đ${formatVndAmount(confirmedPayoutFromTreasuryAmount)} to members.`}
                    </p>
                  )}
                  {normalizedBalance === 0 && canRunSettlement && isCheckedIn && !isTeamTreasurer && confirmedUserToTreasuryAmount > 0 && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {`You paid đ${formatVndAmount(confirmedUserToTreasuryAmount)} to the treasurer.`}
                    </p>
                  )}
                  {normalizedBalance === 0 && canRunSettlement && isCheckedIn && !isTeamTreasurer && confirmedIncomingPayoutAmount > 0 && (
                    <p className="mt-2 text-xs text-neutral-600">
                      {`The treasurer paid đ${formatVndAmount(confirmedIncomingPayoutAmount)} to you.`}
                    </p>
                  )}
                </Card>
              </div>

              {!isTeamTreasurer && (
                <Card className={`mt-3 ${normalizedBalance < 0 ? 'bg-error-50 border-error-200' : 'bg-success-50 border-success-200'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-neutral-600">Payment Status</p>
                      <Badge status={userPaymentStatusBadge} className={paymentStatusBadgeClassName}>{userPaymentStatusLabel}</Badge>
                      <p className={`mt-2 text-xs ${userPaymentStatus === 'waiting_confirm' ? 'text-warning-900' : 'text-neutral-600'}`}>
                        {paymentStatusHint}
                      </p>
                    </div>
                    {normalizedBalance < 0 && isCheckedIn && (
                      <Button
                        onClick={handleOpenTreasuryTransferModal}
                        variant="secondary"
                        className="w-full border border-warning-400 sm:w-auto"
                        disabled={!canRunSettlement || userPaymentStatus === 'waiting_confirm' || transferAmount <= 0 || !treasuryUserId}
                      >
                        {paymentActionLabel}
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {waitingIncomingPayoutTransfer && (
                <Card className="mt-3 space-y-2 bg-warning-50 border-warning-200">
                  <p className="text-xs text-neutral-600 uppercase">Incoming Transfer Confirmation</p>
                  <p className="text-sm text-neutral-700">
                    {`Treasury marked transfer: đ ${formatVndAmount(waitingIncomingPayoutTransfer.amount)}. Confirm when received.`}
                  </p>
                  <Button
                    onClick={() => handleConfirmPaymentReceived(waitingIncomingPayoutTransfer.id)}
                    variant="secondary"
                    className="w-full border border-warning-400 sm:w-auto"
                    loading={paymentActionId === waitingIncomingPayoutTransfer.id}
                    disabled={paymentActionId === waitingIncomingPayoutTransfer.id}
                  >
                    Confirm Received
                  </Button>
                </Card>
              )}
              {normalizedBalance < 0 && isCheckedIn && !treasuryUserId && (
                <p className="text-xs text-warning-900">This team does not have a treasurer yet. Ask admin/sub-admin to set one.</p>
              )}
            </motion.div>
            )}

            {activeTab === 'treasury' && (canAutoApproveExpense || canManageTreasury) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
              <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                Treasury
              </h2>

              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-600 uppercase">Treasurer Info</p>
                  <Badge status="default">{receiverName}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-neutral-600">Bank</p>
                    <p className="font-semibold">{receiverPaymentInfo?.bank_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Account Name</p>
                    <p className="font-semibold">{receiverPaymentInfo?.account_name || receiverName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Account Number</p>
                    <p className="font-mono text-sm font-semibold">{receiverPaymentInfo?.account_number || '-'}</p>
                  </div>
                </div>
              </Card>

              {waitingConfirmationPayments.length > 0 && (
                <Card className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-600 uppercase">Pending Payment Confirmations</p>
                    <Badge status="warning">{waitingConfirmationPayments.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {waitingConfirmationPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between gap-2 border-b last:border-b-0 py-2">
                        <div>
                          <p className="text-sm font-semibold">{payment.from_user?.name || 'Unknown user'}</p>
                          <p className="text-xs text-neutral-600">{`Transferred: đ ${formatVndAmount(payment.amount)}`}</p>
                        </div>
                        {canManageTreasury ? (
                          <button
                            type="button"
                            className="badge bg-success-50 text-success-700 transition hover:opacity-90 disabled:opacity-50"
                            onClick={() => handleConfirmPaymentReceived(payment.id)}
                            disabled={paymentActionId === payment.id}
                          >
                            {paymentActionId === payment.id ? '...' : 'Confirm Received'}
                          </button>
                        ) : (
                          <Badge status="warning">Waiting Treasurer</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-600 uppercase">Treasury Ledger</p>
                  <Badge status={normalizedTreasuryNetFund >= 0 ? 'success' : 'error'}>
                    {normalizedTreasuryNetFund >= 0 ? 'Healthy' : 'Negative'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-neutral-600">Treasury Received</p>
                    <p className="font-semibold text-success-700">{`đ ${formatVndAmount(confirmedToTreasuryAmount)}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Treasury Sent</p>
                    <p className="font-semibold text-error-800">{`đ ${formatVndAmount(treasurySentAmount)}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Treasury Expense</p>
                    <p className="font-semibold text-error-800">{`đ ${formatVndAmount(treasuryExpenseTotal)}`}</p>
                  </div>
                </div>
                <div className={`rounded-xl p-3 ${normalizedTreasuryNetFund >= 0 ? 'bg-success-50' : 'bg-error-50'}`}>
                  <p className="text-xs text-neutral-600">Treasury Net Balance</p>
                  <p className={`text-xl font-bold ${normalizedTreasuryNetFund >= 0 ? 'text-success-700' : 'text-error-800'}`}>
                    {normalizedTreasuryNetFund >= 0
                      ? `đ ${formatVndAmount(normalizedTreasuryNetFund)}`
                      : `đ -${formatVndAmount(Math.abs(normalizedTreasuryNetFund))}`}
                  </p>
                </div>
                {isTeamTreasurer && (
                  <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-neutral-600">Settlement Status</p>
                      <Badge status={isSettlementCompleted ? 'success' : isSettlementReadyToComplete ? 'warning' : 'default'}>
                        {isSettlementCompleted ? 'Completed' : isSettlementReadyToComplete ? 'Ready' : 'In Progress'}
                      </Badge>
                    </div>
                    <Button
                      onClick={handleMarkSettlementCompleted}
                      loading={settlementCompleting}
                      disabled={settlementCompleting || isSettlementCompleted || !isSettlementReadyToComplete}
                      className="w-full sm:w-auto"
                    >
                      {isSettlementCompleted ? 'Settlement Completed' : 'Set Settlement Completed'}
                    </Button>
                  </div>
                )}
              </Card>

              <Card className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-neutral-600 uppercase">Confirmed Treasury Transfers</p>
                  <Badge status="default">Audit</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-neutral-600">Treasury Received</p>
                    {confirmedTreasuryReceivedTransfers.length === 0 ? (
                      <p className="text-xs text-neutral-500">No confirmed received transfers yet.</p>
                    ) : (
                      confirmedTreasuryReceivedTransfers.map((transfer) => (
                        <div key={`recv-${transfer.id}`} className="rounded-lg border border-neutral-200 p-2">
                          <p className="text-sm font-semibold">{transfer.from_user?.name || 'Unknown member'}</p>
                          <p className="text-xs text-neutral-600">{`Received by: ${transfer.to_user?.name || receiverName || 'Treasury'}`}</p>
                          <p className="text-xs text-neutral-600">{`Amount: đ ${formatVndAmount(transfer.amount)}`}</p>
                          <p className="text-xs text-neutral-500">{`Received at: ${transfer.confirmed_at ? formatBangkokDateTime(transfer.confirmed_at) : '-'}`}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-neutral-600">Treasury Sent</p>
                    {confirmedTreasurySentTransfers.length === 0 ? (
                      <p className="text-xs text-neutral-500">No confirmed sent transfers yet.</p>
                    ) : (
                      confirmedTreasurySentTransfers.map((transfer) => (
                        <div key={`sent-${transfer.id}`} className="rounded-lg border border-neutral-200 p-2">
                          <p className="text-sm font-semibold">{transfer.to_user?.name || 'Unknown member'}</p>
                          <p className="text-xs text-neutral-600">{`Sent by: ${transfer.from_user?.name || receiverName || 'Treasury'}`}</p>
                          <p className="text-xs text-neutral-600">{`Sent to: ${transfer.to_user?.name || 'Unknown member'}`}</p>
                          <p className="text-xs text-neutral-600">{`Amount: đ ${formatVndAmount(transfer.amount)}`}</p>
                          <p className="text-xs text-neutral-500">
                            {`Sent at: ${transfer.confirmed_at ? formatBangkokDateTime(transfer.confirmed_at) : '-'}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              {membersNeedingPayout.length > 0 && (
                <Card className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-600 uppercase">Members To Reimburse</p>
                    <Badge status="warning">{membersNeedingPayout.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {membersNeedingPayout.map((member) => (
                      <button
                        key={member.user_id}
                        type="button"
                        className="w-full rounded-xl border border-neutral-200 p-3 text-left transition hover:bg-neutral-50"
                        onClick={() => handleOpenPayoutModal(member)}
                        disabled={!canManageTreasury || !isJoiningClosed}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{member.name}</p>
                            <p className="text-xs text-neutral-600">{`Need payout: đ ${formatVndAmount(member.payoutNeeded)}`}</p>
                          </div>
                          <Badge status={member.waitingTransfer ? 'warning' : 'default'}>
                            {member.waitingTransfer ? 'Waiting Confirm' : 'Transfer'}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}


            </motion.div>
            )}

            {activeTab === 'participants' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-neutral-600 uppercase">
                  Participants ({checkedInCount}/{teamMemberCount})
                </h2>
                <Badge status={isJoiningClosed ? 'success' : 'warning'}>
                  {isJoiningClosed ? 'Joining Closed' : 'Joining Open'}
                </Badge>
                {canManageParticipantCheckIn && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <select
                      multiple
                      value={selectedMembersToAdd}
                      onChange={(e) => {
                        const selectedUserIds = Array.from(e.target.selectedOptions).map((option) => option.value)
                        setSelectedMembersToAdd(selectedUserIds)
                      }}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none focus:border-primary-400 sm:w-56"
                      disabled={isJoiningClosed || participantActionLoading || addableTeamMembers.length === 0}
                    >
                      {addableTeamMembers.map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.users?.name || 'Unknown member'}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={handleAddParticipantAsCheckedIn}
                      className="sm:w-auto"
                      disabled={isJoiningClosed || selectedMembersToAdd.length === 0 || participantActionLoading || addableTeamMembers.length === 0}
                      loading={participantActionLoading}
                    >
                      {selectedMembersToAdd.length > 0
                        ? `Add Checked-In (${selectedMembersToAdd.length})`
                        : 'Add Checked-In'}
                    </Button>
                  </div>
                )}
              </div>
              {isJoiningClosed && (
                <p className="mb-3 text-xs text-neutral-600">
                  Joining is closed for this event. Participants cannot be added or removed.
                </p>
              )}
              <Card className="space-y-2">
                {participants.length === 0 ? (
                  <p className="text-sm text-neutral-600">No one has checked in yet.</p>
                ) : (
                  participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <span className="text-sm">{participant.users?.name}</span>
                        {participant.checked_in && participant.checked_in_at && (
                          <p className="text-xs text-neutral-600 mt-1">
                            {participant.checked_in_by_user?.name && String(participant.checked_in_by) !== String(participant.user_id)
                              ? `Checked in at ${formatBangkokDateTime(participant.checked_in_at)} by ${participant.checked_in_by_user.name}`
                              : `Checked in at ${formatBangkokDateTime(participant.checked_in_at)}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={participant.checked_in ? 'success' : 'warning'}>
                          {participant.checked_in ? 'Checked In' : 'Not Checked'}
                        </Badge>
                        {currentUserRole === 'admin' && participant.checked_in && (
                          <Button
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => handleRemoveParticipant(participant.id)}
                            loading={participantActionLoading}
                            disabled={isJoiningClosed || participantActionLoading}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </Card>
              </motion.div>
            )}

            {activeTab === 'expenses' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-neutral-600 uppercase">
                  Expenses
                </h2>
                <Button
                  onClick={() => setExpenseModalOpen(true)}
                  variant="secondary"
                  className="px-3 py-1 text-xs"
                  disabled={!isCheckedIn || !isJoiningClosed || isExpenseAddingClosed}
                >
                  Add
                </Button>
              </div>
              {!isJoiningClosed && (
                <p className="text-xs text-neutral-600 mb-3">
                  Waiting admin/treasurer to mark Joining Closed before adding expenses.
                </p>
              )}
              {isJoiningClosed && isExpenseAddingClosed && (
                <p className="text-xs text-neutral-600 mb-3">
                  Expense adding is closed for this event.
                </p>
              )}
              {!isCheckedIn && (
                <p className="text-xs text-neutral-600 mb-3">
                  Check in first to add your expense to this event.
                </p>
              )}
              {expenses.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-neutral-600">No expenses yet</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {expenses.map((expense) => (
                    <Card key={expense.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{expense.description}</p>
                        <p className="text-xs text-neutral-600">{expense.users?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-400">{`đ ${formatVndAmount(expense.amount)}`}</p>
                        <Badge
                          status={
                            expense.status === 'APPROVED'
                              ? 'success'
                              : expense.status === 'REJECTED'
                              ? 'error'
                              : 'warning'
                          }
                        >
                          {expense.status}
                        </Badge>
                        {expense.status !== 'PENDING' && (
                          <p className="mt-1 text-xs text-neutral-600">
                            {expense.status === 'APPROVED' && !expense.approved_by_user?.name && !expense.approved_at
                              ? 'Auto-approved'
                              : `by ${expense.approved_by_user?.name || 'Unknown'} at ${expense.approved_at ? formatBangkokDateTime(expense.approved_at) : '-'}`}
                          </p>
                        )}
                        {canAutoApproveExpense && expense.status === 'PENDING' && (
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              className="badge bg-neutral-200 text-neutral-800 transition hover:opacity-90 disabled:opacity-50"
                              onClick={() => handleExpenseStatusChange(expense.id, 'APPROVED')}
                              disabled={expenseActionId === expense.id}
                            >
                              {expenseActionId === expense.id ? '...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              className="badge bg-error-50 text-error-800 transition hover:opacity-90 disabled:opacity-50"
                              onClick={() => handleExpenseStatusChange(expense.id, 'REJECTED')}
                              disabled={expenseActionId === expense.id}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              </motion.div>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={Boolean(activeSettlementHelp)}
        onClose={() => setSettlementHelpKey(null)}
        title={activeSettlementHelp?.title || 'Settlement Info'}
        footer={(
          <Button onClick={() => setSettlementHelpKey(null)} className="w-full">
            Got it
          </Button>
        )}
      >
        <p className="text-sm text-neutral-700">
          {activeSettlementHelp?.description || ''}
        </p>
      </Modal>

      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Event"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEvent}
              className="flex-1"
              disabled={!eventForm.title || !eventForm.date}
              loading={actionLoading}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Event Title"
            value={eventForm.title}
            onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value.slice(0, TEXT_INPUT_MAX_LENGTH) }))}
            maxLength={TEXT_INPUT_MAX_LENGTH}
            placeholder="e.g., Morning Session"
          />
          <Input
            label="Date & Time"
            type="datetime-local"
            value={eventForm.date}
            onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
          />
          <Input
            label="Location"
            value={eventForm.location}
            onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value.slice(0, TEXT_INPUT_MAX_LENGTH) }))}
            maxLength={TEXT_INPUT_MAX_LENGTH}
            placeholder="Where will it be?"
          />
          <Input
            label="Court Number"
            type="number"
            value={eventForm.court_number}
            onChange={(e) => setEventForm((prev) => ({
              ...prev,
              court_number: e.target.value.replace(/\D/g, '').slice(0, COURT_NUMBER_MAX_LENGTH),
            }))}
            maxLength={COURT_NUMBER_MAX_LENGTH}
            placeholder="1"
          />
        </div>
      </Modal>

      <Modal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Add Expense"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setExpenseModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateExpense}
              className="flex-1"
              disabled={!expenseForm.amount || !expenseForm.description || !isCheckedIn || !isJoiningClosed}
              loading={actionLoading}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Description"
            value={expenseForm.description}
            onChange={(e) => setExpenseForm((prev) => ({
              ...prev,
              description: e.target.value.slice(0, TEXT_INPUT_MAX_LENGTH),
            }))}
            maxLength={TEXT_INPUT_MAX_LENGTH}
            placeholder="What is this for?"
          />
          <Input
            label="Amount"
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm((prev) => ({
              ...prev,
              amount: e.target.value.slice(0, NUMERIC_INPUT_MAX_LENGTH),
            }))}
            maxLength={NUMERIC_INPUT_MAX_LENGTH}
            placeholder="0.00"
          />
        </div>
      </Modal>

      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={paymentModalMode === 'PAY_MEMBER' ? 'Transfer Reimbursement' : 'Transfer Payment'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPaymentModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            {((paymentModalMode === 'PAY_TREASURER' && userPaymentStatus === 'pending' && transferAmount > 0) ||
              (paymentModalMode === 'PAY_MEMBER' && payoutTransferAmount > 0)) && (
              <Button
                onClick={handleSavePayment}
                className="flex-1"
                disabled={!isCheckedIn || !isJoiningClosed}
                loading={actionLoading}
              >
                I Have Transferred
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-neutral-600">
            {paymentModalMode === 'PAY_MEMBER'
              ? `Transfer to ${paymentTarget?.name || 'Member'}`
              : `Transfer to ${receiverName}`}
          </p>
          {paymentModalMode === 'PAY_TREASURER' && loadingReceiverInfo ? (
            <Card className="text-left">
              <p className="text-xs text-neutral-600">Loading treasurer payment info...</p>
            </Card>
          ) : (paymentModalMode === 'PAY_MEMBER' ? paymentTargetInfo : receiverPaymentInfo) ? (
            <Card className="space-y-3 text-left">
              <div>
                <p className="text-xs text-neutral-600">Bank Name</p>
                <p className="font-semibold">{(paymentModalMode === 'PAY_MEMBER' ? paymentTargetInfo?.bank_name : receiverPaymentInfo?.bank_name) || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">Account Name</p>
                <p className="font-semibold">
                  {(paymentModalMode === 'PAY_MEMBER' ? paymentTargetInfo?.account_name : receiverPaymentInfo?.account_name)
                    || (paymentModalMode === 'PAY_MEMBER' ? paymentTarget?.name : receiverName)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-600">Account Number</p>
                <p className="font-mono text-sm font-semibold">
                  {(paymentModalMode === 'PAY_MEMBER' ? paymentTargetInfo?.account_number : receiverPaymentInfo?.account_number) || '-'}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="text-left">
              <p className="text-xs text-neutral-600">
                {paymentModalMode === 'PAY_MEMBER'
                  ? 'Member payment info has not been set yet.'
                  : (receiverPaymentInfoError || 'Treasurer payment info has not been set yet.')}
              </p>
            </Card>
          )}

          <div className="bg-neutral-100 p-4 rounded-xl flex items-center justify-center min-h-40">
            {(paymentModalMode === 'PAY_MEMBER' ? paymentTargetInfo?.qr_url : receiverPaymentInfo?.qr_url) ? (
              <img
                src={paymentModalMode === 'PAY_MEMBER' ? paymentTargetInfo?.qr_url : receiverPaymentInfo?.qr_url}
                alt="Payment QR"
                className="max-h-56 rounded-lg"
              />
            ) : (
              <QrCode size={100} className="text-primary-400" />
            )}
          </div>

          <p className="text-sm text-neutral-600">
            {`Amount to transfer: đ ${formatVndAmount(paymentModalMode === 'PAY_MEMBER' ? payoutTransferAmount : transferAmount)}`}
          </p>
          {paymentModalMode === 'PAY_TREASURER' && userPaymentStatus === 'waiting_confirm' && (
            <p className="text-sm text-warning-900">Your transfer is waiting for treasurer confirmation.</p>
          )}
          {paymentModalMode === 'PAY_TREASURER' && userPaymentStatus === 'complete' && (
            <p className="text-sm text-success-700">Payment has been confirmed as received.</p>
          )}
          {paymentModalMode === 'PAY_MEMBER' && paymentTarget?.waitingTransfer && (
            <p className="text-sm text-warning-900">This payout is already waiting for member confirmation.</p>
          )}
        </div>
      </Modal>

      <BottomNav />
    </motion.div>
  )
}




