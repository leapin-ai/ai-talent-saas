import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button, Dropdown, Flex, message } from 'antd';
import { MailOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TENANT_ADMIN_PERMISSIONS } from '@components/TenantAdmin/constants';
import withLocale from '../../withLocale';
import InviteAssessmentForm from './InviteAssessmentForm';
import style from './style.module.scss';

const hasContact = value => {
  if (value == null || value === '') {
    return false;
  }
  if (typeof value === 'object') {
    const number = value.number ?? value.phone ?? value.value;
    return number != null && String(number).trim() !== '';
  }
  return String(value).trim() !== '';
};

const normalizeParticipant = item => {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const name = String(item.name || '').trim();
  const email = String(item.email || '').trim();
  const phone = typeof item.phone === 'object' ? (item.phone?.number ?? item.phone?.phone ?? item.phone?.value ?? '') : item.phone;
  const phoneText = phone != null ? String(phone).trim() : '';
  if (!name && !email && !phoneText) {
    return null;
  }
  return {
    name,
    email,
    phone: phoneText
  };
};

const InviteAssessment = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:Global@usePreset', 'components-core:Permissions@usePermissionsPass']
})(
  withLocale(({ remoteModules, positionId, baseUrl = '', className, ...rest }) => {
    const [useFormModal, usePreset, usePermissionsPass] = remoteModules;
    const formModal = useFormModal();
    const { apis, ajax } = usePreset();
    const { formatMessage, locale } = useIntl();
    const navigate = useNavigate();
    const importedRef = useRef([]);
    const modalSeqRef = useRef(0);
    const canInvite = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionInvite });
    const canInviteRecords = usePermissionsPass({ request: TENANT_ADMIN_PERMISSIONS.positionInviteRecords });

    const goInviteRecords = () => {
      navigate(`${baseUrl}/position/${positionId}/invite-records`);
    };

    const openInviteModal = inviteType => {
      if (!canInvite) {
        return;
      }
      const typeLabel = formatMessage({
        id: inviteType === 'manager' ? 'position.talentInviteManager' : 'position.talentInviteEmployee'
      });
      const title = formatMessage({
        id: inviteType === 'manager' ? 'position.talentInviteManagersTitle' : 'position.talentInviteEmployeesTitle'
      });
      importedRef.current = [];
      modalSeqRef.current += 1;
      const modalSeq = modalSeqRef.current;
      const api = formModal({
        title,
        size: 'large',
        saveText: formatMessage({ id: 'position.talentInviteSend' }),
        footer: canInviteRecords ? (
          <Button
            type="default"
            icon={<UnorderedListOutlined />}
            onClick={() => {
              api.close();
              goInviteRecords();
            }}
          >
            {formatMessage({ id: 'position.talentInviteViewRecords' })}
          </Button>
        ) : null,
        formProps: {
          data: {
            participants: [{}],
            existingEmployees: [],
            inviteType,
            // 每次打开清空，避免二次邀请沿用上次项目选择
            assessmentProject: undefined
          },
          onSubmit: async data => {
            if (!positionId) {
              message.error(formatMessage({ id: 'position.talentInviteMissingPosition' }));
              return false;
            }
            const project = data.assessmentProject || {};
            const assessmentProject =
              project && typeof project === 'object'
                ? {
                    id: project.id || project.value,
                    name: project.name || project.label || ''
                  }
                : data.assessmentProject;
            if (!assessmentProject || (typeof assessmentProject === 'object' && !assessmentProject.id)) {
              message.warning(formatMessage({ id: 'position.talentInviteSelect' }));
              return false;
            }
            const manual = (Array.isArray(data.participants) ? data.participants : []).map(normalizeParticipant).filter(Boolean);
            const imported = (importedRef.current || []).map(normalizeParticipant).filter(Boolean);
            const existing = (Array.isArray(data.existingEmployees) ? data.existingEmployees : []).map(normalizeParticipant).filter(Boolean);
            const participants = [...existing, ...imported, ...manual].filter(item => item.name && (hasContact(item.email) || hasContact(item.phone)));
            if (participants.length === 0) {
              message.warning(formatMessage({ id: 'position.talentInviteNeedParticipants' }));
              return false;
            }
            const { data: res } = await ajax(
              Object.assign({}, apis.talentSaas.tenant.talentCollectInvite.send, {
                data: {
                  positionId: String(positionId),
                  inviteType,
                  assessmentProject,
                  deadline: data.deadline,
                  // 邀请邮件/短信跟当前系统语言：仅 zh-CN 中文，其余默认英文
                  language: locale === 'zh-CN' ? 'zh-CN' : 'en-US',
                  participants
                }
              })
            );
            if (res.code !== 0) {
              message.error(res.msg || formatMessage({ id: 'position.talentInviteSendFailed' }));
              return false;
            }
            const successCount = Array.isArray(res.data?.success) ? res.data.success.length : 0;
            const failed = Array.isArray(res.data?.failed) ? res.data.failed : [];
            if (failed.length > 0) {
              const reasons = failed
                .slice(0, 3)
                .map(item => `#${(item.index ?? 0) + 1}: ${item.reason || ''}`)
                .join('；');
              message.warning(
                formatMessage(
                  { id: 'position.talentInvitePartial' },
                  {
                    success: successCount,
                    failed: failed.length,
                    reasons
                  }
                )
              );
            } else {
              message.success(formatMessage({ id: 'position.talentInviteSuccess' }, { type: typeLabel, count: successCount }));
            }
            if (successCount === 0) {
              return false;
            }
            api.close();
            if (canInviteRecords) {
              goInviteRecords();
            }
          }
        },
        children: (
          <InviteAssessmentForm
            key={`invite-assessment-${inviteType}-${modalSeq}`}
            inviteType={inviteType}
            positionId={positionId}
            onImportedChange={list => {
              importedRef.current = Array.isArray(list) ? list : [];
            }}
          />
        )
      });
    };

    if (!canInvite && !canInviteRecords) {
      return null;
    }

    const size = rest.size || 'small';
    const recordsBtn = canInviteRecords ? (
      <Button type="default" size={size} icon={<UnorderedListOutlined />} onClick={goInviteRecords} className={className}>
        {formatMessage({ id: 'position.talentInviteViewRecords' })}
      </Button>
    ) : null;

    if (!canInvite) {
      return recordsBtn;
    }

    return (
      <Flex gap={8} wrap="wrap" align="center">
        <Dropdown
          trigger={['click']}
          placement="bottomLeft"
          classNames={{ root: style['invite-dropdown'] }}
          menu={{
            items: [
              {
                key: 'employee',
                label: formatMessage({ id: 'position.talentInviteEmployee' }),
                onClick: () => openInviteModal('employee')
              },
              {
                key: 'manager',
                label: formatMessage({ id: 'position.talentInviteManager' }),
                onClick: () => openInviteModal('manager')
              }
            ]
          }}
        >
          <Button type="default" size={size} icon={<MailOutlined />} className={[style['invite-btn'], className].filter(Boolean).join(' ')}>
            {formatMessage({ id: 'position.talentInvite' })}
          </Button>
        </Dropdown>
        {recordsBtn}
      </Flex>
    );
  })
);

export default InviteAssessment;
