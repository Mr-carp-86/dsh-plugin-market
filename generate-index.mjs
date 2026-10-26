#!/usr/bin/env node
/**
 * 生成 DSH「插件市场」索引文件（format 1）。
 *
 * 设计要点（都是踩过/核对过的）：
 *  1. 兼容性判定直接用 DSH 安装里的**原版代码**（从 @deepseek-ai/dsh-app-boot 的 lib/index.js
 *     里原样抽出 `plugin-compatibility` 区域，在临时模块里执行），不自己重写，避免判定漂移。
 *     判定规则：包自己有 engines.dsh 就只看它；否则每个 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*`
 *     peer 都必须匹配运行时版本（预发布参与范围，等价 semver.satisfies(..., {includePrerelease:true})）。
 *  2. 「随 DSH 提供的组合包」在插件市场里显示为「随 DSH 提供」，没有安装按钮
 *     （dsh-plugin-market 的 installationOf(): available==='installation' && !installed → provided）。
 *     所以本索引只收**本版 DSH 不带**的包；官方两个按需组合包取自 DSH 自带的
 *     OFFICIAL_ON_DEMAND_CATALOG（标题/描述/图标都是官方的）。
 *  3. 图标内联为 base64 data URL（≤32 KiB），索引因此是**单文件自包含**的，托管最省事。
 *     优先用包自带图标（经 jsDelivr 单文件 CDN，避免为拿图标下载 19MB/226MB 的 tarball），
 *     取不到就生成一个原创的同色系图标。
 *  4. 生成后用 DSH 自己的 parseMarketIndex 校验；不通过就不写文件。
 *
 * 用法：
 *   node generate-index.mjs              # 用当前 DSH profile 的运行时版本生成
 *   node generate-index.mjs --dry-run    # 只打印结果，不写 index.json
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(HERE, 'index.json')
const DRY_RUN = process.argv.includes('--dry-run')

const PROFILE = process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
const MODULES = path.join(PROFILE, 'node_modules')
const APP_BOOT_LIB = path.join(MODULES, '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')
const MARKET_INDEX_LIB = path.join(MODULES, '@deepseek-ai', 'dsh-plugin-market-index', 'lib', 'index.js')
const SEMVER_LIB = path.join(MODULES, 'semver', 'index.js')
const REGISTRY = 'https://registry.npmjs.org'
const CDN = 'https://cdn.jsdelivr.net/npm'

/** 每个插件最多收录几个兼容版本（降序，第一个即市场推荐版本）。 */
const MAX_VERSIONS = 3
/** 单次索引抓取的并发数。 */
const CONCURRENCY = 4
/** 内联图标上限，与 parseMarketIndex 的 MAX_INLINE_ICON_BYTES 一致。 */
const MAX_ICON_BYTES = 32 * 1024

// ---------------------------------------------------------------------------
// 精选清单：name + 分类 + 标签 + 中英文标题/简介
// 只放**本版 DSH 不带**、且兼容性预筛通过的组合包（脚本会再核一次，不通过就剔除并报告）。
// ---------------------------------------------------------------------------
const CATEGORIES = {
  official: { en: 'Official subagents', zh: '官方子代理' },
  ui: { en: 'Interface & appearance', zh: '界面与外观' },
  market: { en: 'Plugins & skills management', zh: '插件与技能管理' },
  productivity: { en: 'Productivity', zh: '效率工具' },
  agents: { en: 'Multi-agent', zh: '多智能体' },
  memory: { en: 'Memory & context', zh: '记忆与上下文' },
  integration: { en: 'Integrations & runtime', zh: '集成与运行环境' },
  fun: { en: 'Fun', zh: '娱乐' },
}

const LABELS = {
  official: { en: 'Official', zh: '官方' },
  community: { en: 'Community', zh: '社区' },
  heavy: { en: 'Large download', zh: '体积较大' },
}

