# Hermes WeChat ACP

> WeChat message bridge for [Hermes Agent](https://github.com/nousresearch/hermes-agent) with full media support, interactive approval, and openclaw-weixin protocol alignment.

Fork of [wechat-acp v0.8.0](https://github.com/formulahendry/wechat-acp) maintained for the Hermes ecosystem. Connects WeChat 1:1 messages to Hermes (or any ACP agent) over stdio, with patches for media upload/download, voice transcription, and dangerous-command approval.

## What's Different From Upstream

| Feature | Upstream v0.8.0 | hermes-wechat-acp |
|---------|:---:|:---:|
| Text messaging | ✅ | ✅ |
| Image/Video/File **send** | ❌ | ✅ (CDN upload + AES encrypt) |
| Image/Video/File **receive** | Text only | ✅ (CDN decrypt + save) |
| Voice message **receive** (SILK→WAV) | ❌ | ✅ (silk-wasm transcode) |
| Interactive permission approval | Auto-approve only | ✅ (user replies to approve/deny) |
| Edit approval (file mutations) | ❌ | ✅ (diff preview in WeChat) |
| `errcode=-14` session guard | ❌ | ✅ (pause + retry, matches openclaw) |
| openclaw-weixin protocol alignment | Partial | ✅ (P0-P2, 6 fixes from v2.4.4) |
| `aes_key` encoding fix | ❌ (images show "expired") | ✅ |
| contextToken persistence fix | ❌ (ret=-2 after restart) | Documented + workaround |
| `--permission-timeout` / `--permission-timeout-action` | ❌ | ✅ |
| `--hide-thoughts` (agent thinking filter) | ✅ | ✅ (documented as required) |
| `--daemon` via `npx tsx` | Broken | ✅ (auto-detect + compile) |

## Quick Start

### Prerequisites

- **Node.js 20+**
- **Hermes Agent** installed (`hermes acp --check` must pass)
- A WeChat account that can use the iLink bot API
- Server can reach `https://ilinkai.weixin.qq.com` and `https://novac2c.cdn.weixin.qq.com`

### Install & Run

```bash
# Clone the fork
git clone https://github.com/YrracOwl/hermes-wechat-acp.git
cd hermes-wechat-acp

# Install and build
npm install
npm run build

# First run — QR login (scan with WeChat within 2 minutes)
npx tsx bin/wechat-acp.ts --agent hermes

# Production daemon (recommended)
npx tsx bin/wechat-acp.ts \
  --agent hermes \
  --daemon \
  --hide-thoughts \
  --config ~/.wechat-acp/config.json \
  --permission-timeout 300
```

On first run, the terminal displays a QR code. Scan it with WeChat. The login token is saved to `~/.wechat-acp/token.json` and reused automatically.

### Using via npm (remote install)

```bash
# (once published) npx -y hermes-wechat-acp@latest --agent hermes
```

Currently available via local clone + build only.

## CLI Reference

```
hermes-wechat-acp --agent <preset|command> [options]
hermes-wechat-acp agents          List built-in presets
hermes-wechat-acp inject --text <text>   Inject local message
hermes-wechat-acp stop            Stop running daemon
hermes-wechat-acp status          Check daemon status
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--agent <value>` | (required) | Agent preset (`hermes`, `claude`, `copilot`, ...) or raw command |
| `--cwd <dir>` | current dir | Working directory for agent subprocess |
| `--login` | — | Force QR re-login (replace saved token) |
| `--daemon` | — | Run in background (detached child process) |
| `--config <file>` | — | JSON config file path |
| `--instance <name>` | — | Isolated instance (separate storage, token, PID) |
| `--hide-thoughts` | `false` | Do NOT forward agent thinking to WeChat |
| `--show-diffs` | `false` | Forward ACP file diffs to WeChat |
| `--inbox-dir <path>` | `<storage>/inbox` | Where received binaries are saved |
| `--no-inbox` | — | Don't save received files (size notice only) |
| `--idle-timeout <min>` | `1440` | Session idle timeout (0 = unlimited) |
| `--max-sessions <n>` | `10` | Max concurrent user sessions |
| `--permission-timeout <sec>` | `300` | Seconds before auto-resolving approval |
| `--permission-timeout-action` | `allow` | Timeout behavior: `allow` or `deny` |
| `-v, --verbose` | — | Verbose logging |
| `-V, --version` | — | Print version |
| `-h, --help` | — | Show help |

### Subcommands

| Command | Description |
|---------|-------------|
| `agents` | List built-in agent presets |
| `inject --text <t>` | Enqueue local message for daemon (file-based queue) |
| `inject --file <f>` | Same, reading text from file |
| `inject --to <uid>` | Target specific user (default: last active) |
| `stop` | Send SIGTERM to daemon, clean up PID file |
| `status` | Print daemon PID or "Not running" |

## Configuration File

Create `~/.wechat-acp/config.json` (or any path passed via `--config`):

```jsonc
{
  // Agent configuration
  "agent": {
    "preset": "hermes",
    "cwd": "/home/user/project",
    "showDiffs": false,
    "showThoughts": false
  },

  // Permission approval (our extension)
  "permission": {
    "timeoutSec": 300,
    "timeoutAction": "allow"
  },

  // Session management
  "session": {
    "idleTimeoutMs": 86400000,
    "maxConcurrentUsers": 10
  },

  // Command aliases (strongly recommended)
  "commandAliases": {
    "/acp-cancel": ["/中断", "中断", "/终止", "终止", "/中止", "中止", "/stop", "/取消", "取消"],
    "/acp-prompt-start": ["/分段消息头", "分段消息头"],
    "/acp-prompt-done": ["/分段消息尾", "分段消息尾"]
  }
}
```

Without `--config`, aliases are NOT loaded — the bridge only recognizes canonical `/acp-*` forms.

## Interactive Permission Approval

This fork adds interactive dangerous-command approval over WeChat. When Hermes wants to run a dangerous command (or edit a file), the bridge sends a formatted message to WeChat:

```
🔐 Hermes 需要权限: find -delete: find /tmp -name test -delete

[1] 允许一次
[2] 总是允许
[3] 拒绝
[4] 永不

回复数字选择，300秒后自动允许。
```

The user replies with a number (`1`/`2`/`3`/`4`) or text (`允许`, `/approve`, `/deny`, `拒绝`, `中止`). The reply is intercepted **before** the message queue to prevent deadlock.

### How it works

1. Hermes detects a dangerous pattern → calls `check_all_command_guards()`
2. ACP adapter bridges to `conn.request_permission()` via `acp_adapter/permissions.py`
3. wechat-acp's `requestPermission()` sends the formatted prompt to WeChat
4. User reply is intercepted by `handleMessage` bypass → resolves the pending permission
5. Hermes proceeds (or aborts) based on the user's choice

**Hermes-side code is NOT modified.** All approval interfaces are Hermes built-in ACP adapter features (`server.py`, `permissions.py`, `edit_approval.py`). This fork only implements the client side of the ACP `requestPermission` contract.

### Edit approval

File mutations (`write_file`, `patch`) also trigger approval. The bridge shows:
- File path
- Change size (old → new character count)
- Short preview (for content ≤120 chars)

```
🔐 Hermes 需要权限: Approve edit: /tmp/hello.txt

📄 文件: /tmp/hello.txt
操作: 创建新文件
内容: Hello from edit approval test

[1] 允许一次
[2] 拒绝

回复数字选择，300秒后自动允许。
```

Edit approval has only 2 options (`allow_once` / `deny`). Default policy is `"ask"` (always prompts); can be changed via ACP session config (`/acp-config set edit_approval_policy accept_edits`).

## Media Support (Patched vs Upstream)

This fork includes media modules ported from `@tencent-weixin/openclaw-weixin` v2.4.4:

| Module | File | Function |
|--------|------|----------|
| CDN URL + Upload | `src/weixin/cdn.ts` | AES-128-ECB encrypt, CDN POST, retry (3×) |
| Upload pipeline | `src/weixin/upload.ts` | getUploadUrl → CDN → UploadedFileInfo |
| Send (images/video/files) | `src/weixin/send.ts` | sendImageMessage, sendVideoMessage, sendFileMessage |
| MIME type map | `src/weixin/mime.ts` | 30+ extensions → MIME types |
| Voice transcode | `src/media/silk.ts` | SILK → WAV via silk-wasm |

**Sending from Hermes:** Use the Python bridge script (Python can't call iLink directly — TLS ClientHello fingerprinting causes `ret=-2` for all Python HTTP libraries):

```bash
# Text
python3 /tmp/wechat_send.py text "Hello"

# Image / Video / File (auto-detected by extension)
python3 /tmp/wechat_send.py file /path/to/photo.jpg --text "caption"
python3 /tmp/wechat_send.py file /path/to/report.pdf
```

Supported formats: PNG, JPG, GIF, WebP, BMP, MP4, MOV, WebM, MKV, AVI, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, ZIP, TAR, GZ.

## Token Lifecycle

Four distinct token/state types in the system — easy to confuse:

| Type | Stored in | Lifetime | Failure mode | Fix |
|------|-----------|----------|--------------|-----|
| **Bot Token** | `token.json` | Days–weeks | Unknown | `--login` re-scan QR |
| **Context Token** | `state.json` | Per daemon restart | `sendmessage` returns `ret=-2` silently | User sends any WeChat message |
| **Sync Buffer** | `sync-buf.json` | Can stale after restart | Polling hangs, no messages | Clear file: `printf '' > ~/.wechat-acp/sync-buf.json` |
| **Polling Session** | Server-side | After long daemon downtime | `errcode=-14` (not yet observed) | Auto-recovers after 1h pause |

**Key takeaway:** Message loss after daemon restart is almost always contextToken or sync-buf, NOT bot token expiry. Bot token is long-lived; re-scanning QR is rarely needed.

## Session Guard (errcode -14)

When the iLink API returns `errcode=-14`, the polling loop pauses for 1 hour before retrying with the same token. This matches openclaw-weixin's behavior — `errcode=-14` is a **temporary polling-session state** issue, not permanent credential expiry. After the pause, the same bot token resumes working.

## openclaw-weixin Protocol Alignment (v2.4.4)

31-difference file-by-file audit completed (2026-06-06). 6 core fixes applied:

| Priority | Fix | Description |
|----------|-----|-------------|
| P0 | AbortError + `get_updates_buf` | Preserve sync buffer on long-poll timeout (prevents message loss) |
| P0 | `upload_full_url` / `full_url` | Support full-URL mode if iLink switches |
| P1 | `parseAesKey` throw | Throw on unknown encoding instead of silent 16-byte slice |
| P1 | `bot_agent` + lifecycle | `bot_agent: "wechat-acp"` in BaseInfo; `notifyStart`/`notifyStop` endpoints |
| P1 | `run_id` tracking | Inference trace correlation field on messages |
| P2 | contextToken warn | `console.warn` instead of `throw` on missing contextToken (graceful degradation) |

17 remaining diffs are Agent-framework features (session guard, config cache, markdown filter, outbound hooks, etc.) that a pure transport bridge should NOT carry.

## Bridge Commands

Built-in commands handled by the bridge (NOT forwarded to agent):

| Command | Action |
|---------|--------|
| `/acp-cancel` | Cancel current turn |
| `/acp-cancel all` | Cancel + drop queued messages |
| `/acp-config` | List ACP session config options |
| `/acp-config set <k> <v>` | Change config (model, mode, etc.) |
| `/acp-prompt-start` | Begin multi-part buffering |
| `/acp-prompt-done` | Flush buffer → one request |

Custom aliases via `commandAliases` in config (see Configuration File above).

## Inject Queue (Cron / Automation)

Inject messages locally without going through WeChat polling:

```bash
npx tsx bin/wechat-acp.ts inject --text "今日 AI 资讯"
npx tsx bin/wechat-acp.ts inject --file ./prompt.txt --to <wechat-user-id>
```

The daemon treats injected messages as incoming DMs. Queue is file-based under `~/.wechat-acp/inject/` (`pending/` → `processing/` → `done/` or `failed/`).

**Inject JSON format** (for manual queue writing):
```json
{
  "id": "unique_id",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "target": "last-active-user",
  "text": "your message",
  "source": "cli"
}
```

## Storage Layout

```
~/.wechat-acp/
├── token.json              # iLink login credential
├── daemon.pid              # Running daemon PID
├── wechat-acp.log          # Runtime log (appends)
├── state.json              # Last active user + contextToken
├── sync-buf.json           # iLink polling cursor
├── config.json             # Bridge configuration
├── telemetry-id            # Anonymous telemetry salt
├── inbox/                  # Received binary files from WeChat
├── inject/                 # Local message injection queue
│   ├── pending/
│   ├── processing/
│   ├── done/
│   └── failed/
└── instances/<name>/       # Isolated instance storage
```

## Development

```bash
# Clone
git clone https://github.com/YrracOwl/hermes-wechat-acp.git
cd hermes-wechat-acp

# Install + Build
npm install
npm run build          # tsc (required before daemonize)

# Run locally (TypeScript source via tsx)
npx tsx bin/wechat-acp.ts --agent hermes

# Production daemon
npx tsx bin/wechat-acp.ts --agent hermes --daemon --hide-thoughts --config ~/.wechat-acp/config.json --permission-timeout 300

# Watch mode (auto-rebuild on changes)
npm run dev

# Status / Stop
npx tsx bin/wechat-acp.ts status
npx tsx bin/wechat-acp.ts stop
```

**Development workflow:**
1. Edit `.ts` files in `src/` or `bin/`
2. `npx tsc --noEmit && npx tsc` (type-check + compile)
3. `git add -A && git commit`
4. Restart daemon to pick up compiled JS

Always compile before `--daemon` — the daemon spawns child processes from compiled JS at `dist/`.

## Version History

```
172d41d chore: remove test scripts with hardcoded local IDs
c2f77c6 fix: revert misleading session-expired flag
7bbd292 feat: edit approval with diff display
cd8b8bf fix: #14 --daemon spawn compiled JS + #15 contextToken
2214ccc feat: interactive permission approval over WeChat
c0d0428 fix: P0-P2 openclaw-weixin v2.4.4 alignment
8889461 v0.8.0 (upstream)
```

Base: `formulahendry/wechat-acp` v0.8.0 with 6 local commits adding media support, approval, and protocol alignment.

## TODO / Known Limitations

- [ ] Group chat support (not in scope — iLink limitations)
- [ ] Outbound voice message sending (iLink API does not support bot-initiated voice)
- [ ] npm package publication
- [ ] Automated tests for approval + media pipelines
- [ ] `contextToken` auto-refresh on daemon restart (currently requires user to send a message first)
- [ ] Python iLink direct calls (all Python HTTP libs return `ret=-2`; workaround: Node.js subprocess)

## License

MIT. Based on [wechat-acp](https://github.com/formulahendry/wechat-acp) by formulahendry. Media modules adapted from [@tencent-weixin/openclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin).
