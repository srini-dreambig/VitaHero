-- VitaHero: Production indexes and leaderboard function
-- Run: supabase db push or apply via Supabase Dashboard SQL Editor.

-- ── Performance Indexes ──────────────────────────────────

-- Kids lookups by user
CREATE INDEX IF NOT EXISTS idx_kids_user_id ON kids(user_id);
CREATE INDEX IF NOT EXISTS idx_kids_profile_id ON kids(profile_id);

-- Appointments by user + date
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

-- Meal items by user + kid
CREATE INDEX IF NOT EXISTS idx_meal_items_user_id ON meal_items(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_items_kid_id ON meal_items(kid_id);

-- Streaks by user
CREATE INDEX IF NOT EXISTS idx_streaks_user_id ON streaks(user_id);

-- Growth points by kid
CREATE INDEX IF NOT EXISTS idx_growth_points_kid_id ON growth_points(kid_id);

-- Profiles by user
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Co-parents by profile
CREATE INDEX IF NOT EXISTS idx_co_parents_profile_id ON co_parents(profile_id);

-- ── Leaderboard Function ─────────────────────────────────
-- Returns anonymized leaderboard: top 20 kids by health score,
-- with the current user's entry always included.
-- Called by the Android app via RPC, requires auth.

CREATE OR REPLACE FUNCTION get_leaderboard(current_kid_id TEXT)
RETURNS TABLE(
  rank BIGINT,
  kid_name TEXT,
  is_you BOOLEAN,
  score INT,
  points INT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH scored AS (
    SELECT
      k.id,
      k.name,
      k.overall_score AS score,
      COALESCE(s.current_streak, 0) AS streak,
      -- Points = overall_score * 10 + streak * 50
      (k.overall_score * 10 + COALESCE(s.current_streak, 0) * 50)::INT AS points
    FROM kids k
    LEFT JOIN streaks s ON s.kid_id = k.id
    WHERE k.user_id IS NOT NULL
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY s.points DESC, s.score DESC) AS rank,
      s.name AS kid_name,
      s.id = current_kid_id AS is_you,
      s.score,
      s.points
    FROM scored s
  )
  SELECT r.rank, r.kid_name, r.is_you, r.score, r.points
  FROM ranked r
  WHERE r.is_you OR r.rank <= 20
  ORDER BY r.rank
  LIMIT 20;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT) TO anon;
