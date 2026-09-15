// 维保智能客服 Agent —— 一键启动器
// 职责：确保前端已构建 -> 找空闲端口 -> 起 Express(同时托管 API + 前端) -> 自动打开浏览器
// 退出：关闭本窗口 / Ctrl+C 即停止全部进程。
import { spawn } from 'node:child_process';
import net from 'node:net';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { platform } from 'node:os';
import { execSync } from 'node:child_process';

const projectDir = process.cwd();
const isWin = platform() === 'win32';
const npxBin = isWin ? 'npx.cmd' : 'npx';

// 解析 WorkBuddy 自带的 Node22 运行时目录（better-sqlite3 原生模块按 Node22/ABI127 编译）。
// 用 USERPROFILE 拼接，避免把中文用户名写死在源码里（UTF-8 源码 + 运行时字符串，无 GBK 截断风险）。
let node22Dir = '';
if (isWin && process.env.USERPROFILE) {
  const candidate = join(process.env.USERPROFILE, '.workbuddy', 'binaries', 'node', 'versions', '22.12.0');
  if (existsSync(join(candidate, 'node.exe'))) node22Dir = candidate;
}

const log = (...a) => console.log(...a);
const ok = (m) => log(`  \u2713 ${m}`);
const warn = (m) => log(`  \u26a0 ${m}`);

// 从 3000 起找一个未被占用的端口，避免历史残留进程导致 EADDRINUSE
function findFreePort(start) {
  return new Promise((resolvePort) => {
    const s = net.createServer();
    s.once('error', () => resolvePort(findFreePort(start + 1)));
    s.once('listening', () => {
      const p = s.address().port;
      s.close(() => resolvePort(p));
    });
    s.listen(start, '127.0.0.1');
  });
}

// 同时探测 127.0.0.1 与 localhost，兼容服务绑在 IPv6(::) 而本机未开 IPv4 映射的网卡
const HEALTH_HOSTS = ['127.0.0.1', 'localhost'];
async function waitForHealth(port, tries = 180) {
  for (let i = 0; i < tries; i++) {
    for (const host of HEALTH_HOSTS) {
      try {
        const r = await fetch(`http://${host}:${port}/api/health`);
        if (r.ok) return true;
      } catch {
        /* not ready yet */
      }
    }
    if (i > 0 && i % 10 === 9) {
      log(`  ... 仍在等待服务就绪（已 ${(i + 1) * 0.5} 秒，首次启动较慢属正常）`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // 把 Node22 运行时提到 PATH 最前，确保 npx/tsx 用 Node22 跑（规避 better-sqlite3 ABI 不兼容）
  if (node22Dir) {
    const sep = isWin ? ';' : ':';
    process.env.PATH = `${node22Dir}${sep}${process.env.PATH}`;
    log(`  已切换 Node 22 运行时：${node22Dir}`);
  } else {
    warn('未找到 WorkBuddy 自带 Node22，将使用系统 Node（若报错 better-sqlite3 ABI 不兼容，请改用 dev-node22.cmd）。');
  }

  log('\n  示例住宅项目 · 维保智能客服 Agent');
  log('  ----------------------------------------');

  // 1) 前端是否构建过
  const distIndex = resolve(projectDir, 'dist/index.html');
  if (!existsSync(distIndex)) {
    log('  首次启动：正在构建前端界面（约 10~30 秒，请稍候）...');
    const build = spawn(`${npxBin} vite build`, { cwd: projectDir, stdio: 'inherit', shell: true });
    await new Promise((res) => build.on('close', res));
    if (!existsSync(distIndex)) {
      warn('前端构建失败，请以开发模式运行（npm run dev）后重试。');
      process.exit(1);
    }
    ok('前端构建完成');
  }

  // 2) 端口
  const port = await findFreePort(Number(process.env.PORT) || 3000);
  if (port !== (Number(process.env.PORT) || 3000)) {
    warn(`默认端口被占用，已改用 ${port}`);
  } else {
    ok(`端口 ${port} 可用`);
  }

  // 3) 启动服务（API + 前端 同进程同端口）
  log('  正在启动服务...');
  const env = { ...process.env, PORT: String(port) };
  const server = spawn(`${npxBin} tsx server/index.ts`, {
    cwd: projectDir,
    env,
    stdio: 'inherit',
    shell: true,
    detached: !isWin, // Windows 下用 taskkill /T 清理整棵进程树
  });

  // 关闭时连带清掉子进程（tsx -> node 服务端），避免留下孤儿占端口
  const killTree = () => {
    try {
      if (isWin && server.pid) {
        execSync(`taskkill /F /T /PID ${server.pid}`, { stdio: 'ignore' });
      } else if (server.pid) {
        process.kill(-server.pid, 'SIGTERM');
      }
    } catch (e) {
      try { server.kill('SIGKILL'); } catch {}
    }
  };

  const ready = await waitForHealth(port);
  if (!ready) {
    warn('服务启动超时，请检查终端输出。');
    server.kill();
    process.exit(1);
  }
  ok('服务已就绪');

  // 4) 打开浏览器
  const url = `http://localhost:${port}`;
  try {
    if (isWin) execSync(`start "" "${url}"`, { stdio: 'ignore' });
    else if (platform() === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' });
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    ok(`已打开浏览器：${url}`);
  } catch {
    warn(`请手动访问：${url}`);
  }

  log('  ----------------------------------------');
  log(`  图形化程序已启动：${url}`);
  log('  关闭此窗口 或 按 Ctrl+C 即可退出。');

  server.on('exit', () => process.exit(0));
  const shutdown = () => {
    killTree();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', killTree);
}

main().catch((e) => {
  console.error('启动失败：', e);
  process.exit(1);
});
