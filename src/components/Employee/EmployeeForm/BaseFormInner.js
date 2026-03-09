import { createWithRemoteLoader } from '@kne/remote-loader';
import { useState } from 'react';
import withLocale from '../withLocale';
import { useIntl } from '@kne/react-intl';
import { Flex, Spin } from 'antd';

const BaseFormInner = createWithRemoteLoader({
  modules: ['components-core:FormInfo', 'components-core:Enum', 'components-core:Global@usePreset']
})(
  withLocale(({ remoteModules, apis, action, ...props }) => {
    const [FormInfo, Enum, usePreset] = remoteModules;
    const { useFormContext } = FormInfo;
    const { Avatar, Input, Select, DatePicker, TextArea, RadioGroup, PhoneNumber, AddressSelect, Upload, SuperSelect, SuperSelectTree } = FormInfo.fields;
    const { formatMessage } = useIntl();
    const { ajax } = usePreset();
    const { openApi } = useFormContext();
    const [parseResume, setParseResume] = useState(false);
    return (
      <Flex vertical gap={10}>
        {action !== 'edit' && (
          <Spin tip="简历解析中..." spinning={parseResume}>
            <FormInfo
              title="从简历解析"
              bordered
              column={1}
              list={[
                <Upload
                  name="resumes"
                  label="上传简历"
                  maxLength={1}
                  int
                  getPermission={type => {
                    return ['preview'].indexOf(type) > -1;
                  }}
                  interceptor="file-format"
                  onChange={async files => {
                    setParseResume(true);
                    const { data } = await ajax(
                      Object.assign({}, apis.parseResume, {
                        data: {
                          id: files[0].id
                        }
                      })
                    );
                    if (data.code !== 0) {
                      openApi.setField('resume', []);
                    } else {
                      openApi.setFormData(
                        Object.assign({}, data.data, {
                          resumes: files
                        })
                      );
                    }
                    setParseResume(false);
                  }}
                />
              ]}
            />
          </Spin>
        )}
        <FormInfo
          {...props}
          title="基本信息"
          column={2}
          list={[
            <Avatar name="avatar" label="头像" labelHidden block interceptor="photo-string" />,
            <Input name="name" label={formatMessage({ id: 'employee.name' })} rule="REQ LEN-0-100" />,
            <Input name="nameEn" label={formatMessage({ id: 'employee.nameEn' })} rule="LEN-0-100" />,
            <Enum moduleName="gender" format="option">
              {list => {
                return <Select name="gender" label={formatMessage({ id: 'employee.gender' })} options={list} />;
              }}
            </Enum>,
            <Enum moduleName="marital" format="option">
              {list => {
                return <Select name="marital" label={formatMessage({ id: 'employee.marital' })} options={list} />;
              }}
            </Enum>,
            <DatePicker name="birthday" label={formatMessage({ id: 'employee.birthday' })} />,
            <DatePicker name="options.start_work_date" picker="month" label={formatMessage({ id: 'employee.startWorkDate' })} />,
            <TextArea name="description" label={formatMessage({ id: 'employee.description' })} block rule="LEN-0-500" />
          ]}
        />
        <FormInfo
          {...props}
          title="联系方式"
          column={2}
          list={[
            <Input name="email" label={formatMessage({ id: 'employee.email' })} rule="EMAIL" />,
            <Input name="personalEmail" label={formatMessage({ id: 'employee.personalEmail' })} rule="EMAIL" />,
            <AddressSelect name="city" label={formatMessage({ id: 'employee.city' })} single />,
            <Input name="address" label={formatMessage({ id: 'employee.address' })} rule="LEN-0-200" />,
            <PhoneNumber name="phone" label={formatMessage({ id: 'employee.phone' })} format="string" />
          ]}
        />
        <FormInfo
          {...props}
          title="紧急联系人"
          column={2}
          list={[
            <Input name="emergencyContact" label={formatMessage({ id: 'employee.emergencyContact' })} rule="LEN-0-50" />,
            <PhoneNumber name="emergencyPhone" label={formatMessage({ id: 'employee.emergencyPhone' })} rule="PHONE" format="string" />
          ]}
        />
        <FormInfo
          {...props}
          title="教育信息"
          column={2}
          list={[
            <Input name="college" label={formatMessage({ id: 'employee.college' })} rule="LEN-0-100" />,
            <Input name="major" label={formatMessage({ id: 'employee.major' })} rule="LEN-0-100" />,
            <Enum moduleName="collegeType" format="option">
              {list => {
                return <Select name="collegeType" label={formatMessage({ id: 'employee.collegeType' })} options={list} />;
              }}
            </Enum>,
            <Enum moduleName="degreeEnum" format="option">
              {list => {
                return <Select name="degree" label={formatMessage({ id: 'employee.degree' })} options={list} />;
              }}
            </Enum>,
            <Enum moduleName="recruit" format="option" block>
              {list => {
                return <RadioGroup name="recruit" label={formatMessage({ id: 'employee.recruit' })} options={list} />;
              }}
            </Enum>
          ]}
        />
        <FormInfo
          {...props}
          title="身份信息"
          column={2}
          list={[
            <Select
              name="idType"
              label={formatMessage({ id: 'employee.idType' })}
              options={[
                { label: formatMessage({ id: 'idType.ID_CARD' }), value: 'ID_CARD' },
                { label: formatMessage({ id: 'idType.PASSPORT' }), value: 'PASSPORT' },
                { label: formatMessage({ id: 'idType.OTHER' }), value: 'OTHER' }
              ]}
            />,
            <Input name="idNumber" label={formatMessage({ id: 'employee.idNumber' })} rule="LEN-0-50" />,
            <Input name="nationality" label={formatMessage({ id: 'employee.nationality' })} rule="LEN-0-50" />,
            <Input name="ethnicity" label={formatMessage({ id: 'employee.ethnicity' })} rule="LEN-0-50" />,
            <Input name="politicalStatus" label={formatMessage({ id: 'employee.politicalStatus' })} rule="LEN-0-100" />
          ]}
        />
        <FormInfo
          {...props}
          title="工作信息"
          column={2}
          list={[
            <Enum moduleName="employeeStatus" format="option">
              {options => {
                return <Select name="status" label={formatMessage({ id: 'employee.status' })} rule="REQ" options={options} />;
              }}
            </Enum>,
            <DatePicker name="hireDate" label={formatMessage({ id: 'employee.hireDate' })} />,
            <SuperSelect
              name="options.position"
              label="岗位"
              labelKey="name"
              valueKey="id"
              interceptor="object-output-value"
              single
              api={apis.positionList}
              getSearchProps={({ searchText }) => {
                return {
                  filter: {
                    keyword: searchText
                  }
                };
              }}
              dataFormat={data => {
                return {
                  list: data.pageData.map(item => {
                    return Object.assign({}, item, {
                      description: item.description ? item.description.replace(/<[^>]*>/g, '') : null
                    });
                  }),
                  total: data.totalCount
                };
              }}
              pagination={{
                paramsType: 'params'
              }}
            />,
            <SuperSelectTree name="options.tenantOrgId" label="部门" api={apis.orgList} valueKey="id" labelKey="name" single interceptor="object-output-value" />
          ]}
        />
      </Flex>
    );
  })
);

export default BaseFormInner;
