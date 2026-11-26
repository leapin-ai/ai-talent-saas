import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ConfigProvider, DatePicker, Flex, Input, Result, Segmented, Spin, Tag } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import classnames from 'classnames';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useSearchParams } from 'react-router-dom';
import { useIntl } from '@kne/react-intl';
import { ResultCard } from '@kne/react-box';
import '@kne/react-box/dist/index.css';
import withLocale from './withLocale';
import { groupQuestions, InterviewList, QuestionGroups } from './Questionnaire';
import style from './style.module.scss';

const DATE_FORMAT = 'YYYY-MM-DD';

const LOCALE_ALIASES = { zh: 'zh-CN', 'zh-cn': 'zh-CN', cn: 'zh-CN', en: 'en-US', 'en-us': 'en-US' };
/** 链接里的 lang 参数：识别出中文/英文则固定该语言，否则返回 null（页面显示语言切换） */
const parseLang = value => LOCALE_ALIASES[String(value || '').toLowerCase()] || null;

const normalizeItems = detail => {
  if (Array.isArray(detail?.items) && detail.items.length) {
    return detail.items;
  }
  if (!detail) {
    return [];
  }
  return [
    {
      key: `${detail.runId || 'legacy'}:${detail.kind || ''}:`,
      runId: detail.runId,
      kind: detail.kind,
      roleName: detail.roleName,
      personName: detail.personName,
      outdated: detail.outdated,
      stage: detail.stage,
      confirmed: detail.confirmed,
      notReached: detail.notReached,
      rejected: detail.rejected,
      rejectComment: detail.rejectComment,
      rejectedAt: detail.rejectedAt,
      deadline: detail.deadline,
      confirmedAt: detail.confirmedAt,
      questionnaire: detail.questionnaire || [],
      interview: detail.interview || []
    }
  ];
};

const itemPending = item => !item.outdated && !item.confirmed && !item.notReached && !item.rejected;

const QuestionnairePreview = ({ item, pageLocale, t }) => {
  const byNo = useMemo(() => new Map((item.questionnaire || []).map(row => [row.no, row])), [item.questionnaire]);
  const groups = useMemo(() => groupQuestions(item.questionnaire || [], pageLocale), [item.questionnaire, pageLocale]);
  if (!groups.length && !item.interview?.length) {
    return null;
  }
  return (
    <>
      {groups.length ? (
        <div className={classnames(style['panel'], style['section'])}>
          <div className={style['section-head']}>
            <span className={style['section-title']}>{t('questionnaireSection')}</span>
            <span className={style['section-hint']}>{t('questionHint', { count: item.questionnaire.length })}</span>
          </div>
          <QuestionGroups groups={groups} byNo={byNo} t={t} />
        </div>
      ) : null}
      {item.interview?.length ? (
        <div className={classnames(style['panel'], style['section'])}>
          <div className={style['section-head']}>
            <span className={style['section-title']}>{t('interviewSection')}</span>
            <span className={style['section-hint']}>{t('interviewHint')}</span>
          </div>
          <InterviewList list={item.interview} t={t} />
        </div>
      ) : null}
    </>
  );
};

