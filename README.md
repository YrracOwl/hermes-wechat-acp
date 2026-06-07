# Hermes WeChat ACP

> 微信消息桥接器，专为 [Hermes Agent](https://github.com/nousresearch/hermes-agent) 优化。支持完整媒体收发、交互式危险命令审批、openclaw-weixin 协议对齐。

[English version](README_EN.md)

基于 [wechat-acp v0.8.0](https://github.com/formulahendry/wechat-acp) 的 fork，为 Hermes 生态维护。通过 stdio 将微信一对一消息桥接到 Hermes（或任意 ACP Agent），并增加了媒体上传/下载、语音转码、危险命令审批等补丁。

## 相比上游的改进

| 功能 | 上游 v0.8.0 | hermes-wechat-acp |
|---------|:---:|:---:|
| 文字消息 | ✅ | ✅ |
| 图片/视频/文件 **发送** | ❌ | ✅（CDN 上传 + AES 加密） |
| 图片/视频/文件 **接收** | 仅文字 | ✅（CDN 解密 + 保存） |
| 语音消息 **接收**（SILK→WAV） | ❌ | ✅（silk-wasm 转码） |
| 交互式权限审批 | 仅自动允许 | ✅（用户回复允许/拒绝） |
| 编辑审批（文件修改） | ❌ | ✅（微信内展示 diff 预览） |
| `errcode=-14` 会话守卫 | ❌ | ✅（暂停+重试，对齐 openclaw） |
| openclaw-weixin 协议对齐 | 部分 | ✅（P0-P2，v2.4.4 的 6 项修复） |
| `aes_key` 编码修复 | ❌（图片显示"已过期"） | ✅ |
| contextToken 持久化修复 | ❌（重启后 ret=-2） | 已文档化并提供绕过方案 |
| `--permission-timeout` / `--permission-timeout-action` | ❌ | ✅ |
| `--hide-thoughts`（Agent 思考过滤） | ✅ | ✅（文档明确标注为必加） |
| `--daemon` 通过 `npx tsx` | 损坏 | ✅（自动检测并编译） |

## 快速开始

### 环境要求

- **Node.js 20+**
- **Hermes Agent** 已安装（`hermes acp --check` 必须通过）
- 一个可以使用 iLink Bot API 的微信账号
- 服务器能够访问 `https://ilinkai.weixin.qq.com` 和 `https://novac2c.cdn.weixin.qq.com`

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/YrracOwl/hermes-wechat-acp.git
cd hermes-wechat-acp

# 安装依赖并编译
npm install
npm run build

# 首次运行——扫码登录（2 分钟内用微信扫码）
npx tsx bin/wechat-acp.ts --agent hermes

# 生产环境守护进程（推荐）
npx tsx bin/wechat-acp.ts \
  --agent hermes \
  --daemon \
  --hide-thoughts \
  --config ~/.wechat-acp/config.json \
  --permission-timeout 300
```

首次运行时，终端会显示二维码。用微信扫描即可。登录凭证会保存到 `~/.wechat-acp/token.json`，后续自动复用。

### 通过 npm 安装（远程）

```bash
# （待发布）npx -y hermes-wechat-acp@latest --agent hermes
```

当前仅支持本地克隆 + 编译安装。

## CLI 参考

```
hermes-wechat-acp --agent <预设|命令> [选项]
hermes-wechat-acp agents          列出内置 Agent 预设
hermes-wechat-acp inject --text <文本>  注入本地消息
hermes-wechat-acp stop            停止守护进程
hermes-wechat-acp status          查看守护进程状态
```

### 选项

| 参数 | 默认值 | 说明 |
|------|---------|------|
| `--agent <值>` | （必填） | Agent 预设（`hermes`、`claude`、`copilot` 等）或原始命令 |
| `--cwd <目录>` | 当前目录 | Agent 子进程的工作目录 |
| `--login` | — | 强制重新扫码登录（替换已保存的 token） |
| `--daemon` | — | 后台运行（detached 子进程） |
| `--config <文件>` | — | JSON 配置文件路径 |
| `--instance <名称>` | — | 隔离实例（独立的存储、token、PID） |
| `--hide-thoughts` | `false` | 不将 Agent 思考过程转发到微信 |
| `--show-diffs` | `false` | 将 ACP 文件 diff 转发到微信 |
| `--inbox-dir <路径>` | `<存储>/inbox` | 接收的二进制文件保存位置 |
| `--no-inbox` | — | 不保存接收的文件（仅显示大小通知） |
| `--idle-timeout <分钟>` | `1440` | 会话空闲超时（0 = 无限） |
| `--max-sessions <数量>` | `10` | 最大并发用户会话数 |
| `--permission-timeout <秒>` | `300` | 审批超时自动处理的秒数 |
| `--permission-timeout-action` | `allow` | 超时行为：`allow`（允许）或 `deny`（拒绝） |
| `-v, --verbose` | — | 详细日志 |
| `-V, --version` | — | 输出版本号 |
| `-h, --help` | — | 显示帮助 |

### 子命令

| 命令 | 说明 |
|---------|------|
| `agents` | 列出内置 Agent 预设 |
| `inject --text <文本>` | 将本地消息加入 daemon 处理队列（基于文件队列） |
| `inject --file <文件>` | 从文件读取文本加入队列 |
| `inject --to <用户ID>` | 指定目标用户（默认：最近活跃用户） |
| `stop` | 向 daemon 发送 SIGTERM，清理 PID 文件 |
| `status` | 打印 daemon PID 或 "Not running" |

## 配置文件

创建 `~/.wechat-acp/config.json`（或通过 `--config` 指定路径）：

```jsonc
{
  // Agent 配置
  "agent": {
    "preset": "hermes",
    "cwd": "/home/user/project",
    "showDiffs": false,
    "showThoughts": false
  },

  // 权限审批（本 fork 扩展）
  "permission": {
    "timeoutSec": 300,
    "timeoutAction": "allow"
  },

  // 会话管理
  "session": {
    "idleTimeoutMs": 86400000,
    "maxConcurrentUsers": 10
  },

  // 命令别名（强烈建议配置）
  "commandAliases": {
    "/acp-cancel": ["/中断", "中断", "/终止", "终止", "/中止", "中止", "/stop", "/取消", "取消"],
    "/acp-prompt-start": ["/分段消息头", "分段消息头"],
    "/acp-prompt-done": ["/分段消息尾", "分段消息尾"]
  }
}
```

不指定 `--config` 时，别名不会加载——桥接器仅识别标准的 `/acp-*` 命令形式。

## 交互式权限审批

本 fork 新增了微信端的交互式危险命令审批功能。当 Hermes 准备执行危险命令（或编辑文件）时，桥接器会发送格式化消息到微信：

```
🔐 Hermes 需要权限: find -delete: find /tmp -name test -delete

[1] 允许一次
[2] 总是允许
[3] 拒绝
[4] 永不

回复数字选择，300秒后自动允许。
```

用户回复数字（`1`/`2`/`3`/`4`）或文字（`允许`、`/approve`、`/deny`、`拒绝`、`中止`）。回复在消息队列**之前**被拦截处理，防止死锁。

### 工作原理

1. Hermes 检测到危险模式 → 调用 `check_all_command_guards()`
2. ACP 适配器通过 `acp_adapter/permissions.py` 桥接到 `conn.request_permission()`
3. wechat-acp 的 `requestPermission()` 将格式化的审批消息发送到微信
4. 用户回复被 `handleMessage` 绕过队列拦截 → 解析待处理权限
5. Hermes 根据用户选择继续（或中止）

**Hermes 端代码未被修改。** 所有审批接口均为 Hermes 内置的 ACP 适配器功能（`server.py`、`permissions.py`、`edit_approval.py`）。本 fork 仅实现了 ACP `requestPermission` 协议的客户端侧。

### 编辑审批

文件修改（`write_file`、`patch`）同样触发审批。桥接器会展示：
- 文件路径
- 变更大小（旧→新字符数）
- 短内容预览（≤120 字符）

```
🔐 Hermes 需要权限: Approve edit: /tmp/hello.txt

📄 文件: /tmp/hello.txt
操作: 创建新文件
内容: Hello from edit approval test

[1] 允许一次
[2] 拒绝

回复数字选择，300秒后自动允许。
```

编辑审批仅有两个选项（`allow_once` / `deny`）。默认策略为 `"ask"`（总是询问）；可通过 ACP 会话配置更改（`/acp-config set edit_approval_policy accept_edits`）。

## 媒体支持（相对上游的补丁）

本 fork 包含从 `@tencent-weixin/openclaw-weixin` v2.4.4 移植的媒体模块：

| 模块 | 文件 | 功能 |
|--------|------|----------|
| CDN URL + 上传 | `src/weixin/cdn.ts` | AES-128-ECB 加密，CDN POST，重试（3 次） |
| 上传管线 | `src/weixin/upload.ts` | getUploadUrl → CDN → UploadedFileInfo |
| 发送（图片/视频/文件） | `src/weixin/send.ts` | sendImageMessage、sendVideoMessage、sendFileMessage |
| MIME 类型映射 | `src/weixin/mime.ts` | 30+ 扩展名 → MIME 类型 |
| 语音转码 | `src/media/silk.ts` | SILK → WAV（通过 silk-wasm） |

**从 Hermes 发送：** 使用 Python 桥接脚本（Python 无法直接调用 iLink——所有 Python HTTP 库的 TLS ClientHello 指纹检测导致 `ret=-2`）：

```bash
# 文字
python3 /tmp/wechat_send.py text "你好"

# 图片 / 视频 / 文件（根据扩展名自动识别）
python3 /tmp/wechat_send.py file /path/to/photo.jpg --text "标题"
python3 /tmp/wechat_send.py file /path/to/report.pdf
```

支持格式：PNG、JPG、GIF、WebP、BMP、MP4、MOV、WebM、MKV、AVI、PDF、DOC、DOCX、XLS、XLSX、PPT、PPTX、TXT、CSV、ZIP、TAR、GZ。

## Token 生命周期

系统中涉及四种不同的 token/状态，容易混淆：

| 类型 | 存储位置 | 生命周期 | 失效表现 | 修复方式 |
|------|-----------|----------|--------------|-----|
| **Bot Token** | `token.json` | 数天至数周 | 未知 | `--login` 重新扫码 |
| **Context Token** | `state.json` | 每次 daemon 重启失效 | `sendmessage` 静默返回 `ret=-2` | 用户发一条微信消息即可 |
| **Sync Buffer** | `sync-buf.json` | 重启后可能过时 | 轮询卡住，收不到消息 | 清空文件：`printf '' > ~/.wechat-acp/sync-buf.json` |
| **轮询会话** | 服务端 | daemon 长时间离线后 | `errcode=-14`（尚未实际观测到） | 暂停 1 小时后自动恢复 |

**核心结论：** daemon 重启后的消息丢失几乎都是 contextToken 或 sync-buf 问题，而非 bot token 过期。bot token 是长期有效的，极少需要重新扫码。

## 会话守卫（errcode -14）

当 iLink API 返回 `errcode=-14` 时，轮询循环会暂停 1 小时，然后使用相同 token 重试。这与 openclaw-weixin 的行为一致——`errcode=-14` 是一个**临时的轮询会话状态**问题，而非永久凭证过期。暂停后，同一个 bot token 即可恢复工作。

## openclaw-weixin 协议对齐（v2.4.4）

已于 2026-06-06 完成 31 处差异的逐文件审计。应用了 6 项核心修复：

| 优先级 | 修复项 | 说明 |
|----------|-----|------|
| P0 | AbortError + `get_updates_buf` | 长轮询超时时保留同步缓冲区（防止消息丢失） |
| P0 | `upload_full_url` / `full_url` | iLink 切换到完整 URL 模式时兼容 |
| P1 | `parseAesKey` 异常抛出 | 未知编码时抛出异常，而非静默截取 16 字节 |
| P1 | `bot_agent` + 生命周期 | BaseInfo 中添加 `bot_agent: "wechat-acp"`；`notifyStart`/`notifyStop` 端点 |
| P1 | `run_id` 追踪 | 消息上的推理链路关联字段 |
| P2 | contextToken 警告 | 缺少 contextToken 时 `console.warn` 代替 `throw`（优雅降级） |

剩余 17 处差异为 Agent 框架功能（会话守卫、配置缓存、markdown 过滤器、出站钩子等），纯传输桥接器不应承载。

## 桥命令

由桥接器处理的内置命令（不会转发给 Agent）：

| 命令 | 操作 |
|---------|--------|
| `/acp-cancel` | 取消当前对话轮次 |
| `/acp-cancel all` | 取消 + 丢弃已排队的消息 |
| `/acp-config` | 列出 ACP 会话配置选项 |
| `/acp-config set <键> <值>` | 修改配置（模型、模式等） |
| `/acp-prompt-start` | 开始多段消息缓冲 |
| `/acp-prompt-done` | 刷新缓冲 → 一次请求 |

可通过配置文件中的 `commandAliases` 设置自定义别名（见上文配置文件章节）。

## Inject 队列（定时任务/自动化）

无需经过微信轮询即可本地注入消息：

```bash
npx tsx bin/wechat-acp.ts inject --text "今日 AI 资讯"
npx tsx bin/wechat-acp.ts inject --file ./prompt.txt --to <微信用户ID>
```

daemon 将注入的消息视为收到的私信。队列基于文件系统，位于 `~/.wechat-acp/inject/`（`pending/` → `processing/` → `done/` 或 `failed/`）。

**Inject JSON 格式**（手动写入队列）：
```json
{
  "id": "唯一ID",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "target": "last-active-user",
  "text": "你的消息",
  "source": "cli"
}
```

## 存储布局

```
~/.wechat-acp/
├── token.json              # iLink 登录凭证
├── daemon.pid              # 运行中的 daemon PID
├── wechat-acp.log          # 运行日志（追加）
├── state.json              # 最近活跃用户 + contextToken
├── sync-buf.json           # iLink 轮询游标
├── config.json             # 桥配置
├── telemetry-id            # 匿名遥测标识
├── inbox/                  # 从微信收到的二进制文件
├── inject/                 # 本地消息注入队列
│   ├── pending/
│   ├── processing/
│   ├── done/
│   └── failed/
└── instances/<名称>/       # 隔离实例存储
```

## 开发

```bash
# 克隆
git clone https://github.com/YrracOwl/hermes-wechat-acp.git
cd hermes-wechat-acp

# 安装 + 编译
npm install
npm run build          # tsc（daemonize 前必须执行）

# 本地运行（通过 tsx 运行 TypeScript 源码）
npx tsx bin/wechat-acp.ts --agent hermes

# 生产环境守护进程
npx tsx bin/wechat-acp.ts --agent hermes --daemon --hide-thoughts --config ~/.wechat-acp/config.json --permission-timeout 300

# 监听模式（文件变更自动重编译）
npm run dev

# 状态查看 / 停止
npx tsx bin/wechat-acp.ts status
npx tsx bin/wechat-acp.ts stop
```

**开发流程：**
1. 编辑 `src/` 或 `bin/` 中的 `.ts` 文件
2. `npx tsc --noEmit && npx tsc`（类型检查 + 编译）
3. `git add -A && git commit`
4. 重启 daemon 以加载编译后的 JS

`--daemon` 前务必先编译——daemon 从 `dist/` 目录下的编译后 JS 启动子进程。

## 版本历史

```
53cd9ff docs: rewrite README (zh-CN default, en → README_EN.md)
172d41d chore: remove test scripts with hardcoded local IDs
c2f77c6 fix: revert misleading session-expired flag
7bbd292 feat: edit approval with diff display
cd8b8bf fix: #14 --daemon spawn compiled JS + #15 contextToken
2214ccc feat: interactive permission approval over WeChat
c0d0428 fix: P0-P2 openclaw-weixin v2.4.4 alignment
8889461 v0.8.0（上游）
```

基础：`formulahendry/wechat-acp` v0.8.0，叠加 7 个本地 commit，增加媒体支持、审批和协议对齐。

## 待办 / 已知限制

- [ ] 群聊支持（不在范围内——iLink 限制）
- [ ] 发送语音消息（iLink API 不支持 Bot 主动发语音）
- [ ] npm 包发布
- [ ] 审批 + 媒体管线的自动化测试
- [ ] daemon 重启后 `contextToken` 自动刷新（当前需用户先发一条消息）
- [ ] Python 直接调用 iLink（所有 Python HTTP 库均返回 `ret=-2`；绕过方案：Node.js 子进程）

## 许可证

MIT。基于 [wechat-acp](https://github.com/formulahendry/wechat-acp)（formulahendry）。媒体模块移植自 [@tencent-weixin/openclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin)。
