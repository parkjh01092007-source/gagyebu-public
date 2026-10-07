// 実行: node src/ledgerLogic.check.js
import assert from 'node:assert/strict'
import {
  makeInitialAccounts, validateAccountName, canDeleteAccount, canChangeType, isProtected, changeType, newAccount,
  isDate, parseAmount, entryAccountOptions, validateEntryInput, newEntry, editEntry, entriesOfMonth, lastCreditId,
  formatYen, canEditEntry, groupByType, groupEntriesByDate, addKeys, SPECIAL_KEYS,
  openingAccounts, parseOpeningAmount, openingInitial, planOpening,
  accountBalances, freeAmount, creditCardSplit, savingsHistory,
  previousMonth, monthReport, balanceSheet, typeTotals, adjustmentRows, planAdjustment,
  daysInMonth, subscriptionDate, nextMonth, initialLastMonth, validateSubscriptionInput, newSubscription, editSubscription,
  setSubscriptionActive, applySubscriptions, ledgerBook, balanceSheetColumns, profitLossRows,
} from './ledgerLogic.js'

const initial = makeInitialAccounts()
const count = (type, role) => initial.filter((a) => a.type === type && (!role || a.role === role)).length

assert.equal(initial.length, 21)
assert.equal(count('asset', 'cash'), 2)
assert.equal(count('asset', 'earmark'), 1)
assert.equal(count('asset', 'other'), 2)
assert.equal(count('liability'), 2)
assert.equal(count('revenue'), 3)
assert.equal(count('expense'), 10)
assert.equal(count('equity'), 1)
assert.ok(initial.every((a) => a.active && (a.type === 'asset' ? a.role : a.role === undefined)))
assert.equal(new Set(initial.map((a) => a.id)).size, 21)
assert.equal(new Set(initial.map((a) => a.name)).size, 21)

// 以降の試験は、元の試験の数値（現金類が3つ）を保つため、初期科目に「간편결제 잔액」（利用者が足した現金類）を1つ足して使う
const accounts = [...initial, newAccount('간편결제 잔액', 'asset', 'cash')]
const by = (name) => accounts.find((a) => a.name === name)
const byKey = (key) => accounts.find((a) => a.key === key)

// 名前：前後空白除去・空不可・重複不可（自分自身は可）
assert.equal(validateAccountName('  交際費 ', accounts).name, '交際費')
assert.ok(validateAccountName('   ', accounts).error)
assert.ok(validateAccountName('식비 ', accounts).error)
assert.equal(validateAccountName('식비', accounts, by('식비').id).name, '식비')

// 保護科目と、仕訳がある科目
const entries = [{ debitId: by('식비').id, creditId: by('현금').id }]
for (const k of SPECIAL_KEYS) {
  assert.ok(isProtected(byKey(k)))
  assert.ok(!canDeleteAccount(byKey(k), []))
  assert.ok(!canChangeType(byKey(k), []))
}
assert.ok(canDeleteAccount(by('교통비'), entries))
assert.ok(!canDeleteAccount(by('식비'), entries)) // 借方にある
assert.ok(!canDeleteAccount(by('현금'), entries)) // 貸方にある
assert.ok(!canChangeType(by('식비'), entries))
assert.ok(canChangeType(by('교통비'), entries))

// type 変更時の role
assert.equal(changeType(by('교통비'), 'asset', 'cash').role, 'cash')
assert.ok(!('role' in changeType(by('현금'), 'expense')))
assert.ok(!('role' in newAccount('x', 'liability', 'cash')))

// 金額：半角数字のみ
assert.equal(parseAmount('1200').amount, 1200)
for (const t of ['1.5', '-100', '0', '1e3', '１２００', '', '1,000', ' 5', '007', '9'.repeat(20)]) assert.ok(parseAmount(t).error, t)

// 日付：実在する日付のみ
assert.ok(isDate('2026-10-02') && isDate('2028-02-29'))
for (const d of ['', '2026-02-30', '2026-13-01', '2026-1-2', '20261002', undefined]) assert.ok(!isDate(d), String(d))

// 選択肢：3科目を除き、クレカ未払いは残す。inactive は出ない。currentIds は残る
const names = (list) => list.map((a) => a.name)
const opts = names(entryAccountOptions(accounts))
for (const n of ['시작 잔액', '조정이익', '조정손실']) assert.ok(!opts.includes(n), n)
assert.ok(opts.includes('카드 미결제') && opts.includes('식비'))
const off = accounts.map((a) => (a.name === '교통비' ? { ...a, active: false } : a))
assert.ok(!names(entryAccountOptions(off)).includes('교통비'))
assert.ok(names(entryAccountOptions(off, [by('교통비').id])).includes('교통비'))

// 入力の検証
const ok = { date: '2026-10-02', debitId: by('식비').id, creditId: by('카드 미결제').id, amountText: '1200' }
assert.deepEqual(validateEntryInput(ok, accounts), { date: '2026-10-02', debitId: ok.debitId, creditId: ok.creditId, amount: 1200 })
assert.ok(validateEntryInput({ ...ok, date: '' }, accounts).error)
assert.ok(validateEntryInput({ ...ok, date: '2026-02-30' }, accounts).error)
assert.ok(validateEntryInput({ ...ok, amountText: '1.5' }, accounts).error)
assert.ok(validateEntryInput({ ...ok, creditId: ok.debitId }, accounts).error)
assert.ok(validateEntryInput({ ...ok, debitId: '' }, accounts).error)
assert.ok(validateEntryInput({ ...ok, debitId: 'nope' }, accounts).error)

// 作成・編集・月別・前回の貸方
const e1 = newEntry(validateEntryInput(ok, accounts), '', '2026-10-02T00:00:00.000Z')
assert.equal(e1.kind, 'normal')
const e2 = newEntry({ ...validateEntryInput(ok, accounts), date: '2026-10-01', creditId: by('현금').id }, 'm', '2026-10-03T00:00:00.000Z')
const e3 = { ...e1, id: 'x', date: '2026-11-01', kind: 'opening', createdAt: '2026-10-04T00:00:00.000Z' }
assert.deepEqual(entriesOfMonth([e1, e2, e3], '2026-10').map((e) => e.id), [e2.id, e1.id])
assert.equal(lastCreditId([e1, e2, e3]), by('현금').id) // opening は対象外
assert.equal(lastCreditId([e3]), '')
const e4 = editEntry(e1, { ...validateEntryInput(ok, accounts), amount: 5 }, 'x', '2026-12-01T00:00:00.000Z')
assert.deepEqual([e4.id, e4.kind, e4.createdAt, e4.amount, e4.updatedAt], [e1.id, 'normal', e1.createdAt, 5, '2026-12-01T00:00:00.000Z'])
assert.ok(canEditEntry(e1) && !canEditEntry(e3))
assert.equal(formatYen(1234567), '1,234,567')

// 区分ごとのグループ：順番は資産・負債・収益・費用、グループ内は元の並び順
const groups = groupByType(entryAccountOptions(accounts))
assert.deepEqual(groups.map((g) => g.label), ['자산', '부채', '수익', '비용'])
assert.deepEqual(groups[0].accounts.map((a) => a.name), ['현금', '은행 계좌', '비상금', '적금・예금', '투자', '간편결제 잔액'])
assert.deepEqual(groups[1].accounts.map((a) => a.name), ['카드 미결제', '미지급금'])
assert.equal(groups.reduce((n, g) => n + g.accounts.length, 0), entryAccountOptions(accounts).length)

// 日付ごとの枠：日付の古い順、枠の中は createdAt → id の順
const mk = (id, date, createdAt) => ({ id, date, createdAt })
const g0 = [mk('c', '2026-10-05', 't1'), mk('b', '2026-10-02', 't2'), mk('a', '2026-10-02', 't2'), mk('d', '2026-10-02', 't1')]
const snapshot = JSON.stringify(g0)
const g1 = groupEntriesByDate(g0)
assert.deepEqual(g1.map((g) => g.date), ['2026-10-02', '2026-10-05'])
assert.deepEqual(g1[0].entries.map((e) => e.id), ['d', 'a', 'b']) // t1 → t2（同じ t2 は id 順）
assert.equal(JSON.stringify(g0), snapshot) // 元の配列は変わらない
assert.deepEqual(groupEntriesByDate([...g0].reverse()), g1) // 入力順に依らない
// 日付を変えた仕訳は新しい枠に移り、そこで createdAt の順に並ぶ
const g2 = groupEntriesByDate(g0.map((e) => (e.id === 'd' ? { ...e, date: '2026-10-05', createdAt: 't0' } : e)))
assert.deepEqual(g2.map((g) => [g.date, g.entries.map((e) => e.id)]), [['2026-10-02', ['a', 'b']], ['2026-10-05', ['d', 'c']]])
assert.deepEqual(groupEntriesByDate([]), [])

