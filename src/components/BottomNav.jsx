import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Calendar, Trophy, Settings2, User, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadNotificationCount, getUserProfile } from '../lib/api'
import { supabase } from '../lib/supabase'

export const BottomNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [latestNotificationPopup, setLatestNotificationPopup] = useState(null)
  const prevUnreadCountRef = useRef(0)
  const unreadInitializedRef = useRef(false)

  const showLatestUnreadPopup = useCallback(async () => {
    if (!user?.id || location.pathname === '/notifications') {
      return
    }

    try {
      const { data: latestUnread, error } = await supabase
        .from('notifications')
        .select('id, title, message, link_path')
        .eq('recipient_user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (latestUnread) {
        setLatestNotificationPopup({
          id: latestUnread.id,
          title: latestUnread.title || 'New notification',
          message: latestUnread.message || 'You have a new update.',
          linkPath: latestUnread.link_path || '/notifications',
        })
      }
    } catch (error) {
      console.error('Error loading latest unread notification:', error)
    }
  }, [user?.id, location.pathname])

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      prevUnreadCountRef.current = 0
      unreadInitializedRef.current = false
      return
    }

    try {
      const count = await getUnreadNotificationCount()
      setUnreadCount(count)

      if (unreadInitializedRef.current && count > prevUnreadCountRef.current) {
        await showLatestUnreadPopup()
      }

      prevUnreadCountRef.current = count
      unreadInitializedRef.current = true
    } catch (error) {
      console.error('Error loading unread notifications:', error)
    }
  }, [user, showLatestUnreadPopup])

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }

    const loadProfile = async () => {
      try {
        const profile = await getUserProfile(user.id)
        setIsAdmin((profile.role || '').toLowerCase() === 'admin')
      } catch (error) {
        console.error('Error loading nav profile:', error)
        setIsAdmin(false)
      }
    }

    loadProfile()
  }, [user])

  useEffect(() => {
    loadUnreadCount()
    const intervalId = window.setInterval(loadUnreadCount, 5000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUnreadCount()
      }
    }

    const handleWindowFocus = () => {
      loadUnreadCount()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [loadUnreadCount, location.pathname])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setUnreadCount((prev) => {
              const nextCount = prev + 1
              prevUnreadCountRef.current = nextCount
              unreadInitializedRef.current = true
              return nextCount
            })
          } else {
            loadUnreadCount()
          }

          if (payload.eventType === 'INSERT' && location.pathname !== '/notifications') {
            const nextItem = payload.new || {}
            setLatestNotificationPopup({
              id: nextItem.id || Date.now(),
              title: nextItem.title || 'New notification',
              message: nextItem.message || 'You have a new update.',
              linkPath: nextItem.link_path || '/notifications',
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, location.pathname, loadUnreadCount])

  useEffect(() => {
    if (!latestNotificationPopup) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setLatestNotificationPopup(null)
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [latestNotificationPopup])

  const items = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/events', label: 'Events', icon: Calendar },
    { path: '/scores', label: 'Scores', icon: Trophy },
    ...(isAdmin ? [{ path: '/manage', label: 'Manage', icon: Settings2 }] : []),
    { path: '/notifications', label: 'Alerts', icon: Bell, unreadCount },
    { path: '/me', label: 'Me', icon: User },
  ]

  const handleTabClick = (path) => {
    if (path === '/notifications') {
      setUnreadCount(0)
      prevUnreadCountRef.current = 0
      unreadInitializedRef.current = true
    }

    navigate(path, {
      replace: location.pathname === path,
      state: {
        navRefreshAt: Date.now(),
      },
    })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-neutral-200">
      {latestNotificationPopup && (
        <button
          type="button"
          className="absolute left-1/2 top-0 z-50 w-[min(88vw,320px)] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border border-primary-200 bg-white px-3 py-2 text-left shadow-md"
          onClick={() => {
            setLatestNotificationPopup(null)
            setUnreadCount(0)
            prevUnreadCountRef.current = 0
            unreadInitializedRef.current = true
            navigate('/notifications', {
              state: {
                navRefreshAt: Date.now(),
              },
            })
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-500">New Notification</p>
          <p className="mt-0.5 text-xs font-semibold text-neutral-900 line-clamp-1">{latestNotificationPopup.title}</p>
          <p className="mt-0.5 text-[11px] text-neutral-600 line-clamp-1">{latestNotificationPopup.message}</p>
        </button>
      )}
      <div className="container-mobile flex justify-around">
        {items.map(({ path, label, icon: Icon, unreadCount: navUnreadCount = 0 }) => {
          const isActive = location.pathname === path
          return (
            <button
              type="button"
              key={path}
              onClick={() => handleTabClick(path)}
              className="relative flex-1 flex flex-col items-center justify-center py-3 text-neutral-600 hover:text-primary-400 transition"
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-primary-400"
                  initial={false}
                />
              )}
              <Icon size={24} />
              {navUnreadCount > 0 && (
                <span className="absolute top-2 right-5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] font-semibold text-center">
                  {navUnreadCount > 9 ? '9+' : navUnreadCount}
                </span>
              )}
              <span className="text-xs mt-1">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
