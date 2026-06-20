// ===== Config =====
const BASE_DOMAIN = "ghcr.milu.moe";
const CDN_DOMAIN  = "production-" + BASE_DOMAIN;

const UPSTREAM_REGISTRY = "https://ghcr.io";
const UPSTREAM_AUTH     = "https://ghcr.io/token";
const UPSTREAM_CDN      = "https://pkg-containers.githubusercontent.com";

// ==================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      const html =
        `<h1>🎉 Cloudflare ghcr Proxy is Running!</h1>
         <p>Base: ${BASE_DOMAIN}</p>
         <p>CDN: ${CDN_DOMAIN}</p>`;
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // 其他路径全部走反代
    let target = null;

    if (url.hostname === BASE_DOMAIN) {
      if (url.pathname.startsWith("/auth")) {
        // Auth API
        target = new URL(UPSTREAM_AUTH + url.pathname.replace("/auth", "") + url.search);
      } else {
        // Registry API
        target = new URL(UPSTREAM_REGISTRY + url.pathname + url.search);
      }
    } else if (url.hostname === CDN_DOMAIN) {
      // 镜像层 CDN
      target = new URL(UPSTREAM_CDN + url.pathname + url.search);
    }

    // 构造转发请求
    const newRequest = new Request(target, request);
    newRequest.headers.set("Host", target.hostname);

    const response = await fetch(newRequest);
    const newHeaders = new Headers(response.headers);

    // 替换认证域名
    if (newHeaders.has("WWW-Authenticate")) {
      newHeaders.set(
        "WWW-Authenticate",
        newHeaders.get("WWW-Authenticate").replace(
          UPSTREAM_AUTH,
          "https://" + BASE_DOMAIN + "/auth"
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
