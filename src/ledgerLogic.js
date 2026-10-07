// 仕訳帳の純関数。お金の計算もここに置く（画面側では計算しない）。

export const TYPES = ['asset', 'liability', 'revenue', 'expense', 'equity']
export const TYPE_LABELS = { asset: '자산', liability: '부채', revenue: '수익', expense: '비용', equity: '순자산' }
export const ROLES = ['cash', 'earmark', 'other']
export const ROLE_LABELS = { cash: '자유롭게 쓸 수 있는 현금류', earmark: '따로 모아 두는 돈', other: '그 외' }
export const KINDS = ['normal', 'opening', 'adjustment']

// [名前, type, role, key]
const INITIAL = [
  ['현금', 'asset', 'cash'],
  ['은행 계좌', 'asset', 'cash'],
  ['비상금', 'asset', 'earmark'],
  ['적금・예금', 'asset', 'other'],
  ['투자', 'asset', 'other'],
  ['카드 미결제', 'liability', undefined, 'credit-card'],
  ['미지급금', 'liability'],
  ['월급', 'revenue'],
  ['기타 수입', 'revenue'],
  ['조정이익', 'revenue', undefined, 'adjust-gain'],
  ['식비', 'expense'],
  ['교통비', 'expense'],
  ['생활용품', 'expense'],
  ['통신비', 'expense'],
  ['공과금(전기・가스・수도)', 'expense'],
  ['의료비', 'expense'],
  ['경조사비', 'expense'],
  ['여가', 'expense'],
  ['기타', 'expense'],
  ['조정손실', 'expense', undefined, 'adjust-loss'],
  ['시작 잔액', 'equity', undefined, 'opening'],
]

// 計算で探す特別科目は、名前ではなく key で探す（改名しても壊れない）。削除・使わない設定・type変更は不可。
export const SPECIAL_KEYS = ['opening', 'adjust-gain', 'adjust-loss', 'credit-card']
export const ENTRY_HIDDEN_KEYS = ['opening', 'adjust-gain', 'adjust-loss'] // 入力の選択肢から除く。クレカ未払いは除かない
export const LEGACY_KEY_BY_NAME = { 開始残高: 'opening', 調整益: 'adjust-gain', 調整損: 'adjust-loss', クレカ未払い: 'credit-card' } // v2からの移行専用

export const newAccount = (name, type, role, now = new Date().toISOString(), key) => ({
  id: crypto.randomUUID(),
  name,
  type,
  ...(type === 'asset' && { role }),
  ...(key && { key }),
  active: true,
  createdAt: now,
  updatedAt: now,
})

export const makeInitialAccounts = (now = new Date().toISOString()) =>
  INITIAL.map(([name, type, role, key]) => newAccount(name, type, role, now, key))

export const isProtected = (account) => Boolean(account.key)

const hasEntries = (account, entries) => entries.some((e) => e.debitId === account.id || e.creditId === account.id)

const usedBySubscription = (account, subscriptions) => subscriptions.some((s) => s.debitId === account.id || s.creditId === account.id)

export const canDeleteAccount = (account, entries, subscriptions = []) =>
  !isProtected(account) && !hasEntries(account, entries) && !usedBySubscription(account, subscriptions)
export const canChangeType = canDeleteAccount // 条件は同じ：特別科目（key あり）でなく、仕訳が1件もなく、定期支払いで使っていない

// v2 → v3：名前が一致する4科目に key を付ける。4つ揃わないときは error。元の配列は変えない
export function addKeys(accounts) {
  const keyed = accounts.map((a) => (LEGACY_KEY_BY_NAME[a.name] ? { ...a, key: LEGACY_KEY_BY_NAME[a.name] } : a))
  if (!SPECIAL_KEYS.every((k) => keyed.some((a) => a.key === k))) return { error: '특별한 계정과목(시작 잔액・조정이익・조정손실・카드 미결제)이 없어 이전할 수 없습니다' }
  return { accounts: keyed }
}

export function validateAccountName(name, accounts, selfId) {
  const n = name.trim()
  if (!n) return { error: '계정과목 이름을 입력해 주세요' }
  if (accounts.some((a) => a.id !== selfId && a.name === n)) return { error: '같은 이름의 계정과목이 있습니다' }
  return { name: n }
}

