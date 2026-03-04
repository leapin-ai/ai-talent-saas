const { CertificateCard } = _EmployeeInfoForm;

const CertificateCardExample = () => {
  const [certificates, setCertificates] = React.useState(['大学英语六级', '心理咨询师', '认证数据分析师']);

  return (
    <CertificateCard
      items={certificates}
      onAdd={() => setCertificates([...certificates, ''])}
      onRemove={index => setCertificates(certificates.filter((_, i) => i !== index))}
      onItemChange={(index, value) => {
        const newItems = [...certificates];
        newItems[index] = value;
        setCertificates(newItems);
      }}
    />
  );
};

render(<CertificateCardExample />);
