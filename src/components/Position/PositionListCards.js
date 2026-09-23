import classnames from 'classnames';
import dayjs from 'dayjs';
import { createWithRemoteLoader } from '@kne/remote-loader';
import ChangeMagnitude from './ChangeMagnitude';
import style from './positionListCards.module.scss';

// 与 ai-interview-flowup 项目列表 DEFAULT_CARD_COLUMNS 一致
const DEFAULT_CARD_COLUMNS = [
  { width: 576, col: 1 },
  { width: 992, col: 2 },
  { width: 1400, col: 3 },
  { width: 1800, col: 4 }
];

const getItemExtra = (columns, item) => {
  const column = (columns || []).find(col => col.name === 'options' || col.renderType === 'options');
  const value = typeof column?.getValueOf === 'function' ? column.getValueOf(item, { place: 'end' }) : null;
  return value?.children || null;
};

const resolveDepartment = (item, orgEnums) => {
  if (item.departmentName) {
    return item.departmentName;
  }
  const org = (orgEnums || []).find(target => String(target.value) === String(item.tenantOrgId));
  return org?.description || '-';
};

const plainText = value => {
  if (!value) {
    return '';
  }
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatUpdatedAt = value => {
  if (!value) {
    return '';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value);
};

const PositionListCard = ({ item, columns, orgEnums, onDetail, formatMessage }) => {
  const department = resolveDepartment(item, orgEnums);
  const assessmentStatus = item.assessmentStatus || 'pending';
  const statusKey = item.status ? `positionStatus.${item.status}` : null;
  const magnitude = ['low', 'medium', 'high'].includes(item.changeMagnitude) ? item.changeMagnitude : 'low';
  const description = plainText(item.description);
  const updatedAt = formatUpdatedAt(item.updatedAt || item.publishAt);
  const extra = getItemExtra(columns, item);

  return (
    <article
      className={classnames(style.card, onDetail && style['card-clickable'])}
      onClick={
        onDetail
          ? () => {
              onDetail({ colItem: item });
            }
          : undefined
      }
    >
      <div className={style['card-body']}>
        <div className={style['card-top']}>
          <div className={style['card-identity']}>
            <div className={style['card-title-row']}>
              <h3 className={style['card-title']}>{item.name || '-'}</h3>
              {statusKey ? <span className={style['status-tag']}>{formatMessage({ id: statusKey })}</span> : null}
            </div>
            <div className={style['card-meta']}>
              <span>{department}</span>
              <span className={style.dot} aria-hidden>
                ·
              </span>
              <span>{formatMessage({ id: `position.assessmentStatus.${assessmentStatus}` })}</span>
              {updatedAt ? (
                <>
                  <span className={style.dot} aria-hidden>
                    ·
                  </span>
                  <span>{updatedAt}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className={style['card-change']}>
            <ChangeMagnitude value={magnitude} />
          </div>
        </div>
        {description ? <p className={style['card-desc']}>{description}</p> : null}
        {extra ? (
          <div
            className={style['card-actions']}
            onClick={e => {
              e.stopPropagation();
            }}
          >
            {extra}
          </div>
        ) : null}
      </div>
    </article>
  );
};

const CardGrid = createWithRemoteLoader({
  modules: ['components-core:FlexBox']
})(({ remoteModules, dataSource, columns, orgEnums, onDetail, formatMessage }) => {
  const [FlexBox] = remoteModules;
  const list = Array.isArray(dataSource) ? dataSource : [];
  if (list.length === 0) {
    return null;
  }

  return (
    <FlexBox
      outerClassName={style.grid}
      dataSource={list}
      gutter={12}
      rowKey={item => item.id}
      columns={DEFAULT_CARD_COLUMNS}
      defaultColumns={DEFAULT_CARD_COLUMNS}
      renderItem={item => (
        <FlexBox.Item className={style['grid-item']}>
          <PositionListCard item={item} columns={columns} orgEnums={orgEnums} onDetail={onDetail} formatMessage={formatMessage} />
        </FlexBox.Item>
      )}
    />
  );
});

/**
 * TablePage renderCard / renderMobile 共用卡片列表。
 * 列数断点对齐 AI 面试项目列表（≤576→1 / ≤992→2 / ≤1400→3 / 更宽→4）。
 */
export const createPositionListCardsRender =
  ({ onDetail, formatMessage }) =>
  ({ dataSource = [], columns, renderToolbar, data }) => {
    const orgEnums = data?.orgEnums || [];

    return (
      <div className={style.root}>
        {typeof renderToolbar === 'function' ? <div className={style.toolbar}>{renderToolbar()}</div> : null}
        <CardGrid dataSource={dataSource} columns={columns} orgEnums={orgEnums} onDetail={onDetail} formatMessage={formatMessage} />
      </div>
    );
  };

export default PositionListCard;
