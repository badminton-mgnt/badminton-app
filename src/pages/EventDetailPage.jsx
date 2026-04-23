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
  getUserProfile,
  updateExpenseStatus,
  updateEvent,
} from '../lib/api'
import { forgetCheckedInEvent, hasCheckedInEvent, rememberCheckedInEvent } from '../lib/checkinCache'
import { formatVndAmount } from '../lib/currency'
import { formatBangkokDateTime, getBangkokDateKey, toDateTimeLocalValue, toSupabaseDateTime } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { CheckCircle2, QrCode } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export const EventDetailPage = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
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
      const transfersData = transfersResult.status === 'fulfilled' ? transfersResult.value : null
      const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null

      setEvent(eventData)
      let treasuryUserId = null
      if (eventData?.team_id) {
        const [teamMembersResult, teamResult] = await Promise.allSettled([
          getTeamMembers(eventData.team_id),
          getTeam(eventData.team_id),
        ])

        if (teamMembersResult.status === 'fulfilled') {
          setTeamMemberCount(teamMembersResult.value.length)
        } else {
          console.error('Error loading team members:', teamMembersResult.reason)
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
        setTeamMemberCount(0)
        setTeamTreasurerId(null)
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

  const handleOpenTreasuryTransferModal = async () => {
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

  const canManageEvent =
    event?.created_by === user?.id || ['admin', 'sub_admin'].includes(currentUserRole)
  const isTeamTreasurer =
    Boolean(teamTreasurerId) &&
    Boolean(user?.id) &&
    String(teamTreasurerId).toLowerCase() === String(user.id).toLowerCase()
  const canAutoApproveExpense = ['admin', 'sub_admin'].includes(currentUserRole) || isTeamTreasurer
  const canManageTreasury = isTeamTreasurer

  const eventStartAtMs = event?.date ? new Date(event.date).getTime() : Number.NaN
  const hasValidEventStartAt = Number.isFinite(eventStartAtMs)
  const isEventPast = hasValidEventStartAt ? eventStartAtMs < Date.now() : false
  const isToday = event?.date ? getBangkokDateKey(event.date) === getBangkokDateKey(new Date()) : false
  const isUpcomingEvent = hasValidEventStartAt ? eventStartAtMs > Date.now() : false
  const requiresCheckInForDetails = isToday || isEventPast
  const headerStatusLabel = isToday ? 'Today' : isUpcomingEvent ? 'Upcoming' : ''
  const headerStatusBadge = isToday ? 'success' : isUpcomingEvent ? 'warning' : 'default'
  const currentParticipant = participants.find((participant) => String(participant.user_id) === String(user.id))
  const isCheckedIn = isParticipantCheckedIn(currentParticipant) || hasCheckedInEvent(user.id, eventId)
  const canViewProtectedDetails = canManageEvent || !requiresCheckInForDetails || isCheckedIn
  const checkedInAtLabel = currentParticipant?.checked_in_at
    ? formatBangkokDateTime(currentParticipant.checked_in_at)
    : ''

  const handleCheckIn = async () => {
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
  const share = checkedInCount > 0 ? totalExpense / checkedInCount : 0
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

  const userToTreasuryTransfers = paymentTransfers.filter(
    (transfer) =>
      String(transfer.from_user_id) === String(user.id) &&
      String(transfer.to_user_id) === String(treasuryUserId) &&
      isToTreasuryTransfer(transfer)
  )

  const confirmedUserToTreasuryAmount = userToTreasuryTransfers
    .filter((transfer) => isTransferConfirmed(transfer.status))
    .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

  const waitingUserToTreasuryAmount = userToTreasuryTransfers
    .filter((transfer) => isTransferWaiting(transfer.status))
    .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

  const latestWaitingUserToTreasuryTransfer = userToTreasuryTransfers.find((transfer) => isTransferWaiting(transfer.status))

  const userApprovedExpenseTotal = approvedExpenses
    .filter((expense) => String(expense.user_id) === String(user.id))
    .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
  const transferAmount = Math.max(userShare - userApprovedExpenseTotal - confirmedUserToTreasuryAmount, 0)

  const userPaymentStatus =
    transferAmount <= 0
      ? 'complete'
      : waitingUserToTreasuryAmount > 0
      ? 'waiting_confirm'
      : 'pending'

  const userPaidTotal = confirmedUserToTreasuryAmount + userApprovedExpenseTotal
  const balance = isCheckedIn ? userPaidTotal - share : 0

  const waitingConfirmationPayments = paymentTransfers.filter(
    (transfer) =>
      String(transfer.to_user_id) === String(treasuryUserId) &&
      isToTreasuryTransfer(transfer) &&
      isTransferWaiting(transfer.status)
  )

  const incomingPayoutTransfers = paymentTransfers.filter(
    (transfer) =>
      String(transfer.from_user_id) === String(treasuryUserId) &&
      String(transfer.to_user_id) === String(user.id) &&
      isFromTreasuryTransfer(transfer)
  )

  const waitingIncomingPayoutTransfer = incomingPayoutTransfers.find((transfer) => isTransferWaiting(transfer.status))

  const membersNeedingPayout = participants
    .filter((participant) => isParticipantCheckedIn(participant))
    .map((participant) => {
      const participantApprovedExpense = approvedExpenses
        .filter((expense) => String(expense.user_id) === String(participant.user_id))
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

      const memberToTreasuryConfirmed = paymentTransfers
        .filter(
          (transfer) =>
            String(transfer.from_user_id) === String(participant.user_id) &&
            String(transfer.to_user_id) === String(treasuryUserId) &&
            isToTreasuryTransfer(transfer) &&
            isTransferConfirmed(transfer.status)
        )
        .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

      const treasuryToMemberConfirmed = paymentTransfers
        .filter(
          (transfer) =>
            String(transfer.from_user_id) === String(treasuryUserId) &&
            String(transfer.to_user_id) === String(participant.user_id) &&
            isFromTreasuryTransfer(transfer) &&
            isTransferConfirmed(transfer.status)
        )
        .reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0)

      const treasuryToMemberWaiting = paymentTransfers
        .find(
          (transfer) =>
            String(transfer.from_user_id) === String(treasuryUserId) &&
            String(transfer.to_user_id) === String(participant.user_id) &&
            isFromTreasuryTransfer(transfer) &&
            isTransferWaiting(transfer.status)
        )

      const memberPaidTotal = memberToTreasuryConfirmed + participantApprovedExpense - treasuryToMemberConfirmed
      const memberBalance = memberPaidTotal - share
      const payoutNeeded = Math.max(memberBalance, 0)

      return {
        user_id: participant.user_id,
        name: participant.users?.name || 'Member',
        payoutNeeded,
        waitingTransfer: treasuryToMemberWaiting || null,
      }
    })
    .filter((member) => String(member.user_id) !== String(treasuryUserId) && member.payoutNeeded > 0)

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

  const treasuryApprovedExpenseTotal = approvedExpenses
    .filter((expense) => String(expense.user_id) === String(treasuryUserId))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

  const treasuryNetFund = confirmedToTreasuryAmount - confirmedFromTreasuryAmount - treasuryApprovedExpenseTotal

  const userPaymentStatusLabel =
    userPaymentStatus === 'complete'
      ? 'Complete'
      : userPaymentStatus === 'waiting_confirm'
      ? 'Waiting Confirm'
      : 'Pending'

  const userPaymentStatusBadge =
    userPaymentStatus === 'complete'
      ? 'success'
      : userPaymentStatus === 'waiting_confirm'
      ? 'warning'
      : 'warning'

  const paymentActionLabel =
    userPaymentStatus === 'complete'
      ? 'View Transfer Info'
      : userPaymentStatus === 'waiting_confirm'
      ? 'Waiting Confirm'
      : 'Transfer & Confirm'

  const paymentStatusBadgeClassName =
    userPaymentStatus === 'complete'
      ? 'border border-success-300 bg-white'
      : 'border border-warning-300'

  const paymentStatusHint =
    userPaymentStatus === 'waiting_confirm'
      ? `Transferred đ ${formatVndAmount(Number(latestWaitingUserToTreasuryTransfer?.amount || waitingUserToTreasuryAmount || 0))} - waiting for treasurer confirmation`
      : balance < 0
      ? 'You need to pay this amount.'
      : balance > 0
      ? 'The fund will reimburse this amount to you, so you do not need to transfer more.'
      : 'No additional transfer is needed.'

  const userPayment = {
    amount: userPaidTotal,
    status: `Expense advanced: đ ${userApprovedExpenseTotal.toFixed(2)} | Settlement confirmed: đ ${confirmedUserToTreasuryAmount.toFixed(2)}`,
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
        {isToday && !isEventPast && event?.status !== 'CANCELLED' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className={isCheckedIn ? 'bg-success-50 border-success-700' : 'bg-warning-50 border-warning-900'}>
              <div className="flex items-center justify-between gap-3">
                <div>    
                  <p className="font-semibold">
                    {isCheckedIn ? 'You are checked in for this event.' : 'Check in to join this event today.'}
                  </p>
                  {isCheckedIn && checkedInAtLabel && (
                    <p className="text-xs text-neutral-600 mt-1">
                      Checked in at {checkedInAtLabel}
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
                ? 'You did not check in for this event, so the event details are not available.'
                : 'Check in from the Home page before opening today\'s event details.'}
            </p>
            <p className="text-sm text-neutral-600">
              {`Your amount stays at đ ${formatVndAmount(0)} if you do not check in for this event.`}
            </p>
            <Button variant="secondary" onClick={() => navigate('/')}>
              Back to Home
            </Button>
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
                  onClick={() => setActiveTab('settlement')}
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
                  onClick={() => setActiveTab('participants')}
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
                  onClick={() => setActiveTab('expenses')}
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
                    onClick={() => setActiveTab('treasury')}
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
              <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                Settlement
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <p className="text-xs text-neutral-600">Total Expense</p>
                  <p className="text-2xl font-bold text-primary-400">{`đ ${formatVndAmount(totalExpense)}`}</p>
                </Card>
                <Card>
                  <p className="text-xs text-neutral-600">Your Share</p>
                  <p className="text-2xl font-bold">{`đ ${formatVndAmount(userShare)}`}</p>
                </Card>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card>
                  <p className="text-xs text-neutral-600">Your Paid Total</p>
                  <p className="text-2xl font-bold text-primary-400">
                    {`đ ${formatVndAmount(userPayment ? Number(userPayment.amount) : 0)}`}
                  </p>
                  {!isCheckedIn && !isUpcomingEvent && (
                    <p className="text-xs text-neutral-600 mt-3">
                      {`You did not join this event, so your payment amount stays at đ ${formatVndAmount(0)}.`}
                    </p>
                  )}
                </Card>

                <Card className={balance < 0 ? 'bg-error-50' : 'bg-success-50'}>
                  <p className="text-xs text-neutral-600">Your Balance</p>
                  <p className={`text-2xl font-bold ${balance < 0 ? 'text-error-800' : 'text-success-700'}`}>
                    {balance < 0 ? `đ -${formatVndAmount(Math.abs(balance))}` : `đ ${formatVndAmount(balance)}`}
                  </p>
                </Card>
              </div>

              <Card className={`mt-3 ${balance < 0 ? 'bg-error-50 border-error-200' : 'bg-success-50 border-success-200'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-neutral-600">Payment Status</p>
                    <Badge status={userPaymentStatusBadge} className={paymentStatusBadgeClassName}>{userPaymentStatusLabel}</Badge>
                    <p className={`mt-2 text-xs ${userPaymentStatus === 'waiting_confirm' ? 'text-warning-900' : 'text-neutral-600'}`}>
                      {paymentStatusHint}
                    </p>
                  </div>
                  {balance < 0 && isCheckedIn && (
                    <Button
                      onClick={handleOpenTreasuryTransferModal}
                      variant="secondary"
                      className="w-full border border-warning-400 sm:w-auto"
                      disabled={userPaymentStatus === 'waiting_confirm' || transferAmount <= 0 || !treasuryUserId}
                    >
                      {paymentActionLabel}
                    </Button>
                  )}
                </div>
              </Card>

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
              {balance < 0 && isCheckedIn && !treasuryUserId && (
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
                  <Badge status={treasuryNetFund >= 0 ? 'success' : 'error'}>
                    {treasuryNetFund >= 0 ? 'Healthy' : 'Negative'}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-neutral-600">Treasury Received</p>
                    <p className="font-semibold text-success-700">{`đ ${formatVndAmount(confirmedToTreasuryAmount)}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Treasury Sent</p>
                    <p className="font-semibold text-error-800">{`đ ${formatVndAmount(confirmedFromTreasuryAmount)}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Treasury Expense</p>
                    <p className="font-semibold text-error-800">{`đ ${formatVndAmount(treasuryApprovedExpenseTotal)}`}</p>
                  </div>
                </div>
                <div className={`rounded-xl p-3 ${treasuryNetFund >= 0 ? 'bg-success-50' : 'bg-error-50'}`}>
                  <p className="text-xs text-neutral-600">Treasury Net Balance</p>
                  <p className={`text-xl font-bold ${treasuryNetFund >= 0 ? 'text-success-700' : 'text-error-800'}`}>
                    {treasuryNetFund >= 0
                      ? `đ ${formatVndAmount(treasuryNetFund)}`
                      : `đ -${formatVndAmount(Math.abs(treasuryNetFund))}`}
                  </p>
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
                        disabled={!canManageTreasury}
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
              <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                Participants ({checkedInCount}/{teamMemberCount})
              </h2>
              <Card className="space-y-2">
                {participants.length === 0 ? (
                  <p className="text-sm text-neutral-600">No one has checked in yet.</p>
                ) : (
                  participants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <span className="text-sm">{participant.users?.name}</span>
                      <Badge status={participant.checked_in ? 'success' : 'warning'}>
                        {participant.checked_in ? 'Checked In' : 'Not Checked'}
                      </Badge>
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
                  disabled={!isCheckedIn}
                >
                  Add
                </Button>
              </div>
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
                        <Badge status={expense.status === 'APPROVED' ? 'success' : 'warning'}>
                          {expense.status}
                        </Badge>
                        {expense.status !== 'PENDING' && (
                          <p className="mt-1 text-xs text-neutral-600">
                            {`${expense.status === 'APPROVED' ? 'Approved' : 'Rejected'} by ${expense.approved_by_user?.name || 'Unknown'}`}
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
            onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
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
            onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="Where will it be?"
          />
          <Input
            label="Court Number"
            type="number"
            value={eventForm.court_number}
            onChange={(e) => setEventForm((prev) => ({ ...prev, court_number: e.target.value }))}
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
              disabled={!expenseForm.amount || !expenseForm.description || !isCheckedIn}
              loading={actionLoading}
            >
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Amount"
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="0.00"
          />
          <Input
            label="Description"
            value={expenseForm.description}
            onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="What is this for?"
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
                disabled={!isCheckedIn}
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