const CURATED = [
  {
    name: '@deepseek-ai/dsh-subagent-codex',
    category: 'official',
    labels: ['official'],
    zh: { title: 'Codex 子智能体', description: '用 Codex 原生认证与设置，把一个任务委派给 Codex。' },
    en: { title: 'Codex subagent', description: 'Delegate one task to Codex using its native authentication and settings.' },
  },
  {
    name: '@deepseek-ai/dsh-subagent-claude-code',
    category: 'official',
    labels: ['official'],
    zh: { title: 'Claude Code 子智能体', description: '用 Claude Code 原生认证与设置，把一个任务委派给 Claude Code。' },
    en: { title: 'Claude Code subagent', description: 'Delegate one task to Claude Code using its native authentication and settings.' },
  },
  {
    name: 'dsh-better-sidebar',
    category: 'ui',
    labels: ['community'],
    zh: { title: '增强侧栏', description: '把文件树、编辑器、变更、任务和侧边对话合并成一列，每个会话各自独立。' },
    en: { title: 'Better Sidebar', description: 'File tree, editor, changes, tasks and side chat in one column, separate for every conversation.' },
  },
  {
    name: '@linxin666/dsh-pet',
    category: 'ui',
    labels: ['community'],
    zh: { title: '桌面宠物', description: '注册表驱动的浮动宠物，会随模型活动反应，可命名、抚摸、投喂。' },
    en: { title: 'Desktop pet', description: 'A registry-driven floating pet that reacts to model activity, with naming, petting and feeding.' },
  },
  {
    name: 'dsh-emoji',
    category: 'ui',
    labels: ['community'],
    zh: { title: '内联表情', description: '给 Agent 回复加上语义化的小号内联 emoji。' },
    en: { title: 'Inline emoji', description: 'Tiny semantic inline emoji for DSH Agent responses.' },
  },
  {
    name: 'dsh-claude-style',
    category: 'ui',
    labels: ['community'],
    zh: { title: 'Claude Code 风格主题', description: '把 DSH Web 界面换成 Claude Code Desktop 的视觉与交互。' },
    en: { title: 'Claude Code style theme', description: 'Claude Code Desktop theme for the DSH web GUI: visual and interaction overhaul.' },
  },
  {
    name: 'dsh-plugin-cards',
    category: 'ui',
    labels: ['community'],
    zh: { title: '设置卡片与对话节点', description: '在设置页加卡片，并扩展对话消息节点。' },
    en: { title: 'Settings cards & chat nodes', description: 'Settings cards plus extra chat message nodes for DSH.' },
  },
  {
    name: 'dsh-bigfish',
    category: 'ui',
    labels: ['community', 'heavy'],
    zh: { title: '大鱼伙伴', description: '带可替换、可扩展角色包的自适应桌面伙伴（体积较大）。' },
    en: { title: 'BigFish companion', description: 'Adaptive DSH companion with replaceable, extensible character packs.' },
  },
  {
    name: 'dsh-plugin-marketplace',
    category: 'market',
    labels: ['community'],
    zh: { title: '插件市场（社区版）', description: '在桌面/Web profile 里发现、安装、更新、卸载插件。' },
    en: { title: 'Plugin marketplace', description: 'Discover, install, update and uninstall plugins in the active DSH Desktop or Web profile.' },
  },
  {
    name: '@dsh-market/plugin',
    category: 'market',
    labels: ['community'],
    zh: { title: 'DSH Market', description: '侧栏插件：浏览、搜索、猜你喜欢、一键安装、已装管理。' },
    en: { title: 'DSH Market', description: 'Sidebar plugin for browsing, searching and one-click installing DSH plugins.' },
  },
  {
    name: 'dsh-skill-mcp-panel',
    category: 'market',
    labels: ['community'],
    zh: { title: '技能与 MCP 面板', description: '从 Web 侧栏统一管理 skills 与 MCP 服务器，附带 dsh-panel CLI。' },
    en: { title: 'Skill & MCP panel', description: 'Manage skills and MCP servers from the DSH web sidebar plus the unified dsh-panel CLI.' },
  },
  {
    name: 'dsh-skills-nexus',
    category: 'market',
    labels: ['community'],
    zh: { title: '技能聚合器', description: '把任意 git SKILL.md 仓库一键注册成 DSH 技能（CLI 或 Web 面板）。' },
    en: { title: 'Skills Nexus', description: 'Register any git SKILL.md repo as a DSH skill from the CLI or the web panel.' },
  },
  {
    name: 'dsh-office-tools',
    category: 'productivity',
    labels: ['community'],
    zh: { title: 'Office 工具', description: '让模型直接创建、读取、修改 Word / Excel / PowerPoint 文件。' },
    en: { title: 'Office tools', description: 'Model-facing tools to create, read and update .docx, .xlsx and .pptx files.' },
  },
  {
    name: 'dsh-univer-office',
    category: 'productivity',
    labels: ['community', 'heavy'],
    zh: { title: 'Univer 表格协作', description: 'Univer 预览、悬浮工作表窗口与会话结束复盘动作（体积很大）。' },
    en: { title: 'Univer office', description: 'Univer integration with inline previews, floating worktree windows and session-end review actions.' },
  },
  {
    name: '@mlgbnb/dsh-archive-manager',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '归档会话管理', description: '在设置页预览、恢复、删除已归档会话。' },
    en: { title: 'Archive manager', description: 'Preview, restore and delete archived sessions from the settings page.' },
  },
  {
    name: '@linxin666/dsh-session-archive',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '会话归档', description: '集中清单、批量归档/恢复、物理删除（含家族级联）与可选自动归档。' },
    en: { title: 'Session archive', description: 'Centralized inventory, batch archive/restore, physical delete and optional auto-archive.' },
  },
  {
    name: 'dsh-watcher',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '会话洞察', description: '只读的会话洞察与本地模型用量统计。' },
    en: { title: 'Session insights', description: 'Read-only DSH session insights and local model usage statistics.' },
  },
  {
    name: '@goodandready/dsh-time-machine',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '时光机', description: '智能检查点、工作区安全守卫与一键回滚。' },
    en: { title: 'Time machine', description: 'Smart checkpoints, workspace safety guards and instant rollback.' },
  },
  {
    name: '@goodandready/dsh-cron',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '后台定时任务', description: '隔离的 agent 运行、脚本/HTTP/SSH/Docker 运行时、成本守卫与通知。' },
    en: { title: 'Background cron', description: 'Isolated agent runs with script/HTTP/SSH/Docker runtimes, cost guard and notifications.' },
  },
  {
    name: 'dsh-custom-mode',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '自定义模式', description: '编辑自定义模式的系统提示、基础模式与插件开关。' },
    en: { title: 'Custom mode', description: 'Edit a custom mode: system prompt, base mode and plugin switches.' },
  },
  {
    name: 'dsh-thinking-levels',
    category: 'productivity',
    labels: ['community'],
    zh: { title: '思考等级控制', description: '按工具轮次自动调整 reasoning_effort，可手动锁定并记录耗时。' },
    en: { title: 'Thinking levels', description: 'Auto-adjust reasoning_effort per tool round, with optional manual lock and timing telemetry.' },
  },
  {
    name: '@michengai/dsh-agency-agents',
    category: 'agents',
    labels: ['community'],
    zh: { title: 'Agency 智能体库', description: '331 名可召唤的专业智能体。' },
    en: { title: 'Agency agents', description: '331 summonable domain experts for DeepSeek Harness.' },
  },
  {
    name: '@heluojiang/dsh-agents-toml',
    category: 'agents',
    labels: ['community'],
    zh: { title: 'TOML 子代理', description: '在 ~/.dsh/agents 与项目内用 TOML 声明命名子代理。' },
    en: { title: 'TOML subagents', description: 'Declare named subagents in TOML files under ~/.dsh/agents and the project root.' },
  },
  {
    name: '@openviking/dsh-memory-plugin',
    category: 'memory',
    labels: ['community'],
    zh: { title: 'OpenViking 记忆', description: '为 DSH 提供记忆与上下文管理（火山引擎 OpenViking）。' },
    en: { title: 'OpenViking memory', description: 'OpenViking memory and context bundle for DeepSeek Harness.' },
  },
  {
    name: '@linxin666/dsh-ssh',
    category: 'integration',
    labels: ['community'],
    zh: { title: '远程 SSH', description: '主机配置存储（可从 ~/.ssh/config 导入）、持久连接池与远程操作。' },
    en: { title: 'Remote SSH', description: 'Host config store, persistent ssh2 connection pool and remote operations for the web GUI.' },
  },
  {
    name: '@exagone313/dsh-podman',
    category: 'integration',
    labels: ['community'],
    zh: { title: 'Podman 执行环境', description: '用 Podman 容器执行 DSH 的命令与工具。' },
    en: { title: 'Podman runtime', description: 'Podman-backed execution for DeepSeek Harness.' },
  },
  {
    name: 'dsh-tavern',
    category: 'fun',
    labels: ['community'],
    zh: { title: '酒馆（角色扮演）', description: '角色卡、世界书、预设、记忆与关系（PolyForm 非商业许可）。' },
    en: { title: 'Tavern roleplay', description: 'Character cards, worldbooks, presets, memory and relations (PolyForm noncommercial license).' },
  },
]

