-- 修改 t_position 表 capacity 字段类型从 JSON 改为 VARCHAR
-- 执行时间: 2026-03-06

-- 先将 JSON 数据转换为文本
ALTER TABLE t_position ALTER COLUMN capacity TYPE VARCHAR(255) USING capacity::TEXT;

-- 注释
COMMENT ON COLUMN t_position.capacity IS '职能';
