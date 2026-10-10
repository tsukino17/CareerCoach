import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

const DASHSCOPE_UPLOAD_URL = 'https://dashscope.aliyuncs.com/api/v1/files';
const DASHSCOPE_FILE_INFO_URL = 'https://dashscope.aliyuncs.com/api/v1/files';
const DASHSCOPE_ASR_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';

type DashScopeFileUploadResponse = {
  data?: {
    file_id?: string;
    file_ids?: string[];
    url?: string;
    uploaded_files?: Array<{
      name?: string;
      file_id?: string;
      url?: string;
    }>;
    files?: Array<{
      url?: string;
      file_id?: string;
    }>;
  };
};

type DashScopeAsrResponse = {
  output?: {
    text?: string;
    sentences?: Array<{ text?: string }>;
  };
};

async function uploadFileToDashScope(filePath: string, apiKey: string) {
  const fileBuffer = await readFile(filePath);
  const file = new File([fileBuffer], filePath.split('/').pop() || 'audio.wav');
  const formData = new FormData();
  formData.append('files', file);
  formData.append('purpose', 'asr');

  const response = await fetch(DASHSCOPE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  const result = (await response.json()) as DashScopeFileUploadResponse;
  if (!response.ok) {
    throw new Error(`DashScope file upload failed: ${JSON.stringify(result)}`);
  }

  const uploadedUrl =
    result?.data?.files?.[0]?.url ||
    result?.data?.uploaded_files?.[0]?.url ||
    result?.data?.url;
  if (!uploadedUrl) {
    const fileId =
      result?.data?.files?.[0]?.file_id ||
      result?.data?.uploaded_files?.[0]?.file_id ||
      result?.data?.file_id ||
      result?.data?.file_ids?.[0];
    if (!fileId) {
      throw new Error(`DashScope 文件上传成功，但未返回可用文件 URL 或 file_id: ${JSON.stringify(result)}`);
    }
    return await getDashScopeFileUrl(fileId, apiKey);
  }

  return uploadedUrl;
}

async function getDashScopeFileUrl(fileId: string, apiKey: string) {
  const response = await fetch(`${DASHSCOPE_FILE_INFO_URL}/${fileId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  const result = (await response.json()) as {
    data?: {
      url?: string;
      file_id?: string;
    };
  };

  if (!response.ok) {
    throw new Error(`DashScope file info failed: ${JSON.stringify(result)}`);
  }

  const fileUrl = result?.data?.url;
  if (!fileUrl) {
    throw new Error(`DashScope 文件详情接口未返回可用 URL: ${JSON.stringify(result)}`);
  }

  return fileUrl;
}

async function transcribeWithDashScope(fileUrl: string, apiKey: string) {
  const response = await fetch(DASHSCOPE_ASR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'paraformer-v2',
      input: {
        file_urls: [fileUrl],
      },
      parameters: {
        language_hints: ['zh', 'en'],
      },
    }),
  });

  const result = (await response.json()) as DashScopeAsrResponse;
  if (!response.ok) {
    throw new Error(`DashScope ASR failed: ${JSON.stringify(result)}`);
  }

  const sentenceText = result?.output?.sentences?.map((item) => item.text || '').join('').trim();
  const fullText = result?.output?.text?.trim();
  const text = sentenceText || fullText;

  if (!text) {
    throw new Error('DashScope ASR 未返回可用识别文本');
  }

  return text;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: '缺少 DASHSCOPE_API_KEY，无法使用云端音频识别' }, { status: 500 });
    }

    const { filePath } = await req.json();
    if (!filePath) {
      return NextResponse.json({ error: '缺少音频文件路径' }, { status: 400 });
    }

    const uploadedUrl = await uploadFileToDashScope(filePath, apiKey);
    const text = await transcribeWithDashScope(uploadedUrl, apiKey);

    return NextResponse.json({
      text,
      language: 'zh',
      provider: 'dashscope-paraformer-v2',
      fileUrl: uploadedUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '语音识别失败';
    console.error('Transcribe Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
