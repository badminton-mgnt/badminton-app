import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Header, Card, Badge, BottomNav } from '../components'
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../lib/api'
import { useLanguage } from '../contexts/LanguageContext'

const NOTIFICATION_TYPE_LABELS = {
  PAYMENT_RECEIVED: 'Payment',
  TEAM_MEMBER_ADDED: 'Team',
  EVENT_PARTICIPANT_ADDED: 'Check-in',
  EVENT_CREATED: 'Event',
  EVENT_JOINING_LOCKED: 'Event',
  EVENT_CANCELLED: 'Event',
  EVENT_DELETED: 'Event',
  EVENT_EXPENSE_ADDING_LOCKED: 'Event',
  TEAM_DELETED: 'Team',
  EVENT_SETTLEMENT_COMPLETED: 'Settlement',
  EXPENSE_REVIEW_PENDING: 'Expense',
  EXPENSE_REVIEW_REQUIRED: 'Expense',
  EXPENSE_ADDED_FOR_YOU: 'Expense',
  EXPENSE_APPROVED: 'Expense',
  EXPENSE_REJECTED: 'Expense',
  PAYMENT_CONFIRMED_BY_RECEIVER: 'Payment',
  PAYMENT_REJECTED_BY_RECEIVER: 'Payment',
  EVENT_SETTLEMENT_PAYMENT_REQUIRED: 'Settlement',
  EVENT_SETTLEMENT_PAYOUT_AVAILABLE: 'Settlement',
}

const localizeNotificationTypeLabel = (label, tx) => {
  switch (label) {
    case 'Payment':
      return tx('Payment', 'Thanh toán')
    case 'Team':
      return tx('Team', 'Team')
    case 'Check-in':
      return tx('Check-in', 'Check-in')
    case 'Event':
      return tx('Event', 'Sự kiện')
    case 'Settlement':
      return tx('Settlement', 'Settlement')
    case 'Expense':
      return tx('Expense', 'Chi phí')
    default:
      return label
  }
}

const parseNotificationDate = (value) => {
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

const toRelativeTime = (dateValue, language = 'en') => {
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const timestamp = parseNotificationDate(dateValue).getTime()
  if (!Number.isFinite(timestamp)) {
    return '-'
  }

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / (60 * 1000))

  if (diffMinutes < 1) return tx('Just now', 'Vừa xong')
  if (diffMinutes < 60) return language === 'vi' ? `${diffMinutes} phút trước` : `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return language === 'vi' ? `${diffHours} giờ trước` : `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  return language === 'vi' ? `${diffDays} ngày trước` : `${diffDays}d ago`
}

export const NotificationsPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { language } = useLanguage()
  const tx = (en, vi) => (language === 'vi' ? vi : en)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

  const loadNotifications = useCallback(async () => {
    if (loadingRef.current) {
      return
    }

    loadingRef.current = true
    try {
      const items = await getNotifications()
      setNotifications(items)

      const hasUnread = items.some((item) => !item.is_read)
      if (hasUnread) {
        await markAllNotificationsAsRead()
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!location.state?.navRefreshAt) return
    loadNotifications()
  }, [location.state?.navRefreshAt, loadNotifications])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadNotifications()
    }, 15000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications()
      }
    }

    const handleWindowFocus = () => {
      loadNotifications()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [loadNotifications])

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }

    if (notification.link_path) {
      navigate(notification.link_path)
    }
  }

  const newNotifications = notifications.filter((notification) => !notification.is_read)
  const oldNotifications = notifications.filter((notification) => notification.is_read)

  const renderNotificationItem = (notification) => (
    <button
      type="button"
      key={notification.id}
      onClick={() => handleNotificationClick(notification)}
      className="w-full text-left"
    >
      <Card className={`transition hover:shadow-md ${notification.is_read ? 'opacity-80' : 'border border-primary-300 bg-primary-50/30'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-neutral-900">{notification.title}</p>
            <p className="text-sm text-neutral-700 mt-1">{notification.message}</p>
            <p className="text-xs text-neutral-500 mt-2">{toRelativeTime(notification.created_at, language)}</p>
          </div>
          <Badge status={notification.is_read ? 'success' : 'warning'}>
            {localizeNotificationTypeLabel(NOTIFICATION_TYPE_LABELS[notification.type] || tx('Notice', 'Thông báo'), tx)}
          </Badge>
        </div>
      </Card>
    </button>
  )

  return (
    <div className="pb-24">
      <Header title={tx('Notifications', 'Thông báo')} subtitle={tx('Activity and updates', 'Hoạt động và cập nhật')} />

      <div className="container-mobile py-6 space-y-3">
        {loading ? (
          <div className="min-h-[240px] flex items-center justify-center">
            <div className="animate-spin w-10 h-10 border-4 border-primary-400 border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-neutral-600">{tx('No notifications yet.', 'Chưa có thông báo nào.')}</p>
          </Card>
        ) : (
          <>
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{tx('Unread', 'Chưa đọc')}</p>
              {newNotifications.length > 0 ? (
                newNotifications.map((notification) => renderNotificationItem(notification))
              ) : (
                <Card className="py-4 text-center text-sm text-neutral-500">{tx('No new notifications.', 'Không có thông báo mới.')}</Card>
              )}
            </section>

            <section className="space-y-2 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{tx('Read', 'Đã đọc')}</p>
              {oldNotifications.length > 0 ? (
                oldNotifications.map((notification) => renderNotificationItem(notification))
              ) : (
                <Card className="py-4 text-center text-sm text-neutral-500">{tx('No old notifications.', 'Không có thông báo cũ.')}</Card>
              )}
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
