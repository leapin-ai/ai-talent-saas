const getApis = options => {
  const { prefix } = Object.assign({}, { prefix: '/api/v1' }, options);

  return {
    talentSaas: {
      tenantAdmin: {
        userList: {
          url: `${prefix}/tenant-extra/admin/user-list`,
          method: 'GET'
        },
        sendOrgMessage: {
          url: `${prefix}/tenant/admin/send-org-message`,
          method: 'POST'
        },
        position: {
          list: {
            url: `${prefix}/tenant/admin/position-list`,
            method: 'GET'
          }
        }
      },
      tenant: {
        userList: {
          url: `${prefix}/tenant-extra/user-list`,
          method: 'GET'
        },
        sendOrgMessage: {
          url: `${prefix}/tenant/send-org-message`,
          method: 'POST'
        },
        position: {
          list: {
            url: `${prefix}/tenant/position/list`,
            method: 'GET'
          },
          detail: {
            url: `${prefix}/tenant/position/detail`,
            method: 'GET'
          },
          create: {
            url: `${prefix}/tenant/position/create`,
            method: 'POST'
          },
          save: {
            url: `${prefix}/tenant/position/save`,
            method: 'POST'
          },
          remove: {
            url: `${prefix}/tenant/position/remove`,
            method: 'POST'
          }
        },
        market: {
          recommend: {
            url: `${prefix}/tenant/market/recommend`,
            method: 'GET'
          },
          search: {
            url: `${prefix}/tenant/employee/search`,
            method: 'POST'
          }
        },
        employee: {
          list: {
            url: `${prefix}/tenant/employee/list`,
            method: 'GET'
          },
          detail: {
            url: `${prefix}/tenant/employee/detail`,
            method: 'GET'
          },
          create: {
            url: `${prefix}/tenant/employee/create`,
            method: 'POST'
          },
          save: {
            url: `${prefix}/tenant/employee/save`,
            method: 'POST'
          },
          remove: {
            url: `${prefix}/tenant/employee/remove`,
            method: 'POST'
          },
          saveProfile: {
            url: `${prefix}/tenant/employee/save-profile`,
            method: 'POST'
          },
          createPerformance: {
            url: `${prefix}/tenant/performance/create`,
            method: 'POST'
          },
          removePerformance: {
            url: `${prefix}/tenant/performance/remove`,
            method: 'POST'
          },
          savePerformance: {
            url: `${prefix}/tenant/performance/save`,
            method: 'POST'
          },
          linkTenantUser: {
            url: `${prefix}/tenant/employee/link-tenant-user`,
            method: 'POST'
          },
          unlinkTenantUser: {
            url: `${prefix}/tenant/employee/unlink-tenant-user`,
            method: 'POST'
          }
        },
        resume: {
          parseFileId: {
            url: `${prefix}/tenant/resume/parse-file-id`,
            method: 'POST'
          },
          parseFileIds: {
            url: `${prefix}/tenant/resume/parse-file-ids`,
            method: 'POST'
          },
          list: {
            url: `${prefix}/tenant/resume/list`,
            method: 'GET'
          }
        }
      }
    }
  };
};

export default getApis;
