import { Tag, Tooltip } from 'antd';

/** 岗位评估状态 → Tag 色：待启动灰 / 进行中蓝 / 已完成绿 / 失败红 */
const ASSESSMENT_STATUS_COLOR = {
  pending: 'default',
  interviews_in_progress: 'processing',
  completed: 'success',
  error: 'error'
};

const AssessmentStatusTag = ({ status, formatMessage }) => {
  const key = status && ASSESSMENT_STATUS_COLOR[status] ? status : 'pending';
  const tag = (
    <Tag bordered={false} color={ASSESSMENT_STATUS_COLOR[key]}>
      {formatMessage({ id: `position.assessmentStatus.${key}` })}
    </Tag>
  );
  if (key !== 'error') {
    return tag;
  }
  return <Tooltip title={formatMessage({ id: 'position.assessmentStatus.errorTip' })}>{tag}</Tooltip>;
};

export default AssessmentStatusTag;
export { ASSESSMENT_STATUS_COLOR };
