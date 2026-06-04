import { createFormatMessage } from './withLocale';

const language = ({ locale }) => {
  const formatMessage = createFormatMessage(locale);
  return [
    { value: 'zh-CN', description: formatMessage({ id: 'enumLoader.languageZhCN' }), type: 'success' },
    { value: 'en-US', description: formatMessage({ id: 'enumLoader.languageEnUS' }), type: 'info' }
  ];
};

export default language;
