-- Taxas · Sílvia Novaes: estrutura do banco.
-- Rodar uma vez no SQL Editor do projeto Supabase da loja.

create table public.lojas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  -- código de convite: quem tem o código entra na loja
  codigo    text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  -- taxas por máquina, exceções por bandeira e bandeiras criadas na loja (o app lê e grava inteiro)
  config    jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.membros (
  loja_id   uuid not null references public.lojas(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (loja_id, user_id)
);
create index membros_user_idx on public.membros(user_id);

create table public.vendas (
  id            uuid primary key default gen_random_uuid(),
  loja_id       uuid not null references public.lojas(id) on delete cascade,
  data          date not null,
  valor         numeric(12,2) not null check (valor > 0),
  taxa          numeric(12,3) not null default 0 check (taxa >= 0),
  parcela       text not null check (char_length(parcela) between 1 and 10),
  maquina       text not null check (char_length(maquina) between 1 and 40),
  bandeira      text check (bandeira is null or char_length(bandeira) between 1 and 30),
  criado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (taxa <= valor)
);
create index vendas_loja_data_idx on public.vendas(loja_id, data);

create function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger vendas_atualizado_em before update on public.vendas
  for each row execute function public.tocar_atualizado_em();
create trigger lojas_atualizado_em before update on public.lojas
  for each row execute function public.tocar_atualizado_em();

-- Acesso: só quem é membro da loja enxerga e mexe nos dados dela.
create function public.sou_membro(p_loja uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros m where m.loja_id = p_loja and m.user_id = auth.uid());
$$;

alter table public.lojas   enable row level security;
alter table public.membros enable row level security;
alter table public.vendas  enable row level security;

create policy lojas_ver on public.lojas for select to authenticated
  using (public.sou_membro(id));
-- membro só altera a configuração (taxas); nome e código não mudam pelo app
create policy lojas_config on public.lojas for update to authenticated
  using (public.sou_membro(id)) with check (public.sou_membro(id));
revoke update on public.lojas from authenticated;
grant update (config) on public.lojas to authenticated;

create policy membros_ver on public.membros for select to authenticated
  using (public.sou_membro(loja_id));

create policy vendas_ver on public.vendas for select to authenticated
  using (public.sou_membro(loja_id));
create policy vendas_criar on public.vendas for insert to authenticated
  with check (public.sou_membro(loja_id));
create policy vendas_alterar on public.vendas for update to authenticated
  using (public.sou_membro(loja_id)) with check (public.sou_membro(loja_id));
create policy vendas_apagar on public.vendas for delete to authenticated
  using (public.sou_membro(loja_id));

-- Entrar na loja pelo código. No máximo 6 pessoas por loja.
create function public.entrar_na_loja(p_codigo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_loja uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login primeiro';
  end if;
  select id into v_loja from public.lojas where codigo = upper(trim(p_codigo));
  if v_loja is null then
    raise exception 'Código não encontrado';
  end if;
  if exists (select 1 from public.membros where loja_id = v_loja and user_id = auth.uid()) then
    return v_loja;
  end if;
  if (select count(*) from public.membros where loja_id = v_loja) >= 6 then
    raise exception 'Essa loja já tem 6 pessoas';
  end if;
  insert into public.membros (loja_id, user_id) values (v_loja, auth.uid());
  return v_loja;
end $$;

-- Usado só pelo keep-alive diário (o Supabase grátis pausa o projeto após 7 dias sem uso). Não lê dado nenhum.
create function public.ping() returns int
language sql stable set search_path = '' as $$ select 1 $$;

revoke execute on function public.entrar_na_loja(text) from public, anon;
grant execute on function public.entrar_na_loja(text) to authenticated;
revoke execute on function public.sou_membro(uuid) from public, anon;
grant execute on function public.sou_membro(uuid) to authenticated;
grant execute on function public.ping() to anon, authenticated;

-- Atualização em tempo real entre os computadores da loja.
alter publication supabase_realtime add table public.vendas;
alter publication supabase_realtime add table public.lojas;
