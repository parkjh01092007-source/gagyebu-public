// 実行: node src/storage.check.js
import assert from 'node:assert/strict'
import { parseImport, migrate, needsMigration, emptyData, autoRecord } from './storage.js'
import { LEGACY_KEY_BY_NAME } from './ledgerLogic.js'

const skill = { id: 'a', name: 'x', level: 122, descriptions: { 10: 'd' }, levelHistory: [{ changedAt: 't', from: 0, to: 122 }], createdAt: 't', updatedAt: 't' }
const file = (o) => JSON.stringify({ schemaVersion: 1, exportedAt: 't', skills: [skill], ...o })

// --- v1：受理され、v4 に移行される（スキルはそのまま、初期科目24件、仕訳は空）
const v1 = parseImport(file({})).data
assert.equal(v1.schemaVersion, 4)
assert.deepEqual(v1.skills, [skill])
assert.equal(v1.accounts.length, 21)
assert.deepEqual(v1.entries, [])
assert.ok(!needsMigration(v1))
assert.ok(needsMigration({ schemaVersion: 1, skills: [] }))
assert.deepEqual(migrate({ schemaVersion: 1, skills: [skill] }).data.skills, [skill])
assert.equal(emptyData().schemaVersion, 4)
assert.equal(emptyData().accounts.length, 21)

// --- v1 の既存エラー
assert.ok(parseImport('{broken').error)
assert.ok(parseImport('[]').error)
assert.ok(parseImport(file({ schemaVersion: 5 })).error)
assert.ok(parseImport(file({ skills: 'x' })).error)
assert.ok(parseImport(file({ skills: [{ ...skill, level: 501 }] })).error)
assert.ok(parseImport(file({ skills: [{ ...skill, level: 1.5 }] })).error)
assert.ok(parseImport(file({ skills: [{ ...skill, descriptions: { 51: 'x' } }] })).error)
assert.ok(parseImport(file({ skills: [{ ...skill, levelHistory: [{}] }] })).error)

// --- v2
const acc = (id, name, type, role) => ({ id, name, type, ...(role && { role }), active: true, createdAt: 't', updatedAt: 't' })
const special = [acc('o', '開始残高', 'equity'), acc('g', '調整益', 'revenue'), acc('l', '調整損', 'expense'), acc('k', 'クレカ未払い', 'liability')]
const accounts = [acc('c', '現金', 'asset', 'cash'), acc('f', '食費', 'expense'), ...special]
const withKeys = accounts.map((a) => (LEGACY_KEY_BY_NAME[a.name] ? { ...a, key: LEGACY_KEY_BY_NAME[a.name] } : a))
const entry = { id: 'e1', date: '2026-10-02', debitId: 'f', creditId: 'c', amount: 1200, memo: '', kind: 'normal', createdAt: 't', updatedAt: 't' }
const v2 = (o) => JSON.stringify({ schemaVersion: 2, exportedAt: 't', skills: [skill], accounts, entries: [entry], ...o })

assert.deepEqual(parseImport(v2({})).data, { schemaVersion: 4, skills: [skill], accounts: withKeys, entries: [entry], subscriptions: [] })
assert.ok(parseImport(v2({ entries: [] })).data)
const bad = (e) => assert.ok(parseImport(v2({ entries: [{ ...entry, ...e }] })).error, JSON.stringify(e))
bad({ amount: 0 })
bad({ amount: -100 })
bad({ amount: 1.5 })
bad({ amount: '1200' })
bad({ debitId: 'c' }) // 借方=貸方
bad({ debitId: 'zzz' }) // 存在しない科目
bad({ creditId: 'zzz' })
bad({ date: '2026-13-01' })
bad({ date: '2026-10-2' })
bad({ date: '' })
bad({ kind: 'weird' })
bad({ memo: 5 })
assert.ok(parseImport(v2({ entries: [entry, entry] })).error) // id重複
assert.ok(parseImport(v2({ accounts: [...accounts, acc('d', ' 現金 ', 'asset', 'cash')] })).error) // 名前重複（空白除去後）
assert.ok(parseImport(v2({ accounts: [...accounts, acc('c', 'x', 'expense')] })).error) // id重複
assert.ok(parseImport(v2({ accounts: [acc('c', '現金', 'asset'), accounts[1]] })).error) // 資産に role なし
assert.ok(parseImport(v2({ accounts: [accounts[0], acc('f', '食費', 'expense', 'cash')] })).error) // 非資産に role
assert.ok(parseImport(v2({ accounts: [acc('c', '現金', 'bogus'), accounts[1]] })).error) // type 不正
assert.ok(parseImport(v2({ accounts: undefined })).error)
assert.ok(parseImport(v2({ entries: undefined })).error)

