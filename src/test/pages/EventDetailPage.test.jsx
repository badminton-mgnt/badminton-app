import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EventDetailPage } from '../../pages/EventDetailPage'
import * as api from '../../lib/api'

const mockUseAuth = vi.fn(() => ({ user: { id: 'u-regular' } }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../lib/checkinCache', () => ({
  forgetCheckedInEvent: vi.fn(),
  hasCheckedInEvent: vi.fn(() => false),
  rememberCheckedInEvent: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  checkinParticipant: vi.fn(),
  confirmPaymentTransfer: vi.fn(),
  createPaymentTransfer: vi.fn(),
  createExpense: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  getEventDetail: vi.fn(),
  getEventExpenses: vi.fn(),
  getEventPaymentTransfers: vi.fn(),
  getEventParticipants: vi.fn(),
  getTeam: vi.fn(),
  getTeamMembers: vi.fn(),
  getPaymentInfo: vi.fn(),
  removeEventParticipant: vi.fn(),
  rejectPaymentTransfer: vi.fn(),
  getUserProfile: vi.fn(),
  updateExpenseStatus: vi.fn(),
  updateEvent: vi.fn(),
}))

describe('EventDetailPage access control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getUnreadNotificationCount.mockResolvedValue(0)
    api.getEventDetail.mockResolvedValue({
      id: 'event-1',
      team_id: 'team-1',
      title: 'Morning Event',
      date: '2026-04-27T02:00:00.000Z',
      status: 'UPCOMING',
    })
    api.getEventParticipants.mockResolvedValue([{ id: 'p-1', event_id: 'event-1', user_id: 'u-other', checked_in: true }])
    api.getEventExpenses.mockResolvedValue([])
    api.getEventPaymentTransfers.mockResolvedValue([])
    api.getUserProfile.mockResolvedValue({ id: 'u-regular', role: 'user', name: 'Regular User' })
    api.getTeam.mockResolvedValue({ id: 'team-1', treasurer_id: null })
    api.getTeamMembers.mockResolvedValue([])
    api.getPaymentInfo.mockResolvedValue(null)
  })

  it('blocks detail view for non-participant regular users', async () => {
    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('You can only view event details after joining this event.')).toBeInTheDocument()
    })
  })

  it('allows detail view for admin even when not participant', async () => {
    api.getUserProfile.mockResolvedValue({ id: 'u-regular', role: 'admin', name: 'Admin User' })

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Morning Event')).toBeInTheDocument()
    })
    expect(screen.queryByText('You can only view event details after joining this event.')).not.toBeInTheDocument()
  })

  it('allows detail view for regular participant', async () => {
    api.getEventParticipants.mockResolvedValue([{ id: 'p-1', event_id: 'event-1', user_id: 'u-regular', checked_in: false }])
    api.getUserProfile.mockResolvedValue({ id: 'u-regular', role: 'user', name: 'Regular User' })

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Morning Event')).toBeInTheDocument()
    })
    expect(screen.queryByText('You can only view event details after joining this event.')).not.toBeInTheDocument()
  })
})
