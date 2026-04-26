import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResetPasswordPage } from '../../pages/ResetPasswordPage'
import * as api from '../../lib/api'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../lib/api', () => ({
  updatePassword: vi.fn(),
}))

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation error for weak password', async () => {
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    )

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'weak' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'weak' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password must include uppercase, lowercase, number, special char, and 8+ characters.')).toBeInTheDocument()
    })
    expect(api.updatePassword).not.toHaveBeenCalled()
  })

  it('shows validation error when passwords do not match', async () => {
    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    )

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'Pass123!x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    })
    expect(api.updatePassword).not.toHaveBeenCalled()
  })

  it('updates password and shows success screen', async () => {
    api.updatePassword.mockResolvedValue({})

    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    )

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(api.updatePassword).toHaveBeenCalledWith('Pass123!')
      expect(screen.getByText('Password updated')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Go to Login' }))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('shows API error when update password fails', async () => {
    api.updatePassword.mockRejectedValue(new Error('Update failed'))

    render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    )

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })
})
