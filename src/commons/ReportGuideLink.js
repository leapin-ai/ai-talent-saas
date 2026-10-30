import { Button } from 'antd';
import { ReadOutlined } from '@ant-design/icons';
import { createWithIntlProvider, useIntl } from '@kne/react-intl';

const DOC_URL = 'https://develop.leapin-ai.com/share?type=document&id={id}';

const withLocale = createWithIntlProvider({
  defaultLocale: 'zh-CN',
  messages: {
    'zh-CN': {
      'reportGuide.label': '报告指南',
      'reportGuide.employee': '374015389094380544',
      'reportGuide.position': '374393355989156864'
    },
    'en-US': {
      'reportGuide.label': 'Report Guide',
      'reportGuide.employee': '374015259553301504',
      'reportGuide.position': '374393579004494848'
    }
  },
  namespace: 'ai-talent-saas-report-guide'
});

/** 员工 / 岗位报告的说明文档入口；自带 provider，分享页锁定的语言也能取到对应文档 */
const ReportGuideLink = withLocale(({ type }) => {
  const { formatMessage } = useIntl();
  return (
    <Button type="link" icon={<ReadOutlined />} href={DOC_URL.replace('{id}', formatMessage({ id: `reportGuide.${type}` }))} target="_blank" rel="noopener noreferrer">
      {formatMessage({ id: 'reportGuide.label' })}
    </Button>
  );
});

export default ReportGuideLink;
