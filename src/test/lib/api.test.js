import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_SECRET_INTERNAL_EMAIL_DOMAIN } from '../../lib/accountIdentity'
import { supabase } from '../../lib/supabase'
import {
  createAppSignupSecret,
  createTeam,
  deleteTeam,
  isUsernameTaken,
  login,
  signupWithAppSecret,
  signupWithEmail,
  updateTeam,
} from '../../lib/api'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('api auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signupWithAppSecret sends internal email and metadata', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await signupWithAppSecret('TeSt.User', 'Pass123!', 'Tester', 'KEY-123')

    expect(supabase.auth.signUp).toHaveBeenCalledTimes(1)
    const payload = supabase.auth.signUp.mock.calls[0][0]
    expect(payload.email).toBe(`test.user@${APP_SECRET_INTERNAL_EMAIL_DOMAIN}`)
    expect(payload.options.data).toMatchObject({
      name: 'Tester',
      username: 'test.user',
      app_secret: 'KEY-123',
      signup_method: 'app_secret',
    })
  })

  it('signupWithAppSecret trims secret and throws supabase error', async () => {
    const signUpError = new Error('signup failed')
    supabase.auth.signUp.mockResolvedValue({ data: null, error: signUpError })

    await expect(signupWithAppSecret('Test.User', 'Pass123!', 'Tester', '  KEY-123  ')).rejects.toThrow('signup failed')

    const payload = supabase.auth.signUp.mock.calls[0][0]
    expect(payload.options.data.app_secret).toBe('KEY-123')
  })

  it('signupWithEmail sends signup_method email and redirect URL', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await signupWithEmail('person@gmail.com', 'Pass123!', 'Person')

    const payload = supabase.auth.signUp.mock.calls[0][0]
    expect(payload.email).toBe('person@gmail.com')
    expect(payload.options.data).toMatchObject({
      name: 'Person',
      signup_method: 'email',
    })
    expect(payload.options.emailRedirectTo).toContain('/login')
  })

  it('signupWithEmail throws when supabase returns error', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: null, error: new Error('signup email failed') })

    await expect(signupWithEmail('person@gmail.com', 'Pass123!', 'Person')).rejects.toThrow('signup email failed')
  })

  it('login accepts username and maps to internal email', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })

    await login('test.user', 'Pass123!')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: `test.user@${APP_SECRET_INTERNAL_EMAIL_DOMAIN}`,
      password: 'Pass123!',
    })
  })

  it('login with normal email keeps email unchanged', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })

    await login('person@gmail.com', 'Pass123!')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@gmail.com',
      password: 'Pass123!',
    })
  })

  it('login normalizes input email casing and whitespace', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })

    await login('  PERSON@GMAIL.COM  ', 'Pass123!')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'person@gmail.com',
      password: 'Pass123!',
    })
  })

  it('login throws when signIn fails', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: new Error('login failed') })

    await expect(login('test.user', 'Pass123!')).rejects.toThrow('login failed')
  })

  it('isUsernameTaken returns true when count > 0', async () => {
    const eq = vi.fn().mockResolvedValue({ count: 1, error: null })
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    const taken = await isUsernameTaken('tester')

    expect(supabase.from).toHaveBeenCalledWith('users')
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true })
    expect(eq).toHaveBeenCalledWith('username', 'tester')
    expect(taken).toBe(true)
  })

  it('isUsernameTaken returns false for empty input without querying', async () => {
    const taken = await isUsernameTaken('   ')
    expect(taken).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('isUsernameTaken propagates query error', async () => {
    const dbError = new Error('db failed')
    const eq = vi.fn().mockResolvedValue({ count: 0, error: dbError })
    const select = vi.fn(() => ({ eq }))
    supabase.from.mockReturnValue({ select })

    await expect(isUsernameTaken('tester')).rejects.toThrow('db failed')
  })

  it('createAppSignupSecret validates positive maxUses and expiresInHours', async () => {
    await expect(createAppSignupSecret({ maxUses: 0, expiresInHours: 1 })).rejects.toThrow('maxUses must be a positive number')
    await expect(createAppSignupSecret({ maxUses: 1, expiresInHours: 0 })).rejects.toThrow('expiresInHours must be a positive number')
  })

  it('createTeam validates user id and team name', async () => {
    await expect(createTeam('Alpha', '')).rejects.toThrow('User ID is missing. Please log in again.')
    await expect(createTeam('   ', 'u1')).rejects.toThrow('Team name is required.')
    await expect(createTeam('123456789012345678901', 'u1')).rejects.toThrow('Team name must be 20 characters or fewer.')
  })

  it('updateTeam validates team name', async () => {
    await expect(updateTeam('team-1', '   ')).rejects.toThrow('Team name is required.')
    await expect(updateTeam('team-1', '123456789012345678901')).rejects.toThrow('Team name must be 20 characters or fewer.')
  })

  it('deleteTeam validates reason before rpc call', async () => {
    await expect(deleteTeam('team-1', '   ')).rejects.toThrow('Delete reason is required.')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
