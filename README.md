# DSH 插件市场索引（自建）

给 DeepSeek Harness 的**自定义插件市场**用的索引文件（`format: 1`），配合已安装的
`@deepseek-ai/dsh-experimental-plugin-market-bundle`（插件页的「发现」标签页）使用。

- 生成/校验时间：2026-10-26
- 针对运行时：**DSH `0.2.1-rc.3`**（profile `desktop`）
- 收录：**27 个插件**（每个 1–3 个可装版本），单文件 **70.8 KiB**，图标全部内联
- 校验：已通过 DSH 自己的 `parseMarketIndex()`（`@deepseek-ai/dsh-plugin-market-index`）
- 兼容性：用 DSH 安装里的 `evaluatePluginCompatibility()` **原版代码**逐版本判定（不是手写规则）

## 公网地址（已托管）

仓库：<https://github.com/Mr-carp-86/dsh-plugin-market>（public）

**填进「插件 → 发现 → 添加索引源」的是这个 URL（推荐，走 jsDelivr，国内通常可直连）：**

```
https://cdn.jsdelivr.net/gh/Mr-carp-86/dsh-plugin-market@main/index.json
```

备用地址：

| 用途 | URL |
|---|---|
| GitHub raw | `https://raw.githubusercontent.com/Mr-carp-86/dsh-plugin-market/main/index.json` |
| jsDelivr（钉死到某个提交，永不因缓存变旧） | `https://cdn.jsdelivr.net/gh/Mr-carp-86/dsh-plugin-market@3e1c91a/index.json` |
| jsDelivr 强制刷新缓存 | `https://purge.jsdelivr.net/gh/Mr-carp-86/dsh-plugin-market@main/index.json` |

已验证（2026-10-26）：三个 URL 都返回 HTTP 200、`72487` 字节、27 个插件，且取回的 JSON 通过
`parseMarketIndex()` 校验。

> ⚠️ jsDelivr 对 `@main` 这类分支引用有缓存（最长约 12 小时）。改了 `index.json` 推上去后，
> 若「发现」页还是旧内容，先访问上面的 purge 链接强制刷新，或直接用钉死提交哈希的地址。

## 目录

