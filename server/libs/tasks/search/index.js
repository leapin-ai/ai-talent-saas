const runner = async (fastify, options, { task }) => {
  const searchApiUrl = fastify.config.SEARCH_API_URL;
  const { query, tenantId, perPage = 20, currentPage = 1, highlightFields, matchType } = task.input;

  const requestBody = {
    query,
    model_type: 'employees',
    project_name: 'talent_profile',
    env: 'staging',
    region: 'cn',
    method: 'fusion',
    page: currentPage,
    page_size: perPage,
    include_fields: ['id']
  };

  if (highlightFields) {
    requestBody.highlight_fields = highlightFields;
  }

  if (matchType) {
    requestBody.match_type = matchType;
  }

  const response = await fetch(searchApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify(requestBody)
  });

  if (response.status !== 200) {
    throw new Error(`search failed: ${response.status} ${response.statusText}`);
  }

  const resData = await response.json();

  if (resData.status_code !== 200) {
    throw new Error(`search failed: ${resData.status_code} ${resData.error_msg}`);
  }

  const { results, total, page, page_size } = resData.data;

  return {
    pageData: results,
    totalCount: total,
    currentPage: page,
    perPage: page_size
  };
};

module.exports = runner;
