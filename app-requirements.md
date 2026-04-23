Build a complete mobile-first web application called:
"Badminton Attendance & Expense App"
________________________________________
TECH STACK
•	Frontend: React (Vite)
•	Styling: Tailwind CSS
•	Animation: Framer Motion
•	Backend: Supabase (Auth, Database, Storage)
The app must be optimized for mobile usage (primary users use phones).
________________________________________
SUPABASE CONFIG
Use Supabase as backend.
Environment variables:
VITE_SUPABASE_URL = <INSERT_SUPABASE_URL>
VITE_SUPABASE_ANON_KEY = <INSERT_SUPABASE_ANON_KEY>
________________________________________
AUTHENTICATION
Implement:
•	Email + password signup
•	Email verification REQUIRED
•	Login / logout
•	Persist login session
________________________________________
SIGNUP FORM
Fields:
•	Full name
•	Email
•	Password
•	Confirm password
________________________________________
PASSWORD REQUIREMENTS
Password must:
•	Be at least 8 characters
•	Contain:
o	at least 1 uppercase letter
o	at least 1 lowercase letter
o	at least 1 number
o	at least 1 special character
Use regex:
/^(?=.[a-z])(?=.[A-Z])(?=.\d)(?=.[^A-Za-z\d]).{8,}$/
________________________________________
SIGNUP VALIDATION UX
•	Show checklist:
o	8+ characters
o	uppercase
o	lowercase
o	number
o	special char
•	Show real-time validation (tick each condition)
•	Confirm password must match
•	Disable signup button until valid
________________________________________
SIGNUP FLOW
•	Call Supabase signUp
•	Send verification email
•	Show screen: "Check your email"
________________________________________
LOGIN
•	Email
•	Password
If not verified:
Show: "Please verify your email before logging in"
________________________________________
FORGOT PASSWORD
•	Allow reset via email
________________________________________
USER ROLES
•	user
•	sub_admin
•	admin
________________________________________
ROLE PERMISSIONS
user:
•	Check-in
•	Add expense
•	Make payment
•	Setup payment info
sub_admin:
•	Create event
•	Approve/reject expense
•	Confirm payment
admin:
•	Full permissions
•	Assign roles
________________________________________
DATABASE TABLES
users:
•	id (uuid)
•	name
•	role
•	created_at
events:
•	id
•	title
•	date
•	location
•	court_number
•	status (UPCOMING, ONGOING, COMPLETED, FINALIZED)
•	created_by
•	created_at
event_participants:
•	id
•	event_id
•	user_id
•	checked_in
expenses:
•	id
•	event_id
•	user_id
•	amount
•	description
•	status (PENDING, APPROVED, REJECTED)
•	created_at
payments:
•	id
•	event_id
•	user_id
•	amount
•	status (PENDING, CONFIRMED)
•	created_at
payment_info:
•	user_id
•	bank_name
•	account_number
•	account_name
•	qr_url
________________________________________
CORE FEATURES
EVENT MANAGEMENT
•	Create event
•	Edit event
•	List events
•	Highlight today's event
________________________________________
CHECK-IN
•	User check-in
•	Admin check-in for users
•	Only checked-in users are counted
________________________________________
EXPENSE SYSTEM
•	User adds expense:
o	amount
o	description
•	Status:
o	PENDING
o	APPROVED
o	REJECTED
•	Only APPROVED expenses count
•	Admin/sub_admin:
o	approve/reject
________________________________________
SETTLEMENT
Calculate:
total_cost = sum(APPROVED expenses)
participants = checked-in users
share = total_cost / participants
balance = paid - share
Rules:
•	balance < 0 → user owes admin
•	balance > 0 → admin owes user
________________________________________
PAYMENT FLOW
User → Admin:
1.	Click "Pay"
2.	Show:
o	Admin QR code
o	Bank info
3.	User transfers outside
4.	Click "I have paid"
Status:
•	PENDING
•	CONFIRMED
Admin confirms
________________________________________
ADMIN PAYOUT (OPTIONAL)
•	Show users admin owes
•	Mark as paid
________________________________________
PAYMENT INFO
User sets:
•	bank_name
•	account_number
•	account_name
•	QR image
________________________________________
FINALIZE EVENT
•	Admin locks event
After finalize:
•	No editing
•	No check-in
•	Only payment allowed
________________________________________
UI / UX DESIGN
THEME
•	Green gradient (badminton court style)
•	Clean white background
•	Card-based UI
Gradient:
linear-gradient(135deg, #43A047, #66BB6A)
________________________________________
TYPOGRAPHY
•	Font: Inter
•	Money: large + bold
•	Labels: small gray
________________________________________
LAYOUT
Bottom navigation:
•	Home
•	Events
•	Me
________________________________________
HOME SCREEN
•	Payment status (MOST IMPORTANT)
•	Today's event
•	Upcoming events
________________________________________
EVENT DETAIL
•	Event info
•	Participants
•	Expenses
•	Settlement
________________________________________
PAYMENT MODAL
•	Bottom sheet
•	QR centered
•	Bank info
•	Copy button
•	Confirm button
________________________________________
STATUS BADGES
Use pill badges:
•	pending → yellow
•	confirmed → green
•	unpaid → red
•	rejected → red
________________________________________
ANIMATIONS
Use Framer Motion:
•	Page slide
•	Bottom sheet modal
•	Button press scale
•	Success animation
________________________________________
UX RULES
•	No manual payment amount input
•	Prevent duplicate payment
•	Highlight:
o	debt (red)
o	pending (yellow)
o	success (green)
________________________________________
SECURITY
Use Supabase RLS:
•	Users only modify their own data
•	Only admin assigns roles
•	Only admin/sub_admin approve
________________________________________
DEPLOYMENT
•	Frontend: GitHub Pages
•	Backend: Supabase
________________________________________
OUTPUT REQUIREMENTS
Generate:
•	Full React app
•	Supabase integration
•	Reusable components:
o	Button
o	Card
o	Badge
o	Modal
•	Pages:
o	Login / Register
o	Home
o	Events
o	Event detail
o	Profile
•	Mobile responsive UI
•	Clean modern design
________________________________________
IMPORTANT
•	Keep UI simple and smooth
•	Focus on mobile UX
•	Avoid over-engineering
•	Code should be clean and scalable
________________________________________
TEAM FEATURE
The app must support teams.
________________________________________
TEAM SYSTEM
•	Admin can create a team
•	Users can join a team
•	Each team contains:
o	members
o	events
o	expenses
o	payments
________________________________________
DATABASE
Add tables:
teams:
•	id
•	name
•	created_by
•	created_at
team_members:
•	id
•	team_id
•	user_id
•	role (user/sub_admin/admin)
•	joined_at
________________________________________
RELATIONSHIPS
•	events must belong to a team
•	expenses must belong to a team
•	payments must belong to a team
________________________________________
RULES
•	Users can only access data within their team
•	Roles are team-based
•	Admin manages members within a team
________________________________________
UI
•	Show current team at top
•	Allow switching teams (optional)
•	Team management screen:
o	member list
o	role assignment
________________________________________
END TEAM FEATURE

DESIGN SYSTEM (IMPORTANT - FOLLOW STRICTLY)
The UI must feel modern, clean, and smooth, inspired by fintech and mobile apps.
________________________________________
COLOR SYSTEM (Badminton Theme)
Primary (Green - badminton court):
•	Primary: #43A047
•	Primary Light: #66BB6A
•	Primary Dark: #2E7D32
Gradient:
background: linear-gradient(135deg, #43A047, #66BB6A)
________________________________________
SECONDARY COLORS
•	Background: #F9FAFB (light gray)
•	Card: #FFFFFF
•	Border: #E5E7EB
________________________________________
STATUS COLORS
Success (paid / approved):
•	bg: #DCFCE7
•	text: #166534
Warning (pending):
•	bg: #FEF3C7
•	text: #92400E
Error (unpaid / rejected):
•	bg: #FEE2E2
•	text: #B91C1C
Neutral:
•	text: #6B7280
________________________________________
TYPOGRAPHY
•	Font: Inter
•	Title: font-semibold, text-lg
•	Body: text-sm
•	Money:
o	large (text-xl or text-2xl)
o	bold
o	green color
________________________________________
COMPONENT STYLE
Cards
•	background: white
•	border-radius: 16px
•	padding: 16px
•	box-shadow: subtle (shadow-md)
________________________________________
Buttons
Primary button:
•	bg: green gradient
•	text: white
•	border-radius: 12px
•	height: 44px
Pressed effect:
•	scale: 0.96
________________________________________
Inputs
•	rounded-xl
•	border: gray-300
•	focus: green border
•	padding: 12px
________________________________________
Status Badge
•	pill shape (rounded-full)
•	padding: 4px 10px
•	font-size: 12px
•	font-weight: 600
________________________________________
ICON STYLE
•	Use simple outline icons
•	Keep consistent size (16px–20px)
________________________________________
LAYOUT RULES
•	Max width mobile: 480px
•	Center content
•	Use spacing system:
o	gap: 8 / 12 / 16 / 20
•	Sticky bottom navigation
________________________________________
ANIMATION (VERY IMPORTANT)
Use Framer Motion for smooth UX.
________________________________________
PAGE TRANSITION
•	Slide from right
•	duration: 0.25s
•	ease: easeInOut
________________________________________
MODAL (Bottom Sheet)
•	Slide up from bottom
•	backdrop fade in
•	rounded top corners (20px)
________________________________________
BUTTON PRESS
•	scale down to 0.96
•	quick (0.1s)
________________________________________
SUCCESS FEEDBACK
•	fade in
•	show checkmark icon
•	slight bounce
________________________________________
LIST ITEM
•	fade + slide up (small)
•	stagger animation
________________________________________
UX DETAILS
•	Always show loading spinner when fetching
•	Use skeleton loading for lists
•	Disable buttons when processing
•	Show clear empty states:
o	"No events yet"
o	"No expenses"
________________________________________
VISUAL STYLE GOAL
The app should feel like:
•	a modern fintech app
•	smooth like iOS apps
•	clean, minimal, and fast
Avoid:
•	heavy UI
•	too many colors
•	cluttered layout
________________________________________
END DESIGN SYSTEM
DATABASE TABLE CREATED
1.1 USERS
create table users (
  id uuid primary key,
  name text,
  created_at timestamp default now()
);
________________________________________
1.2 TEAMS
create table teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid,
  created_at timestamp default now()
);
________________________________________
1.3 TEAM MEMBERS (cốt lõi multi-team)
create table team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text default 'user',
  joined_at timestamp default now()
);
________________________________________
1.4 EVENTS
create table events (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id) on delete cascade,
  title text,
  date timestamp,
  location text,
  court_number int,
  status text default 'UPCOMING',
  created_by uuid,
  created_at timestamp default now()
);
________________________________________
1.5 EVENT PARTICIPANTS
create table event_participants (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  user_id uuid references users(id),
  checked_in boolean default false
);
________________________________________
1.6 EXPENSES
create table expenses (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id),
  event_id uuid references events(id),
  user_id uuid references users(id),
  amount numeric,
  description text,
  status text default 'PENDING',
  created_at timestamp default now()
);
________________________________________
1.7 PAYMENTS
create table payments (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id),
  event_id uuid references events(id),
  user_id uuid references users(id),
  amount numeric,
  status text default 'PENDING',
  created_at timestamp default now()
);
________________________________________
1.8 PAYMENT INFO
create table payment_info (
  user_id uuid primary key,
  bank_name text,
  account_number text,
  account_name text,
  qr_url text
);
________________________________________
2. BẬT AUTH (LOGIN EMAIL)
Trong Supabase:
👉 Authentication → Providers → Email
✔ Enable Email Auth
________________________________________
3. IMPORTANT: LINK AUTH → USERS TABLE
Bạn cần sync user sau khi signup.
👉 Cách đơn giản:

END

