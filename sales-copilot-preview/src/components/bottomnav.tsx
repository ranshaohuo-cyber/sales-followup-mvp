import { Lightbulb, MessageSquareText, Settings, TrendingUp } from 'lucide-react'

type TabId = 'followup' | 'review' | 'experience' | 'settings'

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'followup', label: '跟进卡', icon: <MessageSquareText size={20} /> },
  { id: 'review', label: '客户复盘', icon: <TrendingUp size={20} /> },
  { id: 'experience', label: '经验库', icon: <Lightbulb size={20} /> },
  { id: 'settings', label: '设置', icon: <Settings size={20} /> },
]

export default function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[390px] -translate-x-1/2 border-t border-gray-100 bg-white safe-bottom">
      <div className="flex h-14 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex min-w-[56px] flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`}
            >
              <span className={isActive ? 'rounded-xl bg-accent/10 p-1.5' : ''}>
                {tab.icon}
              </span>
              <span className={`whitespace-nowrap text-[10px] leading-none ${isActive ? 'font-semibold text-primary-500' : ''}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
