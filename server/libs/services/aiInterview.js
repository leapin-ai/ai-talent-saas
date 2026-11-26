const fp = require('fastify-plugin');
const { getApiBase, createSignedHeaders, openApiRequest } = require('../utils/aiInterviewOpenApi');

/** 租户 AI 面试连接统一取自「AI 面试设置」（talentReviewSetting），本服务只负责 open-api 调用 */
module.exports = fp(async (fastify, options) => {
  const getSettingService = () => fastify[options.name].services.talentReviewSetting;

  /** 对外保持 { apiUrl, appId, hasSecretKey, cdnUrl, version }；远程组件地址取自 AI 面试站点的 remote-module-config.json */
  const detail = async ({ tenantId }) => {
    const publicData = await getSettingService().detail({ tenantId });
    const configured = !!(publicData.url && publicData.appId && publicData.hasSecretKey);
    const remote = configured ? await getSettingService().getRemote({ origin: publicData.origin }) : null;
    return {
      cdnUrl: remote?.url || '',
      version: remote?.version || '',
      apiUrl: publicData.url,
      appId: publicData.appId,
      hasSecretKey: publicData.hasSecretKey
    };
  };

  const getCredentials = async tenantId => getSettingService().getCredentials(tenantId);

  const getProjects = async ({ tenantId, currentPage = 1, perPage = 20, filter }) => {
    const credentials = await getCredentials(tenantId);
    const now = new Date().toISOString();
    return openApiRequest(credentials, 'project/list', {
      query: {
        currentPage,
        perPage,
        filter: Object.assign({}, filter || {}, {
          status: 'open',
          startTime: { endTime: now },
          endTime: { startTime: now }
        })
      }
    });
  };

  const requireFileId = id => {
    const fileId = String(id || '').trim();
    if (!fileId) {
      throw new Error('缺少文件 ID');
    }
    return fileId;
  };

  const parseUrlPayload = data => {
    if (!data) {
      return null;
    }
    if (typeof data === 'string' && /^https?:\/\//i.test(data)) {
      return data;
    }
    if (typeof data === 'object') {
      const candidate = data.url || data.fileUrl || data.link || data.data;
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      if (candidate && typeof candidate === 'object' && typeof candidate.url === 'string') {
        return candidate.url;
      }
    }
    return null;
  };

  /** AI 面试域 static/file-url：取文件真实可访问地址，取不到返回 null */
  const resolveRemoteUrl = async (credentials, fileId) => {
    try {
      const urlRes = await fetch(`${getApiBase(credentials.apiUrl)}/static/file-url/${encodeURIComponent(fileId)}`, { method: 'GET', headers: createSignedHeaders(credentials) });
      const text = await urlRes.text();
      let data = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        // plain url string
      }
      if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'code') && data.code !== 0) {
        throw new Error(data.msg || data.message || 'file-url 失败');
      }
      return parseUrlPayload(data && Object.prototype.hasOwnProperty.call(data, 'data') ? data.data : data);
    } catch (e) {
      return null;
    }
  };

  /** 下载 AI 面试域文件并上传到本仓文件系统，返回本仓文件 ID */
  const transferToLocal = async (credentials, fileId) => {
    const remoteUrl = await resolveRemoteUrl(credentials, fileId);
    const fileRes = remoteUrl ? await fetch(remoteUrl, { method: 'GET' }) : await fetch(`${getApiBase(credentials.apiUrl)}/static/file-id/${encodeURIComponent(fileId)}`, { method: 'GET', headers: createSignedHeaders(credentials) });
    if (!fileRes.ok) {
      throw new Error(`下载面试录像失败: ${fileRes.status}`);
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const contentType = fileRes.headers.get('content-type') || 'video/mp4';
    const ext = contentType.includes('webm') ? 'webm' : contentType.includes('wav') ? 'wav' : contentType.includes('mp3') ? 'mp3' : 'mp4';
    const uploaded = await fastify.fileManager.services.uploadToFileSystem({
      file: {
        toBuffer: () => buffer,
        filename: `interview-${fileId}.${ext}`,
        mimetype: contentType
      }
    });
    return uploaded?.id || uploaded;
  };

  Object.assign(fastify[options.name].services, {
    aiInterview: {
      detail,
      getProjects,
      inviteCandidate: async ({ tenantId, projectId, name, email, phone, description, expires, needLoginShorten = true, needNotice = true }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'project/invite-candidate', {
          method: 'POST',
          body: {
            id: projectId,
            name,
            email: email || undefined,
            phone: phone || undefined,
            description: description || undefined,
            expires,
            needLoginShorten,
            // open-api 后续正式支持；当前 inviteCandidateWithNoLogin 内部已默认不发提醒，仍透传
            needNotice
          }
        });
      },
      /**
       * 开放接口（超级管理员）：建题 / 转数字人 / 建项目。需要 AI 面试设置里的密钥所属用户是平台超级管理员。
       * 对应 ai-interview-flowup 的 /open-api/admin/*
       */
      getProjectDetail: async ({ tenantId, id }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'project/detail', { query: { id } });
      },
      adminListDigitals: async ({ tenantId, clientId, perPage = 100, currentPage = 1 }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'admin/client/digital/list', { query: { clientId, perPage, currentPage } });
      },
      adminCreateQuestion: async ({ tenantId, body }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'admin/question/create', { method: 'POST', body });
      },
      adminGenerateDigital: async ({ tenantId, digitalIds, questionIds, forceRetry = false }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'admin/question/generate-digital', {
          method: 'POST',
          body: { digitalIds, questionIds, forceRetry: !!forceRetry }
        });
      },
      adminCreateProject: async ({ tenantId, body }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'admin/project/create', { method: 'POST', body });
      },
      /** 修改项目结束时间；AI 面试侧会把沿用旧结束时间的邀请一并延期 */
      adminUpdateProjectEndTime: async ({ tenantId, id, endTime }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'admin/project/end-time', { method: 'POST', body: { id: String(id), endTime } });
      },
      getInterviewList: async ({ tenantId, projectId, currentPage = 1, perPage = 10, filter }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'project/interview-list', {
          query: {
            id: projectId,
            currentPage,
            perPage,
            filter: filter || {}
          }
        });
      },
      getInterviewDetail: async ({ tenantId, id }) => {
        const credentials = await getCredentials(tenantId);
        return openApiRequest(credentials, 'project/interview-detail', {
          query: { id }
        });
      },
      /**
       * 解析 AI 面试域文件可公网访问 URL（供阿里云 filetrans file_link）
       * 优先 static/file-url；失败则下载后转存本仓 OSS 再取链接
       */
      getFileUrl: async ({ tenantId, id }) => {
        const fileId = requireFileId(id);
        const credentials = await getCredentials(tenantId);
        const direct = await resolveRemoteUrl(credentials, fileId);
        if (direct) {
          return direct;
        }
        const localId = await transferToLocal(credentials, fileId);
        return fastify.fileManager.services.getFileUrl({ id: localId });
      },
      /**
       * 把 AI 面试域的文件（如面试录像）转存到本仓文件系统，返回本仓文件 ID
       * 先取 static/file-url 的真实地址下载，取不到再走 static/file-id
       */
      transferFile: async ({ tenantId, id }) => {
        const fileId = requireFileId(id);
        const credentials = await getCredentials(tenantId);
        return transferToLocal(credentials, fileId);
      },
      /** ajax 根地址：去掉末尾 /api/v1，供前端直连面试接口 */
      getAjaxBaseUrl: apiUrl => {
        const apiBase = getApiBase(apiUrl);
        return apiBase.replace(/\/api\/v\d+$/i, '');
      }
    }
  });
});
