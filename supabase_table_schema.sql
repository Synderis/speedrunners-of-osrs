create table if not exists monsters (
    id bigint primary key,
    name text,
    combat_level int,
    hitpoints int,
    max_hit int,
    attack_speed int,
    slayer_level int,
    slayer_xp float,
    attack_level int,
    strength_level int,
    defence_level int,
    magic_level int,
    ranged_level int,
    defence_stab int,
    defence_slash int,
    defence_crush int,
    defence_magic int,
    defence_ranged int,
    last_updated date,
    release_date date,
    examine text,
    wiki_name text,
    wiki_url text,
    attack_type jsonb,
    attributes jsonb,
    category jsonb,
    slayer_masters jsonb
);

-- ITEMS TABLE
create table if not exists items (
    id bigint primary key,
    name text,
    cost bigint,
    weight float,
    equipable boolean,
    equipable_weapon boolean,
    tradeable boolean,
    release_date date,
    examine text,
    icon text,
    wiki_name text,
    wiki_url text,
    last_updated date,
    equipment jsonb,
    weapon jsonb
    -- No extra/other jsonb
);

create table if not exists weapon (
    id serial primary key,
    item_id bigint references items(id),
    weapon_name text,
    attack_stab int,
    attack_slash int,
    attack_crush int,
    attack_magic int,
    attack_ranged int,
    defence_stab int,
    defence_slash int,
    defence_crush int,
    defence_magic int,
    defence_ranged int,
    melee_strength int,
    ranged_strength int,
    magic_damage int,
    prayer int,
    slot text,
    icon text,
    weapon_data jsonb
);

create table if not exists weapon_stats (
    id serial primary key,
    item_id bigint references weapon(item_id),
    weapon_name text,
    weapon_type text,
    attack_speed int,
	attack_bonus int,
    combat_style text,
    attack_type text,
    attack_style text,
    experience text,
    boosts text,
    icon text
);

create table if not exists armor (
    id serial primary key,
    item_id bigint references items(id),
    armor_name text,
    attack_stab int,
    attack_slash int,
    attack_crush int,
    attack_magic int,
    attack_ranged int,
    defence_stab int,
    defence_slash int,
    defence_crush int,
    defence_magic int,
    defence_ranged int,
    melee_strength int,
    ranged_strength int,
    magic_damage int,
    prayer int,
    slot text,
    icon text
);