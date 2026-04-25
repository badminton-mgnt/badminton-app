-- Create Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'sub_admin', 'admin')),
  created_at TIMESTAMP DEFAULT now()
);

-- Create Teams Table
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(trim(name)) between 1 and 20),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  treasurer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE team_deletion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID,
  team_name TEXT NOT NULL,
  deleted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  deleted_at TIMESTAMP DEFAULT now()
);

-- Create Team Members Table
CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(team_id, email)
);

-- Create Events Table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  location TEXT,
  court_number INTEGER,
  status TEXT DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED', 'FINALIZED', 'CANCELLED')),
  expenses_closed_at TIMESTAMP,
  expenses_closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Create Event Participants Table
CREATE TABLE event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMP,
  checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(event_id, user_id)
);

-- Create Event Match Scores Table
CREATE TABLE event_match_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('SINGLES', 'DOUBLES')),
  team_a_player_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_a_player_2 UUID REFERENCES users(id) ON DELETE CASCADE,
  team_b_player_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_b_player_2 UUID REFERENCES users(id) ON DELETE CASCADE,
  team_a_score INTEGER NOT NULL DEFAULT 0 CHECK (team_a_score >= 0),
  team_b_score INTEGER NOT NULL DEFAULT 0 CHECK (team_b_score >= 0),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now()
);

-- Create Expenses Table
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Create Payment Info Table
CREATE TABLE payment_info (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  qr_url TEXT,
  updated_at TIMESTAMP DEFAULT now()
);

-- Create Payment Transfers Table
CREATE TABLE payment_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('TO_TREASURY', 'FROM_TREASURY')),
  status TEXT DEFAULT 'WAITING_CONFIRM' CHECK (status IN ('WAITING_CONFIRM', 'CONFIRMED')),
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS (Row Level Security)

-- =====================================================
-- 0. WIPE ALL POLICIES (SAFE RESET)
-- =====================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =====================================================
-- 1. ENABLE RLS ALL TABLES
-- =====================================================

alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_deletion_logs enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.events enable row level security;
alter table public.expenses enable row level security;
alter table public.payment_transfers enable row level security;
alter table public.payment_info enable row level security;
alter table public.event_participants enable row level security;
alter table public.event_match_scores enable row level security;
alter table public.event_participants add column if not exists checked_in_by uuid references public.users(id) on delete set null;
alter table public.events add column if not exists expenses_closed_at timestamp;
alter table public.events add column if not exists expenses_closed_by uuid references public.users(id) on delete set null;


-- =====================================================
-- 2. USERS (AUTH PROFILE)
-- =====================================================

drop policy if exists "select own profile" on public.users;
drop policy if exists "select app users" on public.users;
drop policy if exists "update own profile" on public.users;
drop policy if exists "admin update profiles" on public.users;
drop policy if exists "admin delete profiles" on public.users;
drop policy if exists "insert own profile" on public.users;

create policy "select app users"
on public.users
for select
to authenticated
using (true);

create policy "update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "admin update profiles"
on public.users
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);


-- =====================================================
-- 11. EVENT MATCH SCORES
-- =====================================================

drop policy if exists "view event match scores" on public.event_match_scores;
drop policy if exists "create event match scores" on public.event_match_scores;

create policy "view event match scores"
on public.event_match_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = event_match_scores.team_id
      and tm.user_id = auth.uid()
  )
);

create policy "create event match scores"
on public.event_match_scores
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.team_members tm
    where tm.team_id = event_match_scores.team_id
      and tm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.events e
    where e.id = event_match_scores.event_id
      and e.team_id = event_match_scores.team_id
  )
);

create policy "admin delete profiles"
on public.users
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);

create policy "insert own profile"
on public.users
for insert
to authenticated
with check (auth.uid() = id);


-- =====================================================
-- 3. TEAMS (FIX CREATED_BY AUTO + NO ISSUES)
-- =====================================================

alter table public.teams
alter column created_by set default auth.uid();

drop policy if exists "create team" on public.teams;
drop policy if exists "view teams" on public.teams;
drop policy if exists "update team as admin" on public.teams;
drop policy if exists "delete team as admin" on public.teams;

