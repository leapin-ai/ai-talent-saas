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
        aiInterview: {
          detail: {
            url: `${prefix}/tenant/admin/ai-interview-setting`,
            method: 'GET'
          },
          save: {
            url: `${prefix}/tenant/admin/ai-interview-setting-save`,
            method: 'POST'
          },
          projects: {
            url: `${prefix}/tenant/admin/ai-interview-projects`,
            method: 'GET'
          },
          saveFeatureBinding: {
            url: `${prefix}/tenant/admin/ai-interview-feature-binding-save`,
            method: 'POST'
          },
          removeFeatureBinding: {
            url: `${prefix}/tenant/admin/ai-interview-feature-binding-remove`,
            method: 'POST'
          }
        },
        position: {
          list: {
            url: `${prefix}/tenant/admin/position-list`,
            method: 'GET'
          },
          create: {
            url: `${prefix}/tenant/admin/position-create`,
            method: 'POST'
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
          },
          setStatus: {
            url: `${prefix}/tenant/position/set-status`,
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
          myDetail: {
            url: `${prefix}/tenant/employee/my-detail`,
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
        },
        assessment: {
          saveProfile: {
            url: `${prefix}/tenant/assessment/save-profile`,
            method: 'POST'
          },
          detail: {
            url: `${prefix}/tenant/assessment/detail`,
            method: 'GET'
          },
          ensureInvite: {
            url: `${prefix}/tenant/assessment/ensure-invite`,
            method: 'POST'
          },
          restart: {
            url: `${prefix}/tenant/assessment/restart`,
            method: 'POST'
          },
          acceptPrevious: {
            url: `${prefix}/tenant/assessment/accept-previous`,
            method: 'POST'
          },
          list: {
            url: `${prefix}/tenant/assessment/list`,
            method: 'GET'
          },
          getDetail: {
            url: `${prefix}/tenant/assessment/get-detail`,
            method: 'GET'
          },
          markSubmitted: {
            url: `${prefix}/tenant/assessment/mark-submitted`,
            method: 'POST'
          },
          approve: {
            url: `${prefix}/tenant/assessment/approve`,
            method: 'POST'
          },
          reject: {
            url: `${prefix}/tenant/assessment/reject`,
            method: 'POST'
          },
          generateTaskContext: {
            url: `${prefix}/tenant/assessment/generate-task-context`,
            method: 'GET'
          },
          completeGenerate: {
            url: `${prefix}/tenant/assessment/complete-generate`,
            method: 'POST'
          }
        }
      }
    }
  };
};

export default getApis;
