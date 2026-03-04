## Employee 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|
| baseUrl | 路由基础路径 | string | '/' |
| apis | API配置对象 | object | - |
| apis.employee.list | 列表API | object | - |
| apis.employee.detail | 详情API | object | - |
| apis.employee.create | 创建API | object | - |
| apis.employee.save | 保存API | object | - |
| apis.employee.setStatus | 设置状态API | object | - |
| apis.employee.remove | 删除API | object | - |
| onDetail | 查看详情回调 | function | - |

## 数据结构

### employeeList 返回数据
| 字段 | 说明 | 类型 |
|------|------|------|
| id | ID | number |
| name | 姓名 | string |
| nameEn | 姓名(英文) | string |
| status | 状态 | string |
| gender | 性别 | string |
| email | 邮箱 | string |
| phone | 电话号码 | string |
| college | 毕业院校 | string |
| degree | 学历 | integer |
| city | 所在城市 | string |
| hireDate | 入职日期 | date |
| description | 简介 | text |
| createdAt | 创建时间 | datetime |
| updatedAt | 更新时间 | datetime |
