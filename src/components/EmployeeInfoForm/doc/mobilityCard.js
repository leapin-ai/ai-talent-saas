const { MobilityCard } = _EmployeeInfoForm;
const { createWithRemoteLoader } = remoteLoader;

const MobilityCardExample = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { Form } = FormInfo;

  return (
    <Form onSubmit={data => console.log(data)}>
      <MobilityCard />
    </Form>
  );
});

render(<MobilityCardExample />);