// type を変えたら role を整える（asset 以外は role なし、asset は role 必須）
export function changeType(account, type, role, now = new Date().toISOString()) {
  const { role: _old, ...rest } = account
  return { ...rest, type, ...(type === 'asset' && { role: role ?? 'other' }), updatedAt: now }
}

// ---- 仕訳の入力・一覧 ----

export function isDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v // 2026-02-30 のような実在しない日付も弾く
}

// 半角数字のみ・先頭0なし。カンマ・小数点・全角・1e3・負数・0・空欄はエラー。丸めない。
export function parseAmount(text) {
  if (typeof text !== 'string' || !/^[1-9]\d*$/.test(text)) return { error: '금액은 1 이상의 반각 숫자로 입력해 주세요' }
  const amount = Number(text)
  if (!Number.isSafeInteger(amount)) return { error: '금액이 너무 큽니다' }
  return { amount }
}

// 入力フォームの選択肢。currentIds は編集中の仕訳が今使っている科目（使わない設定でも残す）。
export const entryAccountOptions = (accounts, currentIds = []) =>
  accounts.filter((a) => (a.active && !ENTRY_HIDDEN_KEYS.includes(a.key)) || currentIds.includes(a.id))

export function validateEntryInput({ date, debitId, creditId, amountText }, accounts) {
  if (!isDate(date)) return { error: '날짜를 올바르게 입력해 주세요' }
  const a = parseAmount(amountText)
  if (a.error) return a
  const ids = new Set(accounts.map((x) => x.id))
  if (!ids.has(debitId) || !ids.has(creditId)) return { error: '차변과 대변의 계정과목을 골라 주세요' }
  if (debitId === creditId) return { error: '차변과 대변에 같은 계정과목은 고를 수 없습니다' }
  return { date, debitId, creditId, amount: a.amount }
}

export const newEntry = (input, memo, now = new Date().toISOString()) => ({
  id: crypto.randomUUID(),
  date: input.date,
  debitId: input.debitId,
  creditId: input.creditId,
  amount: input.amount,
  memo,
  kind: 'normal',
  createdAt: now,
  updatedAt: now,
})

// id・kind・createdAt は保つ
export const editEntry = (entry, input, memo, now = new Date().toISOString()) => ({
  ...entry,
  date: input.date,
  debitId: input.debitId,
  creditId: input.creditId,
  amount: input.amount,
  memo,
  updatedAt: now,
})

// 日付 → 作成日時 → id の順。同じ入力なら毎回同じ並びになる
const byDateThenCreated = (a, b) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

// month は 'YYYY-MM'。日付順、同じ日は作成順
export const entriesOfMonth = (entries, month) =>
  entries
    .filter((e) => e.date.startsWith(month))
    .sort(byDateThenCreated)

// 最後に作成した normal の仕訳の貸方。なければ ''
export const lastCreditId = (entries) =>
  entries.filter((e) => e.kind === 'normal').reduce((last, e) => (!last || e.createdAt >= last.createdAt ? e : last), null)?.creditId ?? ''

export const formatYen = (n) => n.toLocaleString('ko-KR') // 表示専用。計算には使わない

export const canEditEntry = (entry) => entry.kind === 'normal'

// 区分ごとに分ける（TYPES の順。空の区分は出さない。グループ内は渡された順のまま）
export const groupByType = (accounts) =>
  TYPES.map((type) => ({ type, label: TYPE_LABELS[type], accounts: accounts.filter((a) => a.type === type) })).filter((g) => g.accounts.length)

// 日付ごとにまとめる。枠は日付の古い順、枠の中は作成日時の古い順（同じなら id 順）。元の配列は変えない。
// 表示の番号は、枠の中の位置（index + 1）から画面側で振る。保存しない。
export function groupEntriesByDate(entries) {
  const groups = []
  for (const e of [...entries].sort(byDateThenCreated)) {
    const last = groups[groups.length - 1]
    if (last && last.date === e.date) last.entries.push(e)
    else groups.push({ date: e.date, entries: [e] })
  }
  return groups
}

// ---- 開始残高 ----

// 開始残高の画面に出す科目：active の資産と負債
export const openingAccounts = (accounts) => accounts.filter((a) => a.active && (a.type === 'asset' || a.type === 'liability'))

// 空欄と0は可（仕訳を作らない）。それ以外は parseAmount と同じ（半角数字のみ・先頭0なし）
export function parseOpeningAmount(text) {
  if (text === '' || text === '0') return { amount: 0 }
  const r = parseAmount(text)
  return r.error ? { error: '금액은 0 이상의 반각 숫자로 입력해 주세요' } : r
}

