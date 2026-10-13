'use client';

import { useAdminData } from '@/components/admin/admin-shell';
import type { ConversationAnalysis, InsightsResponse } from '@/lib/admin-types';

export default function ConversationsPage() {
  const { data } = useAdminData();
  if (!data) return null;
  const analysis = data.conversationAnalysis;
  const inputInsights = data.inputInsights;

  return (
    <div className="space-y-5">
      <ConversationOverview data={data} />
      {analysis ? <DepthBucketsPanel analysis={analysis} /> : null}
      {analysis ? <FirstIntentPanel analysis={analysis} /> : null}
      {analysis ? <DropOffPanel analysis={analysis} /> : null}
      {inputInsights ? <InputCategoriesPanel insights={inputInsights} /> : null}
      {inputInsights ? <InputSamplesPanel insights={inputInsights} /> : null}
      <KeywordCloudPanel words={data.keywordCloud} />
    </div>
  );
}

function ConversationOverview({ data }: { data: InsightsResponse }) {
  const cards = [
    { label: '总消息数', value: data.conversationStats.totalMessages, detail: `用户 ${data.conversationStats.userMessageCount} · AI ${data.conversationStats.assistantMessageCount}` },
    { label: '对话场数', value: data.conversationStats.conversations, detail: `活跃用户 ${data.conversationStats.activeChatUsers}` },
    { label: '用户文字量', value: data.conversationStats.userTextChars, detail: `均 ${data.conversationStats.avgUserMessageChars} 字/条` },
    { label: '总文字量', value: data.conversationStats.totalTextChars, detail: '用户与 AI 合计' },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{card.value.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function DepthBucketsPanel({ analysis }: { analysis: ConversationAnalysis }) {
  const max = Math.max(...analysis.depthBuckets.map((b) => b.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">对话深度分布</h2>
        <p className="mt-1 text-sm text-slate-500">用户和 AI 之间的消息往返轮数。1 条消息表示用户提问后未继续，11+ 是深度对话。</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-5">
        {analysis.depthBuckets.map((b) => (
          <div key={b.bucket} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{b.bucket}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{b.count}</p>
            <p className="text-xs text-slate-500">占比 {b.rate}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${Math.max(8, Math.round((b.count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FirstIntentPanel({ analysis }: { analysis: ConversationAnalysis }) {
  const max = Math.max(...analysis.firstIntentCategories.map((c) => c.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">首条消息意图分布</h2>
        <p className="mt-1 text-sm text-slate-500">按每场对话的第一条用户消息做意图分类，反映用户进入时最关心的问题。</p>
      </div>
      {analysis.firstIntentCategories.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无意图分类数据。</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {analysis.firstIntentCategories.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">{c.name}</span>
                <span className="text-slate-600">{c.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${Math.max(8, Math.round((c.count / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DropOffPanel({ analysis }: { analysis: ConversationAnalysis }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">对话流失情况</h2>
          <p className="mt-1 text-sm text-slate-500">用户提问后未收到 AI 回复，或只发了一条消息就离开的会话</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">流失率</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{analysis.dropOffRate}%</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">总对话数</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{analysis.totalConversations}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">流失会话</p>
          <p className="mt-1 text-xl font-bold text-rose-600">{analysis.dropOffConversations}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">单条消息会话</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{analysis.singleMessageConversations}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">多轮对话</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{analysis.multiTurnConversations}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">平均每场对话消息数：{analysis.avgMessagesPerConversation} 条</p>
    </section>
  );
}

function InputCategoriesPanel({ insights }: { insights: NonNullable<InsightsResponse['inputInsights']> }) {
  const max = Math.max(...insights.categories.map((c) => c.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">用户问题分类</h2>
          <p className="mt-1 text-sm text-slate-500">关注用户在问什么、困在哪里</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">均字数 {insights.averages.userMessageChars}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">每轮消息 {insights.averages.messagesPerConversation}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">人均提问 {insights.averages.userMessagesPerActiveUser}</span>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {insights.categories.length === 0 ? (
          <p className="text-sm text-slate-500">暂无分类数据。</p>
        ) : (
          insights.categories.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">{c.name}</span>
                <span className="text-slate-600">{c.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.max(8, Math.round((c.count / max) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InputSamplesPanel({ insights }: { insights: NonNullable<InsightsResponse['inputInsights']> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">脱敏输入样本</h2>
      <p className="mt-1 text-sm text-slate-500">真实用户开始对话后，这里会显示脱敏后的代表性问题。</p>
      <div className="mt-4 grid gap-2">
        {insights.samples.length === 0 ? (
          <p className="text-sm text-slate-500">暂无样本。</p>
        ) : (
          insights.samples.slice(0, 8).map((item, index) => (
            <div key={`${item.at}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">{item.category}</span>
                <span className="text-xs text-slate-400">{item.chars} 字</span>
              </div>
              <p className="line-clamp-2 text-slate-700">{item.preview}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function KeywordCloudPanel({ words }: { words: Array<{ text: string; value: number }> }) {
  const max = Math.max(...words.map((w) => w.value), 1);
  const palette = ['text-sky-700', 'text-emerald-700', 'text-violet-700', 'text-rose-700', 'text-amber-700', 'text-slate-700'];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">用户对话关键词词云</h2>
      <p className="mt-1 text-sm text-slate-500">基于脱敏后的用户消息分词统计，不展示原始句子。</p>
      {words.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无关键词数据。</p>
      ) : (
        <div className="mt-4 flex min-h-48 flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-5">
          {words.slice(0, 60).map((word, index) => {
            const size = 12 + Math.round((word.value / max) * 22);
            return (
              <span
                key={word.text}
                className={`font-semibold leading-none ${palette[index % palette.length]}`}
                style={{ fontSize: `${size}px` }}
                title={`${word.text}: ${word.value}`}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}