// ---------------------------------------------------------------------------
// 从 DSH 安装里原样读取运行时版本与官方判定代码
// ---------------------------------------------------------------------------
function fail(message) {
  console.error(`\n[失败] ${message}\n`)
  process.exit(1)
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined
}

function extractRegion(source, marker) {
  const start = source.indexOf(marker)
  if (start < 0) fail(`在 DSH 的 dsh-app-boot/lib/index.js 里找不到区域 ${marker}（DSH 版本可能已变化）`)
  const end = source.indexOf('//#endregion', start)
  if (end < 0) fail(`区域 ${marker} 没有结束标记（DSH 版本可能已变化）`)
  return source.slice(start, end)
}

const appBootSource = readIfExists(APP_BOOT_LIB)
if (appBootSource === undefined) fail(`找不到 DSH 运行时包：${APP_BOOT_LIB}\n请在 DSH 的 shell 里运行（需要 DSH_PROFILE_DIR），或用 --profile 指定的那套安装。`)

const runtimeVersion = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(APP_BOOT_LIB)), 'package.json'), 'utf8')).version
const semver = (await import(pathToFileURL(SEMVER_LIB).href)).default

/** 原样执行的兼容性判定（与 DSH 安装/市场判定同一份代码）。 */
async function loadCompatibility() {
  const tmpFile = path.join(os.tmpdir(), `dsh-compat-${process.pid}.mjs`)
  fs.writeFileSync(
    tmpFile,
    [
      `import fs from 'node:fs';`,
      `import { fileURLToPath } from 'node:url';`,
      `import semver from ${JSON.stringify(pathToFileURL(SEMVER_LIB).href)};`,
      extractRegion(appBootSource, '//#region lib/types/plugin-compatibility.js'),
      `export { evaluatePluginCompatibility };`,
    ].join('\n'),
    'utf8',
  )
  try {
    const mod = await import(pathToFileURL(tmpFile).href)
    return mod.evaluatePluginCompatibility
  } finally {
    fs.rmSync(tmpFile, { force: true })
  }
}

