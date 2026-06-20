// docker-hub-proxy.js
// Cloudflare Worker 代理 Docker Hub Registry

const DOCKER_HUB = 'https://registry-1.docker.io';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 保留原始路径和查询参数
    url.host = new URL(DOCKER_HUB).host;
    url.protocol = 'https:';
    
    // 复制并修改请求头
    const headers = new Headers(request.headers);
    headers.set('Host', 'registry-1.docker.io');
    
    // 移除 Cloudflare 相关头，避免被 Docker Hub 拒绝
    headers.delete('cf-ray');
    headers.delete('cf-visitor');
    headers.delete('cf-connecting-ip');
    
    // 构建新请求
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'follow'
    });
    
    // 发送请求到 Docker Hub
    let response;
    try {
      response = await fetch(modifiedRequest);
    } catch (error) {
      return new Response(`Proxy Error: ${error.message}`, { 
        status: 502,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    // 复制响应头
    const modifiedHeaders = new Headers(response.headers);
    
    // 添加 CORS 头，允许浏览器访问
    modifiedHeaders.set('Access-Control-Allow-Origin', '*');
    modifiedHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    modifiedHeaders.set('Access-Control-Allow-Headers', '*');
    
    // 处理 401 认证挑战（Docker Hub 要求）
    const wwwAuth = modifiedHeaders.get('WWW-Authenticate');
    if (wwwAuth && wwwAuth.includes('realm=')) {
      // 将认证 realm 指向 Docker Hub
      modifiedHeaders.set('WWW-Authenticate', wwwAuth);
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: modifiedHeaders
    });
  }
};
