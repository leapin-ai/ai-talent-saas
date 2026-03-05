-- 为 t_employee 表添加 avatar 字段
ALTER TABLE t_employee ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);

-- 添加字段注释
COMMENT ON COLUMN t_employee.avatar IS '头像';
