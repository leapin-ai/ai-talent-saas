import { App, Button, Flex, Modal, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';

const FeatureBindingPanel = ({ FormInfo, TablePage, tenantId, featureBindings, apis, ajax, formatMessage, onReload }) => {
  const { Form, SubmitButton, fields } = FormInfo;
  const { Input, SuperSelect } = fields;
  const { message, modal } = App.useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const list = Array.isArray(featureBindings) ? featureBindings : [];

  const openAdd = record => {
    setEditing(record || null);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setEditing(null);
  };

  const afterSaved = async () => {
    closeAdd();
    await onReload();
  };

  const remove = record => {
    modal.confirm({
      title: formatMessage({ id: 'removeConfirmTitle' }),
      content: formatMessage({ id: 'removeConfirmContent' }, { key: record.key }),
      onOk: async () => {
        const { data: resData } = await ajax(
          Object.assign({}, apis.talentSaas.tenantAdmin.aiInterview.removeFeatureBinding, {
            data: { tenantId, key: record.key }
          })
        );
        if (resData.code !== 0) {
          return;
        }
        message.success(formatMessage({ id: 'removeSuccess' }));
        await onReload();
      }
    });
  };

  const columns = [
    {
      name: 'key',
      title: formatMessage({ id: 'featureKey' }),
      type: 'mainInfo'
    },
    {
      name: 'projectName',
      title: formatMessage({ id: 'projectName' }),
      type: 'other',
      valueOf: item => item.projectName || item.projectId || '-'
    },
    {
      name: 'projectId',
      title: formatMessage({ id: 'projectId' }),
      type: 'serialNumber'
    },
    {
      name: 'options',
      title: formatMessage({ id: 'actions' }),
      type: 'options',
      fixed: 'right',
      valueOf: item => [
        {
          children: formatMessage({ id: 'edit' }),
          onClick: () => openAdd(item)
        },
        {
          children: formatMessage({ id: 'removeBinding' }),
          onClick: () => remove(item)
        }
      ]
    }
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center">
        <Typography.Text strong>{formatMessage({ id: 'featureTitle' })}</Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openAdd()}>
          {formatMessage({ id: 'addBinding' })}
        </Button>
      </Flex>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {formatMessage({ id: 'featureDescription' })}
      </Typography.Paragraph>
      <TablePage
        key={list.map(item => `${item.key}:${item.projectId}`).join('|') || 'empty'}
        name="ai-interview-feature-bindings"
        rowKey="key"
        sticky={false}
        pagination={{ open: false }}
        columns={columns}
        dataFormat={data => ({
          list: data.pageData || [],
          total: data.totalCount || 0
        })}
        loader={() =>
          Promise.resolve({
            pageData: list,
            totalCount: list.length
          })
        }
      />
      <Modal open={addOpen} title={editing ? formatMessage({ id: 'editBindingTitle' }) : formatMessage({ id: 'addBindingTitle' })} footer={null} destroyOnClose onCancel={closeAdd}>
        <ProjectBindingForm
          Form={Form}
          FormInfo={FormInfo}
          Input={Input}
          SuperSelect={SuperSelect}
          SubmitButton={SubmitButton}
          formatMessage={formatMessage}
          message={message}
          ajax={ajax}
          apis={apis}
          tenantId={tenantId}
          editing={editing}
          onSaved={afterSaved}
          onCancel={closeAdd}
        />
      </Modal>
    </Flex>
  );
};

const ProjectBindingForm = ({ Form, FormInfo, Input, SuperSelect, SubmitButton, formatMessage, message, ajax, apis, tenantId, editing, onSaved, onCancel }) => {
  const projectApi = useMemo(
    () =>
      Object.assign({}, apis.talentSaas.tenantAdmin.aiInterview.projects, {
        params: Object.assign({}, apis.talentSaas.tenantAdmin.aiInterview.projects.params || {}, {
          tenantId,
          perPage: 20
        })
      }),
    [apis, tenantId]
  );

  const submit = async formData => {
    const project = formData.project || {};
    const projectId = project.id || project.value || formData.projectId;
    const projectName = project.name || project.label || '';
    const clientId = project.client?.id || project.clientId || '';
    const { data: resData } = await ajax(
      Object.assign({}, apis.talentSaas.tenantAdmin.aiInterview.saveFeatureBinding, {
        data: {
          tenantId,
          key: formData.key,
          projectId,
          projectName,
          clientId
        }
      })
    );
    if (resData.code !== 0) {
      return false;
    }
    message.success(formatMessage({ id: 'saveSuccess' }));
    await onSaved();
  };

  return (
    <Form
      type="default"
      data={{
        key: editing?.key || '',
        project: editing?.projectId
          ? {
              id: editing.projectId,
              name: editing.projectName || editing.projectId,
              clientId: editing.clientId || '',
              client: editing.clientId ? { id: editing.clientId } : undefined
            }
          : undefined
      }}
      onSubmit={submit}
    >
      <FormInfo
        column={1}
        list={[
          <Input name="key" label={formatMessage({ id: 'featureKey' })} rule="REQ LEN-1-100" disabled={!!editing} placeholder={formatMessage({ id: 'featureKeyPlaceholder' })} />,
          <SuperSelect
            name="project"
            label={formatMessage({ id: 'project' })}
            rule="REQ"
            single
            labelKey="name"
            valueKey="id"
            api={projectApi}
            placeholder={formatMessage({ id: 'projectPlaceholder' })}
            dataFormat={data => ({
              list: data.pageData || [],
              total: data.totalCount || 0
            })}
            pagination={{
              paramsType: 'params'
            }}
          />
        ]}
      />
      <Flex justify="center" gap={12}>
        <SubmitButton>{formatMessage({ id: 'save' })}</SubmitButton>
        <Button onClick={onCancel}>{formatMessage({ id: 'cancel' })}</Button>
      </Flex>
    </Form>
  );
};

export default FeatureBindingPanel;
