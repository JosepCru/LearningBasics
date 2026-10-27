-- Tests de seguridad de public.events (pgTAP). Se ejecutan en CI con `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Dos usuarios de prueba (como superusuario).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  'RLS está activado en public.events'
);
select is(
  (select count(*)::int from pg_policies where tablename = 'events' and cmd in ('UPDATE', 'DELETE', 'ALL')),
  0,
  'No existe ninguna política de UPDATE, DELETE ni ALL'
);

-- ===== Usuario A =====
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.events (id, user_id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'dev-a', 'lesson', 1, now(),
             '{"lessonId": "chem.mole.l1", "action": "completed"}') $$,
  'A puede insertar un evento propio'
);

select lives_ok(
  $$ insert into public.events (id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000002', 'dev-a', 'lesson', 1, now(), '{"lessonId": "x", "action": "opened"}') $$,
  'Si se omite user_id, toma auth.uid() por defecto'
);

select is(
  (select user_id from public.events where id = 'aaaaaaaa-0000-7000-8000-000000000002'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'El user_id por defecto es el del usuario autenticado'
);

select throws_ok(
  $$ insert into public.events (id, user_id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000003', '22222222-2222-2222-2222-222222222222', 'dev-a', 'lesson', 1, now(), '{}') $$,
  '42501',
  null,
  'A no puede insertar eventos a nombre de B'
);

select lives_ok(
  $$ insert into public.events (id, user_id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'dev-a', 'lesson', 1, now(), '{}')
     on conflict (id) do nothing $$,
  'Reenviar un evento ya existente con ON CONFLICT DO NOTHING no falla (reintento idempotente)'
);

select is((select count(*)::int from public.events), 2, 'A ve sus 2 eventos y el reintento no duplicó nada');

select throws_ok(
  $$ update public.events set device_id = 'x' $$,
  '42501', null,
  'Nadie puede modificar eventos'
);

select throws_ok(
  $$ delete from public.events $$,
  '42501', null,
  'Nadie puede borrar eventos'
);

select throws_ok(
  $$ insert into public.events (id, device_id, type, schema_version, client_created_at, payload, seq)
     values ('aaaaaaaa-0000-7000-8000-000000000004', 'dev-a', 'lesson', 1, now(), '{}', 999999) $$,
  null, null, -- 42501 (sin permiso de columna) o 428C9 (columna GENERATED ALWAYS): ambos valen
  'El cliente no puede fijar seq (lo asigna el servidor)'
);

select throws_ok(
  $$ insert into public.events (id, device_id, type, schema_version, client_created_at, payload, received_at)
     values ('aaaaaaaa-0000-7000-8000-000000000005', 'dev-a', 'lesson', 1, now(), '{}', '2000-01-01') $$,
  '42501', null,
  'El cliente no puede fijar received_at'
);

select throws_ok(
  $$ insert into public.events (id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000006', 'dev-a', 'hack', 1, now(), '{}') $$,
  '23514', null,
  'Un tipo de evento desconocido se rechaza'
);

select throws_ok(
  $$ insert into public.events (id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000007', 'dev-a', 'lesson', 1, now(),
             -- Contenido poco comprimible (hashes), para medir el tamaño real.
             jsonb_build_object('blob', (select string_agg(md5(i::text), '') from generate_series(1, 700) i))) $$,
  '23514', null,
  'Un payload de más de 16 KB se rechaza'
);

-- ===== Usuario B =====
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is((select count(*)::int from public.events), 0, 'B no ve los eventos de A');

-- ===== Anónimo =====
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok($$ select count(*) from public.events $$, '42501', null, 'Un anónimo no puede leer eventos');
select throws_ok(
  $$ insert into public.events (id, device_id, type, schema_version, client_created_at, payload)
     values ('aaaaaaaa-0000-7000-8000-000000000008', 'dev-x', 'lesson', 1, now(), '{}') $$,
  '42501', null,
  'Un anónimo no puede insertar eventos'
);

select * from finish();
rollback;
