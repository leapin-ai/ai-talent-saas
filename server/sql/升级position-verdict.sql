-- 为 t_position 添加 verdict（技能洞察结论 The Verdict）（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position'
  ) THEN
    ALTER TABLE t_position ADD COLUMN IF NOT EXISTS "verdict" JSONB;
    COMMENT ON COLUMN t_position."verdict" IS '技能洞察结论（The Verdict）';
  END IF;
END $$;
