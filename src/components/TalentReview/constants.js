import dayjs from 'dayjs';
import gridDefaults from './gridDefaults.json';

export const DIMENSION_TYPES = ['potential', 'competency', 'values', 'custom'];

export const MANUAL_ROLES = ['superior', 'peer'];

/** open-api 只有 open/closed，列表状态按时间与邀请情况推导 */
export const getProjectStatus = project => {
  const now = dayjs();
  if (project.status === 'closed') {
    return (project.progress?.invited || 0) > 0 ? 'completed' : 'draft';
  }
  if (project.startTime && dayjs(project.startTime).isAfter(now)) {
    return 'notStarted';
  }
  if (project.endTime && dayjs(project.endTime).isBefore(now)) {
    return 'completed';
  }
  return 'inProgress';
};

export const getDimensionList = project => {
  const list = project?.setting?.dimensions;
  return Array.isArray(list) ? list.filter(item => item?.type) : [];
};

export const formatDate = value => (value ? dayjs(value).format('YYYY-MM-DD') : '');

export const formatDateTime = value => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '');

/** 筛选项值可能是 { label, value } 或原始值 */
export const filterValueOf = value => (value && typeof value === 'object' ? value.value : value);

export const BIZ_UNIT_FILTER = (value, getFilterValue) => ({ filter: getFilterValue(value) });

/** open-api 列表不支持服务端筛选分页：BizUnit loader 在前端过滤后分页，match(item, filter) 返回是否保留 */
export const localPage = (list, params = {}, match) => {
  const filter = params.filter || {};
  const perPage = Number(params.perPage) || 10;
  const currentPage = Number(params.currentPage) || 1;
  const rows = (list || []).filter(item =>
    match(
      item,
      filter,
      String(filterValueOf(filter.keyword) || '')
        .trim()
        .toLowerCase()
    )
  );
  return { pageData: rows.slice((currentPage - 1) * perPage, currentPage * perPage), totalCount: rows.length };
};

/** 3x3 / 2x2 视觉行列 → 格子 index（第 0 行为高潜，第 0 列为低绩效） */
const LOCATIONS = {
  3: [
    [6, 3, 1],
    [8, 5, 2],
    [9, 7, 4]
  ],
  2: [
    [3, 1],
    [4, 2]
  ]
};

export const getLocation = (row, col, size) => LOCATIONS[size][row][col];

export const GRID_COLORS = {
  9: ['#C1C0FF', '#E4EAE5', '#DBE6DD', '#F3D7C7', '#E4E4EF', '#E4EAE5', '#FAC4A6', '#F3D7C7', '#C1C0FF'],
  4: ['#C1C0FF', '#DBE6DD', '#FAC4A6', '#C1C0FF']
};

export const getGridSize = gridType => ([4, 2].includes(Number(gridType)) ? 2 : 3);

const langKey = locale =>
  String(locale || '')
    .toLowerCase()
    .startsWith('en')
    ? 'en'
    : 'zh';

/** 默认格子文案；无绩效的 1D 预览复用 2D 首列同 index 的格子 */
export const getDefaultCellMap = (gridType, dimension, locale) => {
  const cells = gridDefaults[String(gridType)]?.[dimension] || gridDefaults[String(gridType)]?.potential || [];
  const lang = langKey(locale);
  return cells.reduce((result, cell) => {
    result[cell.index] = {
      title: cell.name?.[lang] || '',
      description: cell.description?.[lang] || '',
      recommendation: cell.recommendation?.[lang] || ''
    };
    return result;
  }, {});
};

export const resolveCell = (nineSquareGrid, gridType, dimension, index, locale) => {
  const saved = nineSquareGrid?.[dimension]?.cells?.[gridType]?.[index];
  const fallback = getDefaultCellMap(gridType, dimension, locale)[index] || {};
  return {
    title: saved?.title || fallback.title || '',
    description: saved?.description || fallback.description || '',
    recommendation: saved?.recommendation || fallback.recommendation || ''
  };
};

export const QUESTION_TYPES = [
  { value: 'RadioGroup', labelId: 'questionTypeSingle', hasOptions: true },
  { value: 'CheckboxGroup', labelId: 'questionTypeMultiple', hasOptions: true },
  { value: 'TextArea', labelId: 'questionTypeBlank', hasOptions: false },
  { value: 'Video', labelId: 'questionTypeVideo', hasOptions: false, disabled: true }
];

export const LANGUAGES = [
  { value: 'zh-CN', labelId: 'languageZh' },
  { value: 'en-US', labelId: 'languageEn' }
];
