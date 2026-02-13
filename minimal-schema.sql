create extension if not exists "pgcrypto";

drop function if exists set_updated_at() cascade;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('OWNER', 'STAFF')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  brand text not null,
  model text not null,
  sku text not null unique,
  cost numeric(12, 2) not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  remaining_quantity integer not null check (remaining_quantity >= 0 and remaining_quantity <= quantity),
  purchased_at timestamptz not null default now(),
  purchased_by uuid references users(id),
  notes text
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  seller_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  cost_price numeric(12, 2) not null check (cost_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0 and subtotal = round(quantity * unit_price, 2)),
  created_at timestamptz not null default now()
);

create table if not exists system_settings (
  setting_key text primary key,
  setting_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table inventory_purchases enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table system_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'categories_public_all'
  ) then
    create policy categories_public_all on categories for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'users_public_all'
  ) then
    create policy users_public_all on users for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'products_public_all'
  ) then
    create policy products_public_all on products for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'inventory_purchases_public_all'
  ) then
    create policy inventory_purchases_public_all on inventory_purchases for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'sales_public_all'
  ) then
    create policy sales_public_all on sales for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'sale_items_public_all'
  ) then
    create policy sale_items_public_all on sale_items for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and policyname = 'system_settings_public_all'
  ) then
    create policy system_settings_public_all on system_settings for all using (true) with check (true);
  end if;
end;
$$;

create index if not exists idx_products_category_id on products(category_id);
create index if not exists idx_products_is_active on products(is_active);
create index if not exists idx_sales_created_at on sales(created_at);
create index if not exists idx_sale_items_sale_id on sale_items(sale_id);
create index if not exists idx_sale_items_product_id on sale_items(product_id);
create index if not exists idx_inventory_purchases_product_id on inventory_purchases(product_id);

insert into system_settings (setting_key, setting_value)
values ('inventory_display_order', 'LIFO')
on conflict (setting_key) do nothing;

drop function if exists generate_sku(text, text);
drop function if exists generate_sku(character varying, character varying);

create or replace function generate_sku(p_category_name text, p_brand text)
returns text
language plpgsql
as $$
declare
  base_prefix text;
  result text;
  counter integer := 1;
begin
  base_prefix := upper(regexp_replace(left(coalesce(p_category_name, ''), 3), '[^A-Z0-9]', '', 'g'))
    || '-' || upper(regexp_replace(left(coalesce(p_brand, ''), 3), '[^A-Z0-9]', '', 'g'))
    || '-' || to_char(now(), 'YYMMDD');

  if base_prefix = '--' then
    base_prefix := 'SKU-' || to_char(now(), 'YYMMDD');
  end if;

  loop
    result := base_prefix || '-' || lpad(counter::text, 3, '0');
    exit when not exists (select 1 from products where sku = result);
    counter := counter + 1;
  end loop;

  return result;
end;
$$;

drop function if exists add_product_stock(uuid, integer, uuid);

create or replace function add_product_stock(
  p_product_id uuid,
  p_additional_stock integer,
  p_user_id uuid
)
returns void
language plpgsql
as $$
declare
  current_cost numeric(12, 2);
begin
  if p_additional_stock <= 0 then
    raise exception 'Additional stock must be greater than zero';
  end if;

  update products
  set stock = stock + p_additional_stock,
      updated_at = now()
  where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  select cost into current_cost from products where id = p_product_id;

  insert into inventory_purchases (
    product_id,
    quantity,
    unit_cost,
    remaining_quantity,
    purchased_at,
    purchased_by,
    notes
  ) values (
    p_product_id,
    p_additional_stock,
    current_cost,
    p_additional_stock,
    now(),
    p_user_id,
    'Stock added via inventory management'
  );
end;
$$;

drop function if exists reduce_stock_on_sale() cascade;

create or replace function reduce_stock_on_sale()
returns trigger
language plpgsql
as $$
declare
  current_stock integer;
begin
  if new.quantity <= 0 then
    raise exception 'Sale item quantity must be greater than zero';
  end if;

  select stock
  into current_stock
  from products
  where id = new.product_id
  for update;

  if current_stock is null then
    raise exception 'Product not found';
  end if;

  if current_stock < new.quantity then
    raise exception 'Insufficient stock for product';
  end if;

  update products
  set stock = stock - new.quantity,
      updated_at = now()
  where id = new.product_id;

  return new;
end;
$$;

drop function if exists validate_sale_total() cascade;

create or replace function validate_sale_total()
returns trigger
language plpgsql
as $$
declare
  target_sale_id uuid;
  items_total numeric(12, 2);
  sale_total numeric(12, 2);
begin
  target_sale_id := coalesce(new.sale_id, old.sale_id);

  select total_amount
  into sale_total
  from sales
  where id = target_sale_id;

  if sale_total is null then
    raise exception 'Sale not found for validation';
  end if;

  select coalesce(sum(subtotal), 0)
  into items_total
  from sale_items
  where sale_id = target_sale_id;

  if round(items_total, 2) <> round(sale_total, 2) then
    raise exception 'Sale total mismatch: % vs %', sale_total, items_total;
  end if;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_reduce_stock_on_sale'
  ) then
    create trigger trg_reduce_stock_on_sale
    after insert on sale_items
    for each row
    execute function reduce_stock_on_sale();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_categories_updated_at'
  ) then
    create trigger trg_categories_updated_at
    before update on categories
    for each row
    execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_users_updated_at'
  ) then
    create trigger trg_users_updated_at
    before update on users
    for each row
    execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_products_updated_at'
  ) then
    create trigger trg_products_updated_at
    before update on products
    for each row
    execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_system_settings_updated_at'
  ) then
    create trigger trg_system_settings_updated_at
    before update on system_settings
    for each row
    execute function set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_sale_items_total_validation'
  ) then
    create constraint trigger trg_sale_items_total_validation
    after insert or update or delete on sale_items
    deferrable initially deferred
    for each row
    execute function validate_sale_total();
  end if;
end;
$$;
