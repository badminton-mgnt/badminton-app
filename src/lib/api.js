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

const attachTransferUsers = async (rows, fields = 'id, name') => {
  if (!rows?.length) {
    return []
  }

  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.from_user_id, row.to_user_id])
        .filter(Boolean)
    ),
  ]

  const { data: users, error } = await supabase
    .from('users')
    .select(fields)
    .in('id', userIds)

  if (error) throw error

  const usersById = new Map((users || []).map((user) => [String(user.id), user]))

  return rows.map((row) => ({
    ...row,
    from_user: usersById.get(String(row.from_user_id)) || null,
    to_user: usersById.get(String(row.to_user_id)) || null,
  }))
}

const attachExpenseUsers = async (rows, fields = 'id, name') => {
  if (!rows?.length) {
    return []
  }

  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.user_id, row.approved_by])
        .filter(Boolean)
    ),
  ]

  const { data: users, error } = await supabase
    .from('users')
    .select(fields)
    .in('id', userIds)

  if (error) throw error

  const usersById = new Map((users || []).map((user) => [String(user.id), user]))

  return rows.map((row) => ({
    ...row,
    users: usersById.get(String(row.user_id)) || null,
    approved_by_user: usersById.get(String(row.approved_by)) || null,
  }))
}

const attachEventMatchScoreUsers = async (rows, fields = 'id, name') => {
  if (!rows?.length) {
    return []
  }

  const userIds = [
    ...new Set(
      rows
        .flatMap((row) => [
          row.team_a_player_1,
          row.team_a_player_2,
          row.team_b_player_1,
          row.team_b_player_2,
          row.created_by,
        ])
        .filter(Boolean)
    ),
  ]

  const { data: users, error } = await supabase
    .from('users')
    .select(fields)
    .in('id', userIds)

  if (error) throw error

  const usersById = new Map((users || []).map((user) => [String(user.id), user]))

  return rows.map((row) => ({
    ...row,
    team_a_player_1_user: usersById.get(String(row.team_a_player_1)) || null,
    team_a_player_2_user: usersById.get(String(row.team_a_player_2)) || null,
    team_b_player_1_user: usersById.get(String(row.team_b_player_1)) || null,
    team_b_player_2_user: usersById.get(String(row.team_b_player_2)) || null,
    created_by_user: usersById.get(String(row.created_by)) || null,
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

export const deleteUserProfile = async (userId) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) throw error
}

export const updateUserRole = async (userId, role) => {
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .select('id, name, role')
    .single()

  if (error) throw error
  return data
}

export const logout = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const removeTeamMember = async (teamId, userId) => {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw error
}

export const updateTeamTreasurer = async (teamId, treasurerId) => {
  const { data: currentTeam, error: currentTeamError } = await supabase
    .from('teams')
    .select('id, treasurer_id')
    .eq('id', teamId)
    .single()

  if (currentTeamError) throw currentTeamError

  if (
    currentTeam?.treasurer_id &&
    treasurerId &&
    String(currentTeam.treasurer_id) !== String(treasurerId)
  ) {
    throw new Error('This team already has a treasurer. Please clear current treasurer first before assigning another one.')
  }

  const { data, error } = await supabase
    .from('teams')
    .update({ treasurer_id: treasurerId || null })
    .eq('id', teamId)
    .select('id, name, created_by, treasurer_id, created_at')
    .single()

  if (error) throw error
  return data
}

export const getTeamInvitations = async (teamId) => {
  const { data, error } = await supabase
    .from('team_invitations')
    .select('id, team_id, email, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const createTeamInvitation = async (teamId, email) => {
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await supabase
    .from('team_invitations')
    .upsert([{ team_id: teamId, email: normalizedEmail }], { onConflict: 'team_id,email' })
    .select('id, team_id, email, created_at')
    .single()

  if (error) throw error
  return data
}

export const deleteTeamInvitation = async (invitationId) => {
  const { error } = await supabase
    .from('team_invitations')
    .delete()
    .eq('id', invitationId)

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
    .select('id, team_id, joined_at, teams(id, name, created_by, treasurer_id, created_at)')
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export const getAllTeams = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_by, treasurer_id, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const getTeam = async (teamId) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, created_by, treasurer_id, created_at')
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
export const checkinParticipant = async (eventId, userId, checkedInByUserId = userId) => {
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
        checked_in_by: checkedInByUserId,
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
      checked_in_by: checkedInByUserId,
    }])
    .select()

  if (error) throw error
  return data[0]
}

export const getEventParticipants = async (eventId) => {
  const { data: participants, error: participantsError } = await supabase
    .from('event_participants')
    .select('id, event_id, user_id, checked_in, checked_in_at, checked_in_by')
    .eq('event_id', eventId)

  if (participantsError) throw participantsError
  const participantsWithUsers = await attachUsersById(participants, 'id, name')

  if (!participantsWithUsers.length) {
    return participantsWithUsers
  }

  const checkedInByUserIds = [
    ...new Set(
      participantsWithUsers
        .map((row) => row.checked_in_by)
        .filter(Boolean)
    ),
  ]

  if (checkedInByUserIds.length === 0) {
    return participantsWithUsers
  }

  const { data: checkedInByUsers, error: checkedInByUsersError } = await supabase
    .from('users')
    .select('id, name')
    .in('id', checkedInByUserIds)

  if (checkedInByUsersError) throw checkedInByUsersError

  const checkedInByUsersMap = new Map((checkedInByUsers || []).map((user) => [String(user.id), user]))

  return participantsWithUsers.map((row) => ({
    ...row,
    checked_in_by_user: checkedInByUsersMap.get(String(row.checked_in_by)) || null,
  }))
}

export const removeEventParticipant = async (participantId) => {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('id', participantId)

  if (error) throw error
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
  return attachExpenseUsers(expenses, 'id, name')
}

export const updateExpenseStatus = async (expenseId, status, approverUserId) => {
  const nextStatus = String(status || '').toUpperCase()
  const updatePayload = {
    status: nextStatus,
    approved_by: ['APPROVED', 'REJECTED'].includes(nextStatus) ? approverUserId : null,
    approved_at: ['APPROVED', 'REJECTED'].includes(nextStatus) ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updatePayload)
    .eq('id', expenseId)
    .select()

  if (error) throw error
  return data[0]
}

export const getEventMatchScores = async (eventId) => {
  const { data: matchScores, error } = await supabase
    .from('event_match_scores')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return attachEventMatchScoreUsers(matchScores, 'id, name')
}

export const createEventMatchScore = async (matchScore) => {
  const { data, error } = await supabase
    .from('event_match_scores')
    .insert([matchScore])
    .select()

  if (error) throw error
  const [enrichedMatchScore] = await attachEventMatchScoreUsers(data, 'id, name')
  return enrichedMatchScore
}

export const getEventPaymentTransfers = async (eventId) => {
  const { data: transfers, error } = await supabase
    .from('payment_transfers')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return attachTransferUsers(transfers, 'id, name')
}

export const createPaymentTransfer = async (transfer) => {
  const { data, error } = await supabase
    .from('payment_transfers')
    .insert([transfer])
    .select()

  if (error) throw error
  return data[0]
}

export const updatePaymentTransfer = async (transferId, updates) => {
  const { data, error } = await supabase
    .from('payment_transfers')
    .update(updates)
    .eq('id', transferId)
    .select()

  if (error) throw error
  return data[0]
}

export const confirmPaymentTransfer = async (transferId) => {
  const { data, error } = await supabase
    .from('payment_transfers')
    .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
    .eq('id', transferId)
    .select()

  if (error) throw error
  if (!data?.length) {
    throw new Error('Unable to confirm transfer. This action may be blocked by database permissions.')
  }
  return data[0]
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
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  return data
}
