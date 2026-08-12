import { useState } from 'react'
import AccessGate from './components/accessgate'
import FollowupCard from './components/followupcard'
import ExperienceLibrary from './components/experiencelibrary'
import Review from './components/review'
import Settings from './components/settings'
import BottomNav from './components/bottomnav'
import { getAccessCode } from './services/accessCode'

type TabId = 'followup' | 'review' | 'experience' | 'settings'

export default function App() {
  const [unlocked, setUnlocked] = useState(() => Boolean(getAccessCode()))
  const [activeTab, setActiveTab] = useState<TabId>('followup')


  if (!unlocked) {
    return <AccessGate onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div className="mobile-container flex flex-col">
      <div className="flex items-center justify-center bg-white px-4 pb-1 pt-2">
        <span className="text-sm font-semibold text-gray-900">门店客户跟进助手</span>
      </div>

      <main className="hide-scrollbar flex-1 overflow-y-auto pb-20">
        <div className={activeTab === 'followup' ? 'block' : 'hidden'}><FollowupCard /></div>
        <div className={activeTab === 'review' ? 'block' : 'hidden'}><Review /></div>
        <div className={activeTab === 'experience' ? 'block' : 'hidden'}><ExperienceLibrary /></div>
        <div className={activeTab === 'settings' ? 'block' : 'hidden'}><Settings /></div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
