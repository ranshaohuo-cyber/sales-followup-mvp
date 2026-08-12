# 销售副驾驶 Demo Backend

老板演示版最小后端：提供 OpenAI Realtime 临时凭证、mock 销售经验库搜索、演示日志记录。

## 目录结构

```text
backend/
  app/
    main.py
    config.py
    routes/
      realtime.py
      qwen_realtime.py
      experience.py
      demo_log.py
    services/
      openai_realtime.py
      qwen_realtime.py
      experience_search.py
      demo_logger.py
    data/
      experiences.json
      demo_logs.jsonl
    schemas/
      realtime.py
      qwen_realtime.py
      experience.py
      demo_log.py
  .env.example
  .gitignore
  requirements.txt
  README.md
```

## 启动

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 或 DASHSCOPE_API_KEY
uvicorn app.main:app --reload --port 8000
```

健康检查：

```powershell
curl http://127.0.0.1:8000/health
```

## 接口测试

### 1. 创建 Realtime 临时会话

```powershell
curl -X POST http://127.0.0.1:8000/api/realtime/session `
  -H "Content-Type: application/json" `
  -d '{"sessionId":"demo_001"}'
```

返回给前端的是短期 `clientSecret`，真实 `OPENAI_API_KEY` 只留在后端。

### 1b. 创建 Qwen Realtime 会话描述

`qwen-audio-3.0-realtime-plus` 走 WebSocket，不提供浏览器可直接使用的临时 Key。前端先拿后端代理地址：

```powershell
curl -X POST http://127.0.0.1:8000/api/qwen/realtime/session
```

然后前端连接：

```text
ws://127.0.0.1:8000/api/qwen/realtime/ws
```

前端只连后端 WebSocket，后端再使用 `DASHSCOPE_API_KEY` 连接千问，避免 API Key 暴露到浏览器。

### 2. 搜索经验库

```powershell
curl -X POST http://127.0.0.1:8000/api/experience/search `
  -H "Content-Type: application/json" `
  -d '{"transcript":"客户说你们比竞品贵不少，我得再看看","signals":["价格","竞品"],"intent":"比较竞品"}'
```

### 3. 记录演示日志

```powershell
curl -X POST http://127.0.0.1:8000/api/demo/log `
  -H "Content-Type: application/json" `
  -d '{"sessionId":"demo_001","transcript":"客户说你们比竞品贵不少","usedExperience":true,"latencyMs":820,"action":"先别急着降价，先帮客户算总成本。","speech":"您先别只看单价，我帮您把后期维护和售后成本一起算清楚。"}'
```

日志写入 `app/data/demo_logs.jsonl`。

### 4. 获取经验库列表

```powershell
curl http://127.0.0.1:8000/api/experiences
```

## Realtime Session Instructions

```text
你是销售副驾驶，不是聊天机器人。
你正在听客户和销售的现场沟通。
你要低延迟给销售输出极短建议。
客户出现价格、竞品、预算、风险、售后、不会用、再考虑、优惠等信号时，优先调用 searchSalesExperience。
信息不足时，不调用经验库，先建议销售追问。
输出格式固定：
是否调用经验库：是/否
客户意图：12 字以内
现在做：40 字以内
现在说：40 字以内
不要长篇分析。
不要像客服。
要像销冠在耳边提醒。
```

## 前端如何接 WebRTC Realtime

### OpenAI WebRTC

1. 前端调用 `POST /api/realtime/session` 拿 `clientSecret`。
2. 前端用 `clientSecret` 作为 Bearer token，与 OpenAI Realtime 建 WebRTC 连接。
3. 前端通过麦克风把客户语音送入 Realtime。
4. 模型如果发起 `searchSalesExperience` function call，前端解析参数后调用 `POST /api/experience/search`。
5. 前端把经验库搜索结果作为 function call output 发回 Realtime。
6. 模型输出固定三行：是否调用经验库、现在做、现在说。
7. 前端展示短文本，并调用 `POST /api/demo/log` 记录本次演示。

### Qwen WebSocket

1. 前端调用 `POST /api/qwen/realtime/session` 拿后端代理地址和音频格式要求。
2. 前端申请麦克风权限，把麦克风音频转成 16kHz、16bit、单声道 PCM。
3. 前端连接 `ws://127.0.0.1:8000/api/qwen/realtime/ws`。
4. 前端持续发送 Qwen 事件，例如 `input_audio_buffer.append`，音频按 100ms 分片 base64 发送。
5. 后端使用 `server_vad`，客户停顿后自动触发模型生成，不需要点击停止才分析。
6. Qwen 触发工具调用时，后端自动查 `/api/experience/search` 对应的本地服务，并把结果写回模型。
7. 前端监听 `response.text.delta` / `response.done`，文字实时展示；播报由浏览器 TTS 只读取“现在做 / 现在说”卡片内容。

## 本地联调前端录音

最简单方式：在项目根目录 `C:\Users\Administrator\Documents\构建APP 2` 打开两个 PowerShell。

第一个窗口启动后端：

```powershell
.\start-backend.ps1
```

第二个窗口启动前端：

```powershell
.\start-frontend.ps1
```

如果你想手动启动，也可以用下面的命令。

先启动后端：

```powershell
cd "C:\Users\Administrator\Documents\构建APP 2\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

再启动前端：

```powershell
cd "C:\Users\Administrator\Documents\构建APP 2\sales-copilot-preview"
npm run dev -- --host 127.0.0.1 --port 5173
```

打开：

```text
http://127.0.0.1:5173
```

进入“实时副驾”，切到“语音输入”，点击“录音”，浏览器弹出麦克风权限时选择允许。录音保持开启后，客户每说完一段并短暂停顿，千问会自动生成“现在做 / 现在说”。前端按“播报顺序”和两个“自动播报”开关，用浏览器 TTS 只读对应卡片里的内容。

顶部录音按钮有三种状态：

- `录音`：开始实时监听。
- `暂停`：暂停监听并断开当前 Qwen WebSocket，避免继续消耗实时连接。
- `继续`：重新连接并恢复监听。

底部“结束并整理”用于结束本次实时会话。

## 当前 mock 与未来替换

- `experiences.json` 是 mock 经验库；未来替换为数据库表、后台录入和审核流。
- `ExperienceSearchService` 是关键词匹配；未来替换为 embedding 向量检索、rerank、行业和销冠风格过滤。
- `demo_logs.jsonl` 是本地 JSONL 日志；未来替换为数据库、对象存储和复盘分析任务。
- Realtime tool call 由前端转发到 `/api/experience/search`；未来可增加后端会话编排、权限、租户隔离和审计。
- Qwen WebSocket 当前是透明代理加自动工具执行；未来可加入鉴权、会话状态、限流和更细的音频网关。
