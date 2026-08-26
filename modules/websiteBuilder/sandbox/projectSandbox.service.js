const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn, exec } = require('child_process');

/**
 * Stage 2A Real Runtime Sandbox Service
 *
 * Safely executes emitted React/Vite applications in isolated local runtime environments.
 * Lifecycle: PREPARING -> INSTALLING -> BUILDING -> STARTING -> RUNNING (Health Checked) -> STOPPED / FAILED
 */
class ProjectSandboxService {
  constructor() {
    this.activeRuntimes = new Map(); // projectId -> runtimeState
    this.baseStorageDir = path.join(__dirname, '../../../../storage/projects');

    // Ensure process cleanup on server shutdown
    const cleanupAll = () => this.stopAllProjectsSync();
    process.once('exit', cleanupAll);
    process.once('SIGINT', cleanupAll);
    process.once('SIGTERM', cleanupAll);
  }

  /**
   * Sanitizes environment variables passed to child processes
   * Excludes sensitive server secrets & credentials
   */
  getSanitizedEnv() {
    return {
      PATH: process.env.PATH || '',
      SystemRoot: process.env.SystemRoot || '',
      TEMP: process.env.TEMP || '',
      TMP: process.env.TMP || '',
      HOME: process.env.HOME || '',
      USERPROFILE: process.env.USERPROFILE || '',
      NODE_ENV: 'production',
      FORCE_COLOR: 'true'
    };
  }

