import './balance.css'
import { TYPE_LABELS, accountBalances, freeAmount, typeTotals, formatYen } from '../ledgerLogic.js'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function Balance({ data }) {
  const { accounts, entries } = data
  const free = freeAmount(accounts, entries)
  const { rows, balanced } = accountBalances(accounts, entries)

  return (
    <div className="report">
      <h2>자유롭게 쓸 수 있는 돈</h2>
      <p className="free">
        <Num n={free.total} />원
        {free.items.length > 0 && (
          <span className="note">
            {'（'}
            {free.items.map((item, i) => (
              <span key={item.id}>{i > 0 && '、'}{item.name} <Num n={item.balance} /></span>
            ))}
            {'）'}
          </span>
        )}
      </p>
      {!balanced && <p className="error">차변 합계와 대변 합계가 맞지 않습니다. 존재하지 않는 계정과목을 가리키는 분개가 없는지 확인해 주세요.</p>}
      <h2>잔액</h2>
      {['asset', 'liability'].map((type) => {
        const total = typeTotals(rows, type)
        return (
        <section key={type}>
          <h3>{TYPE_LABELS[type]}</h3>
          <table>
            <thead>
              <tr><th>계정과목</th><th>차변 합계</th><th>대변 합계</th><th>잔액</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.account.type === type && (r.account.active || r.used)).map((r) => (
                <tr key={r.account.id} className={r.account.active ? '' : 'inactive'}>
                  <td>{r.account.name}{!r.account.active && <span className="note"> (사용 안 함)</span>}</td>
                  <td>{formatYen(r.debit)}</td>
                  <td>{formatYen(r.credit)}</td>
                  <td className={r.balance < 0 ? 'neg' : ''}>{formatYen(r.balance)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>합계</td>
                <td>{formatYen(total.debit)}</td>
                <td>{formatYen(total.credit)}</td>
                <td className={total.balance < 0 ? 'neg' : ''}>{formatYen(total.balance)}</td>
              </tr>
            </tbody>
          </table>
        </section>
        )
      })}
      <p className="note">잔액: 자산은 '차변 합계 − 대변 합계', 부채는 '대변 합계 − 차변 합계'입니다.</p>
    </div>
  )
}