/** DSH 自带的官方按需组合包目录（标题/描述/图标）。 */
function loadOfficialCatalog() {
  try {
    const region = extractRegion(appBootSource, '//#region lib/types/official-bundles.generated.js')
    const evaluate = new Function(`${region}\n;return OFFICIAL_ON_DEMAND_CATALOG`)
    return new Map(evaluate().map((entry) => [entry.packageName, entry.meta]))
  } catch {
    return new Map()
  }
}

/**
 * 本版 DSH 自带（随安装提供）的组合包名：它们在插件市场里显示为「随 DSH 提供」，
 * 卡片没有安装按钮，收进索引只能看不能装，所以必须剔除。
 */
function loadShippedBundleNames() {
  const names = new Set([
    '@deepseek-ai/dsh-base',
    '@deepseek-ai/dsh-web-app',
    '@deepseek-ai/dsh-headless',
    '@deepseek-ai/dsh-acp-app',
    '@deepseek-ai/dsh-sdk-app',
    '@deepseek-ai/dsh-sdk-minimal',
  ])
  const match = appBootSource.match(/const OPTIONAL_BUNDLES = (\[[\s\S]*?\]);/)
  if (match !== null) {
    try {
      for (const name of new Function(`return ${match[1]}`)()) names.add(name)
    } catch {
      /* 提取失败就只用上面的固定名单 */
    }
  }
  return names
}

