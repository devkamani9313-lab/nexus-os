import { spawn, execSync } from 'child_process';
import path from 'path';

let n8nProcess = null;
let tunnelProcess = null;
let isReconnecting = false;

const PORT = 5678;

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`).toString();
      const lines = output.split('\r\n');
      const pids = new Set();
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`)) {
          const pid = parts[parts.length - 1];
          if (parseInt(pid) > 0) pids.add(pid);
        }
      });
      pids.forEach(pid => {
        console.log(`Force-killing orphaned PID ${pid} holding port ${port}...`);
        try { execSync(`taskkill /F /PID ${pid}`); } catch (e) {}
      });
    } else {
      try { execSync(`fuser -k ${port}/tcp`); } catch (e) {}
    }
  } catch (err) {
    // Port is not in use or netstat failed, safe to ignore
  }
}

function cleanup() {
  console.log('Cleaning up existing processes...');
  if (n8nProcess) {
    try {
      n8nProcess.removeAllListeners('close');
      n8nProcess.kill('SIGTERM');
    } catch (e) {}
    n8nProcess = null;
  }
  if (tunnelProcess) {
    try {
      tunnelProcess.removeAllListeners('close');
      tunnelProcess.kill('SIGTERM');
    } catch (e) {}
    tunnelProcess = null;
  }
  killPort(PORT);
}

function restartEverything() {
  if (isReconnecting) return;
  isReconnecting = true;
  console.log('Scheduling restart of all services in 5 seconds...');
  cleanup();
  setTimeout(() => {
    isReconnecting = false;
    startTunnel();
  }, 5000);
}

function startTunnel() {
  killPort(PORT);
  console.log('Starting localtunnel...');
  
  tunnelProcess = spawn('npx', ['localtunnel', '--port', PORT.toString()], {
    shell: true
  });

  let urlDetected = false;

  tunnelProcess.stdout.on('data', (data) => {
    const text = data.toString();
    console.log(`[Tunnel]: ${text.trim()}`);

    const match = text.match(/your url is:\s+(https:\/\/[^\s]+)/i);
    if (match && !urlDetected) {
      urlDetected = true;
      const webhookUrl = match[1].trim();
      console.log(`Extracted active tunnel URL: ${webhookUrl}`);
      startN8N(webhookUrl);
    }
  });

  tunnelProcess.stderr.on('data', (data) => {
    console.error(`[Tunnel Error]: ${data.toString().trim()}`);
  });

  tunnelProcess.on('close', (code) => {
    console.log(`Tunnel process exited with code ${code}.`);
    restartEverything();
  });
  
  tunnelProcess.on('error', (err) => {
    console.error('Tunnel process error:', err);
    restartEverything();
  });
}

function startN8N(webhookUrl) {
  console.log(`Starting n8n server with WEBHOOK_URL="${webhookUrl}"...`);
  
  const env = {
    ...process.env,
    NODE_FUNCTION_ALLOW_EXTERNAL: '*',
    NODE_FUNCTION_ALLOW_BUILTIN: '*',
    NODE_OPTIONS: '--dns-result-order=ipv4first',
    WEBHOOK_URL: webhookUrl
  };

  n8nProcess = spawn('npx', ['n8n', 'start'], {
    env,
    shell: true,
    stdio: ['ignore', 'inherit', 'inherit']
  });

  n8nProcess.on('close', (code) => {
    console.log(`n8n process exited with code ${code}.`);
    restartEverything();
  });
  
  n8nProcess.on('error', (err) => {
    console.error('n8n process error:', err);
    restartEverything();
  });
}

// Run database initialization
try {
  console.log('Running database initialization...');
  execSync('node init-db.js', { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to initialize database:', err);
}

// Start execution
const apiProcess = spawn('node', ['api.js'], { stdio: 'inherit' });
startTunnel();

// Graceful shutdowns
process.on('SIGINT', () => {
  if (apiProcess) apiProcess.kill('SIGINT');
  cleanup();
  process.exit();
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit();
});