// key：特別科目の4つだけが持つ。重複なし。対応は決まっている
assert.deepEqual(accounts.filter((a) => a.key).map((a) => a.key).sort(), [...SPECIAL_KEYS].sort())
assert.equal(byKey('opening').name, '시작 잔액')
assert.equal(byKey('adjust-gain').name, '조정이익')
assert.equal(byKey('adjust-loss').name, '조정손실')
assert.equal(byKey('credit-card').name, '카드 미결제')
// 名前を変えても、保護と選択肢の除外は変わらない
const renamed = accounts.map((a) => (a.key ? { ...a, name: `${a.name}2` } : a))
const rn = (k) => renamed.find((a) => a.key === k)
for (const k of SPECIAL_KEYS) assert.ok(isProtected(rn(k)) && !canDeleteAccount(rn(k), []) && !canChangeType(rn(k), []), k)
const ropts = entryAccountOptions(renamed)
for (const k of ['opening', 'adjust-gain', 'adjust-loss']) assert.ok(!ropts.includes(rn(k)), k)
assert.ok(ropts.includes(rn('credit-card')))
// addKeys：名前で4科目に key を付ける。欠けたら error。元は変えない
const LEGACY_NAMES = { opening: '開始残高', 'adjust-gain': '調整益', 'adjust-loss': '調整損', 'credit-card': 'クレカ未払い' } // v2 の名前
const legacy = accounts.map(({ key, ...a }) => (key ? { ...a, name: LEGACY_NAMES[key] } : a))
const legacySnap = JSON.stringify(legacy)
const added = addKeys(legacy).accounts
assert.deepEqual(added, accounts.map((a) => ({ ...a, ...(a.key && { name: LEGACY_NAMES[a.key] }) }))) // key だけが付く（INITIAL と同じ並び・中身。名前は v2 のまま）
assert.equal(JSON.stringify(legacy), legacySnap)
assert.ok(addKeys(legacy.filter((a) => a.name !== '調整損')).error)
assert.ok(addKeys(legacy.filter((a) => a.name !== 'クレカ未払い')).error)
// ---- 開始残高 ----
// 金額：空欄と0は可。それ以外は半角数字のみ
assert.equal(parseOpeningAmount('').amount, 0)
assert.equal(parseOpeningAmount('0').amount, 0)
assert.equal(parseOpeningAmount('100000').amount, 100000)
for (const t of ['1.5', '-100', '1e3', '１２００', '1,000', '007', ' 5', '9'.repeat(20)]) assert.ok(parseOpeningAmount(t).error, t)
// 画面に出る科目：active の資産と負債だけ
const shownNames = names(openingAccounts(accounts))
assert.ok(shownNames.includes('현금') && shownNames.includes('카드 미결제') && shownNames.includes('미지급금'))
for (const n of ['식비', '시작 잔액', '월급', '조정이익']) assert.ok(!shownNames.includes(n), n)
const offAsset = accounts.map((a) => (a.name === '투자' ? { ...a, active: false } : a))
assert.ok(!names(openingAccounts(offAsset)).includes('투자'))

const T = (name) => by(name).id
const texts = { [T('은행 계좌')]: '100000', [T('간편결제 잔액')]: '5000', [T('현금')]: '3000', [T('카드 미결제')]: '20000' }
const NOW = '2026-10-04T00:00:00.000Z'
const LATER = '2026-10-05T00:00:00.000Z'
const p1 = planOpening(accounts, [], '2026-10-01', texts, NOW)
// 完成条件22：4件作られ、同じ日付、向きは資産=借方に科目・負債=貸方に科目
assert.equal(p1.entries.length, 4)
assert.deepEqual([p1.created, p1.updated, p1.deleted], [4, 0, 0])
assert.ok(p1.entries.every((e) => e.kind === 'opening' && e.date === '2026-10-01' && e.memo === '' && Number.isInteger(e.amount)))
const oe = (name) => p1.entries.find((e) => e.debitId === T(name) || e.creditId === T(name))
assert.deepEqual([oe('은행 계좌').debitId, oe('은행 계좌').creditId, oe('은행 계좌').amount], [T('은행 계좌'), byKey('opening').id, 100000])
assert.deepEqual([oe('카드 미결제').debitId, oe('카드 미결제').creditId, oe('카드 미결제').amount], [byKey('opening').id, T('카드 미결제'), 20000])
assert.equal(p1.earlier, null)
// 完成条件23：同じ内容で入れ直すと増えず、変更なし。金額を変えると同じidのまま直る。空・0で消える
const p2 = planOpening(accounts, p1.entries, '2026-10-01', texts, LATER)
assert.deepEqual([p2.entries.length, p2.created, p2.updated, p2.deleted], [4, 0, 0, 0])
assert.deepEqual(p2.entries, p1.entries)
const p3 = planOpening(accounts, p1.entries, '2026-10-01', { ...texts, [T('은행 계좌')]: '120000' }, LATER)
assert.deepEqual([p3.entries.length, p3.created, p3.updated, p3.deleted], [4, 0, 1, 0])
const yu = p3.entries.find((e) => e.id === oe('은행 계좌').id)
assert.deepEqual([yu.amount, yu.createdAt, yu.updatedAt], [120000, NOW, LATER])
for (const v of ['', '0']) {
  const p4 = planOpening(accounts, p1.entries, '2026-10-01', { ...texts, [T('간편결제 잔액')]: v })
  assert.deepEqual([p4.entries.length, p4.deleted], [3, 1])
  assert.ok(!p4.entries.some((e) => e.debitId === T('간편결제 잔액')))
}
assert.equal(planOpening(accounts, [], '2026-10-01', { [T('현금')]: '0' }).entries.length, 0) // 0で、仕訳がなければ何も作らない
// 開始日を変えて保存すると、全部の日付が新しい日付になる
const p5 = planOpening(accounts, p1.entries, '2026-09-15', texts)
assert.ok(p5.entries.length === 4 && p5.updated === 4 && p5.entries.every((e) => e.date === '2026-09-15'))
// 完成条件24：開始日より前の通常の仕訳だけを数える
const nrm = (id, date, kind = 'normal') => ({ id, date, debitId: T('식비'), creditId: T('현금'), amount: 100, memo: '', kind, createdAt: 't', updatedAt: 't' })
const withNormal = [nrm('n1', '2026-09-30'), nrm('n2', '2026-09-10'), nrm('n3', '2026-10-01'), nrm('n4', '2026-10-02'), nrm('n5', '2026-08-01', 'adjustment')]
assert.deepEqual(planOpening(accounts, withNormal, '2026-10-01', texts).earlier, { count: 2, first: '2026-09-10' })
assert.equal(planOpening(accounts, withNormal, '2026-09-10', texts).earlier, null)
assert.deepEqual(planOpening(accounts, [...p1.entries, ...withNormal], '2026-10-01', texts).earlier, { count: 2, first: '2026-09-10' }) // opening は数えない
// 名前を変えても動く／開始残高の科目がなければエラー
const renamedOpening = accounts.map((a) => (a.key === 'opening' ? { ...a, name: 'スタート' } : a))
assert.deepEqual(planOpening(renamedOpening, p1.entries, '2026-10-01', texts).entries, p1.entries)
assert.ok(planOpening(accounts.filter((a) => a.key !== 'opening'), [], '2026-10-01', texts).error)
// エラー：日付・金額。元の entries は変わらない
const snapE = JSON.stringify(p1.entries)
for (const d of ['', '2026-02-30', '2026-10-1']) assert.ok(planOpening(accounts, p1.entries, d, texts).error, d)
const bad1 = planOpening(accounts, p1.entries, '2026-10-01', { ...texts, [T('현금')]: '1.5' })
assert.ok(bad1.error && bad1.error.includes('현금'))
assert.equal(planOpening(accounts, p1.entries, '2026-10-01', { ...texts, [T('현금')]: '' }).entries.length, 3)
assert.equal(JSON.stringify(p1.entries), snapE)
// 使わない科目の仕訳は触らない（画面に出ないので、日付も金額もそのまま）
const hide = (name) => accounts.map((a) => (a.name === name ? { ...a, active: false } : a))
const p6 = planOpening(hide('현금'), p1.entries, '2026-09-15', { ...texts, [T('현금')]: '' })
assert.deepEqual(p6.entries.find((e) => e.debitId === T('현금')), oe('현금'))
// 同じ科目に2件：先頭（createdAt が古い順、同じなら id 順）を残し、残りを消す
const dup = (id, createdAt, amount) => ({ ...oe('현금'), id, createdAt, amount })
const twoEntries = [dup('b', 't2', 700), dup('a', 't2', 800), dup('c', 't1', 900)]
const ordered = (list) => planOpening(accounts, list, '2026-10-01', { [T('현금')]: '1000' }, NOW).entries
assert.deepEqual(ordered(twoEntries).map((e) => [e.id, e.amount]), [['c', 1000]]) // t1 が先頭
assert.deepEqual(ordered(twoEntries.slice(0, 2)).map((e) => [e.id, e.amount]), [['a', 1000]]) // 同じ t2 は id 順
assert.deepEqual(ordered([...twoEntries].reverse()), ordered(twoEntries)) // 並び順に依らない
// openingInitial：仕訳なしは today、あれば最も古い日付と金額。先頭の規則は planOpening と同じ
assert.deepEqual(openingInitial(accounts, [], '2026-10-04'), { date: '2026-10-04', amounts: {} })
const ini = openingInitial(accounts, p1.entries, '2026-10-04')
assert.equal(ini.date, '2026-10-01')
assert.deepEqual(ini.amounts, { [T('은행 계좌')]: '100000', [T('간편결제 잔액')]: '5000', [T('현금')]: '3000', [T('카드 미결제')]: '20000' })
assert.equal(openingInitial(accounts, twoEntries, 'x').amounts[T('현금')], '900') // 先頭 = c
assert.equal(openingInitial(accounts, twoEntries.slice(0, 2), 'x').amounts[T('현금')], '800') // 先頭 = a
// 使わない科目の仕訳は見ない：古い日付があっても無視。画面に出る科目に仕訳がなければ today
const oldHidden = { ...oe('현금'), id: 'old', date: '2020-01-01' }
const withOld = [...p1.entries.filter((e) => e.debitId !== T('현금')), oldHidden]
assert.equal(openingInitial(hide('현금'), withOld, 'x').date, '2026-10-01')
assert.ok(!(T('현금') in openingInitial(hide('현금'), withOld, 'x').amounts))
assert.deepEqual(openingInitial(hide('현금'), [oldHidden], '2026-10-04'), { date: '2026-10-04', amounts: {} })