// その科目の開始残高の仕訳。先頭は createdAt が古い順、同じなら id 順（planOpening と openingInitial で共通）
const openingEntriesOf = (entries, accountId) =>
  entries
    .filter((e) => e.kind === 'opening' && (e.debitId === accountId || e.creditId === accountId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))

// 画面の初期値。画面に出ている科目の開始残高の仕訳だけから決める（使わない科目の仕訳は見ない）
export function openingInitial(accounts, entries, today) {
  const amounts = {}
  const dates = []
  for (const a of openingAccounts(accounts)) {
    const first = openingEntriesOf(entries, a.id)[0]
    if (!first) continue
    amounts[a.id] = String(first.amount)
    dates.push(first.date)
  }
  return { date: dates.sort()[0] ?? today, amounts }
}

// 保存の計画（保存はしない）。成功: { entries, created, updated, deleted, earlier } / 失敗: { error }
// 金額あり：仕訳がなければ作り、あれば直す。空・0：あれば消す。同じ科目に2件以上あれば、先頭だけ残す。使わない科目の仕訳は触らない。
// earlier：開始日より前の通常の仕訳（{ count, first }）。なければ null
export function planOpening(accounts, entries, date, amountTexts, now = new Date().toISOString()) {
  if (!isDate(date)) return { error: '시작일을 올바르게 입력해 주세요' }
  const openingId = accounts.find((a) => a.key === 'opening')?.id
  if (!openingId) return { error: '시작 잔액 계정과목을 찾을 수 없습니다' }
  const shown = openingAccounts(accounts)
  const amounts = {}
  for (const a of shown) {
    const r = parseOpeningAmount(amountTexts[a.id] ?? '')
    if (r.error) return { error: `${a.name}：${r.error}` }
    amounts[a.id] = r.amount
  }
  const remove = new Set()
  const replace = new Map()
  const add = []
  let created = 0, updated = 0, deleted = 0
  for (const a of shown) {
    const [first, ...extra] = openingEntriesOf(entries, a.id)
    for (const e of extra) { remove.add(e.id); deleted++ }
    const amount = amounts[a.id]
    if (!amount) {
      if (first) { remove.add(first.id); deleted++ }
      continue
    }
    const [debitId, creditId] = a.type === 'asset' ? [a.id, openingId] : [openingId, a.id]
    if (!first) {
      add.push({ id: crypto.randomUUID(), date, debitId, creditId, amount, memo: '', kind: 'opening', createdAt: now, updatedAt: now })
      created++
    } else if (first.date !== date || first.amount !== amount || first.debitId !== debitId || first.creditId !== creditId) {
      replace.set(first.id, { ...first, date, debitId, creditId, amount, updatedAt: now })
      updated++
    }
  }
  const before = entries.filter((e) => e.kind === 'normal' && e.date < date).map((e) => e.date).sort()
  return {
    entries: [...entries.filter((e) => !remove.has(e.id)).map((e) => replace.get(e.id) ?? e), ...add],
    created, updated, deleted,
    earlier: before.length ? { count: before.length, first: before[0] } : null,
  }
}

// ---- 残高・自由に使える額・クレカ・貯蓄 ----

const sum = (list, pick) => list.reduce((n, x) => n + pick(x), 0)

// 残高：資産・費用は「借方 − 貸方」、負債・収益・純資産は「貸方 − 借方」。
// rows は全科目（used：仕訳が1件でもある）。balanced：行の借方合計と貸方合計の一致（存在しない科目を指す仕訳があると崩れる）
export function accountBalances(accounts, entries) {
  const sums = new Map(accounts.map((a) => [a.id, { debit: 0, credit: 0 }]))
  for (const e of entries) {
    const d = sums.get(e.debitId)
    if (d) d.debit += e.amount
    const c = sums.get(e.creditId)
    if (c) c.credit += e.amount
  }
  const rows = accounts.map((account) => {
    const { debit, credit } = sums.get(account.id)
    const debitSide = account.type === 'asset' || account.type === 'expense'
    return { account, debit, credit, balance: debitSide ? debit - credit : credit - debit, used: debit > 0 || credit > 0 }
  })
  const debitTotal = sum(rows, (r) => r.debit)
  const creditTotal = sum(rows, (r) => r.credit)
  return { rows, debitTotal, creditTotal, balanced: debitTotal === creditTotal }
}

