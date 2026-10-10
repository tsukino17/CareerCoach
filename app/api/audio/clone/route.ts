import { NextResponse } from 'next/server';
import { writeFile, mkdir, mkdtemp, unlink, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const GPT_SOVITS_REFER_DIR = process.env.GPT_SOVITS_REFER_DIR || join(process.cwd(), 'gpt_sovits_refs');
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || '') || 10 * 1024 * 1024;
const MAX_CLONE_DURATION_SECONDS = 45;
const TRIM_START_SECONDS = 3;
const VALID_EXTENSIONS = ['wav', 'mp3', 'aac', 'm4a', 'flac'];

async function findBinary(name: string): Promise<string> {
  const { env } = process;
  const PATH = (env.PATH || '').split(':');
  for (const dir of PATH) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${name} 未找到，请确保已安装 ffmpeg`);
}

async function ensureReferDir() {
  if (!existsSync(GPT_SOVITS_REFER_DIR)) {
    await mkdir(GPT_SOVITS_REFER_DIR, { recursive: true });
  }
}

async function runFFmpeg(args: string[]) {
  const ffmpeg = await findBinary('ffmpeg');
  await execFileAsync(ffmpeg, args);
}

async function probeDuration(filePath: string) {
  const ffprobe = await findBinary('ffprobe');
  const { stdout } = await execFileAsync(ffprobe, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
}

async function withTempDir(prefix: string, fn: (dir: string) => Promise<string>) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function processAudio(filePath: string, fileExtension: string) {
  const duration = await probeDuration(filePath);
  const needsTrim = duration > MAX_CLONE_DURATION_SECONDS;

  if (!needsTrim) {
    return { filePath, duration, trimmed: false };
  }

  return withTempDir('career-audio-trim-', async (workingDir) => {
    const trimmedPath = join(workingDir, `trimmed.${fileExtension}`);
    const availableTail = Math.max(duration - MAX_CLONE_DURATION_SECONDS, 0);
    const trimStart = Math.min(TRIM_START_SECONDS, availableTail);

    await runFFmpeg([
      '-y',
      '-ss', String(trimStart),
      '-i', filePath,
      '-t', String(MAX_CLONE_DURATION_SECONDS),
      '-ac', '1',
      '-ar', '16000',
      trimmedPath,
    ]);

    await unlink(filePath).catch(() => {});
    return { filePath: trimmedPath, duration, trimmed: true };
  });
}

async function normalizeLargeAudio(filePath: string) {
  const { stat } = await import('fs/promises');
  const fileStats = await stat(filePath);

  if (fileStats.size <= MAX_UPLOAD_BYTES) {
    return filePath;
  }

  return withTempDir('career-audio-normalize-', async (workingDir) => {
    const normalizedPath = join(workingDir, 'normalized.mp3');
    await runFFmpeg([
      '-y',
      '-i', filePath,
      '-ac', '1',
      '-ar', '16000',
      '-b:a', '48k',
      normalizedPath,
    ]);
    await unlink(filePath).catch(() => {});
    return normalizedPath;
  });
}

export async function POST(req: Request) {
  try {
    await ensureReferDir();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '缺少音频文件' }, { status: 400 });
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !VALID_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json({ error: '不支持的文件格式。支持：WAV、MP3、AAC、M4A、FLAC' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const audioId = `voice_${uuidv4().slice(0, 8)}`;
    const fileName = `${audioId}.${fileExtension}`;
    const originalFilePath = join(GPT_SOVITS_REFER_DIR, fileName);

    await writeFile(originalFilePath, buffer);

    const normalizedPath = await normalizeLargeAudio(originalFilePath);
    const result = await processAudio(normalizedPath, fileExtension === 'wav' ? 'wav' : 'mp3');

    return NextResponse.json({
      success: true,
      audioId,
      fileName: file.name,
      filePath: result.filePath,
      originalDurationSeconds: result.duration,
      trimmed: result.trimmed,
    });
  } catch (error: unknown) {
    console.error('Audio Clone Processing Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 },
    );
  }
}