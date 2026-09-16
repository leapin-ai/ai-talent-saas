import { Input, Spin, Typography, message } from 'antd';
import { CloudUploadOutlined, InfoCircleOutlined, LinkedinFilled, LockOutlined } from '@ant-design/icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { useFileUpload } from '@kne/react-file';
import '@kne/react-file/dist/index.css';
import get from 'lodash/get';
import { FILE_DIRECTORY } from '@components/Apis';
import style from './style.module.scss';

const ACCEPT = ['.pdf', '.doc', '.docx'];
const FILE_SIZE_MB = 10;

const matchAccept = file => {
  const name = (file?.name || '').toLowerCase();
  return ACCEPT.some(ext => name.endsWith(ext));
};

const UploadStep = ({ usePreset, DragAreaOuter, UploadTips, UploadButton, FileList, ajax, apis, value, onChange }) => {
  const { formatMessage } = useIntl();
  const { apis: presetApis } = usePreset();
  const [parsing, setParsing] = useState(false);
  const parsedIdRef = useRef(null);
  const linkedinRef = useRef(value?.linkedin || '');
  // 受控回显：父级传入的 linkedin（含空串）优先，避免返回上一步后仍读旧 ref
  linkedinRef.current = value?.linkedin != null ? String(value.linkedin) : linkedinRef.current;
  const resumes = Array.isArray(value?.resumes) ? value.resumes : [];

  const latestLinkedin = () => linkedinRef.current || '';

  const applyList = useCallback(
    async nextList => {
      const list = Array.isArray(nextList) ? nextList : [];
      const done = list.filter(item => item && item.type !== 'uploading' && (item.id || item.ossId));
      if (done.length === 0) {
        parsedIdRef.current = null;
        onChange?.({ resumes: list, parsed: null, linkedin: latestLinkedin() });
        return;
      }
      const file = done[0];
      const fileId = file.id || file.ossId;
      if (parsedIdRef.current === fileId && value?.parsed) {
        onChange?.({ resumes: list, parsed: value.parsed, linkedin: latestLinkedin() });
        return;
      }
      onChange?.({ resumes: list, parsed: value?.parsed || null, linkedin: latestLinkedin() });
      setParsing(true);
      try {
        const { data } = await ajax(
          Object.assign({}, apis.parseResume, {
            data: Object.assign({}, apis.parseResume?.data || {}, { id: fileId })
          })
        );
        if (data.code !== 0) {
          parsedIdRef.current = null;
          message.warning(data.msg || formatMessage({ id: 'tenantAdmin.completeUploadRequired' }));
          onChange?.({ resumes: list, parsed: null, linkedin: latestLinkedin() });
          return;
        }
        parsedIdRef.current = fileId;
        onChange?.({ resumes: list, parsed: data.data || null, linkedin: latestLinkedin() });
      } finally {
        setParsing(false);
      }
    },
    [ajax, apis.parseResume, formatMessage, onChange, value?.parsed]
  );

  const setList = useCallback(
    next => {
      const list = typeof next === 'function' ? next(resumes) : next;
      applyList(list);
    },
    [applyList, resumes]
  );

  const { fileList: uploadingList, onFileSelected } = useFileUpload({
    maxLength: 1,
    multiple: false,
    value: resumes,
    onChange: setList,
    concurrentCount: 1,
    fileSize: FILE_SIZE_MB,
    onSave: async (response, file, uuid) => {
      const data = get(response, 'data') || response || {};
      return Object.assign({}, data, {
        id: data.id || data.ossId,
        filename: data.filename || data.originName || file?.name,
        uuid
      });
    },
    onUpload: ({ file }) =>
      presetApis?.file?.upload?.({
        file,
        path: FILE_DIRECTORY.EMPLOYEE_RESUME
      })
  });

  const previewList = useMemo(() => [...uploadingList, ...resumes], [uploadingList, resumes]);
  const hasFiles = previewList.length > 0;

  const onDropFiles = e => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files || []).filter(matchAccept);
    if (files.length === 0) {
      message.warning(formatMessage({ id: 'tenantAdmin.completeUploadHint' }));
      return;
    }
    onFileSelected(files);
  };

  return (
    <div className={style['career-step']}>
      <section className={style['career-card']}>
        <div className={style['career-card-head']}>
          <div className={style['career-card-titles']}>
            <span className={style['career-card-title']}>{formatMessage({ id: 'tenantAdmin.completeCvSectionTitle' })}</span>
            <span className={style['badge-required']}>{formatMessage({ id: 'tenantAdmin.completeRequiredBadge' })}</span>
          </div>
          <p className={style['career-card-desc']}>{formatMessage({ id: 'tenantAdmin.completeCvSectionDesc' })}</p>
        </div>
        <Spin
          spinning={parsing || uploadingList.length > 0}
          tip={formatMessage({
            id: parsing ? 'tenantAdmin.completeResumeParsing' : 'tenantAdmin.completeResumeUploading'
          })}
        >
          <DragAreaOuter accept={ACCEPT} fileSize={FILE_SIZE_MB} maxLength={1} onFileSelected={onFileSelected}>
            <div
              className={style['upload-zone']}
              onDragEnter={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={onDropFiles}
            >
              {hasFiles ? (
                <div className={style['upload-list']}>
                  <FileList
                    dataSource={previewList}
                    getPermission={type => ['preview', 'delete'].indexOf(type) > -1}
                    apis={{
                      onDelete: target => {
                        const next = resumes.filter(item => {
                          if (target.uuid && item.uuid) return item.uuid !== target.uuid;
                          if (target.id && item.id) return item.id !== target.id;
                          return item !== target;
                        });
                        applyList(next);
                      }
                    }}
                  />
                  <div className={style['upload-cta-outline']}>
                    <UploadButton>{formatMessage({ id: 'tenantAdmin.completeChooseFile' })}</UploadButton>
                  </div>
                </div>
              ) : (
                <div className={style['upload-guide']}>
                  <UploadTips
                    icon={
                      <div className={style['upload-icon']}>
                        <CloudUploadOutlined />
                      </div>
                    }
                    title={formatMessage({ id: 'tenantAdmin.completeDragTip' })}
                    renderTips={() => formatMessage({ id: 'tenantAdmin.completeUploadHint' })}
                  />
                  <div className={style['upload-cta-outline']}>
                    <UploadButton>{formatMessage({ id: 'tenantAdmin.completeChooseFile' })}</UploadButton>
                  </div>
                </div>
              )}
            </div>
          </DragAreaOuter>
        </Spin>
        <div className={style['upload-privacy']}>
          <InfoCircleOutlined />
          <Typography.Text type="secondary">{formatMessage({ id: 'tenantAdmin.completeUploadPrivacy' })}</Typography.Text>
        </div>
      </section>

      <section className={style['career-card']}>
        <div className={style['career-card-head']}>
          <div className={style['career-card-titles']}>
            <span className={style['career-card-title']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinSectionTitle' })}</span>
            <span className={style['badge-optional']}>{formatMessage({ id: 'tenantAdmin.completeOptionalBadge' })}</span>
          </div>
          <p className={style['career-card-desc']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinSectionDesc' })}</p>
        </div>
        <div className={style['linkedin-field']}>
          <div className={style['linkedin-label']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinUrlLabel' })}</div>
          <Input
            className={style['linkedin-input']}
            addonBefore={
              <span className={style['linkedin-prefix']}>
                <LinkedinFilled />
                {formatMessage({ id: 'tenantAdmin.completeLinkedinPrefix' })}
              </span>
            }
            value={value?.linkedin || ''}
            placeholder={formatMessage({ id: 'tenantAdmin.completeLinkedinPlaceholder' })}
            onChange={e => {
              const linkedin = e.target.value;
              linkedinRef.current = linkedin;
              onChange?.({
                ...value,
                resumes: value?.resumes || [],
                parsed: value?.parsed ?? null,
                linkedin
              });
            }}
            allowClear
          />
        </div>
        <div className={style['linkedin-tips']}>
          <div className={style['linkedin-tip']}>
            <LockOutlined />
            <div>
              <div className={style['linkedin-tip-title']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinPrivacyTitle' })}</div>
              <div className={style['linkedin-tip-body']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinPrivacyBody' })}</div>
            </div>
          </div>
          <div className={style['linkedin-tip']}>
            <InfoCircleOutlined />
            <div>
              <div className={style['linkedin-tip-title']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinUseTitle' })}</div>
              <div className={style['linkedin-tip-body']}>{formatMessage({ id: 'tenantAdmin.completeLinkedinUseBody' })}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UploadStep;
