import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Input, Button, Flex, Typography } from 'antd';
import { FaFilter } from 'react-icons/fa';
import { MdOutlineSearch } from 'react-icons/md';
import style from '../style.module.scss';

const { Title, Paragraph } = Typography;

const Header = createWithRemoteLoader({
  modules: ['components-core:Global@useGlobalContext']
})(({ remoteModules, searchValue, onSearchChange, onFilterToggle }) => {
  const [useGlobalContext] = remoteModules;
  const { global } = useGlobalContext('userInfo');
  const { tenantUserInfo } = global;
  return (
    <header className={style.header}>
      <div className={style['header-content']}>
        <Title level={2}>
          欢迎回来，<span className={style.highlight}>{tenantUserInfo.name}</span>
        </Title>
        <Paragraph className={style.subtitle}>从你的内部人才库中找到下一位明星员工吧</Paragraph>
      </div>

      <Flex gap={12} className={style['search-bar']}>
        <Input
          size="large"
          placeholder="按技能、职位或员工姓名搜索..."
          prefix={<MdOutlineSearch />}
          suffix={
            <Button type="link" icon={<FaFilter />} onClick={onFilterToggle}>
              筛选
            </Button>
          }
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
        />
        <Button type="primary" size="large" className={style['search-btn']}>
          搜索
        </Button>
      </Flex>
    </header>
  );
});

export default Header;
