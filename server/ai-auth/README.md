# AI auth BFF（香港自托管）

`www.autional.cn` / `www.autional.com` 的 `/api/auth/*` 由香港机 `190.92.241.251`
上的两个 Node 容器提供。**不用 Vercel。**

## 拓扑

```
浏览器 → www.<root>/api/auth/*
  → 香港 sites-static 容器 nginx（container.conf 的 location ^~ /api/auth/）
  → 127.0.0.1:8090（cn）/ 8091（com）→ ai-bff-cn / ai-bff-com（node:22-alpine）
  → 平台 OAuth（authorize/token/userinfo）+ consent-status
```

## 文件

| 文件 | 作用 |
|---|---|
| `server.mjs` | Node HTTP 入口；`/health` + `/api/auth/*` |
| `config.mjs` | 读取环境变量并构造 `createAiAuth` |
| `sdk/` | `@autional/ai-auth` 构建产物（vendored） |
| `/etc/ai-bff/cn.env`、`com.env` | 每区环境（600；含 client secret/session secret/内部键） |

## 部署

```bash
# 本机打包（server.mjs/config.mjs/sdk/*.js/package.json）
tar -cf ai-bff-app.tar -C app .
scp ai-bff-app.tar root@190.92.241.251:/tmp/
scp cn.env com.env root@190.92.241.251:/tmp/

ssh root@190.92.241.251 '
  tar -C /opt/ai-bff/app -xf /tmp/ai-bff-app.tar
  install -m 600 /tmp/cn.env /etc/ai-bff/cn.env
  install -m 600 /tmp/com.env /etc/ai-bff/com.env
  docker restart ai-bff-cn ai-bff-com
'

curl -sS http://127.0.0.1:8090/health   # 在香港机上
curl -sS https://www.autional.cn/api/auth/session
```

## 反向代理

`sites.manifest.json` / `sites.manifest.com.json` 的 `proxySets`：

```json
"ai-auth":     [{ "prefix": "/api/auth/", "upstream": "http://127.0.0.1:8090" }]
"ai-auth-com": [{ "prefix": "/api/auth/", "upstream": "http://127.0.0.1:8091" }]
```

`web` / `web-com` 站点设置对应 `proxySet`，`gen-nginx-conf.mjs` 会生成 container 的
`location ^~ /api/auth/`。改完必须重新生成 `dist-nginx/container.conf` 并用
`publish.sh` 同源流程部署（容器 bind mount 换 inode 后需 `docker restart sites-static`）。

## 回滚

- BFF：`docker stop ai-bff-cn ai-bff-com`；nginx 304/502，静态站不受影响。
- 站点代理：删除 `proxySet`，重新生成 container.conf，rollback 到上一 release。
