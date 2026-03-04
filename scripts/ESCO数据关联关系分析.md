# ESCO 数据集关联关系分析

## 概述

ESCO (European Skills, Competences, Qualifications and Occupations) 是欧洲的多语言分类系统，用于链接技能、能力、资格和职业。本数据集包含 19 个 CSV 文件，涵盖了职业、技能、技能组、技能层级及其相互关系。

---

## 核心实体表

### 1. Occupations (职业表)
- **文件**: `occupations_en.csv`
- **记录数**: 3,043
- **主要字段**:
  - `concept_uri`: 职业 URI（主键）
  - `preferred_label`: 职业名称
  - `isco_group`: ISCO 职业分类代码
  - `code`: 职业代码
  - `alt_labels`: 别名标签
  - `description`: 描述
  - `status`: 状态

### 2. Skills (技能表)
- **文件**: `skills_en.csv`
- **记录数**: 13,960
- **主要字段**:
  - `concept_uri`: 技能 URI（主键）
  - `preferred_label`: 技能名称
  - `skill_type`: 技能类型（knowledge/skill/competence）
  - `reuse_level`: 复用级别（cross-sector/occupation-specific/transversal）
  - `description`: 描述

### 3. SkillGroups (技能组表)
- **文件**: `skillGroups_en.csv`
- **记录数**: 640
- **主要字段**:
  - `concept_uri`: 技能组 URI（主键）
  - `preferred_label`: 技能组名称
  - `code`: 代码

### 4. ISCOGroups (ISCO分类表)
- **文件**: `ISCOGroups_en.csv`
- **记录数**: 619
- **主要字段**:
  - `concept_uri`: ISCO URI（主键）
  - `code`: ISCO 代码
  - `preferred_label`: ISCO 职业分类名称

---

## 关联关系表

### 5. OccupationSkillRelations (职业-技能关联表)
- **文件**: `occupationSkillRelations_en.csv`
- **记录数**: 126,051（最大关联表）
- **主要字段**:
  - `occupation_uri`: 职业 URI → 关联 `occupations.concept_uri`
  - `occupation_label`: 职业名称
  - `skill_uri`: 技能 URI → 关联 `skills.concept_uri`
  - `skill_label`: 技能名称
  - `skill_type`: 技能类型
  - `relation_type`: 关系类型（essential/optional）

**关联说明**:
- 一个职业需要多个技能（essential 表示必需技能，optional 表示可选技能）
- 一个技能可以被多个职业使用

---

### 6. SkillSkillRelations (技能-技能关联表)
- **文件**: `skillSkillRelations_en.csv`
- **记录数**: 5,818
- **主要字段**:
  - `original_skill_uri`: 原始技能 URI → 关联 `skills.concept_uri`
  - `original_skill_type`: 原始技能类型
  - `related_skill_uri`: 相关技能 URI → 关联 `skills.concept_uri`
  - `related_skill_type`: 相关技能类型
  - `relation_type`: 关系类型（essential/optional）

**关联说明**:
- 技能之间存在层级或关联关系
- 例如：某个技能需要先掌握另一个技能

---

### 7. BroaderRelationsOccPillar (职业层级关系表)
- **文件**: `broaderRelationsOccPillar_en.csv`
- **记录数**: 3,648
- **主要字段**:
  - `concept_uri`: 子职业 URI
  - `concept_label`: 子职业名称
  - `broader_uri`: 父职业 URI → 关联 `ISCOGroups.concept_uri` 或其他职业 URI
  - `broader_label`: 父职业名称

**关联说明**:
- 定义职业之间的层级关系
- 例如："软件工程师" 是 "IT 专家" 的子类

---

### 8. BroaderRelationsSkillPillar (技能层级关系表)
- **文件**: `broaderRelationsSkillPillar_en.csv`
- **记录数**: 20,819
- **主要字段**:
  - `concept_uri`: 子技能 URI
  - `concept_label`: 子技能名称
  - `broader_uri`: 父技能 URI → 关联 `skillGroups.concept_uri` 或 `skills.concept_uri`
  - `broader_label`: 父技能名称

**关联说明**:
- 定义技能之间的层级关系
- 例如："Java 编程" 属于 "编程技能" → "计算机技能"

---

### 9. SkillsHierarchy (技能层级结构表)
- **文件**: `skillsHierarchy_en.csv`
- **记录数**: 640
- **主要字段**:
  - `level_0_uri`: 0级技能 URI
  - `level_1_uri`: 1级技能 URI
  - `level_2_uri`: 2级技能 URI
  - `level_3_uri`: 3级技能 URI
  - `description`: 描述

**关联说明**:
- 四级技能分类层级结构
  - Level 0: 主要类别（如 "language skills and knowledge"）
  - Level 1: 子类别（如 "languages"）
  - Level 2: 具体领域（如 "classical languages"）
  - Level 3: 具体技能