// ---- 残高・自由に使える額・クレカ・貯蓄 ----
const mkE = (id, date, debit, credit, amount, kind = 'normal') => ({ id, date, debitId: T(debit), creditId: T(credit), amount, memo: '', kind, createdAt: id, updatedAt: id })
const balOf = (accs, es, id) => accountBalances(accs, es).rows.find((r) => r.account.id === id).balance
const free = (es, accs = accounts) => freeAmount(accs, es).total
const base = p1.entries // 開始残高：ゆうちょ100000、PayPay5000、現金3000、クレカ未払い20000（2026-10-01）
// 完成条件1：自由に使える額 88000。内訳は残高0でない現金類と、最後に負債（負の値）
const f1 = freeAmount(accounts, base)
assert.deepEqual([f1.total, f1.cashTotal, f1.liabilityTotal], [88000, 108000, 20000])
assert.deepEqual(f1.items.map((i) => [i.name, i.balance]), [['현금', 3000], ['은행 계좌', 100000], ['간편결제 잔액', 5000], ['부채', -20000]])
assert.deepEqual(freeAmount(accounts, []).items, []) // 残高0の科目は出ない。負債が0なら「負債」も出ない
// 完成条件2：クレカで食費1200
const cardUse = mkE('e1', '2026-10-02', '식비', '카드 미결제', 1200)
const s2 = [...base, cardUse]
assert.equal(balOf(accounts, s2, T('카드 미결제')), 21200)
assert.equal(balOf(accounts, s2, T('식비')), 1200)
assert.equal(free(s2), 86800)
// 完成条件3：引き落とし21200 → クレカ未払い0、ゆうちょ78800、自由に使える額は変わらない
const s3 = [...s2, mkE('e2', '2026-10-27', '카드 미결제', '은행 계좌', 21200)]
assert.equal(balOf(accounts, s3, T('카드 미결제')), 0)
assert.equal(balOf(accounts, s3, T('은행 계좌')), 78800)
assert.equal(free(s3), 86800)
assert.ok(!freeAmount(accounts, s3).items.some((i) => i.name === '부채'))
// 完成条件4：ゆうちょ→PayPayのチャージ3000
const s4 = [...s3, mkE('e3', '2026-10-28', '간편결제 잔액', '은행 계좌', 3000)]
assert.equal(balOf(accounts, s4, T('은행 계좌')), 75800)
assert.equal(balOf(accounts, s4, T('간편결제 잔액')), 8000)
assert.equal(free(s4), 86800)
assert.equal(balOf(accounts, s4, T('식비')), 1200)
// 完成条件5：取り分け10000 → ゆうちょ-10000、PC貯蓄+10000、自由に使える額が10000減る（取り分けは含めないので、引かない）
const s5 = [...s4, mkE('e4', '2026-10-29', '비상금', '은행 계좌', 10000)]
assert.equal(balOf(accounts, s5, T('은행 계좌')), 65800)
assert.equal(balOf(accounts, s5, T('비상금')), 10000)
assert.equal(free(s5), 76800)
// 完成条件6：前払金に3000払い、残額11000を準備金 → 自由に使える額が合計14000減る。娯楽に振り替えても変わらない
const g = [...base, mkE('g1', '2026-10-05', '적금・예금', '현금', 3000), mkE('g2', '2026-10-05', '적금・예금', '미지급금', 11000)]
assert.equal(balOf(accounts, g, T('적금・예금')), 14000)
assert.equal(balOf(accounts, g, T('미지급금')), 11000)
assert.equal(free(g), 88000 - 14000)
const g3 = [...g, mkE('g3', '2026-10-20', '여가', '적금・예금', 14000)]
assert.equal(balOf(accounts, g3, T('여가')), 14000)
assert.equal(balOf(accounts, g3, T('적금・예금')), 0)
assert.equal(free(g3), 74000)
// 使わない科目の残高も、自由に使える額に入る
assert.equal(free(base, hide('현금')), 88000)
// 完成条件27：科目ごとの借方合計・貸方合計・残高。残高は種類ごとの向きで、借方合計と貸方合計の差
const all = accountBalances(accounts, s5)
const row = (id) => all.rows.find((r) => r.account.id === id)
assert.deepEqual([row(T('은행 계좌')).debit, row(T('은행 계좌')).credit, row(T('은행 계좌')).balance], [100000, 34200, 65800])
assert.deepEqual([row(T('카드 미결제')).debit, row(T('카드 미결제')).credit, row(T('카드 미결제')).balance], [21200, 21200, 0])
assert.deepEqual([row(byKey('opening').id).debit, row(byKey('opening').id).credit, row(byKey('opening').id).balance], [20000, 108000, 88000])
assert.ok(all.rows.every((r) => r.balance === (['asset', 'expense'].includes(r.account.type) ? r.debit - r.credit : r.credit - r.debit)))
assert.ok(row(T('식비')).used && !row(T('교통비')).used)
assert.ok(all.balanced && all.debitTotal === all.creditTotal && all.rows.length === accounts.length)
assert.ok(!accountBalances(accounts, [...s5, { ...cardUse, id: 'bad', creditId: 'zzz' }]).balanced) // 存在しない科目を指す仕訳
// 完成条件18：クレカの分割（当月の利用額は opening と引き落としを除く。今日は引数で渡す）
const c1 = creditCardSplit(accounts, s2, '2026-10-04')
assert.deepEqual([c1.balance, c1.thisMonth, c1.next], [21200, 1200, 20000])
assert.deepEqual(c1.monthly, [{ month: '2026-10', amount: 1200 }])
assert.equal(c1.account.key, 'credit-card')
const c2 = creditCardSplit(accounts, [...s2, mkE('s1', '2026-09-30', '식비', '카드 미결제', 3000)], '2026-10-04')
assert.deepEqual([c2.balance, c2.thisMonth, c2.next], [24200, 1200, 23000])
assert.deepEqual(c2.monthly, [{ month: '2026-10', amount: 1200 }, { month: '2026-09', amount: 3000 }]) // 新しい月が先頭
const c3 = creditCardSplit(accounts, s3, '2026-10-30') // 引き落とし（借方）は利用に入らない
assert.deepEqual([c3.balance, c3.thisMonth, c3.next], [0, 1200, -1200])
const c4 = creditCardSplit(accounts, s2, '2026-11-04') // 月が変わると当月は0
assert.deepEqual([c4.thisMonth, c4.next], [0, 21200])
const c5 = creditCardSplit(accounts, base, '2026-10-04') // opening だけ
assert.deepEqual([c5.balance, c5.thisMonth, c5.next, c5.monthly], [20000, 0, 20000, []])
// 完成条件25の残り：特別科目の名前を変えても、自由に使える額とクレカの分割は変わらない。key の科目がなければ null
const renamedAll = accounts.map((a) => (a.key ? { ...a, name: `${a.name}2` } : a))
assert.deepEqual(freeAmount(renamedAll, s5), freeAmount(accounts, s5))
const rc = creditCardSplit(renamedAll, s2, '2026-10-04')
assert.deepEqual([rc.balance, rc.thisMonth, rc.next, rc.monthly], [c1.balance, c1.thisMonth, c1.next, c1.monthly])
assert.equal(creditCardSplit(accounts.filter((a) => a.key !== 'credit-card'), [], '2026-10-04'), null)
// 完成条件28：貯蓄の履歴（日付順、取り分け=+、取り崩し=−、累計）
const sv = [mkE('sv1', '2026-10-05', '비상금', '은행 계좌', 10000), mkE('sv2', '2026-10-02', '비상금', '은행 계좌', 5000), mkE('sv3', '2026-10-09', '은행 계좌', '비상금', 3000)]
const h = savingsHistory(accounts, [...base, ...sv])
assert.equal(h.length, 1)
assert.equal(h[0].account.name, '비상금')
assert.deepEqual(h[0].rows.map((r) => [r.entry.id, r.delta, r.total]), [['sv2', 5000, 5000], ['sv1', 10000, 15000], ['sv3', -3000, 12000]])
assert.equal(h[0].balance, balOf(accounts, [...base, ...sv], T('비상금')))
assert.deepEqual(savingsHistory(hide('비상금'), base), []) // 使わない科目で仕訳もなければ出さない
assert.equal(savingsHistory(hide('비상금'), [...base, ...sv])[0].rows.length, 3) // 仕訳があれば、使わない科目でも出す