  /**
   * Dynamic Port Allocation — Finds an available TCP port in specified range
   */
  async findAvailablePort(startPort = 4100, endPort = 4900) {
    for (let port = startPort; port <= endPort; port++) {
      const isAvailable = await new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
          server.close(() => resolve(true));
        });
        server.listen(port, '127.0.0.1');
      });

      // Also check if port is currently registered in active runtimes
      const isUsedByActive = Array.from(this.activeRuntimes.values()).some(r => r.port === port);

      if (isAvailable && !isUsedByActive) {
        return port;
      }
    }
    throw new Error(`No available ports in range ${startPort}-${endPort}`);
  }

  /**
   * Validates project path to prevent directory traversal
   */
  validateProjectPath(projectDir) {
    if (!projectDir || typeof projectDir !== 'string') {
      throw new Error('Invalid project directory path');
    }
    const resolvedPath = path.resolve(projectDir);
    const resolvedStorage = path.resolve(this.baseStorageDir);
    if (!resolvedPath.startsWith(resolvedStorage)) {
      throw new Error(`Security Violation: Project path "${resolvedPath}" is outside allowed storage directory.`);
    }
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Project directory does not exist: "${resolvedPath}"`);
    }
    return resolvedPath;
  }

  /**
   * 1. Prepare Workspace Verification
   */
  prepareProject(projectId, projectDir) {
    const validDir = this.validateProjectPath(projectDir);
    const packageJsonPath = path.join(validDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`Missing package.json in project workspace: ${validDir}`);
    }

    const state = {
      projectId,
      projectDir: validDir,
      status: 'PREPARING',
      buildStatus: 'PENDING',
      port: null,
      url: null,
      processId: null,
      childProcess: null,
      startedAt: null,
      errors: []
    };

    this.activeRuntimes.set(projectId, state);
    return state;
  }

  /**
   * 2. Install Dependencies (With Instant Workspace Caching)
   */
  async installDependencies(projectId, projectDir, options = {}) {
    const timeoutMs = options.timeoutMs || 180000;
    const validDir = this.validateProjectPath(projectDir);

    const runtimeState = this.activeRuntimes.get(projectId) || this.prepareProject(projectId, validDir);
    runtimeState.status = 'INSTALLING';

    const targetNodeModules = path.join(validDir, 'node_modules');
    const cacheDir = path.join(this.baseStorageDir, '_node_modules_cache');
    const cacheNodeModules = path.join(cacheDir, 'node_modules');

    // Automatically clean up stale projects if storage is accumulating
    this.cleanupStaleProjects();

    // ⚡ Instant Path: If cache exists, link node_modules using symlink/junction (0 disk overhead, <10ms)
    if (fs.existsSync(cacheNodeModules) && !fs.existsSync(targetNodeModules)) {
      console.log(`[WB:SANDBOX:${projectId}] Linking node_modules from cache...`);
      const startTime = Date.now();
      try {
        const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(cacheNodeModules, targetNodeModules, symlinkType);
        const durationMs = Date.now() - startTime;
        console.log(`[WB:SANDBOX:${projectId}] Zero-overhead node_modules junction created in ${durationMs}ms.`);
        return { success: true, durationMs, stdout: 'Linked from workspace cache (junction)' };
      } catch (symErr) {
        console.warn(`[WB:SANDBOX:${projectId}] Junction creation failed, copying cache fallback:`, symErr.message);
        try {
          fs.cpSync(cacheNodeModules, targetNodeModules, { recursive: true });
          return { success: true, durationMs: Date.now() - startTime, stdout: 'Restored from workspace cache' };
        } catch (cpErr) {
          console.warn(`[WB:SANDBOX:${projectId}] Cache copy failed, running npm install...`, cpErr.message);
        }
      }
    }

    console.log(`[WB:SANDBOX:${projectId}] Running npm install in ${validDir}...`);

    return new Promise((resolve) => {
      const env = this.getSanitizedEnv();
      const startTime = Date.now();
      const isWin = process.platform === 'win32';
      const cmd = isWin ? 'npm.cmd install --no-audit --no-fund' : 'npm install --no-audit --no-fund';

      exec(cmd, { cwd: validDir, env, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        const durationMs = Date.now() - startTime;

        if (err) {
          const errMsg = `npm install failed (${err.message}). Stderr: ${stderr.slice(-300)}`;
          runtimeState.status = 'FAILED';
          runtimeState.errors.push(errMsg);
          console.error(`[WB:SANDBOX:${projectId}] ${errMsg}`);
          return resolve({ success: false, error: errMsg, durationMs, stdout, stderr });
        }

        // Cache node_modules for future instant sandbox runs
        try {
          if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
          if (!fs.existsSync(cacheNodeModules) && fs.existsSync(targetNodeModules)) {
            fs.cpSync(targetNodeModules, cacheNodeModules, { recursive: true });
            console.log(`[WB:SANDBOX:${projectId}] Saved node_modules to workspace cache.`);
          }
        } catch (cErr) {
          console.warn(`[WB:SANDBOX:${projectId}] Warning: Failed to populate node_modules cache:`, cErr.message);
        }

        console.log(`[WB:SANDBOX:${projectId}] npm install completed successfully in ${durationMs}ms.`);
        resolve({ success: true, durationMs, stdout });
      });
    });
  }

  /**
   * Safely cleans up stale generated projects older than 3 hours to prevent disk ENOSPC
   * Preserves active runtimes and the node_modules cache
   */
  cleanupStaleProjects() {
    try {
      if (!fs.existsSync(this.baseStorageDir)) return;
      const activeIds = new Set(this.activeRuntimes.keys());
      const entries = fs.readdirSync(this.baseStorageDir, { withFileTypes: true });
      const now = Date.now();
      const maxAgeMs = 3 * 3600 * 1000; // 3 hours

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('_') || activeIds.has(entry.name)) continue;
        const projectPath = path.join(this.baseStorageDir, entry.name);
        try {
          const stats = fs.statSync(projectPath);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.rmSync(projectPath, { recursive: true, force: true });
            console.log(`[WB:SANDBOX] Cleaned up stale storage for project: ${entry.name}`);
          }
        } catch (e) {
          // ignore single item clean error
        }
      }
    } catch (err) {
      console.warn('[WB:SANDBOX] Stale project cleanup note:', err.message);
    }
  }

  /**
   * 3. Build Verification (npm run build)
   */
  async buildProject(projectId, projectDir, options = {}) {
    const timeoutMs = options.timeoutMs || 120000;
    const validDir = this.validateProjectPath(projectDir);

    const runtimeState = this.activeRuntimes.get(projectId) || this.prepareProject(projectId, validDir);
    runtimeState.status = 'BUILDING';

    console.log(`[WB:SANDBOX:${projectId}] Running npm run build in ${validDir}...`);

    return new Promise((resolve) => {
      const env = this.getSanitizedEnv();
      const startTime = Date.now();
      const isWin = process.platform === 'win32';
      const viteJs = path.join(validDir, 'node_modules', 'vite', 'bin', 'vite.js');
      const cmd = fs.existsSync(viteJs)
        ? `node "${viteJs}" build`
        : (isWin ? 'npm.cmd run build' : 'npm run build');

      exec(cmd, { cwd: validDir, env, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        const durationMs = Date.now() - startTime;

        if (err) {
          const errMsg = `npm run build failed (${err.message}). Stderr: ${stderr.slice(-300)}`;
          runtimeState.status = 'FAILED';
          runtimeState.buildStatus = 'FAILED';
          runtimeState.errors.push(errMsg);
          console.error(`[WB:SANDBOX:${projectId}] ${errMsg}`);
          return resolve({ success: false, error: errMsg, durationMs, stdout, stderr });
        }

        runtimeState.buildStatus = 'SUCCESS';
        console.log(`[WB:SANDBOX:${projectId}] npm run build completed successfully in ${durationMs}ms.`);
        resolve({ success: true, durationMs, stdout });
      });
    });
  }

  /**
   * 4. Start Application Process & Perform Health Check
   */
  async startProject(projectId, projectDir, options = {}) {
    const validDir = this.validateProjectPath(projectDir);

    // Stop existing instance if running
    if (this.activeRuntimes.has(projectId)) {
      await this.stopProject(projectId);
    }

    const runtimeState = this.prepareProject(projectId, validDir);

    // Step A: Install dependencies if node_modules missing
    const nodeModulesPath = path.join(validDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      const installRes = await this.installDependencies(projectId, validDir, options);
      if (!installRes.success) {
        return runtimeState;
      }
    }

    // Step B: Build project verification (always rebuild if forceRebuild or dist/ missing)
    const distPath = path.join(validDir, 'dist');
    if (options.forceRebuild || !fs.existsSync(distPath)) {
      const buildRes = await this.buildProject(projectId, validDir, options);
      if (!buildRes.success) {
        return runtimeState;
      }
    } else {
      runtimeState.buildStatus = 'SUCCESS';
    }

    // Step C: Allocate dynamic port & start Vite preview server
    runtimeState.status = 'STARTING';
    const port = await this.findAvailablePort(4100, 4900);
    runtimeState.port = port;
    const url = `http://127.0.0.1:${port}`;
    runtimeState.url = url;

    console.log(`[WB:SANDBOX:${projectId}] Starting Vite preview server on ${url}...`);

    const isWin = process.platform === 'win32';
    const viteJs = path.join(validDir, 'node_modules', 'vite', 'bin', 'vite.js');
    const cmd = fs.existsSync(viteJs) ? process.execPath : (isWin ? 'npx.cmd' : 'npx');
    const args = fs.existsSync(viteJs)
      ? [viteJs, 'preview', '--port', String(port), '--host', '127.0.0.1']
      : ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1'];
    const env = this.getSanitizedEnv();

    const child = spawn(cmd, args, {
      cwd: validDir,
      env,
      windowsHide: true
    });

    runtimeState.processId = child.pid;
    runtimeState.childProcess = child;
    runtimeState.startedAt = new Date().toISOString();

    child.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.toLowerCase().includes('error')) {
        console.warn(`[WB:SANDBOX:${projectId} stdout]`, msg.trim());
      }
    });

    child.stderr.on('data', (data) => {
      const msg = data.toString();
      console.warn(`[WB:SANDBOX:${projectId} stderr]`, msg.trim());
    });

    child.on('close', (code) => {
      if (runtimeState.isExplicitStop) {
        console.log(`[WB:SANDBOX:${projectId}] Previous runtime server process terminated for rebuild.`);
      } else {
        console.log(`[WB:SANDBOX:${projectId}] Vite process exited with code ${code}`);
      }
      if (runtimeState.status === 'RUNNING' || runtimeState.status === 'STARTING') {
        runtimeState.status = 'STOPPED';
      }
    });

    // Step D: Perform HTTP Health Check
    const healthOk = await this.performHealthCheck(url, 20, 500);

    if (healthOk) {
      runtimeState.status = 'RUNNING';
      console.log(`[WB:SANDBOX:${projectId}] Health check PASSED cleanly. Sandbox live at: ${url}`);
    } else {
      runtimeState.status = 'FAILED';
      runtimeState.errors.push(`Health check failed for URL: ${url}`);
      console.error(`[WB:SANDBOX:${projectId}] Health check FAILED for ${url}`);
      await this.stopProject(projectId);
    }

    return runtimeState;
  }

  /**
   * Main Pipeline Orchestrator Entry Point: runProjectInSandbox
   */
  async runProjectInSandbox(options = {}) {
    const { projectId, projectDir } = options;
    if (!projectId || !projectDir) {
      throw new Error('projectId and projectDir are required for sandbox execution.');
    }
    return this.startProject(projectId, projectDir, options);
  }

  /**
   * HTTP Health Check polling helper
   */
  async performHealthCheck(url, maxRetries = 20, retryIntervalMs = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const isAlive = await new Promise((resolve) => {
        const req = http.get(url, { timeout: 2000 }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            const hasHtml = body.includes('<!DOCTYPE html>') || body.includes('<html') || body.includes('<div id="root"');
            if ((res.statusCode >= 200 && res.statusCode < 400) && hasHtml) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
      });

      if (isAlive) return true;
      await new Promise(r => setTimeout(r, retryIntervalMs));
    }
    return false;
  }

  /**
   * Stop Sandbox Project & Terminate Child Process Tree
   */
  async stopProject(projectId) {
    const runtimeState = this.activeRuntimes.get(projectId);
    if (!runtimeState) return { success: true, message: 'Project not running' };

    console.log(`[WB:SANDBOX:${projectId}] Stopping project runtime on port ${runtimeState.port}...`);
    runtimeState.isExplicitStop = true;

    if (runtimeState.childProcess && runtimeState.processId) {
      this.killProcessTree(runtimeState.processId);
    }

    runtimeState.status = 'STOPPED';
    runtimeState.port = null;
    runtimeState.url = null;
    runtimeState.childProcess = null;
    runtimeState.processId = null;

    this.activeRuntimes.delete(projectId);
    return { success: true, projectId };
  }

  /**
   * Safely kills a process tree across operating systems
   */
  killProcessTree(pid) {
    if (!pid) return;
    try {
      if (process.platform === 'win32') {
        exec(`taskkill /pid ${pid} /T /F`, () => {});
      } else {
        process.kill(-pid, 'SIGKILL');
      }
    } catch (err) {
      // Process already terminated
    }
  }

  stopAllProjectsSync() {
    for (const [projectId, state] of this.activeRuntimes.entries()) {
      if (state.processId) {
        this.killProcessTree(state.processId);
      }
    }
    this.activeRuntimes.clear();
  }

  getProjectStatus(projectId) {
    const state = this.activeRuntimes.get(projectId);
    if (!state) {
      return { status: 'STOPPED', projectId, port: null, url: null, buildStatus: 'NONE' };
    }
    return {
      projectId: state.projectId,
      status: state.status,
      buildStatus: state.buildStatus,
      port: state.port,
      url: state.url,
      startedAt: state.startedAt,
      errors: state.errors
    };
  }

  getProjectUrl(projectId) {
    const state = this.activeRuntimes.get(projectId);
    return state && state.status === 'RUNNING' ? state.url : null;
  }
}

module.exports = new ProjectSandboxService();
