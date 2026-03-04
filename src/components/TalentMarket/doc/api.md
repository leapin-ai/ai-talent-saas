## TalentMarket 主组件

|属性名|说明|类型|默认值|
|---|---|---|---|

## Header 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|searchValue|搜索框值|string|-|
|onSearchChange|搜索框值变化回调|(value: string) => void|-|
|onFilterToggle|筛选按钮点击回调|() => void|-|

## TalentGrid 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|talents|候选人数据列表|array|[]|
|onViewProfile|点击查看档案时的回调函数|(talent: object) => void|-|

## TalentCard 子组件

|属性名|说明|类型|默认值|
|---|---|---|---|
|talent|候选人数据|object|-|
|onViewProfile|点击查看档案时的回调函数|(talent: object) => void|-|
