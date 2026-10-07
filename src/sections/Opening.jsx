import { useState } from 'react'
import './opening.css'
import { groupByType, openingAccounts, openingInitial, planOpening } from '../ledgerLogic.js'
import { today } from '../today.js'

export default function Opening({ data, update }) {
  const { accounts, entries } = data
  const [initial] = useState(() => openingInitial(accounts, entries, today()))
  const [date, setDate] = useState(initial.date)
  const [texts, setTexts] = useState(initial.amounts)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const save = (e) => {
    e.preventDefault()
    setMessage('')
    const plan = planOpening(accounts, entries, date, texts)
    if (plan.error) return setError(plan.error) // 入力途中の内容は消さない
    setError('')
    if (!plan.created && !plan.updated && !plan.deleted) return setMessage('변경 사항이 없습니다')
    const warn = plan.earlier ? `시작일보다 이전 날짜의 일반 분개가 ${plan.earlier.count}건 있습니다(가장 오래된 날짜: ${plan.earlier.first}).\n\n` : ''
    if (!window.confirm(`${warn}시작 잔액을 저장합니다(생성 ${plan.created}・수정 ${plan.updated}・삭제 ${plan.deleted}). 계속할까요?`)) return
    update({ ...data, entries: plan.entries })
    setMessage('저장했습니다')
  }

  return (
    <div className="opening">
      <h2>시작 잔액</h2>
      <p className="note">은행 계좌에는 비상금을 뺀 금액을 넣습니다(통장 잔액 합계 = 은행 계좌 + 비상금).</p>
      <p className="note">카드 미결제에는 카드 앱(또는 카드사 홈페이지)에서 볼 수 있는 현재 이용 금액을 넣습니다.</p>
      <p className="note">비어 있거나 0인 계정과목은 시작 잔액을 기록하지 않습니다(이미 있으면 삭제합니다).</p>
      <form onSubmit={save}>
        <label className="date">
          시작일 <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {groupByType(openingAccounts(accounts)).map((g) => (
          <section key={g.type}>
            <h3>{g.label}</h3>
            {g.accounts.map((a) => (
              <label key={a.id} className="row">
                <span>{a.name}</span>
                <input
                  inputMode="numeric"
                  aria-label={a.name}
                  value={texts[a.id] ?? ''}
                  onChange={(e) => setTexts((t) => ({ ...t, [a.id]: e.target.value }))}
                />
                <span>원</span>
              </label>
            ))}
          </section>
        ))}
        <button>저장</button>
        {error && <span className="error">{error}</span>}
        {message && <span className="note">{message}</span>}
      </form>
    </div>
  )
}
