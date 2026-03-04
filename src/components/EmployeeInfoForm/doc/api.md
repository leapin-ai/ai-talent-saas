## EmployeeInfoForm 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|

## ProfileCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|form|Form 实例|FormInstance|-|
|onFinish|表单提交回调|(values: object) => void|-|
|avatarUrl|头像 URL|string|-|

## TagInputCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|title|卡片标题|string|-|
|icon|标题图标|ReactNode|-|
|items|标签列表|array|-|
|onAdd|添加标签回调|() => void|-|
|onRemove|删除标签回调|(index: number) => void|-|
|onItemChange|标签内容变化回调|(index: number, value: string) => void|-|
|placeholder|输入框占位符|string|-|
|buttonClassName|按钮样式类名|string|-|

## MobilityCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|mobilityData|流动性数据|object|-|
|onChange|数据变化回调|(data: object) => void|-|

## CertificateCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|items|证书列表|array|-|
|onAdd|添加证书回调|() => void|-|
|onRemove|删除证书回调|(index: number) => void|-|
|onItemChange|证书内容变化回调|(index: number, value: string) => void|-|
