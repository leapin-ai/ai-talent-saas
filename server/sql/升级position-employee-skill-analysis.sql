-- 岗位内员工技能分析表（幂等）
-- 唯一键：tenant_id + employee_id + position_id（软删 deleted_at IS NULL）

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position_employee_skill_analysis'
  ) THEN
    CREATE TABLE t_position_employee_skill_analysis (
      id VARCHAR(255) PRIMARY KEY,
      tenant_id VARCHAR(255) NOT NULL,
      employee_id VARCHAR(255) NOT NULL,
      position_id VARCHAR(255) NOT NULL,
      readiness INTEGER,
      summary TEXT DEFAULT '',
      metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      skills JSONB NOT NULL DEFAULT '[]'::jsonb,
      priority_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
      development_plan JSONB,
      created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    );

    COMMENT ON TABLE t_position_employee_skill_analysis IS '岗位内员工技能分析';
    COMMENT ON COLUMN t_position_employee_skill_analysis.readiness IS '就绪度 0-100';
    COMMENT ON COLUMN t_position_employee_skill_analysis.summary IS '分析摘要';
    COMMENT ON COLUMN t_position_employee_skill_analysis.metrics IS '指标 { criticalGaps, atOrAbove, monthsToClose }';
    COMMENT ON COLUMN t_position_employee_skill_analysis.skills IS '技能对比列表 [{ id, name, current, required, status?, evidence? }]';
    COMMENT ON COLUMN t_position_employee_skill_analysis.priority_gaps IS '优先差距 [{ rank, title, description, current?, required? }]';
    COMMENT ON COLUMN t_position_employee_skill_analysis.development_plan IS '发展计划 { subtitle, horizons }';

    CREATE UNIQUE INDEX t_position_employee_skill_analysis_unique
      ON t_position_employee_skill_analysis (tenant_id, employee_id, position_id)
      WHERE deleted_at IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position_employee_skill_analysis'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 't_position_employee_skill_analysis'
      AND column_name = 'development_plan'
  ) THEN
    ALTER TABLE t_position_employee_skill_analysis ADD COLUMN development_plan JSONB;
    COMMENT ON COLUMN t_position_employee_skill_analysis.development_plan IS '发展计划 { subtitle, horizons }';
  END IF;
END $$;
