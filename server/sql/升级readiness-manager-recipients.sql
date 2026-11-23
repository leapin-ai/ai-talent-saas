-- 就绪度流程：新建时预选经理收件人（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_readiness_run'
  ) THEN
    ALTER TABLE t_readiness_run ADD COLUMN IF NOT EXISTS "manager_recipients" JSONB NOT NULL DEFAULT '[]'::jsonb;
    COMMENT ON COLUMN t_readiness_run."manager_recipients" IS '新建时预选的经理收件人 [{ tenantUserId, name, email, employeeId? }]';
  END IF;
END $$;
