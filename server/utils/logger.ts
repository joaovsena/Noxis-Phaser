import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const logsDir = join(process.cwd(), 'runtime-logs');

if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
}

const serverLogFile = join(logsDir, 'server.log.txt');
const logStream = createWriteStream(serverLogFile, { flags: 'a' });

export function logEvent(level: string, event: string, data: any = {}): void {
    const line = `[${new Date().toISOString()}] [${level}] ${event} ${JSON.stringify(data)}\n`;
    logStream.write(line);
}

export function logNamedEvent(fileName: string, level: string, event: string, data: any = {}): void {
    const safeFileName = String(fileName || 'debug').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFile = join(logsDir, `${safeFileName}.log.txt`);
    const line = `[${new Date().toISOString()}] [${level}] ${event} ${JSON.stringify(data)}\n`;
    try {
        appendFileSync(targetFile, line, 'utf8');
    } catch {
        // noop
    }
}

export function readNamedLogTail(fileName: string, maxLines = 200): string[] {
    const safeFileName = String(fileName || 'debug').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFile = join(logsDir, `${safeFileName}.log.txt`);
    if (!existsSync(targetFile)) return [];
    try {
        const raw = readFileSync(targetFile, 'utf8');
        return raw.split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.floor(maxLines)));
    } catch {
        return [];
    }
}

export function getLogsDir() {
    return logsDir;
}
