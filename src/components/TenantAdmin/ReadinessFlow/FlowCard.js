import { Button, Checkbox, Flex, Progress, Space, Tag } from 'antd';
import { ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { LANGUAGE_LABEL, STAGE_KIND, STATUS_COLOR } from './common';
import style from './flows.module.scss';

const TODO_LIMIT = 4;

const PROGRESS_STATUS = { failed: 'exception', done: 'success', running: 'active', canceled: 'normal' };

const todoText = (t, todo) => {
  const who = todo.scope === 'person' ? todo.personName || t('participant') : t('roleLevel');
  const stage = t(`stage.${todo.stage}`);
  if (todo.type === 'failed') {
    return { who, stage, tip: t('todoFailed') };
  }
  const tip = [todo.action ? t(`todoAction.${todo.action}`) : '', todo.total ? t('todoAnswered', { answered: todo.answered, total: todo.total }) : ''].filter(Boolean).join(' · ');
  return { who, stage, tip };
};

/** 待办行上的操作按钮：与详情页主操作对齐 */
const TodoActions = ({ t, item, todo, busy, onAction }) => {
  const kind = STAGE_KIND[todo.stage];
  const run = (type, e) => {
    e?.stopPropagation();
    onAction?.({ type, item, todo, kind });
  };
  if (todo.type === 'failed') {
    return (
      <Button type="link" size="small" loading={busy} onClick={e => run('retry', e)}>
        {t('retry')}
      </Button>
    );
  }
  if (todo.action === 'confirm') {
    return (
      <Button type="link" size="small" loading={busy} onClick={e => run('confirm', e)}>
        {t('confirmQuestionnaire')}
      </Button>
    );
  }
  if (todo.action === 'send') {
    return (
      <Button type="link" size="small" loading={busy} onClick={e => run('send', e)}>
        {t('goSend')}
      </Button>
    );
  }
  if (todo.action === 'trigger') {
    return (
      <Button type="link" size="small" loading={busy} onClick={e => run('trigger', e)}>
        {t('triggerReport')}
      </Button>
    );
  }
  if (todo.action === 'answers') {
    return (
      <Space size={0}>
        {todo.total && todo.answered >= todo.total ? (
          <>
            <Button type="link" size="small" loading={busy} onClick={e => run('advance', e)}>
              {t('confirmNextStage')}
            </Button>
            <Button type="link" size="small" loading={busy} onClick={e => run('reanswer', e)}>
              {t('reanswer')}
            </Button>
          </>
        ) : null}
        <Button type="link" size="small" loading={busy} onClick={e => run('fetch', e)}>
          {t('fetchResult')}
        </Button>
        <Button type="link" size="small" loading={busy} onClick={e => run('enter', e)}>
          {t('enterAnswers')}
        </Button>
      </Space>
    );
  }
  return null;
};

/** 就绪度流程列表卡片：待人工 / 失败时直接列出待办，并可在卡片上操作 */
const FlowCard = ({ t, item, selection, busy, onOpen, onTodoAction }) => {
  const todos = item.todos || [];
  const inputError = !!item.inputError;
  // draft 423：展示失败态样式与文案，但不出待办（与取消一致）
  const status = inputError ? 'failed' : item.status;
  const showTodos = !inputError && (item.status === 'blocked' || item.status === 'failed') && todos.length > 0;
  return (
    <div className={classnames(style.card, inputError ? style.cardInputError : item.status === 'canceled' && style.cardCanceled)} onClick={() => onOpen(item)}>
      <div className={style.head}>
        {selection && <Checkbox checked={selection.checked} disabled={selection.disabled} onChange={selection.onChange} onClick={e => e.stopPropagation()} />}
        <div className={style.title}>{item.roleName}</div>
        <Tag color={STATUS_COLOR[status] || 'default'} className={style.status}>
          {t(`status.${status}`)}
        </Tag>
      </div>
      <div className={style.meta}>
        <span>
          {t('currentStage')}：{t(`stage.${item.stage}`)}
        </span>
        {item.personCount ? (
          <span>
            {t('participantsDone')}：{item.personDoneCount}/{item.personCount}
          </span>
        ) : null}
        <span>{LANGUAGE_LABEL[item.language] || item.language}</span>
        <span className={style.progress}>
          <span>{t('progress')}</span>
          <Progress percent={item.progress || 0} size="small" status={PROGRESS_STATUS[item.status]} showInfo={false} className={style.progressBar} />
          <span>{item.progress || 0}%</span>
        </span>
      </div>
      {showTodos && (
        <div className={style.todos} onClick={e => e.stopPropagation()}>
          <div className={style.todosTitle}>
            <ExclamationCircleOutlined />
            {t('todoList')} ({todos.length})
          </div>
          <ul>
            {todos.slice(0, TODO_LIMIT).map((todo, index) => {
              const { who, stage, tip } = todoText(t, todo);
              return (
                <li key={index} className={todo.type === 'failed' ? style.failed : undefined}>
                  <Flex justify="space-between" align="center" gap={12} wrap="wrap" className={style.todoRow}>
                    <div className={style.todoInfo}>
                      <span className={style.who}>{who}</span>
                      <span className={style.stage}>{stage}</span>
                      <span className={style.action}>{tip}</span>
                    </div>
                    <TodoActions t={t} item={item} todo={todo} busy={busy} onAction={onTodoAction} />
                  </Flex>
                </li>
              );
            })}
          </ul>
          {todos.length > TODO_LIMIT && <div className={style.more}>{t('todoMore', { count: todos.length - TODO_LIMIT })}</div>}
        </div>
      )}
      <div className={style.foot}>
        <span>
          {t('createdAt')}：{item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
        </span>
        <Button
          type="link"
          size="small"
          onClick={e => {
            e.stopPropagation();
            onOpen(item);
          }}
        >
          {t('view')}
          <RightOutlined />
        </Button>
      </div>
    </div>
  );
};

export default FlowCard;
