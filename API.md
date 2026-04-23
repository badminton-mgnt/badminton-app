# API Documentation

Tất cả các API functions được định nghĩa trong `src/lib/api.js`

## Authentication

### signup(email, password, name)
Đăng ký người dùng mới
```js
const data = await signup('user@example.com', 'Password123!', 'John Doe')
```

### login(email, password)
Đăng nhập với email/password
```js
const { user, session } = await login('user@example.com', 'Password123!')
```

### logout()
Đăng xuất
```js
await logout()
```

### getCurrentUser()
Lấy user hiện tại
```js
const user = await getCurrentUser()
```

### resetPassword(email)
Gửi email reset password
```js
await resetPassword('user@example.com')
```

## User Profile

### getUserProfile(userId)
Lấy thông tin user
```js
const profile = await getUserProfile(userId)
```

### updateUserProfile(userId, updates)
Cập nhật thông tin user
```js
await updateUserProfile(userId, { name: 'New Name' })
```

## Teams

### createTeam(name, userId)
Tạo team mới (creator trở thành admin)
```js
const team = await createTeam('Morning Club', userId)
```

### getTeams(userId)
Lấy danh sách teams của user
```js
const teams = await getTeams(userId)
```

### getTeamMembers(teamId)
Lấy danh sách members trong team
```js
const members = await getTeamMembers(teamId)
```

### updateTeamMemberRole(teamId, userId, role)
Thay đổi role của member ('user', 'sub_admin', 'admin')
```js
await updateTeamMemberRole(teamId, userId, 'sub_admin')
```

### joinTeam(teamId, userId)
User tham gia team
```js
await joinTeam(teamId, userId)
```

## Events

### createEvent(event, teamId)
Tạo event mới
```js
const event = await createEvent({
  title: 'Morning Session',
  date: '2024-04-25T06:00:00',
  location: 'Court 1',
  court_number: 1,
  created_by: userId
}, teamId)
```

### getEvents(teamId)
Lấy danh sách events trong team
```js
const events = await getEvents(teamId)
```

### getEventDetail(eventId)
Lấy chi tiết event
```js
const event = await getEventDetail(eventId)
```

### updateEvent(eventId, updates)
Cập nhật event
```js
await updateEvent(eventId, { status: 'ONGOING' })
```

## Participants

### checkinParticipant(eventId, userId)
Check-in participant vào event
```js
await checkinParticipant(eventId, userId)
```

### getEventParticipants(eventId)
Lấy danh sách participants
```js
const participants = await getEventParticipants(eventId)
```

### getCheckedInCount(eventId)
Lấy số lượng đã check-in
```js
const count = await getCheckedInCount(eventId)
```

## Expenses

### createExpense(expense)
Tạo expense mới
```js
const expense = await createExpense({
  event_id: eventId,
  user_id: userId,
  team_id: teamId,
  amount: 1000,
  description: 'Court fee',
  status: 'PENDING'
})
```

### getEventExpenses(eventId)
Lấy danh sách expenses của event
```js
const expenses = await getEventExpenses(eventId)
```

### updateExpenseStatus(expenseId, status)
Cập nhật status expense ('PENDING', 'APPROVED', 'REJECTED')
```js
await updateExpenseStatus(expenseId, 'APPROVED')
```

## Payments

### createPayment(payment)
Tạo payment mới
```js
const payment = await createPayment({
  event_id: eventId,
  user_id: userId,
  team_id: teamId,
  amount: 500,
  status: 'PENDING'
})
```

### getEventPayments(eventId)
Lấy danh sách payments của event
```js
const payments = await getEventPayments(eventId)
```

### updatePaymentStatus(paymentId, status)
Cập nhật status payment ('PENDING', 'CONFIRMED')
```js
await updatePaymentStatus(paymentId, 'CONFIRMED')
```

### getUserPayments(userId, eventId)
Lấy payments của user cho event
```js
const payments = await getUserPayments(userId, eventId)
```

## Payment Info

### setPaymentInfo(userId, paymentInfo)
Cập nhật thông tin thanh toán
```js
await setPaymentInfo(userId, {
  bank_name: 'HDFC Bank',
  account_number: '1234567890',
  account_name: 'John Doe',
  qr_url: 'https://...'
})
```

### getPaymentInfo(userId)
Lấy thông tin thanh toán
```js
const paymentInfo = await getPaymentInfo(userId)
```

## Error Handling

Tất cả functions throw errors nếu có vấn đề:

```js
try {
  const user = await login(email, password)
} catch (error) {
  console.error('Login failed:', error.message)
}
```

## Usage Examples

### Complete Signup Flow
```js
// 1. Sign up
await signup('user@example.com', 'Password123!', 'John')

// 2. Check email for verification
// 3. Verify email link

// 4. Login
const { user } = await login('user@example.com', 'Password123!')

// 5. Create team
const team = await createTeam('My Team', user.id)

// 6. Set payment info
await setPaymentInfo(user.id, {
  bank_name: 'HDFC',
  account_number: '123456',
  account_name: 'John',
  qr_url: 'https://...'
})
```

### Create and Join Event
```js
// Create event
const event = await createEvent({
  title: 'Morning Match',
  date: new Date().toISOString(),
  location: 'Court 1',
  court_number: 1,
  created_by: userId
}, teamId)

// Get participants
const participants = await getEventParticipants(event.id)

// Check in
await checkinParticipant(event.id, userId)

// Add expense
await createExpense({
  event_id: event.id,
  user_id: userId,
  team_id: teamId,
  amount: 500,
  description: 'Court fee'
})
```

### Settlement & Payment
```js
// Get event details
const event = await getEventDetail(eventId)

// Get expenses
const expenses = await getEventExpenses(eventId)

// Get participants
const participants = await getEventParticipants(eventId)

// Calculate settlement
const approvedExpenses = expenses.filter(e => e.status === 'APPROVED')
const totalCost = approvedExpenses.reduce((sum, e) => sum + e.amount, 0)
const checkedIn = participants.filter(p => p.checked_in).length
const share = totalCost / checkedIn

// Create payment
await createPayment({
  event_id: eventId,
  user_id: userId,
  team_id: teamId,
  amount: share,
  status: 'PENDING'
})
```

## Response Formats

### Event Object
```js
{
  id: 'uuid',
  team_id: 'uuid',
  title: 'Morning Session',
  date: '2024-04-25T06:00:00',
  location: 'Court 1',
  court_number: 1,
  status: 'UPCOMING',
  created_by: 'uuid',
  created_at: '2024-04-20T10:00:00'
}
```

### Expense Object
```js
{
  id: 'uuid',
  team_id: 'uuid',
  event_id: 'uuid',
  user_id: 'uuid',
  amount: 500,
  description: 'Court fee',
  status: 'APPROVED',
  created_at: '2024-04-25T06:00:00',
  users: { name: 'John Doe' }
}
```

### Payment Object
```js
{
  id: 'uuid',
  team_id: 'uuid',
  event_id: 'uuid',
  user_id: 'uuid',
  amount: 250,
  status: 'PENDING',
  created_at: '2024-04-25T06:00:00'
}
```

---

Xem thêm trong `src/lib/api.js` để có cách sử dụng chi tiết hơn
