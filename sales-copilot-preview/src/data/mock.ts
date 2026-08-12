export const copilotData = {
  customerIntent: '比价中 · 关注保温和预算',
  customerConcern: {
    tag: '旧窗更换',
    description: '客户不只是嫌贵，是担心换完以后仍然漏风、售后没人管。要先把配置、安装和质保讲清楚。',
  },
  broadcastOrder: ['先行动后话术', '先话术后行动'],
  actions: [
    {
      id: 1,
      type: 'action',
      label: '现在做',
      content: '先别急着降价，帮客户对齐配置、安装和售后。',
      autoBroadcast: true,
    },
    {
      id: 2,
      type: 'speech',
      label: '现在说',
      content: '"姐，咱先不只看一平多少钱，我帮您把型材、玻璃、安装和售后放一起比。"',
      autoBroadcast: true,
    },
  ],
}

export interface ExperienceItem {
  id: string
  title: string
  tags: string[]
  trustGoal: string
  action: string
  script: string
  callCount: number
  effectiveness: number
}

export const experienceData: ExperienceItem[] = [
  {
    id: 'exp-1',
    title: '旧窗漏风先问原因',
    tags: ['旧窗更换', '需求挖掘'],
    trustGoal: '让客户觉得你在帮他判断问题，不是只想报价。',
    action: '先问楼层、朝向、漏风位置和是否临街，再谈配置。',
    script: '"姐，漏风不一定只看窗框，我先帮您判断是玻璃、密封还是安装缝的问题。"',
    callCount: 342,
    effectiveness: 98,
  },
  {
    id: 'exp-2',
    title: '客户问单价时先对齐配置',
    tags: ['价格异议', '配置对比'],
    trustGoal: '避免客户只拿低价对比，先建立专业比较口径。',
    action: '把型材、玻璃、五金、安装和质保拆开讲。',
    script: '"您比价没问题，但咱得先看配置是不是一套东西，不然单价不好直接比。"',
    callCount: 128,
    effectiveness: 92,
  },
  {
    id: 'exp-3',
    title: '再看看时发同类案例',
    tags: ['跟进动作', '防流失'],
    trustGoal: '客户离店后仍然记得你，并且有理由继续聊。',
    action: '当天发同小区或相似户型案例，第二天再约量尺。',
    script: '"您先不用急着定，我把和您家情况接近的案例发您，您对照着看更直观。"',
    callCount: 215,
    effectiveness: 89,
  },
  {
    id: 'exp-4',
    title: '家里人决策时给转发材料',
    tags: ['决策链', '家庭沟通'],
    trustGoal: '帮客户把信息讲给家里人，减少转述丢失。',
    action: '整理两套方案、差异点和预算范围，让客户能直接转发。',
    script: '"我给您整理成一段能直接发家里人的说明，省得您回去还得重新讲。"',
    callCount: 89,
    effectiveness: 95,
  },
  {
    id: 'exp-5',
    title: '担心售后时说清负责人',
    tags: ['售后保障', '建立信任'],
    trustGoal: '让客户知道出问题找谁、多久响应、怎么闭环。',
    action: '不要只说售后好，要讲清负责人、响应时间和质保范围。',
    script: '"这个我给您说清楚，安装后谁负责、多久响应、哪些情况质保里包含。"',
    callCount: 156,
    effectiveness: 91,
  },
  {
    id: 'exp-6',
    title: '板材环保先匹配入住时间',
    tags: ['板材环保', '全屋定制'],
    trustGoal: '让客户觉得你在帮他避开入住风险。',
    action: '先问家里有没有老人孩子、什么时候入住，再讲板材和封边。',
    script: '"您担心环保是对的，咱先看入住时间，再定板材和封边标准。"',
    callCount: 103,
    effectiveness: 90,
  },
]

export interface CaseItem {
  id: string
  title: string
  tags: string[]
  status: string
  concern: string
  championAction: string
  keyScript: string
  result?: { amount: string; callCount: number; effectiveness: number }
  period?: string
  summary?: string
  callCount: number
  effectiveness: number
}

export const caseData: CaseItem[] = [
  {
    id: 'case-1',
    title: '龙沙区旧窗更换成交案例',
    tags: ['旧窗漏风', '保温隔音', '已成交'],
    status: '已成交',
    concern: '客户嫌断桥铝报价高，担心换完还是漏风。',
    championAction: '先判断漏风原因，再拆型材、玻璃、安装和售后差异。',
    keyScript: '"姐，咱先不只看一平多少钱，我帮您看换完能不能真正暖和。"',
    result: { amount: '¥18,600', callCount: 12, effectiveness: 96 },
    callCount: 86,
    effectiveness: 96,
  },
  {
    id: 'case-2',
    title: '建华区新房全屋定制',
    tags: ['板材环保', '预算对比', '已成交'],
    status: '已成交',
    concern: '客户担心板材味道和后期五金变形。',
    championAction: '把板材、封边、五金和安装质保拆成对比清单。',
    keyScript: '"您别只看柜体总价，五金和封边决定后面用着省不省心。"',
    period: '周期 12 天 · 推进成功',
    callCount: 54,
    effectiveness: 92,
  },
  {
    id: 'case-3',
    title: '铁锋区装修局改客户',
    tags: ['局部改造', '工期顾虑', '推进中'],
    status: '推进中',
    concern: '客户担心工期拖延，影响正常入住。',
    championAction: '先拆施工节点和验收节点，给客户确定感。',
    keyScript: '"咱不先谈大概，我给您把每天做什么、哪天验收列清楚。"',
    callCount: 31,
    effectiveness: 0,
  },
]

export const reviewData = {
  todayCalls: 5,
  pendingReviews: 2,
  newExperiences: 3,
  efficiencyTrend: [
    { day: '一', value: 45 },
    { day: '二', value: 62 },
    { day: '三', value: 78 },
    { day: '四', value: 55 },
    { day: '五', value: 92 },
  ],
  conversations: [
    {
      id: 'conv-1',
      customerName: '王姐',
      company: '龙沙区旧窗更换',
      time: '今天 14:38',
      duration: '18分钟',
      tag: '高意向待追',
      tagColor: 'red',
      concern: '客户觉得报价偏高，但真实痛点是冬天漏风和售后保障。',
      effectiveAction: '没有直接降价，先讲了配置和安装差异。',
      aiSuggestion: '新增“旧窗漏风客户先发同小区案例，再约免费量尺”的跟进动作。',
    },
    {
      id: 'conv-2',
      customerName: '李哥',
      company: '建华区全屋定制',
      time: '昨天 16:00',
      duration: '32分钟',
      tag: '预算比价',
      tagColor: 'orange',
      concern: '客户拿别家低价对比，暂时没看清板材和五金差异。',
      effectiveAction: '引导客户把柜体、板材、封边、五金拆开比较。',
      aiSuggestion: '新增“全屋定制比价时先发配置对比表”的跟进动作。',
    },
  ],
}

export const settingsData = {
  user: {
    name: '门店销售',
    avatar: '',
    team: '齐齐哈尔试点门店',
    library: '门窗装修经验库',
  },
  device: {
    connected: true,
    deviceName: '文字粘贴 / 接待录音',
  },
  industry: {
    current: '门窗装修建材 V1.0',
  },
  aiPreference: {
    style: '真诚顾问型',
    broadcast: '跟进动作+微信话术',
  },
}
