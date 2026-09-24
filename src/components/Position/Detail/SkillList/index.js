import React, { useEffect, useMemo, useState } from 'react';
import { Empty, Flex } from 'antd';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from '../../withLocale';
import ActivityTaskTable from '@components/ActivityTaskTable';
import { PINNED_SCROLL_MAX_HEIGHT } from '@components/PinnedScrollPanel';
import ImportanceBar from './ImportanceBar';
import ChangeTag from './ChangeTag';
import SkillPreview from './SkillPreview';
import { CHANGE_META, CHANGE_VALUES, countByChange, LEVEL_META, formatActivityGroup, normalizeSkills } from './skillModel';
import style from './style.module.scss';

const SkillList = withLocale(({ skill }) => {
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
      const key = formatActivityGroup(item.activityCode, item.activityTitle) || item.activityGroup || '';
      if (!map.has(key)) {
        map.set(key, {
          id: key || 'ungrouped',
          code: item.activityCode || '',
          title: item.activityTitle || item.activityGroup || '',
          children: []
        });
      }
      map.get(key).children.push(item);
    });
    return [...map.values()].map(group => ({
      ...group,
      title: group.title || (group.code ? '' : formatMessage({ id: 'position.taskTitle' })),
      countLabel: formatMessage({ id: 'position.activityTaskCount' }, { count: group.children.length })
    }));
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
          <ActivityTaskTable
            maxBodyHeight={PINNED_SCROLL_MAX_HEIGHT}
            groups={groups}
            columns={[formatMessage({ id: 'position.skillName' }), formatMessage({ id: 'position.skillChangeColumn' }), formatMessage({ id: 'position.skillImportanceColumn' }), formatMessage({ id: 'position.confidence' })]}
            expanded={expanded}
            onToggle={toggleGroup}
            selectedId={selectedSkill?.id}
            onSelect={item => selectSkillById(item.id)}
            onHover={item => selectSkillById(item.id)}
            empty={<Empty description={formatMessage({ id: 'position.roleTasksEmpty' })} />}
            renderPrimary={item => item.name}
            renderSecondary={item => <ChangeTag change={item.change} />}
            renderMetric={item => <ImportanceBar importanceNow={item.importanceNow} importanceYear={item.importanceYear} />}
            renderTrailing={item => formatMessage({ id: (LEVEL_META[item.confidence] || LEVEL_META.medium).labelKey })}
          />
        </div>
        {selectedSkill ? <SkillPreview skill={selectedSkill} /> : null}
      </div>
    </div>
  );
});

export default SkillList;
