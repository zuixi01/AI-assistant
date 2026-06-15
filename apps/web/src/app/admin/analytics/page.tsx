'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BriefcaseBusiness,
  Gauge,
  Layers3,
  MessageSquareText,
  RefreshCcw,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { apiGet } from '@/lib/api';
import {
  ActionButton,
  EmptyState,
  LoadingState,
  PageHeader,
  PageShell,
  Panel,
  ProgressMeter,
  StatusPill,
} from '@/components/ui/design-system';
import { cn } from '@/lib/cn';

type Tone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan';
type AnalyticsTab = 'overview' | 'trend' | 'intent' | 'platform' | 'aftersale' | 'accuracy' | 'performance';
type RangeKey = '7d' | '30d' | '90d';
type TrendMetric = 'totalMessages' | 'conversations' | 'leads';

interface DashboardMetric {
  total: number;
  current: number;
  today: number;
  delta: number;
}

interface DashboardResponse {
  range: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    conversations: DashboardMetric;
    messages: DashboardMetric;
    leads: DashboardMetric;
    aiReplies: {
      total: number;
      current: number;
      delta: number;
    };
    unresolvedQuestions: number;
    products: number;
    avgMessagesPerConversation: number;
    leadCaptureRate: number;
    aiAccuracyRate: number;
    accuracyDelta: number;
    correctionRate: number;
  };
}

interface TrendPoint {
  date: string;
  userMessages: number;
  assistantMessages: number;
  totalMessages: number;
  conversations: number;
  leads: number;
  correctedReplies: number;
}

interface IntentData {
  intent: string;
  count: number;
  percentage: number;
}

interface PlatformData {
  channel: string;
  conversations: number;
  messages: number;
  avgMessages: number;
  resolutionRate: number;
  share: number;
}

interface AfterSaleData {
  type: string;
  count: number;
  percentage: number;
}

interface AiAccuracy {
  totalReplies: number;
  correctedReplies: number;
  accuracyRate: number;
  correctionRate: number;
}

interface AgentPerf {
  agentId: string;
  conversations: number;
  resolved: number;
  pending: number;
  open: number;
  resolutionRate: number;
}

interface InsightMetric {
  label: string;
  value: string;
}

interface DrilldownInsight {
  id: string;
  title: string;
  subtitle: string;
  tone: Tone;
  summary: string;
  metrics: InsightMetric[];
}

const RANGE_TO_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const SERIES_META: Record<TrendMetric, { color: string; fill: string }> = {
  totalMessages: { color: '#4467f5', fill: 'rgba(68, 103, 245, 0.18)' },
  conversations: { color: '#13b5c8', fill: 'rgba(19, 181, 200, 0.14)' },
  leads: { color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.14)' },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value ?? 0);
}

function formatPercent(value: number, digits = 1) {
  return `${(value ?? 0).toFixed(digits)}%`;
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function buildLinePath(values: number[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...values, 1);
  const step = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;

  return values
    .map((value, index) => {
      const x = padding.left + step * index;
      const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function buildAreaPath(values: number[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...values, 1);
  const step = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;

  const points = values.map((value, index) => {
    const x = padding.left + step * index;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return `${x} ${y}`;
  });

  const firstX = padding.left;
  const lastX = padding.left + step * (values.length - 1);
  const bottomY = padding.top + chartHeight;

  return `M ${firstX} ${bottomY} L ${points.join(' L ')} L ${lastX} ${bottomY} Z`;
}

function MetricDelta({ value }: { value: number }) {
  const positive = value >= 0;
  const icon = positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
      )}
    >
      {icon}
      {formatPercent(Math.abs(value))}
    </span>
  );
}

function SectionTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  delta,
  helper,
  tone,
  icon,
}: {
  label: string;
  value: string;
  delta: number;
  helper: string;
  tone: Tone;
  icon: React.ReactNode;
}) {
  const toneStyles: Record<Tone, string> = {
    blue: 'from-blue-500/20 via-blue-200/10 to-transparent text-blue-700',
    emerald: 'from-emerald-500/20 via-emerald-200/10 to-transparent text-emerald-700',
    amber: 'from-amber-500/20 via-amber-200/10 to-transparent text-amber-700',
    rose: 'from-rose-500/20 via-rose-200/10 to-transparent text-rose-700',
    violet: 'from-violet-500/20 via-violet-200/10 to-transparent text-violet-700',
    cyan: 'from-cyan-500/20 via-cyan-200/10 to-transparent text-cyan-700',
  };

  return (
    <Panel className="premium-sheen relative overflow-hidden p-5">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', toneStyles[tone])} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{helper}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/70 bg-white/80 text-slate-700 shadow-lg shadow-slate-200/60">
          {icon}
        </div>
      </div>
      <div className="relative mt-5 flex items-center justify-between">
        <MetricDelta value={delta} />
        <span className="text-xs font-medium text-slate-400">对比上一周期</span>
      </div>
    </Panel>
  );
}

