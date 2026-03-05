import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import style from './style.module.scss';
import Header from './Header';
import TalentGrid from './TalentGrid';
import Fetch, { useFetch } from '@kne/react-fetch';
import useRefCallback from '@kne/use-ref-callback';
import { Spin, Flex, Typography } from 'antd';
import TalentCard from './TalentCard';

const SearchList = ({ list, totalCount, onViewProfile, onLoadMore, noMore, isLoading }) => {
  const ref = useRef();
  const handlerLoadMore = useRefCallback(() => {
    !noMore && onLoadMore();
  });
  useEffect(() => {
    if (!ref.current) {
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          handlerLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 100px 0px' // 提前100px触发
      }
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
    };
  }, [handlerLoadMore]);

  return (
    <Flex vertical gap={24}>
      <div>
        共搜索到<Typography.Link>{totalCount}条</Typography.Link>结果
      </div>
      <div className={style['talent-grid']}>
        {list.map(talent => (
          <TalentCard key={talent.id} talent={talent} onViewProfile={onViewProfile} />
        ))}
      </div>
      <div ref={ref}>
        {!isLoading && (
          <Flex justify="center">
            {noMore ? (
              ''
            ) : (
              <Spin tip="加载更多...">
                <span style={{ visibility: 'hidden' }}>加载更多...</span>
              </Spin>
            )}
          </Flex>
        )}
      </div>
    </Flex>
  );
};

const TalentMarket = ({ baseUrl, onMoreProfile, apis }) => {
  const [searchValue, setSearchValue] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const currentPageRef = useRef(1);
  const { isComplete, isLoading, data, loadMore, refresh, requestParams } = useFetch(
    Object.assign({}, apis.search, {
      auto: false,
      data: {
        currentPage: 1
      }
    })
  );

  const navigate = useNavigate();

  const handleViewProfile = talent => {
    navigate(`${baseUrl}/profile/${talent.id}`);
  };

  const talentMapping = (item, positionEnums) => {
    const positionMapping = new Map(
      (positionEnums || []).map(item => {
        return [item.value, item.description];
      })
    );
    return {
      id: item.id,
      name: item.name,
      positionId: item.options?.position || '',
      position: positionMapping.get(item.options?.position || '') || item.options?.position || '',
      avatar: item.avatar,
      status: item.status === 'ACTIVE' ? 'employed' : 'resigned',
      skills: [...(item.profile?.skills?.cert_mapped || []), ...(item.profile?.skills?.work_related || []), ...(item.profile?.skills?.interest_strength || [])],
      advantages: (item.profile?.advantage || []).map(adv => adv.name)
    };
  };

  return (
    <div className={style['talent-market']}>
      <Header
        loading={isLoading}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onFilterToggle={() => setShowFilter(!showFilter)}
        apis={apis}
        onSearch={async searchValue => {
          await refresh({
            data: {
              query: searchValue
            }
          });
        }}
      />
      <main className={style.main}>
        {searchValue && (isLoading || (data && data.pageData?.length > 0)) ? (
          <Spin spinning={isLoading} tip="正在加载中...">
            <SearchList
              list={(data?.pageData || []).map(item => talentMapping(item, data.positionEnums))}
              totalCount={data?.totalCount || 0}
              onViewProfile={handleViewProfile}
              isLoading={isLoading}
              noMore={isComplete && (data?.pageData || []).length >= data.totalCount}
              onLoadMore={() => {
                if (isLoading) {
                  return;
                }
                currentPageRef.current += 1;
                return loadMore(
                  {
                    data: {
                      query: searchValue,
                      currentPage: requestParams.data.currentPage + 1
                    }
                  },
                  (data, newData) => {
                    return Object.assign({}, newData, {
                      positionEnums: [...data.positionEnums, ...newData.positionEnums],
                      pageData: data.pageData.concat(newData.pageData)
                    });
                  }
                );
              }}
            />
          </Spin>
        ) : (
          <Fetch
            {...Object.assign({}, apis.recommend)}
            render={({ data }) => {
              const mappedTalents = (data.list || []).map(item => talentMapping(item, data.positionEnums));
              return <TalentGrid talents={mappedTalents} onViewProfile={handleViewProfile} onMoreProfile={onMoreProfile} />;
            }}
          />
        )}
      </main>
    </div>
  );
};

export { default as Header } from './Header';
export { default as TalentGrid } from './TalentGrid';
export { default as TalentCard } from './TalentCard';

export default TalentMarket;