// ---- 月次（月の集計・P/L・B/S） ----
// 初期表示の月：今日の前月（1月は前年12月）
for (const [today, month] of [['2026-10-04', '2026-09'], ['2026-10-01', '2026-09'], ['2026-01-01', '2025-12'], ['2026-03-31', '2026-02'], ['2026-12-31', '2026-11']]) assert.equal(previousMonth(today), month, today)
const rep = (es, m = '2026-10', accs = accounts) => monthReport(accs, es, m)
const nm = (list) => list.map((x) => [x.account.name, x.amount])
const snapAcc = JSON.stringify(accounts)
const snapS2 = JSON.stringify(s2)
// 完成条件2・17：食費の月合計1200、収益0、収支-1200。開始残高は収入にも支出にも数えない
const r1 = rep(s2)
assert.deepEqual(r1.revenue, [])
assert.deepEqual(nm(r1.expense), [['식비', 1200]])
assert.deepEqual([r1.revenueTotal, r1.expenseTotal, r1.result], [0, 1200, -1200])
assert.deepEqual(r1.adjustment, { gain: 0, loss: 0, net: 0 })
const r0 = rep(base)
assert.deepEqual([r0.revenue, r0.expense, r0.revenueTotal, r0.expenseTotal, r0.result], [[], [], 0, 0, 0])
// 完成条件6：その月の娯楽が14000
assert.deepEqual(nm(rep(g3).expense), [['여가', 14000]])
// 費用は多い順。同じ額は科目の並び順
assert.deepEqual(nm(rep([...s2, mkE('m1', '2026-10-10', '여가', '현금', 14000)]).expense), [['여가', 14000], ['식비', 1200]])
assert.deepEqual(nm(rep([...s2, mkE('t1', '2026-10-11', '교통비', '현금', 1200)]).expense), [['식비', 1200], ['교통비', 1200]])
// 収益：科目別と合計。収支は 収益 − 費用
const r3 = rep([...s2, mkE('i1', '2026-10-03', '은행 계좌', '월급', 50000)])
assert.deepEqual(nm(r3.revenue), [['월급', 50000]])
assert.deepEqual([r3.revenueTotal, r3.expenseTotal, r3.result], [50000, 1200, 48800])
// 月の分離：10月と11月
const nov = mkE('n1', '2026-11-05', '식비', '카드 미결제', 1000)
assert.equal(rep([...s2, nov], '2026-10').expenseTotal, 1200)
assert.deepEqual(nm(rep([...s2, nov], '2026-11').expense), [['식비', 1000]])
assert.deepEqual(rep([...s2, nov], '2026-09').expense, [])
// 完成条件21：残高調整（adjustment の仕訳を直接作る）は、通常の収支とは別の行
const adjLoss = mkE('a1', '2026-10-31', '조정손실', '현금', 500, 'adjustment')
const adjGain = mkE('a2', '2026-10-31', '현금', '조정이익', 300, 'adjustment')
const r4 = rep([...s2, adjLoss])
assert.deepEqual(r4.adjustment, { gain: 0, loss: 500, net: -500 })
assert.deepEqual(nm(r4.expense), [['식비', 1200]])
assert.deepEqual([r4.expenseTotal, r4.result], [1200, -1200])
assert.deepEqual(rep([...s2, adjGain]).adjustment, { gain: 300, loss: 0, net: 300 })
assert.deepEqual(rep([...s2, adjGain]).revenue, [])
assert.deepEqual(rep([...s2, adjLoss, adjGain]).adjustment, { gain: 300, loss: 500, net: -200 })
assert.deepEqual(rep([...s2, adjLoss], '2026-10', renamedAll).adjustment, r4.adjustment) // 名前を変えても key で探す
// B/S：月末時点。完成条件16：資産108000、負債21200、純資産86800（開始残高88000 + 累計の収支-1200）
const bs = (es, m = '2026-10', accs = accounts) => balanceSheet(accs, es, m)
const bn = (list) => list.map((x) => [x.account.name, x.balance])
const b1 = bs(s2)
assert.deepEqual([b1.assetTotal, b1.liabilityTotal, b1.equityTotal, b1.profit, b1.balanced], [108000, 21200, 86800, -1200, true])
assert.deepEqual(bn(b1.assets), [['현금', 3000], ['은행 계좌', 100000], ['간편결제 잔액', 5000]]) // 仕訳がない科目は出ない
assert.deepEqual(bn(b1.liabilities), [['카드 미결제', 21200]])
assert.deepEqual(bn(b1.equity), [['시작 잔액', 88000]])
// 完成条件19：引き落とし21200 → 資産86800、負債0、純資産86800。残高0でも、仕訳がある科目は行が出る
const b3 = bs(s3)
assert.deepEqual([b3.assetTotal, b3.liabilityTotal, b3.equityTotal, b3.balanced], [86800, 0, 86800, true])
assert.deepEqual(bn(b3.liabilities), [['카드 미결제', 0]])
// 完成条件20：10月と11月に仕訳がある。10月のB/Sには11月が入らない
const s20 = [...s2, nov]
assert.deepEqual(bs(s20, '2026-10'), b1)
const b11 = bs(s20, '2026-11')
assert.deepEqual([b11.assetTotal, b11.liabilityTotal, b11.profit, b11.equityTotal, b11.balanced], [108000, 22200, -2200, 85800, true])
const b9 = bs(s20, '2026-09') // 開始日より前の月：全部0
assert.deepEqual([b9.assets, b9.liabilities, b9.equity, b9.assetTotal, b9.equityTotal, b9.balanced], [[], [], [], 0, 0, true])
// 完成条件21：調整損500でも、左右が一致したまま。累計の収支に入る
const b4 = bs([...s2, adjLoss])
assert.deepEqual([b4.assetTotal, b4.liabilityTotal, b4.profit, b4.equityTotal, b4.balanced], [107500, 21200, -1700, 86300, true])
assert.ok(bs([...s2, adjLoss, adjGain]).balanced)
// 合わないとき：存在しない科目を指す仕訳
assert.equal(bs([...s2, { ...cardUse, id: 'bad', creditId: 'zzz' }]).balanced, false)
// 純資産の科目を足しても、左右が一致する（純資産の科目すべてを合計する）
const capital = newAccount('資本金', 'equity')
const capEntry = { ...mkE('c1', '2026-10-06', '은행 계좌', '현금', 5000), creditId: capital.id }
const bc = bs([...s2, capEntry], '2026-10', [...accounts, capital])
assert.deepEqual([bc.assetTotal, bc.equityTotal, bc.balanced], [113000, 91800, true])
assert.deepEqual(bn(bc.equity), [['시작 잔액', 88000], ['資本金', 5000]])
// 渡した配列は変えない
assert.equal(JSON.stringify(accounts), snapAcc)
assert.equal(JSON.stringify(s2), snapS2)

