import { useMemo, useState } from 'react';
import classnames from 'classnames';
import { Button, Checkbox, Collapse, Empty, Flex, Form, Radio, Select, Spin, Switch, Tabs, Tooltip, Upload } from 'antd';
import { ClockCircleOutlined, DownloadOutlined, InboxOutlined, PlusOutlined, ApartmentOutlined, BarChartOutlined, HolderOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import { useFetch } from '@kne/react-fetch';
import { DIMENSION_TYPES } from '../constants';
import { SectionCard } from '../common';
import { buildPreviewGroups, createDimension, questionGroup } from './utils';
import style from '../style.module.scss';

const ANSWER_TYPE_LABELS = { video: 'answerTypeVideo', audio: 'answerTypeAudio', single: 'questionTypeSingle', multiple: 'questionTypeMultiple' };

const QuestionPicker = ({ api, model, language, selected, onToggle }) => {
  const { formatMessage } = useIntl();
  const { data, isLoading } = useFetch(Object.assign({}, api, { params: Object.assign({}, api.params, { questionModelId: model.id, language }) }));
  const groups = useMemo(() => {
    const map = new Map();
    (data?.pageData || []).forEach(question => {
      const { code, name } = questionGroup(question, model, formatMessage({ id: 'ungrouped' }));
      if (!map.has(code)) map.set(code, { code, name, list: [] });
      map.get(code).list.push(question);
    });
    return [...map.values()];
  }, [data, model, formatMessage]);

  if (isLoading) return <Spin style={{ display: 'block', padding: 24 }} />;
  if (!groups.length) return <Empty description={formatMessage({ id: 'noQuestions' })} />;

  return (
    <Collapse
      bordered={false}
      style={{ background: 'transparent' }}
      items={groups.map(group => {
        const count = group.list.filter(item => item.questionDigitalId && selected[item.questionDigitalId]).length;
        return {
          key: group.code,
          className: style['question-group'],
          label: group.name,
          extra: <span className={style['grid-badge']}>{formatMessage({ id: 'selectedCount' }, { count })}</span>,
          children: group.list.map(question => {
            const id = question.questionDigitalId;
            const checked = !!(id && selected[id]);
            return (
              <div key={question.id} className={classnames(style['question-item'], { [style['is-checked']]: checked })}>
                <Checkbox checked={checked} disabled={!id} onChange={e => onToggle(id, e.target.checked ? { title: question.title, answerType: question.answerType, groupName: group.name } : null)}>
                  {question.title}
                </Checkbox>
              </div>
            );
          })
        };
      })}
    />
  );
};

const DimensionBlock = ({ index, value, usedTypes, models, questionsApi, onChange, onRemove }) => {
  const { formatMessage } = useIntl();
  const model = models.find(item => String(item.id) === String(value.modelId));
  const [languageState, setLanguage] = useState({});
  const language = languageState[value.modelId] || model?.language || 'zh-CN';
  return (
    <div className={style['dimension-block']}>
      <Flex justify="space-between" align="center">
        <div className={style['dimension-block-title']}>{formatMessage({ id: 'reviewDimensionN' }, { index: index + 1 })}</div>
        {onRemove ? (
          <Button type="link" danger size="small" onClick={onRemove}>
            {formatMessage({ id: 'removeDimension' })}
          </Button>
        ) : null}
      </Flex>
      <Form layout="vertical" component="div">
        <Form.Item label={formatMessage({ id: 'reviewDimension' })} required>
          <Select
            placeholder={formatMessage({ id: 'select' })}
            value={value.type}
            onChange={type => onChange(Object.assign({}, value, { type }))}
            options={DIMENSION_TYPES.map(type => ({ value: type, label: formatMessage({ id: type }), disabled: usedTypes.includes(type) && type !== value.type }))}
          />
        </Form.Item>
        <Form.Item label={formatMessage({ id: 'modelName' })} required>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={formatMessage({ id: 'select' })}
            value={value.modelId}
            onChange={(modelId, option) => onChange(Object.assign({}, value, { modelId, modelName: option?.label || '', selected: {} }))}
            options={models.map(item => ({ value: item.id, label: item.name }))}
          />
        </Form.Item>
        <Form.Item label={formatMessage({ id: 'selectQuestions' })} style={{ marginBottom: 0 }}>
          {value.type && model ? (
            <>
              <Tabs
                size="small"
                activeKey={language}
                onChange={key => setLanguage(current => Object.assign({}, current, { [value.modelId]: key }))}
                items={[
                  { key: 'zh-CN', label: formatMessage({ id: 'chineseModel' }) },
                  { key: 'en-US', label: formatMessage({ id: 'englishModel' }) }
                ]}
              />
              <QuestionPicker
                key={`${model.id}-${language}`}
                api={questionsApi}
                model={model}
                language={language}
                selected={value.selected}
                onToggle={(id, meta) => {
                  const selected = Object.assign({}, value.selected);
                  if (meta) selected[id] = meta;
                  else delete selected[id];
                  onChange(Object.assign({}, value, { selected }));
                }}
              />
            </>
          ) : (
            <Empty
              description={
                <span>
                  {formatMessage({ id: 'noQuestions' })}
                  <br />
                  <span className={style['muted']}>{formatMessage({ id: 'noQuestionsDesc' })}</span>
                </span>
              }
            />
          )}
        </Form.Item>
      </Form>
    </div>
  );
};

const Preview = ({ dimensions, groupOrder, onOrderChange }) => {
  const { formatMessage } = useIntl();
  const groups = buildPreviewGroups(dimensions, groupOrder);
  const total = groups.reduce((sum, item) => sum + item.list.length, 0);
  const [dragKey, setDragKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const handleDrop = targetKey => {
    if (dragKey && dragKey !== targetKey) {
      const keys = groups.map(item => item.key).filter(key => key !== dragKey);
      keys.splice(keys.indexOf(targetKey) + (groups.findIndex(item => item.key === dragKey) < groups.findIndex(item => item.key === targetKey) ? 1 : 0), 0, dragKey);
      onOrderChange(keys);
    }
    setDragKey(null);
    setOverKey(null);
  };
  return (
    <div className={style['preview-panel']}>
      <div className={style['section-title']}>{formatMessage({ id: 'previewTitle' })}</div>
      <div className={style['muted']} style={{ fontSize: 12, marginTop: 4 }}>
        {formatMessage({ id: 'previewDesc' })}
      </div>
      {total ? (
        <div className={style['muted']} style={{ fontSize: 12, marginTop: 8 }}>
          <ClockCircleOutlined /> {formatMessage({ id: 'estimatedTime' }, { min: total * 2, max: total * 3 })}
        </div>
      ) : null}
      {groups.map((group, index) => (
        <div
          key={group.key}
          className={classnames(style['preview-card'], { [style['is-dragging']]: dragKey === group.key, [style['is-drag-over']]: overKey === group.key && dragKey !== group.key })}
          draggable={groups.length > 1}
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move';
            setDragKey(group.key);
          }}
          onDragOver={e => {
            if (!dragKey) return;
            e.preventDefault();
            if (overKey !== group.key) setOverKey(group.key);
          }}
          onDrop={e => {
            e.preventDefault();
            handleDrop(group.key);
          }}
          onDragEnd={() => {
            setDragKey(null);
            setOverKey(null);
          }}
        >
          <Flex justify="space-between" gap={8}>
            <strong>
              {groups.length > 1 ? <HolderOutlined className={style['drag-handle']} /> : null}
              {formatMessage({ id: 'questionN' }, { index: index + 1 })}. {group.name}
            </strong>
            <span className={style['dimension-tag']} title={formatMessage({ id: group.type })}>
              {formatMessage({ id: group.type })}
            </span>
          </Flex>
          {group.list.map((meta, i) => (
            <div key={meta.id} style={{ marginTop: 8 }}>
              Q{i + 1}: {meta.title}
              {meta.answerType ? <span className={style['muted']}> ({ANSWER_TYPE_LABELS[meta.answerType] ? formatMessage({ id: ANSWER_TYPE_LABELS[meta.answerType] }) : meta.answerType})</span> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const StepDimension = ({ value, models, questionsApi, onChange }) => {
  const { formatMessage } = useIntl();
  const { dimensions, performance } = value;
  const usedTypes = dimensions.map(item => item.type).filter(Boolean);
  const setDimensions = next => onChange(Object.assign({}, value, { dimensions: next }));
  const setPerformance = patch => onChange(Object.assign({}, value, { performance: Object.assign({}, performance, patch) }));

  return (
    <Flex vertical gap={16}>
      <SectionCard
        icon={<ApartmentOutlined />}
        title={formatMessage({ id: 'addReviewDimension' })}
        extra={
          <Button size="small" icon={<PlusOutlined />} disabled={dimensions.length >= DIMENSION_TYPES.length} onClick={() => setDimensions([...dimensions, createDimension()])}>
            {formatMessage({ id: 'addDimension' })}
          </Button>
        }
      >
        <div className={style['dimension-layout']}>
          <div>
            {dimensions.map((dim, index) => (
              <DimensionBlock
                key={dim.key}
                index={index}
                value={dim}
                usedTypes={usedTypes}
                models={models}
                questionsApi={questionsApi}
                onChange={next => setDimensions(dimensions.map(item => (item.key === dim.key ? next : item)))}
                onRemove={dimensions.length > 1 ? () => setDimensions(dimensions.filter(item => item.key !== dim.key)) : null}
              />
            ))}
          </div>
          <Preview dimensions={dimensions} groupOrder={value.groupOrder} onOrderChange={groupOrder => onChange(Object.assign({}, value, { groupOrder }))} />
        </div>
      </SectionCard>
      <SectionCard
        icon={<BarChartOutlined />}
        title={formatMessage({ id: 'performanceDimension' })}
        extra={
          <Flex gap={12} align="center">
            <Tooltip title={formatMessage({ id: 'notSupported' })}>
              <Button type="link" size="small" icon={<DownloadOutlined />} disabled>
                {formatMessage({ id: 'downloadTemplate' })}
              </Button>
            </Tooltip>
            <Switch size="small" checked={performance.enable} onChange={enable => setPerformance({ enable })} />
          </Flex>
        }
      >
        {performance.enable ? (
          <>
            <Form layout="vertical" component="div">
              <Form.Item label={formatMessage({ id: 'scoringMethod' })} required>
                <Radio.Group
                  value={performance.scoreScale}
                  onChange={e => setPerformance({ scoreScale: e.target.value })}
                  options={[
                    { value: 100, label: formatMessage({ id: 'scale100' }) },
                    { value: 5, label: formatMessage({ id: 'scale5' }) }
                  ]}
                />
              </Form.Item>
            </Form>
            <Upload.Dragger disabled showUploadList={false} beforeUpload={() => false}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-hint">{formatMessage({ id: 'performanceUploadTip' })}</p>
            </Upload.Dragger>
          </>
        ) : null}
      </SectionCard>
    </Flex>
  );
};

export default StepDimension;
