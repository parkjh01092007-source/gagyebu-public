import './balance.css'
import { creditCardSplit, formatYen } from '../ledgerLogic.js'
import { today } from '../today.js'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function CreditCard({ data }) {
  const split = creditCardSplit(data.accounts, data.entries, today())
  if (!split) return <div className="report"><p className="error">카드 미결제 계정과목을 찾을 수 없습니다</p></div>

  return (
    <div className="report">
      <h2>카드</h2>
      <table>
        <tbody>
          <tr><td>다음 결제분</td><td><Num n={split.next} />원</td></tr>
          <tr><td>이번 달 사용액</td><td><Num n={split.thisMonth} />원</td></tr>
          <tr><td>미결제 잔액(합계)</td><td><Num n={split.balance} />원</td></tr>
        </tbody>
      </table>
      <p className="note">다음 결제분 = 미결제 잔액 − 이번 달 사용액. 시작 잔액은 사용액에 포함하지 않습니다. 카드사마다 결제일이 다르니, 실제 청구서와 비교하세요.</p>
      <h3>월별 사용액</h3>
      {split.monthly.length === 0 ? <p className="note">아직 사용 기록이 없습니다</p> : (
        <table>
          <thead>
            <tr><th>월</th><th>사용액</th></tr>
          </thead>
          <tbody>
            {split.monthly.map((m) => (
              <tr key={m.month}><td>{m.month}</td><td>{formatYen(m.amount)}원</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
