import { useState } from 'react'
import './ledger.css'
import {
  TYPES, TYPE_LABELS, ROLES, ROLE_LABELS, newAccount, changeType, validateAccountName,
  isProtected, canDeleteAccount, canChangeType,
} from '../ledgerLogic.js'

function RoleSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
    </select>
  )
}

function TypeSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
    </select>
  )
}

function AccountRow({ account, accounts, entries, subscriptions, onChange, onDelete }) {
  const [name, setName] = useState(account.name)
  const [error, setError] = useState('')
  const locked = isProtected(account)
  const deletable = canDeleteAccount(account, entries, subscriptions)
  const typeEditable = canChangeType(account, entries, subscriptions)
  const touch = (patch) => onChange({ ...account, ...patch, updatedAt: new Date().toISOString() })

  const saveName = () => {
    const r = validateAccountName(name, accounts, account.id)
    if (r.error) return setError(r.error)
    setError('')
    if (r.name !== account.name) touch({ name: r.name })
    setName(r.name)
  }

  const remove = () => {
    if (window.confirm(`계정과목「${account.name}」을(를) 삭제합니다. 되돌릴 수 없습니다. 먼저 내보내 두시기를 권합니다.`)) onDelete()
  }

  return (
    <li className={account.active ? '' : 'inactive'}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={saveName}>이름 변경</button>{' '}
      <TypeSelect value={account.type} disabled={!typeEditable} onChange={(t) => onChange(changeType(account, t, 'other'))} />
      {account.type === 'asset' && <RoleSelect value={account.role} onChange={(role) => touch({ role })} />}{' '}
      <button onClick={() => touch({ active: !account.active })} disabled={locked}>
        {account.active ? '사용 안 함' : '사용'}
      </button>
      <button onClick={remove} disabled={!deletable}>삭제</button>
      {!account.active && <span className="note"> (사용 안 함)</span>}
      {locked && <div className="note">계산에 쓰이는 계정과목이라 삭제・사용 안 함 설정・구분 변경은 할 수 없습니다(이름은 바꿀 수 있습니다)</div>}
      {!locked && !deletable && <div className="note">분개 또는 정기 지출에서 쓰고 있어 삭제와 구분 변경은 할 수 없습니다. '사용 안 함'으로 하면 숨길 수 있습니다</div>}
      {error && <div className="error">{error}</div>}
    </li>
  )
}

function AddForm({ accounts, onAdd }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [role, setRole] = useState('cash')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const r = validateAccountName(name, accounts)
    if (r.error) return setError(r.error)
    setError('')
    onAdd(newAccount(r.name, type, role))
    setName('')
  }

  return (
    <form onSubmit={submit}>
      <TypeSelect value={type} onChange={setType} />
      {type === 'asset' && <RoleSelect value={role} onChange={setRole} />}
      <input placeholder="계정과목 이름" value={name} onChange={(e) => setName(e.target.value)} />
      <button>추가</button>
      {error && <span className="error">{error}</span>}
    </form>
  )
}

export default function Ledger({ data, update }) {
  const { accounts, entries, subscriptions } = data
  const setAccounts = (next) => update({ ...data, accounts: next })

  return (
    <div className="ledger">
      <h2>계정과목 관리</h2>
      <AddForm accounts={accounts} onAdd={(a) => setAccounts([...accounts, a])} />
      {TYPES.map((t) => (
        <section key={t}>
          <h3>{TYPE_LABELS[t]}</h3>
          <ul>
            {accounts.filter((a) => a.type === t).map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                accounts={accounts}
                entries={entries}
                subscriptions={subscriptions}
                onChange={(next) => setAccounts(accounts.map((x) => (x.id === a.id ? next : x)))}
                onDelete={() => setAccounts(accounts.filter((x) => x.id !== a.id))}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
