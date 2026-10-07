import { useState } from 'react'
import './balance.css'
import { groupByType, ledgerBook, formatYen } from '../ledgerLogic.js'
import { KIND_LABELS } from './Entries.jsx'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function LedgerBook({ data }) {
  const { accounts, entries } = data
  const [accountId, setAccountId] = useState('')
  const [month, setMonth] = useState('') // 初期は全期間
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  const book = accountId ? ledgerBook(accounts, entries, accountId, month) : null

  return (
    <div className="report">
      <h2>원장</h2>
      <div className="month-bar">
        <select aria-label="계정과목" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">계정과목을 골라 주세요</option>
          {groupByType(accounts).map((g) => (
            <optgroup key={g.type} label={g.label}>
              {g.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{!a.active && '(사용 안 함)'}</option>)}
            </optgroup>
          ))}
        </select>
        <input type="month" aria-label="월" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" onClick={() => setMonth('')}>전체 기간</button>
      </div>
      <p className="note">보기만 하는 화면입니다. 편집・삭제는 '분개' 화면에서 합니다.</p>
      {book && book.total === 0 && <p className="note">분개가 없습니다</p>}
      {book && book.total > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>날짜</th><th className="text">상대 계정과목</th><th>차변</th><th>대변</th><th>잔액</th><th className="text">메모</th><th className="text">종류</th>
              </tr>
            </thead>
            <tbody>
              {book.carryOver !== null && (
                <tr className="total">
                  <td colSpan={4}>전월까지의 이월</td>
                  <td className={book.carryOver < 0 ? 'neg' : ''}>{formatYen(book.carryOver)}</td>
                  <td colSpan={2} />
                </tr>
              )}
              {book.rows.map((r) => (
                <tr key={r.entry.id}>
                  <td>{r.entry.date}</td>
                  <td className="text">{name(r.otherId)}</td>
                  <td>{r.debit !== null && formatYen(r.debit)}</td>
                  <td>{r.credit !== null && formatYen(r.credit)}</td>
                  <td><Num n={r.balance} /></td>
                  <td className="text">{r.entry.memo}</td>
                  <td className="text">{KIND_LABELS[r.entry.kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {book.rows.length === 0 && <p className="note">이 달의 분개가 없습니다</p>}
        </>
      )}
    </div>
  )
}
