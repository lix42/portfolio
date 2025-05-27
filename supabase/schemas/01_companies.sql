create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_time date not null,
  end_time date,
  title text not null,
  description text not null
);