// v2 で特別科目が欠ける → エラー。migrate は元のデータを変えない
assert.ok(parseImport(v2({ accounts: accounts.filter((a) => a.name !== '調整損') })).error)
const oldV2 = { schemaVersion: 2, skills: [skill], accounts: accounts.filter((a) => a.name !== 'クレカ未払い'), entries: [entry] }
const oldSnap = JSON.stringify(oldV2)
assert.ok(migrate(oldV2).error && !migrate(oldV2).data)
assert.equal(JSON.stringify(oldV2), oldSnap)
assert.ok(migrate({ ...oldV2, accounts: undefined }).error)
assert.deepEqual(migrate({ ...oldV2, accounts }).data, { schemaVersion: 4, skills: [skill], accounts: withKeys, entries: [entry], subscriptions: [] })
assert.ok(migrate({ ...oldV2, accounts, entries: [{ ...entry, amount: 0 }] }).error) // 移行の結果も v3 の検証にかかる
// --- v3：key つき。名前を変えても受理される
const v3 = (o) => JSON.stringify({ schemaVersion: 3, exportedAt: 't', skills: [skill], accounts: withKeys, entries: [entry], ...o })
assert.deepEqual(parseImport(v3({})).data, { schemaVersion: 4, skills: [skill], accounts: withKeys, entries: [entry], subscriptions: [] })
assert.ok(parseImport(v3({ accounts: withKeys.map((a) => (a.key ? { ...a, name: `${a.name}2` } : a)) })).data)
assert.ok(parseImport(v3({ accounts: withKeys.map((a) => (a.id === 'f' ? { ...a, key: 'x' } : a)) })).error) // 4つ以外の key
assert.ok(parseImport(v3({ accounts: withKeys.map((a) => (a.id === 'f' ? { ...a, key: 'opening' } : a)) })).error) // key 重複
assert.ok(parseImport(v3({ accounts: withKeys.filter((a) => a.key !== 'adjust-loss') })).error) // 1つ欠ける
assert.ok(parseImport(v3({ accounts })).error) // key なし
for (const e of [{ amount: 0 }, { amount: 1.5 }, { debitId: 'c' }, { debitId: 'zzz' }, { date: '2026-13-01' }, { kind: 'weird' }])
  assert.ok(parseImport(v3({ entries: [{ ...entry, ...e }] })).error, JSON.stringify(e))

