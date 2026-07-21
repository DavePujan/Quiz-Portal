const { fork } = require('child_process');
const path = require('path');

console.log("🚀 Starting QuizPortal Production Process Suite...");

const serverPath = path.join(__dirname, 'server.js');
const submissionWorkerPath = path.join(__dirname, 'workers', 'submission.worker.js');
const auditWorkerPath = path.join(__dirname, 'workers', 'audit.worker.js');

function runProcess(scriptPath, name) {
    console.log(`[Suite] Starting ${name}...`);
    const proc = fork(scriptPath);

    proc.on('exit', (code) => {
        console.log(`[Suite] ${name} exited with code ${code}. Restarting in 5 seconds...`);
        setTimeout(() => runProcess(scriptPath, name), 5000);
    });

    proc.on('error', (err) => {
        console.error(`[Suite] ${name} encountered error:`, err);
    });
}

// Start Web Server and background workers under a single lightweight process manager
runProcess(serverPath, 'Web Server');
runProcess(submissionWorkerPath, 'Submission Worker');
runProcess(auditWorkerPath, 'Audit Worker');
