/*
  # Add professor role

  1. Changes
    - Update profiles.role CHECK constraint to include 'professor'
    - Role values now: 'admin', 'student', 'professor'
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','student','professor'));
