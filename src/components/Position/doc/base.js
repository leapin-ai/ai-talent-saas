const { default: Position } = _Position;
const { default: preset } = _mockPreset;
const { createWithRemoteLoader } = remoteLoader;

const PositionExample = createWithRemoteLoader({
  modules: ['components-core:Global@usePreset']
})(({ remoteModules }) => {
  const [usePreset] = remoteModules;
  const { apis } = usePreset();
  return <Position baseUrl="/tenant" apis={apis.talentSaas.tenant.position} />;
});

const BaseExample = createWithRemoteLoader({
  modules: ['components-core:Global@PureGlobal']
})(({ remoteModules }) => {
  const [PureGlobal] = remoteModules;
  return (
    <PureGlobal preset={preset}>
      <PositionExample />
    </PureGlobal>
  );
});

render(<BaseExample />);
