-- =============================================================
-- ADARSH AVASIYA SCHOOL ERP - DATABASE
-- Run this file in Supabase SQL Editor.
-- Safe design: fee structure != student charge != payment.
-- =============================================================
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin' check (role in ('admin','accountant')),
  created_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  start_date date,
  end_date date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.family_groups (
  id uuid primary key default gen_random_uuid(),
  family_code text unique not null,
  parent_phone text not null,
  parent_name text,
  confirmed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_family_phone on public.family_groups(parent_phone);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text unique not null,
  name text not null,
  class_name text not null,
  section text not null default 'A',
  parent_name text,
  parent_phone text,
  parent_email text,
  address text,
  area text,
  family_group_id uuid references public.family_groups(id) on delete set null,
  hostel_required boolean not null default false,
  vehicle_required boolean not null default false,
  vehicle_area text,
  student_status text not null default 'active' check (student_status in ('active','left','transferred','graduated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_students_admission on public.students(admission_no);
create index if not exists idx_students_name on public.students(name);
create index if not exists idx_students_class on public.students(class_name);
create index if not exists idx_students_phone on public.students(parent_phone);

create table if not exists public.fee_heads (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text not null check (category in ('school','vehicle','hostel','admission','readmission','books','uniform','festival','examination','event','other')),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  class_name text,
  fee_head_id uuid not null references public.fee_heads(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null check (frequency in ('Annual','Monthly','Quarterly','One-time')),
  hostel_only boolean not null default false,
  vehicle_area text,
  applicable_to text not null default 'class' check (applicable_to in ('class','hosteller','vehicle_area','all')),
  created_at timestamptz not null default now()
);
create index if not exists idx_fee_structure_session on public.fee_structures(academic_year_id);

create table if not exists public.collection_accounts (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  account_type text not null check (account_type in ('principal','vice_principal','director','custom')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_charges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  fee_head_id uuid references public.fee_heads(id) on delete set null,
  charge_name text not null,
  charge_type text not null check (charge_type in ('monthly','annual','one_time','miscellaneous','back_due','adjustment')),
  period_month date,
  due_date date,
  amount numeric(12,2) not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_charges_student on public.student_charges(student_id);
create index if not exists idx_charges_session on public.student_charges(academic_year_id);
create index if not exists idx_charges_month on public.student_charges(period_month);

create table if not exists public.charge_components (
  id uuid primary key default gen_random_uuid(),
  student_charge_id uuid not null references public.student_charges(id) on delete cascade,
  fee_head_id uuid references public.fee_heads(id) on delete set null,
  component_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.fee_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  student_charge_id uuid references public.student_charges(id) on delete set null,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  adjustment_type text not null check (adjustment_type in ('discount','waiver','correction','special_rate')),
  amount numeric(12,2) not null check (amount >= 0),
  reason text not null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('cash','upi')),
  collection_account_id uuid references public.collection_accounts(id) on delete set null,
  collector_name text,
  paid_at timestamptz not null default now(),
  receipt_no text unique default ('RCPT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  receipt_generated boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_payments_date on public.payments(paid_at);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  student_charge_id uuid not null references public.student_charges(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique(payment_id, student_charge_id)
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'General',
  attachment_url text,
  published boolean not null default false,
  published_at timestamptz,
  expiry_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================
-- DEFAULT DATA
-- =============================================================
insert into public.academic_years(name,is_active,start_date,end_date)
values ('2026-27',true,'2026-04-01','2027-03-31')
on conflict(name) do update set is_active=true;

insert into public.fee_heads(name,category) values
('School Fee','school'),
('Vehicle Fee','vehicle'),
('Hostel Fee','hostel'),
('Admission Charge','admission'),
('Re-admission Charge','readmission'),
('Book Payment','books'),
('Tie & Belt Charge','uniform'),
('Republic Day Charge','festival'),
('Independence Day Charge','festival'),
('Saraswati Puja Charge','festival')
on conflict(name) do nothing;

insert into public.collection_accounts(name,account_type) values
('Principal','principal'),('Vice Principal','vice_principal'),('Director','director')
on conflict(name) do nothing;

-- =============================================================
-- SECURITY HELPERS
-- =============================================================
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','accountant')); $$;

-- =============================================================
-- PAYMENT RPC
-- Creates one payment and allocates it oldest-due-first.
-- Allocation is based on remaining charge balance.
-- =============================================================
create or replace function public.record_payment(
  p_student_id uuid,
  p_academic_year_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_collector_name text,
  p_notes text default null
)
returns public.payments
language plpgsql
security definer
set search_path=public
as $$
declare
  v_payment public.payments;
  v_remaining numeric := p_amount;
  v_paid numeric;
  v_balance numeric;
  c record;
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_payment_mode not in ('cash','upi') then raise exception 'Invalid payment mode'; end if;

  insert into public.payments(student_id,academic_year_id,amount,payment_mode,collector_name,notes,created_by)
  values(p_student_id,p_academic_year_id,p_amount,p_payment_mode,p_collector_name,p_notes,auth.uid())
  returning * into v_payment;

  -- Only allocate against charges that are in the selected session.
  for c in
    select sc.id, sc.amount, sc.created_at, coalesce(sum(pa.amount),0) allocated
    from public.student_charges sc
    left join public.payment_allocations pa on pa.student_charge_id=sc.id
    where sc.student_id=p_student_id and sc.academic_year_id=p_academic_year_id
    group by sc.id
    having sc.amount - coalesce(sum(pa.amount),0) > 0
    order by coalesce(sc.due_date, '9999-12-31'::date), sc.created_at, sc.id
  loop
    exit when v_remaining <= 0;
    v_balance := c.amount - c.allocated;
    v_paid := least(v_remaining,v_balance);
    insert into public.payment_allocations(payment_id,student_charge_id,amount)
    values(v_payment.id,c.id,v_paid);
    v_remaining := v_remaining - v_paid;
  end loop;

  -- A payment cannot exceed charges currently available in the selected session.
  if v_remaining > 0 then
    delete from public.payments where id=v_payment.id;
    raise exception 'Payment exceeds outstanding charges in the selected session by %', v_remaining;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'payment_created','payment',v_payment.id,jsonb_build_object('student_id',p_student_id,'amount',p_amount,'mode',p_payment_mode,'collector',p_collector_name));

  return v_payment;
end;
$$;

-- =============================================================
-- RLS
-- =============================================================
alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.family_groups enable row level security;
alter table public.students enable row level security;
alter table public.fee_heads enable row level security;
alter table public.fee_structures enable row level security;
alter table public.collection_accounts enable row level security;
alter table public.student_charges enable row level security;
alter table public.charge_components enable row level security;
alter table public.fee_adjustments enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.notices enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_self_or_staff on public.profiles;
create policy profiles_self_or_staff on public.profiles for select to authenticated using(id=auth.uid() or public.is_staff());

drop policy if exists staff_all_academic on public.academic_years;
create policy staff_all_academic on public.academic_years for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_family on public.family_groups;
create policy staff_all_family on public.family_groups for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_students on public.students;
create policy staff_all_students on public.students for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_heads on public.fee_heads;
create policy staff_all_heads on public.fee_heads for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_structures on public.fee_structures;
create policy staff_all_structures on public.fee_structures for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_accounts on public.collection_accounts;
create policy staff_all_accounts on public.collection_accounts for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_charges on public.student_charges;
create policy staff_all_charges on public.student_charges for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_components on public.charge_components;
create policy staff_all_components on public.charge_components for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_adjustments on public.fee_adjustments;
create policy staff_all_adjustments on public.fee_adjustments for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_payments on public.payments;
create policy staff_all_payments on public.payments for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_allocations on public.payment_allocations;
create policy staff_all_allocations on public.payment_allocations for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists public_notices_read on public.notices;
create policy public_notices_read on public.notices for select to anon,authenticated using(published=true and (expiry_date is null or expiry_date>=current_date));
drop policy if exists staff_all_notices on public.notices;
create policy staff_all_notices on public.notices for all to authenticated using(public.is_staff()) with check(public.is_staff());

drop policy if exists staff_all_audit on public.audit_logs;
create policy staff_all_audit on public.audit_logs for all to authenticated using(public.is_staff()) with check(public.is_staff());

-- =============================================================
-- ADMIN PROFILE SETUP EXAMPLE
-- Replace AUTH_USER_UUID with the UUID shown in Authentication -> Users.
-- =============================================================
-- insert into public.profiles(id,full_name,role)
-- values('AUTH_USER_UUID','School Admin','admin')
-- on conflict(id) do update set full_name=excluded.full_name,role=excluded.role;

-- =============================================================
-- MONTHLY CHARGE GENERATOR
-- Creates ONE monthly student charge with multiple components.
-- For vehicle students: School + Vehicle is one combined charge.
-- For hostellers: Hostel is also added as a component.
-- =============================================================
create or replace function public.generate_monthly_charge(
  p_student_id uuid,
  p_academic_year_id uuid,
  p_month date
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.students;
  v_charge_id uuid;
  v_school numeric := 0;
  v_vehicle numeric := 0;
  v_hostel numeric := 0;
  v_total numeric := 0;
  v_existing uuid;
  r record;
begin
  if not public.is_staff() then raise exception 'Not authorized'; end if;
  select * into s from public.students where id=p_student_id;
  if not found then raise exception 'Student not found'; end if;

  select coalesce(sum(fs.amount),0) into v_school
  from public.fee_structures fs
  join public.fee_heads fh on fh.id=fs.fee_head_id
  where fs.academic_year_id=p_academic_year_id
    and fh.category='school'
    and fs.frequency='Monthly'
    and (fs.class_name is null or lower(fs.class_name)=lower(s.class_name))
    and fs.applicable_to in ('class','all');

  if s.vehicle_required then
    select coalesce(sum(fs.amount),0) into v_vehicle
    from public.fee_structures fs
    join public.fee_heads fh on fh.id=fs.fee_head_id
    where fs.academic_year_id=p_academic_year_id
      and fh.category='vehicle'
      and fs.frequency='Monthly'
      and (fs.vehicle_area is null or lower(fs.vehicle_area)=lower(coalesce(s.vehicle_area,'')))
      and fs.applicable_to in ('vehicle_area','all');
  end if;

  if s.hostel_required then
    select coalesce(sum(fs.amount),0) into v_hostel
    from public.fee_structures fs
    join public.fee_heads fh on fh.id=fs.fee_head_id
    where fs.academic_year_id=p_academic_year_id
      and fh.category='hostel'
      and fs.frequency='Monthly'
      and (fs.class_name is null or lower(fs.class_name)=lower(s.class_name))
      and fs.applicable_to in ('hosteller','all','class');
  end if;

  v_total := v_school + v_vehicle + v_hostel;
  if v_total <= 0 then raise exception 'No monthly fee structure found for this student'; end if;

  select id into v_existing from public.student_charges
  where student_id=p_student_id and academic_year_id=p_academic_year_id
    and charge_type='monthly' and period_month=date_trunc('month',p_month)::date
  limit 1;
  if v_existing is not null then return v_existing; end if;

  insert into public.student_charges(student_id,academic_year_id,charge_name,charge_type,period_month,due_date,amount,notes)
  values(p_student_id,p_academic_year_id,'Monthly School Fee', 'monthly',date_trunc('month',p_month)::date,date_trunc('month',p_month)::date,v_total,'Generated from fee structure')
  returning id into v_charge_id;

  if v_school>0 then
    select id into r from public.fee_heads where category='school' order by name limit 1;
    insert into public.charge_components(student_charge_id,fee_head_id,component_name,amount) values(v_charge_id,r.id,'School Fee',v_school);
  end if;
  if v_vehicle>0 then
    select id into r from public.fee_heads where category='vehicle' order by name limit 1;
    insert into public.charge_components(student_charge_id,fee_head_id,component_name,amount) values(v_charge_id,r.id,'Vehicle Fee',v_vehicle);
  end if;
  if v_hostel>0 then
    select id into r from public.fee_heads where category='hostel' order by name limit 1;
    insert into public.charge_components(student_charge_id,fee_head_id,component_name,amount) values(v_charge_id,r.id,'Hostel Fee',v_hostel);
  end if;

  return v_charge_id;
end;
$$;
