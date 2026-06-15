import Link from 'next/link';
import { ArrowRight, Bot, BrainCircuit, Headphones, LineChart, ShieldCheck, Sparkles } from 'lucide-react';

const capabilities = [
  { title: '知识库精准问答', desc: '基于企业资料、政策、价格和流程回答，减少口径不一致。', icon: BrainCircuit },
  { title: '线索自动沉淀', desc: '在会话中识别意向、联系方式和需求阶段，沉淀可跟进客户。', icon: LineChart },
  { title: '人工客服协同', desc: '复杂售后、投诉和高意向客户自动进入人工接管流程。', icon: Headphones },
];

export default function Home() {
  return (
    <main className="premium-page">
      <div className="premium-container relative py-8 sm:py-12">
        <div className="absolute right-10 top-14 hidden h-28 w-28 rounded-full bg-sky-200/70 blur-2xl lg:block" />
        <div className="absolute bottom-16 left-0 hidden h-40 w-40 rounded-full bg-amber-200/60 blur-3xl lg:block" />

        <nav className="premium-glass flex items-center justify-between rounded-full px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-900/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">AI 智能客服助手</p>
              <p className="text-xs text-slate-500">Enterprise Customer Service AI</p>
            </div>
          </div>
          <Link href="/admin/login" className="premium-button-secondary px-4 py-2 text-sm">
            进入后台
          </Link>
        </nav>

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="reveal">
            <div className="premium-kicker mb-6">
              <Sparkles className="h-4 w-4" />
              7×24 小时企业级 AI 客服中台
            </div>
            <h1 className="premium-title text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
              自动接待客户，
              <span className="block bg-gradient-to-r from-slate-950 via-blue-700 to-cyan-600 bg-clip-text text-transparent">
                沉淀每一次商机
              </span>
            </h1>
            <p className="premium-muted mt-6 max-w-2xl text-lg leading-8">
              面向企业真实业务场景，覆盖售前咨询、知识库问答、订单售后、线索跟进、
              人工接管与服务质量分析，让 AI 从“答疑工具”升级为客服与销售协同助手。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/admin/login" className="premium-button-primary px-6 py-3">
                管理后台登录
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/chat/demo" className="premium-button-secondary px-6 py-3">
                体验聊天窗口
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              {['知识库驱动', '意图识别', '线索沉淀', '工单闭环', '多渠道接入'].map((item) => (
                <span key={item} className="premium-chip">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="reveal premium-card premium-sheen relative p-5 [animation-delay:120ms]">
            <div className="rounded-[1.35rem] bg-slate-950 p-4 text-white shadow-2xl shadow-slate-900/30">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">实时客服工作台</p>
                  <p className="text-xs text-slate-400">AI routing cockpit</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  在线接待中
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['响应速度', '1.2s'],
                  ['今日线索', '36'],
                  ['自动解决率', '82%'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-black">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {[
                  ['客户咨询售后退款', 'AI 识别高风险，已转人工', 'bg-amber-400'],
                  ['询问套餐价格', '命中价格知识库，已回复', 'bg-cyan-400'],
                  ['留下手机号', '已生成高意向线索', 'bg-emerald-400'],
                ].map(([title, desc, dot]) => (
                  <div key={title} className="flex items-center gap-3 rounded-2xl bg-white/7 p-3 ring-1 ring-white/10">
                    <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {capabilities.map((item) => (
                <div key={item.title} className="rounded-3xl bg-white/70 p-4 ring-1 ring-white/70">
                  <item.icon className="h-5 w-5 text-slate-800" />
                  <p className="mt-3 text-sm font-bold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
