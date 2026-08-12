import { ChevronRight, Clock, Phone, Sparkles } from 'lucide-react'
import { reviewData } from '../data/mock'

export default function Review() {
  const maxTrendValue = Math.max(...reviewData.efficiencyTrend.map((item) => item.value))

  return (
    <div className="min-h-full space-y-4 bg-surface px-4 pb-4 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <Phone size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400">今日接待</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {reviewData.todayCalls}<span className="ml-0.5 text-sm font-normal text-gray-400">次</span>
          </p>
        </div>
        <div className="rounded-xl border border-orange-50 bg-orange-50/30 p-3.5 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5">
            <Clock size={14} className="text-orange-400" />
            <span className="text-xs text-orange-500">待跟进</span>
          </div>
          <p className="text-2xl font-bold text-orange-500">
            {reviewData.pendingReviews}<span className="ml-0.5 text-sm font-normal">条</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50/50 px-3 py-2 text-xs text-primary-500">
        <Sparkles size={13} />
        <span>本周新增门店话术 <strong>{reviewData.newExperiences}</strong> 条</span>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            跟进有效率趋势
          </h3>
          <div className="flex overflow-hidden rounded border border-gray-200">
            <button className="bg-primary-500 px-2 py-0.5 text-[10px] text-white">周</button>
            <button className="px-2 py-0.5 text-[10px] text-gray-400">月</button>
          </div>
        </div>

        <div className="flex h-28 items-end justify-between gap-2 px-1">
          {reviewData.efficiencyTrend.map((item) => {
            const heightPercent = (item.value / maxTrendValue) * 100
            const isLast = item.day === '五'
            return (
              <div key={item.day} className="flex flex-1 flex-col items-center gap-1">
                <span className={`text-[10px] font-bold ${isLast ? 'text-primary-500' : 'text-gray-400'}`}>
                  {item.value}%
                </span>
                <div
                  className={`w-full rounded-t-md transition-all ${isLast ? 'bg-primary-500' : 'bg-blue-300'}`}
                  style={{ height: `${heightPercent}%`, minHeight: '8px' }}
                />
                <span className="text-[11px] text-gray-400">{item.day}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Clock size={15} className="text-amber-500" />
          待跟进客户
        </h3>

        <div className="space-y-3">
          {reviewData.conversations.map((conversation) => (
            <article key={conversation.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-sm font-bold text-primary-600">
                    {conversation.customerName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{conversation.customerName} · {conversation.company}</p>
                    <p className="text-[11px] text-gray-400">{conversation.time} · {conversation.duration}</p>
                  </div>
                </div>
                <span className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] ${
                  conversation.tagColor === 'red'
                    ? 'border border-red-100 bg-red-50 text-red-500'
                    : 'border border-orange-100 bg-orange-50 text-orange-600'
                }`}>
                  {conversation.tag}
                </span>
              </div>

              <div className="mb-2">
                <p className="text-xs leading-relaxed text-gray-600">
                  <span className="font-semibold text-amber-600">[客户顾虑]</span> {conversation.concern}
                </p>
              </div>

              <div className="mb-2">
                <p className="text-xs leading-relaxed text-gray-700">
                  <span className="font-semibold text-accent">[本次有效动作]</span> {conversation.effectiveAction}
                </p>
              </div>

              <div className="mb-3 rounded-lg bg-blue-50/50 p-2.5">
                <p className="flex items-start gap-1 text-xs leading-relaxed text-primary-700">
                  <Sparkles size={12} className="mt-0.5 shrink-0" />
                  <span><strong>[智能建议沉淀]</strong> {conversation.aiSuggestion}</span>
                </p>
              </div>

              <button className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-primary-500 transition-colors hover:bg-blue-50">
                生成跟进卡
                <ChevronRight size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
