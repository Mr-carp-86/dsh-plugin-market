#!/usr/bin/env node
/**
 * 本地预览索引（只用于马上在「发现」页里试一下，不是长期方案）。
 *
 *   node serve.mjs            # 默认 8791 端口
 *   node serve.mjs 9000       # 指定端口
 *
 * 启动后在 插件 → 发现 → 添加索引源 里填：
 *   http://127.0.0.1:8791/index.json
 *
 * 注意：
 *  - 这个进程一关、或者 DSH 重启，索引就没了（「发现」页会读失败，删掉/重加索引源即可）。
 *  - 长期使用请把 index.json 放到静态主机（GitHub Pages / 对象存储 / Cloudflare Pages 等），
 *    要求：http(s)、返回 2xx、不重定向、响应体是 UTF-8 JSON。
 *  - 如果 DSH 里配了网络代理（见官方「网络代理」文档），访问 127.0.0.1 可能被代理拦掉，
 *    那种情况请直接用静态主机。
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const INDEX_FILE = path.join(HERE, 'index.json')
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 8791)

if (!fs.existsSync(INDEX_FILE)) {
  console.error(`找不到 ${INDEX_FILE}，请先运行：node generate-index.mjs`)
  process.exit(1)
}

const server = http.createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`)
  if (pathname !== '/' && pathname !== '/index.json') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('not found')
    return
  }
  let body
  try {
    body = fs.readFileSync(INDEX_FILE)
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(`index.json 读取失败：${error.message}`)
    return
  }
  response.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  response.end(body)
})

server.on('error', (error) => {
  console.error(`监听失败：${error.message}`)
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/index.json`
  console.log(`索引服务已启动：${url}`)
  console.log('把上面这个 URL 填进 插件 → 发现 → 添加索引源。')
  console.log('（临时预览：进程关掉或 DSH 重启后失效；长期使用请托管到静态主机。Ctrl+C 结束。）')
})
