# 公网 HTTPS MVP 部署说明

目标：全国任何地方的老板用手机打开一个 HTTPS 网址，就能试用录音、接待复盘、方案初稿和微信跟进话术。

## 推荐部署组合

- 前端：Vercel / Netlify / Cloudflare Pages
- 后端：Render / Railway / Fly.io / 阿里云轻量应用服务器
- 模型：DashScope 千问

最省心组合：前端用 Vercel，后端用 Render。两边都有免费或低成本入口，并且天然提供 HTTPS。

## 后端环境变量

在后端部署平台设置：

```text
DASHSCOPE_API_KEY=你的千问 DashScope Key
PUBLIC_ACCESS_CODE=你自己设置的试用访问码
QWEN_REALTIME_MODEL=qwen-audio-3.0-realtime-plus
QWEN_REALTIME_WS_URL=wss://dashscope.aliyuncs.com/api-ws/v1/realtime
QWEN_FOLLOWUP_MODEL=qwen-plus
QWEN_PREMIUM_FOLLOWUP_MODEL=qwen-max
CORS_ORIGINS=["https://你的前端域名"]
```

后端目录：

```text
backend
```

安装命令：

```bash
pip install -r requirements.txt
```

启动命令：

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

如果平台能识别 `backend/Procfile`，启动命令会自动读取。

健康检查地址：

```text
https://你的后端域名/health
```

应该返回：

```json
{"status":"ok"}
```

## 前端环境变量

在前端部署平台设置：

```text
VITE_API_BASE_URL=https://你的后端域名
```

前端目录：

```text
sales-copilot-preview
```

构建命令：

```bash
npm install
npm run build
```

发布目录：

```text
dist
```

## 访问码

公网 MVP 已经加了访问码：

- 前端首次打开会要求输入访问码
- HTTP API 请求会带 `X-Access-Code`
- 语音 WebSocket 会带 `access_code`
- 后端用 `PUBLIC_ACCESS_CODE` 校验
- `/health` 保持公开，方便平台健康检查

不要把访问码公开发到社交平台。给试用老板单独发，后面如果担心外传，就换一个新的 `PUBLIC_ACCESS_CODE`。

## 手机录音

手机麦克风需要 HTTPS。上线后请使用：

```text
https://你的前端域名
```

不要用裸 IP 的 HTTP 地址测试手机录音。

## 本地开发

本地继续用原脚本：

```powershell
.\start-backend.ps1
.\start-frontend.ps1
```

如果要本地测试访问码，在 `backend/.env` 添加：

```text
PUBLIC_ACCESS_CODE=你的测试码
```

## 这份副本的用途

- `构建APP 2_底座备份_20260812`：冻结保留，作为未来定制或转方向的底座
- `构建APP 2_公网MVP工作副本`：只用于公网 MVP 部署和后续线上迭代
