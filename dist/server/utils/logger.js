"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = logEvent;
exports.logNamedEvent = logNamedEvent;
exports.readNamedLogTail = readNamedLogTail;
exports.getLogsDir = getLogsDir;
const fs_1 = require("fs");
const path_1 = require("path");
const logsDir = (0, path_1.join)(process.cwd(), 'runtime-logs');
if (!(0, fs_1.existsSync)(logsDir)) {
    (0, fs_1.mkdirSync)(logsDir, { recursive: true });
}
const serverLogFile = (0, path_1.join)(logsDir, 'server.log.txt');
const logStream = (0, fs_1.createWriteStream)(serverLogFile, { flags: 'a' });
function logEvent(level, event, data = {}) {
    const line = `[${new Date().toISOString()}] [${level}] ${event} ${JSON.stringify(data)}\n`;
    logStream.write(line);
}
function logNamedEvent(fileName, level, event, data = {}) {
    const safeFileName = String(fileName || 'debug').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFile = (0, path_1.join)(logsDir, `${safeFileName}.log.txt`);
    const line = `[${new Date().toISOString()}] [${level}] ${event} ${JSON.stringify(data)}\n`;
    try {
        (0, fs_1.appendFileSync)(targetFile, line, 'utf8');
    }
    catch {
        // noop
    }
}
function readNamedLogTail(fileName, maxLines = 200) {
    const safeFileName = String(fileName || 'debug').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFile = (0, path_1.join)(logsDir, `${safeFileName}.log.txt`);
    if (!(0, fs_1.existsSync)(targetFile))
        return [];
    try {
        const raw = (0, fs_1.readFileSync)(targetFile, 'utf8');
        return raw.split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.floor(maxLines)));
    }
    catch {
        return [];
    }
}
function getLogsDir() {
    return logsDir;
}
//# sourceMappingURL=logger.js.map