function TrendChart({
  data,
  activeMetric,
  activeIndex,
  onHover,
  onLeave,
}: {
  data: TrendPoint[];
  activeMetric: TrendMetric;
  activeIndex: number;
  onHover: (index: number) => void;
  onLeave: () => void;
}) {
  const width = 820;
  const height = 320;
  const padding = { top: 22, right: 20, bottom: 34, left: 20 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const gridValues = [0.25, 0.5, 0.75, 1];

  const series = {
    totalMessages: data.map((item) => item.totalMessages),
    conversations: data.map((item) => item.conversations),
    leads: data.map((item) => item.leads),
  };

  const currentValues = series[activeMetric];
  const maxValue = Math.max(...currentValues, 1);
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;
  const activeDot = data[activeIndex];
  const activeValue = currentValues[activeIndex] ?? 0;
  const activeX = padding.left + step * activeIndex;
  const activeY = padding.top + chartHeight - (activeValue / maxValue) * chartHeight;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['totalMessages', 'conversations', 'leads'] as TrendMetric[]).map((metric) => (
          <button
            key={metric}
            type="button"
            onClick={() => onHover(activeIndex)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              activeMetric === metric
                ? 'border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                : 'border-white/70 bg-white/75 text-slate-600 hover:border-blue-200 hover:text-blue-700',
            )}
          >
            {metric === 'totalMessages' ? '消息量' : metric === 'conversations' ? '会话量' : '线索量'}
          </button>
        ))}
        <StatusPill tone="cyan">悬浮查看明细</StatusPill>
      </div>

      <div className="rounded-[1.75rem] border border-slate-100 bg-slate-50/70 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[300px] w-full">
          {gridValues.map((ratio) => {
            const y = padding.top + chartHeight - chartHeight * ratio;
            return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="4 8" />;
          })}

          <path d={buildAreaPath(currentValues, width, height, padding)} fill={SERIES_META[activeMetric].fill} />

          {(['totalMessages', 'conversations', 'leads'] as TrendMetric[]).map((metric) => (
            <path
              key={metric}
              d={buildLinePath(series[metric], width, height, padding)}
              fill="none"
              stroke={SERIES_META[metric].color}
              strokeWidth={activeMetric === metric ? 4 : 2.2}
              strokeOpacity={activeMetric === metric ? 1 : 0.45}
              strokeLinecap="round"
            />
          ))}

          {data.map((item, index) => {
            const value = currentValues[index] ?? 0;
            const x = padding.left + step * index;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            return (
              <g key={item.date}>
                <circle
                  cx={x}
                  cy={y}
                  r={activeIndex === index ? 6.5 : 4.5}
                  fill={SERIES_META[activeMetric].color}
                  stroke="white"
                  strokeWidth="3"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => onHover(index)}
                  onFocus={() => onHover(index)}
                />
                <text x={x} y={height - 10} textAnchor="middle" className="fill-slate-400 text-[11px] font-semibold">
                  {formatDateLabel(item.date)}
                </text>
              </g>
            );
          })}

          <line x1={activeX} x2={activeX} y1={padding.top} y2={height - padding.bottom} stroke="rgba(68,103,245,0.18)" strokeDasharray="4 6" />
          <circle cx={activeX} cy={activeY} r="8" fill="white" stroke={SERIES_META[activeMetric].color} strokeWidth="4" />
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Panel className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">日期</p>
          <p className="mt-2 text-lg font-black text-slate-950">{formatDateLabel(activeDot.date)}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">用户消息</p>
          <p className="mt-2 text-lg font-black text-slate-950">{formatNumber(activeDot.userMessages)}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">AI 回复</p>
          <p className="mt-2 text-lg font-black text-slate-950">{formatNumber(activeDot.assistantMessages)}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">线索转化</p>
          <p className="mt-2 text-lg font-black text-slate-950">{formatNumber(activeDot.leads)}</p>
        </Panel>
      </div>
    </div>
  );
}

