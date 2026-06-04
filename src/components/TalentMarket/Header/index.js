import React from 'react';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { Button, Flex, Typography } from 'antd';
import { FaFilter } from 'react-icons/fa';
import { MdOutlineSearch } from 'react-icons/md';
import style from '../style.module.scss';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';

const { Title, Paragraph } = Typography;

const Header = createWithRemoteLoader({
  modules: ['components-core:Global@useGlobalContext', 'components-core:LoadingButton', 'components-core:HistoryStore', 'components-core:Common@SearchInput']
})(
  withLocale(({ remoteModules, searchValue, onSearchChange, loading, onFilterToggle, onSearch, apis }) => {
    const { formatMessage } = useIntl();
    const [useGlobalContext, LoadingButton, HistoryStore, SearchInput] = remoteModules;
    const { global } = useGlobalContext('userInfo');
    const { tenantUserInfo } = global;
    return (
      <header className={style.header}>
        <div className={style['header-content']}>
          <Title level={2}>
            {formatMessage({ id: 'talentMarket.WelcomeBack' })}
            <span className={style.highlight}>{tenantUserInfo.name}</span>
          </Title>
          <Paragraph className={style.subtitle}>{formatMessage({ id: 'talentMarket.Subtitle' })}</Paragraph>
        </div>

        <Flex gap={12} className={style['search-bar']}>
          <HistoryStore
            className={style['search-input-wrapper']}
            onSelect={async value => {
              console.log('---->', value);
              onSearchChange(value);
              await onSearch(value);
            }}
          >
            {({ appendHistory, openHistory }) => {
              return (
                <SearchInput
                  className={style['search-input']}
                  size="large"
                  placeholder={formatMessage({ id: 'talentMarket.SearchPlaceholder' })}
                  prefix={<MdOutlineSearch />}
                  suffix={
                    <Button
                      type="link"
                      icon={<FaFilter />}
                      onClick={e => {
                        e.stopPropagation();
                        onFilterToggle();
                      }}
                    >
                      {formatMessage({ id: 'talentMarket.Filter' })}
                    </Button>
                  }
                  onFocus={openHistory}
                  onBlur={() => {
                    searchValue && setTimeout(() => appendHistory({ value: searchValue, label: searchValue }), 1000);
                  }}
                  value={searchValue}
                  onSearch={value => {
                    onSearchChange(value);
                    if (value) {
                      onSearch(value);
                    }
                  }}
                />
              );
            }}
          </HistoryStore>
          <LoadingButton
            type="primary"
            size="large"
            loading={loading}
            className={style['search-btn']}
            onClick={() => {
              searchValue && onSearch(searchValue);
            }}
          >
            {formatMessage({ id: 'talentMarket.Search' })}
          </LoadingButton>
        </Flex>
      </header>
    );
  })
);

export default Header;
