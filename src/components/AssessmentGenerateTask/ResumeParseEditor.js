import { useMemo } from 'react';
import { Button, Descriptions, Empty, Flex, Typography } from 'antd';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { formatDateRange, formatValue } from './assessmentReviewUtils';
import style from './style.module.scss';

const mergeListItem = (list, index, item) => {
  const next = [...(list || [])];
  if (index >= 0 && index < next.length) {
    next[index] = Object.assign({}, next[index], item);
    return next;
  }
  return [...next, item];
};

const removeListItem = (list, index) => (list || []).filter((_, itemIndex) => itemIndex !== index);

const ListSection = ({ title, items, emptyText, renderItem, onAdd, onEdit, onDelete, formModal, formRender, formTitle }) => (
  <div className={style['resume-section']}>
    <Flex align="center" justify="space-between" className={style['resume-section-head']}>
      <Typography.Text strong>{title}</Typography.Text>
      {onAdd ? (
        <Button
          type="link"
          size="small"
          className="btn-no-padding"
          onClick={() => {
            formModal({
              title: `添加${formTitle || title}`,
              formProps: {
                onSubmit: formData => onAdd(formData)
              },
              children: formRender()
            });
          }}
        >
          添加
        </Button>
      ) : null}
    </Flex>
    {!items?.length ? (
      <Typography.Text type="secondary">{emptyText || '暂无数据'}</Typography.Text>
    ) : (
      items.map((item, index) => (
        <div key={index} className={style['resume-list-item']}>
          <Flex align="flex-start" justify="space-between" gap={8}>
            <div className={style['resume-list-main']}>{renderItem(item, index)}</div>
            {(onEdit || onDelete) && (
              <Flex gap={4} wrap="nowrap">
                {onEdit ? (
                  <Button
                    type="link"
                    size="small"
                    className="btn-no-padding"
                    onClick={() => {
                      formModal({
                        title: `编辑${formTitle || title}`,
                        formProps: {
                          data: item,
                          onSubmit: formData => onEdit(formData, index)
                        },
                        children: formRender()
                      });
                    }}
                  >
                    编辑
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button type="link" size="small" danger className="btn-no-padding" onClick={() => onDelete(index)}>
                    删除
                  </Button>
                ) : null}
              </Flex>
            )}
          </Flex>
        </div>
      ))
    )}
  </div>
);