create policy "create team"
on public.teams
for insert
to authenticated
with check (created_by = auth.uid());

create policy "view teams"
on public.teams
for select
to authenticated
using (true);

create policy "update team as admin"
on public.teams
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role in ('admin', 'sub_admin')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role in ('admin', 'sub_admin')
  )
);

create policy "delete team as admin"
on public.teams
for delete
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);


-- =====================================================
-- 3B. TEAM DELETION LOGS
-- =====================================================

drop policy if exists "admin view team deletion logs" on public.team_deletion_logs;

create policy "admin view team deletion logs"
on public.team_deletion_logs
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);


-- =====================================================
-- 4. TEAM MEMBERS (NO RECURSION SAFE VERSION)
-- =====================================================

drop policy if exists "view team members" on public.team_members;
drop policy if exists "join or add team members" on public.team_members;
drop policy if exists "leave own team" on public.team_members;
drop policy if exists "self join team" on public.team_members;
drop policy if exists "admin manage members" on public.team_members;
drop policy if exists "admin remove team members" on public.team_members;
drop policy if exists "view own memberships" on public.team_members;

create policy "view team members"
on public.team_members
for select
to authenticated
using (true);

create policy "join or add team members"
on public.team_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(coalesce(u.role, '')) in ('admin', 'sub_admin')
  )
);

create policy "leave own team"
on public.team_members
for delete
to authenticated
using (
  user_id = auth.uid()
);

create policy "admin remove team members"
on public.team_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);


-- =====================================================
-- 4B. TEAM INVITATIONS
-- =====================================================

drop policy if exists "admin view team invitations" on public.team_invitations;
drop policy if exists "admin create team invitations" on public.team_invitations;
drop policy if exists "admin delete team invitations" on public.team_invitations;

create policy "admin view team invitations"
on public.team_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);

create policy "admin create team invitations"
on public.team_invitations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);

create policy "admin delete team invitations"
on public.team_invitations
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
    and u.role = 'admin'
  )
);


-- =====================================================
-- 5. EVENTS
-- =====================================================

drop policy if exists "view team events" on public.events;
drop policy if exists "create event" on public.events;
drop policy if exists "update event" on public.events;
drop policy if exists "delete event manager" on public.events;

create policy "view team events"
on public.events
for select
to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = events.team_id
    and tm.user_id = auth.uid()
  )
);

create policy "create event admin"
on public.events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = events.team_id
      and tm.user_id = auth.uid()
  )
);

create policy "update event admin"
on public.events
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role in ('admin', 'sub_admin')
  )
  or exists (
    select 1 from public.teams t
    where t.id = events.team_id
    and t.treasurer_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role in ('admin', 'sub_admin')
  )
  or (
    exists (
      select 1 from public.teams t
      where t.id = events.team_id
      and t.treasurer_id = auth.uid()
    )
    and upper(coalesce(status, 'UPCOMING')) in ('FINALIZED', 'COMPLETED')
  )
);

create policy "delete event manager"
on public.events
for delete
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and lower(coalesce(u.role, '')) in ('admin', 'sub_admin')
  )
);


-- =====================================================
-- 6. EXPENSES
-- =====================================================

drop policy if exists "view expenses" on public.expenses;
drop policy if exists "add expense" on public.expenses;
drop policy if exists "approve expense" on public.expenses;

create policy "view expenses"
on public.expenses
for select
to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = expenses.team_id
    and tm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and lower(coalesce(u.role, '')) in ('admin', 'sub_admin')
  )
);

create policy "add expense"
on public.expenses
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = expenses.team_id
    and tm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.events e
    where e.id = expenses.event_id
      and e.team_id = expenses.team_id
      and upper(coalesce(e.status, 'UPCOMING')) in ('FINALIZED', 'COMPLETED')
      and e.expenses_closed_at is null
  )
);

create policy "approve expense"
on public.expenses
for update
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
    and u.role in ('admin', 'sub_admin')
  )
  or exists (
    select 1
    from public.teams t
    where t.id = expenses.team_id
      and t.treasurer_id = auth.uid()
  )
);


-- =====================================================
-- 8. PAYMENT TRANSFERS
-- =====================================================

