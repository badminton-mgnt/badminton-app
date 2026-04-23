import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header, Card, Button, Badge, BottomNav, Modal, Input } from '../components'
import {
  checkinParticipant,
  createExpense,
  deleteEvent,
  getEventDetail,
  getEventExpenses,
  getEventParticipants,
  getEventPayments,
  getUserProfile,
  savePayment,
  updateExpenseStatus,
  updateEvent,
} from '../lib/api'
import { forgetCheckedInEvent, hasCheckedInEvent, rememberCheckedInEvent } from '../lib/checkinCache'
import { formatVndAmount } from '../lib/currency'
import { formatBangkokDateTime, getBangkokDateKey, toDateTimeLocalValue, toSupabaseDateTime } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { CheckCircle2, Edit2, QrCode, Trash2, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export const EventDetailPage = () => {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [expenses, setExpenses] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('user')
  const [currentUserName, setCurrentUserName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [expenseActionId, setExpenseActionId] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '' })
  const [paymentForm, setPaymentForm] = useState({ amount: '' })
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
      const [eventResult, participantsResult, expensesResult, paymentsResult, profileResult] = await Promise.allSettled([
        getEventDetail(eventId),
        getEventParticipants(eventId),
        getEventExpenses(eventId),
        getEventPayments(eventId),
        getUserProfile(user.id),
      ])

      if (eventResult.status !== 'fulfilled') {
        throw eventResult.reason
      }

      const eventData = eventResult.value
      const participantsData = participantsResult.status === 'fulfilled' ? participantsResult.value : null
      const expensesData = expensesResult.status === 'fulfilled' ? expensesResult.value : null
      const paymentsData = paymentsResult.status === 'fulfilled' ? paymentsResult.value : null
      const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null
      const existingUserPayment = (paymentsData || payments).find((payment) => String(payment.user_id) === String(user.id))

      setEvent(eventData)
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
      if (paymentsData) {
        setPayments(paymentsData)
      }
      if (profileData) {
        setCurrentUserRole((profileData.role || 'user').toLowerCase())
        setCurrentUserName(profileData.name || '')
      }
      setPaymentForm({
        amount: existingUserPayment ? String(existingUserPayment.amount) : '',
      })
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

  const canManageEvent =
    event?.created_by === user?.id || ['admin', 'sub_admin'].includes(currentUserRole)
  const canAutoApproveExpense = ['admin', 'sub_admin'].includes(currentUserRole)

  const isToday = event?.date ? getBangkokDateKey(event.date) === getBangkokDateKey(new Date()) : false
  const currentParticipant = participants.find((participant) => String(participant.user_id) === String(user.id))
  const isCheckedIn = isParticipantCheckedIn(currentParticipant) || hasCheckedInEvent(user.id, eventId)
  const canViewProtectedDetails = canManageEvent || isCheckedIn || !isToday || event?.status === 'CANCELLED'
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
      await savePayment({
        event_id: eventId,
        team_id: event.team_id,
        user_id: user.id,
        amount: parseFloat(paymentForm.amount),
        status: 'CONFIRMED',
      })
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
      await updateExpenseStatus(expenseId, status)
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

  const handleCancelEvent = async () => {
    try {
      setActionLoading(true)
      await updateEvent(eventId, { status: 'CANCELLED' })
      await loadData()
    } catch (error) {
      console.error('Error cancelling event:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteEvent = async () => {
    try {
      setActionLoading(true)
      await deleteEvent(eventId)
      navigate('/events')
    } catch (error) {
      console.error('Error deleting event:', error)
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
  const recordedUserPayment = payments.find((payment) => String(payment.user_id) === String(user.id))
  const hasSettlementPayment = Boolean(recordedUserPayment)
  const userApprovedExpenseTotal = approvedExpenses
    .filter((expense) => String(expense.user_id) === String(user.id))
    .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
  const settlementPaymentAmount = recordedUserPayment ? Number(recordedUserPayment.amount) : 0
  const userPaidTotal = settlementPaymentAmount + userApprovedExpenseTotal
  const balance = isCheckedIn ? userPaidTotal - share : 0
  const userPayment = {
    amount: userPaidTotal,
    status: `Expense advanced: đ ${userApprovedExpenseTotal.toFixed(2)} | Settlement payment: đ ${settlementPaymentAmount.toFixed(2)}`,
  }
  const eventBadgeStatus = event?.status === 'CANCELLED' ? 'error' : event?.status === 'COMPLETED' ? 'success' : isToday ? 'success' : 'warning'
  const eventBadgeLabel =
    event?.status === 'CANCELLED'
      ? 'Cancelled'
      : isToday
      ? 'Today'
      : event?.status

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-24"
    >
      <Header title={event?.title || 'Event Detail'} subtitle={formatBangkokDateTime(event?.date)} />

      <div className="container-mobile py-6 space-y-6">
        {isToday && event?.status !== 'CANCELLED' && (
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
            <div>
              <p className="text-xs text-neutral-600">Location</p>
              <p className="font-semibold">{event?.location || 'Location not set'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-600">Court</p>
              <p className="font-semibold">{event?.court_number ? `Court ${event.court_number}` : 'Court not assigned'}</p>
            </div>
            <p className="text-sm text-neutral-600">
              Check in from the Home page before opening today&apos;s event details.
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-neutral-600">Event Time</p>
                    <p className="font-semibold">{formatBangkokDateTime(event?.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Location</p>
                    <p className="font-semibold">{event?.location || 'Location not set'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600">Court</p>
                    <p className="font-semibold">{event?.court_number ? `Court ${event.court_number}` : 'Court not assigned'}</p>
                  </div>
                </div>
                <Badge status={eventBadgeStatus}>
                  {eventBadgeLabel}
                </Badge>
                {canManageEvent && (
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Button variant="secondary" onClick={() => setEditModalOpen(true)}>
                      <span className="inline-flex items-center gap-2">
                        <Edit2 size={14} />
                        Edit
                      </span>
                    </Button>
                    {event?.status !== 'CANCELLED' && (
                      <Button variant="secondary" onClick={handleCancelEvent} loading={actionLoading}>
                        <span className="inline-flex items-center gap-2">
                          <XCircle size={14} />
                          Cancel
                        </span>
                      </Button>
                    )}
                    <Button variant="danger" onClick={handleDeleteEvent} loading={actionLoading}>
                      <span className="inline-flex items-center gap-2">
                        <Trash2 size={14} />
                        Delete
                      </span>
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
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

              <Card className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-600">Your Paid Total</p>
                    <p className="text-2xl font-bold text-primary-400">
                      {`đ ${formatVndAmount(userPayment ? Number(userPayment.amount) : 0)}`}
                    </p>
                    <p className="text-xs text-neutral-600 mt-1">
                      {`Advanced: đ ${formatVndAmount(userApprovedExpenseTotal)}`}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {`Settlement: đ ${formatVndAmount(settlementPaymentAmount)}`}
                    </p>
                  </div>
                  <Button
                    onClick={() => setPaymentModalOpen(true)}
                    variant="secondary"
                    disabled={!isCheckedIn}
                  >
                    {hasSettlementPayment ? 'Update Payment' : 'Add Payment'}
                  </Button>
                </div>
                {!isCheckedIn && (
                  <p className="text-xs text-neutral-600 mt-3">
                    {`You did not join this event, so your payment amount stays at đ ${formatVndAmount(0)}.`}
                  </p>
                )}
              </Card>

              <Card className={`mt-3 ${balance < 0 ? 'bg-error-50' : 'bg-success-50'}`}>
                <p className="text-xs text-neutral-600">Your Balance</p>
                <p className={`text-2xl font-bold ${balance < 0 ? 'text-error-800' : 'text-success-700'}`}>
                  {balance < 0 ? `đ ${formatVndAmount(Math.abs(balance))} Owed` : `đ ${formatVndAmount(balance)}`}
                </p>
                {balance < 0 && (
                  <p className="mt-2 text-xs text-neutral-600">
                    You need to pay this amount for this event.
                  </p>
                )}
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                Participants ({checkedInCount})
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
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
        title={hasSettlementPayment ? 'Update Payment' : 'Add Payment'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPaymentModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePayment}
              className="flex-1"
              disabled={!paymentForm.amount || !isCheckedIn}
              loading={actionLoading}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-neutral-600">{`Your share is đ ${formatVndAmount(userShare)}`}</p>
          <Input
            label="Paid Amount"
            type="number"
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ amount: e.target.value })}
            placeholder="0.00"
          />
          <div className="bg-neutral-100 p-8 rounded-xl flex items-center justify-center">
            <QrCode size={100} className="text-primary-400" />
          </div>
        </div>
      </Modal>

      <BottomNav />
    </motion.div>
  )
}