// --- v4：subscriptions つき（完成条件34：v1・v2・v3 は v4 に移行される）
const sub = { id: 's1', name: 'テスト', memo: '', amount: 500, day: 4, debitId: 'f', creditId: 'c', active: true, lastMonth: '2026-09', createdAt: 't', updatedAt: 't' }
const v4 = (o) => JSON.stringify({ schemaVersion: 4, exportedAt: 't', skills: [skill], accounts: withKeys, entries: [entry], subscriptions: [sub], ...o })
assert.ok(needsMigration({ schemaVersion: 3 }) && !needsMigration({ schemaVersion: 4 }))
assert.deepEqual(parseImport(v4({})).data, { schemaVersion: 4, skills: [skill], accounts: withKeys, entries: [entry], subscriptions: [sub] })
assert.deepEqual(parseImport(v4({ subscriptions: [] })).data.subscriptions, [])
assert.deepEqual(parseImport(v4({ subscriptions: [sub, { ...sub, id: 's2', day: 31, active: false }] })).data.subscriptions.map((s) => s.id), ['s1', 's2'])
// v3 → v4：スキルと仕訳は残り、subscriptions は空
const m3 = parseImport(v3({})).data
assert.deepEqual([m3.schemaVersion, m3.skills, m3.entries, m3.subscriptions], [4, [skill], [entry], []])
// v4 の検証：形・存在しない科目・日・金額・lastMonth
const badSub = (o) => assert.ok(parseImport(v4({ subscriptions: [{ ...sub, ...o }] })).error, JSON.stringify(o))
for (const o of [
  { amount: 0 }, { amount: 1.5 }, { amount: '500' }, { amount: -1 },
  { day: 0 }, { day: 32 }, { day: 1.5 }, { day: '4' },
  { debitId: 'zzz' }, { creditId: 'zzz' }, { debitId: 'c' }, // 存在しない科目、借方 = 貸方
  { lastMonth: '2026-13' }, { lastMonth: '2026-1' }, { lastMonth: '' }, { lastMonth: undefined }, { lastMonth: 202609 },
  { name: '' }, { name: '  ' }, { name: 5 }, { memo: 5 }, { active: 'true' }, { active: undefined }, { createdAt: 5 }, { updatedAt: undefined }, { id: 5 },
]) badSub(o)
assert.ok(parseImport(v4({ subscriptions: [sub, sub] })).error) // id 重複
assert.ok(parseImport(v4({ subscriptions: undefined })).error)
assert.ok(parseImport(v4({ subscriptions: {} })).error)
assert.ok(parseImport(v4({ subscriptions: [null] })).error)
assert.ok(parseImport(v4({ accounts: withKeys.filter((a) => a.key !== 'adjust-loss') })).error) // v4 も key が揃っていること
assert.ok(parseImport(v4({ entries: [{ ...entry, amount: 0 }] })).error)
// migrate：v3 も v4 に移行する。失敗のときは { error }、渡したデータは変わらない
const v3Data = { schemaVersion: 3, skills: [skill], accounts: withKeys, entries: [entry] }
assert.deepEqual(migrate(v3Data).data, { schemaVersion: 4, skills: [skill], accounts: withKeys, entries: [entry], subscriptions: [] })
const v3Bad = { ...v3Data, accounts: withKeys.filter((a) => a.key !== 'adjust-loss') }
const v3BadSnap = JSON.stringify(v3Bad)
assert.ok(migrate(v3Bad).error && !migrate(v3Bad).data)
assert.equal(JSON.stringify(v3Bad), v3BadSnap)
assert.ok(migrate({ ...v3Data, entries: [{ ...entry, amount: 0 }] }).error)
assert.ok(migrate({ ...v3Data, accounts: undefined }).error)
// autoRecord：記入するとき entries が増えて lastMonth が進む。しないときは同じ data を返す
const todayAuto = '2026-10-04'
const nowAuto = '2026-10-04T00:00:00.000Z'
const ar1 = autoRecord(parseImport(v4({})).data, todayAuto, nowAuto)
assert.equal(ar1.added, 1)
assert.deepEqual([ar1.data.entries.length, ar1.data.subscriptions[0].lastMonth, ar1.data.entries[1].date, ar1.data.entries[1].memo], [2, '2026-10', '2026-10-04', 'テスト'])
assert.equal(ar1.data.schemaVersion, 4)
const ar2 = autoRecord(ar1.data, todayAuto, nowAuto)
assert.deepEqual([ar2.added, ar2.data === ar1.data], [0, true])
const dataBefore = parseImport(v4({})).data
assert.equal(autoRecord(dataBefore, '2026-10-03', nowAuto).data === dataBefore, true)
assert.equal(autoRecord({ ...dataBefore, subscriptions: [] }, todayAuto, nowAuto).added, 0)
assert.equal(emptyData().subscriptions.length, 0)
console.log('ok')
assert.ok(parseImport(v2({ entries: [{ ...entry, date: '2026-02-30' }] })).error) // 実在しない日付
console.log('ok-date')