drop policy if exists "view payment transfers" on public.payment_transfers;
drop policy if exists "create payment transfers" on public.payment_transfers;
drop policy if exists "confirm incoming transfer" on public.payment_transfers;

create policy "view payment transfers"
on public.payment_transfers
for select
to authenticated
using (
  exists (
    select 1 from public.team_members tm
    where tm.team_id = payment_transfers.team_id
    and tm.user_id = auth.uid()
  )
);

create policy "create payment transfers"
on public.payment_transfers
for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and exists (
    select 1 from public.team_members tm
    where tm.team_id = payment_transfers.team_id
    and tm.user_id = auth.uid()
  )
);

create policy "confirm incoming transfer"
on public.payment_transfers
for update
to authenticated
using (
  to_user_id = auth.uid()
)
with check (
  to_user_id = auth.uid()
  and status = 'CONFIRMED'
  and confirmed_at is not null
);

create or replace function public.restrict_payment_transfer_confirmation_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if new.id <> old.id
    or new.team_id <> old.team_id
    or new.event_id <> old.event_id
    or new.from_user_id <> old.from_user_id
    or new.to_user_id <> old.to_user_id
    or new.created_at <> old.created_at then
    raise exception 'Core transfer fields cannot be updated';
  end if;

  if old.from_user_id = auth.uid() and old.to_user_id = auth.uid() then
    if new.status <> 'CONFIRMED' then
      raise exception 'Self treasury transfer must stay CONFIRMED';
    end if;

    new.confirmed_at := coalesce(new.confirmed_at, old.confirmed_at, now());
    return new;
  end if;

  if old.to_user_id <> auth.uid() then
    raise exception 'Only receiver can confirm transfer';
  end if;

  if new.amount <> old.amount
    or new.direction <> old.direction then
    raise exception 'Only transfer confirmation fields can be updated';
  end if;

  if new.status <> 'CONFIRMED' then
    raise exception 'Transfer status must be CONFIRMED';
  end if;

  if old.status = 'CONFIRMED' then
    raise exception 'Transfer already confirmed';
  end if;

  new.confirmed_at := coalesce(new.confirmed_at, now());

  return new;
end;
$$;

drop trigger if exists trg_restrict_payment_transfer_confirmation_update on public.payment_transfers;

create trigger trg_restrict_payment_transfer_confirmation_update
before update on public.payment_transfers
for each row
execute function public.restrict_payment_transfer_confirmation_update();


-- =====================================================
-- 9. PAYMENT INFO (FIX YOUR ERROR HERE)
-- =====================================================

drop policy if exists "view payment info" on public.payment_info;
drop policy if exists "view own payment info" on public.payment_info;
drop policy if exists "insert payment info" on public.payment_info;
drop policy if exists "update payment info" on public.payment_info;

create policy "view accessible payment info"
on public.payment_info
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.team_members tm_self
    join public.team_members tm_target
      on tm_target.team_id = tm_self.team_id
    where tm_self.user_id = auth.uid()
      and tm_target.user_id = payment_info.user_id
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'sub_admin')
  )
);

create policy "insert own payment info"
on public.payment_info
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "update own payment info"
on public.payment_info
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- =====================================================
-- 10. EVENT PARTICIPANTS
-- =====================================================

drop policy if exists "view participants" on public.event_participants;
drop policy if exists "self check-in" on public.event_participants;
drop policy if exists "update own check-in" on public.event_participants;
drop policy if exists "self or manager check-in" on public.event_participants;
drop policy if exists "update self or manager check-in" on public.event_participants;
drop policy if exists "admin remove participants" on public.event_participants;

create policy "view participants"
on public.event_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    join public.team_members tm on tm.team_id = e.team_id
    where e.id = event_participants.event_id
    and tm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(coalesce(u.role, '')) in ('admin', 'sub_admin')
  )
);

create policy "self or manager check-in"
on public.event_participants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    join public.team_members target_tm
      on target_tm.team_id = e.team_id
     and target_tm.user_id = event_participants.user_id
    where e.id = event_participants.event_id
      and upper(coalesce(e.status, 'UPCOMING')) not in ('FINALIZED', 'COMPLETED', 'CANCELLED')
      and exists (
        select 1
        from public.team_members actor_tm
        where actor_tm.team_id = e.team_id
          and actor_tm.user_id = auth.uid()
      )
  )
);

