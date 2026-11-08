begin;
create table public.admin_access (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admin_access enable row level security;
create policy own_access on public.admin_access for select to authenticated using (user_id = auth.uid());
grant select on public.admin_access to authenticated;
revoke insert, update, delete on public.admin_access from anon, authenticated;
create function public.is_admin() returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.admin_access where user_id = auth.uid());
$$;
create table public.products (
 id uuid primary key default gen_random_uuid(),
 title jsonb not null check (title ?& array['ru','kk','en']),
 description jsonb not null check (description ?& array['ru','kk','en']),
 price integer not null check (price >= 0),
 images text[] not null default '{}',
 sizes smallint[] not null check (sizes <@ array[36,37,38,39,40,41,42,43,44,45,46]::smallint[] and cardinality(sizes)>0),
 category text not null,
 "isStock" boolean not null default true,
 "isFeatured" boolean not null default false,
 color text not null default '#ffffff',
 created_at timestamptz not null default now()
);
create table public.settings (
 id integer primary key check(id=1), whatsapp_number text not null check(whatsapp_number ~ '^\+?[0-9]{7,15}$'),
 store_address jsonb not null default '{"ru":"","kk":"","en":""}'
);
alter table public.products enable row level security;
alter table public.settings enable row level security;
create policy catalog_read on public.products for select to anon, authenticated using(true);
create policy settings_read on public.settings for select to anon, authenticated using(true);
create policy catalog_admin on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy settings_admin on public.settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.products, public.settings to anon;
grant select, insert, update, delete on public.products, public.settings to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy photo_admin on storage.objects for all to authenticated
 using(bucket_id='product-images' and public.is_admin())
 with check(bucket_id='product-images' and public.is_admin());
alter publication supabase_realtime add table public.products, public.settings;
commit;