// ---- 残高の合計行（typeTotals） ----
const tot = (es, type, accs = accounts) => typeTotals(accountBalances(accs, es).rows, type)
const sumOf = (list, key) => list.reduce((n, r) => n + r[key], 0)
assert.deepEqual(tot(base, 'asset'), { debit: 108000, credit: 0, balance: 108000 })
assert.deepEqual(tot(s3, 'asset'), { debit: 108000, credit: 21200, balance: 86800 })
assert.deepEqual(tot(s2, 'liability'), { debit: 0, credit: 21200, balance: 21200 })
assert.deepEqual(tot(s3, 'liability'), { debit: 21200, credit: 21200, balance: 0 })
// 完成条件29：画面に出る行（active か仕訳あり）の合計と一致する。使わない設定の科目に仕訳があっても一致する
for (const [es, accs] of [[s3, accounts], [s5, accounts], [g3, accounts], [s5, hide('현금')], [s5, hide('비상금')], [[], accounts]]) {
  const { rows } = accountBalances(accs, es)
  for (const type of ['asset', 'liability']) {
    const shown = rows.filter((r) => r.account.type === type && (r.account.active || r.used))
    assert.deepEqual(typeTotals(rows, type), { debit: sumOf(shown, 'debit'), credit: sumOf(shown, 'credit'), balance: sumOf(shown, 'balance') }, type)
  }
}
// 向き：資産は借方 − 貸方、負債は貸方 − 借方
for (const es of [s3, s5, g3]) {
  const a = tot(es, 'asset')
  const l = tot(es, 'liability')
  assert.equal(a.balance, a.debit - a.credit)
  assert.equal(l.balance, l.credit - l.debit)
}
// 仕訳がない／該当する科目がない区分は、すべて0。渡した rows は変えない
assert.deepEqual(tot([], 'asset'), { debit: 0, credit: 0, balance: 0 })
assert.deepEqual(tot(s3, 'liability', accounts.filter((a) => a.type !== 'liability' && a.key !== 'credit-card')), { debit: 0, credit: 0, balance: 0 })
const rowsBefore = accountBalances(accounts, s3).rows
const rowsSnap = JSON.stringify(rowsBefore)
typeTotals(rowsBefore, 'asset')
assert.equal(JSON.stringify(rowsBefore), rowsSnap)

// ---- 残高調整 ----
const TODAY = '2026-10-04'
const snapBase = JSON.stringify(base)
const adj = (es, name, actual, accs = accounts, today = TODAY) => planAdjustment(accs, es, T(name), actual, today, NOW)
const after = (p, name) => balOf(accounts, p.entries, T(name))
const lossId = byKey('adjust-loss').id
const gainId = byKey('adjust-gain').id
// 完成条件7：現金の記録が3000で実際が2500 → 調整損500、現金が2500
const a1 = adj(base, '현금', '2500')
assert.deepEqual([a1.current, a1.actual, a1.diff, a1.amount, a1.kindLabel], [3000, 2500, -500, 500, '조정손실'])
assert.deepEqual(a1.entry, { id: a1.entry.id, date: TODAY, debitId: lossId, creditId: T('현금'), amount: 500, memo: '', kind: 'adjustment', createdAt: NOW, updatedAt: NOW })
assert.deepEqual(a1.entries, [...base, a1.entry])
assert.equal(after(a1, '현금'), 2500)
// 資産が実際より少ない：借方＝その科目、貸方＝調整益
const a2 = adj(base, '현금', '3500')
assert.deepEqual([a2.entry.debitId, a2.entry.creditId, a2.amount, a2.kindLabel, a2.diff], [T('현금'), gainId, 500, '조정이익', 500])
assert.equal(after(a2, '현금'), 3500)
// 負債は向きが逆：記録20000 → 実際19000（調整益）、21000（調整損）
const a3 = adj(base, '카드 미결제', '19000')
assert.deepEqual([a3.entry.debitId, a3.entry.creditId, a3.amount, a3.kindLabel], [T('카드 미결제'), gainId, 1000, '조정이익'])
assert.equal(after(a3, '카드 미결제'), 19000)
const a4 = adj(base, '카드 미결제', '21000')
assert.deepEqual([a4.entry.debitId, a4.entry.creditId, a4.amount, a4.kindLabel], [lossId, T('카드 미결제'), 1000, '조정손실'])
assert.equal(after(a4, '카드 미결제'), 21000)
// 差額が0なら何も記録しない。調整のあとに同じ実際をもう一度 → 0（二重にならない）
const a5 = adj(base, '현금', '3000')
assert.deepEqual([a5.none, a5.current, a5.entries, a5.entry], [true, 3000, undefined, undefined])
assert.equal(adj(a1.entries, '현금', '2500').none, true)
// 実際0は可（残高を0にする調整）。空欄・不正な入力はエラー（元の entries は変わらない）
const a6 = adj(base, '현금', '0')
assert.deepEqual([a6.amount, a6.kindLabel, after(a6, '현금')], [3000, '조정손실', 0])
for (const t of ['', '1.5', '-100', '1e3', '１２００', '1,000', '007', ' 5']) assert.ok(adj(base, '현금', t).error, JSON.stringify(t))
// 選べない科目・足りない特別科目・不正な日付はエラー
assert.ok(adj(base, '식비', '100').error) // 費用
assert.ok(adj(base, '시작 잔액', '100').error) // 純資産
assert.ok(adj(base, '현금', '100', hide('현금')).error) // 使わない設定
assert.ok(planAdjustment(accounts, base, 'zzz', '100', TODAY, NOW).error)
assert.ok(adj(base, '현금', '2500', accounts.filter((a) => a.key !== 'adjust-gain')).error)
assert.ok(adj(base, '현금', '2500', accounts.filter((a) => a.key !== 'adjust-loss')).error)
for (const d of ['', '2026-02-30', '2026-10-4']) assert.ok(adj(base, '현금', '2500', accounts, d).error, d)
// 名前を変えても、key で探すので同じ仕訳になる
const a7 = adj(base, '현금', '2500', renamedAll)
assert.deepEqual([a7.entry.debitId, a7.entry.creditId, a7.entry.amount], [lossId, T('현금'), 500])
// 完成条件21：調整損500 → P/Lでは通常の収支とは別の行、B/Sは左右が一致したまま
const a8 = adj(s2, '현금', '2500')
const rj = monthReport(accounts, a8.entries, '2026-10')
assert.deepEqual(rj.adjustment, { gain: 0, loss: 500, net: -500 })
assert.deepEqual(nm(rj.expense), [['식비', 1200]])
assert.equal(rj.result, monthReport(accounts, s2, '2026-10').result)
const bj = balanceSheet(accounts, a8.entries, '2026-10')
assert.deepEqual([bj.balanced, bj.profit, bj.assetTotal], [true, -1700, 107500])
// 選択肢：active の資産と負債だけ。balance は今の記録上の残高
const ar = adjustmentRows(accounts, base)
const arNames = ar.map((r) => r.account.name)
assert.ok(arNames.includes('현금') && arNames.includes('카드 미결제'))
for (const n of ['식비', '시작 잔액', '월급', '조정손실']) assert.ok(!arNames.includes(n), n)
assert.equal(ar.find((r) => r.account.name === '현금').balance, 3000)
assert.ok(!adjustmentRows(hide('현금'), base).some((r) => r.account.name === '현금'))
assert.equal(JSON.stringify(base), snapBase) // 渡した配列は変わらない

