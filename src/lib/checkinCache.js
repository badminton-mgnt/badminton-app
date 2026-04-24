const getStorageKey = (userId) => `badminton-app.checked-in-events.${userId}`
const getDismissedStorageKey = (userId) => `badminton-app.dismissed-checkin-events.${userId}`

const readCheckedInEventIds = (userId) => {
  if (!userId) return []

  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error reading checked-in events cache:', error)
    return []
  }
}

const readDismissedEventIds = (userId) => {
  if (!userId) return []

  try {
    const raw = localStorage.getItem(getDismissedStorageKey(userId))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error reading dismissed check-in events cache:', error)
    return []
  }
}

export const hasCheckedInEvent = (userId, eventId) =>
  readCheckedInEventIds(userId).includes(String(eventId))

export const rememberCheckedInEvent = (userId, eventId) => {
  if (!userId || !eventId) return

  const eventIds = readCheckedInEventIds(userId)
  const nextEventIds = [...new Set([...eventIds, String(eventId)])]

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(nextEventIds))
  } catch (error) {
    console.error('Error writing checked-in events cache:', error)
  }
}

export const forgetCheckedInEvent = (userId, eventId) => {
  if (!userId || !eventId) return

  const nextEventIds = readCheckedInEventIds(userId).filter((id) => id !== String(eventId))

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(nextEventIds))
  } catch (error) {
    console.error('Error clearing checked-in events cache:', error)
  }
}

export const hasDismissedCheckInEvent = (userId, eventId) =>
  readDismissedEventIds(userId).includes(String(eventId))

export const rememberDismissedCheckInEvent = (userId, eventId) => {
  if (!userId || !eventId) return

  const eventIds = readDismissedEventIds(userId)
  const nextEventIds = [...new Set([...eventIds, String(eventId)])]

  try {
    localStorage.setItem(getDismissedStorageKey(userId), JSON.stringify(nextEventIds))
  } catch (error) {
    console.error('Error writing dismissed check-in events cache:', error)
  }
}

export const forgetDismissedCheckInEvent = (userId, eventId) => {
  if (!userId || !eventId) return

  const nextEventIds = readDismissedEventIds(userId).filter((id) => id !== String(eventId))

  try {
    localStorage.setItem(getDismissedStorageKey(userId), JSON.stringify(nextEventIds))
  } catch (error) {
    console.error('Error clearing dismissed check-in events cache:', error)
  }
}
