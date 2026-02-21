# 腾讯混元 API 代理 - Cloudflare Workers

用于解决腾讯混元 API 的 CORS 限制，让浏览器可以直接调用。

## 部署步骤

### 1. 安装依赖
```bash
cd hunyuan-proxy
npm install
```

### 2. 登录 Cloudflare
```bash
npx wrangler login
```

### 3. 设置 API Key
在 Cloudflare Workers 控制台设置环境变量：
1. 访问 https://dash.cloudflare.com/
2. 进入 Workers & Pages → hunyuan-proxy → Settings → Variables
3. 添加变量：`HUNYUAN_API_KEY = 你的腾讯混元 API 密钥`

或者使用命令：
```bash
npx wrangler secret put HUNYUAN_API_KEY
```

### 4. 部署
```bash
npm run deploy
```

部署后会得到一个 URL，例如：`https://hunyuan-proxy.your-subdomain.workers.dev`

## 使用方式

在你的应用设置中：
1. 选择提供商：腾讯混元（需要手动添加到代码中）
2. Base URL: `https://hunyuan-proxy.your-subdomain.workers.dev`
3. API Key: 你的腾讯混元 API 密钥

## 免费额度

Cloudflare Workers 免费计划：
- 每天 100,000 次请求
- 每次请求最多 10ms CPU 时间
- 完全足够个人使用！

## 费用说明

- Cloudflare Workers: 免费
- 腾讯混元 API: 按量计费（有免费额度）
