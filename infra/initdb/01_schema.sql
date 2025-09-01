create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  project_id text not null,
  filename text not null,
  sha256 text not null,
  pages int default 0,
  created_at timestamptz default now()
);

create table if not exists requests_log (
  id bigserial primary key,
  tenant_id text not null,
  user_id text not null,
  tokens_in int default 0,
  tokens_out int default 0,
  cost_usd numeric(10,5) default 0,
  created_at timestamptz default now()
);

create table if not exists usage_quotas (
  tenant_id text primary key,
  daily_token_cap int not null default 150000,
  updated_at timestamptz default now()
);

-- seed a default cap
insert into usage_quotas(tenant_id, daily_token_cap)
  values ('demo-tenant', 150000)
on conflict (tenant_id) do nothing;
