const { default: Employee } = _Employee;
const { default: preset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const EmployeeExample = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  return <Employee baseUrl="/tenant" apis={apis.talentSaas.tenant.employee} />;
});

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal']
})(({ remoteModules }) => {
  const [PureGlobal] = remoteModules;
  return (
    <PureGlobal preset={preset}>
      <EmployeeExample />
    </PureGlobal>
  );
});

render(<BaseExample />);
