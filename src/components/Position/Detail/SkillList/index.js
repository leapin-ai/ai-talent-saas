import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flex } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { useIntl } from '@kne/react-intl';
import classnames from 'classnames';
import withLocale from '../../withLocale';
import ImportanceBar from './ImportanceBar';
import ChangeTag from './ChangeTag';
import SkillPreview from './SkillPreview';
import { CHANGE_META, CHANGE_VALUES, countByChange, normalizeSkills, ORIGIN_META } from './skillModel';
import style from './style.module.scss';

const SkillList = createWithRemoteLoader({
  modules: ['components-core:Table']
})(
  withLocale(({ remoteModules, skill }) => {
    const [Table] = remoteModules;
    const { formatMessage } = useIntl();
    const [filter, setFilter] = useState('all');
    const [selectedId, setSelectedId] = useState(null);
    const tableWrapRef = useRef(null);

    const skills = useMemo(() => normalizeSkills(skill), [skill]);
    const counts = useMemo(() => countByChange(skills), [skills]);
    const currentYear = new Date().getFullYear();

    const displaySkills = useMemo(() => {
      if (filter === 'all') {
        return skills;
      }
      return skills.filter(item => item.change === filter);
    }, [skills, filter]);

    useEffect(() => {
      if (displaySkills.length === 0) {
        setSelectedId(null);
        return;
      }
      setSelectedId(prev => (prev && displaySkills.some(item => item.id === prev) ? prev : displaySkills[0].id));
    }, [displaySkills]);

    const selectedSkill = useMemo(() => {
      if (!selectedId) {
        return displaySkills[0] || null;
      }
      return displaySkills.find(item => item.id === selectedId) || displaySkills[0] || null;
    }, [selectedId, displaySkills]);

    useEffect(() => {
      const root = tableWrapRef.current;
      if (!root) {
        return undefined;
      }

      const syncSelectedRows = () => {
        const rows = root.querySelectorAll('.ant-table-tbody > tr[data-row-key]');
        rows.forEach(row => {
          const active = !!(selectedSkill?.id && row.getAttribute('data-row-key') === selectedSkill.id);
          row.setAttribute('data-selected', active ? 'true' : 'false');
        });
      };

      syncSelectedRows();
      const observer = new MutationObserver(syncSelectedRows);
      observer.observe(root, { childList: true, subtree: true });
      return () => observer.disconnect();
    }, [selectedSkill?.id, displaySkills]);

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
      }
    ];

    const selectSkillById = id => {
      if (id && id !== selectedId) {
        setSelectedId(id);
      }
    };

    const onTableMouseOver = e => {
      const tr = e.target.closest?.('.ant-table-tbody > tr[data-row-key]');
      if (!tr || !e.currentTarget.contains(tr)) {
        return;
      }
      selectSkillById(tr.getAttribute('data-row-key'));
    };

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
        </Flex>
        <div className={style.body}>
          <div ref={tableWrapRef} className={style.table} onMouseOver={onTableMouseOver}>
            <Table
              dataSource={displaySkills}
              columns={columns}
              rowKey="id"
              name="position-skill-list"
              sticky={false}
              pagination={false}
              controllerOpen={false}
              onRow={record => ({
                onMouseEnter: () => selectSkillById(record.id)
              })}
            />
          </div>
          {selectedSkill ? <SkillPreview skill={selectedSkill} /> : null}
        </div>
      </div>
    );
  })
);

export default SkillList;
