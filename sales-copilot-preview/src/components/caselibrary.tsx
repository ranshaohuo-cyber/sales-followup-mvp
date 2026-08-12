import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Search, Trophy } from 'lucide-react'
import { caseData } from '../data/mock'

type FilterTab = 'all' | 'concern' | 'action' | 'stage'

export default function CaseLibrary() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchText, setSearchText] = useState('')

  const filters: { id: FilterTab; label: string }[] = [
    { id: 'all', label: '全部行业' },
    { id: 'concern', label: '客户顾虑' },
    { id: 'action', label: '销冠动作' },
    { id: 'stage', label: '成交阶段' },
  ]

  return (
    <div className="min-h-full space-y-4 bg-surface px-4 pb-4 pt-3">
      <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2">
        <Search size={16} className="mr-2 shrink-0 text-gray-400" />
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜索行业、客户顾虑、销冠动作..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === filter.id
                ? 'bg-primary-500 text-white'
                : 'border border-gray-200 bg-white text-gray-500'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {caseData.map((item) => (
          <article
            key={item.id}
            className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm ${
              item.status === '已成交'
                ? 'border-l-4 border-l-accent'
                : item.status === '推进中'
                  ? 'border-l-4 border-l-orange-400'
                  : 'border-l-4 border-l-blue-400'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="pr-2 text-base font-bold leading-snug text-gray-900">{item.title}</h3>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] ${
                    tag === '已成交'
                      ? 'border border-accent/20 bg-accent-light/60 text-accent-dark'
                      : tag === '推进中'
                        ? 'border border-orange-100 bg-orange-50 text-orange-600'
                        : 'border border-gray-200 bg-gray-100 text-gray-500'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mb-2 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs leading-relaxed text-gray-700">
                <span className="font-semibold">客户顾虑：</span>{item.concern}
              </p>
            </div>

            <div className="mb-2 flex items-start gap-2">
              <Trophy size={14} className="mt-0.5 shrink-0 text-blue-500" />
              <p className="text-xs leading-relaxed text-gray-700">
                <span className="font-semibold">销冠动作：</span>{item.championAction}
              </p>
            </div>

            <div className="mb-3 rounded-lg bg-gray-50 p-2.5">
              <p className="text-xs italic leading-relaxed text-gray-600">{item.keyScript}</p>
            </div>

            {item.result ? (
              <div className="flex items-center justify-between border-t border-gray-50 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-accent">成交</span>
                  <span className="text-base font-bold text-gray-900">{item.result.amount}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span>调用 {item.result.callCount} 次</span>
                  <span className="flex items-center gap-0.5">
                    <CheckCircle2 size={11} className="text-accent" /> 复盘有效{' '}
                    <span className="font-semibold text-accent">{item.result.effectiveness}%</span>
                  </span>
                </div>
              </div>
            ) : item.period ? (
              <div className="border-t border-gray-50 pt-2">
                <p className="text-xs text-gray-500">{item.period}</p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                  <span>调用 {item.callCount} 次</span>
                  <span className="flex items-center gap-0.5">
                    <CheckCircle2 size={11} className="text-accent" /> 复盘有效{' '}
                    <span className="font-semibold text-accent">{item.effectiveness}%</span>
                  </span>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  )
}
