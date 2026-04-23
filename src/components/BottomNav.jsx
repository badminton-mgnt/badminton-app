import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, Settings2, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getUserProfile } from '../lib/api'

export const BottomNav = () => {
  const location = useLocation()
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

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

  const items = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/events', label: 'Events', icon: Calendar },
    ...(isAdmin ? [{ path: '/manage', label: 'Manage', icon: Settings2 }] : []),
    { path: '/me', label: 'Me', icon: User },
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200">
      <div className="container-mobile flex justify-around">
        {items.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              className="flex-1 flex flex-col items-center justify-center py-3 text-neutral-600 hover:text-primary-400 transition"
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-primary-400"
                  initial={false}
                />
              )}
              <Icon size={24} />
              <span className="text-xs mt-1">{label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
