import { useRef } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import { useIntl } from '@kne/react-intl';
import ShareReportFormInner from './ShareReportFormInner';
import { FormatMessage } from './withLocale';

const DEFAULT_TTL_DAYS = 7;

const normalizeEmails = value => [...new Set((Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean))];

/**
 * 列表多选「分享报告」弹窗。
 * kind=position：发给填写的邮箱；kind=employee：可选发给本人或指定邮箱。
 * useFormModal / usePreset 由调用方从远程模块传入。
 */
const useShareReport = ({ kind, useFormModal, usePreset, getName }) => {
  const formModal = useFormModal();
  const { apis, ajax } = usePreset();
  const { locale } = useIntl();
  const seqRef = useRef(0);
  const isEmployee = kind === 'employee';

  return rows => {
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) {
      message.warning(<FormatMessage id="shareReport.noSelection" />);
      return;
    }
    seqRef.current += 1;
    const api = formModal({
      title: <FormatMessage id={isEmployee ? 'shareReport.employeeTitle' : 'shareReport.positionTitle'} />,
      size: 'small',
      saveText: <FormatMessage id="shareReport.send" />,
      formProps: {
        data: Object.assign(
          {
            deadline: dayjs().add(DEFAULT_TTL_DAYS, 'day')
          },
          isEmployee ? { mode: 'self' } : {}
        ),
        onSubmit: async formData => {
          const mode = isEmployee ? formData.mode : 'specified';
          const emails = mode === 'specified' ? normalizeEmails(formData.emails) : [];
          const sendApi = isEmployee ? apis.talentSaas.tenant.shareReport.sendEmployee : apis.talentSaas.tenant.shareReport.sendPosition;
          const { data: res } = await ajax(
            Object.assign({}, sendApi, {
              data: Object.assign(
                {
                  ids: list.map(item => String(item.id)),
                  emails,
                  deadline: formData.deadline,
                  // 邮件语言跟当前系统语言：仅 zh-CN 中文，其余默认英文
                  language: locale === 'zh-CN' ? 'zh-CN' : 'en-US'
                },
                isEmployee ? { mode } : {}
              )
            })
          );
          if (res.code !== 0) {
            return false;
          }
          const success = Array.isArray(res.data?.success) ? res.data.success : [];
          const failed = [...(res.data?.itemFailed || []), ...(res.data?.failed || [])];
          if (failed.length) {
            const nameById = new Map(list.map(item => [String(item.id), getName(item)]));
            const reasons = failed
              .slice(0, 3)
              .map(item => `${item.email || item.name || nameById.get(String(item.id)) || ''}: ${item.reason || ''}`)
              .join('；');
            message.warning(<FormatMessage id="shareReport.partial" values={{ success: success.length, failed: failed.length, reasons }} />);
          } else {
            message.success(<FormatMessage id="shareReport.success" values={{ count: success.length }} />);
          }
          if (!success.length) {
            return false;
          }
          api.close();
        }
      },
      children: <ShareReportFormInner key={`share-report-${kind}-${seqRef.current}`} kind={kind} names={list.map(getName)} />
    });
  };
};

export default useShareReport;
