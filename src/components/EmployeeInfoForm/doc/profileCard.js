const { ProfileCard } = _EmployeeInfoForm;
const { createWithRemoteLoader } = remoteLoader;

const ProfileCardExample = createWithRemoteLoader({
  modules: ['components-core:FormInfo']
})(({ remoteModules }) => {
  const [FormInfo] = remoteModules;
  const { Form } = FormInfo;

  return (
    <div style={{ maxWidth: 400 }}>
      <Form onSubmit={data => console.log(data)}>
        <ProfileCard avatarUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuC_AorCAIKZoI2DcahfuT4hT9GDUUaBpTlWUJr3Odohda9NuDi2rGCxWiHwow-OsNiPPrLtCIrMVU4Qgmrdt9H7-60ACubvKLb5EdJ8va-qaAPLMj_uaNUQ1Yolk_J-nfhIheltcXrRHkspotSFm3X6xjh9wKyM_NQYE_P3ACK6aNkJsUEoBca-5ursPSnyHnwZmAxZGHS2FUvH8E1piSMezqWm6H1XxWyU2Zm_G83zLtokX2mz2IOXE-TMwR6YKhDEbySePufNnvrE" />
      </Form>
    </div>
  );
});

render(<ProfileCardExample />);