const ResumeParseEditor = createWithRemoteLoader({
  modules: ['components-core:FilePreview', 'components-core:FormInfo', 'components-core:FormInfo@useFormModal', 'components-core:Enum']
})(({ remoteModules, mode, fileId, filename, data, onChange }) => {
  const [FilePreview, FormInfo, useFormModal, Enum] = remoteModules;
  const formModal = useFormModal();
  const { Input, TextArea, DatePicker, Select, PhoneNumber } = FormInfo.fields;
  const readOnly = !onChange;

  const resume = data && typeof data === 'object' ? data : {};

  const patch = patchData => {
    onChange?.(Object.assign({}, resume, patchData));
  };

  const listHandlers = useMemo(
    () => ({
      educationList: {
        onAdd: item => patch({ educationList: [...(resume.educationList || []), item] }),
        onEdit: (item, index) => patch({ educationList: mergeListItem(resume.educationList, index, item) }),
        onDelete: index => patch({ educationList: removeListItem(resume.educationList, index) })
      },
      workList: {
        onAdd: item => patch({ workList: [...(resume.workList || []), item] }),
        onEdit: (item, index) => patch({ workList: mergeListItem(resume.workList, index, item) }),
        onDelete: index => patch({ workList: removeListItem(resume.workList, index) })
      },
      projectList: {
        onAdd: item => patch({ projectList: [...(resume.projectList || []), item] }),
        onEdit: (item, index) => patch({ projectList: mergeListItem(resume.projectList, index, item) }),
        onDelete: index => patch({ projectList: removeListItem(resume.projectList, index) })
      }
    }),
    [resume]
  );

  if (mode === 'original') {
    if (!fileId) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无简历原件" />;
    }
    return (
      <div className={style['resume-original']}>
        <FilePreview id={fileId} filename={filename} />
      </div>
    );
  }

  const educationForm = () => (
    <FormInfo
      column={1}
      list={[
        <Input name="college" label="学校" rule="REQ LEN-0-100" />,
        <Input name="major" label="专业" rule="LEN-0-100" />,
        <Enum moduleName="degreeEnum">
          {options => (
            <Select
              name="degree"
              label="学历"
              options={options
                .filter(item => item.description)
                .map(item => ({
                  label: item.description,
                  value: item.value
                }))}
            />
          )}
        </Enum>,
        <DatePicker name="startDate" label="开始时间" picker="month" interceptor="date-string" />,
        <DatePicker name="endDate" label="结束时间" picker="month" interceptor="date-string" />
      ]}
    />
  );

  const workForm = () => (
    <FormInfo
      column={1}
      list={[
        <Input name="company" label="公司" rule="REQ LEN-0-100" />,
        <Input name="position" label="职位" rule="LEN-0-100" />,
        <DatePicker name="startDate" label="开始时间" picker="month" interceptor="date-string" />,
        <DatePicker name="endDate" label="结束时间" picker="month" interceptor="date-string" />,
        <TextArea name="content" label="工作内容" block rule="LEN-0-2000" />
      ]}
    />
  );

  const projectForm = () => (
    <FormInfo
      column={1}
      list={[
        <Input name="name" label="项目名称" rule="REQ LEN-0-100" />,
        <Input name="position" label="角色" rule="LEN-0-100" />,
        <DatePicker name="startDate" label="开始时间" picker="month" interceptor="date-string" />,
        <DatePicker name="endDate" label="结束时间" picker="month" interceptor="date-string" />,
        <TextArea name="content" label="项目描述" block rule="LEN-0-2000" />
      ]}
    />
  );

  const basicForm = () => (
    <FormInfo
      column={1}
      list={[
        <Input name="name" label="姓名" rule="REQ LEN-0-100" />,
        <PhoneNumber name="phone" label="手机" format="string" />,
        <Input name="email" label="邮箱" rule="EMAIL LEN-0-100" />,
        <Enum moduleName="gender">
          {options => (
            <Select
              name="gender"
              label="性别"
              options={options.map(item => ({
                label: item.description,
                value: item.value
              }))}
            />
          )}
        </Enum>,
        <Input name="college" label="毕业院校" rule="LEN-0-100" />,
        <Input name="major" label="专业" rule="LEN-0-100" />,
        <Input name="expectJob" label="期望职位" rule="LEN-0-100" />,
        <TextArea name="cont_my_desc" label="自我评价" block rule="LEN-0-2000" />
      ]}
    />
  );

  return (
    <Flex vertical gap={12} className={style['resume-parsed']}>
      <div className={style['resume-section']}>
        <Flex align="center" justify="space-between" className={style['resume-section-head']}>
          <Typography.Text strong>基本信息</Typography.Text>
          {!readOnly ? (
            <Button
              type="link"
              size="small"
              className="btn-no-padding"
              onClick={() => {
                formModal({
                  title: '编辑基本信息',
                  formProps: {
                    data: resume,
                    onSubmit: formData => patch(formData)
                  },
                  children: basicForm()
                });
              }}
            >
              编辑
            </Button>
          ) : null}
        </Flex>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="姓名">{formatValue(resume.name)}</Descriptions.Item>
          <Descriptions.Item label="手机">{formatValue(resume.phone)}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{formatValue(resume.email)}</Descriptions.Item>
          <Descriptions.Item label="院校">{formatValue(resume.college)}</Descriptions.Item>
          <Descriptions.Item label="专业">{formatValue(resume.major)}</Descriptions.Item>
          <Descriptions.Item label="期望职位">{formatValue(resume.expectJob || resume.applyJob)}</Descriptions.Item>
        </Descriptions>
      </div>

      <ListSection
        title="教育经历"
        items={resume.educationList}
        formModal={formModal}
        formRender={educationForm}
        formTitle="教育经历"
        {...(readOnly ? {} : listHandlers.educationList)}
        renderItem={item => (
          <>
            <Typography.Text strong>{formatValue(item.college)}</Typography.Text>
            <div className={style['meta-label']}>
              {formatValue(item.major)} · {formatDateRange(item.startDate, item.endDate, item.sofar)}
            </div>
          </>
        )}
      />

      <ListSection
        title="工作经历"
        items={resume.workList}
        formModal={formModal}
        formRender={workForm}
        formTitle="工作经历"
        {...(readOnly ? {} : listHandlers.workList)}
        renderItem={item => (
          <>
            <Typography.Text strong>
              {formatValue(item.company)} · {formatValue(item.position)}
            </Typography.Text>
            <div className={style['meta-label']}>{formatDateRange(item.startDate, item.endDate, item.sofar)}</div>
            <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
              {formatValue(item.content || item.description)}
            </Typography.Paragraph>
          </>
        )}
      />

      <ListSection
        title="项目经历"
        items={resume.projectList}
        formModal={formModal}
        formRender={projectForm}
        formTitle="项目经历"
        {...(readOnly ? {} : listHandlers.projectList)}
        renderItem={item => (
          <>
            <Typography.Text strong>
              {formatValue(item.name)} · {formatValue(item.position)}
            </Typography.Text>
            <div className={style['meta-label']}>{formatDateRange(item.startDate, item.endDate, item.sofar)}</div>
            <Typography.Paragraph className={style['info-paragraph']} ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
              {formatValue(item.content || item.responsibility)}
            </Typography.Paragraph>
          </>
        )}
      />
    </Flex>
  );
});

export default ResumeParseEditor;
