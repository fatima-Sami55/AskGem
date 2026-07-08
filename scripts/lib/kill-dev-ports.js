const { spawnSync } = require('child_process');

const DEV_PORTS = [8000, 5000, 5173];

function getListeningPids(port) {
  if (process.platform === 'win32') {
    const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true });
    if (result.status !== 0 || !result.stdout) return [];

    const pids = new Set();
    for (const line of result.stdout.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      if (!line.includes(`:${port}`)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number.parseInt(parts[parts.length - 1], 10);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  const result = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return [];

  return result.stdout
    .trim()
    .split('\n')
    .map((value) => Number.parseInt(value, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function killPid(pid) {
  const ownPid = process.pid;
  if (pid === ownPid) return false;

  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/F'], {
      encoding: 'utf8',
      shell: false,
    });
    return result.status === 0;
  }

  const result = spawnSync('kill', ['-9', String(pid)], { encoding: 'utf8' });
  return result.status === 0;
}

function sleep(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    // brief busy-wait so ports release before dev processes bind
  }
}

function killPort(port) {
  const pids = getListeningPids(port);
  if (pids.length === 0) return [];

  const killed = [];
  for (const pid of pids) {
    if (killPid(pid)) killed.push(pid);
  }
  return killed;
}

/**
 * Stop stale FastAPI / Express / Vite listeners so `npm run dev` always starts fresh.
 * @param {number[]} [ports=DEV_PORTS]
 * @returns {{ port: number, pids: number[] }[]}
 */
function killDevPorts(ports = DEV_PORTS) {
  const results = [];

  for (const port of ports) {
    const pids = killPort(port);
    if (pids.length > 0) {
      results.push({ port, pids });
      console.log(`  Stopped port ${port} (PID ${pids.join(', ')})`);
    }
  }

  if (results.length > 0) {
    sleep(750);
  }

  return results;
}

module.exports = {
  DEV_PORTS,
  getListeningPids,
  killDevPorts,
};
