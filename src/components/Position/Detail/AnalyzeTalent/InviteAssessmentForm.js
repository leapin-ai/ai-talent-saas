import { createWithRemoteLoader } from '@kne/remote-loader';
import { Flex, Typography, Upload, message } from 'antd';
import { CloudUploadOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import { useCallback, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import withLocale from '../../withLocale';
import ExistingNeverEmployeesField from './ExistingNeverEmployeesField';
import style from './style.module.scss';

const TEMPLATE_HEADERS = ['姓名', '邮箱', '手机'];
const TEMPLATE_EXAMPLE = ['张三', 'zhangsan@example.com', '13800138000'];

const normalizeHeader = value =>
  String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();

const cellText = value => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
};

const mapRowsFromMatrix = matrix => {
  const rows = (Array.isArray(matrix) ? matrix : []).filter(row => Array.isArray(row) && row.some(cell => cellText(cell) !== ''));
  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0].map(normalizeHeader);
  const nameIdx = headers.findIndex(h => ['姓名', 'name', 'full name', 'fullname'].includes(h));
  const emailIdx = headers.findIndex(h => ['邮箱', 'email', '电子邮件', '邮件'].includes(h));
  const phoneIdx = headers.findIndex(h => ['手机', 'phone', 'mobile', '电话', '手机号'].includes(h));
  if (nameIdx < 0 && emailIdx < 0 && phoneIdx < 0) {
    return rows.map(cells => ({
      name: cellText(cells[0]),
      email: cellText(cells[1]),
      phone: cellText(cells[2])
    }));
  }
  return rows.slice(1).map(cells => ({
    name: cellText(cells[nameIdx]),
    email: cellText(cells[emailIdx]),
    phone: cellText(cells[phoneIdx])
  }));
};

const parseExcelFile = async file => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    return [];
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  return mapRowsFromMatrix(matrix);
};

const downloadExcelTemplate = () => {
  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');
  XLSX.writeFile(workbook, 'talent-collect-invite-template.xlsx');
};

