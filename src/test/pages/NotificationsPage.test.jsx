import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationsPage } from '../../pages/NotificationsPage'
import * as api from '../../lib/api'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('../../components', async () => {
  const actual = await vi.importActual('../../components')
  return {
    ...actual,
    BottomNav: () => null,
  }
})

vi.mock('../../lib/api', () => ({
  getNotifications: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
}))

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getUnreadNotificationCount.mockResolvedValue(0)
  })

  it('loads notifications and marks unread as read', async () => {
    api.getNotifications.mockResolvedValue([
      {
        id: 'n1',
        type: 'EVENT_CREATED',
        title: 'Event created',
        message: 'Morning session is live',
        created_at: '2026-04-27T02:00:00.000Z',
        is_read: false,
        link_path: '/events/e1',
      },
    ])

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(api.getNotifications).toHaveBeenCalled()
      expect(api.markAllNotificationsAsRead).toHaveBeenCalled()
      expect(screen.getByText('Event created')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notifications', async () => {
    api.getNotifications.mockResolvedValue([])

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
    })
  })

  it('marks item as read and navigates to link on click', async () => {
    api.getNotifications.mockResolvedValue([
      {
        id: 'n2',
        type: 'TEAM_MEMBER_ADDED',
        title: 'Team update',
        message: 'You were added to team A',
        created_at: '2026-04-27T02:00:00.000Z',
        is_read: false,
        link_path: '/team/t1',
      },
    ])
    api.markNotificationAsRead.mockResolvedValue({})

    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    )

    const item = await screen.findByText('Team update')
    fireEvent.click(item)

    await waitFor(() => {
      expect(api.markNotificationAsRead).toHaveBeenCalledWith('n2')
      expect(mockNavigate).toHaveBeenCalledWith('/team/t1')
    })
  })
})
