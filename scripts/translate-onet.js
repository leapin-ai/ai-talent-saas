const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 翻译映射表
const translations = {
  // Read Me
  'O*NET 30.1 Database': 'O*NET 30.1 数据库',
  'December 2025 Release': '2025年12月发布',
  'For information on current and future releases of the O*NET database,': '关于O*NET数据库当前和未来发布的信息，',
  'please visit:': '请访问：',
  'For documentation on the contents and structure of these files,': '关于这些文件内容和结构的文档，',
  'The content of the O*NET 30.1 Database is licensed under a Creative Commons Attribution 4.0 International License.': 'O*NET 30.1 数据库的内容采用知识共享署名 4.0 国际许可证授权。',
  'For more information, please visit:': '欲了解更多信息，请访问：',

  // 通用字段
  'Scale ID': '量表ID',
  'Category': '分类',
  'Category Description': '分类描述',
  'Scale Name': '量表名称',
  'Minimum': '最小值',
  'Maximum': '最大值',
  'Yearly or less': '每年或更少',
  'More than yearly': '每年以上',
  'More than monthly': '每月以上',
  'More than weekly': '每周以上',
  'Daily': '每天',
  'Several times daily': '每天多次',
  'Hourly or more': '每小时或更多',

  // Scale Names
  'Automation': '自动化',
  'Frequency': '频率',
  'Amount of Contact': '接触量',
  'Context': '情境',
  'Context (Categories 1-3)': '情境（分类1-3）',
  'Context (Categories 1-5)': '情境（分类1-5）',
  'Distinctiveness Rank': '独特性排名',
  'Extent': '程度',
  'Amount of Freedom': '自由度',
  'Frequency of Task (Categories 1-7)': '任务频率（分类1-7）',
  'Hours Per Week': '每周小时数',
  'Occupational Interest High-Point': '职业兴趣高点',
  'Importance': '重要性',
  'Impact of Decisions': '决策影响',
  'Level of Competition': '竞争水平',
  'Level': '级别',
  'Occupational Interests': '职业兴趣',
  'On-The-Job Training (Categories 1-9)': '在职培训（分类1-9）',
  'On-Site Or In-Plant Training (Categories 1-9)': '现场或厂内培训（分类1-9）',
  'Proximity': '接近度',
  'Responsibility': '责任',
  'Required Level Of Education (Categories 1-12)': '所需教育水平（分类1-12）',
  'Relevance of Task': '任务相关性',
  'Related Work Experience (Categories 1-11)': '相关工作经验（分类1-11）',
  'How Serious': '严重程度',
  '% Time': '时间百分比',
  'Work Value High-Point': '工作价值观高点',
  'Work Styles Impact': '工作风格影响',
  'Work Schedule': '工作时间',

  // Abilities (能力)
  'Oral Comprehension': '口头理解能力',
  'Written Comprehension': '书面理解能力',
  'Oral Expression': '口头表达能力',
  'Written Expression': '书面表达能力',
  'Fluency of Ideas': '思维流畅性',
  'Originality': '独创性',
  'Problem Sensitivity': '问题敏感度',
  'Deductive Reasoning': '演绎推理',
  'Inductive Reasoning': '归纳推理',
  'Information Ordering': '信息排序',
  'Category Flexibility': '分类灵活性',
  'Mathematical Reasoning': '数学推理',
  'Number Facility': '数字运用',
  'Memorization': '记忆力',
  'Speed of Closure': '闭合速度',
  'Flexibility of Closure': '闭合灵活性',
  'Perceptual Speed': '感知速度',
  'Spatial Orientation': '空间定向',
  'Visualization': '可视化',
  'Selective Attention': '选择性注意力',
  'Time Sharing': '时间分配',
  'Arm-Hand Steadiness': '手臂稳定性',
  'Manual Dexterity': '手部灵巧度',
  'Finger Dexterity': '手指灵巧度',
  'Control Precision': '控制精度',
  'Multilimb Coordination': '多肢体协调',
  'Response Orientation': '反应定向',
  'Reaction Time': '反应时间',
  'Rate Control': '速率控制',
  'Wrist-Finger Speed': '手腕-手指速度',
  'Speed of Arm Movement': '手臂运动速度',
  'Explosive Strength': '爆发力',
  'Dynamic Strength': '动态力量',
  'Trunk Strength': '躯干力量',
  'Static Strength': '静态力量',
  'Stamina': '耐力',
  'Extent Flexibility': '伸展灵活性',
  'Dynamic Flexibility': '动态灵活性',
  'Gross Body Coordination': '全身协调',
  'Gross Body Equilibrium': '全身平衡',
  'Near Vision': '近距离视觉',
  'Far Vision': '远距离视觉',
  'Visual Color Discrimination': '颜色辨别',
  'Night Vision': '夜视能力',
  'Depth Perception': '深度感知',
  'Glare Sensitivity': '眩光敏感度',
  'Hearing Sensitivity': '听觉敏感度',
  'Auditory Attention': '听觉注意力',
  'Sound Localization': '声源定位',
  'Speech Recognition': '语音识别',
  'Speech Clarity': '语音清晰度',
  'Written Expression': '书面表达能力',

  // Work Activities (工作活动)
  'Making Decisions and Solving Problems': '决策和解决问题',
  'Analyzing Data or Information': '分析数据或信息',
  'Thinking Creatively': '创造性思维',
  'Interpreting the Meaning of Information for Others': '为他人解释信息含义',
  'Performing for or Working Directly with the Public': '直接为公众表演或工作',
  'Developing Objectives and Strategies': '制定目标和策略',
  'Scheduling Work and Activities': '安排工作和活动',
  'Organizing, Planning, and Prioritizing Work': '组织、规划和优先安排工作',
  'Performing Administrative Activities': '执行行政活动',
  'Staffing Organizational Units': '配备组织单位人员',
  'Getting Information': '获取信息',
  'Monitor Processes, Materials, or Surroundings': '监控流程、材料或环境',
  'Inspecting Equipment, Structures, or Material': '检查设备、结构或材料',
  'Estimating the Quantifiable Characteristics of Products, Events, or Information': '估计产品、事件或信息的可量化特征',
  'Judging the Qualities of Things, Services, or People': '判断事物、服务或人员的质量',
  'Identifying Objects, Actions, and Events': '识别物体、动作和事件',
  'Updating and Using Relevant Knowledge': '更新和使用相关知识',
  'Developing and Building Teams': '发展和建立团队',
  'Training and Teaching Others': '培训和教导他人',
  'Providing Consultation and Advice to Others': '为他人提供咨询和建议',
  'Coordinating the Work and Activities of Others': '协调他人的工作和活动',
  'Guiding, Directing, and Motivating Subordinates': '指导、指挥和激励下属',
  'Coaching and Developing Others': '辅导和发展他人',
  'Establishing and Maintaining Interpersonal Relationships': '建立和维护人际关系',
  'Communicating with Supervisors, Peers, or Subordinates': '与主管、同事或下属沟通',
  'Communicating with Persons Outside Organization': '与组织外人员沟通',
  'Performing Physical Activities': '执行体力活动',
  'Handling and Moving Objects': '处理和移动物体',
  'Controlling Machines and Processes': '控制机器和流程',
  'Operating Vehicles, Mechanized Devices, or Equipment': '操作车辆、机械化设备或装备',
  'Drafting, Laying Out, and Specifying Technical Devices, Parts, and Equipment': '起草、布局和规范技术设备、零件和装备',

  // Work Context (工作环境)
  'Interpersonal Relationships': '人际关系',
  'Physical Work Conditions': '物理工作条件',
  'Structural Job Characteristics': '结构性工作特征',

  // Skills (技能)
  'Active Listening': '积极倾听',
  'Critical Thinking': '批判性思维',
  'Active Learning': '主动学习',
  'Learning Strategies': '学习策略',
  'Monitoring': '监控',
  'Social Perceptiveness': '社会感知',
  'Coordination': '协调',
  'Instructing': '指导',
  'Service Orientation': '服务导向',
  'Complex Problem Solving': '复杂问题解决',
  'Operations Analysis': '运营分析',
  'Technology Design': '技术设计',
  'Equipment Selection': '设备选择',
  'Installation': '安装',
  'Programming': '编程',
  'Operation Monitoring': '操作监控',
  'Operation and Control': '操作和控制',
  'Equipment Maintenance': '设备维护',
  'Troubleshooting': '故障排除',
  'Repairing': '维修',
  'Quality Control Analysis': '质量控制分析',
  'Judgment and Decision Making': '判断和决策',
  'Systems Analysis': '系统分析',
  'Systems Evaluation': '系统评估',
  'Time Management': '时间管理',
  'Management of Financial Resources': '财务资源管理',
  'Management of Material Resources': '物料资源管理',
  'Management of Personnel Resources': '人力资源管理',
  'Reading Comprehension': '阅读理解',
  'Writing': '写作',
  'Speaking': '口语',
  'Science': '科学',
  'Mathematics': '数学',
  'Technology Skills': '技术技能',

  // Knowledge (知识)
  'Administration and Management': '行政和管理',
  'Administrative and Managerial': '行政和管理',
  'Administrative': '行政',
  'Management': '管理',
  'Customer and Personal Service': '客户和个人服务',
  'Personnel and Human Resources': '人员和人力资源',
  'Economics and Accounting': '经济学和会计',
  'Sales and Marketing': '销售和营销',
  'Mathematics': '数学',
  'Computers and Electronics': '计算机和电子',
  'Engineering and Technology': '工程和技术',
  'Design': '设计',
  'Building and Construction': '建筑和施工',
  'Mechanical': '机械',
  'Physics': '物理',
  'Chemistry': '化学',
  'Biology': '生物学',
  'Psychology': '心理学',
  'Sociology and Anthropology': '社会学和人类学',
  'Geography': '地理学',
  'History and Archeology': '历史和考古',
  'Philosophy and Theology': '哲学和神学',
  'Public Safety and Security': '公共安全和安保',
  'Law and Government': '法律和政府',
  'Telecommunications': '电信',
  'Communications and Media': '通信和媒体',
  'Education and Training': '教育和培训',
  'English Language': '英语语言',
  'Foreign Language': '外语',
  'Fine Arts': '美术',
  'History': '历史',
  'Philosophy': '哲学',

  // Work Styles (工作风格)
  'Achievement/Effort': '成就/努力',
  'Persistence': '坚持性',
  'Initiative': '主动性',
  'Independence': '独立性',
  'Social Influence': '社会影响力',
  'Leadership': '领导力',
  'Social Orientation': '社会取向',
  'Cooperation': '合作',
  'Concern for Others': '关心他人',
  'Self Control': '自我控制',
  'Stress Tolerance': '压力承受力',
  'Adaptability/Flexibility': '适应性/灵活性',
  'Integrity': '正直',
  'Attention to Detail': '注重细节',
  'Dependability': '可靠性',
  'Self Orientation': '自我取向',
  'Independence': '独立性',
  'Innovation': '创新',
  'Analytical Thinking': '分析思维',
  'Attention to Detail': '注重细节',

  // Work Values (工作价值观)
  'Achievement': '成就',
  'Recognition': '认可',
  'Independence': '独立',
  'Relationships': '人际关系',
  'Support': '支持',
  'Working Conditions': '工作条件',

  // Job Zones (工作区域)
  'Job Zone': '工作区域',
  'Job Zone One': '工作区域一',
  'Job Zone Two': '工作区域二',
  'Job Zone Three': '工作区域三',
  'Job Zone Four': '工作区域四',
  'Job Zone Five': '工作区域五',

  // Task Ratings (任务评级)
  'Task Rating': '任务评级',
  'Task': '任务',
  'Task Statements': '任务陈述',

  // Tools Used (使用的工具)
  'Tools Used': '使用的工具',
  'Technology Skills': '技术技能',

  // Education (教育)
  'Education, Training, and Experience': '教育、培训和经验',
  'Education': '教育',
  'Training': '培训',
  'Experience': '经验',

  // Interests (兴趣)
  'Interests': '兴趣',
  'RIASEC': 'RIASEC',
  'Realistic': '现实型',
  'Investigative': '研究型',
  'Artistic': '艺术型',
  'Social': '社会型',
  'Enterprising': '企业型',
  'Conventional': '常规型',

  // Occupations (职业)
  'Occupation Data': '职业数据',
  'Occupation Level Metadata': '职业级别元数据',
  'Alternate Titles': '其他称谓',
  'Sample of Reported Titles': '报告称谓样本',
  'Related Occupations': '相关职业',

  // Common values
  'Yes': '是',
  'No': '否',
  'High': '高',
  'Medium': '中',
  'Low': '低',
  'Very High': '很高',
  'Very Low': '很低',
  'Analyst': '分析师',
  'Job Analyst': '工作分析师',
  'Occupation Analyst': '职业分析师',
  'Worker': '工作者',
  'Occupation': '职业',
  'Job': '工作',
  'Task': '任务',
  'Skill': '技能',
  'Ability': '能力',
  'Knowledge': '知识',
  'Work Context': '工作环境',
  'Work Style': '工作风格',
  'Work Value': '工作价值',
  'Date': '日期',
  'Domain Source': '领域来源',
  'Data Value': '数据值',
  'N': '样本数',
  'Standard Error': '标准误差',
  'Lower CI Bound': '置信区间下限',
  'Upper CI Bound': '置信区间上限',
  'Recommend Suppress': '建议抑制',
  'Not Relevant': '不相关',
  'n/a': '不适用',
};

