create type public.app_role as enum ('superadmin','admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'superadmin'));

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  owner text not null default '',
  tagline text not null default '',
  image_key text not null default 'hero',
  created_at timestamptz not null default now()
);
create table public.program_admins (
  user_id uuid not null,
  program_id uuid not null references public.programs(id) on delete cascade,
  email text not null default '',
  primary key (user_id, program_id)
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  description text not null default '',
  date timestamptz not null,
  venue text not null default 'TBA',
  city text not null default 'Nairobi',
  lineup text[] not null default '{}',
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  quantity int not null default 100,
  sold int not null default 0,
  sales_end_at timestamptz not null,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.price_phases (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.ticket_tiers(id) on delete cascade,
  label text not null,
  price int not null,
  starts_at timestamptz not null
);
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  kind text not null default 'news',
  event_id uuid references public.events(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  status text not null default 'pending',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create table public.organizer_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text not null default '',
  email text not null,
  phone text not null default '',
  event_type text not null default '',
  message text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create table public.automation_state (
  id int primary key default 1,
  last_ai_post_at timestamptz,
  paused_reason text,
  locked_until timestamptz
);
insert into public.automation_state (id) values (1);

grant select on public.programs, public.events, public.ticket_tiers, public.price_phases, public.posts to anon;
grant select, insert, update, delete on public.programs, public.program_admins, public.events, public.ticket_tiers, public.price_phases, public.posts, public.organizer_applications to authenticated;
grant insert on public.organizer_applications to anon;
grant all on public.programs, public.program_admins, public.events, public.ticket_tiers, public.price_phases, public.posts, public.organizer_applications, public.automation_state to service_role;

alter table public.programs enable row level security;
alter table public.program_admins enable row level security;
alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;
alter table public.price_phases enable row level security;
alter table public.posts enable row level security;
alter table public.organizer_applications enable row level security;
alter table public.automation_state enable row level security;

create or replace function public.can_manage_program(_program_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'superadmin')
    or exists (select 1 from public.program_admins where user_id = auth.uid() and program_id = _program_id)
$$;
create or replace function public.event_program(_event_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select program_id from public.events where id = _event_id
$$;
create or replace function public.tier_program(_tier_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select e.program_id from public.ticket_tiers t join public.events e on e.id = t.event_id where t.id = _tier_id
$$;

-- programs
create policy "programs public read" on public.programs for select to anon, authenticated using (true);
create policy "programs superadmin write" on public.programs for all to authenticated
  using (public.has_role(auth.uid(),'superadmin')) with check (public.has_role(auth.uid(),'superadmin'));
create policy "programs admin update" on public.programs for update to authenticated
  using (public.can_manage_program(id)) with check (public.can_manage_program(id));
-- program_admins
create policy "pa read" on public.program_admins for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'superadmin'));
create policy "pa superadmin write" on public.program_admins for all to authenticated
  using (public.has_role(auth.uid(),'superadmin')) with check (public.has_role(auth.uid(),'superadmin'));
-- events
create policy "events public read" on public.events for select to anon, authenticated
  using (published or public.can_manage_program(program_id));
create policy "events manage" on public.events for all to authenticated
  using (public.can_manage_program(program_id)) with check (public.can_manage_program(program_id));
-- tiers
create policy "tiers public read" on public.ticket_tiers for select to anon, authenticated using (true);
create policy "tiers manage" on public.ticket_tiers for all to authenticated
  using (public.can_manage_program(public.event_program(event_id))) with check (public.can_manage_program(public.event_program(event_id)));
-- phases
create policy "phases public read" on public.price_phases for select to anon, authenticated using (true);
create policy "phases manage" on public.price_phases for all to authenticated
  using (public.can_manage_program(public.tier_program(tier_id))) with check (public.can_manage_program(public.tier_program(tier_id)));
-- posts
create policy "posts public read" on public.posts for select to anon, authenticated
  using (status = 'published' or public.has_role(auth.uid(),'superadmin'));
create policy "posts superadmin write" on public.posts for all to authenticated
  using (public.has_role(auth.uid(),'superadmin')) with check (public.has_role(auth.uid(),'superadmin'));
-- applications
create policy "apply anyone" on public.organizer_applications for insert to anon, authenticated with check (status = 'new');
create policy "apps superadmin read" on public.organizer_applications for select to authenticated using (public.has_role(auth.uid(),'superadmin'));
create policy "apps superadmin update" on public.organizer_applications for update to authenticated using (public.has_role(auth.uid(),'superadmin'));
create policy "apps superadmin delete" on public.organizer_applications for delete to authenticated using (public.has_role(auth.uid(),'superadmin'));

-- seed
insert into public.programs (id, slug, name, owner, tagline, image_key) values
 ('11111111-0000-0000-0000-000000000001','kutit-culture','Kutit Culture','Kalenjin Music Platform','Beats, beads & heritage — the Kalenjin culture festival.','kutit'),
 ('11111111-0000-0000-0000-000000000002','simbafest','SimbaFest','Simba Collective','Roar louder. Kenya''s biggest outdoor music experience.','simba'),
 ('11111111-0000-0000-0000-000000000003','kalee-nights','Kalee Nights','Kalee Nation','Club hosting tours — Eldoret, Nakuru, Nairobi.','hero');

insert into public.events (id, program_id, title, description, date, venue, city, lineup) values
 ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Kutit Culture Festival 2026','A full day of Kalenjin music, dance, food and fashion.','2026-12-12T12:00:00+03:00','Carnivore Grounds','Nairobi',array['Vicky Brilliance','Zona Lastborn','MC Brobox','DJ Sutai']),
 ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','SimbaFest Eldoret','Open-air festival with the biggest names in Kenyan music.','2026-11-28T15:00:00+03:00','Eldoret Sports Club','Eldoret',array['DJ Festone','Sweetstar','Kipsang','MC Dinnez']),
 ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','Kalee Nation Experience','The signature Kalee club night.','2026-11-07T18:00:00+03:00','The Embassy Bistro','Eldoret',array['DJ Sutai','Brobox','Vicky Brilliance']);

insert into public.ticket_tiers (id, event_id, name, quantity, sold, sales_end_at) values
 ('33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','Regular',5000,3120,'2026-12-12T18:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000001','VIP',600,412,'2026-12-11T23:59:00+03:00'),
 ('33333333-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000002','General',8000,5210,'2026-11-28T20:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000002','Couple',400,400,'2026-11-27T23:59:00+03:00'),
 ('33333333-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000003','Entry',1200,380,'2026-11-07T22:00:00+03:00');

insert into public.price_phases (tier_id, label, price, starts_at) values
 ('33333333-0000-0000-0000-000000000001','Early Bird',1000,'2026-10-01T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000001','Advance',1500,'2026-11-15T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000001','Gate',2000,'2026-12-12T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000002','Early Bird',3500,'2026-10-01T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000002','Advance',5000,'2026-11-15T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000003','Phase 1',800,'2026-10-10T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000003','Phase 2',1200,'2026-11-10T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000004','Standard',2000,'2026-10-10T00:00:00+03:00'),
 ('33333333-0000-0000-0000-000000000005','Standard',650,'2026-10-01T00:00:00+03:00');

insert into public.posts (slug, title, excerpt, body, kind, event_id, status, source, published_at) values
 ('kutit-culture-2026-lineup','Kutit Culture 2026 lineup revealed','Vicky Brilliance, Zona Lastborn and more headline Carnivore Grounds on 12 December.','The Kutit Culture Festival returns to Nairobi''s Carnivore Grounds on 12 December 2026 with a lineup celebrating Kalenjin music and heritage. Early Bird tickets are on sale now.','event','22222222-0000-0000-0000-000000000001','published','manual',now()),
 ('simbafest-eldoret-tickets','SimbaFest lands in Eldoret','Kenya''s biggest outdoor music experience comes to Eldoret Sports Club on 28 November.','SimbaFest heads to the Rift with DJ Festone, Sweetstar and Kipsang. General tickets are moving fast.','event','22222222-0000-0000-0000-000000000002','published','manual',now()),
 ('kalee-nights-tour','Kalee Nights tour heads to The Embassy','The signature Kalee club night returns to Eldoret on 7 November.','DJ Sutai and Brobox bring the Kalee Nation Experience back to The Embassy Bistro.','event','22222222-0000-0000-0000-000000000003','published','manual',now()),
 ('list-your-event-on-kalee','Organizers: sell your tickets on Kalee Nation','Run your own program on our platform and reach thousands of fans.','Kalee Nation now opens its ticketing platform to independent organizers. Apply, get your own dashboard, and start selling.','news',null,'published','manual',now());