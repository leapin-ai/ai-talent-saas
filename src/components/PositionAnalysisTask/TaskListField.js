import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Flex, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { createWithRemoteLoader } from '@kne/remote-loader';
import { CHANGE_META, createEmptySkill, formatActivityGroup } from '@components/Position/Detail/SkillList/skillModel';
import style from './taskList.module.scss';

const isBlankTask = item => !item || !String(item.name || '').trim();

const labelOf = (options, value) => options.find(option => option.value === value)?.label || value || '-';

const TaskRow = memo(({ item, index, options, canDelete, onEdit, onDelete }) => {
  const group = formatActivityGroup(item.activityCode, item.activityTitle);
  const changeMeta = CHANGE_META[item.change];
  const contentCount = Array.isArray(item.contentItems) ? item.contentItems.length : 0;
  return (
    <div className={style['task-row']}>
      <div className={style['task-index']}>{index + 1}</div>
      <div className={style['task-main']}>
        {group ? <div className={style['task-group']}>{group}</div> : null}
        <div className={style['task-name']}>{item.name || <span className={style['task-placeholder']}>未填写 Task</span>}</div>
        <div className={style['task-meta']}>
          {item.change ? (
            <span className={style['task-tag']} style={changeMeta ? { background: changeMeta.bg, color: changeMeta.color } : undefined}>
              {labelOf(options.change, item.change)}
            </span>
          ) : null}
          <span>来源 {labelOf(options.origin, item.origin)}</span>
          <span>
            重要性 {item.importanceNow ?? '-'} → {item.importanceYear ?? '-'}
          </span>
          <span>AI 暴露 {item.aiExposure || '-'}</span>
          <span>置信度 {item.confidence || '-'}</span>
          {contentCount ? <span>依据 {contentCount}</span> : null}
        </div>
      </div>
      <Flex className={style['task-actions']} gap={4}>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(item.id)}>
          编辑
        </Button>
        {canDelete ? (
          <Popconfirm title="确定删除该 Task 吗？" onConfirm={() => onDelete(item.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ) : null}
      </Flex>
    </div>
  );
});

// 嵌套 List 首次靠 Form data 灌入常丢子项（依据），挂载后再补一次
const RehydrateEditForm = ({ FormInfo, data }) => {
  const { openApi } = FormInfo.useFormContext();
  useEffect(() => {
    if (!openApi?.setFormData) {
      return undefined;
    }
    openApi.setFormData(data, false);
    const timer = setTimeout(() => openApi.setFormData(data, false), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在进入编辑时回填一次
  }, [openApi]);
  return null;
};

const TaskEditCard = ({ FormInfo, index, item, options, onSave, onCancel }) => {
  const { Form, SubmitButton, List } = FormInfo;
  const { Input, TextArea, Select } = FormInfo.fields;
  return (
    <div className={`${style['task-row']} ${style['task-row-editing']}`}>
      <Form
        data={item}
        onSubmit={data => {
          onSave(Object.assign({}, item, data, { id: item.id, contentItems: Array.isArray(data?.contentItems) ? data.contentItems : [] }));
        }}
      >
        <RehydrateEditForm FormInfo={FormInfo} data={item} />
        <FormInfo
          title={`Task ${index + 1}`}
          list={[
            <Input name="activityCode" label="编号" rule="REQ LEN-1-32" />,
            <Input name="activityTitle" label="内容" rule="REQ LEN-1-200" />,
            <Input name="name" label="Task" rule="REQ LEN-1-400" />,
            <Select name="origin" label="来源" rule="REQ" options={options.origin} />,
            <Select name="importanceNow" label="当前重要性" rule="REQ" options={options.importance} />,
            <Select name="importanceYear" label="本年重要性" rule="REQ" options={options.importance} />,
            <Select name="change" label="变化" rule="REQ" options={options.change} />,
            <Select name="aiExposure" label="AI 暴露" options={options.level} />,
            <Select name="confidence" label="置信度" options={options.level} />
          ]}
        />
        <List
          name="contentItems"
          title="依据"
          addText="添加依据"
          itemTitle={({ index: contentIndex }) => `依据 ${contentIndex + 1}`}
          list={[
            <FormInfo column={1} list={[<Input name="title" label="标题" rule="LEN-0-400" block />, <TextArea name="description" label="描述" block rule="LEN-0-4000" />, <Input name="source" label="来源" rule="LEN-0-400" block />]} />
          ]}
        />
        <Flex className={style['task-edit-actions']} gap={8} justify="flex-end">
          <Button onClick={onCancel}>取消</Button>
          <SubmitButton type="primary">保存</SubmitButton>
        </Flex>
      </Form>
    </div>
  );
};

const TaskList = ({ value, onChange, FormInfo, options, minLength = 1, editingRef }) => {
  const { message } = App.useApp();
  const tasks = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [editingId, setEditingId] = useState(null);
  const newIdRef = useRef(null);

  // 外部整体替换（剪贴板导入 / AI 填充）后编辑中的行可能已不存在
  const editingExists = editingId != null && tasks.some(item => item.id === editingId);
  const activeEditingId = editingExists ? editingId : null;

  useEffect(() => {
    if (editingRef) {
      editingRef.current = activeEditingId != null;
    }
  }, [editingRef, activeEditingId]);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editingIdRef = useRef(activeEditingId);
  editingIdRef.current = activeEditingId;

  const handlersRef = useRef(null);
  if (!handlersRef.current) {
    handlersRef.current = {
      edit: id => {
        if (editingIdRef.current != null && editingIdRef.current !== id) {
          message.warning('请先保存或取消正在编辑的 Task');
          return;
        }
        newIdRef.current = null;
        setEditingId(id);
      },
      remove: id => {
        onChangeRef.current(tasksRef.current.filter(item => item.id !== id));
      }
    };
  }

  const handleAdd = () => {
    if (activeEditingId != null) {
      message.warning('请先保存或取消正在编辑的 Task');
      return;
    }
    const next = createEmptySkill();
    newIdRef.current = next.id;
    onChange(tasks.concat([next]));
    setEditingId(next.id);
  };

  const handleSave = data => {
    onChange(tasks.map(item => (item.id === data.id ? data : item)));
    newIdRef.current = null;
    setEditingId(null);
  };

  const handleCancel = item => {
    if (newIdRef.current === item.id && isBlankTask(item)) {
      onChange(tasks.filter(task => task.id !== item.id));
    }
    newIdRef.current = null;
    setEditingId(null);
  };

  const canDelete = tasks.length > minLength;

  return (
    <div className={style['task-list']}>
      {tasks.length ? null : <div className={style['task-empty']}>暂无 Task，请添加</div>}
      {tasks.map((item, index) =>
        item.id === activeEditingId ? (
          <TaskEditCard key={`edit-${item.id}`} FormInfo={FormInfo} index={index} item={item} options={options} onSave={handleSave} onCancel={() => handleCancel(item)} />
        ) : (
          <TaskRow key={item.id || index} item={item} index={index} options={options} canDelete={canDelete} onEdit={handlersRef.current.edit} onDelete={handlersRef.current.remove} />
        )
      )}
      <Button className={style['task-add-btn']} type="dashed" block icon={<PlusOutlined />} onClick={handleAdd}>
        添加 Task
      </Button>
    </div>
  );
};

/**
 * Task 列表字段：只渲染轻量行，编辑时单行切换为独立 Form，保存后整体回写父表单 skill。
 * 避免父表单为每个 Task 注册十余个字段 + 嵌套依据 List 导致的卡顿。
 */
const TaskListField = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules, options, minLength, editingRef, ...props }) => {
  const [FormInfo] = remoteModules;
  const { useOnChange } = FormInfo.hooks;
  const extrasRef = useRef({ FormInfo, options, minLength, editingRef });
  extrasRef.current = { FormInfo, options, minLength, editingRef };

  const StableField = useMemo(
    () =>
      function TaskListStableField(fieldProps) {
        return <TaskList {...fieldProps} {...extrasRef.current} />;
      },
    []
  );

  const render = useOnChange(Object.assign({ name: 'skill' }, props));
  return render(StableField);
});

export default TaskListField;
