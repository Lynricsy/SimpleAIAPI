# SimpleAIAPI

一个可以通过 Docker Compose 一键部署的 OpenAI API 中转服务，主要能力：

- ✅ 验证规范的 `Authorization: Bearer xxx` 请求头
- ✅ 将精简的 `model/system/数字键` 结构转换为标准 `chat/completions`
- ✅ 支持文本 + 图片（URL 或 Base64），Base64 会写入 `/img/<文件名>`
- ✅ 支持纯文本 / HTML 片段 / Hosted Page（含 LaTeX）的多种输出模式
- ✅ 自带彩色 Emoji 日志，信息清晰又可爱 🚀

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `PORT` | 服务监听端口，默认 `8080` |
| `AUTH_TOKENS` | 允许调用的入口 API Key，逗号分隔 |
| `UPSTREAM_BASE_URL` | 上游 OpenAI 兼容服务 Base URL，默认 `https://api.openai.com/v1` |
| `UPSTREAM_API_KEYS` | 上游 Key，可配置多个做轮询 |
| `DEFAULT_MODEL` | 未传 `model` 时使用的默认模型 |
| `TEMPERATURE` / `MAX_TOKENS` / `TOP_P` / `FREQUENCY_PENALTY` / `PRESENCE_PENALTY` | 常见 OpenAI 参数，选填 |
| `PUBLIC_BASE_URL` | 上游抓取图片时使用的公网地址（若未配置，会使用实际请求的 host） |
| `REQUEST_TIMEOUT_MS` | 转发至上游的超时配置，默认 `60000` |
| `IMAGE_RETENTION_DAYS` | 图片保留天数，默认 `7`，设为 `0` 可关闭自动清理 |
| `IMAGE_CLEANUP_INTERVAL_MINUTES` | 定期巡检频率（分钟），默认 `60` |
| `LOG_ASSISTANT_RESPONSES` | 设为 `true` 时，日志会额外输出 AI 原始回答（注意敏感信息） |

## 本地开发

```bash
npm install
npm run dev        # 启动开发监听
npm run build
npm start          # 使用编译后的代码
```

## Docker Compose

```bash
docker compose up --build -d
```

`docker-compose.yml` 已默认挂载 `./public/img`，便于保留图片并提供静态文件。

## 请求格式

```json
{
  "model": "gpt-4o-mini",
  "system": "你是旅游小帮手",
  "0": "帮我规划 3 天京都行程",
  "1": "https://example.com/pic.jpg",
  "render": "page"
}
```

- `Authorization` 请求头需为 `Bearer <token>`
- 数字键依序代表多条用户消息
- 单个 URL 且扩展名为常见图片 → 视为图片
- Base64（`data:image/*;base64,...`）会自动写入 `public/img`
- `render` 支持：
  - 未填或 `false`：返回纯文本
  - `true` / `"html"`：返回渲染后的 Markdown/LaTeX HTML 字符串
  - `"page"` / `"hosted"` / `"url"`：生成专属分享页面，API 只返回可直接打开的 URL（支持 LaTeX + 美化样式）

## API 响应

- 纯文本模式：`text/plain`
- HTML 片段模式：`text/html`
- Hosted Page 模式：返回 `text/plain` 的 URL
- 错误：`application/json`

## 日志

服务使用自定义 Logger，所有关键事件（请求、转发、错误）都会附带 Emoji 和详细上下文，便于排查。若需调试 AI 输出，可设置 `LOG_ASSISTANT_RESPONSES=true` 记录完整回答，但请务必注意数据安全。

## 图片存储与清理

- 所有 Base64 图片会先存储在 `public/img`
- 每隔 `IMAGE_CLEANUP_INTERVAL_MINUTES` 分钟执行巡检，将 `IMAGE_RETENTION_DAYS` 以前的旧图片删除
- 如需停用自动清理，把 `IMAGE_RETENTION_DAYS` 设为 `0` 即可（请自行管理磁盘空间）