// ---- 定期支払い ----
// 月末日・日付・次の月
for (const [m, d] of [['2026-02', 28], ['2028-02', 29], ['2100-02', 28], ['2000-02', 29], ['2026-04', 30], ['2026-12', 31], ['2026-01', 31]]) assert.equal(daysInMonth(m), d, m)
assert.equal(subscriptionDate('2026-02', 31), '2026-02-28')
assert.equal(subscriptionDate('2028-02', 31), '2028-02-29')
assert.equal(subscriptionDate('2026-10', 5), '2026-10-05')
assert.equal(subscriptionDate('2026-04', 31), '2026-04-30')
assert.equal(nextMonth('2026-12'), '2027-01')
assert.equal(nextMonth('2026-09'), '2026-10')
// 登録した日の lastMonth：今月の指定日が今日以降 → 前月、過ぎていれば今月
for (const [day, today, last] of [[3, '2026-10-04', '2026-10'], [4, '2026-10-04', '2026-09'], [5, '2026-10-04', '2026-09'], [31, '2026-10-04', '2026-09'], [15, '2026-01-10', '2025-12'], [31, '2026-02-27', '2026-01'], [31, '2026-02-28', '2026-01']]) {
  assert.equal(initialLastMonth(day, today), last, `${day} ${today}`)
}
// 入力の検証
const subIn = { name: ' テスト ', memo: '内容', amountText: '500', dayText: '4', debitId: T('여가'), creditId: T('현금') }
assert.deepEqual(validateSubscriptionInput(subIn, accounts), { name: 'テスト', memo: '内容', amount: 500, day: 4, debitId: T('여가'), creditId: T('현금') })
assert.equal(validateSubscriptionInput({ ...subIn, dayText: '31' }, accounts).day, 31)
assert.equal(validateSubscriptionInput({ ...subIn, memo: undefined }, accounts).memo, '')
const badSub = (o, accs = accounts, cur) => assert.ok(validateSubscriptionInput({ ...subIn, ...o }, accs, cur).error, JSON.stringify(o))
badSub({ name: '' })
badSub({ name: '   ' })
badSub({ name: undefined })
for (const t of ['0', '1.5', '1e3', '５００', '', '007', '-1']) badSub({ amountText: t })
for (const t of ['0', '32', '1.5', '１', '', '01', '-1', ' 4']) badSub({ dayText: t })
badSub({ creditId: T('여가') }) // 借方 = 貸方
badSub({ debitId: 'zzz' })
badSub({ debitId: byKey('opening').id }) // 3つの特別科目は選べない
badSub({ creditId: byKey('adjust-gain').id })
badSub({ debitId: byKey('adjust-loss').id })
assert.ok(validateSubscriptionInput({ ...subIn, creditId: byKey('credit-card').id }, accounts).amount) // クレカ未払いは選べる
badSub({}, hide('현금')) // 使わない設定の科目は選べない
assert.equal(validateSubscriptionInput(subIn, hide('현금'), [T('현금')]).error, undefined) // 編集中の定期支払いが使っている科目は残る
// 登録
const subInput = { name: 'テスト', memo: '', amount: 500, day: 4, debitId: T('여가'), creditId: T('현금') }
const mkSub = (day, today, o = {}) => ({ ...newSubscription({ ...subInput, day }, today, NOW), ...o })
const sub1 = mkSub(4, '2026-10-04')
assert.deepEqual([sub1.active, sub1.lastMonth, sub1.createdAt, sub1.updatedAt, sub1.name, sub1.amount, sub1.day], [true, '2026-09', NOW, NOW, 'テスト', 500, 4])
const ap = (subs, es, today) => applySubscriptions(subs, es, today, NOW)
const snapSubs = JSON.stringify([sub1])
const snapEs = JSON.stringify(base)
// 完成条件32：指定日が今日 → 開いたとき、その日付で通常の仕訳が1件。もう一度（何回でも）→ 二重にならない
const ap1 = ap([sub1], base, '2026-10-04')
assert.equal(ap1.added, 1)
assert.equal(ap1.entries.length, base.length + 1)
const made = ap1.entries[ap1.entries.length - 1]
assert.deepEqual(made, { id: made.id, date: '2026-10-04', debitId: T('여가'), creditId: T('현금'), amount: 500, memo: 'テスト', kind: 'normal', createdAt: NOW, updatedAt: NOW })
assert.equal(ap1.subscriptions[0].lastMonth, '2026-10')
assert.equal(ap1.subscriptions[0].id, sub1.id)
for (const day of ['2026-10-04', '2026-10-04', '2026-10-20', '2026-10-31']) {
  const again = ap(ap1.subscriptions, ap1.entries, day)
  assert.deepEqual([again.added, again.entries === ap1.entries, again.subscriptions === ap1.subscriptions], [0, true, true], day)
}
assert.equal(JSON.stringify([sub1]), snapSubs) // 元の配列は変わらない
assert.equal(JSON.stringify(base), snapEs)
// 完成条件33：指定日が来ていない → 記入されない。登録した日より前の指定日の分も記入されない
const none = ap([sub1], base, '2026-10-03')
assert.deepEqual([none.added, none.entries === base, none.subscriptions[0] === sub1], [0, true, true])
const sub3 = mkSub(3, '2026-10-04') // 登録した日（4日）より前の指定日 → lastMonth は今月
assert.equal(sub3.lastMonth, '2026-10')
assert.equal(ap([sub3], base, '2026-10-10').added, 0)
const ap3 = ap([sub3], base, '2026-11-03')
assert.deepEqual(ap3.entries.slice(base.length).map((e) => e.date), ['2026-11-03']) // 10月の分は作らない
const sub28 = mkSub(28, '2026-10-04') // 今月の28日はこれから
assert.equal(ap([sub28], base, '2026-10-27').added, 0)
assert.deepEqual(ap([sub28], base, '2026-10-28').entries.slice(base.length).map((e) => e.date), ['2026-10-28'])
// アプリを開かなかった間の分は、月ごとにまとめて、各月の指定日（月末日）で記入される
const old = mkSub(31, '2026-10-04', { lastMonth: '2026-07' })
const ap4 = ap([old], base, '2026-10-15')
assert.deepEqual(ap4.entries.slice(base.length).map((e) => e.date), ['2026-08-31', '2026-09-30'])
assert.equal(ap4.subscriptions[0].lastMonth, '2026-09')
assert.deepEqual(ap(ap4.subscriptions, ap4.entries, '2026-10-31').entries.slice(ap4.entries.length).map((e) => e.date), ['2026-10-31'])
assert.deepEqual(ap([mkSub(31, '2026-01-01', { lastMonth: '2026-01' })], base, '2026-03-01').entries.slice(base.length).map((e) => e.date), ['2026-02-28'])
assert.deepEqual(ap([mkSub(31, '2028-01-01', { lastMonth: '2028-01' })], base, '2028-02-29').entries.slice(base.length).map((e) => e.date), ['2028-02-29'])
// 年をまたぐ
assert.deepEqual(ap([mkSub(15, '2026-10-04', { lastMonth: '2026-11' })], base, '2027-01-20').entries.slice(base.length).map((e) => e.date), ['2026-12-15', '2027-01-15'])
// 使わない間は記入しない（lastMonth も動かない）。「使う」に戻しても、止めていた間はさかのぼらない
const paused = setSubscriptionActive(mkSub(5, '2026-07-01', { lastMonth: '2026-07' }), false, '2026-07-02', NOW)
assert.deepEqual([paused.active, paused.lastMonth], [false, '2026-07'])
assert.deepEqual([ap([paused], base, '2026-10-20').added, ap([paused], base, '2026-10-20').subscriptions[0] === paused], [0, true])
const on1 = setSubscriptionActive(paused, true, '2026-10-20', NOW)
assert.deepEqual([on1.active, on1.lastMonth], [true, '2026-10']) // 10月5日は過ぎている → 10月の分もさかのぼらない
assert.equal(ap([on1], base, '2026-10-20').added, 0)
assert.deepEqual(ap([on1], base, '2026-11-05').entries.slice(base.length).map((e) => e.date), ['2026-11-05'])
const on2 = setSubscriptionActive(paused, true, '2026-10-04', NOW)
assert.equal(on2.lastMonth, '2026-09') // 10月5日はこれから
assert.deepEqual(ap([on2], base, '2026-10-05').entries.slice(base.length).map((e) => e.date), ['2026-10-05'])
// 今日すでに記入した分は、切り替えても、もう一度出ない
const filled = ap([sub1], base, '2026-10-04')
const toggled = setSubscriptionActive(setSubscriptionActive(filled.subscriptions[0], false, '2026-10-04', NOW), true, '2026-10-04', NOW)
assert.equal(toggled.lastMonth, '2026-10')
assert.equal(ap([toggled], filled.entries, '2026-10-04').added, 0)
assert.equal(setSubscriptionActive(filled.subscriptions[0], true, '2026-10-04', NOW).lastMonth, '2026-10') // すでに使う → lastMonth は変わらない
// 記入した仕訳を削除しても、同じ月の分は作り直さない
const withoutMade = filled.entries.filter((e) => e.id !== filled.entries[filled.entries.length - 1].id)
assert.equal(ap(filled.subscriptions, withoutMade, '2026-10-04').added, 0)
// lastMonth が未来のときは、何もしない。複数の定期支払いは、それぞれ
assert.equal(ap([mkSub(4, '2026-10-04', { lastMonth: '2026-12' })], base, '2026-10-31').added, 0)
const two = ap([mkSub(4, '2026-10-04'), { ...mkSub(10, '2026-10-04'), name: '別' }], base, '2026-10-15')
assert.deepEqual(two.entries.slice(base.length).map((e) => [e.date, e.memo]), [['2026-10-04', 'テスト'], ['2026-10-10', '別']])
// 作った仕訳は、読み込みの検証と同じ条件を満たす（日付が実在、金額1以上、借方と貸方が違う）
for (const e of ap4.entries.slice(base.length)) assert.ok(isDate(e.date) && e.amount >= 1 && e.debitId !== e.creditId && e.kind === 'normal')
// 編集：id・createdAt・active・lastMonth は保つ
const edited = editSubscription(filled.subscriptions[0], { name: '新', memo: 'x', amount: 700, day: 9, debitId: T('식비'), creditId: T('은행 계좌') }, LATER)
assert.deepEqual([edited.id, edited.createdAt, edited.active, edited.lastMonth, edited.updatedAt], [sub1.id, NOW, true, '2026-10', LATER])
assert.deepEqual([edited.name, edited.memo, edited.amount, edited.day, edited.debitId, edited.creditId], ['新', 'x', 700, 9, T('식비'), T('은행 계좌')])
assert.equal(ap([edited], filled.entries, '2026-10-31').added, 0) // 日を変えても、記入済みの月は二重にならない
// 使っている科目は、削除も区分の変更もできない。使っていない科目は今までどおり
assert.equal(canDeleteAccount(by('여가'), [], [sub1]), false)
assert.equal(canDeleteAccount(by('현금'), [], [sub1]), false)
assert.equal(canChangeType(by('여가'), [], [sub1]), false)
assert.equal(canDeleteAccount(by('교통비'), [], [sub1]), true)
assert.equal(canChangeType(by('교통비'), [], [sub1]), true)
assert.equal(canDeleteAccount(by('여가'), []), true) // 2引数の呼び出しは今までどおり
assert.equal(canDeleteAccount(by('여가'), [], []), true)