const InviteAssessmentForm = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Global@usePreset', 'components-core:InfoPage', 'components-core:TablePage@Table']
})(
  withLocale(({ remoteModules, inviteType, positionId, onImportedChange }) => {
    const [FormInfo, usePreset, InfoPage, Table] = remoteModules;
    const { TableList } = FormInfo;
    const { Input, SuperSelect, DatePicker, PhoneNumber } = FormInfo.fields;
    const { apis } = usePreset();
    const { formatMessage } = useIntl();
    const [parsing, setParsing] = useState(false);
    const [importedList, setImportedList] = useState([]);
    const showExisting = inviteType === 'employee' && !!positionId;

    const projectApi = useMemo(
      () =>
        Object.assign({}, apis.talentSaas.tenant.aiInterview.projects, {
          params: Object.assign({}, apis.talentSaas.tenant.aiInterview.projects.params || {}, {
            perPage: 20,
            filter: { scene: 'dataCollection' }
          })
        }),
      [apis]
    );

    const updateImported = useCallback(
      next => {
        const list = typeof next === 'function' ? next(importedList) : next;
        setImportedList(list);
        onImportedChange?.(list);
      },
      [importedList, onImportedChange]
    );

    const handleUpload = useCallback(
      async file => {
        setParsing(true);
        try {
          const stamp = Date.now();
          const rows = (await parseExcelFile(file))
            .map((item, index) => ({
              _key: `import-${stamp}-${index}`,
              name: String(item.name || '').trim(),
              email: String(item.email || '').trim(),
              phone: String(item.phone || '').trim()
            }))
            .filter(item => item.name || item.email || item.phone);
          if (rows.length === 0) {
            message.warning(formatMessage({ id: 'position.talentInviteParseEmpty' }));
            return false;
          }
          updateImported(rows);
          message.success(formatMessage({ id: 'position.talentInviteParseSuccess' }, { count: rows.length }));
        } catch (e) {
          message.error(e.message || formatMessage({ id: 'position.talentInviteParseFailed' }));
        } finally {
          setParsing(false);
        }
        return false;
      },
      [formatMessage, updateImported]
    );

    const importedColumns = useMemo(
      () => [
        {
          name: 'name',
          title: formatMessage({ id: 'position.talentInviteName' }),
          getValueOf: item => item.name || '—'
        },
        {
          name: 'email',
          title: formatMessage({ id: 'position.talentInviteEmail' }),
          getValueOf: item => item.email || '—'
        },
        {
          name: 'phone',
          title: formatMessage({ id: 'position.talentInvitePhone' }),
          getValueOf: item => item.phone || '—'
        },
        {
          name: 'options',
          title: formatMessage({ id: 'position.talentInviteActions' }),
          width: 72,
          fixed: 'right',
          renderType: 'options',
          getValueOf: item => [
            {
              type: 'link',
              danger: true,
              icon: <DeleteOutlined />,
              children: '',
              onClick: () => {
                updateImported(list => list.filter(row => row._key !== item._key));
              }
            }
          ]
        }
      ],
      [formatMessage, updateImported]
    );

    return (
      <Flex vertical gap={24} className={style['invite-form']}>
        <FormInfo
          column={1}
          list={[
            <SuperSelect
              name="assessmentProject"
              label={formatMessage({ id: 'position.talentInviteProject' })}
              rule="REQ"
              single
              labelKey="name"
              valueKey="id"
              api={projectApi}
              placeholder={formatMessage({ id: 'position.talentInviteSelect' })}
              getSearchProps={({ searchText }) => ({
                filter: {
                  scene: 'dataCollection',
                  name: searchText
                }
              })}
              dataFormat={data => ({
                list: data.pageData || [],
                total: data.totalCount || 0
              })}
              pagination={{
                paramsType: 'params'
              }}
            />,
            <DatePicker name="deadline" label={formatMessage({ id: 'position.talentInviteDeadline' })} rule="REQ" placeholder={formatMessage({ id: 'position.talentInviteSelect' })} />
          ]}
        />
        <InfoPage.Part
          title={formatMessage({ id: 'position.talentInviteBatchImport' })}
          extra={
            <Typography.Link
              onClick={e => {
                e.preventDefault();
                downloadExcelTemplate();
              }}
            >
              <DownloadOutlined style={{ marginRight: 4 }} />
              {formatMessage({ id: 'position.talentInviteDownloadTemplate' })}
            </Typography.Link>
          }
        >
          <div className={style['invite-batch']}>
            <Upload.Dragger
              className={style['invite-upload']}
              multiple={false}
              maxCount={1}
              showUploadList={false}
              beforeUpload={file => {
                const name = (file?.name || '').toLowerCase();
                if (!(name.endsWith('.xlsx') || name.endsWith('.xls'))) {
                  message.warning(formatMessage({ id: 'position.talentInviteExcelOnly' }));
                  return Upload.LIST_IGNORE;
                }
                handleUpload(file);
                return false;
              }}
              accept=".xlsx,.xls"
              disabled={parsing}
            >
              <p className="ant-upload-drag-icon">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text">{formatMessage({ id: 'position.talentInviteUploadHint' })}</p>
              <p className="ant-upload-hint">{formatMessage({ id: 'position.talentInviteUploadTypes' })}</p>
            </Upload.Dragger>
            {importedList.length > 0 ? (
              <Table
                className={style['invite-import-table']}
                name="invite-assessment-import"
                size="small"
                rowKey="_key"
                controllerOpen={false}
                pagination={false}
                columns={importedColumns}
                dataSource={importedList}
                scroll={{ y: 180, x: undefined }}
              />
            ) : null}
          </div>
        </InfoPage.Part>
        {showExisting ? <FormInfo title={formatMessage({ id: 'position.talentInviteExistingEmployees' })} column={1} list={[<ExistingNeverEmployeesField name="existingEmployees" positionId={positionId} block />]} /> : null}
        <TableList
          title={formatMessage({ id: 'position.talentInviteManualEntry' })}
          name="participants"
          minLength={0}
          list={[
            <Input name="name" label={formatMessage({ id: 'position.talentInviteName' })} placeholder={formatMessage({ id: 'position.talentInviteEnter' })} rule="LEN-0-100" />,
            <Input name="email" label={formatMessage({ id: 'position.talentInviteEmail' })} placeholder={formatMessage({ id: 'position.talentInviteEnter' })} rule="EMAIL LEN-0-100" />,
            <PhoneNumber name="phone" label={formatMessage({ id: 'position.talentInvitePhone' })} format="string" placeholder={formatMessage({ id: 'position.talentInviteEnter' })} />
          ]}
        />
      </Flex>
    );
  })
);

export default InviteAssessmentForm;
