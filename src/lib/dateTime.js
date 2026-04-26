const APP_TIMEZONE = 'Asia/Ho_Chi_Minh'

const vietnamDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
})

const vietnamDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'medium',
})

const parseDateValue = (value) => {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string') {
    const normalizedValue =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
        ? `${value}Z`
        : value

    return new Date(normalizedValue)
  }

  return new Date(value)
}

export const getVietnamDateKey = (value) => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const getPart = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`
}

export const formatVietnamDateTime = (value, fallback = 'Date unavailable') => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return fallback
  return vietnamDateTimeFormatter.format(date)
}

export const formatVietnamDate = (value, fallback = 'Date unavailable') => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return fallback
  return vietnamDateFormatter.format(date)
}

export const toDateTimeLocalValue = (value) => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const getPart = (type) => parts.find((part) => part.type === type)?.value || '00'
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}`
}

export const toSupabaseDateTime = (value) => {
  if (!value) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString()
}

export const toUnixTimestamp = (value) => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getTime()
}

export const getBangkokDateKey = getVietnamDateKey
export const formatBangkokDateTime = formatVietnamDateTime