/** 单份问卷：待确认可提交或驳回；已确认 / 已驳回可预览题目 */
const ConfirmItemPanel = ({ item, pageLocale, t, submitting, rejecting, onSubmit, onReject }) => {
  const [deadline, setDeadline] = useState(null);
  const [deadlineError, setDeadlineError] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [rejectError, setRejectError] = useState(false);
  const showDeadlineError = deadlineError && !deadline;
  const showRejectError = rejectError && !String(rejectComment || '').trim();
  const pending = itemPending(item);
  const busy = submitting || rejecting;

  const submit = () => {
    if (!deadline) {
      setDeadlineError(true);
      return;
    }
    onSubmit(item, deadline.format(DATE_FORMAT));
  };

  const reject = () => {
    const comment = String(rejectComment || '').trim();
    if (!comment) {
      setRejectError(true);
      return;
    }
    onReject(item, comment);
  };

  if (!pending) {
    let result;
    if (item.outdated) {
      result = <Result status="warning" title={t('outdatedTitle')} subTitle={t('outdatedDesc')} />;
    } else if (item.confirmed) {
      result = <Result status="success" title={t('confirmedTitle')} subTitle={t('confirmedDesc', { deadline: item.deadline || '-' })} />;
    } else if (item.rejected) {
      result = <Result status="warning" title={t('rejectedTitle')} subTitle={t('rejectedDesc', { comment: item.rejectComment || '-' })} />;
    } else {
      result = <Result status="info" title={t('notReachedTitle')} subTitle={t('notReachedDesc')} />;
    }
    return (
      <>
        <div className={classnames(style['panel'], style['result'])}>{result}</div>
        {(item.confirmed || item.rejected) && !item.outdated ? <QuestionnairePreview item={item} pageLocale={pageLocale} t={t} /> : null}
      </>
    );
  }

  return (
    <>
      <QuestionnairePreview item={item} pageLocale={pageLocale} t={t} />
      <div className={classnames(style['panel'], style['item-action'])}>
        <div className={style['deadline']}>
          <div className={style['deadline-row']}>
            <span className={style['deadline-label']}>{t('deadline')}</span>
            <DatePicker
              className={style['deadline-picker']}
              value={deadline}
              status={showDeadlineError ? 'error' : undefined}
              disabledDate={current => current && current.isBefore(dayjs().startOf('day'))}
              onChange={value => {
                setDeadline(value);
                setDeadlineError(false);
              }}
            />
          </div>
          <div className={classnames(style['deadline-hint'], { [style['deadline-hint-error']]: showDeadlineError })}>{showDeadlineError ? t('deadlineRequired') : t('deadlineTip')}</div>
        </div>
        {rejectOpen ? (
          <div className={style['reject-box']}>
            <div className={style['deadline-label']}>{t('rejectComment')}</div>
            <Input.TextArea
              rows={4}
              value={rejectComment}
              status={showRejectError ? 'error' : undefined}
              placeholder={t('rejectCommentPlaceholder')}
              onChange={e => {
                setRejectComment(e.target.value);
                setRejectError(false);
              }}
            />
            {showRejectError ? <div className={classnames(style['deadline-hint'], style['deadline-hint-error'])}>{t('rejectCommentRequired')}</div> : <div className={style['deadline-hint']}>{t('rejectTip')}</div>}
            <Flex gap={8} wrap="wrap" className={style['reject-actions']}>
              <Button danger type="primary" size="large" loading={rejecting} disabled={busy} onClick={reject}>
                {t('rejectSubmit')}
              </Button>
              <Button size="large" disabled={busy} onClick={() => setRejectOpen(false)}>
                {t('rejectCancel')}
              </Button>
            </Flex>
          </div>
        ) : (
          <Flex gap={8} wrap="wrap">
            <Button type="primary" size="large" loading={submitting} disabled={busy} onClick={submit}>
              {t('submit')}
            </Button>
            <Button size="large" disabled={busy} onClick={() => setRejectOpen(true)}>
              {t('reject')}
            </Button>
          </Flex>
        )}
      </div>
    </>
  );
};

