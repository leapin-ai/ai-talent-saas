-- 签名密钥 Open API 作用域列（幂等，仅修改已有表）
-- scopes: [{ method, path }]；null / 空表示不限制，与现网「全量 open-api」一致
-- 新库由 sequelize.sync() 按 @kne/fastify-signature 模型完整建表，无需本脚本
-- 存量 Postgres 上 sync 不会自动加列，部署前须执行本脚本
-- 表名前缀固定为插件默认 t_signature_（未走 DB_TABLE_PREFIX）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_signature_secret'
  ) THEN
    EXECUTE 'ALTER TABLE t_signature_secret ADD COLUMN IF NOT EXISTS "scopes" JSONB';
    EXECUTE 'COMMENT ON COLUMN t_signature_secret."scopes" IS ''Open API 作用域：[{ method, path }]；null/空表示不限制''';
  END IF;
END $$;
