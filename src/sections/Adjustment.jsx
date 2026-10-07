import { useState } from 'react'
import './adjustment.css'
import { groupByType, adjustmentRows, planAdjustment, formatYen } from '../ledgerLogic.js'
import { today } from '../today.js'

export default function Adjustment({ data, update }) {
  const { accounts, entries } = data
  const [accountId, setAccountId] = useState('')
  const [actual, setActual] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const rows = adjustmentRows(accounts, entries)
  const balances = new Map(rows.map((r) => [r.account.id, r.balance]))

  const save = (e) => {
    e.preventDefault()
    setMessage('')
    const plan = planAdjustment(accounts, entries, accountId, actual, today())
    if (plan.error) return setError(plan.error) // 入力途中の内容は消さない
    setError('')
    if (plan.none) return setMessage(`${plan.account.name}은(는) 기록상 잔액과 같습니다(차액이 0이라 기록하지 않습니다)`)
    const text = `${plan.account.name}의 기록상 잔액은 ${formatYen(plan.current)}원, 실제는 ${formatYen(plan.actual)}원이고, 차액은 ${formatYen(plan.diff)}원입니다. ${plan.kindLabel} ${formatYen(plan.amount)}원의 분개를 기록합니다. 계속할까요?`
    if (!window.confirm(text)) return
    update({ ...data, entries: plan.entries })
    setActual('')
    setMessage(`기록했습니다(${plan.kindLabel} ${formatYen(plan.amount)}원)`)
  }

  return (
    <div className="adjustment">
      <h2>잔액 조정</h2>
      <p className="note">계정과목의 '실제 잔액'을 입력하면, 기록상 잔액과의 차액이 조정이익・조정손실로 기록됩니다(날짜는 오늘).</p>
      <form onSubmit={save}>
        <select aria-label="계정과목" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">계정과목을 골라 주세요</option>
          {groupByType(rows.map((r) => r.account)).map((g) => (
            <optgroup key={g.type} label={g.label}>
              {g.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}(기록상 {formatYen(balances.get(a.id))}원)</option>)}
            </optgroup>
          ))}
        </select>
        <label>
          실제 잔액 <input inputMode="numeric" aria-label="실제 잔액" value={actual} onChange={(e) => setActual(e.target.value)} />원
        </label>
        <button>조정하기</button>
        {error && <span className="error">{error}</span>}
        {message && <span className="note">{message}</span>}
      </form>
      <p className="note">기록한 조정 분개는 편집・삭제할 수 없습니다. 잘못 입력했다면, 올바른 실제 잔액으로 한 번 더 조정해 주세요.</p>
    </div>
  )
}
