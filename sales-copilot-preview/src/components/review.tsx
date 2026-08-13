import { useState } from 'react'
import { ChevronRight, Clock, Copy, Phone, Sparkles } from 'lucide-react'

const todayFollowups = [
  {
    id: 'wangjie',
    name: '王姐',
    title: '今天 15:30 联系王姐',
    project: '龙沙区旧窗更换',
    tag: '高意向',
    tagClass: 'border-red-100 bg-red-50 text-red-500',
    why: '她最在意隔音和冬天漏风，但目前认为报价偏高。上次有效动作是解释配置差异。',
    how: '这次不要直接降价，先发同小区或相似户型案例，再约免费量尺。',
    wechat: '王姐，我把和您家情况接近的旧窗更换案例整理了一下，您先看隔音和保温效果。价格咱不急着定，我先帮您把配置差异和量尺后预算范围说清楚，您跟家里人商量也更方便。',
  },
  {
    id: 'lige',
    name: '李哥',
    title: '今天 18:00 前跟李哥',
    project: '建华区全屋定制',
    tag: '比价中',
    tagClass: 'border-orange-100 bg-orange-50 text-orange-600',
    why: '他拿别家低价做对比，但还没有看清板材、封边、五金和安装的差异。',
    how: '先发配置拆解表，帮他把低价里没包含的项目对齐，再问入住时间。',
    wechat: '李哥，我按柜体、板材、封边、五金和安装把配置拆开给您对比一下。这样您看别家报价时也能知道是不是同一套东西，后面决定会更稳。',
  },
  {
    id: 'zhangge',
    name: '张哥',
    title: '明早提醒张哥量尺',
    project: '铁锋区装修局改',
    tag: '待确认',
    tagClass: 'border-blue-100 bg-blue-50 text-primary-600',
    why: '他主要担心工期拖延，昨天已接受先看施工节点表。',
    how: '不要先催定金，先确认可量尺时间，再发节点安排。',
    wechat: '张哥，我先不催您定，咱把量尺时间和施工节点排清楚。您看明天上午或下午哪个时间方便，我到时候按现场情况给您列一版不耽误入住的安排。',
  },
]

export default function Review() {
  const [copiedId, setCopiedId] = useState('')

  async function copyWechat(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(''), 1400)
  }

  return (
    <div className="min-h-full space-y-4 bg-surface px-4 pb-4 pt-3">
      <header className="rounded-lg bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold text-primary-500">今日跟进</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900">今天该跟谁</h1>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SummaryItem label="该跟" value="3" unit="人" />
          <SummaryItem label="高意向" value="1" unit="人" tone="red" />
          <SummaryItem label="已约动作" value="2" unit="个" tone="green" />
        </div>
      </header>

      <section className="space-y-3">
        {todayFollowups.map((item) => (
          <article key={item.id} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary-600">
                    {item.name[0]}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-gray-900">{item.title}</h2>
                    <p className="mt-0.5 truncate text-[11px] text-gray-400">{item.project}</p>
                  </div>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${item.tagClass}`}>{item.tag}</span>
            </div>

            <InfoLine icon={<Clock size={13} />} label="为什么跟" text={item.why} />
            <InfoLine icon={<Sparkles size={13} />} label="这次怎么跟" text={item.how} highlight />

            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-700">微信建议</span>
                <button
                  type="button"
                  onClick={() => copyWechat(item.id, item.wechat)}
                  className="flex min-h-7 items-center gap-1 rounded-lg bg-white px-2 text-[11px] font-semibold text-primary-600"
                >
                  <Copy size={12} />
                  {copiedId === item.id ? '已复制' : '复制'}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-gray-700">{item.wechat}</p>
            </div>

            <button className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-primary-500 transition-colors hover:bg-blue-50">
              打开客户上下文
              <ChevronRight size={14} />
            </button>
          </article>
        ))}
      </section>

      <div className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50/60 px-3 py-2 text-xs text-primary-500">
        <Phone size={13} />
        <span>跟进完成后，下一次接待会继续沉淀到客户上下文里。</span>
      </div>
    </div>
  )
}

function SummaryItem({ label, value, unit, tone = 'blue' }: { label: string; value: string; unit: string; tone?: 'blue' | 'red' | 'green' }) {
  const toneClass = {
    blue: 'text-primary-600 bg-blue-50',
    red: 'text-red-500 bg-red-50',
    green: 'text-emerald-600 bg-emerald-50',
  }[tone]

  return (
    <div className={`rounded-lg px-2 py-2 text-center ${toneClass}`}>
      <p className="text-[10px] font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-lg font-bold leading-none">{value}<span className="ml-0.5 text-[10px] font-normal">{unit}</span></p>
    </div>
  )
}

function InfoLine({ icon, label, text, highlight = false }: { icon: React.ReactNode; label: string; text: string; highlight?: boolean }) {
  return (
    <div className={`mt-2 rounded-lg px-3 py-2 ${highlight ? 'bg-emerald-50/70' : 'bg-white'}`}>
      <p className={`mb-1 flex items-center gap-1 text-xs font-bold ${highlight ? 'text-emerald-700' : 'text-gray-700'}`}>
        {icon}
        {label}
      </p>
      <p className="text-xs leading-relaxed text-gray-600">{text}</p>
    </div>
  )
}
