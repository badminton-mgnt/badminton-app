import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SignupPage } from '../../pages/SignupPage'
import * as api from '../../lib/api'

vi.mock('../../lib/api', () => ({
  isUsernameTaken: vi.fn(),
  signupWithAppSecret: vi.fn(),
  signupWithEmail: vi.fn(),
}))

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.signupWithEmail.mockResolvedValue({ user: { id: 'u-email' } })
    api.signupWithAppSecret.mockResolvedValue({ user: { id: 'u-app' } })
  })

  it('submits gmail signup and shows verification message', async () => {
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Email User' } })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'email.user@example.com' } })
    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'Pass123!' } })

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up with Gmail' }))

    await waitFor(() => {
      expect(api.signupWithEmail).toHaveBeenCalledWith('email.user@example.com', 'Pass123!', 'Email User')
      expect(screen.getByText('Check your email')).toBeInTheDocument()
      expect(screen.getByText("We've sent a verification link to email.user@example.com")).toBeInTheDocument()
    })
  })

  it('shows realtime taken status for username in app-secret mode', async () => {
    api.isUsernameTaken.mockResolvedValue(true)

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'App Secret Signup' }))
    fireEvent.change(screen.getByPlaceholderText('your.username'), { target: { value: 'taken.name' } })

    await waitFor(() => {
      expect(screen.getByText('Username is already taken.')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('blocks app-secret submit when username is taken', async () => {
    api.isUsernameTaken.mockResolvedValue(true)

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'App Secret Signup' }))

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Tester' } })
    fireEvent.change(screen.getByPlaceholderText('your.username'), { target: { value: 'taken.name' } })
    fireEvent.change(screen.getByPlaceholderText('Provided by admin'), { target: { value: 'APP-KEY' } })
    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    const confirmInput = passwordInputs[1]
    fireEvent.change(confirmInput, { target: { value: 'Pass123!' } })

    await waitFor(() => {
      expect(screen.getByText('Username is already taken.')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByRole('button', { name: 'Sign Up with App Secret' })).toBeDisabled()
    expect(api.signupWithAppSecret).not.toHaveBeenCalled()
  })

  it('submits app-secret signup when username is available', async () => {
    api.isUsernameTaken.mockResolvedValue(false)

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'App Secret Signup' }))

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'App User' } })
    fireEvent.change(screen.getByPlaceholderText('your.username'), { target: { value: 'app.user' } })
    fireEvent.change(screen.getByPlaceholderText('Provided by admin'), { target: { value: 'APP-KEY-001' } })
    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'Pass123!' } })

    await waitFor(() => {
      expect(screen.getByText('Username is available.')).toBeInTheDocument()
    }, { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up with App Secret' }))

    await waitFor(() => {
      expect(api.signupWithAppSecret).toHaveBeenCalledWith('app.user', 'Pass123!', 'App User', 'APP-KEY-001')
      expect(screen.getByText('Account created')).toBeInTheDocument()
    })
  })

  it('maps generic signup db error to invalid app secret message', async () => {
    api.isUsernameTaken.mockResolvedValue(false)
    api.signupWithAppSecret.mockRejectedValue(new Error('Database error saving new user'))

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: 'App Secret Signup' }))
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'App User' } })
    fireEvent.change(screen.getByPlaceholderText('your.username'), { target: { value: 'app.user' } })
    fireEvent.change(screen.getByPlaceholderText('Provided by admin'), { target: { value: 'APP-KEY-001' } })
    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    fireEvent.change(passwordInputs[0], { target: { value: 'Pass123!' } })
    fireEvent.change(passwordInputs[1], { target: { value: 'Pass123!' } })

    await waitFor(() => {
      expect(screen.getByText('Username is available.')).toBeInTheDocument()
    }, { timeout: 3000 })

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up with App Secret' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid app secret. Please check with admin.')).toBeInTheDocument()
    })
  })
})
