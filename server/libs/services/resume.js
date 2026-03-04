const fp = require('fastify-plugin');
const crypto = require('node:crypto');
const compact = require('lodash/compact');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];

  const parseTaskRecord = async ({ result, task }) => {
    const { force } = task.input;
    const { rawContent, ...resumeData } = result;

    if (force) {
      const resume = await models.resume.findOne({
        where: {
          fileMD5: result.fileMD5
        }
      });
      if (resume) {
        await resume.update(resumeData);
        // 更新关联的 resumeRawContent
        if (rawContent) {
          let resumeRawContent = await models.resumeRawContent.findOne({
            where: {
              id: resume.resumeRawContentId
            }
          });
          if (resumeRawContent) {
            await resumeRawContent.update({ rawContent });
          } else {
            resumeRawContent = await models.resumeRawContent.create({ rawContent });
            await resume.update({ resumeRawContentId: resumeRawContent.id });
          }
        }
        return resume;
      }
    }
    // 创建新的 resume 和关联的 resumeRawContent
    const resume = await models.resume.create(resumeData);
    if (rawContent) {
      const resumeRawContent = await models.resumeRawContent.create({ rawContent });
      await resume.update({ resumeRawContentId: resumeRawContent.id });
    }
    return resume;
  };

  const parseFile = async ({ file }) => {
    const buffer = await file.toBuffer();
    const hash = crypto.createHash('md5');
    hash.update(buffer);
    const md5 = hash.digest('hex');

    const candidateCache = await models.resume.findOne({
      where: {
        fileMD5: md5
      }
    });

    if (candidateCache) {
      return null;
    }

    const { id: fileId } = await fastify.fileManager.services.uploadToFileSystem({
      file
    });

    const targetFile = await fastify.fileManager.services.getFileInstance({ id: fileId });

    return await fastify.task.services.create({
      type: 'parse-resume',
      targetId: targetFile.id,
      targetType: 'file',
      runnerType: 'system',
      input: {
        name: `${fileId}:${targetFile.filename}`,
        fileId
      }
    });
  };

  const parseFileList = async ({ files }) => {
    return compact(await Promise.all(files.map(file => parseFile({ file }))));
  };

  const parseFileId = async ({ id, force = false }) => {
    const targetFile = await fastify.fileManager.services.getFileInstance({ id });
    const resumeCache = await models.resume.findOne({
      where: {
        fileMD5: targetFile.hash
      }
    });

    if (!force && resumeCache) {
      return resumeCache;
    }
    const task = await fastify.task.services.create({
      type: 'parse-resume',
      targetId: targetFile.id,
      targetType: 'file',
      runnerType: 'system',
      input: {
        name: id,
        fileId: id,
        force
      }
    });
    return await fastify.task.services.waitingComplete({ id: task.id });
  };

  const parseFileIds = async ({ ids }) => {
    return compact(await Promise.all(ids.map(id => parseFileId({ id }))));
  };

  const list = async ({ perPage, currentPage, filter }) => {
    const whereQuery = {};
    const { rows, count } = await models.resume.findAndCountAll({
      where: whereQuery,
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [['createdAt', 'DESC']]
    });

    return {
      pageData: rows,
      totalCount: count
    };
  };

  Object.assign(fastify[options.name].services, {
    resume: { parseFile, parseFileId, parseFileList, parseFileIds, parseTaskRecord, list }
  });
});
