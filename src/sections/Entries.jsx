import { useState } from 'react'
import './entries.css'
import {
  entryAccountOptions, validateEntryInput, newEntry, editEntry, lastCreditId, groupByType,
  entriesOfMonth, groupEntriesByDate, canEditEntry, formatYen,
} from '../ledgerLogic.js'
import { today } from '../today.js'

export function AccountSelect({ value, onChange, options, label }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {groupByType(options).map((g) => (
        <optgroup key={g.type} label={g.label}>
          {g.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// 入力・編集で共用。エラーのときは入力途中の内容を消さない。
// currentIds は編集フォームだけが渡す（その仕訳が今使っている科目を選択肢に残す）。新規入力では渡さない。
export function EntryForm({ accounts, initial, submitLabel, onSubmit, onCancel, currentIds }) {
  const options = entryAccountOptions(accounts, currentIds)
  const [f, setF] = useState(initial)
  const [error, setError] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    const r = validateEntryInput({ ...f, amountText: f.amount }, accounts)
    if (r.error) return setError(r.error)
    setError('')
    onSubmit(r, f.memo)
    setF((s) => ({ ...s, amount: '', memo: '' })) // 成功時は金額とメモだけ空にする
  }

  return (
    <form onSubmit={submit}>
      <input type="date" aria-label="날짜" value={f.date} onChange={(e) => set('date')(e.target.value)} />
      <input inputMode="numeric" placeholder="금액" aria-label="금액" value={f.amount} onChange={(e) => set('amount')(e.target.value)} />
      <AccountSelect label="차변" value={f.debitId} onChange={set('debitId')} options={options} />
      <AccountSelect label="대변" value={f.creditId} onChange={set('creditId')} options={options} />
      <input placeholder="메모" aria-label="메모" value={f.memo} onChange={(e) => set('memo')(e.target.value)} />
      <button>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>취소</button>}
      {error && <span className="error">{error}</span>}
    </form>
  )
}

export const KIND_LABELS ={ normal: '', opening: '시작 잔액', adjustment: '잔액 조정' }

function EntryRow({ entry, number, accounts, editing, onEdit, onCancel, onSave, onDelete }) {
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  if (editing) {
    return (
      <li>
        <EntryForm
          accounts={accounts}
          initial={{ date: entry.date, amount: String(entry.amount), debitId: entry.debitId, creditId: entry.creditId, memo: entry.memo }}
          currentIds={[entry.debitId, entry.creditId]}
          submitLabel="저장"
          onSubmit={onSave}
          onCancel={onCancel}
        />
      </li>
    )
  }
  return (
    <li className="row">
      <span>{number}.</span>
      <span className="cell debit">{name(entry.debitId)}</span>
      <span className="cell">{name(entry.creditId)}</span>
      <span className="amount">{formatYen(entry.amount)}원</span>
      <span className="cell">
        {KIND_LABELS[entry.kind] && <span className="note">（{KIND_LABELS[entry.kind]}）</span>}
        {entry.memo}
      </span>
      <span>
        {canEditEntry(entry) && (
          <>
            <button onClick={onEdit}>편집</button>
            <button onClick={onDelete}>삭제</button>
          </>
        )}
      </span>
    </li>
  )
}

export default function Entries({ data, update }) {
  const { accounts, entries } = data
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [editingId, setEditingId] = useState(null)
  const setEntries = (next) => update({ ...data, entries: next })
  const add = (input, memo) => {
    setEntries([...entries, newEntry(input, memo)])
    setMonth(input.date.slice(0, 7)) // 追加した仕訳が見える月に切り替える
  }
  const last = lastCreditId(entries)
  const creditId = entryAccountOptions(accounts).some((a) => a.id === last) ? last : '' // 選択肢にあるときだけ使う
  const groups = month ? groupEntriesByDate(entriesOfMonth(entries, month)) : []

  const save = (entry) => (input, memo) => {
    setEntries(entries.map((e) => (e.id === entry.id ? editEntry(entry, input, memo) : e)))
    setEditingId(null)
  }
  const remove = (entry) => {
    if (!window.confirm('이 분개를 삭제합니다. 되돌릴 수 없습니다. 먼저 내보내 두시기를 권합니다.')) return
    setEntries(entries.filter((e) => e.id !== entry.id))
  }

  return (
    <div className="entries">
      <h2>분개 입력</h2>
      <EntryForm
        accounts={accounts}
        initial={{ date: today(), amount: '', debitId: '', creditId, memo: '' }}
        submitLabel="추가"
        onSubmit={add}
      />
      <h2>분개 목록</h2>
      <input type="month" aria-label="월" value={month} onChange={(e) => { setMonth(e.target.value); setEditingId(null) }} />
      {!month ? <p className="note">월을 골라 주세요</p> : groups.length === 0 ? <p className="note">이 달의 분개가 없습니다</p> : (
        groups.map((g) => (
          <section key={g.date} className="day">
            <h3>{g.date}</h3>
            <div className="head">
              <span />
              <span className="debit">차변</span>
              <span>대변</span>
              <span className="amount">금액</span>
              <span />
              <span />
            </div>
            <ol>
              {g.entries.map((e, i) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  number={i + 1}
                  accounts={accounts}
                  editing={editingId === e.id}
                  onEdit={() => setEditingId(e.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={save(e)}
                  onDelete={() => remove(e)}
                />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