// 区分（'asset' / 'liability' など）ごとの合計の行。rows は accountBalances の rows。その区分の全科目の借方合計・貸方合計・残高を足す
// （画面に出ない科目は0なので、画面に出ている行の合計と一致する）
export function typeTotals(rows, type) {
  const own = rows.filter((r) => r.account.type === type)
  return { debit: sum(own, (r) => r.debit), credit: sum(own, (r) => r.credit), balance: sum(own, (r) => r.balance) }
}

// 自由に使える額 ＝ role が cash の資産の残高合計 − 負債の残高合計（取り分け・その他の資産は含めない。使わない科目も含める）
// items：画面に並べる内訳（現金類のうち残高が0でないもの。負債があるときは、最後に「負債」を負の値で足す）
export function freeAmount(accounts, entries) {
  const { rows } = accountBalances(accounts, entries)
  const cash = rows.filter((r) => r.account.type === 'asset' && r.account.role === 'cash')
  const cashTotal = sum(cash, (r) => r.balance)
  const liabilityTotal = sum(rows.filter((r) => r.account.type === 'liability'), (r) => r.balance)
  const items = cash.filter((r) => r.balance !== 0).map((r) => ({ id: r.account.id, name: r.account.name, balance: r.balance }))
  if (liabilityTotal !== 0) items.push({ id: 'liability', name: TYPE_LABELS.liability, balance: -liabilityTotal })
  return { total: cashTotal - liabilityTotal, cashTotal, liabilityTotal, items }
}

// クレカ未払い（key: credit-card）の分割。今日は呼ぶ側から渡す（当月は today の年月）。key の科目がなければ null
// 当月の利用額 ＝ 当月の貸方合計（opening は除く）。次の引き落とし分 ＝ 残高 − 当月の利用額。月別は新しい月から
export function creditCardSplit(accounts, entries, today) {
  const account = accounts.find((a) => a.key === 'credit-card')
  if (!account) return null
  const balance = accountBalances(accounts, entries).rows.find((r) => r.account.id === account.id).balance
  const byMonth = {}
  for (const e of entries) {
    if (e.creditId !== account.id || e.kind === 'opening') continue
    const month = e.date.slice(0, 7)
    byMonth[month] = (byMonth[month] ?? 0) + e.amount
  }
  const thisMonth = byMonth[today.slice(0, 7)] ?? 0
  const monthly = Object.entries(byMonth).map(([month, amount]) => ({ month, amount })).sort((a, b) => b.month.localeCompare(a.month))
  return { account, balance, thisMonth, next: balance - thisMonth, monthly }
}

// 取り分け（role が earmark の資産）ごとの履歴。借方＝取り分けた（+）、貸方＝取り崩した（−）。日付順、累計つき
// 出す科目：active の科目と、仕訳がある科目
export function savingsHistory(accounts, entries) {
  const sorted = [...entries].sort(byDateThenCreated)
  return accounts
    .filter((a) => a.type === 'asset' && a.role === 'earmark')
    .map((account) => {
      let total = 0
      const rows = []
      for (const entry of sorted) {
        const delta = entry.debitId === account.id ? entry.amount : entry.creditId === account.id ? -entry.amount : 0
        if (!delta) continue
        total += delta
        rows.push({ entry, delta, total })
      }
      return { account, balance: total, rows }
    })
    .filter((h) => h.account.active || h.rows.length)
}

// ---- 月次（月の集計・P/L・B/S） ----

// 初期表示の月：今日の前月（'YYYY-MM-DD' → 'YYYY-MM'）。今日は呼ぶ側から渡す
export function previousMonth(today) {
  let year = Number(today.slice(0, 4))
  let month = Number(today.slice(5, 7)) - 1
  if (month === 0) { year -= 1; month = 12 }
  return `${year}-${String(month).padStart(2, '0')}`
}