---

### 10. GreenShareOcc (绿色职业关联表)
- **文件**: `greenShareOcc_en.csv`
- **记录数**: 3,590
- **主要字段**:
  - `concept_uri`: 职业 URI → 关联 `ISCOGroups.concept_uri`
  - `code`: ISCO 代码
  - `green_share`: 绿色技能占比（0-1之间的数值）

**关联说明**:
- 标记职业的绿色技能占比
- 用于绿色经济和可持续发展分析

---

## 专题技能集合表

### 11. DigitalSkillsCollection (数字技能集合)
- **记录数**: 1,284
- **关联**: 通过 `broader_concept_uri` 关联到 `skills.concept_uri`

### 12. GreenSkillsCollection (绿色技能集合)
- **记录数**: 629
- **关联**: 通过 `broader_concept_uri` 关联到 `skills.concept_uri`

### 13. TransversalSkillsCollection (通用技能集合)
- **记录数**: 95
- **关联**: 通过 `broader_concept_uri` 关联到 `skills.concept_uri`

### 14. LanguageSkillsCollection (语言技能集合)
- **记录数**: 359
- **关联**: 通过 `broader_concept_uri` 关联到 `skills.concept_uri`

### 15. DigCompSkillsCollection (数字素养技能集合)
- **记录数**: 25
- **关联**: 通过 `broader_concept_uri` 关联到 `skills.concept_uri`

### 16. ResearchSkillsCollection (研究技能集合)
- **记录数**: 40
- **关联**: 通过 `broader_concept_uri` 关联到 `skills.concept_uri`

### 17. ResearchOccupationsCollection (研究职业集合)
- **记录数**: 122
- **关联**: 通过 `broader_concept_uri` 关联到 `occupations.concept_uri`

---

## 元数据表

### 18. ConceptSchemes (概念方案表)
- **记录数**: 20
- **说明**: 定义各种概念方案（如职业方案、技能方案等）

### 19. Dictionary (字典表)
- **记录数**: 160
- **说明**: 数据字段定义和描述

---

## 数据关联关系图

```
Occupations (3,043)
    │
    ├── isco_group → ISCOGroups (619)
    │
    └── concept_uri → OccupationSkillRelations (126,051)
                         │
                         └── skill_uri → Skills (13,960)
                                        │
                                        ├── skillType
                                        ├── reuseLevel
                                        │
                                        ├── concept_uri → BroaderRelationsSkillPillar (20,819)
                                        │                   │
                                        │                   └── broader_uri → SkillGroups (640)
                                        │
                                        ├── original_skill_uri → SkillSkillRelations (5,818)
                                        │                          │
                                        │                          └── related_skill_uri → Skills
                                        │
                                        └── broader_concept_uri → 专题技能集合
                                                                   ├── DigitalSkillsCollection (1,284)
                                                                   ├── GreenSkillsCollection (629)
                                                                   ├── TransversalSkillsCollection (95)
                                                                   ├── LanguageSkillsCollection (359)
                                                                   ├── DigCompSkillsCollection (25)
                                                                   └── ResearchSkillsCollection (40)

Skills (13,960)
    │
    └── SkillsHierarchy (640) - 四级分类结构

Occupations
    │
    └── concept_uri → GreenShareOcc (3,590) - 绿色技能占比
```

---

## 关键关联说明

### 1. 职业与技能的关联
**表**: `occupation_skill_relations`
- 一个职业可以关联多个技能
- 关系类型：`essential`（必需）或 `optional`（可选）
- 技能类型：`knowledge`（知识）、`skill/competence`（技能/能力）

**SQL 查询示例**:
```sql
-- 查询某个职业的所有必需技能
SELECT o.preferred_label AS occupation, s.preferred_label AS skill
FROM occupation_skill_relations osr
JOIN occupations o ON osr.occupation_uri = o.concept_uri
JOIN skills s ON osr.skill_uri = s.concept_uri
WHERE o.preferred_label = 'technical director'
  AND osr.relation_type = 'essential';
```

---

### 2. 技能层级关系
**表**: `broader_relations_skill_pillar`
- 通过 `concept_uri` → `broader_uri` 建立父子关系
- 可以递归查询完整技能树

**SQL 查询示例**:
```sql
-- 递归查询技能层级
WITH RECURSIVE skill_tree AS (
  SELECT concept_uri, concept_label, broader_uri, broader_label, 1 AS level
  FROM broader_relations_skill_pillar
  WHERE concept_uri = 'http://data.europa.eu/esco/skill/xxx'

  UNION ALL

  SELECT brsp.concept_uri, brsp.concept_label, brsp.broader_uri, brsp.broader_label, st.level + 1
  FROM broader_relations_skill_pillar brsp
  JOIN skill_tree st ON brsp.concept_uri = st.broader_uri
)
SELECT * FROM skill_tree;
```

