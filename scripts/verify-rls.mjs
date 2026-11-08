import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Real PostgreSQL policy evaluation in memory. Auth/Storage schemas are minimal
// test doubles; live Supabase JWT verification and Realtime still need staging QA.
const db = new PGlite()
let checks = 0
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    grant usage on schema auth,public to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create publication supabase_realtime;
  `)
  for (const name of ['001_northx.sql', '002_validate_catalog.sql'])
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'))
  const admin = '20260919-1111-4111-8111-111111111111',
    outsider = '20260919-2222-4222-8222-222222222222'
  await db.query('insert into auth.users(id) values ($1),($2)', [admin, outsider])
  await db.query('insert into public.admin_access(user_id) values ($1)', [admin])
  const insert = `insert into public.products(title,description,price,images,sizes,category) values ($1,$2,$3,$4,$5,$6) returning id`
  const values = [
    { ru: 'Тест', kk: 'Сынақ', en: 'Test' },
    { ru: '', kk: '', en: '' },
    45000,
    ['https://example.test/shoe.jpg'],
    [38, 40],
    'Lifestyle',
  ]
  async function role(name, user = '') {
    assert(['anon', 'authenticated'].includes(name))
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
    await db.exec(name === 'anon' ? 'set role anon' : 'set role authenticated')
  }
  async function denied(sql, params = [], code = '42501') {
    await assert.rejects(db.query(sql, params), (error) => error.code === code)
    checks++
  }
  await role('anon')
  assert.equal((await db.query('select * from products')).rows.length, 0)
  checks++
  await denied(insert, values)
  await denied("insert into storage.objects(bucket_id,name) values ('product-images','intruder.jpg')")
  await denied("insert into settings(id,whatsapp_number) values (1,'77001234567')")
  await role('authenticated', outsider)
  await denied(insert, values)
  await denied('insert into admin_access(user_id) values($1)', [outsider])
  assert.equal((await db.query('select * from admin_access')).rows.length, 0)
  checks++
  await denied("insert into storage.objects(bucket_id,name) values ('product-images','intruder.jpg')")
  await role('authenticated', admin)
  const id = (await db.query(insert, values)).rows[0].id
  checks++
  await db.query("insert into settings(id,whatsapp_number) values(1,'77001234567')")
  checks++
  await db.query("insert into storage.objects(bucket_id,name) values ('product-images','owner.jpg')")
  checks++
  await denied(insert, [{ ru: '', kk: 'Valid', en: 'Valid' }, ...values.slice(1)], '23514')
  await denied(insert, [...values.slice(0, 4), [38, 38], values[5]], '23514')
  await denied(insert, [...values.slice(0, 4), [47], values[5]], '23514')
  await denied(insert, [...values.slice(0, 3), ['javascript:alert(1)'], ...values.slice(4)], '23514')
  await denied(insert, [values[0], values[1], -1, ...values.slice(3)], '23514')
  await denied("update settings set store_address='{}'::jsonb", [], '23514')
  await role('authenticated', outsider)
  assert.equal((await db.query('update products set price=1 where id=$1 returning id', [id])).rows.length, 0)
  checks++
  assert.equal((await db.query('delete from products where id=$1 returning id', [id])).rows.length, 0)
  checks++
  assert.equal((await db.query('update settings set whatsapp_number=$1 returning id', ['77009999999'])).rows.length, 0)
  checks++
  assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0)
  checks++
  await role('anon')
  assert.equal((await db.query('select price from products where id=$1', [id])).rows[0].price, 45000)
  checks++
  await role('authenticated', admin)
  assert.equal(
    (await db.query('update products set price=49000 where id=$1 returning price', [id])).rows[0].price,
    49000,
  )
  checks++
  assert.equal((await db.query('delete from products where id=$1 returning id', [id])).rows.length, 1)
  checks++
  console.log(`PASS: ${checks} PostgreSQL migration, RLS and validation checks`)
} finally {
  await db.close()
}
