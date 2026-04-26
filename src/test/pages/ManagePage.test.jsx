import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManagePage } from '../../pages/ManagePage'
import * as api from '../../lib/api'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-admin' } }),
}))

vi.mock('../../components', async () => {
  const actual = await vi.importActual('../../components')
  return {
    ...actual,
    BottomNav: () => null,
  }
})

vi.mock('../../lib/api', () => ({
  createAppSignupSecret: vi.fn(),
  revokeAppSignupSecret: vi.fn(),
  deleteUserProfile: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  getAllTeams: vi.fn(),
  getAppSignupSecrets: vi.fn(),
  getAppUsers: vi.fn(),
  getUserProfile: vi.fn(),
  updateUserRole: vi.fn(),
}))

const baseSecret = {
  id: 'secret-1',
  secret_key: 'APP-EXISTING-KEY',
  is_active: true,
  max_uses: 10,
  used_count: 1,
  expires_at: '2026-04-27T03:00:00.000Z',
  created_at: '2026-04-27T02:00:00.000Z',
  users: { id: 'u-admin', name: 'Admin' },
}

describe('ManagePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getUnreadNotificationCount.mockResolvedValue(0)
    api.getUserProfile.mockResolvedValue({ id: 'u-admin', name: 'Admin', role: 'admin' })
    api.getAllTeams.mockResolvedValue([])
    api.getAppUsers.mockResolvedValue([])
    api.getAppSignupSecrets.mockResolvedValue([baseSecret])
  })

  it('shows restricted view for non-admin users', async () => {
    api.getUserProfile.mockResolvedValue({ id: 'u-admin', name: 'Normal User', role: 'user' })

    render(
      <MemoryRouter>
        <ManagePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Only admin users can access management tools.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'App Secrets' })).not.toBeInTheDocument()
    })
  })

  it('triggers create app secret action', async () => {
    api.createAppSignupSecret.mockResolvedValue({ ...baseSecret, id: 'secret-2', secret_key: 'APP-NEW-KEY' })

    render(
      <MemoryRouter>
        <ManagePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'App Secrets' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'App Secrets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate Key' }))

    await waitFor(() => {
      expect(api.createAppSignupSecret).toHaveBeenCalledWith({ maxUses: 10, expiresInHours: 1 })
    })
  })

  it('triggers revoke app secret action', async () => {
    api.revokeAppSignupSecret.mockResolvedValue({
      id: 'secret-1',
      is_active: false,
      revoked_at: '2026-04-27T02:30:00.000Z',
      revoked_by: 'u-admin',
    })

    render(
      <MemoryRouter>
        <ManagePage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'App Secrets' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'App Secrets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(api.revokeAppSignupSecret).toHaveBeenCalledWith('secret-1')
    })
  })
})