// 月の集計とP/L。month は 'YYYY-MM'。開始残高（opening）は数えない。
// 残高調整（key: adjust-gain / adjust-loss の科目）は、通常の収益・費用に入れず、adjustment に別に出す。
// revenue / expense は、その月に仕訳がある科目だけ（expense は多い順、同じ額は科目の並び順）
export function monthReport(accounts, entries, month) {
  const { rows } = accountBalances(accounts, entries.filter((e) => e.kind !== 'opening' && e.date.startsWith(month)))
  const pick = (type, adjustKey) => rows.filter((r) => r.account.type === type && r.account.key !== adjustKey && r.used).map((r) => ({ account: r.account, amount: r.balance }))
  const revenue = pick('revenue', 'adjust-gain')
  const expense = pick('expense', 'adjust-loss').sort((a, b) => b.amount - a.amount) // sort は安定。同額は元の並び順
  const adjusted = (key) => rows.find((r) => r.account.key === key)?.balance ?? 0
  const gain = adjusted('adjust-gain')
  const loss = adjusted('adjust-loss')
  const revenueTotal = sum(revenue, (r) => r.amount)
  const expenseTotal = sum(expense, (r) => r.amount)
  return { month, revenue, expense, revenueTotal, expenseTotal, result: revenueTotal - expenseTotal, adjustment: { gain, loss, net: gain - loss } }
}

// B/S：その月の最終日までの全仕訳で計算する。assets / liabilities / equity は、その時点までに仕訳がある科目
// 純資産 ＝ 純資産の科目の残高合計（開始残高など）＋ 累計の収支（全ての収益 − 全ての費用。調整益・調整損も含む）
// balanced：資産合計 ＝ 負債合計 ＋ 純資産合計（合わないとき、画面にエラーを出す）
export function balanceSheet(accounts, entries, month) {
  const { rows } = accountBalances(accounts, entries.filter((e) => e.date.slice(0, 7) <= month))
  const part = (type) => rows.filter((r) => r.account.type === type && r.used).map((r) => ({ account: r.account, balance: r.balance }))
  const total = (type) => sum(rows.filter((r) => r.account.type === type), (r) => r.balance)
  const assets = part('asset')
  const liabilities = part('liability')
  const equity = part('equity')
  const profit = total('revenue') - total('expense')
  const assetTotal = total('asset')
  const liabilityTotal = total('liability')
  const equityTotal = total('equity') + profit
  const liabilityEquityTotal = liabilityTotal + equityTotal
  return { month, assets, assetTotal, liabilities, liabilityTotal, equity, profit, equityTotal, liabilityEquityTotal, balanced: assetTotal === liabilityEquityTotal }
}

// B/S の勘定式の並び（左：資産の部、右：負債の部と純資産の部）。結果は balanceSheet のものを並べるだけ。
// セルは { kind: 'head' | 'item' | 'subtotal', name, amount }（head の amount は null）。下の合計は leftTotal（資産合計）と rightTotal（負債・純資産合計）
export function balanceSheetColumns(sheet) {
  const head = (name) => ({ kind: 'head', name, amount: null })
  const item = (name, amount) => ({ kind: 'item', name, amount })
  const subtotal = (name, amount) => ({ kind: 'subtotal', name, amount })
  const items = (list) => list.map((r) => item(r.account.name, r.balance))
  return {
    left: [head('자산'), ...items(sheet.assets)],
    right: [
      head('부채'), ...items(sheet.liabilities), subtotal('부채 합계', sheet.liabilityTotal),
      head('순자산'), ...items(sheet.equity), item('누적 손익', sheet.profit), subtotal('순자산 합계', sheet.equityTotal),
    ],
    leftTotal: { name: '자산 합계', amount: sheet.assetTotal },
    rightTotal: { name: '부채・순자산 합계', amount: sheet.liabilityEquityTotal },
  }
}

// P/L の報告書の形の並び（収益の部、費用の部、当期収支、その下に残高調整）。結果は monthReport のものを並べるだけ。
// 行は { kind: 'head' | 'item' | 'none' | 'subtotal' | 'total', name, amount }。残高調整は、調整益・調整損があるときだけ
export function profitLossRows(report) {
  const head = (name) => ({ kind: 'head', name, amount: null })
  const part = (title, list, totalName, total) => [
    head(title),
    ...(list.length ? list.map((r) => ({ kind: 'item', name: r.account.name, amount: r.amount })) : [{ kind: 'none', name: '해당 없음', amount: null }]),
    { kind: 'subtotal', name: totalName, amount: total },
  ]
  const { gain, loss, net } = report.adjustment
  return [
    ...part('수익', report.revenue, '수익 합계', report.revenueTotal),
    ...part('비용(많은 순)', report.expense, '비용 합계', report.expenseTotal),
    { kind: 'total', name: '당기 손익(수익 − 비용)', amount: report.result },
    ...(gain !== 0 || loss !== 0
      ? [head('잔액 조정(보통의 손익에는 넣지 않습니다)'), { kind: 'item', name: '조정이익', amount: gain }, { kind: 'item', name: '조정손실', amount: loss }, { kind: 'subtotal', name: '차감', amount: net }]
      : []),
  ]
}

