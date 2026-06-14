-- VitaHero RLS Security Policies
-- Ensures users can only access their own data via auth.uid().
-- Run: supabase db push or apply via Supabase Dashboard SQL Editor.

-- Enable RLS on all application tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_parents ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update only their own profile
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Kids: scoped to parent user
CREATE POLICY "kids_select_own" ON kids
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_insert_own" ON kids
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_update_own" ON kids
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kids_delete_own" ON kids
    FOR DELETE USING (auth.uid() = user_id);

-- Camps: scoped to parent user
CREATE POLICY "camps_select_own" ON camps
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "camps_insert_own" ON camps
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "camps_update_own" ON camps
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "camps_delete_own" ON camps
    FOR DELETE USING (auth.uid() = user_id);

-- Appointments: scoped to parent user
CREATE POLICY "appointments_select_own" ON appointments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "appointments_insert_own" ON appointments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "appointments_update_own" ON appointments
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "appointments_delete_own" ON appointments
    FOR DELETE USING (auth.uid() = user_id);

-- Meal items: scoped to parent user
CREATE POLICY "meal_items_select_own" ON meal_items
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meal_items_insert_own" ON meal_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meal_items_update_own" ON meal_items
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meal_items_delete_own" ON meal_items
    FOR DELETE USING (auth.uid() = user_id);

-- Growth points: scoped to parent user
CREATE POLICY "growth_points_select_own" ON growth_points
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "growth_points_insert_own" ON growth_points
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "growth_points_update_own" ON growth_points
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "growth_points_delete_own" ON growth_points
    FOR DELETE USING (auth.uid() = user_id);

-- Streaks: scoped to parent user
CREATE POLICY "streaks_select_own" ON streaks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "streaks_insert_own" ON streaks
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "streaks_update_own" ON streaks
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "streaks_delete_own" ON streaks
    FOR DELETE USING (auth.uid() = user_id);

-- Co-parents: scoped to parent user
CREATE POLICY "co_parents_select_own" ON co_parents
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "co_parents_insert_own" ON co_parents
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "co_parents_update_own" ON co_parents
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "co_parents_delete_own" ON co_parents
    FOR DELETE USING (auth.uid() = user_id);

-- Phone OTPs: public insert (needed for OTP flow), admin-only select/update
ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_otps_insert_public" ON phone_otps
    FOR INSERT WITH CHECK (true);
-- SELECT and UPDATE are handled by the edge function using service_role key,
-- so no policies needed for anon/authenticated users.
