import './balance.css'
import { savingsHistory, formatYen } from '../ledgerLogic.js'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function Savings({ data }) {
  const { accounts, entries } = data
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  const histories = savingsHistory(accounts, entries)

  return (
    <div className="report">
      <h2>저축(따로 모아 두는 돈)</h2>
      {histories.length === 0 && <p className="note">따로 모아 두는 계정과목이 없습니다</p>}
      {histories.map((h) => (
        <section key={h.account.id}>
          <h3>{h.account.name}：<Num n={h.balance} />원</h3>
          {h.rows.length === 0 ? <p className="note">아직 기록이 없습니다</p> : (
            <table>
              <thead>
                <tr><th>날짜</th><th>상대 계정과목</th><th>메모</th><th>금액</th><th>누계</th></tr>
              </thead>
              <tbody>
                {h.rows.map(({ entry, delta, total }) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{name(entry.debitId === h.account.id ? entry.creditId : entry.debitId)}</td>
                    <td>{entry.memo}</td>
                    <td className={delta < 0 ? 'neg' : ''}>{delta > 0 ? '+' : ''}{formatYen(delta)}원</td>
                    <td><Num n={total} />원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      <p className="note">차변에 들어간 분개는 '따로 모아 둠(+)', 대변에 들어간 분개는 '꺼내 씀(−)'입니다.</p>
    </div>
  )
}