// ---- 残高調整 ----

// 画面の選択肢：active の資産と負債（balance は今の記録上の残高）
export function adjustmentRows(accounts, entries) {
  const shown = new Set(openingAccounts(accounts).map((a) => a.id))
  return accountBalances(accounts, entries).rows.filter((r) => shown.has(r.account.id))
}

// 残高調整の計画（保存はしない）。差額 ＝ 実際の残高 − 記録上の残高。日付は today（呼ぶ側から渡す）
// 成功: { account, current, actual, diff, amount, kindLabel, entry, entries } / 差額0: { none: true, account, current } / 失敗: { error }
// 資産が実際より少ない：借方＝その科目・貸方＝調整益。多い：借方＝調整損・貸方＝その科目。負債は逆。調整益・調整損は key で探す
export function planAdjustment(accounts, entries, accountId, actualText, today, now = new Date().toISOString()) {
  if (!isDate(today)) return { error: '날짜가 올바르지 않습니다' }
  const row = adjustmentRows(accounts, entries).find((r) => r.account.id === accountId)
  if (!row) return { error: '계정과목을 골라 주세요' }
  const gainId = accounts.find((a) => a.key === 'adjust-gain')?.id
  const lossId = accounts.find((a) => a.key === 'adjust-loss')?.id
  if (!gainId || !lossId) return { error: '조정이익・조정손실 계정과목을 찾을 수 없습니다' }
  if (actualText === '') return { error: '実際の残高を入力してください' } // 空欄を0とは読まない
  const parsed = parseOpeningAmount(actualText)
  if (parsed.error) return { error: parsed.error }
  const { account, balance: current } = row
  const actual = parsed.amount
  const diff = actual - current
  if (diff === 0) return { none: true, account, current }
  const gain = (account.type === 'asset') === (diff > 0) // 調整益：借方＝その科目。調整損：貸方＝その科目
  const entry = {
    id: crypto.randomUUID(), date: today,
    debitId: gain ? account.id : lossId, creditId: gain ? gainId : account.id,
    amount: Math.abs(diff), memo: '', kind: 'adjustment', createdAt: now, updatedAt: now,
  }
  return { account, current, actual, diff, amount: entry.amount, kindLabel: gain ? '조정이익' : '조정손실', entry, entries: [...entries, entry] }
}

// ---- 定期支払い（サブスク） ----
// 今日（'YYYY-MM-DD'）と now は呼ぶ側から渡す。月末日は表で求め、Date は使わない。

