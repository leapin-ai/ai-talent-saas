const fs = require('fs');
const path = require('path');

// 读取生成的SQL文件
const sqlFilePath = path.join(__dirname, '../server/sql/import_skills_data.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

module.exports = async (sequelize) => {
  try {
    console.log('[SQL] Query import_skills start');
    await sequelize.query(sqlContent);
    console.log('[SQL] Query import_skills success');
  } catch (error) {
    console.error('[ERR]', error.message);
    throw error;
  }
};