function DistributionRing({
  items,
  activeId,
  onHover,
  onSelect,
}: {
  items: Array<{ id: string; label: string; percentage: number; count: number; color: string }>;
  activeId: string | null;
  onHover: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const segments = items.reduce<Array<{ id: string; color: string; dashArray: string; offset: number }>>((accumulator, item, index) => {
    const previousOffset = index === 0 ? 0 : accumulator[index - 1].offset - ((items[index - 1].percentage / 100) * circumference);
    const dash = (item.percentage / 100) * circumference;
    accumulator.push({
      id: item.id,
      color: item.color,
      dashArray: `${dash} ${circumference - dash}`,
      offset: previousOffset,
    });
    return accumulator;
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <svg viewBox="0 0 220 220" className="mx-auto h-52 w-52">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="rgba(226,232,240,0.75)" strokeWidth="22" />
        {items.map((item) => {
          const segment = segments.find((entry) => entry.id === item.id);
          if (!segment) return null;
          return (
            <circle
              key={item.id}
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={activeId === item.id ? 26 : 22}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.offset}
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              className="cursor-pointer transition-all"
              onMouseEnter={() => onHover(item.id)}
              onClick={() => onSelect(item.id)}
            />
          );
        })}
        <text x="110" y="104" textAnchor="middle" className="fill-slate-400 text-[12px] font-semibold">
          结构占比
        </text>
        <text x="110" y="132" textAnchor="middle" className="fill-slate-950 text-[26px] font-black">
          {formatPercent(items.reduce((acc, item) => acc + item.percentage, 0), 0)}
        </text>
      </svg>

      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            onMouseEnter={() => onHover(item.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
              activeId === item.id
                ? 'border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                : 'border-white/70 bg-white/80 text-slate-700 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/40',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className={cn('text-xs', activeId === item.id ? 'text-white/70' : 'text-slate-400')}>{formatNumber(item.count)} 条记录</p>
              </div>
            </div>
            <span className="text-sm font-black">{formatPercent(item.percentage)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RankingRows({
  rows,
  activeId,
  onSelect,
}: {
  rows: Array<{ id: string; label: string; value: number; secondary: string; percent: number; tone: Tone }>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onSelect(row.id)}
          className={cn(
            'w-full rounded-2xl border p-4 text-left transition',
            activeId === row.id
              ? 'border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15'
              : 'border-white/70 bg-white/80 text-slate-800 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/35',
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{row.label}</p>
              <p className={cn('mt-1 text-xs', activeId === row.id ? 'text-white/70' : 'text-slate-400')}>{row.secondary}</p>
            </div>
            <p className="text-lg font-black">{formatNumber(row.value)}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <ProgressMeter value={row.percent} tone={row.tone} />
            <span className={cn('text-xs font-semibold', activeId === row.id ? 'text-white/80' : 'text-slate-500')}>{formatPercent(row.percent)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function DrilldownPanel({ insight }: { insight: DrilldownInsight | null }) {
  if (!insight) {
    return (
      <Panel className="h-full p-6">
        <EmptyState title="暂无下钻对象" description="点击图表中的任意维度，即可查看该指标的详细解析。" />
      </Panel>
    );
  }

  const toneClass: Record<Tone, string> = {
    blue: 'from-blue-500/18 to-cyan-400/8 text-blue-700',
    emerald: 'from-emerald-500/18 to-teal-400/8 text-emerald-700',
    amber: 'from-amber-500/18 to-orange-400/8 text-amber-700',
    rose: 'from-rose-500/18 to-pink-400/8 text-rose-700',
    violet: 'from-violet-500/18 to-fuchsia-400/8 text-violet-700',
    cyan: 'from-cyan-500/18 to-sky-400/8 text-cyan-700',
  };

  return (
    <Panel className="h-full p-6">
      <div className={cn('rounded-[1.5rem] bg-gradient-to-br p-5', toneClass[insight.tone])}>
        <StatusPill tone={insight.tone}>维度下钻</StatusPill>
        <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{insight.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{insight.subtitle}</p>
      </div>

      <div className="mt-5 space-y-3">
        {insight.metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <span className="text-sm font-medium text-slate-500">{metric.label}</span>
            <span className="text-base font-black text-slate-950">{metric.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">洞察摘要</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{insight.summary}</p>
      </div>
    </Panel>
  );
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AnalyticsTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('7d');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [intents, setIntents] = useState<IntentData[]>([]);
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [afterSale, setAfterSale] = useState<AfterSaleData[]>([]);
  const [aiAcc, setAiAcc] = useState<AiAccuracy | null>(null);
  const [agents, setAgents] = useState<AgentPerf[]>([]);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('totalMessages');
  const [trendHoverIndex, setTrendHoverIndex] = useState(0);
  const [distributionHoverId, setDistributionHoverId] = useState<string | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<DrilldownInsight | null>(null);

  const days = RANGE_TO_DAYS[range];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [dashboardResponse, trendResponse, intentResponse, platformResponse, afterSaleResponse, accuracyResponse, agentResponse] =
          await Promise.all([
            apiGet<DashboardResponse>(`/api/admin/analytics/dashboard?days=${days}`),
            apiGet<TrendPoint[]>(`/api/admin/analytics/trend?days=${days}`),
            apiGet<IntentData[]>(`/api/admin/analytics/intent-distribution?days=${days}`),
            apiGet<PlatformData[]>(`/api/admin/analytics/platform-comparison?days=${days}`),
            apiGet<AfterSaleData[]>(`/api/admin/analytics/after-sale?days=${days}`),
            apiGet<AiAccuracy>(`/api/admin/analytics/ai-accuracy?days=${days}`),
            apiGet<AgentPerf[]>(`/api/admin/analytics/agent-performance?days=${days}`),
          ]);

        if (cancelled) return;
        setDashboard(dashboardResponse);
        setTrend(trendResponse);
        setIntents(intentResponse);
        setPlatforms(platformResponse);
        setAfterSale(afterSaleResponse);
        setAiAcc(accuracyResponse);
        setAgents(agentResponse);
        setTrendHoverIndex(Math.max(trendResponse.length - 1, 0));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载分析数据失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [days, refreshSeed]);

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case 'product_inquiry':
        return t.conversations.intentProductInquiry;
      case 'price_inquiry':
        return t.conversations.intentPriceInquiry;
      case 'logistics_inquiry':
        return t.conversations.intentLogisticsInquiry;
      case 'after_sale':
        return t.conversations.intentAfterSale;
      case 'purchase_intent':
        return t.conversations.intentPurchaseIntent;
      case 'transfer_human':
        return t.conversations.intentTransferHuman;
      case 'general_inquiry':
        return t.conversations.intentGeneralInquiry;
      default:
        return intent.replaceAll('_', ' ');
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'h5':
        return t.conversations.channelH5;
      case 'embed':
        return t.conversations.channelEmbed;
      case 'douyin_miniapp':
        return t.conversations.channelDouyinMiniapp;
      case 'wechat_miniapp':
        return t.conversations.channelWechatMiniapp;
      case 'miniapp':
        return t.conversations.channelMiniapp;
      case 'web':
        return t.conversations.channelWeb;
      case 'api':
        return t.conversations.channelApi;
      default:
        return channel;
    }
  };

  const afterSaleLabel = (type: string) => {
    switch (type) {
      case '退款':
        return t.analytics.refund;
      case '换货':
        return t.analytics.exchange;
      case '质量问题':
        return t.analytics.qualityIssue;
      case '物流问题':
        return t.analytics.logisticsIssue;
      default:
        return t.analytics.otherAfterSale;
    }
  };

  const createIntentInsight = (item: IntentData): DrilldownInsight => ({
    id: `intent:${item.intent}`,
    title: getIntentLabel(item.intent),
    subtitle: '该意图表示当前周期内用户最集中的咨询主题，适合与知识库覆盖率、转人工策略联动分析。',
    tone: 'blue',
    metrics: [
      { label: '意图占比', value: formatPercent(item.percentage) },
      { label: '会话数量', value: formatNumber(item.count) },
      { label: '建议动作', value: item.intent === 'after_sale' ? '优先补齐售后 SOP' : '强化对应知识答案' },
    ],
    summary: `当前周期内，${getIntentLabel(item.intent)}占全部有意图会话的 ${formatPercent(item.percentage)}，说明这类需求对整体咨询结构影响显著，应优先优化相关答案覆盖和转化脚本。`,
  });

  const createPlatformInsight = (item: PlatformData): DrilldownInsight => ({
    id: `platform:${item.channel}`,
    title: getChannelLabel(item.channel),
    subtitle: '渠道维度适合同时观察流量体量、单会话深度和最终关闭效率，用于优化投放与接待策略。',
    tone: 'cyan',
    metrics: [
      { label: '渠道份额', value: formatPercent(item.share) },
      { label: '消息总量', value: formatNumber(item.messages) },
      { label: '平均消息数', value: item.avgMessages.toFixed(1) },
      { label: '解决率', value: formatPercent(item.resolutionRate) },
    ],
    summary: `${getChannelLabel(item.channel)}贡献了 ${formatPercent(item.share)} 的会话量，平均每个会话 ${item.avgMessages.toFixed(1)} 条消息，说明该渠道的沟通深度与处理效率都值得重点关注。`,
  });

  const createAfterSaleInsight = (item: AfterSaleData): DrilldownInsight => ({
    id: `after-sale:${item.type}`,
    title: afterSaleLabel(item.type),
    subtitle: '售后分类有助于定位高风险问题来源，通常与物流履约、商品质检和退款流程相关。',
    tone: 'rose',
    metrics: [
      { label: '分类占比', value: formatPercent(item.percentage) },
      { label: '问题数量', value: formatNumber(item.count) },
      { label: '优先级', value: item.percentage >= 30 ? '高' : item.percentage >= 15 ? '中' : '常规' },
    ],
    summary: `${afterSaleLabel(item.type)}在当前售后问题中占比 ${formatPercent(item.percentage)}，建议结合对应工单与知识库条目，缩短这类问题的闭环响应时间。`,
  });

  const createAgentInsight = (item: AgentPerf): DrilldownInsight => ({
    id: `agent:${item.agentId}`,
    title: `客服 ${item.agentId.slice(0, 8)}`,
    subtitle: '人工绩效维度用于观察待人工承接压力与已关闭处理效率，适合做班次与接单策略优化。',
    tone: 'emerald',
    metrics: [
      { label: '承接会话', value: formatNumber(item.conversations) },
      { label: '已解决', value: formatNumber(item.resolved) },
      { label: '待人工', value: formatNumber(item.pending) },
      { label: '解决率', value: formatPercent(item.resolutionRate) },
    ],
    summary: `该客服当前周期共承接 ${formatNumber(item.conversations)} 个会话，其中 ${formatNumber(item.resolved)} 个已闭环。若待人工数量持续偏高，说明需要调整分配节奏或补充辅助脚本。`,
  });

  const fallbackInsight: DrilldownInsight | null = (() => {
    if (tab === 'performance' && agents[0]) return createAgentInsight(agents[0]);
    if (tab === 'platform' && platforms[0]) return createPlatformInsight(platforms[0]);
    if (tab === 'aftersale' && afterSale[0]) return createAfterSaleInsight(afterSale[0]);
    if (tab === 'intent' && intents[0]) return createIntentInsight(intents[0]);
    if (platforms[0]) return createPlatformInsight(platforms[0]);
    if (intents[0]) return createIntentInsight(intents[0]);
    if (afterSale[0]) return createAfterSaleInsight(afterSale[0]);
    if (agents[0]) return createAgentInsight(agents[0]);
    return null;
  })();

  const activeInsight = (() => {
    if (!selectedInsight) return fallbackInsight;
    const tabPrefixMap: Partial<Record<AnalyticsTab, string>> = {
      intent: 'intent:',
      platform: 'platform:',
      aftersale: 'after-sale:',
      performance: 'agent:',
    };
    const expectedPrefix = tabPrefixMap[tab];
    if (!expectedPrefix) return selectedInsight ?? fallbackInsight;
    return selectedInsight.id.startsWith(expectedPrefix) ? selectedInsight : fallbackInsight;
  })();

  const kpiCards = (() => {
    if (!dashboard) return [];
    return [
      {
        label: t.analytics.conversations,
        value: formatNumber(dashboard.summary.conversations.current),
        delta: dashboard.summary.conversations.delta,
        helper: `今日新增 ${formatNumber(dashboard.summary.conversations.today)} / 累计 ${formatNumber(dashboard.summary.conversations.total)}`,
        tone: 'blue' as Tone,
        icon: <Users className="h-5 w-5" />,
      },
      {
        label: t.analytics.messages,
        value: formatNumber(dashboard.summary.messages.current),
        delta: dashboard.summary.messages.delta,
        helper: `今日新增 ${formatNumber(dashboard.summary.messages.today)} / 均值 ${dashboard.summary.avgMessagesPerConversation.toFixed(1)} 条/会话`,
        tone: 'cyan' as Tone,
        icon: <MessageSquareText className="h-5 w-5" />,
      },
      {
        label: '线索沉淀',
        value: formatNumber(dashboard.summary.leads.current),
        delta: dashboard.summary.leads.delta,
        helper: `今日新增 ${formatNumber(dashboard.summary.leads.today)} / 留资率 ${formatPercent(dashboard.summary.leadCaptureRate)}`,
        tone: 'amber' as Tone,
        icon: <Target className="h-5 w-5" />,
      },
      {
        label: t.analytics.aiAccuracy,
        value: formatPercent(dashboard.summary.aiAccuracyRate),
        delta: dashboard.summary.accuracyDelta,
        helper: `修正率 ${formatPercent(dashboard.summary.correctionRate)} / AI 回复 ${formatNumber(dashboard.summary.aiReplies.current)}`,
        tone: 'emerald' as Tone,
        icon: <Bot className="h-5 w-5" />,
      },
    ];
  })();

  const trendSummary = trend[trendHoverIndex] ?? trend[trend.length - 1];

  const intentRingData = intents.slice(0, 5).map((item, index) => ({
    id: item.intent,
    label: getIntentLabel(item.intent),
    percentage: item.percentage,
    count: item.count,
    color: ['#4467f5', '#13b5c8', '#8b5cf6', '#f59e0b', '#fb7185'][index % 5],
  }));

  const platformRows = platforms.map((item, index) => ({
    id: item.channel,
    label: getChannelLabel(item.channel),
    value: item.conversations,
    secondary: `消息 ${formatNumber(item.messages)} · 均值 ${item.avgMessages.toFixed(1)} · 解决率 ${formatPercent(item.resolutionRate)}`,
    percent: Math.min(100, item.share),
    tone: (['blue', 'cyan', 'violet', 'amber', 'emerald'][index % 5] as Tone),
  }));

  const agentRows = agents.map((item, index) => ({
    id: item.agentId,
    label: `客服 ${item.agentId.slice(0, 8)}`,
    value: item.conversations,
    secondary: `已解决 ${formatNumber(item.resolved)} · 待人工 ${formatNumber(item.pending)} · 解决率 ${formatPercent(item.resolutionRate)}`,
    percent: item.resolutionRate,
    tone: (['emerald', 'cyan', 'blue', 'amber', 'violet'][index % 5] as Tone),
  }));

  const tabs = [
    { id: 'overview', label: t.analytics.tabOverview },
    { id: 'trend', label: t.analytics.tabTrend },
    { id: 'intent', label: t.analytics.tabIntent },
    { id: 'platform', label: t.analytics.tabPlatform },
    { id: 'aftersale', label: t.analytics.tabAfterSale },
    { id: 'accuracy', label: t.analytics.tabAiAccuracy },
    { id: 'performance', label: t.analytics.tabPerformance },
  ] as const;

  useEffect(() => {
    if (selectedInsight) return;
    if (fallbackInsight) setSelectedInsight(fallbackInsight);
  }, [fallbackInsight, selectedInsight]);

  if (loading && !dashboard) {
    return <LoadingState label={t.common.loading} />;
  }

  if (error && !dashboard) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Insights"
          title={t.analytics.title}
          description={t.analytics.subtitle}
          actions={
            <ActionButton variant="secondary" onClick={() => setRefreshSeed((value) => value + 1)}>
              重新加载
            </ActionButton>
          }
        />
        <Panel className="p-6">
          <EmptyState title="分析数据加载失败" description={error} />
        </Panel>
      </PageShell>
    );
  }

  const renderOverviewSection = () => (
    <>
      <div className="grid gap-4 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]">
        <Panel className="p-6">
          <SectionTitle
            title="经营脉冲"
            description={`覆盖最近 ${days} 天消息、会话与线索趋势，悬浮即可查看单日拆解。`}
            actions={
              <div className="flex gap-2">
                {(['totalMessages', 'conversations', 'leads'] as TrendMetric[]).map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => setTrendMetric(metric)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      trendMetric === metric
                        ? 'border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                        : 'border-white/70 bg-white/70 text-slate-600 hover:border-blue-200 hover:text-blue-700',
                    )}
                  >
                    {metric === 'totalMessages' ? '消息量' : metric === 'conversations' ? '会话量' : '线索量'}
                  </button>
                ))}
              </div>
            }
          />

          {trend.length > 0 ? (
            <TrendChart
              data={trend}
              activeMetric={trendMetric}
              activeIndex={trendHoverIndex}
              onHover={setTrendHoverIndex}
              onLeave={() => setTrendHoverIndex(Math.max(trend.length - 1, 0))}
            />
          ) : (
            <EmptyState title={t.common.noData} description="当前周期没有可展示的趋势数据。" />
          )}
        </Panel>

        <DrilldownPanel insight={activeInsight} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel className="p-6">
          <SectionTitle title="结构分布" description="意图与售后问题采用统一色系和进阶信息层级表达，便于快速看清结构重心。" />
          {intentRingData.length > 0 ? (
            <DistributionRing
              items={intentRingData}
              activeId={distributionHoverId ?? intentRingData[0]?.id ?? null}
              onHover={setDistributionHoverId}
              onSelect={(id) => {
                setDistributionHoverId(id);
                const selected = intents.find((item) => item.intent === id);
                if (selected) setSelectedInsight(createIntentInsight(selected));
              }}
            />
          ) : (
            <EmptyState title={t.common.noData} description="暂无意图分布数据。" />
          )}

          <div className="mt-6 space-y-3">
            {afterSale.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedInsight(createAfterSaleInsight(item))}
                className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 text-left transition hover:border-rose-200 hover:shadow-lg hover:shadow-slate-200/35"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{afterSaleLabel(item.type)}</p>
                  <p className="mt-1 text-xs text-slate-400">售后问题分层</p>
                </div>
                <div className="flex min-w-[150px] items-center gap-3">
                  <div className="flex-1">
                    <ProgressMeter value={item.percentage} tone="rose" />
                  </div>
                  <span className="text-sm font-black text-slate-900">{formatPercent(item.percentage)}</span>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <SectionTitle title={t.analytics.platformComparison} description="渠道对比同时显示份额、消息深度与解决率，方便识别高价值入口。" />
          {platformRows.length > 0 ? (
            <RankingRows
              rows={platformRows}
              activeId={selectedInsight?.id?.startsWith('platform:') ? selectedInsight.id.replace('platform:', '') : null}
              onSelect={(id) => {
                const selected = platforms.find((item) => item.channel === id);
                if (selected) setSelectedInsight(createPlatformInsight(selected));
              }}
            />
          ) : (
            <EmptyState title={t.common.noData} description="暂无平台表现数据。" />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel className="p-6">
          <SectionTitle title="AI 质量中心" description="把 AI 产出量、修正率与准确率放在同一层级，便于快速判断自动化质量。" />
          {aiAcc ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Panel className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t.analytics.totalReplies}</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{formatNumber(aiAcc.totalReplies)}</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t.analytics.correctedReplies}</p>
                  <p className="mt-3 text-2xl font-black text-amber-600">{formatNumber(aiAcc.correctedReplies)}</p>
                </Panel>
                <Panel className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t.analytics.accuracyRate}</p>
                  <p className="mt-3 text-2xl font-black text-emerald-600">{formatPercent(aiAcc.accuracyRate)}</p>
                </Panel>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">修正率</span>
                    <span className="text-lg font-black text-rose-600">{formatPercent(aiAcc.correctionRate)}</span>
                  </div>
                  <div className="mt-4">
                    <ProgressMeter value={aiAcc.correctionRate} tone="rose" />
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600">待解决问题</span>
                    <span className="text-lg font-black text-slate-950">{formatNumber(dashboard?.summary.unresolvedQuestions ?? 0)}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    当前仍有 {formatNumber(dashboard?.summary.unresolvedQuestions ?? 0)} 条未解决问题待补知识，适合作为下个迭代的知识库优化输入。
                  </p>
                </div>
              </div>
            </>
          ) : (
            <EmptyState title={t.common.noData} description="暂无 AI 质量分析数据。" />
          )}
        </Panel>

        <Panel className="p-6">
          <SectionTitle title={t.analytics.agentPerformance} description="以排行视角观察人工接待承压点，并支持点击进入单客服明细。" />
          {agentRows.length > 0 ? (
            <RankingRows
              rows={agentRows}
              activeId={selectedInsight?.id?.startsWith('agent:') ? selectedInsight.id.replace('agent:', '') : null}
              onSelect={(id) => {
                const selected = agents.find((item) => item.agentId === id);
                if (selected) setSelectedInsight(createAgentInsight(selected));
              }}
            />
          ) : (
            <EmptyState title={t.common.noData} description="当前周期暂无人工绩效数据。" />
          )}
        </Panel>
      </div>
    </>
  );

  return (
    <PageShell className="space-y-8">
      <PageHeader
        eyebrow="Insights"
        title={t.analytics.title}
        description={t.analytics.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(['7d', '30d', '90d'] as RangeKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  range === item
                    ? 'border-slate-900 bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                    : 'border-white/70 bg-white/80 text-slate-600 hover:border-blue-200 hover:text-blue-700',
                )}
              >
                {item === '7d' ? t.analytics.last7Days : item === '30d' ? t.analytics.last30Days : t.analytics.last90Days}
              </button>
            ))}
            <ActionButton variant="secondary" onClick={() => setRefreshSeed((value) => value + 1)}>
              <RefreshCcw className="h-4 w-4" />
              刷新
            </ActionButton>
          </div>
        }
      />

      <Panel className="p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'rounded-2xl px-4 py-2 text-sm font-semibold transition',
                tab === item.id
                  ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                  : 'bg-white/70 text-slate-600 hover:bg-white hover:text-slate-950',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Panel>

      {error ? (
        <Panel className="border-amber-100 bg-amber-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">部分分析数据刷新失败</p>
              <p className="mt-1 text-sm text-amber-700">{error}</p>
            </div>
            <ActionButton variant="secondary" onClick={() => setRefreshSeed((value) => value + 1)}>
              重试
            </ActionButton>
          </div>
        </Panel>
      ) : null}

      {tab === 'overview' && renderOverviewSection()}

      {tab === 'trend' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]">
          <Panel className="p-6">
            <SectionTitle title={t.analytics.trend} description="趋势页聚焦周期波动与日内结构，适合快速识别峰值和转化节点。" />
            {trend.length > 0 ? (
              <TrendChart
                data={trend}
                activeMetric={trendMetric}
                activeIndex={trendHoverIndex}
                onHover={(index) => {
                  setTrendHoverIndex(index);
                }}
                onLeave={() => setTrendHoverIndex(Math.max(trend.length - 1, 0))}
              />
            ) : (
              <EmptyState title={t.common.noData} description="暂无趋势数据。" />
            )}
          </Panel>

          <Panel className="p-6">
            <SectionTitle title="趋势解读" description="当前光标所在日期的多维指标拆解。" />
            {trendSummary ? (
              <div className="space-y-3">
                <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">观测日期</p>
                  <p className="mt-3 text-2xl font-black text-slate-950">{formatDateLabel(trendSummary.date)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    当日共完成 {formatNumber(trendSummary.totalMessages)} 条消息往来，其中 AI 回复 {formatNumber(trendSummary.assistantMessages)} 条。
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Panel className="p-4">
                    <p className="text-xs text-slate-400">会话量</p>
                    <p className="mt-2 text-xl font-black text-slate-950">{formatNumber(trendSummary.conversations)}</p>
                  </Panel>
                  <Panel className="p-4">
                    <p className="text-xs text-slate-400">线索量</p>
                    <p className="mt-2 text-xl font-black text-slate-950">{formatNumber(trendSummary.leads)}</p>
                  </Panel>
                  <Panel className="p-4">
                    <p className="text-xs text-slate-400">AI 修正数</p>
                    <p className="mt-2 text-xl font-black text-amber-600">{formatNumber(trendSummary.correctedReplies)}</p>
                  </Panel>
                  <Panel className="p-4">
                    <p className="text-xs text-slate-400">用户消息</p>
                    <p className="mt-2 text-xl font-black text-slate-950">{formatNumber(trendSummary.userMessages)}</p>
                  </Panel>
                </div>
              </div>
            ) : (
              <EmptyState title={t.common.noData} description="暂无可用于解读的日期数据。" />
            )}
          </Panel>
        </div>
      )}

      {tab === 'intent' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <Panel className="p-6">
            <SectionTitle title={t.analytics.intentDistribution} description="点击任意意图查看下钻详情，辅助识别客服知识覆盖优先级。" />
            {intentRingData.length > 0 ? (
              <DistributionRing
                items={intentRingData}
                activeId={distributionHoverId ?? intentRingData[0]?.id ?? null}
                onHover={setDistributionHoverId}
                onSelect={(id) => {
                  const selected = intents.find((item) => item.intent === id);
                  if (selected) setSelectedInsight(createIntentInsight(selected));
                }}
              />
            ) : (
              <EmptyState title={t.common.noData} description="暂无意图分布数据。" />
            )}
          </Panel>
          <DrilldownPanel insight={activeInsight} />
        </div>
      )}

      {tab === 'platform' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <Panel className="p-6">
            <SectionTitle title={t.analytics.platformComparison} description="平台页侧重识别主战场渠道与高深度会话入口。" />
            {platformRows.length > 0 ? (
              <RankingRows
                rows={platformRows}
                activeId={selectedInsight?.id?.startsWith('platform:') ? selectedInsight.id.replace('platform:', '') : null}
                onSelect={(id) => {
                  const selected = platforms.find((item) => item.channel === id);
                  if (selected) setSelectedInsight(createPlatformInsight(selected));
                }}
              />
            ) : (
              <EmptyState title={t.common.noData} description="暂无平台表现数据。" />
            )}
          </Panel>
          <DrilldownPanel insight={activeInsight} />
        </div>
      )}

      {tab === 'aftersale' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <Panel className="p-6">
            <SectionTitle title={t.analytics.afterSaleAnalysis} description="售后问题采用标准化分类展示，方便识别高风险主题和优先修复项。" />
            <div className="space-y-3">
              {afterSale.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelectedInsight(createAfterSaleInsight(item))}
                  className="w-full rounded-2xl border border-white/70 bg-white/80 p-4 text-left transition hover:border-rose-200 hover:shadow-lg hover:shadow-slate-200/35"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{afterSaleLabel(item.type)}</p>
                      <p className="mt-1 text-xs text-slate-400">问题数量 {formatNumber(item.count)}</p>
                    </div>
                    <span className="text-lg font-black text-slate-950">{formatPercent(item.percentage)}</span>
                  </div>
                  <div className="mt-4">
                    <ProgressMeter value={item.percentage} tone="rose" />
                  </div>
                </button>
              ))}
            </div>
          </Panel>
          <DrilldownPanel insight={activeInsight} />
        </div>
      )}

      {tab === 'accuracy' && (
        <Panel className="p-6">
          <SectionTitle title={t.analytics.aiAccuracy} description="AI 质量页将准确率、修正率与未解决问题统一纳入同一视角。" />
          {aiAcc ? (
            <div className="grid gap-5 lg:grid-cols-4">
              <SummaryCard
                label={t.analytics.totalReplies}
                value={formatNumber(aiAcc.totalReplies)}
                delta={dashboard?.summary.aiReplies.delta ?? 0}
                helper={`当前周期 AI 回复 ${formatNumber(dashboard?.summary.aiReplies.current ?? 0)} 条`}
                tone="cyan"
                icon={<Sparkles className="h-5 w-5" />}
              />
              <SummaryCard
                label={t.analytics.correctedReplies}
                value={formatNumber(aiAcc.correctedReplies)}
                delta={dashboard ? dashboard.summary.correctionRate : 0}
                helper={`修正率 ${formatPercent(aiAcc.correctionRate)}`}
                tone="amber"
                icon={<Gauge className="h-5 w-5" />}
              />
              <SummaryCard
                label={t.analytics.accuracyRate}
                value={formatPercent(aiAcc.accuracyRate)}
                delta={dashboard?.summary.accuracyDelta ?? 0}
                helper="准确率越高，说明自动回复越稳定。"
                tone="emerald"
                icon={<Bot className="h-5 w-5" />}
              />
              <SummaryCard
                label="未解决问题"
                value={formatNumber(dashboard?.summary.unresolvedQuestions ?? 0)}
                delta={0}
                helper={`知识库条目 ${formatNumber(dashboard?.summary.products ?? 0)} 个商品 / 问题待补充`}
                tone="rose"
                icon={<Layers3 className="h-5 w-5" />}
              />
            </div>
          ) : (
            <EmptyState title={t.common.noData} description="暂无 AI 质量数据。" />
          )}
        </Panel>
      )}

      {tab === 'performance' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <Panel className="p-6">
            <SectionTitle title={t.analytics.agentPerformance} description="客服绩效页聚焦承接量、待人工压力与闭环效率。" />
            {agentRows.length > 0 ? (
              <RankingRows
                rows={agentRows}
                activeId={selectedInsight?.id?.startsWith('agent:') ? selectedInsight.id.replace('agent:', '') : null}
                onSelect={(id) => {
                  const selected = agents.find((item) => item.agentId === id);
                  if (selected) setSelectedInsight(createAgentInsight(selected));
                }}
              />
            ) : (
              <EmptyState title={t.common.noData} description="暂无人工绩效数据。" />
            )}
          </Panel>
          <DrilldownPanel insight={activeInsight} />
        </div>
      )}

      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="violet">{dashboard?.range.days ?? days} 天分析窗口</StatusPill>
          <StatusPill tone="blue">响应式卡片与图表布局</StatusPill>
          <StatusPill tone="emerald">支持悬浮提示 / 维度切换 / 点击下钻</StatusPill>
          <StatusPill tone="amber">统一产品色板与字体层级</StatusPill>
        </div>
      </Panel>
    </PageShell>
  );
}