- [公网地址（已托管）](#公网地址已托管)
- [文件说明](#文件说明)
- [马上试：本地预览](#马上试本地预览)
- [长期托管](#长期托管)
- [收录了什么](#收录了什么)
- [为什么有些包收不进来](#为什么有些包收不进来)
- [重新生成](#重新生成)
- [安全提醒与回退](#安全提醒与回退)

---

## 文件说明

| 文件 | 作用 |
|---|---|
| `index.json` | **索引本体**（format 1，单文件自包含：图标是内联 base64，不需要额外的 `icons/` 目录） |
| `generate-index.mjs` | 生成器：拉 npm 元数据 → 用 DSH 原版规则判定兼容性 → 取图标 → 自检 → 写出 `index.json` |
| `serve.mjs` | 本地临时预览服务器（只用于立刻在「发现」页试一下） |
| `README.md` | 本文件 |

## 马上试：本地预览

```powershell
cd "F:\资源\插件市场"
node serve.mjs            # 默认 http://127.0.0.1:8791/index.json
```

然后在 DSH 里：侧栏 **插件** → **发现** → **添加索引源** → 填

```
http://127.0.0.1:8791/index.json
```

要点：

- 索引 URL 必须是 `http:` / `https:`，**不能带用户名密码或 `#` 片段**。
- 市场侧用的是 Host 进程里的裸 `fetch(url, { redirect: 'error' })`，**没有私网地址拦截**，
  所以 `127.0.0.1` 能用；但如果 DSH 配了网络代理（官方「网络代理」文档），本地地址可能被代理拦掉。
- **这是临时方案**：`serve.mjs` 进程一关、或 DSH 重启，索引就没了（「发现」页读失败，删掉再重加索引源即可）。

## 长期托管

`index.json` 是单文件，扔到任意静态主机即可。硬性要求：

1. `http:` 或 `https:`（**优先 https**——`http:` 索引里列出的安装 spec 可被链路上任何人篡改）；
2. 返回 **2xx**，且**不经过重定向**（市场侧设了 `redirect: 'error'`）；
3. 响应体是 UTF-8 的 JSON（大小上限 128 MiB，这里只有 70.8 KiB）。

常见选择：

- **GitHub Pages**：把 `index.json` 放到仓库，开启 Pages，用 `https://<用户名>.github.io/<仓库>/index.json`。
- **jsDelivr（免自建 Pages）**：把文件推到公开 GitHub 仓库，用
  `https://cdn.jsdelivr.net/gh/<用户名>/<仓库>@<分支>/index.json`（国内访问通常比 GitHub 直连快）。
- **对象存储**：阿里云 OSS / 腾讯云 COS / 七牛，开静态网站或公共读，**注意绑自定义域名开 HTTPS**。
- **Cloudflare Pages / Netlify / Vercel** 之类的静态托管。

> 换 URL 后不需要重新生成索引；只有在 DSH 升级、或想换收录清单时才需要重跑生成器。

## 收录了什么

### 官方（官方目录里的「按需安装」组合包）

| 包 | 说明 | 版本 |
|---|---|---|
| `@deepseek-ai/dsh-subagent-codex` | 用 Codex 原生认证与设置，把一个任务委派给 Codex。**需要本机装好 Codex CLI 并已登录** | 0.2.1-rc.3 |
| `@deepseek-ai/dsh-subagent-claude-code` | 同上，委派给 Claude Code。**需要本机装好 Claude Code 并已登录** | 0.2.1-rc.3 |

这两条用的是 DSH 自带 `OFFICIAL_ON_DEMAND_CATALOG` 里的官方标题、描述和图标。

### 社区（界面与外观）

| 包 | 说明 | 版本 |
|---|---|---|
| `dsh-better-sidebar` | 文件树、编辑器、变更、任务、侧边对话合并成一列，每个会话独立 | 0.28.0 |
| `@linxin666/dsh-pet` | 注册表驱动的浮动宠物，随模型活动反应，可命名/抚摸/投喂 | 0.4.8 |
| `dsh-emoji` | 给 Agent 回复加语义化的小号内联 emoji | 0.3.6 |
| `dsh-claude-style` | 把 Web 界面换成 Claude Code Desktop 的视觉与交互 | 0.19.3 |
| `dsh-plugin-cards` | 设置页卡片 + 扩展对话消息节点 | 0.9.29 |
| `dsh-bigfish` | 可替换角色包的自适应桌面伙伴（体积较大） | 0.6.0 |

### 插件与技能管理

| 包 | 说明 | 版本 |
|---|---|---|
| `dsh-plugin-marketplace` | 在桌面/Web profile 里发现、安装、更新、卸载插件 | 0.5.6 |
| `@dsh-market/plugin` | 侧栏插件：浏览、搜索、猜你喜欢、一键安装、已装管理 | 0.4.16 |
| `dsh-skill-mcp-panel` | 从 Web 侧栏统一管理 skills 与 MCP 服务器 | 2.3.5 |
| `dsh-skills-nexus` | 把任意 git `SKILL.md` 仓库一键注册成 DSH 技能 | 0.7.0 |

### 效率工具

| 包 | 说明 | 版本 |
|---|---|---|
| `dsh-office-tools` | 让模型创建/读取/修改 docx、xlsx、pptx | 1.0.6 |
| `dsh-univer-office` | Univer 预览、悬浮工作表窗口、会话结束复盘动作（**体积很大**） | 0.3.7 |
| `@mlgbnb/dsh-archive-manager` | 在设置页预览、恢复、删除已归档会话 | 1.0.10 |
| `@linxin666/dsh-session-archive` | 集中清单、批量归档/恢复、物理删除、可选自动归档 | 0.4.8 |
| `dsh-watcher` | 只读的会话洞察与本地模型用量统计 | 0.8.0 |
| `@goodandready/dsh-time-machine` | 智能检查点、工作区安全守卫、一键回滚 | 0.1.31 |
| `@goodandready/dsh-cron` | 隔离 agent 运行 + 脚本/HTTP/SSH/Docker 运行时 + 成本守卫 | 0.3.20 |
| `dsh-custom-mode` | 编辑自定义模式的系统提示、基础模式与插件开关 | 2.2.5 |
| `dsh-thinking-levels` | 按工具轮次自动调整 reasoning_effort，可手动锁定 | 4.4.5 |

### 多智能体 / 记忆 / 集成 / 娱乐

| 包 | 说明 | 版本 | 分类 |
|---|---|---|---|
| `@michengai/dsh-agency-agents` | 331 名可召唤的专业智能体 | 1.2.14 | 多智能体 |
| `@heluojiang/dsh-agents-toml` | 在 `~/.dsh/agents` 与项目内用 TOML 声明命名子代理 | 0.4.1 | 多智能体 |
| `@openviking/dsh-memory-plugin` | OpenViking 记忆与上下文管理（火山引擎） | 0.5.29 | 记忆 |
| `@linxin666/dsh-ssh` | 主机配置存储、持久连接池、远程操作 | 0.4.8 | 集成 |
| `@exagone313/dsh-podman` | 用 Podman 容器执行命令与工具 | 1.7.0 | 集成 |
| `dsh-tavern` | 角色卡、世界书、预设、记忆与关系（**PolyForm 非商业许可**） | 2.7.20 | 娱乐 |

## 为什么有些包收不进来

**① 随 DSH 提供的可选组合包 —— 市场里没有安装按钮。**
市场的 `installationOf()` 逻辑：包随安装包提供（`available === 'installation'`）且尚未安装 → 状态是
`provided`，卡片显示「随 DSH 提供」，点击只是跳到「已安装」页。所以这 12 个**不能**通过市场装，
应当去 插件 → **实验性插件** → **更多** 里直接开开关：

`agent-team-profile`（Agent Teams）、`auto-review`（自动授权审查）、`inspector-profile`（会话检查器）、
`voice-input-bundle`（本地语音输入）、`cot-translation-bundle`（思考过程翻译）、
`badge-skill-bundle`（dsh 徽章技能）、`ralph-bundle`（重复性任务）、`session-titles-bundle`（标题刷新）、
`terminal-bundle`（常驻终端）、`session-search`（会话检索）、`tool-worktree`（Git worktree）、
`plugin-market-bundle`（插件市场本身，已启用）。

**② 与本版 DSH 不兼容（装不上）。** 生成器用 DSH 原版判定逐版本核过，以下包所有版本都不满足
`@deepseek-ai/dsh*` peer 要求，所以没有收录（在 0.2.1-rc.3 上装会直接被拒）：

| 包 | 不满足的要求 |
|---|---|
| `dsh-find-plugin` | `@deepseek-ai/dsh-tools` 只声明到 `^0.1.7-alpha.1` |
| `@feng0531/dsh-vcs` | `@deepseek-ai/dsh` 只接受 `0.1.7-rc.2 \|\| 0.2.0-rc.2` |
| `dsh-ssh-workspace` | `@deepseek-ai/dsh-host-webserver` 写死 `0.2.0-rc.2` |

**③ 刻意不收的。**

- `@deepseek-ai/dsh-experimental-schedule-bundle`：官方发布过、也能装，但本版 Web 组合里已经有
  `schedule` 行（内置日程），重复插入有冲突风险。
- `@deepseek-ai/dsh-headless` / `dsh-acp-app` / `dsh-sdk-app` / `dsh-sdk-minimal`：这些是**整套运行面**
  （headless / ACP / SDK），不是可叠加进桌面 profile 的功能组合包，装进来只会打架。
- `@deepseek-ai/dsh-experimental-voice-input-bundle` 等 12 个同上，属于「随 DSH 提供」。
- `@linxin666/dsh-web-all`：同一个作者的「全家桶聚合包」，一键装它会把 task-board、git-graph、pet、
  远程 Web UI、皮肤中心等一起拉进来，和上面单独收录的项会重叠，留给需要的人自己装。

## 重新生成

DSH 升级后（运行时版本变了），旧的索引可能列出装不上的版本，重跑一次即可：

```powershell
cd "F:\资源\插件市场"
node generate-index.mjs              # 写出 index.json
node generate-index.mjs --dry-run    # 只看结果，不写文件
```

生成器会：

1. 从 `%DSH_PROFILE_DIR%\node_modules\@deepseek-ai\dsh-app-boot\package.json` 读运行时版本；
2. 从同目录的 `lib/index.js` **原样抽出** `evaluatePluginCompatibility` 与 `OFFICIAL_ON_DEMAND_CATALOG`
   （不复制规则，避免和 DSH 实际判定不一致）；
3. 逐个拉 npm packument，剔掉「随 DSH 提供」的、判不兼容的、没有 `dsh.bundle` 的版本；
   有稳定版时只收稳定版（不收 alpha/rc/dev）；
4. 图标优先取包自带的（走 jsDelivr 单文件 CDN，不为一个图标下 19MB/226MB 的 tarball），
   没有就生成一个同色系原创图标，内联成 `data:` URL；
5. 用 `parseMarketIndex()` 校验，**不通过就不写文件**。

想改收录名单：编辑 `generate-index.mjs` 顶部的 `CURATED` 数组（分类见 `CATEGORIES`，
标签见 `LABELS`），`node generate-index.mjs` 重跑。

## 安全提醒与回退

- **市场是第三方内容。** 标题、描述、图标、安装源都由索引声明，DSH 只校验格式、不核实内容。
  本索引里的社区包只要被重新发布，装到自己机器上就会执行它们的代码——装之前看一眼
  「发现」页确认对话框里的来源（npm 包名 + 版本 / Git 仓库 + 提交）。
- **装完通常要重启 DSH**（组合包改了 profile 的 composition，返回会提示 `restart-required`）。
- **建议先备份 profile**：`C:\Users\dxzsd\.dsh\profiles\desktop\package.json` 与 `cordis.patch.yml`。
  某个插件把启动搞坏时，用 `plugin_manager` 的 `remove_bundle` 卸掉它，或把这两个文件还原到备份。
- 本索引按 DSH `0.2.1-rc.3` 生成；升级 DSH 后旧版本组合包可能被判不兼容，重新生成即可。