---

### 3. 技能之间的关联
**表**: `skill_skill_relations`
- 技能之间的前置或相关关系
- 关系类型：`essential`（必需）或 `optional`（可选）

**SQL 查询示例**:
```sql
-- 查询某个技能的相关技能
SELECT s1.preferred_label AS original_skill,
       s2.preferred_label AS related_skill,
       ssr.relation_type
FROM skill_skill_relations ssr
JOIN skills s1 ON ssr.original_skill_uri = s1.concept_uri
JOIN skills s2 ON ssr.related_skill_uri = s2.concept_uri
WHERE s1.preferred_label = 'Java programming';
```

---

### 4. 职业层级关系
**表**: `broader_relations_occ_pillar`
- 职业之间的父子关系
- 可以追溯职业分类

**SQL 查询示例**:
```sql
-- 查询某个职业的父级职业
SELECT o.preferred_label AS child_occupation,
       o2.preferred_label AS parent_occupation
FROM broader_relations_occ_pillar brop
JOIN occupations o ON brop.concept_uri = o.concept_uri
LEFT JOIN occupations o2 ON brop.broader_uri = o2.concept_uri
WHERE o.preferred_label = 'technical director';
```

---

### 5. 绿色技能分析
**表**: `green_share_occ` + `green_skills_collection`

**SQL 查询示例**:
```sql
-- 查询绿色技能占比最高的职业
SELECT ig.preferred_label AS occupation, gso.green_share
FROM green_share_occ gso
JOIN isco_groups ig ON gso.concept_uri = ig.concept_uri
ORDER BY gso.green_share DESC
LIMIT 10;
```

---

### 6. 专题技能查询
**表**: `digital_skills_collection`, `green_skills_collection`, 等

**SQL 查询示例**:
```sql
-- 查询所有数字技能
SELECT dsc.preferred_label, s.preferred_label AS skill_name
FROM digital_skills_collection dsc
LEFT JOIN skills s ON dsc.broader_concept_uri = s.concept_uri;
```

---

## 数据统计总结

| 表名 | 记录数 | 说明 |
|------|--------|------|
| occupations | 3,043 | 职业实体 |
| skills | 13,960 | 技能实体 |
| skill_groups | 640 | 技能分组 |
| isco_groups | 619 | ISCO分类 |
| occupation_skill_relations | 126,051 | 职业-技能关联 |
| broader_relations_skill_pillar | 20,819 | 技能层级 |
| skill_skill_relations | 5,818 | 技能关联 |
| broader_relations_occ_pillar | 3,648 | 职业层级 |
| skills_hierarchy | 640 | 技能四级分类 |
| digital_skills_collection | 1,284 | 数字技能 |
| green_skills_collection | 629 | 绿色技能 |
| green_share_occ | 3,590 | 绿色职业占比 |
| language_skills_collection | 359 | 语言技能 |
| transversal_skills_collection | 95 | 通用技能 |
| digcomp_skills_collection | 25 | 数字素养技能 |
| research_skills_collection | 40 | 研究技能 |
| research_occupations_collection | 122 | 研究职业 |
| concept_schemes | 20 | 概念方案 |
| dictionary | 160 | 数据字典 |

---

## 应用场景

### 1. 求职匹配
- 根据职位要求匹配应聘者的技能
- 识别缺失技能

### 2. 人才培养
- 分析职业发展路径
- 推荐学习技能顺序

### 3. 人才盘点
- 分析组织内的技能分布
- 识别关键技能人才

### 4. 绿色转型
- 识别绿色职业和技能
- 分析绿色技能需求

### 5. 政策制定
- 分析劳动力市场技能需求
- 预测技能发展趋势

---

## 数据导入建议

### 1. 按顺序导入
1. 先导入元数据表（dictionary, concept_schemes）
2. 再导入基础实体表（isco_groups, skill_groups）
3. 然后导入主实体表（occupations, skills）
4. 最后导入关联关系表

### 2. 创建索引
```sql
-- 在主键和外键上创建索引
CREATE INDEX idx_occupations_uri ON occupations(concept_uri);
CREATE INDEX idx_skills_uri ON skills(concept_uri);
CREATE INDEX idx_occupation_skill_occ ON occupation_skill_relations(occupation_uri);
CREATE INDEX idx_occupation_skill_skill ON occupation_skill_relations(skill_uri);
```

### 3. 创建外键约束
```sql
ALTER TABLE occupation_skill_relations
ADD CONSTRAINT fk_occ_skill_occ FOREIGN KEY (occupation_uri) REFERENCES occupations(concept_uri);

ALTER TABLE occupation_skill_relations
ADD CONSTRAINT fk_occ_skill_skill FOREIGN KEY (skill_uri) REFERENCES skills(concept_uri);
```
