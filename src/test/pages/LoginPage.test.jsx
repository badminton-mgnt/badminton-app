import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '../../pages/LoginPage'
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
  login: vi.fn(),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits login and navigates to home on success', async () => {
    api.login.mockResolvedValue({ session: {} })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('you@example.com or your.username'), { target: { value: 'tester' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('tester', 'Pass123!')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('')
  })

  it('shows verify email message for unconfirmed email error', async () => {
    api.login.mockRejectedValue(new Error('Email not confirmed'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('you@example.com or your.username'), { target: { value: 'tester' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByText('Please verify your email before logging in')).toBeInTheDocument()
    })
  })

  it('shows raw error message for generic login failure', async () => {
    api.login.mockRejectedValue(new Error('Invalid credentials'))

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('you@example.com or your.username'), { target: { value: 'tester' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'Pass123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('navigates to forgot-password and signup routes', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password')
    expect(mockNavigate).toHaveBeenCalledWith('/signup')
  })
})
