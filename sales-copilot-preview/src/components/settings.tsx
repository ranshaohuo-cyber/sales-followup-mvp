import { Bot, ClipboardList, Database, Headphones, LogOut, Package, Shield } from 'lucide-react'
import { settingsData } from '../data/mock'

const settingItems = [
  {
    icon: Headphones,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    title: '输入方式',
    desc: settingsData.device.deviceName,
    status: settingsData.device.connected ? '可用' : '未配置',
    statusColor: settingsData.device.connected ? 'text-accent' : 'text-gray-400',
  },
  {
    icon: Package,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    title: '行业话术配置',
    desc: `当前知识库：${settingsData.industry.current}`,
  },
  {
    icon: Bot,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    title: '跟进建议偏好',
    desc: `风格：${settingsData.aiPreference.style} · 播报：${settingsData.aiPreference.broadcast}`,
  },
  {
    icon: Database,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    title: '门店经验库管理',
    desc: '门窗 / 装修 / 全屋定制 / 建材',
  },
  {
    icon: ClipboardList,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    title: '接待整理规则',
    desc: '自动提取：客户顾虑、下一步动作、微信话术',
  },
  {
    icon: Shield,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    title: '账号与隐私',
    desc: '录音授权、敏感信息、数据保存设置',
  },
]

export default function Settings() {
  return (
    <div className="min-h-full space-y-4 bg-surface px-4 pb-4 pt-3">
      <section className="flex items-center gap-3.5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-lg font-bold text-white">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-300 to-blue-500 text-xl text-white">
            {settingsData.user.name[0]}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">{settingsData.user.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="whitespace-nowrap rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-medium text-white">
              {settingsData.user.team}
            </span>
            <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
              {settingsData.user.library}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        {settingItems.map((item) => (
          <button
            key={item.title}
            className="flex w-full items-center gap-3.5 rounded-xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm transition-colors active:bg-gray-50"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
              <item.icon size={20} className={item.iconColor} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-gray-800">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-gray-400">{item.desc}</p>
            </div>
            {item.status ? (
              <div className="mr-1 flex shrink-0 items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${item.status === '可用' ? 'bg-accent' : 'bg-gray-300'}`} />
                <span className={`text-xs ${item.statusColor}`}>{item.status}</span>
              </div>
            ) : null}
          </button>
        ))}
      </section>

      <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3.5 text-sm font-medium text-red-500 transition-colors active:bg-red-100">
        <LogOut size={16} />
        退出账号
      </button>
    </div>
  )
}
