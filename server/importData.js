const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { fastify, createServer } = require('./server');

// 枚举值映射
const skillTypeMap = {
  knowledge: 'KNOWLEDGE',
  skill: 'SKILL',
  competence: 'COMPETENCE',
  'skill/competence': 'SKILL_COMPETENCE'
};

const reuseLevelMap = {
  'cross-sector': 'CROSS_SECTOR',
  'sector-specific': 'SECTOR_SPECIFIC',
  'occupation-specific': 'OCCUPATION_SPECIFIC',
  transversal: 'TRANSVERSAL'
};

const relationTypeMap = {
  essential: 'ESSENTIAL',
  optional: 'OPTIONAL'
};

// 数据解析函数 - 支持换行符、逗号或竖线分隔
function parseArray(str) {
  if (!str || !str.trim()) return [];
  // 先尝试按换行符分割，如果结果为1则尝试逗号，再尝试竖线
  let result = str
    .split('\n')
    .map(s => s.trim())
    .filter(s => s);
  if (result.length === 1 && str.includes(',')) {
    result = str
      .split(',')
      .map(s => s.trim())
      .filter(s => s);
  } else if (result.length === 1 && str.includes('|')) {
    result = str
      .split('|')
      .map(s => s.trim())
      .filter(s => s);
  }
  return result;
}

function parseCommaArray(str) {
  if (!str || !str.trim()) return [];
  return str.split(',').map(s => s.trim());
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr);
}

function parseDecimal(str) {
  if (!str || str === '') return null;
  return parseFloat(str);
}

// 批量导入函数
async function importCSV(filePath, model, transformFn, modelName) {
  return new Promise((resolve, reject) => {
    const data = [];

    console.log(`开始读取${modelName} CSV文件...`);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', row => {
        const transformed = transformFn(row);
        if (transformed) {
          data.push(transformed);
        }
      })
      .on('end', async () => {
        try {
          console.log(`读取完成，共 ${data.length} 条${modelName}数据`);
          console.log(`开始导入${modelName}数据...`);

          // 批量插入数据，每次1000条
          const batchSize = 1000;
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await model.bulkCreate(batch, { logging: false });
            console.log(`${modelName}导入进度: ${Math.min(i + batchSize, data.length)}/${data.length}`);
          }

          console.log(`成功导入 ${data.length} 条${modelName}数据`);
          resolve({ success: true, count: data.length });
        } catch (error) {
          console.error(`${modelName}导入失败:`, error);
          reject(error);
        }
      })
      .on('error', error => {
        console.error(`读取${modelName}CSV文件失败:`, error);
        reject(error);
      });
  });
}

