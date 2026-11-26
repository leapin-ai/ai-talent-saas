-- MCP allowlist：补种子对账字段（幂等；新环境可无 sync 建表）
-- source / manual_fields / seed_key / seed_group 用于区分种子与人工配置，配合 disableMissing

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_mcp_allowlist'
  ) THEN
    ALTER TABLE t_mcp_allowlist ADD COLUMN IF NOT EXISTS "source" VARCHAR(255) NOT NULL DEFAULT 'manual';
    COMMENT ON COLUMN t_mcp_allowlist."source" IS 'seed | manual；manual=管理端新建，种子不接管';

    ALTER TABLE t_mcp_allowlist ADD COLUMN IF NOT EXISTS "manual_fields" JSON NOT NULL DEFAULT '[]';
    COMMENT ON COLUMN t_mcp_allowlist."manual_fields" IS 'seed 行上人工改过的字段（scenarios/confirm/enabled），种子重启不再覆盖这些字段';

    ALTER TABLE t_mcp_allowlist ADD COLUMN IF NOT EXISTS "seed_key" VARCHAR(255) NULL;
    COMMENT ON COLUMN t_mcp_allowlist."seed_key" IS '种子稳定键，如 GET /api/v1/client/ping';

    ALTER TABLE t_mcp_allowlist ADD COLUMN IF NOT EXISTS "seed_group" VARCHAR(255) NULL;
    COMMENT ON COLUMN t_mcp_allowlist."seed_group" IS 'swagger | file；disableMissing 只对账同组';
  END IF;
END $$;
