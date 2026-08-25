import React, { useMemo, useRef, useState } from 'react';
import { Button, Flex } from 'antd';
import { MdAdd } from 'react-icons/md';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from '../../withLocale';
import ImportanceBar from './ImportanceBar';
import ChangeTag from './ChangeTag';
import SkillPreview from './SkillPreview';
import SkillFormInner from './SkillFormInner';
import { CHANGE_META, CHANGE_VALUES, countByChange, createEmptySkill, createSkillId, normalizeSkillItem, normalizeSkills, ORIGIN_META } from './skillModel';
import style from './style.module.scss';

const SkillList = createWithRemoteLoader({
  modules: ['components-core:FormInfo@useFormModal', 'components-core:Global@usePreset', 'components-core:Table@TablePage']
})(
  withLocale(({ remoteModules, positionId, skill, apis, reload }) => {
    const [useFormModal, usePreset, TablePage] = remoteModules;
    const { formatMessage } = useIntl();
    const formModal = useFormModal();
    const { ajax } = usePreset();
    const tableRef = useRef(null);
    const [filter, setFilter] = useState('all');
    const [hoveredId, setHoveredId] = useState(null);

    const skills = useMemo(() => normalizeSkills(skill), [skill]);
    const counts = useMemo(() => countByChange(skills), [skills]);
    const currentYear = new Date().getFullYear();

    const hoveredSkill = useMemo(() => {
      if (!hoveredId) {
        return null;
      }
      return skills.find(item => item.id === hoveredId) || null;
    }, [hoveredId, skills]);

    const refresh = async () => {
      reload && (await reload());
      tableRef.current?.reload?.();
    };

    const saveSkills = async nextList => {
      const normalized = normalizeSkills(nextList);
      const { data: resData } = await ajax(
        Object.assign({}, apis.save, {
          data: { id: positionId, skill: normalized }
        })
      );
      if (resData?.code !== 0) {
        throw new Error(resData?.msg || formatMessage({ id: 'position.skillSaveFailed' }));
      }
      await refresh();
      return true;
    };

    const openForm = (record = null) => {
      const isEdit = !!record;
      const base = isEdit ? Object.assign({}, createEmptySkill(), record) : createEmptySkill();
      const initial = Object.assign({}, base, {
        jdText: base.jd?.text || '',
        jdSource: base.jd?.source || '',
        shockText: base.shockReport?.text || '',
        shockSource: base.shockReport?.source || ''
      });
      formModal({
        title: formatMessage({ id: isEdit ? 'position.skillEdit' : 'position.skillAdd' }),
        size: 'small',
        formProps: {
          data: initial,
          onSubmit: async formData => {
            const nextItem = normalizeSkillItem(
              Object.assign({}, formData, {
                id: isEdit ? record.id : formData.id || createSkillId(),
                jd: { text: formData.jdText || '', source: formData.jdSource || '' },
                shockReport: { text: formData.shockText || '', source: formData.shockSource || '' }
              })
            );
            if (!nextItem) {
              return false;
            }
            const nextList = isEdit ? skills.map(item => (item.id === record.id ? nextItem : item)) : skills.concat(nextItem);
            await saveSkills(nextList);
          }
        },
        children: <SkillFormInner />
      });
    };

    const filterItems = [
      { key: 'all', label: formatMessage({ id: 'position.skillFilterAll' }), count: skills.length },
      ...CHANGE_VALUES.map(key => ({
        key,
        label: formatMessage({ id: CHANGE_META[key].labelKey }),
        count: counts[key],
        bg: CHANGE_META[key].bg,
        color: CHANGE_META[key].color
      }))
    ];

    const columns = [
      {
        name: 'name',
        title: formatMessage({ id: 'position.skillName' }),
        type: 'mainInfo'
      },
      {
        name: 'origin',
        title: formatMessage({ id: 'position.skillOrigin' }),
        type: 'other',
        valueOf: item => formatMessage({ id: (ORIGIN_META[item.origin] || ORIGIN_META.existing).labelKey })
      },
      {
        name: 'importance',
        title: formatMessage({ id: 'position.skillImportanceColumn' }, { year: currentYear }),
        type: 'other',
        valueOf: item => <ImportanceBar importanceNow={item.importanceNow} importanceYear={item.importanceYear} />
      },
      {
        name: 'change',
        title: formatMessage({ id: 'position.skillChange' }),
        type: 'other',
        valueOf: item => <ChangeTag change={item.change} />
      },
      {
        name: 'options',
        title: formatMessage({ id: 'position.skillActions' }),
        type: 'options',
        fixed: 'right',
        valueOf: item => [
          {
            children: formatMessage({ id: 'action.edit' }),
            onClick: () => openForm(item)
          },
          {
            children: formatMessage({ id: 'action.delete' }),
            message: formatMessage({ id: 'position.skillDeleteConfirm' }),
            isDelete: true,
            onClick: async () => {
              const nextList = skills.filter(target => target.id !== item.id);
              await saveSkills(nextList);
              if (hoveredId === item.id) {
                setHoveredId(null);
              }
            }
          }
        ]
      }
    ];

    return (
      <div className={style.root}>
        <Flex justify="space-between" align="center" gap={12} className={style.toolbar} wrap="wrap">
          <div className={style.filters}>
            {filterItems.map(item => {
              const selected = filter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={classnames(style.filter, selected && style['filter-selected'], item.key === 'all' && selected && style['filter-all-selected'])}
                  style={
                    item.key === 'all'
                      ? undefined
                      : {
                          background: item.bg,
                          color: item.color,
                          borderColor: selected ? item.color : item.bg
                        }
                  }
                  onClick={() => setFilter(item.key)}
                >
                  <span>{item.label}</span>
                  <span className={style['filter-count']}>{item.count}</span>
                </button>
              );
            })}
          </div>
          <Button type="primary" icon={<MdAdd />} onClick={() => openForm()}>
            {formatMessage({ id: 'position.skillAdd' })}
          </Button>
        </Flex>
        <div className={style.body} onMouseLeave={() => setHoveredId(null)}>
          <div className={style.table}>
            <TablePage
              {...Object.assign({}, apis.detail, {
                params: { id: positionId }
              })}
              key={filter}
              ref={tableRef}
              name="position-skill-list"
              rowKey="id"
              sticky={false}
              pagination={{ open: false }}
              columns={columns}
              dataFormat={data => {
                let list = normalizeSkills(data?.skill);
                if (filter !== 'all') {
                  list = list.filter(item => item.change === filter);
                }
                return {
                  list,
                  total: list.length
                };
              }}
              onRow={record => ({
                onMouseEnter: () => setHoveredId(record.id),
                className: hoveredSkill?.id === record.id ? style['row-active'] : undefined
              })}
            />
          </div>
          {hoveredSkill ? <SkillPreview skill={hoveredSkill} /> : null}
        </div>
      </div>
    );
  })
);

export default SkillList;
