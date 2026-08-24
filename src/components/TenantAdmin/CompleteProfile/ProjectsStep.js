import { useEffect, useMemo, useState } from 'react';
import { Button, Flex, Tag, Typography, message } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useIntl } from '@kne/react-intl';
import style from './style.module.scss';

const EMPTY_PROJECT = { name: '', role: '', description: '', skills: [], period: [] };

export const createEmptyProject = () => Object.assign({}, EMPTY_PROJECT, { skills: [], period: [] });

export const isBlankProject = project => {
  if (!project || typeof project !== 'object') {
    return true;
  }
  const hasText = [project.name, project.role, project.description].some(value => value != null && String(value).trim() !== '');
  const hasSkills = Array.isArray(project.skills) && project.skills.filter(Boolean).length > 0;
  const hasPeriod = Array.isArray(project.period) ? project.period.some(Boolean) : project.period != null && String(project.period).trim() !== '';
  return !hasText && !hasSkills && !hasPeriod;
};

const formatPeriodPart = (value, soFarText) => {
  if (value == null || value === '') {
    return '';
  }
  if (value === true || value === 'sofar' || value === 'Sofar' || value === 'present') {
    return soFarText;
  }
  const parsed = dayjs(value);
  if (parsed.isValid()) {
    return parsed.format('MMM YYYY');
  }
  return String(value);
};

export const formatProjectPeriod = (period, soFarText) => {
  if (period == null || period === '') {
    return '';
  }
  if (typeof period === 'string') {
    return period;
  }
  if (Array.isArray(period)) {
    const start = formatPeriodPart(period[0], soFarText);
    const end = formatPeriodPart(period[1], soFarText) || (start ? soFarText : '');
    if (start && end) {
      return `${start} – ${end}`;
    }
    return start || end;
  }
  return formatPeriodPart(period, soFarText);
};