/** 页面内容：文案取自外层 SetGlobal 设置的语言，所以必须渲染在它的子树里 */
const ReadinessConfirmContent = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, pageLocale, languageFixed, onLocaleChange, onDefaultLocale }) => {
    const [usePreset] = remoteModules;
    const { apis, ajax } = usePreset();
    const { formatMessage } = useIntl();
    const [searchParams] = useSearchParams();
    const code = searchParams.get('code') || '';
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(!!code);
    const [error, setError] = useState(false);
    const [activeKey, setActiveKey] = useState('');
    const [submittingKey, setSubmittingKey] = useState('');
    const [rejectingKey, setRejectingKey] = useState('');
    const itemRefs = useRef({});
    const skipAutoActiveRef = useRef(false);

    const publicApis = apis.talentSaas.public.readinessConfirm;
    const t = useCallback((id, values) => formatMessage({ id: `readinessConfirm.${id}` }, values), [formatMessage]);

    const items = useMemo(() => normalizeItems(detail), [detail]);
    const pendingCount = items.filter(itemPending).length;

    const scrollToItem = key => {
      if (!key) {
        return;
      }
      const node = itemRefs.current[key];
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    const load = useCallback(
      async ({ preferNextPendingOf } = {}) => {
        const { data } = await ajax(Object.assign({}, publicApis.detail, { params: { code } }));
        if (data.code !== 0) {
          throw new Error(data.msg);
        }
        const next = data.data || null;
        setDetail(next);
        const nextItems = normalizeItems(next);
        const firstPending = nextItems.find(itemPending);
        let nextKey = firstPending?.key || nextItems[0]?.key || '';
        if (preferNextPendingOf) {
          const currentIndex = nextItems.findIndex(item => item.key === preferNextPendingOf);
          const after = currentIndex >= 0 ? nextItems.slice(currentIndex + 1).find(itemPending) : null;
          const before = nextItems.find(itemPending);
          nextKey = after?.key || before?.key || preferNextPendingOf;
          skipAutoActiveRef.current = true;
          setActiveKey(nextKey);
          queueMicrotask(() => scrollToItem(nextKey));
          return next;
        }
        setActiveKey(prev => {
          if (skipAutoActiveRef.current) {
            skipAutoActiveRef.current = false;
            return prev;
          }
          if (prev && nextItems.some(item => item.key === prev)) {
            return prev;
          }
          return nextKey;
        });
        return next;
      },
      [ajax, publicApis, code]
    );

    useEffect(() => {
      if (!code) {
        setLoading(false);
        setError(true);
        return;
      }
      setLoading(true);
      load()
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, [code, load]);

    useEffect(() => {
      if (!languageFixed && detail?.language) {
        onDefaultLocale(detail.language);
      }
    }, [detail?.language, languageFixed, onDefaultLocale]);

    const languageSwitch = languageFixed ? null : (
      <Flex justify="flex-end">
        <Segmented
          size="small"
          value={pageLocale}
          onChange={onLocaleChange}
          options={[
            { label: '中文', value: 'zh-CN' },
            { label: 'EN', value: 'en-US' }
          ]}
        />
      </Flex>
    );

    const wrap = children => (
      <div className={style['page']}>
        <div className={style['container']}>{children}</div>
        <div className={style['footer-space']} />
      </div>
    );

    if (loading) {
      return (
        <Flex align="center" justify="center" className={style['page']}>
          <Spin size="large" />
        </Flex>
      );
    }
    if (error || !detail || !items.length) {
      return wrap(
        <Flex justify="center">
          <ResultCard.Error width={560} title={t('invalidTitle')} description={t('invalidDesc')} />
        </Flex>
      );
    }

    const activeItem = items.find(item => item.key === activeKey) || null;
    const allDone = pendingCount === 0;

    const toggleItem = key => {
      setActiveKey(prev => (prev === key ? '' : key));
      queueMicrotask(() => {
        if (activeKey !== key) {
          scrollToItem(key);
        }
      });
    };

    const submitItem = async (item, deadline) => {
      setSubmittingKey(item.key);
      try {
        const { data } = await ajax(
          Object.assign({}, publicApis.confirm, {
            data: { code, deadline, key: item.key, runId: item.runId, kind: item.kind, personId: item.personId || undefined }
          })
        );
        if (data.code !== 0) {
          await load().catch(() => {});
          return;
        }
        await load({ preferNextPendingOf: item.key }).catch(() => {});
      } finally {
        setSubmittingKey('');
      }
    };

    const rejectItem = async (item, comment) => {
      setRejectingKey(item.key);
      try {
        const { data } = await ajax(
          Object.assign({}, publicApis.reject, {
            data: { code, comment, key: item.key, runId: item.runId, kind: item.kind, personId: item.personId || undefined }
          })
        );
        if (data.code !== 0) {
          await load().catch(() => {});
          return;
        }
        await load({ preferNextPendingOf: item.key }).catch(() => {});
      } finally {
        setRejectingKey('');
      }
    };

    const statusTag = item => {
      if (item.outdated) {
        return <Tag color="warning">{t('statusOutdated')}</Tag>;
      }
      if (item.confirmed) {
        return <Tag color="success">{t('statusConfirmed')}</Tag>;
      }
      if (item.rejected) {
        return <Tag color="warning">{t('statusRejected')}</Tag>;
      }
      if (item.notReached) {
        return <Tag>{t('statusUnavailable')}</Tag>;
      }
      return <Tag color="processing">{t('statusPending')}</Tag>;
    };

    return wrap(
      <>
        {languageSwitch}
        <div className={classnames(style['panel'], style['hero'])}>
          {detail.companyName ? <div className={style['company']}>{detail.companyName}</div> : null}
          <h1 className={style['title']}>{t('title')}</h1>
          <p className={style['intro']}>{items.length > 1 ? t('introBatch', { count: items.length, pending: pendingCount }) : t('intro')}</p>
          <div className={style['meta']}>
            <div className={style['meta-item']}>
              <div className={style['meta-label']}>{t('batchCount')}</div>
              <div className={style['meta-value']}>{items.length}</div>
            </div>
            <div className={style['meta-item']}>
              <div className={style['meta-label']}>{t('pendingCount')}</div>
              <div className={style['meta-value']}>{pendingCount}</div>
            </div>
          </div>
        </div>

        {allDone ? (
          <div className={classnames(style['panel'], style['result'])}>
            <Result status="success" title={t('batchDoneTitle')} subTitle={t('batchDoneDesc')} />
          </div>
        ) : null}

        <div className={style['item-list']}>
          {items.map(item => {
            const open = item.key === activeItem?.key;
            return (
              <div
                key={item.key}
                ref={node => {
                  itemRefs.current[item.key] = node;
                }}
                className={classnames(style['item-card'], { [style['item-card-active']]: open })}
              >
                <button type="button" className={style['item-header']} onClick={() => toggleItem(item.key)}>
                  <div className={style['item-header-main']}>
                    <div className={style['role-name']}>{item.personName ? `${item.roleName} · ${item.personName}` : item.roleName}</div>
                    <div className={style['item-sub']}>{t(`kind.${item.kind}`)}</div>
                  </div>
                  {statusTag(item)}
                </button>
                {open ? (
                  <div className={style['item-body']}>
                    <ConfirmItemPanel item={item} pageLocale={pageLocale} t={t} submitting={submittingKey === item.key} rejecting={rejectingKey === item.key} onSubmit={submitItem} onReject={rejectItem} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </>
    );
  })
);

/** 免登录确认问卷：一批问卷共用一个入口；页内逐份确认并填写截止日期 */
const ReadinessConfirm = createWithRemoteLoader({
  modules: ['components-core:Global@SetGlobal']
})(({ remoteModules }) => {
  const [SetGlobal] = remoteModules;
  const [searchParams] = useSearchParams();
  const fixedLocale = parseLang(searchParams.get('lang'));
  const [pickedLocale, setPickedLocale] = useState(null);
  const [defaultLocale, setDefaultLocale] = useState('zh-CN');
  const locale = fixedLocale || pickedLocale || defaultLocale;
  return (
    <SetGlobal globalKey="locale" value={locale}>
      <ConfigProvider locale={locale === 'en-US' ? enUS : zhCN}>
        <ReadinessConfirmContent pageLocale={locale} languageFixed={!!fixedLocale} onLocaleChange={setPickedLocale} onDefaultLocale={setDefaultLocale} />
      </ConfigProvider>
    </SetGlobal>
  );
});

export default ReadinessConfirm;
