-- 添加 options 字段到 profile 表
-- 字段类型: JSONB
-- 说明: 其他信息

ALTER TABLE t_profile ADD COLUMN IF NOT EXISTS options JSONB;

COMMENT ON COLUMN t_profile.options IS '其他信息';
