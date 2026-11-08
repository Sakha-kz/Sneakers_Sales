begin;

-- Client-side Zod improves feedback; these checks also cover direct REST writes.
create function public.valid_localized(value jsonb, minimum integer, maximum integer)
returns boolean language sql immutable strict set search_path = '' as $$
  select jsonb_typeof(value) = 'object'
    and value ?& array['ru','kk','en']
    and not exists (
      select 1 from unnest(array['ru','kk','en']) as lang
      where jsonb_typeof(value->lang) is distinct from 'string'
        or length(btrim(value->>lang)) not between minimum and maximum
    );
$$;

create function public.valid_product_images(value text[])
returns boolean language sql immutable strict set search_path = '' as $$
  select cardinality(value) <= 8 and not exists (
    select 1 from unnest(value) as image_url
    where image_url is null or image_url !~ '^https?://[^[:space:]]+$'
  );
$$;

create function public.valid_product_sizes(value smallint[])
returns boolean language sql immutable strict set search_path = '' as $$
  select cardinality(value) between 1 and 11
    and cardinality(value) = (select count(distinct size) from unnest(value) as size)
    and value <@ array[36,37,38,39,40,41,42,43,44,45,46]::smallint[];
$$;

alter table public.products
  add constraint product_title_valid check(public.valid_localized(title,1,120)),
  add constraint product_description_valid check(public.valid_localized(description,0,2000)),
  add constraint product_images_valid check(public.valid_product_images(images)),
  add constraint product_sizes_valid check(public.valid_product_sizes(sizes)),
  add constraint product_category_valid check(length(btrim(category)) between 1 and 80),
  add constraint product_color_valid check(color ~ '^#[0-9a-fA-F]{6}$');
alter table public.settings
  add constraint store_address_valid check(public.valid_localized(store_address,0,500));

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

commit;
