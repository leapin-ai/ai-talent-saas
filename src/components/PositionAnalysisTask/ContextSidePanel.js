import { useEffect, useMemo, useState } from 'react';
import { Empty, Flex, Tabs, Tag, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import Fetch from '@kne/react-fetch';
import classnames from 'classnames';
import TalentProfile from '@components/TalentProfile';
import style from './style.module.scss';

const text = value => {
  if (value == null || value === '') {
    return '-';
  }
  return String(value);
};

const formatLocation = location => {
  if (!location || typeof location !== 'object') {
    return '-';
  }
  const parts = [location.city, location.province, location.country, location.address].filter(Boolean);
  return parts.length ? parts.join(' · ') : '-';
};

const formatSalary = salary => {
  if (!salary || typeof salary !== 'object') {
    return '-';
  }
  const { min, max, currency, period } = salary;
  if (min == null && max == null) {
    return '-';
  }
  const range = [min, max].filter(v => v != null).join(' - ');
  return [range, currency, period].filter(Boolean).join(' ');
};

const STATUS_LABEL = {
  draft: '草稿',
  published: '已发布',
  closed: '已关闭',
  active: '在职',
  inactive: '停用',
  ACTIVE: '在职'
};

const LOCATION_TYPE_LABEL = {
  'on-site': '现场',
  remote: '远程'
};

const InfoCard = ({ title, extra, children }) => (
  <div className={style['info-card']}>
    {(title || extra) && (
      <Flex align="center" justify="space-between" className={style['info-card-head']}>
        {title ? <Typography.Text strong>{title}</Typography.Text> : <span />}
        {extra}
      </Flex>
    )}
    <div className={style['info-card-body']}>{children}</div>
  </div>
);

const MetaGrid = ({ items }) => (
  <div className={style['meta-grid']}>
    {items.map(item => (
      <div key={item.label} className={style['meta-item']}>
        <div className={style['meta-label']}>{item.label}</div>
        <div className={style['meta-value']}>{item.value}</div>
      </div>
    ))}
  </div>
);

const PositionInfo = ({ position }) => {
  if (!position) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无岗位信息" />;
  }
  const department = (position.orgEnums || []).find(item => String(item.value) === String(position.tenantOrgId))?.description;
  return (
    <Flex vertical gap={12}>
      <InfoCard title={text(position.name)} extra={position.status ? <Tag>{STATUS_LABEL[position.status] || position.status}</Tag> : null}>
        <MetaGrid
          items={[
            { label: '部门', value: text(department) },
            { label: '职能', value: text(position.capacity) },
            { label: '语言', value: text(position.language) },
            { label: '地点类型', value: text(LOCATION_TYPE_LABEL[position.locationType] || position.locationType) },
            { label: '工作地点', value: formatLocation(position.location) },
            { label: '薪资', value: formatSalary(position.salary) }
          ]}
        />
      </InfoCard>
      <InfoCard title="工作内容">
        <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 8, expandable: true, symbol: '展开' }}>
          {text(position.description)}
        </Typography.Paragraph>
      </InfoCard>
      <InfoCard title="工作要求">
        <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 8, expandable: true, symbol: '展开' }}>
          {text(position.requirement)}
        </Typography.Paragraph>
      </InfoCard>
      <InfoCard title="发展目标">
        <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 8, expandable: true, symbol: '展开' }}>
          {text(position.developmentGoal)}
        </Typography.Paragraph>
      </InfoCard>
    </Flex>
  );
};

const TenantCompanyPane = createWithRemoteLoader({
  modules: ['components-admin:Tenant@CompanyInfo', 'components-core:Global@usePreset', 'components-core:Global@useGlobalContext']
})(({ remoteModules }) => {
  const [CompanyInfo, usePreset, useGlobalContext] = remoteModules;
  const { apis } = usePreset();
  const { global } = useGlobalContext('userInfo');
  const tenantId = global?.tenant?.id;
  // 分析弹窗只读展示，不走 Setting.Company 的权限门禁
  return <Fetch {...Object.assign({}, apis?.tenant?.companyDetail)} render={({ data }) => <CompanyInfo data={data} tenantId={tenantId} hasEdit={false} />} />;
});

const EmployeeSwitcher = createWithRemoteLoader({
  modules: ['components-core:Image.Avatar']
})(({ remoteModules, employees, selectedId, onSelect }) => {
  const [Avatar] = remoteModules;
  return (
    <div className={style['employee-switcher']}>
      <div className={style['employee-switcher-title']}>关联人员</div>
      <div className={style['employee-switcher-list']}>
        {employees.map(item => {
          const active = String(item.id) === String(selectedId);
          return (
            <button key={item.id} type="button" className={classnames(style['employee-switch-item'], active && style['employee-switch-item-active'])} onClick={() => onSelect(item.id)}>
              <Avatar id={item.avatar} gender={item.gender || 'M'} size={36} />
              <div className={style['employee-switch-text']}>
                <Typography.Text ellipsis className={style['employee-switch-name']}>
                  {item.name || item.nameEn || item.id}
                </Typography.Text>
                {item.nameEn ? (
                  <Typography.Text type="secondary" ellipsis className={style['employee-switch-sub']}>
                    {item.nameEn}
                  </Typography.Text>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const EmployeeProfilePane = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules, employees }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  const list = Array.isArray(employees) ? employees : [];
  const [selectedId, setSelectedId] = useState(() => list[0]?.id || null);

  useEffect(() => {
    if (!list.length) {
      setSelectedId(null);
      return;
    }
    if (!list.some(item => String(item.id) === String(selectedId))) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  const profileApis = useMemo(
    () =>
      Object.assign({}, apis?.talentSaas?.tenant?.employee, {
        positionList: apis?.talentSaas?.tenant?.position?.list,
        parseResume: apis?.talentSaas?.tenant?.resume?.parseFileId,
        orgList: apis?.tenant?.orgList
      }),
    [apis]
  );

  if (!list.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联员工" />;
  }

  return (
    <div className={style['employee-profile-layout']}>
      <EmployeeSwitcher employees={list} selectedId={selectedId} onSelect={setSelectedId} />
      <div className={style['employee-profile-main']}>{selectedId ? <TalentProfile key={selectedId} id={selectedId} apis={profileApis} readOnly embed /> : null}</div>
    </div>
  );
});

const ContextSidePanel = ({ context }) => {
  return (
    <div className={style['side-panel']}>
      <Tabs
        size="small"
        className={style['side-tabs']}
        items={[
          {
            key: 'position',
            label: '岗位信息',
            children: (
              <div className={style['side-tab-body']}>
                <PositionInfo position={context?.position} />
              </div>
            )
          },
          {
            key: 'employee',
            label: '员工档案',
            children: (
              <div className={classnames(style['side-tab-body'], style['side-tab-body-employee'])}>
                <EmployeeProfilePane employees={context?.employees} />
              </div>
            )
          },
          {
            key: 'company',
            label: '公司信息',
            children: (
              <div className={style['side-tab-body']}>
                <TenantCompanyPane />
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

export default ContextSidePanel;
