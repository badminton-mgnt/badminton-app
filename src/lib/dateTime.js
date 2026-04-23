const bangkokDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'medium',
  timeStyle: 'short',
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

export const getBangkokDateKey = (value) => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const getPart = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`
}

export const formatBangkokDateTime = (value) => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return bangkokDateTimeFormatter.format(date)
}

export const toDateTimeLocalValue = (value) => {
  const date = parseDateValue(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
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
