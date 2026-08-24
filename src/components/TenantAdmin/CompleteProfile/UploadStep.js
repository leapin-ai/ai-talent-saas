import { Spin, Typography, message } from 'antd';
import { CloudUploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useIntl } from '@kne/react-intl';
import { useFileUpload } from '@kne/react-file';
import '@kne/react-file/dist/index.css';
import get from 'lodash/get';
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
  const resumes = Array.isArray(value?.resumes) ? value.resumes : [];

  const applyList = useCallback(
    async nextList => {
      const list = Array.isArray(nextList) ? nextList : [];
      const done = list.filter(item => item && item.type !== 'uploading' && (item.id || item.ossId));
      if (done.length === 0) {
        parsedIdRef.current = null;
        onChange?.({ resumes: list, parsed: null });
        return;
      }
      const file = done[0];
      const fileId = file.id || file.ossId;
      if (parsedIdRef.current === fileId && value?.parsed) {
        onChange?.({ resumes: list, parsed: value.parsed });
        return;
      }
      onChange?.({ resumes: list, parsed: value?.parsed || null });
      setParsing(true);
      try {
        const { data } = await ajax(
          Object.assign({}, apis.parseResume, {
            data: { id: fileId }
          })
        );
        if (data.code !== 0) {
          parsedIdRef.current = null;
          message.warning(data.msg || formatMessage({ id: 'tenantAdmin.completeUploadRequired' }));
          onChange?.({ resumes: list, parsed: null });
          return;
        }
        parsedIdRef.current = fileId;
        onChange?.({ resumes: list, parsed: data.data || null });
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
    onUpload: presetApis?.file?.upload
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
    <Spin
      spinning={parsing || uploadingList.length > 0}
      tip={formatMessage({
        id: parsing ? 'tenantAdmin.completeResumeParsing' : 'tenantAdmin.completeResumeUploading'
      })}
    >
      <div className={style['upload-wrap']}>
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
                <div className={style['upload-cta']}>
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
                <div className={style['upload-cta']}>
                  <UploadButton>{formatMessage({ id: 'tenantAdmin.completeChooseFile' })}</UploadButton>
                </div>
              </div>
            )}
          </div>
        </DragAreaOuter>
        <div className={style['upload-privacy']}>
          <InfoCircleOutlined />
          <Typography.Text type="secondary">{formatMessage({ id: 'tenantAdmin.completeUploadPrivacy' })}</Typography.Text>
        </div>
      </div>
    </Spin>
  );
};

export default UploadStep;
