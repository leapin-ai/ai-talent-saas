import { useState } from 'react';
import { Flex, Form, InputNumber, Radio, Segmented, Switch, Tooltip } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { SettingOutlined, TableOutlined } from '@ant-design/icons';
import { useIntl } from '@kne/react-intl';
import { SectionCard } from '../common';
import GridBoard from '../GridBoard';
import { resolveCell } from '../constants';
import style from '../style.module.scss';

const percentInput = props => <InputNumber min={0} max={100} precision={0} suffix="%" style={{ width: '100%' }} {...props} />;

const CellModal = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, cell, onCancel, onOk }) => {
  const [FormInfo] = remoteModules;
  const { FormModal, fields } = FormInfo;
  const { Input, TextArea } = fields;
  const { formatMessage } = useIntl();
  return (
    <FormModal open title={formatMessage({ id: 'gridCellModalTitle' })} saveText={formatMessage({ id: 'save' })} cancelText={formatMessage({ id: 'cancel' })} onClose={onCancel} formProps={{ data: cell, onSubmit: onOk }}>
      <FormInfo
        column={1}
        list={[
          <Input name="title" label={formatMessage({ id: 'gridTitle' })} rule="REQ LEN-0-50" />,
          <TextArea name="description" label={formatMessage({ id: 'traits' })} rule="LEN-0-500" rows={3} />,
          <TextArea name="recommendation" label={formatMessage({ id: 'recommendation' })} rule="LEN-0-500" rows={3} />
        ]}
      />
    </FormModal>
  );
});

/** readOnly 时用于项目详情 */
const StepAssessment = ({ value, dimensionTypes, enablePerformance, locale, readOnly, onChange }) => {
  const { formatMessage } = useIntl();
  const [activeType, setActiveType] = useState();
  const [editingIndex, setEditingIndex] = useState(null);
  const currentType = dimensionTypes.includes(activeType) ? activeType : dimensionTypes[0];
  const gridType = String(value.gridType);
  const set = patch => onChange && onChange(Object.assign({}, value, patch));

  return (
    <Flex vertical gap={16}>
      <SectionCard
        icon={<SettingOutlined />}
        title={formatMessage({ id: 'talentReviewSettings' })}
        extra={
          <Flex gap={8} align="center" style={{ fontSize: 14, fontWeight: 400 }}>
            <span className={style['muted']}>{formatMessage({ id: 'enableHumanEvaluation' })}</span>
            <Switch size="small" disabled={readOnly} checked={value.enableManualScore} onChange={enableManualScore => set({ enableManualScore })} />
          </Flex>
        }
      >
        <Form layout="vertical" component="div" disabled={readOnly}>
          {value.enableManualScore ? (
            <>
              <Flex gap={16}>
                <Form.Item label={formatMessage({ id: 'aiEvaluation' })} required style={{ flex: 1 }}>
                  {percentInput({ value: value.ai, onChange: ai => set({ ai, manual: 100 - (ai || 0) }) })}
                </Form.Item>
                <Form.Item label={formatMessage({ id: 'humanEvaluation' })} required style={{ flex: 1 }}>
                  {percentInput({ value: value.manual, onChange: manual => set({ manual, ai: 100 - (manual || 0) }) })}
                </Form.Item>
              </Flex>
              <Flex gap={16}>
                <Form.Item label={formatMessage({ id: 'superiorWeight' })} required style={{ flex: 1 }}>
                  {percentInput({ value: value.superior, onChange: superior => set({ superior, peer: 100 - (superior || 0) }) })}
                </Form.Item>
                <Form.Item label={formatMessage({ id: 'peerWeight' })} required style={{ flex: 1 }}>
                  {percentInput({ value: value.peer, onChange: peer => set({ peer, superior: 100 - (peer || 0) }) })}
                </Form.Item>
                <Form.Item label={formatMessage({ id: 'hr' })} style={{ flex: 1 }}>
                  <Tooltip title={formatMessage({ id: 'hrNotSupported' })}>{percentInput({ value: 0, disabled: true })}</Tooltip>
                </Form.Item>
              </Flex>
            </>
          ) : (
            <Form.Item label={formatMessage({ id: 'aiEvaluation' })} required style={{ marginBottom: 0 }}>
              {percentInput({ value: 100, disabled: true })}
            </Form.Item>
          )}
        </Form>
      </SectionCard>
      <SectionCard icon={<TableOutlined />} title={formatMessage({ id: 'customGrid' })}>
        <Form layout="vertical" component="div" disabled={readOnly}>
          <Form.Item label={formatMessage({ id: 'displayMode' })} required>
            <Radio.Group
              value={value.gridType}
              onChange={e => set({ gridType: e.target.value })}
              options={[
                { value: 9, label: formatMessage({ id: 'levels3' }) },
                { value: 4, label: formatMessage({ id: 'levels2' }) }
              ]}
            />
          </Form.Item>
        </Form>
        <div className={style['grid-preview']}>
          <div className={style['section-title']} style={{ marginBottom: 12 }}>
            {formatMessage({ id: 'gridPreview' })}
          </div>
          {dimensionTypes.length ? (
            <>
              <Segmented style={{ marginBottom: 16 }} value={currentType} onChange={setActiveType} options={dimensionTypes.map(type => ({ value: type, label: formatMessage({ id: type }) }))} />
              <GridBoard
                gridType={value.gridType}
                dimension={currentType}
                dimensionLabel={formatMessage({ id: currentType })}
                nineSquareGrid={value.nineSquareGrid}
                locale={locale}
                show2D={enablePerformance}
                onEdit={readOnly ? null : setEditingIndex}
              />
            </>
          ) : (
            <div className={style['muted']}>{formatMessage({ id: 'noDimension' })}</div>
          )}
        </div>
      </SectionCard>
      {editingIndex !== null ? (
        <CellModal
          cell={resolveCell(value.nineSquareGrid, gridType, currentType, editingIndex, locale)}
          onCancel={() => setEditingIndex(null)}
          onOk={cell => {
            const grid = value.nineSquareGrid || {};
            const dim = grid[currentType] || {};
            const cells = Object.assign({}, dim.cells?.[gridType], { [editingIndex]: cell });
            set({ nineSquareGrid: Object.assign({}, grid, { [currentType]: { cells: Object.assign({}, dim.cells, { [gridType]: cells }) } }) });
            setEditingIndex(null);
          }}
        />
      ) : null}
    </Flex>
  );
};

export default StepAssessment;
