import { createWithIntlProvider, useIntl } from '@kne/react-intl';
import zhCN from './locale/zh-CN';
import enUS from './locale/en-US';

const withLocale = createWithIntlProvider({
  defaultLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  },
  namespace: 'ai-talent-saas:AIInterviewSetting'
});

export const FormatMessage = withLocale(props => {
  const { formatMessage } = useIntl();
  return formatMessage(props);
});

export default withLocale;
