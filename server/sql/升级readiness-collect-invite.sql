-- 就绪度经理/员工问卷：复用采集页（/collect-profile），延后创建 AI 面试邀请

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_readiness_invite'
  ) THEN
    ALTER TABLE t_readiness_invite ADD COLUMN IF NOT EXISTS "collect_invite_id" BIGINT NULL;
    COMMENT ON COLUMN t_readiness_invite."collect_invite_id" IS '人才采集邀请 ID（经理/员工走 /collect-profile）';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_talent_collect_invite'
  ) THEN
    ALTER TABLE t_talent_collect_invite ALTER COLUMN "position_id" DROP NOT NULL;
    COMMENT ON COLUMN t_talent_collect_invite."position_id" IS '岗位ID（就绪度无关联岗位时可空）';
  END IF;
END $$;
