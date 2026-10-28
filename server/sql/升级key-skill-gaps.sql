-- 岗位内员工技能分析补「关键技能变化」字段（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position_employee_skill_analysis'
  ) THEN
    ALTER TABLE t_position_employee_skill_analysis ADD COLUMN IF NOT EXISTS "key_skill_gaps" JSONB DEFAULT '[]';
    COMMENT ON COLUMN t_position_employee_skill_analysis."key_skill_gaps" IS '关键技能变化 [{ rank, category, name, skillNow[], skillFuture, evolution[], score, primaryTask, alsoOnTasks[] }]';
  END IF;
END $$;
