-- Phase2：已有表增加 outlook / assessmentStatus / profile completion（幂等）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position'
  ) THEN
    ALTER TABLE t_position ADD COLUMN IF NOT EXISTS "outlook" JSONB NOT NULL DEFAULT '{}';
    COMMENT ON COLUMN t_position."outlook" IS 'Role Insights outlook';
    ALTER TABLE t_position ADD COLUMN IF NOT EXISTS "assessment_status" VARCHAR(32) NOT NULL DEFAULT 'pending';
    COMMENT ON COLUMN t_position."assessment_status" IS 'pending|interviews_in_progress|completed';

    UPDATE t_position
    SET "assessment_status" = 'completed'
    WHERE "analysis_status" = 'completed'
      AND "assessment_status" IS DISTINCT FROM 'completed';

    UPDATE t_position p
    SET "assessment_status" = 'interviews_in_progress'
    WHERE p."assessment_status" = 'pending'
      AND p."deleted_at" IS NULL
      AND EXISTS (
        SELECT 1 FROM t_talent_collect_invite i
        WHERE i.position_id = p.id AND i.deleted_at IS NULL
      );

    UPDATE t_position
    SET "outlook" = jsonb_build_object(
      'summary', COALESCE("verdict"->>'summary', ''),
      'drivesSuccessNow', CASE WHEN COALESCE("verdict"->>'today', '') = '' THEN '[]'::jsonb ELSE jsonb_build_array("verdict"->>'today') END,
      'howRoleChanging', CASE WHEN COALESCE("verdict"->>'future', '') = '' THEN '[]'::jsonb ELSE jsonb_build_array("verdict"->>'future') END
    )
    WHERE ("outlook" = '{}'::jsonb OR "outlook" IS NULL)
      AND "verdict" IS NOT NULL
      AND "verdict" <> '{}'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_employee'
  ) THEN
    ALTER TABLE t_employee ADD COLUMN IF NOT EXISTS "profile_completion_percent" INTEGER NOT NULL DEFAULT 0;
    COMMENT ON COLUMN t_employee."profile_completion_percent" IS '档案完成度 0-100';
    ALTER TABLE t_employee ADD COLUMN IF NOT EXISTS "profile_completion_checklist" JSONB NOT NULL DEFAULT '[]';
    COMMENT ON COLUMN t_employee."profile_completion_checklist" IS '档案完成度清单';
  END IF;
END $$;
