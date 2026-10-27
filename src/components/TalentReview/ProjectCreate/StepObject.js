import { useState } from 'react';
import { Button, Empty, Flex, Modal, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, StarOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import { QUESTION_TYPES } from '../constants';
import QuestionnaireView from '../QuestionnaireView';
import { buildQuestionnaire, createQuestion } from './utils';
import style from '../style.module.scss';

const letter = index => String.fromCharCode(65 + index);

const typeLabel = (type, formatMessage) => {
  const item = QUESTION_TYPES.find(t => t.value === type);
  return item ? formatMessage({ id: item.labelId }) : type;
};

const hasOptions = type => !!QUESTION_TYPES.find(t => t.value === type)?.hasOptions;

const QuestionFields = ({ FormInfo }) => {
  const { formatMessage } = useIntl();
  const { formData } = FormInfo.useFormContext();
  const { MultiField, fields } = FormInfo;
  const { Input, Select, RadioGroup } = fields;
  return (
    <FormInfo
      column={2}
      list={[
        <Input name="title" label={formatMessage({ id: 'questionText' })} rule="REQ LEN-0-200" placeholder={formatMessage({ id: 'enter' })} block />,
        <Select
          name="type"
          label={formatMessage({ id: 'questionType' })}
          rule="REQ"
          options={QUESTION_TYPES.map(item => ({
            value: item.value,
            disabled: item.disabled,
            label: item.disabled ? (
              <Tooltip title={formatMessage({ id: 'notSupported' })}>
                <span>{formatMessage({ id: item.labelId })}</span>
              </Tooltip>
            ) : (
              formatMessage({ id: item.labelId })
            )
          }))}
        />,
        <RadioGroup
          name="required"
          label={formatMessage({ id: 'requiredField' })}
          options={[
            { value: true, label: formatMessage({ id: 'yes' }) },
            { value: false, label: formatMessage({ id: 'no' }) }
          ]}
        />,
        hasOptions(formData.type) ? <MultiField name="options" label={formatMessage({ id: 'options' })} rule="REQ LEN-0-100" field={Input} placeholder={formatMessage({ id: 'optionPlaceholder' })} block /> : null
      ].filter(Boolean)}
    />
  );
};

const QuestionModal = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, value, onCancel, onOk }) => {
  const [FormInfo] = remoteModules;
  const { FormModal } = FormInfo;
  const { formatMessage } = useIntl();
  return (
    <FormModal
      open
      width={560}
      title={formatMessage({ id: value.title ? 'editQuestion' : 'addQuestion' })}
      saveText={formatMessage({ id: 'save' })}
      cancelText={formatMessage({ id: 'cancel' })}
      onClose={onCancel}
      formProps={{
        data: Object.assign({}, value, { options: value.options?.length ? value.options : [''] }),
        onSubmit: data =>
          onOk(
            Object.assign({}, value, data, {
              options: hasOptions(data.type) ? (data.options || []).map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean) : []
            })
          )
      }}
    >
      <QuestionFields FormInfo={FormInfo} />
    </FormModal>
  );
});

const PreviewModal = ({ questions, onCancel }) => {
  const { formatMessage } = useIntl();
  return (
    <Modal open width={800} title={formatMessage({ id: 'questionnairePreview' })} footer={null} onCancel={onCancel}>
      <QuestionnaireView config={buildQuestionnaire(questions, formatMessage({ id: 'stepObjectInfo' }))} preview={false} />
    </Modal>
  );
};

const StepObject = ({ questions, onChange }) => {
  const { formatMessage } = useIntl();
  const [editing, setEditing] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Flex vertical gap={16}>
      <Tooltip title={formatMessage({ id: 'notSupported' })}>
        <div className={style['ai-suggest']}>
          <StarOutlined /> {formatMessage({ id: 'aiSuggestedQuestions' })}
        </div>
      </Tooltip>
      <Flex justify="space-between" align="center">
        <span className={style['section-title']}>{formatMessage({ id: 'reviewObjectInfo' })}</span>
        <Flex gap={8}>
          <Button size="small" icon={<EyeOutlined />} disabled={!questions.length} onClick={() => setPreviewOpen(true)}>
            {formatMessage({ id: 'preview' })}
          </Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setEditing(createQuestion())}>
            {formatMessage({ id: 'addQuestion' })}
          </Button>
        </Flex>
      </Flex>
      {questions.length ? (
        <div className={style['question-cards']}>
          {questions.map((item, index) => (
            <div key={item.key} className={style['question-card']}>
              <div className={style['question-card-head']}>
                <span>
                  {formatMessage({ id: 'questionN' }, { index: index + 1 })}
                  {item.required ? <span style={{ color: '#ef4444' }}> *</span> : null}
                </span>
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => onChange(questions.filter(q => q.key !== item.key))} />
              </div>
              <div className={style['question-card-title']}>{item.title}</div>
              {item.options.length ? (
                <div className={style['question-card-options']}>
                  {formatMessage({ id: 'optionsPrefix' })}
                  {item.options.map((label, i) => `${letter(i)}.${label}`).join('; ')}
                </div>
              ) : null}
              <div className={style['question-card-foot']}>
                <span className={style['grid-badge']}>{typeLabel(item.type, formatMessage)}</span>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(item)}>
                  {formatMessage({ id: 'edit' })}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty description={formatMessage({ id: 'objectInfoEmpty' })} />
      )}
      {editing ? (
        <QuestionModal
          value={editing}
          onCancel={() => setEditing(null)}
          onOk={next => {
            const exists = questions.some(q => q.key === next.key);
            onChange(exists ? questions.map(q => (q.key === next.key ? next : q)) : [...questions, next]);
            setEditing(null);
          }}
        />
      ) : null}
      {previewOpen ? <PreviewModal questions={questions} onCancel={() => setPreviewOpen(false)} /> : null}
    </Flex>
  );
};

export default StepObject;