const evaluatePluginCompatibility = await loadCompatibility()
const officialCatalog = loadOfficialCatalog()
const shippedBundles = loadShippedBundleNames()
const marketIndex = await import(pathToFileURL(MARKET_INDEX_LIB).href).catch(() =>
  fail(`找不到索引校验器：${MARKET_INDEX_LIB}\n（它由插件市场组合包提供；先装好插件市场再生成索引）`),
)

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
const scopedName = (name) => name.replace('/', '%2f')

async function fetchJson(url, timeoutMs = 30_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`)
  return response.json()
}

async function fetchBytes(url, timeoutMs = 20_000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return { bytes: Buffer.from(await response.arrayBuffer()), type: response.headers.get('content-type') ?? '' }
}

const stripFragment = (url) => url.split('#')[0]

function normaliseRepository(repository) {
  if (repository === undefined) return undefined
  const raw = typeof repository === 'string' ? repository : repository.url
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  let url = raw.trim().replace(/^git\+/, '').replace(/\.git(#.*)?$/, '')
  if (!/^https?:\/\//i.test(url)) return undefined
  url = stripFragment(url)
  url = url.replace(/[?#].*$/, '')
  if (url === '') return undefined
  const directory =
    repository.directory ??
    (typeof raw === 'string' && raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : undefined)
  return directory === undefined || directory === '' ? { url } : { url, directory }
}

function normaliseHomepage(homepage) {
  if (typeof homepage !== 'string' || homepage.trim() === '') return undefined
  const url = stripFragment(homepage.trim())
  return /^https?:\/\//i.test(url) ? url : undefined
}

function parseTimestamp(packument, version) {
  const raw = packument.time?.[version]
  const ms = raw === undefined ? Number.NaN : Date.parse(raw)
  if (!Number.isFinite(ms)) throw new Error(`缺少 ${version} 的发布时间`)
  return Math.floor(ms / 1000)
}

function hashName(name) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) % 360
  return hash
}

function escapeXml(text) {
  return text.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c])
}

/** 包里没有可用图标时，生成一个同色系的原创图标（内联，≤32 KiB）。 */
function generatedIcon(name) {
  const hue = hashName(name)
  const base = name.split('/').pop() ?? name
  const letters = base
    .replace(/^dsh[-_]?/i, '')
    .split(/[-_.]/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || base.slice(0, 1).toUpperCase()
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" role="img" aria-label="${escapeXml(base)}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue} 72% 62%)"/><stop offset="1" stop-color="hsl(${(hue + 42) % 360} 68% 44%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="36" height="36" rx="9" fill="url(#g)"/>` +
    `<text x="18" y="23.5" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#ffffff">${escapeXml(letters)}</text>` +
    `</svg>`
  return toDataUrl(Buffer.from(svg, 'utf8'), 'image/svg+xml')
}

function toDataUrl(bytes, mime) {
  return `data:${mime};base64,${bytes.toString('base64')}`
}

function sniffImageMime(bytes, declared) {
  if (bytes.subarray(0, 4).toString('latin1') === '\x89PNG') return 'image/png'
  if (bytes.subarray(0, 2).toString('latin1') === '\xff\xd8') return 'image/jpeg'
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  const head = bytes.subarray(0, 200).toString('utf8').trimStart().toLowerCase()
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'image/svg+xml'
  return undefined
}