const ProjectCardView = ({ project, onEdit, formatMessage }) => {
  const soFarText = formatMessage({ id: 'tenantAdmin.completeSoFar' });
  const periodText = formatProjectPeriod(project.period, soFarText);
  const meta = [project.role, periodText].filter(Boolean).join(' · ');
  const skills = Array.isArray(project.skills) ? project.skills.filter(Boolean) : [];

  return (
    <div className={style['project-card']}>
      <div className={style['project-card-header']}>
        <div className={style['project-card-heading']}>
          <Typography.Title level={5} className={style['project-card-title']}>
            {project.name || formatMessage({ id: 'tenantAdmin.completeUntitledProject' })}
          </Typography.Title>
          {meta ? <div className={style['project-card-meta']}>{meta}</div> : null}
        </div>
        <Button className={style['project-edit-btn']} icon={<EditOutlined />} onClick={onEdit}>
          {formatMessage({ id: 'tenantAdmin.completeEdit' })}
        </Button>
      </div>
      {project.description ? <Typography.Paragraph className={style['project-card-desc']}>{project.description}</Typography.Paragraph> : null}
      {skills.length > 0 ? (
        <div className={style['project-card-tags']}>
          {skills.map(skill => (
            <Tag key={skill} className={style['project-skill-tag']}>
              {skill}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const ProjectEditCard = ({ FormInfo, initial, canDelete, onSave, onCancel, onDelete }) => {
  const { formatMessage } = useIntl();
  const { Form, SubmitButton, fields } = FormInfo;
  const { Input, TextArea, Select, DatePickerToday } = fields;

  return (
    <div className={`${style['project-card']} ${style['project-card-editing']}`}>
      <Form
        data={initial || createEmptyProject()}
        onSubmit={data => {
          onSave(
            Object.assign({}, createEmptyProject(), data, {
              skills: Array.isArray(data?.skills) ? data.skills.filter(Boolean) : []
            })
          );
        }}
      >
        <FormInfo
          column={1}
          list={[
            <Input name="name" label={formatMessage({ id: 'tenantAdmin.completeProjectName' })} rule="REQ LEN-0-100" />,
            <Input name="role" label={formatMessage({ id: 'tenantAdmin.completeProjectRole' })} rule="LEN-0-100" />,
            DatePickerToday ? (
              <DatePickerToday name="period" label={formatMessage({ id: 'tenantAdmin.completeProjectPeriod' })} picker="month" soFarText={formatMessage({ id: 'tenantAdmin.completeSoFar' })} />
            ) : (
              <Input name="period" label={formatMessage({ id: 'tenantAdmin.completeProjectPeriod' })} rule="LEN-0-100" />
            ),
            <TextArea name="description" label={formatMessage({ id: 'tenantAdmin.completeProjectDesc' })} rule="LEN-0-2000" />,
            <Select name="skills" label={formatMessage({ id: 'tenantAdmin.completeProjectSkills' })} mode="tags" placeholder={formatMessage({ id: 'tenantAdmin.completeAddSkill' })} />
          ].filter(Boolean)}
        />
        <Flex className={style['project-edit-actions']} gap={12} justify="flex-end" wrap="wrap">
          {canDelete ? (
            <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
              {formatMessage({ id: 'tenantAdmin.completeDelete' })}
            </Button>
          ) : null}
          <Button onClick={onCancel}>{formatMessage({ id: 'tenantAdmin.completeCancel' })}</Button>
          <SubmitButton type="primary">{formatMessage({ id: 'tenantAdmin.completeSave' })}</SubmitButton>
        </Flex>
      </Form>
    </div>
  );
};

const ProjectsStep = ({ FormInfo, value, onChange, onEditingChange }) => {
  const { formatMessage } = useIntl();
  const projects = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [editingIndex, setEditingIndex] = useState(() => {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }
    const blankIndex = value.findIndex(isBlankProject);
    return blankIndex >= 0 ? blankIndex : null;
  });

  const setEditing = index => {
    setEditingIndex(index);
    onEditingChange && onEditingChange(index !== null);
  };

  useEffect(() => {
    onEditingChange && onEditingChange(editingIndex !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync initial editing flag once
  }, []);

  const commitProjects = next => {
    onChange && onChange(next);
  };

  const handleAdd = () => {
    if (editingIndex !== null) {
      message.warning(formatMessage({ id: 'tenantAdmin.completeFinishEditFirst' }));
      return;
    }
    const next = projects.concat([createEmptyProject()]);
    commitProjects(next);
    setEditing(next.length - 1);
  };

  const handleSave = (index, data) => {
    const next = projects.slice();
    next[index] = data;
    commitProjects(next);
    setEditing(null);
  };

  const handleCancel = index => {
    if (isBlankProject(projects[index]) && projects.length > 1) {
      commitProjects(projects.filter((_, i) => i !== index));
    } else if (isBlankProject(projects[index]) && projects.length === 1) {
      commitProjects([]);
    }
    setEditing(null);
  };

  const handleDelete = index => {
    commitProjects(projects.filter((_, i) => i !== index));
    setEditing(null);
  };

  return (
    <div className={style['projects-wrap']}>
      <div className={style['projects-list']}>
        {projects.map((project, index) =>
          editingIndex === index ? (
            <ProjectEditCard
              key={`edit-${index}`}
              FormInfo={FormInfo}
              initial={project}
              canDelete={projects.length > 1 || !isBlankProject(project)}
              onSave={data => handleSave(index, data)}
              onCancel={() => handleCancel(index)}
              onDelete={() => handleDelete(index)}
            />
          ) : (
            <ProjectCardView
              key={`view-${index}-${project.name || index}`}
              project={project}
              formatMessage={formatMessage}
              onEdit={() => {
                if (editingIndex !== null) {
                  message.warning(formatMessage({ id: 'tenantAdmin.completeFinishEditFirst' }));
                  return;
                }
                setEditing(index);
              }}
            />
          )
        )}
      </div>
      <button type="button" className={style['project-add-btn']} onClick={handleAdd}>
        <PlusOutlined />
        <span>{formatMessage({ id: 'tenantAdmin.completeAddProject' })}</span>
      </button>
    </div>
  );
};

ProjectsStep.createEmptyProject = createEmptyProject;
ProjectsStep.isBlankProject = isBlankProject;

export default ProjectsStep;
