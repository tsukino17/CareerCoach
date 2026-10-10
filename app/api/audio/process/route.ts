import { NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const TMP_DIR = join(tmpdir(), 'tts_samples');

if (!existsSync(TMP_DIR)) {
  await mkdir(TMP_DIR);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '未找到上传的文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${uuidv4()}-${file.name}`;
    const filePath = join(TMP_DIR, fileName);

    await writeFile(filePath, buffer);

    const fileSize = buffer.length;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    const validExtensions = ['wav', 'mp3', 'aac', 'm4a', 'flac'];
    if (!fileExtension || !validExtensions.includes(fileExtension)) {
      await unlink(filePath);
      return NextResponse.json(
        { error: '不支持的文件格式。支持的格式：WAV, MP3, AAC, M4A, FLAC' },
        { status: 400 }
      );
    }

    if (fileSize > 10 * 1024 * 1024) {
      await unlink(filePath);
      return NextResponse.json(
        { error: '文件大小超过限制（最大10MB）' },
        { status: 400 }
      );
    }

    const audioId = fileName.split('.')[0];

    return NextResponse.json({
      success: true,
      audioId,
      fileName,
      fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
      format: fileExtension,
      message: '音频文件上传成功',
      filePath,
      instructions: `请使用以下指令来模仿此声音：\n"请模仿这段音频的音色和语调，声音特征：${fileExtension.toUpperCase()}格式音频样本，音色自然真实"`,
    });
  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json(
      { error: '上传失败，请重试' },
      { status: 500 }
    );
  }
}
