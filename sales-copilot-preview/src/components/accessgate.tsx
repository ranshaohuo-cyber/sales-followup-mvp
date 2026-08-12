import { useState } from 'react'
import { LockKeyhole, LogIn } from 'lucide-react'
import { setAccessCode } from '../services/accessCode'

interface Props {
  onUnlock: () => void
}

export default function AccessGate({ onUnlock }: Props) {
  const [code, setCode] = useState('')

  function submit() {
    const value = code.trim()
    if (!value) return
    setAccessCode(value)
    onUnlock()
  }

  return (
    <div className="mobile-container flex min-h-screen flex-col justify-center bg-surface px-5">
      <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-primary-600">
            <LockKeyhole size={21} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">门店客户跟进助手</h1>
            <p className="mt-1 text-xs text-gray-500">输入试用访问码后开始使用。</p>
          </div>
        </div>

        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="请输入访问码"
          className="min-h-12 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-primary-500"
        />

        <button
          type="button"
          onClick={submit}
          disabled={!code.trim()}
          className={`mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold ${
            code.trim() ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          <LogIn size={16} />
          进入试用
        </button>
      </section>
    </div>
  )
}
