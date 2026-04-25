import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Calendar, Trophy, Settings2, User, Bell } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUnreadNotificationCount, getUserProfile } from '../lib/api'

export const BottomNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

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
    if (!user) {
      setUnreadCount(0)
      return
    }

    let isMounted = true

    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount()
        if (isMounted) {
          setUnreadCount(count)
        }
      } catch (error) {
        console.error('Error loading unread notifications:', error)
      }
    }

    loadUnreadCount()
    const intervalId = window.setInterval(loadUnreadCount, 30000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [user?.id, location.pathname])

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
    }

    navigate(path, {
      replace: location.pathname === path,
      state: {
        navRefreshAt: Date.now(),
      },
    })
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200">
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
