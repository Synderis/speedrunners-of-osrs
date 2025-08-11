-- Drop all related tables in the correct order to avoid foreign key issues
-- Run this in the Supabase SQL editor

drop table if exists weapon cascade;
drop table if exists equipment cascade;
drop table if exists items cascade;
drop table if exists monsters cascade;