export function daysInMonth(month) {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  if (m === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(m) ? 30 : 31
}

// その月にある日付。31日などその月にない日は、月末日として扱う
export const subscriptionDate = (month, day) => `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`

export function nextMonth(month) {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
}

// 登録した日・「使う」に戻した日の lastMonth（最後に記入した月）。
// 今月の指定日が今日以降なら前月（今月の分はこれから記入する）、過ぎていれば今月（さかのぼらない）
export const initialLastMonth = (day, today) => (subscriptionDate(today.slice(0, 7), day) >= today ? previousMonth(today) : today.slice(0, 7))

// 入力の検証。借方・貸方は、仕訳の入力と同じ選択肢（3つの特別科目を除く）。currentIds は編集中の定期支払いが今使っている科目
export function validateSubscriptionInput({ name, memo, amountText, dayText, debitId, creditId }, accounts, currentIds = []) {
  const n = typeof name === 'string' ? name.trim() : ''
  if (!n) return { error: '이름을 입력해 주세요' }
  const a = parseAmount(amountText)
  if (a.error) return a
  if (!/^([1-9]|[12]\d|3[01])$/.test(dayText)) return { error: '매월의 날은 1~31의 반각 숫자로 입력해 주세요' }
  const ids = new Set(entryAccountOptions(accounts, currentIds).map((x) => x.id))
  if (!ids.has(debitId) || !ids.has(creditId)) return { error: '차변과 대변의 계정과목을 골라 주세요' }
  if (debitId === creditId) return { error: '차변과 대변에 같은 계정과목은 고를 수 없습니다' }
  return { name: n, memo: typeof memo === 'string' ? memo : '', amount: a.amount, day: Number(dayText), debitId, creditId }
}

export const newSubscription = (input, today, now = new Date().toISOString()) => ({
  id: crypto.randomUUID(),
  name: input.name,
  memo: input.memo,
  amount: input.amount,
  day: input.day,
  debitId: input.debitId,
  creditId: input.creditId,
  active: true,
  lastMonth: initialLastMonth(input.day, today),
  createdAt: now,
  updatedAt: now,
})

// id・createdAt・active・lastMonth は保つ（日を変えても、記入済みの月は二重にならない）
export const editSubscription = (sub, input, now = new Date().toISOString()) => ({
  ...sub,
  name: input.name,
  memo: input.memo,
  amount: input.amount,
  day: input.day,
  debitId: input.debitId,
  creditId: input.creditId,
  updatedAt: now,
})

// 使う・使わないの切り替え。「使う」に戻すときは、止めていた間の分をさかのぼらない（今日すでに記入した分も、もう一度出さない）
export function setSubscriptionActive(sub, active, today, now = new Date().toISOString()) {
  const base = initialLastMonth(sub.day, today)
  const lastMonth = active && !sub.active && base > sub.lastMonth ? base : sub.lastMonth
  return { ...sub, active, lastMonth, updatedAt: now }
}

// 自動記入：active の定期支払いについて、lastMonth の次の月から今月まで、指定日が今日以前の月の分を、その日付の通常の仕訳として足す。
// 記入した月まで lastMonth を進める（保存されるので、何回呼んでも、同じ月は二重にならない。仕訳を削除しても作り直さない）。
// 何も記入しないときは、渡した配列をそのまま返す。元の配列は変えない
export function applySubscriptions(subscriptions, entries, today, now = new Date().toISOString()) {
  const added = []
  const next = subscriptions.map((sub) => {
    if (!sub.active) return sub
    let lastMonth = sub.lastMonth
    for (let month = nextMonth(lastMonth); month <= today.slice(0, 7); month = nextMonth(month)) {
      const date = subscriptionDate(month, sub.day)
      if (date > today) break // 今月で、指定日がまだ来ていない
      added.push({ id: crypto.randomUUID(), date, debitId: sub.debitId, creditId: sub.creditId, amount: sub.amount, memo: sub.name, kind: 'normal', createdAt: now, updatedAt: now })
      lastMonth = month
    }
    return lastMonth === sub.lastMonth ? sub : { ...sub, lastMonth, updatedAt: now }
  })
  if (added.length === 0) return { subscriptions, entries, added: 0 }
  return { subscriptions: next, entries: [...entries, ...added], added: added.length }
}

// ---- 元帳 ----

// 科目1つの元帳。month は 'YYYY-MM'（'' は全期間）。仕訳は日付の古い順（同じ日は作成日時順、同じなら id 順）。
// balance は、その行までの累計（向きは accountBalances と同じ：資産・費用は借方 − 貸方、それ以外は貸方 − 借方）。
// 月で絞り込んだときは、その月より前の仕訳だけの残高を carryOver（前月までの繰越）にして、そこから累計する。全期間のとき carryOver は null。
// total はその科目の仕訳の総数（全期間）。科目が見つからなければ null。元の配列は変えない
export function ledgerBook(accounts, entries, accountId, month = '') {
  const account = accounts.find((a) => a.id === accountId)
  if (!account) return null
  const own = entries.filter((e) => e.debitId === accountId || e.creditId === accountId)
  const carryOver = month
    ? accountBalances(accounts, own.filter((e) => e.date.slice(0, 7) < month)).rows.find((r) => r.account.id === accountId).balance
    : null
  const debitSide = account.type === 'asset' || account.type === 'expense'
  let balance = carryOver ?? 0
  const rows = own
    .filter((e) => !month || e.date.slice(0, 7) === month)
    .sort(byDateThenCreated)
    .map((entry) => {
      const isDebit = entry.debitId === accountId
      balance += (isDebit === debitSide ? 1 : -1) * entry.amount
      return { entry, otherId: isDebit ? entry.creditId : entry.debitId, debit: isDebit ? entry.amount : null, credit: isDebit ? null : entry.amount, balance }
    })
  return { account, total: own.length, carryOver, rows, balance }
}
