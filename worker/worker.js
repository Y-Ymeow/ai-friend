// Cloudflare Workers - AI 模型统一代理
// 支持多个 AI 提供商，统一转发请求

const PROVIDERS = {
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    chatEndpoint: '/chat/completions',
    imageEndpoint: '/images/generations',
    auth: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    chatEndpoint: (model) => `/models/${model}:generateContent`,
    imageEndpoint: null,
    auth: (apiKey) => ({ 'x-goog-api-key': apiKey }),
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    chatEndpoint: '/chat/completions',
    imageEndpoint: null,
    auth: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  volcengine: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    chatEndpoint: '/chat/completions',
    imageEndpoint: null,
    auth: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  modelscope: {
    baseUrl: 'https://api.modelscope.cn/api/v1',
    chatEndpoint: '/chat/completions',
    imageEndpoint: null,
    auth: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: getCorsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const path = url.pathname;
      const body = await request.json();
      
      // 从请求头或 body 获取提供商信息
      const provider = request.headers.get('X-Provider') || body._provider || 'zhipu';
      const apiKey = env[`${provider.toUpperCase()}_API_KEY`];
      
      if (!apiKey) {
        return jsonResponse({ error: `未配置 ${provider} API Key` }, 400);
      }

      const config = PROVIDERS[provider];
      if (!config) {
        return jsonResponse({ error: `不支持的提供商：${provider}` }, 400);
      }

      // 构建目标 URL
      let targetUrl;
      if (path.includes('/images/')) {
        // 生图请求
        if (!config.imageEndpoint) {
          return jsonResponse({ error: `${provider} 不支持生图` }, 400);
        }
        targetUrl = config.baseUrl + config.imageEndpoint;
      } else {
        // 对话请求
        const endpoint = typeof config.chatEndpoint === 'function' 
          ? config.chatEndpoint(body.model)
          : config.chatEndpoint;
        targetUrl = config.baseUrl + endpoint;
      }

      // 清理请求体（移除内部字段）
      const { _provider, ...cleanBody } = body;
      
      // 构建请求头
      const headers = {
        'Content-Type': 'application/json',
        ...config.auth(apiKey),
      };

      // 转发请求
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(cleanBody),
      });

      const data = await response.json();

      return jsonResponse(data, response.status, {
        'X-Provider': provider,
      });
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  },
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
      ...extraHeaders,
    },
  });
}

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Provider, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
