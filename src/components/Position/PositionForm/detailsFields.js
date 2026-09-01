import PayDetails from '@kne/pay-details';

export const buildDetailsFields = ({ FormInfo, apis, formatMessage, mobile, required = true, orgInterceptor = true }) => {
  const { Select, AddressSelect, FunctionSelect, SuperSelectTree } = FormInfo.fields;
  const req = required ? 'REQ' : undefined;

  return [
    <SuperSelectTree
      key="tenantOrgId"
      name="tenantOrgId"
      label={formatMessage({ id: 'position.department' })}
      api={apis.orgList}
      valueKey="id"
      labelKey="name"
      single
      {...(orgInterceptor ? { interceptor: 'object-output-value' } : {})}
      rule={req}
    />,
    <Select
      key="language"
      name="language"
      label={formatMessage({ id: 'position.language' })}
      rule={req}
      options={[
        { label: formatMessage({ id: 'language.zh-CN' }), value: 'zh-CN' },
        { label: formatMessage({ id: 'language.en-US' }), value: 'en-US' }
      ]}
    />,
    <Select
      key="locationType"
      name="locationType"
      label={formatMessage({ id: 'position.locationType' })}
      rule={req}
      options={[
        { label: formatMessage({ id: 'locationType.on-site' }), value: 'on-site' },
        { label: formatMessage({ id: 'locationType.remote' }), value: 'remote' }
      ]}
    />,
    <AddressSelect
      key="location"
      name="location"
      label={formatMessage({ id: 'position.city' })}
      display={context => {
        const { formData } = context;
        return formData.locationType === 'on-site';
      }}
      isPopup={!mobile}
    />,
    <FunctionSelect key="capacity" name="capacity" label={formatMessage({ id: 'position.capacity' })} single isPopup={false} />,
    <PayDetails key="salary" name="salary" label={formatMessage({ id: 'position.salary' })} defaultValue={{ currency: 'CNY' }} rule="PAY_SALARY" />
  ];
};
