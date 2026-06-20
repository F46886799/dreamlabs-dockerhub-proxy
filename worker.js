// ===== Config =====
const BASE_DOMAIN = "docker.milu.moe";
const AUTH_DOMAIN = "auth-" + BASE_DOMAIN;
const CDN_DOMAIN  = "production-" + BASE_DOMAIN;

const UPSTREAM_REGISTRY = "https://registry-1.docker.io";
const UPSTREAM_AUTH     = "https://auth.docker.io";
const UPSTREAM_CDN      = "https://production.cloudflare.docker.com";

// ==================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const html =
        `<h1>🎉 Cloudflare Docker Proxy is Running!</h1>
         <p>Base: ${BASE_DOMAIN}</p>
         <p>Auth: ${AUTH_DOMAIN}</p>
         <p>CDN: ${CDN_DOMAIN}</p>`;
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    let target = null;

    if (url.hostname === BASE_DOMAIN) {
      // Registry API
      target = new URL(UPSTREAM_REGISTRY + url.pathname + url.search);
    } else if (url.hostname === AUTH_DOMAIN) {
      // Auth API
      target = new URL(UPSTREAM_AUTH + url.pathname + url.search);
    } else if (url.hostname === CDN_DOMAIN) {
      // 镜像层 CDN
      target = new URL(UPSTREAM_CDN + url.pathname + url.search);
    }

    // 构造转发请求
    const newRequest = new Request(target, request);
    newRequest.headers.set("Host", target.hostname);

    // 保证流式传输
    const response = await fetch(newRequest);

    // 修改响应头
    const newHeaders = new Headers(response.headers);

    // 替换认证域名
    if (newHeaders.has("WWW-Authenticate")) {
      newHeaders.set(
        "WWW-Authenticate",
        newHeaders.get("WWW-Authenticate").replace(
          UPSTREAM_AUTH,
          "https://" + AUTH_DOMAIN
        )
      );
    }

    // 替换镜像层 Location 域名
    if (newHeaders.has("Location")) {
      newHeaders.set(
        "Location",
        newHeaders.get("Location").replace(
          UPSTREAM_CDN,
          "https://" + CDN_DOMAIN
        )
      );
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};