// 执行导入
(async () => {
  createServer();
  await fastify.ready();

  const models = {
    skill: fastify.project.models.skill,
    skillGroup: fastify.project.models.skillGroup,
    iscoGroup: fastify.project.models.iscoGroup,
    occupation: fastify.project.models.occupation,
    skillsHierarchy: fastify.project.models.skillsHierarchy,
    broaderRelationSkillPillar: fastify.project.models.broaderRelationSkillPillar,
    occupationSkillRelation: fastify.project.models.occupationSkillRelation,
    skillSkillRelation: fastify.project.models.skillSkillRelation,
    broaderRelationOccPillar: fastify.project.models.broaderRelationOccPillar,
    greenShareOcc: fastify.project.models.greenShareOcc,
    digitalSkillsCollection: fastify.project.models.digitalSkillsCollection,
    greenSkillsCollection: fastify.project.models.greenSkillsCollection,
    transversalSkillsCollection: fastify.project.models.transversalSkillsCollection,
    languageSkillsCollection: fastify.project.models.languageSkillsCollection,
    digCompSkillsCollection: fastify.project.models.digCompSkillsCollection,
    researchSkillsCollection: fastify.project.models.researchSkillsCollection,
    researchOccupationsCollection: fastify.project.models.researchOccupationsCollection
  };

  const basePath = path.join(__dirname, '../ESCO dataset - v1.2.1 - classification - en - csv');

  try {
    // 1. 导入技能组
    await importCSV(
      path.join(basePath, 'skillGroups_en.csv'),
      models.skillGroup,
      row => ({
        conceptUri: row.conceptUri,
        conceptType: row.conceptType,
        preferredLabel: row.preferredLabel,
        altLabels: parseArray(row.altLabels),
        hiddenLabels: parseArray(row.hiddenLabels),
        status: row.status,
        modifiedDate: parseDate(row.modifiedDate),
        scopeNote: row.scopeNote,
        inScheme: parseArray(row.inScheme),
        description: row.description,
        code: row.code
      }),
      '技能组'
    );

    // 2. 导入ISCO分组
    await importCSV(
      path.join(basePath, 'iscoGroups_en.csv'),
      models.iscoGroup,
      row => ({
        conceptUri: row.conceptUri,
        conceptType: row.conceptType,
        code: row.code,
        preferredLabel: row.preferredLabel,
        status: row.status,
        altLabels: parseArray(row.altLabels),
        inScheme: parseArray(row.inScheme),
        description: row.description
      }),
      'ISCO分组'
    );

    // 3. 导入职业层级关系
    await importCSV(
      path.join(basePath, 'broaderRelationsOccPillar_en.csv'),
      models.broaderRelationOccPillar,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        conceptLabel: row.conceptLabel,
        broaderType: row.broaderType,
        broaderUri: row.broaderUri,
        broaderLabel: row.broaderLabel
      }),
      '职业层级关系'
    );

    // 4. 导入职业
    await importCSV(
      path.join(basePath, 'occupations_en.csv'),
      models.occupation,
      row => ({
        conceptUri: row.conceptUri,
        conceptType: row.conceptType,
        iscoGroup: row.iscoGroup,
        preferredLabel: row.preferredLabel,
        altLabels: parseArray(row.altLabels),
        hiddenLabels: parseArray(row.hiddenLabels),
        status: row.status,
        modifiedDate: parseDate(row.modifiedDate),
        regulatedProfessionNote: row.regulatedProfessionNote,
        scopeNote: row.scopeNote,
        definition: row.definition,
        inScheme: parseArray(row.inScheme),
        description: row.description,
        code: row.code,
        naceCode: row.naceCode
      }),
      '职业'
    );

    // 5. 导入技能层级
    await importCSV(
      path.join(basePath, 'skillsHierarchy_en.csv'),
      models.skillsHierarchy,
      row => ({
        level0Uri: row['Level 0 URI'],
        level0PreferredTerm: row['Level 0 preferred term'],
        level1Uri: row['Level 1 URI'],
        level1PreferredTerm: row['Level 1 preferred term'],
        level2Uri: row['Level 2 URI'],
        level2PreferredTerm: row['Level 2 preferred term'],
        level3Uri: row['Level 3 URI'],
        level3PreferredTerm: row['Level 3 preferred term'],
        description: row.Description,
        scopeNote: row['Scope note'],
        level0Code: row['Level 0 code'],
        level1Code: row['Level 1 code'],
        level2Code: row['Level 2 code'],
        level3Code: row['Level 3 code']
      }),
      '技能层级'
    );

    // 6. 导入技能层级关系
    await importCSV(
      path.join(basePath, 'broaderRelationsSkillPillar_en.csv'),
      models.broaderRelationSkillPillar,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        conceptLabel: row.conceptLabel,
        broaderType: row.broaderType,
        broaderUri: row.broaderUri,
        broaderLabel: row.broaderLabel
      }),
      '技能层级关系'
    );

    // 7. 导入技能
    await importCSV(
      path.join(basePath, 'skills_en.csv'),
      models.skill,
      row => ({
        conceptUri: row.conceptUri,
        conceptType: row.conceptType,
        skillType: skillTypeMap[row.skillType] || 'SKILL',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        preferredLabel: row.preferredLabel,
        altLabels: parseArray(row.altLabels),
        hiddenLabels: parseArray(row.hiddenLabels),
        status: row.status,
        modifiedDate: parseDate(row.modifiedDate),
        scopeNote: row.scopeNote,
        definition: row.definition,
        inScheme: parseCommaArray(row.inScheme),
        description: row.description
      }),
      '技能'
    );

    // 8. 导入技能-技能关联
    await importCSV(
      path.join(basePath, 'skillSkillRelations_en.csv'),
      models.skillSkillRelation,
      row => ({
        originalSkillUri: row.originalSkillUri,
        originalSkillType: skillTypeMap[row.originalSkillType] || 'SKILL_COMPETENCE',
        relationType: relationTypeMap[row.relationType] || 'OPTIONAL',
        relatedSkillType: skillTypeMap[row.relatedSkillType] || 'KNOWLEDGE',
        relatedSkillUri: row.relatedSkillUri
      }),
      '技能-技能关联'
    );

    // 9. 导入绿色职业占比
    await importCSV(
      path.join(basePath, 'greenShareOcc_en.csv'),
      models.greenShareOcc,
      row => ({
        conceptUri: row.conceptUri,
        code: row.code,
        greenShare: parseDecimal(row.greenShare)
      }),
      '绿色职业占比'
    );

    // 10. 导入数字技能集合
    await importCSV(
      path.join(basePath, 'digitalSkillsCollection_en.csv'),
      models.digitalSkillsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        preferredLabel: row.preferredLabel,
        status: row.status,
        skillType: skillTypeMap[row.skillType] || 'SKILL_COMPETENCE',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '数字技能集合'
    );

    // 11. 导入绿色技能集合
    await importCSV(
      path.join(basePath, 'greenSkillsCollection_en.csv'),
      models.greenSkillsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        preferredLabel: row.preferredLabel,
        status: row.status,
        skillType: skillTypeMap[row.skillType] || 'SKILL_COMPETENCE',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '绿色技能集合'
    );

    // 12. 导入通用技能集合
    await importCSV(
      path.join(basePath, 'transversalSkillsCollection_en.csv'),
      models.transversalSkillsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        skillType: skillTypeMap[row.skillType] || 'SKILL_COMPETENCE',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        preferredLabel: row.preferredLabel,
        status: row.status,
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '通用技能集合'
    );

    // 13. 导入语言技能集合
    await importCSV(
      path.join(basePath, 'languageSkillsCollection_en.csv'),
      models.languageSkillsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        skillType: skillTypeMap[row.skillType] || 'SKILL_COMPETENCE',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        preferredLabel: row.preferredLabel,
        status: row.status,
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '语言技能集合'
    );

    // 14. 导入数字素养技能集合
    await importCSV(
      path.join(basePath, 'digCompSkillsCollection_en.csv'),
      models.digCompSkillsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        preferredLabel: row.preferredLabel,
        status: row.status,
        skillType: skillTypeMap[row.skillType] || 'SKILL_COMPETENCE',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '数字素养技能集合'
    );

    // 15. 导入研究技能集合
    await importCSV(
      path.join(basePath, 'researchSkillsCollection_en.csv'),
      models.researchSkillsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        skillType: skillTypeMap[row.skillType] || 'SKILL_COMPETENCE',
        reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
        preferredLabel: row.preferredLabel,
        status: row.status,
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '研究技能集合'
    );

    // 16. 导入研究职业集合
    await importCSV(
      path.join(basePath, 'researchOccupationsCollection_en.csv'),
      models.researchOccupationsCollection,
      row => ({
        conceptType: row.conceptType,
        conceptUri: row.conceptUri,
        preferredLabel: row.preferredLabel,
        status: row.status,
        altLabels: parseArray(row.altLabels),
        description: row.description,
        broaderConceptUri: row.broaderConceptUri,
        broaderConceptPT: row.broaderConceptPT
      }),
      '研究职业集合'
    );

    // 17. 导入职业-技能关联（大文件，流式处理）
    console.log('开始读取职业-技能关联CSV文件...');
    let relations = [];
    let count = 0;

    await new Promise((resolve, reject) => {
      const readable = fs.createReadStream(path.join(basePath, 'occupationSkillRelations_en.csv'));
      let isProcessing = false;

      readable
        .pipe(csv())
        .on('data', row => {
          relations.push({
            occupationUri: row.occupationUri,
            occupationLabel: row.occupationLabel,
            skillUri: row.skillUri,
            skillLabel: row.skillLabel,
            skillType: skillTypeMap[row.skillType] || 'KNOWLEDGE',
            relationType: relationTypeMap[row.relationType] || 'ESSENTIAL'
          });
          count++;

          // 每5000条批量插入一次
          if (relations.length >= 5000) {
            isProcessing = true;
            readable.pause();
            const batch = relations;
            relations = [];

            models.occupationSkillRelation
              .bulkCreate(batch, { logging: false })
              .then(() => {
                console.log(`职业-技能关联导入进度: ${count}`);
                isProcessing = false;
                readable.resume();
              })
              .catch(err => {
                console.error('批量插入失败:', err);
                reject(err);
              });
          }
        })
        .on('end', async () => {
          try {
            if (relations.length > 0) {
              await models.occupationSkillRelation.bulkCreate(relations, { logging: false });
            }
            console.log(`成功导入 ${count} 条职业-技能关联数据`);
            resolve({ success: true, count });
          } catch (error) {
            console.error('职业-技能关联导入失败:', error);
            reject(error);
          }
        })
        .on('error', reject);
    });

    console.log('所有数据导入完成！');
    process.exit(0);
  } catch (error) {
    console.error('导入数据失败:', error);
    process.exit(1);
  }
})();