// ---- 元帳 ----
const bk = (es, name, month = '', accs = accounts) => ledgerBook(accs, es, T(name), month)
const sep15 = mkE('p1', '2026-09-15', '식비', '현금', 700)
const bookEs = [...s5, sep15, nov, adjLoss, adjGain]
const snapBookEs = JSON.stringify(bookEs)
const snapBookAcc = JSON.stringify(accounts)
const bal = (r) => r.map((x) => x.balance)
// 完成条件35：日付順、相手の科目、借方・貸方（その科目の側だけ）、行ごとの累計
const yuBook = bk(s5, '은행 계좌')
assert.deepEqual(yuBook.rows.map((r) => [r.entry.date, r.debit, r.credit, r.balance]), [['2026-10-01', 100000, null, 100000], ['2026-10-27', null, 21200, 78800], ['2026-10-28', null, 3000, 75800], ['2026-10-29', null, 10000, 65800]])
assert.deepEqual(yuBook.rows.map((r) => r.otherId), [byKey('opening').id, T('카드 미결제'), T('간편결제 잔액'), T('비상금')])
assert.deepEqual([yuBook.total, yuBook.carryOver, yuBook.balance], [4, null, 65800])
assert.equal(yuBook.rows[0].entry.kind, 'opening') // 種類は entry.kind
assert.deepEqual(yuBook.rows.map((r) => r.entry.id), [...yuBook.rows.map((r) => r.entry)].map((e) => e.id))
// 向き：負債は貸方 − 借方、費用は借方 − 貸方、収益・純資産は貸方 − 借方
assert.deepEqual(bal(bk(s5, '카드 미결제').rows), [20000, 21200, 0])
assert.deepEqual(bal(bk(s5, '식비').rows), [1200])
assert.deepEqual(bal(bk(bookEs, '조정손실').rows), [500])
assert.deepEqual(bal(bk(bookEs, '조정이익').rows), [300])
assert.equal(bk(s5, '시작 잔액').rows.length, 4)
assert.equal(bk(s5, '시작 잔액').balance, 88000) // 貸方108000 − 借方20000
// 並び順：日付 → 作成日時 → id。入力の並びに依らない
const same = (id, createdAt, date = '2026-10-05') => ({ ...mkE(id, date, '식비', '현금', 1), createdAt })
const ord = [same('z2', 't'), same('z1', 't'), same('z9', 's'), same('y', 'u', '2026-10-04')]
assert.deepEqual(bk(ord, '식비').rows.map((r) => r.entry.id), ['y', 'z9', 'z1', 'z2'])
assert.deepEqual(bk([...ord].reverse(), '식비').rows.map((r) => r.entry.id), ['y', 'z9', 'z1', 'z2'])
// 完成条件36：全期間の一番下の残高が、残高（accountBalances）と一致する
for (const [es, accs] of [[s5, accounts], [bookEs, accounts], [[], accounts], [base, hide('현금')], [g3, accounts], [bookEs, hide('비상금')]]) {
  const { rows } = accountBalances(accs, es)
  for (const r of rows) assert.equal(ledgerBook(accs, es, r.account.id).balance, r.balance, r.account.name)
}
// 完成条件37：月で絞り込む。その月の仕訳だけ、先頭に前月までの繰越。繰越から累計すると、全期間の同じ行の残高と一致する
const cash = bk(bookEs, '현금', '2026-10')
assert.deepEqual([cash.carryOver, cash.total], [-700, bk(bookEs, '현금').total])
assert.deepEqual(cash.rows.map((r) => r.entry.date.slice(0, 7)), ['2026-10', '2026-10', '2026-10'])
assert.deepEqual(bal(cash.rows), [2300, 1800, 2100]) // 開始3000、調整損500（貸方）、調整益300（借方）
for (const name of ['은행 계좌', '현금', '카드 미결제', '식비', '시작 잔액', '비상금']) {
  const full = bk(bookEs, name)
  for (const month of ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12']) {
    const part = bk(bookEs, name, month)
    const before = accountBalances(accounts, bookEs.filter((e) => e.date.slice(0, 7) < month)).rows.find((r) => r.account.id === T(name)).balance
    assert.equal(part.carryOver, before, `${name} ${month} 繰越`)
    assert.ok(part.rows.every((r) => r.entry.date.startsWith(month)), `${name} ${month}`)
    for (const r of part.rows) assert.equal(r.balance, full.rows.find((x) => x.entry.id === r.entry.id).balance, `${name} ${month}`)
    const upTo = full.rows.filter((r) => r.entry.date.slice(0, 7) <= month)
    assert.equal(part.balance, upTo.length ? upTo[upTo.length - 1].balance : 0, `${name} ${month} 一番下`)
    assert.equal(part.total, full.total)
  }
}
// その月に仕訳がない：繰越だけ。仕訳より前の月：繰越0
const dec = bk(bookEs, '현금', '2026-12')
assert.deepEqual([dec.rows, dec.carryOver, dec.balance], [[], bk(bookEs, '현금').balance, bk(bookEs, '현금').balance])
const early = bk(bookEs, '은행 계좌', '2026-08')
assert.deepEqual([early.rows, early.carryOver, early.balance], [[], 0, 0])
// 全期間のときの繰越は null。月が '' でも、省略しても全期間
assert.equal(bk(bookEs, '현금').carryOver, null)
assert.deepEqual(ledgerBook(accounts, bookEs, T('현금')), bk(bookEs, '현금', ''))
// 仕訳が0件の科目、使わない設定の科目、存在しない科目
const emptyBook = bk(bookEs, '교통비')
assert.deepEqual([emptyBook.total, emptyBook.rows, emptyBook.balance, emptyBook.carryOver], [0, [], 0, null])
assert.equal(bk(bookEs, '교통비', '2026-10').carryOver, 0)
assert.equal(bk(bookEs, '현금', '', hide('현금')).rows.length, bk(bookEs, '현금').rows.length)
assert.equal(ledgerBook(accounts, bookEs, 'zzz'), null)
// 他の科目の仕訳は混ざらない。渡した配列は変えない
assert.ok(bk(bookEs, '은행 계좌').rows.every((r) => r.entry.debitId === T('은행 계좌') || r.entry.creditId === T('은행 계좌')))
assert.equal(JSON.stringify(bookEs), snapBookEs)
assert.equal(JSON.stringify(accounts), snapBookAcc)

