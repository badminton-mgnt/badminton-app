import { supabase } from './supabase'

const attachUsersById = async (rows, fields = 'id, name') => {
  if (!rows?.length) {
    return []
  }

  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))]
  const { data: users, error } = await supabase
    .from('users')
    .select(fields)
    .in('id', userIds)

  if (error) throw error

  const usersById = new Map((users || []).map((user) => [String(user.id), user]))

  return rows.map((row) => ({
    ...row,
    users: usersById.get(String(row.user_id)) || null,
  }))
}

// Auth functions
export const signup = async (email, password, name) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })

  if (error) throw error

  // Create user profile
  const { error: profileError } = await supabase
    .from('users')
    .insert([{ id: data.user.id, name }])

  if (profileError) throw profileError

  return data
}

export const login = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export const updatePassword = async (newPassword) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  if (error) throw error
}

// User functions
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()

  if (error) throw error
  return data
}

export const getAppUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

// Team functions
export const createTeam = async (name, userId) => {
  if (!userId) {
    throw new Error('User ID is missing. Please log in again.')
  }

  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('Team name is required.')
  }

  if (trimmedName.length > 20) {
    throw new Error('Team name must be 20 characters or fewer.')
  }

  const { data, error } = await supabase
    .from('teams')
    .insert([{ name: trimmedName, created_by: userId }])
    .select()

  if (error) {
    console.error('Error inserting team:', error, { name: trimmedName, created_by: userId })
    throw error
  }

  const { error: memberError } = await supabase
    .from('team_members')
    .insert([{ team_id: data[0].id, user_id: userId }])

  if (memberError) {
    console.error('Error inserting team member:', memberError)
    throw memberError
  }

  return data[0]
}

export const getTeams = async (userId) => {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, team_id, joined_at, teams(id, name, created_by, created_at)')
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export const getAllTeams = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_by, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const getTeam = async (teamId) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_by, created_at')
    .eq('id', teamId)
    .single()

  if (error) throw error
  return data
}

export const updateTeam = async (teamId, name) => {
  const trimmedName = name.trim()

  if (!trimmedName) {
    throw new Error('Team name is required.')
  }

  if (trimmedName.length > 20) {
    throw new Error('Team name must be 20 characters or fewer.')
  }

  const { data, error } = await supabase
    .from('teams')
    .update({ name: trimmedName })
    .eq('id', teamId)
    .select()
    .single()

  if (error) throw error
  return data
}

export const getTeamMembers = async (teamId) => {
  const { data, error } = await supabase
    .from('team_members')
    .select('id, user_id, joined_at, users(id, name, role)')
    .eq('team_id', teamId)

  if (error) throw error
  return data
}

export const addTeamMember = async (teamId, userId) => {
  const { data, error } = await supabase
    .from('team_members')
    .insert([{ team_id: teamId, user_id: userId }])
    .select()

  if (error) throw error
  return data
}

export const joinTeam = async (teamId, userId) => {
  const { data, error } = await supabase
    .from('team_members')
    .insert([{ team_id: teamId, user_id: userId }])
    .select()

  if (error) throw error
  return data
}

export const leaveTeam = async (teamId, userId) => {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw error
}

export const deleteTeam = async (teamId, reason) => {
  const trimmedReason = reason.trim()

  if (!trimmedReason) {
    throw new Error('Delete reason is required.')
  }

  const { error } = await supabase.rpc('delete_team_with_reason', {
    p_team_id: teamId,
    p_reason: trimmedReason,
  })

  if (error) throw error
}

// Event functions
export const createEvent = async (event, teamId) => {
  const { data, error } = await supabase
    .from('events')
    .insert([{ ...event, team_id: teamId }])
    .select()

  if (error) throw error
  return data[0]
}

export const getEvents = async (teamId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('team_id', teamId)
    .order('date', { ascending: true })

  if (error) throw error
  return data
}

export const getEventDetail = async (eventId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (error) throw error
  return data
}

export const updateEvent = async (eventId, updates) => {
  const { data, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', eventId)
    .select()

  if (error) throw error
  return data[0]
}

export const deleteEvent = async (eventId) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)

  if (error) throw error
}

// Participant functions
export const checkinParticipant = async (eventId, userId) => {
  const { data: existingRows, error: selectError } = await supabase
    .from('event_participants')
    .select('id, checked_in')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .limit(1)

  if (selectError) throw selectError

  if (existingRows.length > 0) {
    const { data, error } = await supabase
      .from('event_participants')
      .update({
        checked_in: true,
        checked_in_at: new Date().toISOString(),
      })
      .eq('id', existingRows[0].id)
      .select()

    if (error) throw error
    return data[0]
  }

  const { data, error } = await supabase
    .from('event_participants')
    .insert([{
      event_id: eventId,
      user_id: userId,
      checked_in: true,
      checked_in_at: new Date().toISOString(),
    }])
    .select()

  if (error) throw error
  return data[0]
}

export const getEventParticipants = async (eventId) => {
  const { data: participants, error: participantsError } = await supabase
    .from('event_participants')
    .select('id, event_id, user_id, checked_in, checked_in_at')
    .eq('event_id', eventId)

  if (participantsError) throw participantsError
  return attachUsersById(participants, 'id, name')
}

export const getCheckedInCount = async (eventId) => {
  const { data, error } = await supabase
    .from('event_participants')
    .select('id')
    .eq('event_id', eventId)
    .eq('checked_in', true)

  if (error) throw error
  return data.length
}

// Expense functions
export const createExpense = async (expense) => {
  const { data, error } = await supabase
    .from('expenses')
    .insert([expense])
    .select()

  if (error) throw error
  return data[0]
}

export const getEventExpenses = async (eventId) => {
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('event_id', eventId)

  if (error) throw error
  return attachUsersById(expenses, 'id, name')
}

export const updateExpenseStatus = async (expenseId, status) => {
  const { data, error } = await supabase
    .from('expenses')
    .update({ status })
    .eq('id', expenseId)
    .select()

  if (error) throw error
  return data[0]
}

// Payment functions
export const createPayment = async (payment) => {
  const { data, error } = await supabase
    .from('payments')
    .upsert([payment], { onConflict: 'event_id,user_id' })
    .select()

  if (error) throw error
  return data[0]
}

export const getEventPayments = async (eventId) => {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .eq('event_id', eventId)

  if (error) throw error
  return attachUsersById(payments, 'id, name')
}

export const updatePaymentStatus = async (paymentId, status) => {
  const { data, error } = await supabase
    .from('payments')
    .update({ status })
    .eq('id', paymentId)
    .select()

  if (error) throw error
  return data[0]
}

export const savePayment = async (payment) => {
  const { data, error } = await supabase
    .from('payments')
    .upsert([payment], { onConflict: 'event_id,user_id' })
    .select()

  if (error) throw error
  return data[0]
}

export const getUserPayments = async (userId, eventId) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('event_id', eventId)

  if (error) throw error
  return data
}

// Payment Info functions
export const setPaymentInfo = async (userId, paymentInfo) => {
  const { data, error } = await supabase
    .from('payment_info')
    .upsert([{ user_id: userId, ...paymentInfo }])
    .select()

  if (error) throw error
  return data[0]
}

export const getPaymentInfo = async (userId) => {
  const { data, error } = await supabase
    .from('payment_info')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}
