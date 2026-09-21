import React, { useEffect, useMemo, useState } from 'react';
import { Flex } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from '../../withLocale';
import ImportanceBar from './ImportanceBar';
import ChangeTag from './ChangeTag';
import SkillPreview from './SkillPreview';
import { CHANGE_META, CHANGE_VALUES, countByChange, LEVEL_META, normalizeSkills } from './skillModel';
import iconCollapse from './assets/icon-collapse.svg';
import style from './style.module.scss';

const parseActivityGroup = raw => {
  const text = String(raw || '').trim();
  if (!text) {
    return { code: '', title: '' };
  }
  const matched = text.match(/^([A-Za-z]?\d{1,3})\s*[·.\-–—:]?\s+(.+)$/);
  if (matched) {
    return { code: matched[1].toUpperCase(), title: matched[2].trim() };
  }
  if (/^[A-Za-z]?\d{1,3}$/.test(text)) {
    return { code: text.toUpperCase(), title: '' };
  }
  return { code: '', title: text };
};

const SkillList = createWithRemoteLoader({
  modules: ['components-core:Table@TablePage']
})(
  withLocale(({ remoteModules, skill }) => {
    const [TablePage] = remoteModules;
    const { formatMessage } = useIntl();
    const [filter, setFilter] = useState('all');
    const [selectedId, setSelectedId] = useState(null);
    const [expanded, setExpanded] = useState({});

    const skills = useMemo(() => normalizeSkills(skill), [skill]);
    const counts = useMemo(() => countByChange(skills), [skills]);

    const displaySkills = useMemo(() => {
      if (filter === 'all') {
        return skills;
      }
      return skills.filter(item => item.change === filter);
    }, [skills, filter]);

    const groups = useMemo(() => {
      const map = new Map();
      displaySkills.forEach(item => {
        const key = item.activityGroup || '';
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(item);
      });
      return [...map.entries()].map(([key, items]) => {
        const parsed = parseActivityGroup(key);
        return {
          id: key || 'ungrouped',
          code: parsed.code,
          title: parsed.title || (parsed.code ? '' : formatMessage({ id: 'position.taskTitle' })),
          children: items
        };
      });
    }, [displaySkills, formatMessage]);

    useEffect(() => {
      const flat = groups.flatMap(group => group.children);
      if (flat.length === 0) {
        setSelectedId(null);
        return;
      }
      setSelectedId(prev => (prev && flat.some(item => item.id === prev) ? prev : flat[0].id));
    }, [groups]);

    const selectedSkill = useMemo(() => {
      const flat = groups.flatMap(group => group.children);
      if (!selectedId) {
        return flat[0] || null;
      }
      return flat.find(item => item.id === selectedId) || flat[0] || null;
    }, [selectedId, groups]);

    const toggleGroup = id => {
      setExpanded(prev => ({ ...prev, [id]: !(prev[id] !== false) }));
    };

    const selectSkillById = id => {
      if (id && id !== selectedId) {
        setSelectedId(id);
      }
    };

    const columns = [
      { name: 'name', title: formatMessage({ id: 'position.skillName' }) },
      { name: 'change', title: formatMessage({ id: 'position.skillChangeColumn' }) },
      { name: 'importance', title: formatMessage({ id: 'position.skillImportanceColumn' }) },
      { name: 'confidence', title: formatMessage({ id: 'position.confidence' }) }
    ];

    const renderCard = ({ displayDataSource, dataSource = [] }) => {
      const list = displayDataSource || dataSource;
      return (
        <div className={style['task-table']}>
          <div className={classnames(style['task-row'], style['task-head'])}>
            {columns.map(column => (
              <div key={column.name} className={style[`task-col-${column.name}`]}>
                {column.title}
              </div>
            ))}
          </div>
          {list.map(group => {
            const open = expanded[group.id] !== false;
            return (
              <div key={group.id} className={style['task-group']}>
                <button type="button" className={style['task-parent']} onClick={() => toggleGroup(group.id)} aria-expanded={open}>
                  <span className={style['task-parent-main']}>
                    {group.code ? <span className={style['activity-code']}>{group.code}</span> : null}
                    <span className={style['activity-meta']}>
                      <span className={style['activity-title']}>{group.title || group.code || formatMessage({ id: 'position.taskTitle' })}</span>
                      <span className={style['activity-count']}>{formatMessage({ id: 'position.activityTaskCount' }, { count: group.children.length })}</span>
                    </span>
                  </span>
                  <img className={classnames(style['collapse-icon'], !open && style['collapse-icon-collapsed'])} src={iconCollapse} alt="" />
                </button>
                {open
                  ? group.children.map(item => (
                      <div
                        key={item.id}
                        className={classnames(style['task-row'], style['task-child'], selectedSkill?.id === item.id && style['task-selected'])}
                        onMouseEnter={() => selectSkillById(item.id)}
                        onClick={() => selectSkillById(item.id)}
                      >
                        <div className={classnames(style['task-name'], style['task-col-name'])} title={item.name}>
                          {item.name}
                        </div>
                        <div className={style['task-col-change']}>
                          <ChangeTag change={item.change} />
                        </div>
                        <div className={style['task-col-importance']}>
                          <ImportanceBar importanceNow={item.importanceNow} importanceYear={item.importanceYear} />
                        </div>
                        <div className={style['task-col-confidence']}>{formatMessage({ id: (LEVEL_META[item.confidence] || LEVEL_META.medium).labelKey })}</div>
                      </div>
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      );
    };

    const filterItems = [
      { key: 'all', label: formatMessage({ id: 'position.skillFilterAll' }), count: skills.length },
      ...CHANGE_VALUES.map(key => ({
        key,
        label: formatMessage({ id: CHANGE_META[key].filterLabelKey || CHANGE_META[key].labelKey }),
        count: counts[key],
        bg: CHANGE_META[key].bg,
        color: CHANGE_META[key].color
      }))
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
                          borderColor: selected ? item.color : 'transparent'
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
        </Flex>
        <div className={style.body}>
          <div className={style.table}>
            <TablePage
              key={`${filter}:${groups.map(group => `${group.id}:${group.children.length}`).join(',')}`}
              name="position-task-tree"
              pagination={{ open: false }}
              forceCard
              controllerOpen={false}
              rowKey="id"
              columns={columns}
              renderCard={renderCard}
              loader={() =>
                Promise.resolve({
                  pageData: groups,
                  totalCount: groups.length
                })
              }
            />
          </div>
          {selectedSkill ? <SkillPreview skill={selectedSkill} /> : null}
        </div>
      </div>
    );
  })
);

export default SkillList;
