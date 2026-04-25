import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Header, Card, Button, Badge, BottomNav, Modal, Input } from '../components'
import { checkinParticipant, createEvent, deleteEvent, getEventParticipants, getEvents, getUserProfile, updateEvent } from '../lib/api'
import {
  forgetCheckedInEvent,
  forgetDismissedCheckInEvent,
  hasCheckedInEvent,
  hasDismissedCheckInEvent,
  rememberCheckedInEvent,
  rememberDismissedCheckInEvent,
} from '../lib/checkinCache'
import { formatBangkokDateTime, getBangkokDateKey, toDateTimeLocalValue, toSupabaseDateTime } from '../lib/dateTime'
import { motion } from 'framer-motion'
import { Edit2, Plus, MapPin, Calendar, Trash2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTeam } from '../contexts/TeamContext'

const CHECKIN_CONFIRM_WINDOW_DAYS = 3
const DAY_IN_MS = 24 * 60 * 60 * 1000
const isJoiningLockedStatus = (status) => ['FINALIZED', 'COMPLETED', 'CANCELLED'].includes(String(status || '').toUpperCase())

const emptyForm = {
  title: '',
  date: '',
  location: '',
  court_number: '',
}

export const EventsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { teams, currentTeam, loading: teamsLoading, setCurrentTeam } = useTeam()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [switchTeamModalOpen, setSwitchTeamModalOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('user')
  const [editingEvent, setEditingEvent] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [formData, setFormData] = useState(emptyForm)
  const [pastEventsExpanded, setPastEventsExpanded] = useState(false)
  const [pendingCheckInEventIds, setPendingCheckInEventIds] = useState([])
  const [checkInActionId, setCheckInActionId] = useState(null)

  useEffect(() => {
    if (!currentTeam) {
      setEvents([])
      setLoading(false)
      return
    }

    loadEvents()
  }, [currentTeam?.team_id])

  useEffect(() => {
    if (!user) return
    loadCurrentUserRole()
  }, [user?.id])

  useEffect(() => {
    if (location.state?.openCreateEvent && currentTeam) {
      openCreateModal()
      navigate(location.pathname, { replace: true })
    }
  }, [location.state, currentTeam])

  useEffect(() => {
    if (!location.state?.navRefreshAt || !currentTeam) return

    loadEvents()
    if (user) {
      loadCurrentUserRole()
    }
  }, [location.state?.navRefreshAt])

  const loadCurrentUserRole = async () => {
    try {
      const profile = await getUserProfile(user.id)
      setCurrentUserRole((profile.role || 'user').toLowerCase())
    } catch (error) {
      console.error('Error loading user role:', error)
    }
  }

  const loadEvents = async () => {
    if (!currentTeam) return

    setLoading(true)
    try {
      const eventsData = await getEvents(currentTeam.team_id)
      setEvents(eventsData)

      const now = Date.now()
      const expiredCandidates = eventsData.filter((event) => {
        if (!canCheckInEvent(event)) return false
        const eventDateKey = getBangkokDateKey(event.date)
        if (!eventDateKey || eventDateKey >= todayKey) return false

        const eventTime = new Date(event.date).getTime()
        if (!Number.isFinite(eventTime)) return false
        return now > eventTime + (CHECKIN_CONFIRM_WINDOW_DAYS * DAY_IN_MS)
      })
      const pendingCandidates = eventsData.filter((event) => {
        if (!canCheckInEvent(event)) return false
        const eventDateKey = getBangkokDateKey(event.date)
        if (!eventDateKey || eventDateKey >= todayKey) return false

        const eventTime = new Date(event.date).getTime()
        if (!Number.isFinite(eventTime)) return false
        return now <= eventTime + (CHECKIN_CONFIRM_WINDOW_DAYS * DAY_IN_MS)
      })

      if (expiredCandidates.length > 0) {
        await Promise.all(
          expiredCandidates.map(async (event) => {
            try {
              const participants = await getEventParticipants(event.id)
              const userCheckedIn = participants.some(
                (participant) => String(participant.user_id) === String(user.id) && Boolean(participant.checked_in)
              )

              if (userCheckedIn) {
                rememberCheckedInEvent(user.id, event.id)
                forgetDismissedCheckInEvent(user.id, event.id)
              } else {
                rememberDismissedCheckInEvent(user.id, event.id)
                forgetCheckedInEvent(user.id, event.id)
              }
            } catch (error) {
              console.error('Error loading participants for expired event check-in:', error)
              if (!hasCheckedInEvent(user.id, event.id)) {
                rememberDismissedCheckInEvent(user.id, event.id)
              }
            }
          })
        )
      }

      if (pendingCandidates.length === 0) {
        setPendingCheckInEventIds([])
        return
      }

      const pendingStatuses = await Promise.all(
        pendingCandidates.map(async (event) => {
          try {
            const participants = await getEventParticipants(event.id)
            const userCheckedIn = participants.some(
              (participant) => String(participant.user_id) === String(user.id) && Boolean(participant.checked_in)
            )

            if (userCheckedIn) {
              rememberCheckedInEvent(user.id, event.id)
              forgetDismissedCheckInEvent(user.id, event.id)
            } else {
              forgetCheckedInEvent(user.id, event.id)
            }

            return { event, userCheckedIn }
          } catch (error) {
            console.error('Error loading participants for pending event check-in:', error)
            return { event, userCheckedIn: hasCheckedInEvent(user.id, event.id) }
          }
        })
      )

      const pendingIds = pendingStatuses
        .filter((item) => !item.userCheckedIn && !hasDismissedCheckInEvent(user.id, item.event.id))
        .map((item) => item.event.id)

      setPendingCheckInEventIds(pendingIds)
    } catch (error) {
      console.error('Error loading events:', error)
      setPendingCheckInEventIds([])
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingEvent(null)
    setFormData(emptyForm)
    setModalOpen(true)
  }

  const openEditModal = (event, e) => {
    e.stopPropagation()
    setEditingEvent(event)
    setFormData({
      title: event.title || '',
      date: toDateTimeLocalValue(event.date),
      location: event.location || '',
      court_number: event.court_number ? String(event.court_number) : '',
    })
    setModalOpen(true)
  }

  const canManageEvent = (event) =>
    event.created_by === user?.id || ['admin', 'sub_admin'].includes(currentUserRole)

  const canCheckInEvent = (event) => !isJoiningLockedStatus(event?.status)

  const handleSaveEvent = async () => {
    if (!formData.title || !formData.date || !currentTeam) return

    try {
      setActionLoading(true)
      const payload = {
        title: formData.title,
        date: toSupabaseDateTime(formData.date),
        location: formData.location,
        court_number: formData.court_number ? parseInt(formData.court_number, 10) : null,
        ...(editingEvent ? {} : { created_by: user.id }),
      }

      if (editingEvent) {
        await updateEvent(editingEvent.id, payload)
      } else {
        await createEvent(payload, currentTeam.team_id)
      }

      setFormData(emptyForm)
      setEditingEvent(null)
      setModalOpen(false)
      loadEvents()
    } catch (error) {
      console.error('Error saving event:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelEvent = async (event, e) => {
    e.stopPropagation()

    try {
      setActionLoading(true)
      await updateEvent(event.id, { status: 'CANCELLED' })
      loadEvents()
    } catch (error) {
      console.error('Error cancelling event:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteEvent = async (event, e) => {
    e.stopPropagation()

    try {
      setActionLoading(true)
      await deleteEvent(event.id)
      loadEvents()
    } catch (error) {
      console.error('Error deleting event:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleHeaderTeamClick = () => {
    if (teams.length > 0) {
      setSwitchTeamModalOpen(true)
    }
  }

  const handleConfirmCheckInForPastEvent = async (event, e) => {
    e.stopPropagation()

    if (!canCheckInEvent(event)) {
      return
    }

    try {
      setCheckInActionId(`checkin-${event.id}`)
      await checkinParticipant(event.id, user.id)
      rememberCheckedInEvent(user.id, event.id)
      forgetDismissedCheckInEvent(user.id, event.id)
      await loadEvents()
    } catch (error) {
      console.error('Error confirming check-in for event:', error)
    } finally {
      setCheckInActionId(null)
    }
  }

  const handleMarkDidNotJoin = async (event, e) => {
    e.stopPropagation()

    if (!canCheckInEvent(event)) {
      return
    }

    setCheckInActionId(`dismiss-${event.id}`)
    rememberDismissedCheckInEvent(user.id, event.id)
    forgetCheckedInEvent(user.id, event.id)
    await loadEvents()
    setCheckInActionId(null)
  }

  const todayKey = getBangkokDateKey(new Date())
  const isCompletedEvent = (event) => String(event?.status || '').toUpperCase() === 'COMPLETED'
  const completedEvents = events.filter((event) => isCompletedEvent(event))
  const activeEvents = events.filter((event) => !isCompletedEvent(event))
  const todayEvents = activeEvents.filter((event) => getBangkokDateKey(event.date) === todayKey)
  const upcomingEvents = activeEvents.filter((event) => getBangkokDateKey(event.date) > todayKey)
  const pastEvents = activeEvents.filter((event) => getBangkokDateKey(event.date) < todayKey)
  const pendingCheckInIdSet = new Set(pendingCheckInEventIds.map((id) => String(id)))
  const pendingCheckInPastEvents = pastEvents.filter((event) => pendingCheckInIdSet.has(String(event.id)))
  const completedPastEvents = [
    ...completedEvents,
    ...pastEvents.filter((event) => !pendingCheckInIdSet.has(String(event.id))),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (teamsLoading || (loading && currentTeam && events.length === 0)) {
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
      className="pb-24"
    >
      <Header
        title="Events"
        subtitleContent={
          <button
            type="button"
            onClick={handleHeaderTeamClick}
            className="mt-2 inline-flex rounded-full transition hover:opacity-90"
          >
            <Badge
              status={currentTeam?.teams?.name ? 'success' : 'warning'}
              className="cursor-pointer bg-white/15 text-white border border-white/20"
            >
              {currentTeam?.teams?.name || 'No team selected'}
            </Badge>
          </button>
        }
        action={
          currentTeam ? (
            <button
              onClick={openCreateModal}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
            >
              <Plus size={24} className="text-white" />
            </button>
          ) : null
        }
      />

      <div className="container-mobile py-6 space-y-6">
        {!currentTeam ? (
          <Card className="text-center py-12">
            <Calendar size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-600 mb-4">Select a team on Home to view its events.</p>
            <Button
              onClick={() => navigate('/')}
              variant="secondary"
              className="w-full"
            >
              Go Home
            </Button>
          </Card>
        ) : (
          <>
            {!currentTeam?.teams?.treasurer_id && (
              <Card className="border border-warning-300 bg-warning-50">
                <p className="text-sm font-semibold text-warning-900">Team has no treasurer yet.</p>
                <p className="text-xs text-warning-900 mt-1">
                  Please ask an admin to assign a treasurer so settlements can be completed smoothly.
                </p>
              </Card>
            )}

            {todayEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                  Today
                </h2>
                <div className="space-y-3">
                  {todayEvents.map((event, idx) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className="cursor-pointer"
                    >
                      <Card className="hover:shadow-lg transition">
                        <div className="flex items-start justify-between mb-3 gap-3">
                          <div>
                            <h3 className="font-semibold text-lg">{event.title}</h3>
                            <p className="text-sm text-neutral-600">
                              {formatBangkokDateTime(event.date)}
                            </p>
                          </div>
                          <Badge status={event.status === 'CANCELLED' ? 'error' : getBangkokDateKey(event.date) === todayKey ? 'success' : 'warning'}>
                            {event.status === 'CANCELLED'
                              ? 'Cancelled'
                              : getBangkokDateKey(event.date) === todayKey
                              ? 'Today'
                              : 'Upcoming'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-600">
                          <div className="flex items-center gap-1">
                            <MapPin size={16} />
                            {event.location || 'Location TBD'}
                          </div>
                          {event.court_number && <div>Court {event.court_number}</div>}
                        </div>
                        {canManageEvent(event) && (
                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="secondary"
                              className="flex-1"
                              onClick={(e) => openEditModal(event, e)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Edit2 size={14} />
                                Edit
                              </span>
                            </Button>
                            {event.status !== 'CANCELLED' && (
                              <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={(e) => handleCancelEvent(event, e)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <XCircle size={14} />
                                  Cancel
                                </span>
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              className="flex-1"
                              onClick={(e) => handleDeleteEvent(event, e)}
                              loading={actionLoading}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Trash2 size={14} />
                                Delete
                              </span>
                            </Button>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {pendingCheckInPastEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-sm font-semibold text-warning-900 mb-3 uppercase">
                  Pending Check-In Confirmation
                </h2>
                <div className="space-y-3">
                  {pendingCheckInPastEvents.map((event) => (
                    <Card key={event.id} className="border border-warning-300 bg-warning-50">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{event.title}</h3>
                          <p className="text-sm text-neutral-700">{formatBangkokDateTime(event.date)}</p>
                        </div>
                        <Badge status="warning">Pending Confirm</Badge>
                      </div>
                      <p className="text-xs text-warning-900 mb-3">
                        Confirm if you joined this event. After {CHECKIN_CONFIRM_WINDOW_DAYS} days, this event moves to Completed automatically.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={(e) => handleMarkDidNotJoin(event, e)}
                          loading={checkInActionId === `dismiss-${event.id}`}
                          disabled={Boolean(checkInActionId)}
                        >
                          I Didn&apos;t Join
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={(e) => handleConfirmCheckInForPastEvent(event, e)}
                          loading={checkInActionId === `checkin-${event.id}`}
                          disabled={Boolean(checkInActionId)}
                        >
                          Check In
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}
            
            {upcomingEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: todayEvents.length > 0 ? 0.05 : 0 }}
              >
                <h2 className="text-sm font-semibold text-neutral-600 mb-3 uppercase">
                  Upcoming
                </h2>
                <div className="space-y-3">
                  {upcomingEvents.map((event, idx) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => navigate(`/event/${event.id}`)}
                      className="cursor-pointer"
                    >
                      <Card className="hover:shadow-lg transition">
                        <div className="flex items-start justify-between mb-3 gap-3">
                          <div>
                            <h3 className="font-semibold text-lg">{event.title}</h3>
                            <p className="text-sm text-neutral-600">
                              {formatBangkokDateTime(event.date)}
                            </p>
                          </div>
                          <Badge status={event.status === 'CANCELLED' ? 'error' : 'warning'}>
                            {event.status === 'CANCELLED' ? 'Cancelled' : 'Upcoming'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-600">
                          <div className="flex items-center gap-1">
                            <MapPin size={16} />
                            {event.location || 'Location TBD'}
                          </div>
                          {event.court_number && <div>Court {event.court_number}</div>}
                        </div>
                        {canManageEvent(event) && (
                          <div className="mt-4 flex gap-2">
                            <Button
                              variant="secondary"
                              className="flex-1"
                              onClick={(e) => openEditModal(event, e)}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Edit2 size={14} />
                                Edit
                              </span>
                            </Button>
                            {event.status !== 'CANCELLED' && (
                              <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={(e) => handleCancelEvent(event, e)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <XCircle size={14} />
                                  Cancel
                                </span>
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              className="flex-1"
                              onClick={(e) => handleDeleteEvent(event, e)}
                              loading={actionLoading}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Trash2 size={14} />
                                Delete
                              </span>
                            </Button>
                          </div>
                        )}
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {completedPastEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="hover:shadow-sm transition">
                  <button
                    type="button"
                    className="w-full"
                    onClick={() => setPastEventsExpanded((prev) => !prev)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-left">
                        <h2 className="text-sm font-semibold text-neutral-700 uppercase">Completed Events</h2>
                        <p className="text-xs text-neutral-500">{`${completedPastEvents.length} events saved`}</p>
                      </div>
                      <span className="text-neutral-500">
                        {pastEventsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </span>
                    </div>
                  </button>

                {pastEventsExpanded && (
                  <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3">
                    {completedPastEvents.map((event) => (
                      <div
                        key={event.id}
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 p-4 opacity-75 hover:opacity-100 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{event.title}</h3>
                            <p className="text-sm text-neutral-600">
                              {formatBangkokDateTime(event.date)}
                            </p>
                          </div>
                          <Badge status={event.status === 'CANCELLED' ? 'error' : String(event.status || '').toUpperCase() === 'COMPLETED' ? 'success' : getBangkokDateKey(event.date) === todayKey ? 'success' : getBangkokDateKey(event.date) > todayKey ? 'warning' : 'success'}>
                            {event.status === 'CANCELLED'
                              ? 'Cancelled'
                              : String(event.status || '').toUpperCase() === 'COMPLETED'
                              ? 'Completed'
                              : getBangkokDateKey(event.date) === todayKey
                              ? 'Today'
                              : getBangkokDateKey(event.date) > todayKey
                              ? 'Upcoming'
                              : 'Completed'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </Card>
              </motion.div>
            )}

            {events.length === 0 && (
              <Card className="text-center py-12">
                <Calendar size={48} className="mx-auto text-neutral-300 mb-4" />
                <p className="text-neutral-600 mb-4">No events yet for this team</p>
                <Button
                  onClick={openCreateModal}
                  className="w-full"
                >
                  Create Event
                </Button>
              </Card>
            )}
          </>
        )}
      </div>

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
                  <p className="font-semibold">{team.teams?.name || 'Unnamed Team'}</p>
                  <p className="text-xs text-neutral-600">
                    Joined {team.joined_at ? new Date(team.joined_at).toLocaleDateString() : '-'}
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
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEvent}
              className="flex-1"
              disabled={!formData.title || !formData.date || !currentTeam}
              loading={actionLoading}
            >
              {editingEvent ? 'Save' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Event Title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Morning Session"
          />
          <Input
            label="Date & Time"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
          />
          <Input
            label="Location"
            value={formData.location}
            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="Where will it be?"
          />
          <Input
            label="Court Number"
            type="number"
            value={formData.court_number}
            onChange={(e) => setFormData((prev) => ({ ...prev, court_number: e.target.value }))}
            placeholder="1"
          />
        </div>
      </Modal>

      <BottomNav />
    </motion.div>
  )
}
