const language = () => {
  return [
    { value: 'zh-CN', description: '中文', type: 'success' },
    { value: 'en-US', description: '英文', type: 'info' }
  ];
};

export const createLanguage = formatMessage => () => [
  { value: 'zh-CN', description: formatMessage({ id: 'enumLoader.languageZhCN' }), type: 'success' },
  { value: 'en-US', description: formatMessage({ id: 'enumLoader.languageEnUS' }), type: 'info' }
];

export default language;
