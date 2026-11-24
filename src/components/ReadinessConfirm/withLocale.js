import { createWithIntlProvider, useIntl } from '@kne/react-intl';
import zhCN from './locale/zh-CN';
import enUS from './locale/en-US';

const withLocale = createWithIntlProvider({
  defaultLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  },
  namespace: 'ai-talent-saas'
});

export const FormatMessage = withLocale(({ values, ...props }) => {
  const { formatMessage } = useIntl();
  return formatMessage(props, values);
});

export default withLocale;
