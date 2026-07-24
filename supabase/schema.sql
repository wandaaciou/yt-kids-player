create table if not exists public.allowed_videos (
  family_id text not null,
  youtube_video_id text not null,
  title text not null,
  channel text not null,
  duration text not null,
  duration_minutes integer not null,
  thumbnail text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (family_id, youtube_video_id)
);

create table if not exists public.player_control (
  family_id text primary key,
  status text not null default 'allowed' check (status in ('allowed', 'paused', 'locked')),
  current_video_id text,
  timer_minutes integer not null default 15,
  stop_at timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.family_watch_progress (
  family_id text not null,
  watch_date date not null,
  youtube_video_id text not null,
  progress_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (family_id, watch_date, youtube_video_id)
);

alter table public.allowed_videos enable row level security;
alter table public.player_control enable row level security;
alter table public.family_watch_progress enable row level security;

drop policy if exists "Server can manage allowed videos" on public.allowed_videos;
drop policy if exists "Server can manage player control" on public.player_control;
drop policy if exists "Server can manage family watch progress" on public.family_watch_progress;

create policy "Server can manage allowed videos"
  on public.allowed_videos
  for all
  using (true)
  with check (true);

create policy "Server can manage player control"
  on public.player_control
  for all
  using (true)
  with check (true);

create policy "Server can manage family watch progress"
  on public.family_watch_progress
  for all
  using (true)
  with check (true);

insert into public.player_control (
  family_id,
  status,
  current_video_id,
  timer_minutes,
  stop_at,
  locked_until
) values (
  'sauncai',
  'allowed',
  null,
  15,
  null,
  null
) on conflict (family_id) do nothing;
