-- Resh POS Migration 006: Add is_demo column to categories table
-- Run this in your Supabase SQL Editor (safe to re-run)
--
-- WHY: The addDemoData() helper inserts categories with is_demo = true,
-- but migration_002 forgot to add the is_demo column to the categories table.
-- This migration fixes that oversight.

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_categories_is_demo ON categories(is_demo);
