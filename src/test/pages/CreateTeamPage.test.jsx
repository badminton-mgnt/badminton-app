import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreateTeamPage } from '../../pages/CreateTeamPage'
import * as api from '../../lib/api'

const mockNavigate = vi.fn()
const mockRefreshTeams = vi.fn()
const mockSetCurrentTeam = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))

vi.mock('../../contexts/TeamContext', () => ({
  useTeam: () => ({
    refreshTeams: mockRefreshTeams,
    setCurrentTeam: mockSetCurrentTeam,
  }),
}))

vi.mock('../../lib/api', () => ({
  createTeam: vi.fn(),
}))

describe('CreateTeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshTeams.mockResolvedValue(undefined)
  })

  it('creates team successfully and navigates home', async () => {
    api.createTeam.mockResolvedValue({ id: 'team-1', name: 'Morning Club' })

    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('e.g., Morning Club'), { target: { value: 'Morning Club' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Team' }))

    await waitFor(() => {
      expect(api.createTeam).toHaveBeenCalledWith('Morning Club', 'u1')
      expect(mockSetCurrentTeam).toHaveBeenCalledWith({
        team_id: 'team-1',
        teams: { id: 'team-1', name: 'Morning Club' },
      })
      expect(mockRefreshTeams).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: { success: true, message: 'Team created successfully!' },
      })
    })
  })

  it('keeps create action disabled for empty team name', () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('e.g., Morning Club'), { target: { value: '   ' } })

    expect(screen.getByRole('button', { name: 'Create Team' })).toBeDisabled()
    expect(api.createTeam).not.toHaveBeenCalled()
  })

  it('shows API error when create team fails', async () => {
    api.createTeam.mockRejectedValue(new Error('Create failed'))

    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('e.g., Morning Club'), { target: { value: 'Morning Club' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Team' }))

    await waitFor(() => {
      expect(screen.getByText('Create failed')).toBeInTheDocument()
    })
  })

  it('navigates back when cancel is clicked', () => {
    render(
      <MemoryRouter>
        <CreateTeamPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
