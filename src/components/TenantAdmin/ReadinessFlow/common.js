import { useCallback } from 'react';
import { message } from 'antd';

/**
 * 仅走 Readiness 流程接口：统一取 data，业务错误抛出。
 * extra：平台 Admin 入口需要带上 tenantId（租户身份由请求参数决定，而非登录的租户用户）。
 */
export const useReadinessCall = (ajax, extra) =>
  useCallback(
    async (api, data) => {
      const payload = Object.assign({}, extra || {}, data || {});
      const { data: res } = await ajax(Object.assign({}, api, api.method === 'GET' ? { params: payload } : { data: payload }));
      if (res.code !== 0) {
        // 业务错误已由 preset 的 ajax errorHandler 提示，标记后避免重复 toast
        throw Object.assign(new Error(res.msg || 'Request failed'), { handled: true });
      }
      return res.data;
    },
    // extra 为对象，按 tenantId 稳定依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ajax, extra?.tenantId]
  );

export const notifyError = e => {
  if (!e?.handled) {
    message.error(e?.message || 'Request failed');
  }
};

/** 人工阶段 → 问卷类型 */
export const STAGE_KIND = {
  manager_confirm: 'manager',
  manager_send: 'manager',
  manager_answers: 'manager',
  staff_confirm: 'staff',
  staff_send: 'staff',
  answers: 'staff',
  reassess_confirm: 'reassess',
  reassess_send: 'reassess',
  reassess_answers: 'reassess'
};

/** 同时是 antd Tag color 与 TablePage `status` 列（Badge）的 type */
export const STATUS_COLOR = {
  running: 'processing',
  blocked: 'warning',
  failed: 'error',
  done: 'success',
  canceled: 'default',
  pending: 'default',
  succeeded: 'success',
  superseded: 'default'
};

/** 流程语言的展示名 */
export const LANGUAGE_LABEL = { 'zh-CN': '中文', 'en-US': 'English' };

/** 取流程语言作邮件/页面默认值；非法或缺省回退 zh-CN */
export const flowLanguage = (...values) => {
  for (const value of values) {
    if (value === 'zh-CN' || value === 'en-US') {
      return value;
    }
    if (Array.isArray(value)) {
      const hit = value.find(item => item === 'zh-CN' || item === 'en-US');
      if (hit) {
        return hit;
      }
    }
  }
  return 'zh-CN';
};

/** 列表阶段筛选：与 Role 主流程 stage 一致 */
export const ROLE_STAGE_FILTER_OPTIONS = [
  'draft',
  'manager_questionnaire',
  'manager_confirm',
  'manager_publish',
  'manager_send',
  'manager_answers',
  'revise',
  'staff_questionnaire',
  'staff_confirm',
  'staff_publish',
  'staff_send',
  'await_persons',
  'recall',
  'skills',
  'forecast',
  'person_reports',
  'role_report',
  'role_apply',
  'done'
];

export const stageIndexOf = (list, key) => list.findIndex(item => item.key === key);
