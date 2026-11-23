import { STAGE_KIND } from './common';

/**
 * 从选中行的 todos 汇总可批量操作。
 * 同一操作只保留能执行的条目；fetch/trigger 按 run 去重。
 * 录入答卷需逐条粘贴 JSON，不进入批量。
 */
export const collectBatchOps = rows => {
  const ops = new Map();
  const add = (key, type, kind, item, todo) => {
    const op = ops.get(key) || { key, type, kind, targets: [] };
    op.targets.push({ item, todo });
    ops.set(key, op);
  };

  rows.forEach(item => {
    (item.todos || []).forEach(todo => {
      if (todo.type === 'failed') {
        add('retry', 'retry', null, item, todo);
        return;
      }
      const kind = STAGE_KIND[todo.stage] || null;
      if (todo.action === 'confirm' && kind) {
        add(`confirm:${kind}`, 'confirm', kind, item, todo);
        return;
      }
      if (todo.action === 'send' && kind) {
        add(`send:${kind}`, 'send', kind, item, todo);
        return;
      }
      if (todo.action === 'trigger') {
        add('trigger', 'trigger', null, item, todo);
        return;
      }
      if (todo.action === 'answers') {
        add('fetch', 'fetch', kind, item, todo);
        if (todo.total && todo.answered >= todo.total) {
          add(`advance:${kind || 'unknown'}`, 'advance', kind, item, todo);
        }
      }
    });
  });

  return [...ops.values()].map(op => {
    if (op.type === 'fetch' || op.type === 'trigger' || op.type === 'send') {
      const seen = new Set();
      return Object.assign({}, op, {
        targets: op.targets.filter(({ item }) => {
          const id = String(item.id);
          if (seen.has(id)) {
            return false;
          }
          seen.add(id);
          return true;
        })
      });
    }
    return op;
  });
};

export const batchOpLabel = (t, op) => {
  const count = op.targets.length;
  const kindLabel = op.kind ? t(`kind.${op.kind}`) : '';
  if (op.type === 'confirm') {
    return t('batchConfirm', { kind: kindLabel, count });
  }
  if (op.type === 'send') {
    return t('batchSendKind', { kind: kindLabel, count });
  }
  if (op.type === 'fetch') {
    return t('batchFetch', { count });
  }
  if (op.type === 'advance') {
    return t('batchAdvance', { count });
  }
  if (op.type === 'trigger') {
    return t('batchTrigger', { count });
  }
  if (op.type === 'retry') {
    return t('batchRetry', { count });
  }
  return op.key;
};
