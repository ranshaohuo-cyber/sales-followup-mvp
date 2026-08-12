import { useState } from 'react'
import { CheckCircle2, ChevronRight, Eye, Plus, Quote, Search, Sparkles, Target, Zap } from 'lucide-react'
import { experienceData } from '../data/mock'

type FilterTab = 'all' | 'problem' | 'trust' | 'advantage'

export default function ExperienceLibrary() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchText, setSearchText] = useState('')

  const filters: { id: FilterTab; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'problem', label: '客户顾虑' },
    { id: 'trust', label: '信任售后' },
    { id: 'advantage', label: '配置对比' },
  ]

  return (
    <div className="min-h-full space-y-4 bg-surface px-4 pb-4 pt-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search size={16} className="mr-2 shrink-0 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="搜索漏风、比价、板材、量尺..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300"
          />
        </div>
        <button className="flex shrink-0 items-center gap-1 rounded-xl bg-primary-500 px-3 py-2 text-xs font-medium text-white">
          <Plus size={14} />
          录入话术
        </button>
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
        {experienceData.map((item) => (
          <article key={item.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-base font-bold leading-snug text-gray-900">{item.title}</h3>
              <div className="ml-2 flex shrink-0 flex-wrap justify-end gap-1">
                {item.tags.map((tag) => (
                  <span key={tag} className="whitespace-nowrap rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-500">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-2 flex items-start gap-2">
              <Target size={14} className="mt-0.5 shrink-0 text-blue-500" />
              <p className="text-xs leading-relaxed text-gray-600">
                <span className="font-semibold text-gray-700">成交目标：</span>
                {item.trustGoal}
              </p>
            </div>

            <div className="mb-2 flex items-start gap-2">
              <Zap size={14} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-xs font-medium leading-relaxed text-gray-800">
                <span className="text-accent">跟进动作：</span>{item.action}
              </p>
            </div>

            <div className="mb-3 flex items-start gap-2">
              <Quote size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <p className="text-sm italic leading-relaxed text-gray-600">{item.script}</p>
            </div>

            <div className="flex items-center justify-between border-t border-gray-50 pt-2">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Eye size={12} /> 调用 {item.callCount} 次
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-accent" /> 复盘有效{' '}
                  <span className="font-semibold text-accent">{item.effectiveness}%</span>
                </span>
              </div>
              <ChevronRight size={18} className="text-blue-500" />
            </div>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 py-2">
        <Sparkles size={14} className="text-primary-500" />
        <span className="text-xs text-primary-500">接待录音会沉淀可复用的本地话术</span>
      </div>
    </div>
  )
}
