import { useState } from 'react'
import './balance.css'
import '../print.css'
import { monthReport, balanceSheet, balanceSheetColumns, profitLossRows, previousMonth, formatYen } from '../ledgerLogic.js'
import { today } from '../today.js'

const cls = (n) => (n < 0 ? 'neg' : '')

// 月の集計の行（科目名と金額。円つき）
const Line = ({ name, amount }) => (
  <tr>
    <td>{name}</td>
    <td className={cls(amount)}>{formatYen(amount)}원</td>
  </tr>
)

// 通常の表示：見出しを押すと開く（初期は閉じる）。印刷用表示：すべて開いた表示（開閉の三角を出さない）
function Section({ printView, title, extra, children }) {
  if (printView) return <section className="print-section"><h2>{title}</h2>{extra}{children}</section>
  return <details><summary><h2>{title}</h2>{extra}</summary>{children}</details>
}

// P/L：報告書の形（収益の部、費用の部、当期収支、残高調整）。並びは profitLossRows のまま。金額は数字だけ（単位は見出しの横）
function ProfitLossTable({ report }) {
  return (
    <table className="statement">
      <tbody>
        {profitLossRows(report).map((r, i) => (
          <tr key={i} className={r.kind}>
            <td>{r.name}</td>
            <td className={cls(r.amount)}>{r.amount !== null && formatYen(r.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// B/S：勘定式（左に資産の部、右に負債の部と純資産の部）。下に、資産合計と負債・純資産合計。並びは balanceSheetColumns のまま
function BalanceSheetTable({ sheet }) {
  const { left, right, leftTotal, rightTotal } = balanceSheetColumns(sheet)
  const rows = Math.max(left.length, right.length) // 左右の長さをそろえるために、空のセルを足すだけ
  const amount = (c) => (c && c.amount !== null ? formatYen(c.amount) : '')
  return (
    <table className="statement bs">
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i}>
            <td className={`name ${left[i]?.kind ?? ''}`}>{left[i]?.name}</td>
            <td className={`${left[i]?.kind ?? ''} ${cls(left[i]?.amount)}`}>{amount(left[i])}</td>
            <td className={`text name right ${right[i]?.kind ?? ''}`}>{right[i]?.name}</td>
            <td className={`${right[i]?.kind ?? ''} ${cls(right[i]?.amount)}`}>{amount(right[i])}</td>
          </tr>
        ))}
        <tr className="total">
          <td>{leftTotal.name}</td>
          <td className={cls(leftTotal.amount)}>{formatYen(leftTotal.amount)}</td>
          <td className="text right">{rightTotal.name}</td>
          <td className={cls(rightTotal.amount)}>{formatYen(rightTotal.amount)}</td>
        </tr>
      </tbody>
    </table>
  )
}

export default function Monthly({ data }) {
  const { accounts, entries } = data
  const [month, setMonth] = useState(() => previousMonth(today())) // 初期表示は前月
  const [printView, setPrintView] = useState(false)
  const report = month ? monthReport(accounts, entries, month) : null
  const sheet = month ? balanceSheet(accounts, entries, month) : null
  const adj = report?.adjustment

  return (
    <div className={`report${printView ? ' print-view' : ''}`}>
      {printView ? <h2 className="print-title">월차 보고{month && `(${month})`}</h2> : <h2>월차</h2>}
      <div className="month-bar no-print">
        <input type="month" aria-label="월" value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" onClick={() => setMonth(today().slice(0, 7))}>이번 달</button>
        <button type="button" onClick={() => setMonth(previousMonth(today()))}>지난달</button>
        {!printView && <button type="button" onClick={() => setPrintView(true)}>인쇄용 보기</button>}
      </div>
      {printView && (
        <div className="month-bar no-print">
          <button type="button" onClick={() => window.print()}>인쇄하기</button>
          <button type="button" onClick={() => setPrintView(false)}>돌아가기</button>
          <span className="note">인쇄 대상을 'PDF로 저장'으로 하면 PDF로 만들 수 있습니다.</span>
        </div>
      )}
      {!month ? <p className="note">월을 골라 주세요</p> : (
        <>
          <Section
            printView={printView}
            title={`월 집계(${month})`}
            extra={<span className={`value ${cls(report.result)}`}>손익 {formatYen(report.result)}원</span>}
          >
            <table>
              <tbody>
                <Line name="수익 합계" amount={report.revenueTotal} />
                <Line name="비용 합계" amount={report.expenseTotal} />
                {(adj.gain !== 0 || adj.loss !== 0) && <Line name="잔액 조정(조정이익 − 조정손실)" amount={adj.net} />}
              </tbody>
            </table>
            <p className="note">시작 잔액은 수입에도 지출에도 포함하지 않습니다. 잔액 조정은 보통의 손익과는 별도의 행입니다.</p>
          </Section>

          <Section printView={printView} title={`P/L（${month}）`}>
            <p className="note">(단위: 원)</p>
            <ProfitLossTable report={report} />
          </Section>

          <Section
            printView={printView}
            title={`재무상태표(B/S)(${month} 말 기준)`}
            extra={!sheet.balanced && <span className="value error">(좌우가 맞지 않습니다)</span>}
          >
            <p className="note">(단위: 원)</p>
            <BalanceSheetTable sheet={sheet} />
            {sheet.balanced
              ? <p className="note">자산 합계와 부채・순자산 합계가 일치합니다</p>
              : <p className="error">자산 합계가 부채 합계와 순자산 합계의 합과 맞지 않습니다. 존재하지 않는 계정과목을 가리키는 분개가 없는지 확인해 주세요.</p>}
            <p className="note">재무상태표는 그 달의 마지막 날까지의 모든 분개로 계산합니다. 누적 손익에는 잔액 조정도 포함됩니다.</p>
          </Section>
        </>
      )}
    </div>
  )
}
