-- Jalankan seluruh file ini di Supabase > SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'user' check (role in ('user','admin')),
 created_at timestamptz not null default now()
);
create or replace function public.sync_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,role)
 values(new.id, case when new.raw_app_meta_data->>'role'='admin' then 'admin' else 'user' end)
 on conflict(id) do update set role=excluded.role;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute procedure public.sync_profile();
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create table if not exists public.groups (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 link text,
 category text not null,
 description text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.group_requests (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 link text not null check (link like 'https://chat.whatsapp.com/%'),
 category text not null,
 description text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_requests enable row level security;
drop policy if exists "Public can view groups" on public.groups;
create policy "Public can view groups" on public.groups for select to anon, authenticated using (true);
drop policy if exists "Admins manage groups" on public.groups;
create policy "Admins manage groups" on public.groups for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
drop policy if exists "Admins read requests" on public.group_requests;
create policy "Admins read requests" on public.group_requests for select to authenticated using(public.is_admin());
drop policy if exists "Admins update requests" on public.group_requests;
create policy "Admins update requests" on public.group_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.approve_group_request(request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.group_requests%rowtype;
begin
 if not public.is_admin() then raise exception 'admin only'; end if;
 select * into r from public.group_requests where id=request_id and status='pending' for update;
 if not found then raise exception 'request not found or already reviewed'; end if;
 insert into public.groups(name,link,category,description) values(r.name,r.link,r.category,r.description);
 update public.group_requests set status='approved' where id=request_id;
end; $$;
create or replace function public.reject_group_request(request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'admin only'; end if;
 update public.group_requests set status='rejected' where id=request_id and status='pending';
 if not found then raise exception 'request not found or already reviewed'; end if;
end; $$;
revoke all on function public.approve_group_request(uuid) from public;
revoke all on function public.reject_group_request(uuid) from public;
grant execute on function public.approve_group_request(uuid) to authenticated;
grant execute on function public.reject_group_request(uuid) to authenticated;
grant select on public.groups to anon, authenticated;
grant select,update,delete,insert on public.groups to authenticated;
grant select,update on public.group_requests to authenticated;
-- Grup contoh yang belum punya link tidak ditambahkan karena linknya belum tersedia.
insert into public.groups(name,link,category,description) values
('GLITCH FANS',null,'Fandom','Komunitas GLITCH FANS.'),
('MULTIFANDOM UNIVERSE','https://chat.whatsapp.com/KghdosbUen1CK8Jvk1Pc5h?s=cl&p=a&mlu=4&ilr=4','Fandom','Komunitas multifandom.'),
('FPE FANS',null,'Fandom','Komunitas FPE FANS.')
on conflict do nothing;
