const { Header } = _TalentMarket;

const HeaderExample = () => {
  const [searchValue, setSearchValue] = React.useState('');

  return <Header searchValue={searchValue} onSearchChange={setSearchValue} onFilterToggle={() => console.log('Toggle filter')} />;
};

render(<HeaderExample />);
