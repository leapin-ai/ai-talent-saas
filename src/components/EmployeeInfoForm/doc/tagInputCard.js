const { TagInputCard } = _EmployeeInfoForm;

const TagInputCardExample = () => {
  const [items, setItems] = React.useState(['数据分析师', '机器学习工程师']);

  return (
    <TagInputCard
      title="意向岗位"
      items={items}
      onAdd={() => setItems([...items, ''])}
      onRemove={index => setItems(items.filter((_, i) => i !== index))}
      onItemChange={(index, value) => {
        const newItems = [...items];
        newItems[index] = value;
        setItems(newItems);
      }}
      placeholder="请输入意向岗位"
    />
  );
};

render(<TagInputCardExample />);