// ---- 有報風の表（B/S の勘定式、P/L の報告書の形） ----
const cellList = (list) => list.map((c) => [c.kind, c.name, c.amount])
const sumItems = (list) => list.filter((c) => c.kind === 'item').reduce((n, c) => n + c.amount, 0)
// 完成条件38：左に資産の部、右に負債の部と純資産の部。下の2つの合計が一致する
const sh38 = bs(s2)
const snapSh = JSON.stringify(sh38)
const col38 = balanceSheetColumns(sh38)
assert.deepEqual(cellList(col38.left), [['head', '자산', null], ['item', '현금', 3000], ['item', '은행 계좌', 100000], ['item', '간편결제 잔액', 5000]])
assert.deepEqual(cellList(col38.right), [
  ['head', '부채', null], ['item', '카드 미결제', 21200], ['subtotal', '부채 합계', 21200],
  ['head', '순자산', null], ['item', '시작 잔액', 88000], ['item', '누적 손익', -1200], ['subtotal', '순자산 합계', 86800],
])
assert.deepEqual([col38.leftTotal, col38.rightTotal], [{ name: '자산 합계', amount: 108000 }, { name: '부채・순자산 합계', amount: 108000 }])
assert.equal(JSON.stringify(sh38), snapSh) // 渡した sheet は変わらない
// liabilityEquityTotal ＝ 負債合計 ＋ 純資産合計。一致するときは資産合計と同じ。いくつもの状態・月で、左右の合計が一致する
for (const [es, m, accs] of [
  [s2, '2026-10', accounts], [s3, '2026-10', accounts], [[...s2, adjLoss], '2026-10', accounts], [[...s2, adjLoss, adjGain], '2026-10', accounts],
  [[...s2, nov], '2026-10', accounts], [[...s2, nov], '2026-11', accounts], [[...s2, nov], '2026-09', accounts], [[], '2026-10', accounts],
  [[...s2, capEntry], '2026-10', [...accounts, capital]], [g3, '2026-10', accounts],
]) {
  const sh = bs(es, m, accs)
  assert.equal(sh.liabilityEquityTotal, sh.liabilityTotal + sh.equityTotal, m)
  assert.equal(sh.liabilityEquityTotal, sh.assetTotal, m)
  assert.ok(sh.balanced, m)
  const c = balanceSheetColumns(sh)
  assert.equal(sumItems(c.left), c.leftTotal.amount, m) // 左の項目の合計 ＝ 資産合計
  assert.equal(sumItems(c.right), c.rightTotal.amount, m) // 右の項目の合計 ＝ 負債・純資産合計
  assert.equal(c.leftTotal.amount, c.rightTotal.amount, m)
}
// 仕訳のない月：見出しと0だけ。合わない状態では、左右の合計が一致しない
const colEmpty = balanceSheetColumns(bs([...s2, nov], '2026-09'))
assert.deepEqual(cellList(colEmpty.left), [['head', '자산', null]])
assert.deepEqual(cellList(colEmpty.right), [['head', '부채', null], ['subtotal', '부채 합계', 0], ['head', '순자산', null], ['item', '누적 손익', 0], ['subtotal', '순자산 합계', 0]])
assert.deepEqual([colEmpty.leftTotal.amount, colEmpty.rightTotal.amount], [0, 0])
const shBad = bs([...s2, { ...cardUse, id: 'bad', creditId: 'zzz' }])
assert.equal(shBad.balanced, false)
assert.notEqual(shBad.liabilityEquityTotal, shBad.assetTotal)
assert.notEqual(balanceSheetColumns(shBad).leftTotal.amount, balanceSheetColumns(shBad).rightTotal.amount)
// 完成条件39：収益の部、費用の部、当期収支、その下に残高調整（別の行）
const pl = (es, m = '2026-10', accs = accounts) => profitLossRows(rep(es, m, accs))
const plHead = [['head', '수익', null], ['none', '해당 없음', null], ['subtotal', '수익 합계', 0], ['head', '비용(많은 순)', null], ['item', '식비', 1200], ['subtotal', '비용 합계', 1200], ['total', '당기 손익(수익 − 비용)', -1200]]
const snapRep = JSON.stringify(rep(s2))
assert.deepEqual(cellList(pl(s2)), plHead) // 残高調整の行は出ない
assert.equal(JSON.stringify(rep(s2)), snapRep)
const plAdj = (extra) => [...plHead, ['head', '잔액 조정(보통의 손익에는 넣지 않습니다)', null], ...extra]
assert.deepEqual(cellList(pl([...s2, adjLoss])), plAdj([['item', '조정이익', 0], ['item', '조정손실', 500], ['subtotal', '차감', -500]])) // 当期収支は変わらない
assert.deepEqual(cellList(pl([...s2, adjGain])), plAdj([['item', '조정이익', 300], ['item', '조정손실', 0], ['subtotal', '차감', 300]]))
assert.deepEqual(cellList(pl([...s2, adjLoss, adjGain])), plAdj([['item', '조정이익', 300], ['item', '조정손실', 500], ['subtotal', '차감', -200]]))
assert.deepEqual(cellList(pl([...s2, adjLoss], '2026-10', renamedAll)), cellList(pl([...s2, adjLoss]))) // 名前を変えても同じ
assert.deepEqual(cellList(pl([...s2, adjLoss], '2026-11')), [['head', '수익', null], ['none', '해당 없음', null], ['subtotal', '수익 합계', 0], ['head', '비용(많은 순)', null], ['none', '해당 없음', null], ['subtotal', '비용 합계', 0], ['total', '당기 손익(수익 − 비용)', 0]])
// 収益あり・多い順
const plRev = pl([...s2, mkE('i1', '2026-10-03', '은행 계좌', '월급', 50000), mkE('m1', '2026-10-10', '여가', '현금', 14000)])
assert.deepEqual(cellList(plRev), [
  ['head', '수익', null], ['item', '월급', 50000], ['subtotal', '수익 합계', 50000],
  ['head', '비용(많은 순)', null], ['item', '여가', 14000], ['item', '식비', 1200], ['subtotal', '비용 합계', 15200],
  ['total', '당기 손익(수익 − 비용)', 34800],
])
// 合計の一致：各部の項目の合計 ＝ 小計、当期収支 ＝ 収益合計 − 費用合計
const between = (rows, from, to) => rows.slice(rows.findIndex((r) => r.name === from) + 1, rows.findIndex((r) => r.name === to))
for (const rows of [pl(s2), plRev, pl([...s2, adjLoss, adjGain]), pl(g3), pl([...s2, nov], '2026-11')]) {
  const amountOf = (name) => rows.find((r) => r.name === name).amount
  assert.equal(sumItems(between(rows, '수익', '수익 합계')), amountOf('수익 합계'))
  assert.equal(sumItems(between(rows, '비용(많은 순)', '비용 합계')), amountOf('비용 합계'))
  assert.equal(amountOf('당기 손익(수익 − 비용)'), amountOf('수익 합계') - amountOf('비용 합계'))
}
console.log('ok')