create policy "update self or manager check-in"
on public.event_participants
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    join public.team_members target_tm
      on target_tm.team_id = e.team_id
     and target_tm.user_id = event_participants.user_id
    where e.id = event_participants.event_id
      and upper(coalesce(e.status, 'UPCOMING')) not in ('FINALIZED', 'COMPLETED', 'CANCELLED')
      and exists (
        select 1
        from public.team_members actor_tm
        where actor_tm.team_id = e.team_id
          and actor_tm.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.events e
    join public.team_members target_tm
      on target_tm.team_id = e.team_id
     and target_tm.user_id = event_participants.user_id
    where e.id = event_participants.event_id
      and upper(coalesce(e.status, 'UPCOMING')) not in ('FINALIZED', 'COMPLETED', 'CANCELLED')
      and exists (
        select 1
        from public.team_members actor_tm
        where actor_tm.team_id = e.team_id
          and actor_tm.user_id = auth.uid()
      )
  )
);

create policy "admin remove participants"
on public.event_participants
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);


-- =====================================================
-- 10. TEAM DELETE RPC
-- =====================================================

create or replace function public.delete_team_with_reason(
  p_team_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_team_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Delete reason is required';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = v_user_id
    and u.role = 'admin'
  ) then
    raise exception 'Only admin users can delete teams';
  end if;

  select t.name
  into v_team_name
  from public.teams t
  where t.id = p_team_id;

  if v_team_name is null then
    raise exception 'Team not found';
  end if;

  insert into public.team_deletion_logs (team_id, team_name, deleted_by, reason)
  values (p_team_id, v_team_name, v_user_id, trim(p_reason));

  delete from public.teams
  where id = p_team_id;
end;
$$;

grant execute on function public.delete_team_with_reason(uuid, text) to authenticated;


-- =====================================================
-- 12. CRITICAL FIX (MANDATORY)
-- =====================================================

alter table public.users
add column if not exists role text not null default 'user'
check (role in ('user', 'sub_admin', 'admin'));

alter table public.team_members
drop column if exists role;

alter table public.teams
alter column created_by set default auth.uid();

alter table public.payment_info
alter column user_id set default auth.uid();

alter table public.event_participants
add column if not exists checked_in_at timestamp;

update public.event_participants
set checked_in_at = now()
where checked_in = true
  and checked_in_at is null;

alter table public.event_participants
drop constraint if exists event_participants_event_id_user_id_key;

alter table public.event_participants
add constraint event_participants_event_id_user_id_key
unique (event_id, user_id);

alter table public.expenses
add column if not exists approved_by uuid references public.users(id) on delete set null;

alter table public.expenses
add column if not exists approved_at timestamp;

create or replace function public.set_expense_approval_meta()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('APPROVED', 'REJECTED') then
    new.approved_by := coalesce(new.approved_by, auth.uid());
    new.approved_at := coalesce(new.approved_at, now());
  else
    new.approved_by := null;
    new.approved_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_expense_approval_meta on public.expenses;

create trigger trg_set_expense_approval_meta
before update on public.expenses
for each row
execute function public.set_expense_approval_meta();

alter table public.teams
drop constraint if exists teams_name_check;

alter table public.teams
add constraint teams_name_check
check (char_length(trim(name)) between 1 and 20);

alter table public.events
drop constraint if exists events_status_check;

alter table public.events
add constraint events_status_check
check (status in ('UPCOMING', 'ONGOING', 'COMPLETED', 'FINALIZED', 'CANCELLED'));

-- Create Indexes for better performance
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_deletion_logs_team_id ON team_deletion_logs(team_id);
CREATE INDEX idx_team_deletion_logs_deleted_by ON team_deletion_logs(deleted_by);
CREATE INDEX idx_events_team_id ON events(team_id);
CREATE INDEX idx_expenses_event_id ON expenses(event_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_event_match_scores_event_id ON event_match_scores(event_id);
CREATE INDEX idx_event_match_scores_team_id ON event_match_scores(team_id);