// 替换文本函数
function translateText(text) {
  if (!text) return text;
  let result = text;

  // 遍历翻译映射表
  for (const [english, chinese] of Object.entries(translations)) {
    const regex = new RegExp(escapeRegExp(english), 'gi');
    result = result.replace(regex, chinese);
  }

  return result;
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 处理单个文件
async function translateFile(inputPath, outputPath) {
  const inputStream = fs.createReadStream(inputPath, { encoding: 'utf8' });
  const outputStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: inputStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;

  for await (const line of rl) {
    const translatedLine = translateText(line);
    outputStream.write(translatedLine + '\n');
    lineCount++;

    if (lineCount % 1000 === 0) {
      console.log(`  已处理 ${lineCount} 行...`);
    }
  }

  outputStream.end();
  console.log(`  完成，共 ${lineCount} 行`);
}

// 主函数
async function main() {
  const inputDir = path.join(__dirname, '../db_30_1_text');
  const outputDir = path.join(__dirname, '../db_30_1_text_cn');

  // 创建输出目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 获取所有文件
  const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.txt'));

  console.log(`找到 ${files.length} 个文件需要翻译`);
  console.log('开始翻译...\n');

  // 逐个翻译文件
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    const fileName = file.replace('.txt', '');
    console.log(`翻译文件: ${fileName}`);
    await translateFile(inputPath, outputPath);
    console.log('');
  }

  console.log('所有文件翻译完成！');
  console.log(`输出目录: ${outputDir}`);
}

// 运行
main().catch(console.error);
