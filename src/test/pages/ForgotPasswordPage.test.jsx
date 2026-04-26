import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage'
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
  resetPassword: vi.fn(),
}))

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits email and shows success state', async () => {
    api.resetPassword.mockResolvedValue({})

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    await waitFor(() => {
      expect(api.resetPassword).toHaveBeenCalledWith('user@example.com')
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
  })

  it('shows error when reset password API fails', async () => {
    api.resetPassword.mockRejectedValue(new Error('Cannot send email'))

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    await waitFor(() => {
      expect(screen.getByText('Cannot send email')).toBeInTheDocument()
    })
  })

  it('navigates back to login from both states', async () => {
    api.resetPassword.mockResolvedValue({})

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back to Login' }))
    expect(mockNavigate).toHaveBeenCalledWith('/login')

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Back to Login' }))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
