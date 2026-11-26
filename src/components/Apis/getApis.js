const getApis = options => {
  const { prefix } = Object.assign({}, { prefix: '/api/v1' }, options);

  return {
    talentSaas: {
      tenantAdmin: {
        userList: {
          url: `${prefix}/tenant-extra/admin/user-list`,
          method: 'GET'
        },
        orgList: {
          url: `${prefix}/tenant/admin/org-list`,
          method: 'GET'
        },
        sendOrgMessage: {
          url: `${prefix}/tenant/admin/send-org-message`,
          method: 'POST'
        },
        homeSetting: {
          detail: {
            url: `${prefix}/tenant/admin/home-setting`,
            method: 'GET'
          },
          save: {
            url: `${prefix}/tenant/admin/home-setting-save`,
            method: 'POST'
          }
        },
        talentReviewSetting: {
          detail: {
            url: `${prefix}/tenant/admin/talent-review-setting`,
            method: 'GET'
          },
          save: {
            url: `${prefix}/tenant/admin/talent-review-setting-save`,
            method: 'POST'
          },
          cancel: {
            url: `${prefix}/tenant/admin/talent-review-setting-cancel`,
            method: 'POST'
          },
          client: {
            url: `${prefix}/tenant/admin/talent-review-setting/client`,
            method: 'GET'
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
        },
        readinessIssue: {
          list: {
            url: `${prefix}/tenant/admin/readiness-issue/list`,
            method: 'GET'
          },
          detail: {
            url: `${prefix}/tenant/admin/readiness-issue/detail`,
            method: 'GET'
          },
          resolve: {
            url: `${prefix}/tenant/admin/readiness-issue/resolve`,
            method: 'POST'
          }
        },
        readiness: {
          list: { url: `${prefix}/tenant/admin/readiness/list`, method: 'POST' },
          detail: { url: `${prefix}/tenant/admin/readiness/detail`, method: 'POST' },
          stageDetail: { url: `${prefix}/tenant/admin/readiness/stage/detail`, method: 'POST' },
          create: { url: `${prefix}/tenant/admin/readiness/create`, method: 'POST' },
          cancel: { url: `${prefix}/tenant/admin/readiness/cancel`, method: 'POST' },
          confirm: { url: `${prefix}/tenant/admin/readiness/manual/confirm`, method: 'POST' },
          questionnaireEdit: { url: `${prefix}/tenant/admin/readiness/manual/questionnaire-edit`, method: 'POST' },
          questionnaireUpdate: { url: `${prefix}/tenant/admin/readiness/manual/questionnaire-update`, method: 'POST' },
          projectPreview: { url: `${prefix}/tenant/admin/readiness/manual/project-preview`, method: 'POST' },
          confirmDigitals: { url: `${prefix}/tenant/admin/readiness/manual/digitals`, method: 'POST' },
          confirmMailSend: { url: `${prefix}/tenant/admin/readiness/manual/confirm-mail/send`, method: 'POST' },
          submitAnswers: { url: `${prefix}/tenant/admin/readiness/manual/submit-answers`, method: 'POST' },
          advanceAnswers: { url: `${prefix}/tenant/admin/readiness/manual/advance-answers`, method: 'POST' },
          reanswer: { url: `${prefix}/tenant/admin/readiness/manual/reanswer`, method: 'POST' },
          skipReassessConfirm: { url: `${prefix}/tenant/admin/readiness/manual/skip-reassess-confirm`, method: 'POST' },
          triggerReport: { url: `${prefix}/tenant/admin/readiness/trigger-report`, method: 'POST' },
          rollback: { url: `${prefix}/tenant/admin/readiness/rollback`, method: 'POST' },
          retry: { url: `${prefix}/tenant/admin/readiness/retry`, method: 'POST' },
          stageApply: { url: `${prefix}/tenant/admin/readiness/stage/apply`, method: 'POST' },
          sendPreview: { url: `${prefix}/tenant/admin/readiness/send/preview`, method: 'POST' },
          sendDefaults: { url: `${prefix}/tenant/admin/readiness/send/defaults`, method: 'POST' },
          sendBatch: { url: `${prefix}/tenant/admin/readiness/send/batch`, method: 'POST' },
          resendInvite: { url: `${prefix}/tenant/admin/readiness/invite/resend`, method: 'POST' },
          deleteInvite: { url: `${prefix}/tenant/admin/readiness/invite/delete`, method: 'POST' },
          syncAnswers: { url: `${prefix}/tenant/admin/readiness/answers/sync`, method: 'POST' },
          employeeOptions: { url: `${prefix}/tenant/admin/readiness/employee-options`, method: 'POST' }
        }
      },
      tenant: {
        userList: {
          url: `${prefix}/tenant-extra/user-list`,
          method: 'GET'
        },
        talentReview: {
          setting: {
            url: `${prefix}/tenant/talent-review-setting`,
            method: 'GET'
          },
          projectList: {
            url: `${prefix}/tenant/talent-review/project/list`,
            method: 'GET'
          },
          projectDetail: {
            url: `${prefix}/tenant/talent-review/project/detail`,
            method: 'GET'
          },
          projectCreate: {
            url: `${prefix}/tenant/talent-review/project/create`,
            method: 'POST'
          },
          projectSave: {
            url: `${prefix}/tenant/talent-review/project/save`,
            method: 'POST'
          },
          projectStatus: {
            url: `${prefix}/tenant/talent-review/project/status`,
            method: 'POST'
          },
          projectOrg: {
            url: `${prefix}/tenant/talent-review/project/org`,
            method: 'GET'
          },
          projectReport: {
            url: `${prefix}/tenant/talent-review/project/report`,
            method: 'GET'
          },
          interviewReport: {
            url: `${prefix}/tenant/talent-review/interview-report`,
            method: 'GET'
          },
          projectInvite: {
            url: `${prefix}/tenant/talent-review/project/invite`,
            method: 'POST'
          },
          saveEvaluators: {
            url: `${prefix}/tenant/talent-review/project/save-evaluators`,
            method: 'POST'
          },
          resendMember: {
            url: `${prefix}/tenant/talent-review/project/resend-member`,
            method: 'POST'
          },
          resendEvaluator: {
            url: `${prefix}/tenant/talent-review/project/resend-evaluator`,
            method: 'POST'
          },
          modelList: {
            url: `${prefix}/tenant/talent-review/model/list`,
            method: 'GET'
          },
          modelDetail: {
            url: `${prefix}/tenant/talent-review/model/detail`,
            method: 'GET'
          },
          modelQuestions: {
            url: `${prefix}/tenant/talent-review/model/questions`,
            method: 'GET'
          },
          orgSource: {
            url: `${prefix}/tenant/talent-review/org-source`,
            method: 'GET'
          }
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
          insight: {
            url: `${prefix}/tenant/position/workforce-summary`,
            method: 'GET'
          },
          workforceSummary: {
            url: `${prefix}/tenant/position/workforce-summary`,
            method: 'GET'
          },
          workforceAiMix: {
            url: `${prefix}/tenant/position/workforce-ai-mix`,
            method: 'GET'
          },
          tasks: {
            url: `${prefix}/tenant/position/tasks`,
            method: 'GET'
          },
          replaceTasks: {
            url: `${prefix}/tenant/position/tasks/replace`,
            method: 'POST'
          },
          taskReadiness: {
            url: `${prefix}/tenant/position/task-readiness`,
            method: 'GET'
          },
          taskReadinessReplace: {
            url: `${prefix}/tenant/position/task-readiness/replace`,
            method: 'POST'
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
          },
          skillAnalysisDetail: {
            url: `${prefix}/tenant/position/skill-analysis-detail`,
            method: 'GET'
          },
          skillAnalysisSave: {
            url: `${prefix}/tenant/position/skill-analysis-save`,
            method: 'POST'
          },
          startReadiness: {
            url: `${prefix}/tenant/position/start-readiness`,
            method: 'POST'
          },
          cancelReadiness: {
            url: `${prefix}/tenant/position/cancel-readiness`,
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
          evidence: {
            url: `${prefix}/tenant/employee/evidence`,
            method: 'GET'
          },
          saveEvidence: {
            url: `${prefix}/tenant/employee/evidence/save`,
            method: 'POST'
          },
          replaceTaskEvidence: {
            url: `${prefix}/tenant/employee/evidence/replace-task`,
            method: 'POST'
          },
          removeEvidence: {
            url: `${prefix}/tenant/employee/evidence/remove`,
            method: 'POST'
          },
          reportReadinessIssue: {
            url: `${prefix}/tenant/employee/readiness-issue`,
            method: 'POST'
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
          saveAiSuggest: {
            url: `${prefix}/tenant/employee/save-ai-suggest`,
            method: 'POST'
          },
          generateTalentInsight: {
            url: `${prefix}/tenant/employee/generate-talent-insight`,
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
        homeSetting: {
          detail: {
            url: `${prefix}/tenant/home-setting`,
            method: 'GET'
          }
        },
        aiInterview: {
          projects: {
            url: `${prefix}/tenant/ai-interview-projects`,
            method: 'GET'
          }
        },
        talentCollectInvite: {
          send: {
            url: `${prefix}/tenant/position/talent-collect-invite/send`,
            method: 'POST'
          },
          resend: {
            url: `${prefix}/tenant/position/talent-collect-invite/resend`,
            method: 'POST'
          },
          link: {
            url: `${prefix}/tenant/position/talent-collect-invite/link`,
            method: 'GET'
          },
          list: {
            url: `${prefix}/tenant/position/talent-collect-invite/list`,
            method: 'GET'
          },
          interviewResult: {
            url: `${prefix}/tenant/position/talent-collect-invite/interview-result`,
            method: 'GET'
          },
          cancel: {
            url: `${prefix}/tenant/position/talent-collect-invite/cancel`,
            method: 'POST'
          },
          updateStatus: {
            url: `${prefix}/tenant/position/talent-collect-invite/update-status`,
            method: 'POST'
          }
        },
        shareReport: {
          sendPosition: {
            url: `${prefix}/tenant/share-report/position/send`,
            method: 'POST'
          },
          sendEmployee: {
            url: `${prefix}/tenant/share-report/employee/send`,
            method: 'POST'
          }
        }
      },
      public: {
        talentCollectInvite: {
          detail: {
            url: `${prefix}/public/talent-collect-invite`,
            method: 'GET'
          },
          saveProfile: {
            url: `${prefix}/public/talent-collect-invite/save-profile`,
            method: 'POST'
          },
          parseResume: {
            url: `${prefix}/public/talent-collect-invite/parse-resume`,
            method: 'POST'
          },
          ensureInvite: {
            url: `${prefix}/public/talent-collect-invite/ensure-invite`,
            method: 'POST'
          },
          markDone: {
            url: `${prefix}/public/talent-collect-invite/mark-done`,
            method: 'POST'
          }
        },
        readinessConfirm: {
          detail: {
            url: `${prefix}/public/readiness-confirm`,
            method: 'GET'
          },
          confirm: {
            url: `${prefix}/public/readiness-confirm`,
            method: 'POST'
          },
          reject: {
            url: `${prefix}/public/readiness-confirm/reject`,
            method: 'POST'
          }
        },
        shareReport: {
          detail: {
            url: `${prefix}/public/share-report`,
            method: 'GET'
          },
          tasks: {
            url: `${prefix}/public/share-report/tasks`,
            method: 'GET'
          },
          talentMetrics: {
            url: `${prefix}/public/share-report/talent-metrics`,
            method: 'GET'
          },
          taskReadiness: {
            url: `${prefix}/public/share-report/task-readiness`,
            method: 'GET'
          },
          skillAnalysisDetail: {
            url: `${prefix}/public/share-report/skill-analysis-detail`,
            method: 'GET'
          },
          evidence: {
            url: `${prefix}/public/share-report/evidence`,
            method: 'GET'
          }
        }
      }
    }
  };
};

export default getApis;