/** 取插件图标：官方目录 > 包自带（jsDelivr 单文件） > 生成。返回 { icon, source }。 */
async function resolveIcon(name, meta) {
  const official = officialCatalog.get(name)
  if (typeof official?.icon === 'string' && official.icon.startsWith('data:')) {
    return { icon: official.icon, source: 'DSH 官方目录' }
  }
  const declared = typeof meta.icon === 'string' ? meta.icon.replace(/^\.\//, '') : undefined
  if (declared !== undefined && !declared.startsWith('data:') && !/^https?:/i.test(declared)) {
    // jsDelivr 偶发瞬时失败，重试几次；真 404 时不空转太久
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const url = `${CDN}/${name}@${meta.version}/${declared}`
        const { bytes } = await fetchBytes(url)
        const mime = sniffImageMime(bytes, undefined)
        if (mime !== undefined && bytes.length <= MAX_ICON_BYTES) return { icon: toDataUrl(bytes, mime), source: `jsDelivr ${declared}` }
        break
      } catch {
        if (attempt === 3) break
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
      }
    }
  }
  return { icon: generatedIcon(name), source: '生成图标' }
}

// ---------------------------------------------------------------------------
// 处理一个精选条目
// ---------------------------------------------------------------------------
async function buildPlugin(entry) {
  if (shippedBundles.has(entry.name)) {
    return { skip: `${entry.name}: 随 DSH 提供，市场里显示「随 DSH 提供」没有安装按钮（应在 插件 → 实验性插件 里打开开关）` }
  }
  const packument = await fetchJson(`${REGISTRY}/${scopedName(entry.name)}`)
  const bundleVersions = Object.keys(packument.versions ?? {})
    .filter((version) => packument.versions[version]?.dsh?.bundle !== undefined)
    .sort((a, b) => semver.rcompare(a, b))

  if (bundleVersions.length === 0) return { skip: `${entry.name}: npm 上没有任何版本声明 dsh.bundle` }

  const compatible = []
  const rejected = []
  for (const version of bundleVersions.slice(0, 30)) {
    const manifest = packument.versions[version]
    const issue = evaluatePluginCompatibility(manifest, {}, runtimeVersion)
    if (issue !== undefined) {
      if (rejected.length < 3) rejected.push(`${version} ⇐ 缺 ${Object.keys(issue.requirements).join(', ')}`)
      continue
    }
    compatible.push({ version, manifest })
  }
  // 有稳定版就只收稳定版：dev / alpha / rc 版本给普通用户装上去风险太大
  const stable = compatible.filter((candidate) => semver.prerelease(candidate.version) === null)
  const chosen = (stable.length > 0 ? stable : compatible).slice(0, MAX_VERSIONS)
  const versions = chosen.map(({ version, manifest }) => ({
    version,
    publishTimestamp: parseTimestamp(packument, version),
    source: { type: 'npm' },
    ...(typeof manifest.engines?.dsh === 'string' ? { engines: { dsh: manifest.engines.dsh } } : {}),
  }))
  if (versions.length === 0) return { skip: `${entry.name}: 没有与该 DSH (${runtimeVersion}) 兼容的版本；${rejected.join(' / ')}` }

  const recommended = packument.versions[versions[0].version]
  const official = officialCatalog.get(entry.name)
  const { icon, source: iconSource } = await resolveIcon(entry.name, recommended)

  const title = official?.title ?? { en: entry.en.title, zh: entry.zh.title }
  const description = official?.description ?? { en: entry.en.description, zh: entry.zh.description }
  const repository = normaliseRepository(recommended.repository)
  const homepage = normaliseHomepage(recommended.homepage)
  const author =
    typeof recommended.author === 'string' ? recommended.author : typeof recommended.author?.name === 'string' ? recommended.author.name : undefined
  const unpackedSize = Number(recommended.dist?.unpackedSize ?? 0)
  const labels = new Set(entry.labels)
  if (unpackedSize >= 15 * 1024 * 1024) labels.add('heavy')

  const plugin = {
    name: entry.name,
    title,
    description,
    icon,
    ...(homepage === undefined ? {} : { homepage }),
    ...(repository === undefined ? {} : { repository }),
    ...(author === undefined || author.trim() === '' ? {} : { author }),
    metadata: {
      category: entry.category,
      keywords: Array.isArray(recommended.keywords) ? recommended.keywords.filter((word) => typeof word === 'string') : [],
      labels: [...labels],
      sortKeys: {},
    },
    versions,
  }
  return { plugin, recommendedVersion: versions[0].version, iconSource, unpackedSize }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
console.log(`DSH 运行时版本：${runtimeVersion}`)
console.log(`profile：${PROFILE}`)
console.log(`精选条目：${CURATED.length} 个，开始抓取 npm 元数据并做兼容性判定…\n`)

const built = new Array(CURATED.length)
let cursor = 0
async function worker() {
  while (cursor < CURATED.length) {
    const index = cursor++
    const entry = CURATED[index]
    try {
      built[index] = await buildPlugin(entry)
    } catch (error) {
      built[index] = { skip: `${entry.name}: 抓取失败 ${error.message}` }
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const plugins = []
const skipped = []
const icons = new Map()
for (const [index, result] of built.entries()) {
  if (result?.plugin === undefined) {
    skipped.push(result?.skip ?? `${CURATED[index].name}: 未知原因`)
    continue
  }
  plugins.push(result.plugin)
  icons.set(result.plugin.name, result.iconSource)
}

if (plugins.length === 0) fail(`没有任何条目通过检查：\n${skipped.join('\n')}`)

const indexDocument = {
  format: 1,
  title: { en: 'DSH curated plugins', zh: 'DSH 精选插件' },
  description: {
    en: `Curated DSH bundles that this installation does not ship, generated against DSH ${runtimeVersion}.`,
    zh: `精选的 DSH 组合包（只收本版 DSH 不带的），针对 DSH ${runtimeVersion} 生成并通过兼容性判定。`,
  },
  metadata: {
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([id, value]) => [id, { title: value }])),
    labels: Object.fromEntries(Object.entries(LABELS).map(([id, value]) => [id, { title: value }])),
    sortKeys: {},
  },
  plugins,
}

// 用 DSH 自己的校验器把关，不通过就不写文件
let validated
try {
  validated = marketIndex.parseMarketIndex(indexDocument, 'https://example.invalid/dsh/index.json')
} catch (error) {
  fail(`生成的索引没通过 parseMarketIndex 校验：${error.path} —— ${error.reason}`)
}

console.log(`\n=== 收录 ${plugins.length} 个插件 ===`)
for (const plugin of validated.plugins) {
  const target = marketIndex.marketInstallTarget(plugin.name, plugin.versions[0])
  const specs = plugin.versions.map((version) => version.version).join(', ')
  const category = plugin.metadata.category ?? '-'
  console.log(`· ${plugin.name}  [${category}]  可装版本: ${specs}`)
  console.log(`    推荐安装目标: ${target.spec}${target.registry === undefined ? '' : ` (registry ${target.registry})`}  图标: ${icons.get(plugin.name)}`)
}
if (skipped.length > 0) {
  console.log(`\n=== 跳过 ${skipped.length} 个 ===`)
  for (const reason of skipped) console.log(`- ${reason}`)
}

const json = `${JSON.stringify(validated, undefined, 2)}\n`
const bytes = Buffer.byteLength(json, 'utf8')
console.log(`\n索引大小：${(bytes / 1024).toFixed(1)} KiB，图标上限 ${MAX_ICON_BYTES} B（内联）`)

if (DRY_RUN) {
  console.log('\n--dry-run：不写文件。')
} else {
  fs.writeFileSync(OUT_FILE, json, 'utf8')
  console.log(`\n已写入：${OUT_FILE}`)
  console.log('下一步：把 index.json 放到 http(s) 静态主机上，再到 插件 → 发现 → 添加索引源 填入它的 URL。')
}
