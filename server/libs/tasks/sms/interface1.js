const crypto = require('node:crypto');

const runner = async (fastify, options, { task, polling, updateProgress }) => {
  const { name, props, content } = task.input;
  const algorithm = 'aes-128-ecb';
  const appId = fastify.config['SMS_ACCESS_APP_ID'];
  const secretKey = fastify.config['SMS_ACCESS_SECRET'];
  const { signature, text } = content;
  const params = {
    mobile: name.replace(/\s+/g, ''),
    content: `【${signature}】 ${text}`,
    requestTime: Date.now(),
    requestValidPeriod: 5000
  };

  const jsonStr = JSON.stringify(params);
  console.log('原始JSON:', jsonStr);
  // 2. 转换为UTF-8编码的byte数组
  const data = Buffer.from(jsonStr, 'utf-8');
  // 创建cipher对象 (ECB模式不需要IV)
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'utf-8'), null);
  // 手动设置PKCS5Padding (在Node.js中自动处理)
  let encrypted = cipher.update(data, null, 'binary');
  encrypted += cipher.final('binary');
  const encryptedData = Buffer.from(encrypted, 'binary');
  const response = await fetch(`http://www.btom.cn:8080/inter/sendSingleSMS`, {
    method: 'POST',
    headers: {
      appId: appId,
      'Content-Type': 'application/octet-stream'
    },
    body: encryptedData
  });

  if (!response.ok) {
    throw new Error(`HTTP错误! 状态码: ${response.status}`);
  }
  return await (async () => {
    const resultCode = response.headers.get('result');
    console.log('响应状态码:', resultCode);

    if (resultCode !== 'SUCCESS') {
      throw new Error(`请求失败，状态码: ${resultCode}`);
    }

    // 2. 获取响应数据并解密
    const responseData = Buffer.from(await response.arrayBuffer());

    // AES/ECB/PKCS5Padding 解密
    const algorithm = 'aes-128-ecb'; // 根据实际情况调整算法
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey, 'utf-8'), null);

    let decrypted = decipher.update(responseData, null, 'utf8');
    decrypted += decipher.final('utf8');

    return { result: decrypted, props, content, name };
  })();
};

module.exports = runner;
