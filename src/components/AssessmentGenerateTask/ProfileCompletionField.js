import { useEffect, useState } from 'react';
import { Button, InputNumber } from 'antd';
import { normalizeProfileCompletionPercent } from './assessmentReviewUtils';
import style from './style.module.scss';

const DEFAULT_LABELS = {
  title: '档案完成度',
  autoHint: '默认按基础信息、简历、填写信息、AI 面试、就绪度五项自动计算，可手动修改',
  manualHint: estimate => `已手动设置；自动计算值为 ${estimate}%`,
  reset: '恢复自动计算'
};

/** 审核时编辑档案完成度：默认展示自动计算值，修改后作为人工值随 reviewData.profileCompletionPercent 提交 */
const ProfileCompletionField = ({ profileDetail, onChange, disabled, labels }) => {
  const text = Object.assign({}, DEFAULT_LABELS, labels);
  const percent = normalizeProfileCompletionPercent(profileDetail?.profileCompletionPercent) ?? 0;
  const override = normalizeProfileCompletionPercent(profileDetail?.profileCompletionOverride);
  const estimate = normalizeProfileCompletionPercent(profileDetail?.profileCompletionEstimate) ?? percent;
  const [input, setInput] = useState(percent);

  useEffect(() => {
    setInput(percent);
  }, [percent]);

  const commit = () => {
    const next = normalizeProfileCompletionPercent(input);
    if (next == null) {
      setInput(percent);
      return;
    }
    if (next !== percent) {
      onChange && onChange(next);
    }
  };

  return (
    <div className={style['completion-field']}>
      <div className={style['completion-main']}>
        <span className={style['completion-label']}>{text.title}</span>
        <InputNumber className={style['completion-input']} min={0} max={100} precision={0} suffix="%" value={input} disabled={disabled} onChange={setInput} onBlur={commit} onPressEnter={commit} />
        {override != null && !disabled ? (
          <Button type="link" size="small" className={style['completion-reset']} onClick={() => onChange && onChange(null)}>
            {text.reset}
          </Button>
        ) : null}
      </div>
      <div className={style['completion-hint']}>{override != null ? text.manualHint(estimate) : text.autoHint}</div>
    </div>
  );
};

export default ProfileCompletionField;
