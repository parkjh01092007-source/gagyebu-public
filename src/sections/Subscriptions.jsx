import { useState } from 'react'
import './subscriptions.css'
import { AccountSelect } from './Entries.jsx'
import {
  entryAccountOptions, validateSubscriptionInput, newSubscription, editSubscription, setSubscriptionActive, formatYen,
} from '../ledgerLogic.js'
import { today } from '../today.js'

const EMPTY = { name: '', memo: '', amount: '', day: '', debitId: '', creditId: '' }

// 登録・編集で共用。エラーのときは入力途中の内容を消さない。
// currentIds は編集フォームだけが渡す（その定期支払いが今使っている科目を選択肢に残す）
function SubscriptionForm({ accounts, initial, submitLabel, onSubmit, onCancel, currentIds, clearOnSuccess }) {
  const options = entryAccountOptions(accounts, currentIds)
  const [f, setF] = useState(initial)
  const [error, setError] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    const r = validateSubscriptionInput({ ...f, amountText: f.amount, dayText: f.day }, accounts, currentIds)
    if (r.error) return setError(r.error)
    setError('')
    onSubmit(r)
    if (clearOnSuccess) setF(EMPTY)
  }

  return (
    <form onSubmit={submit}>
      <input placeholder="이름" aria-label="이름" value={f.name} onChange={(e) => set('name')(e.target.value)} />
      <input placeholder="메모(내용)" aria-label="메모" value={f.memo} onChange={(e) => set('memo')(e.target.value)} />
      <input inputMode="numeric" placeholder="금액" aria-label="금액" value={f.amount} onChange={(e) => set('amount')(e.target.value)} />
      <label>매월 <input inputMode="numeric" className="day" aria-label="매월의 날" value={f.day} onChange={(e) => set('day')(e.target.value)} /> 일</label>
      <AccountSelect label="차변" value={f.debitId} onChange={set('debitId')} options={options} />
      <AccountSelect label="대변" value={f.creditId} onChange={set('creditId')} options={options} />
      <button>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>취소</button>}
      {error && <span className="error">{error}</span>}
    </form>
  )
}

function SubscriptionRow({ sub, accounts, editing, onEdit, onCancel, onSave, onToggle, onDelete }) {
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  if (editing) {
    return (
      <li>
        <SubscriptionForm
          accounts={accounts}
          initial={{ name: sub.name, memo: sub.memo, amount: String(sub.amount), day: String(sub.day), debitId: sub.debitId, creditId: sub.creditId }}
          currentIds={[sub.debitId, sub.creditId]}
          submitLabel="저장"
          onSubmit={onSave}
          onCancel={onCancel}
        />
      </li>
    )
  }
  return (
    <li className={sub.active ? '' : 'inactive'}>
      <div>
        <strong>{sub.name}</strong> 매월 {sub.day}일　{formatYen(sub.amount)}원　차변: {name(sub.debitId)}　대변: {name(sub.creditId)}
        {!sub.active && <span className="note"> (사용 안 함)</span>}
      </div>
      {sub.memo && <div className="note">{sub.memo}</div>}
      <div className="note">마지막으로 기록한 달: {sub.lastMonth}</div>
      <div>
        <button onClick={onEdit}>편집</button>
        <button onClick={onToggle}>{sub.active ? '사용 안 함' : '사용'}</button>
        <button onClick={onDelete}>삭제</button>
      </div>
    </li>
  )
}

export default function Subscriptions({ data, update }) {
  const { accounts, subscriptions } = data
  const [editingId, setEditingId] = useState(null)
  const setSubscriptions = (next) => update({ ...data, subscriptions: next })

  const add = (input) => setSubscriptions([...subscriptions, newSubscription(input, today())])
  const save = (sub) => (input) => {
    setSubscriptions(subscriptions.map((s) => (s.id === sub.id ? editSubscription(s, input) : s)))
    setEditingId(null)
  }
  const toggle = (sub) => setSubscriptions(subscriptions.map((s) => (s.id === sub.id ? setSubscriptionActive(s, !s.active, today()) : s)))
  const remove = (sub) => {
    if (!window.confirm(`정기 지출「${sub.name}」을(를) 삭제합니다. 이미 기록된 분개는 남습니다.`)) return
    setSubscriptions(subscriptions.filter((s) => s.id !== sub.id))
  }

  return (
    <div className="subscriptions">
      <h2>정기 지출</h2>
      <p className="note">
        앱을 열 때, 오늘까지 도래한 지정일의 분량이 일반 분개로 자동 기록됩니다.
        등록한 날보다 이전 분량과 '사용 안 함'인 동안의 분량은 거슬러 올라가 기록하지 않습니다. 31일처럼 그 달에 없는 날은 그 달의 말일로 처리합니다.
      </p>
      <SubscriptionForm accounts={accounts} initial={EMPTY} submitLabel="등록" onSubmit={add} clearOnSuccess />
      {subscriptions.length === 0 ? <p className="note">정기 지출이 아직 없습니다</p> : (
        <ul>
          {subscriptions.map((s) => (
            <SubscriptionRow
              key={s.id}
              sub={s}
              accounts={accounts}
              editing={editingId === s.id}
              onEdit={() => setEditingId(s.id)}
              onCancel={() => setEditingId(null)}
              onSave={save(s)}
              onToggle={() => toggle(s)}
              onDelete={() => remove(s)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
