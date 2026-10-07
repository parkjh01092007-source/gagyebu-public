// データの読み書きはこのファイルだけで行う。保存先を変えるときはここだけ直す。
import { makeInitialAccounts, addKeys, applySubscriptions, TYPES, ROLES, KINDS, SPECIAL_KEYS, isDate } from './ledgerLogic.js'

const KEY = 'orenoyome'
export const SCHEMA_VERSION = 4

export const emptyData = () => ({ schemaVersion: SCHEMA_VERSION, skills: [], accounts: makeInitialAccounts(), entries: [], subscriptions: [] })

// 保存されている版が古ければそのまま返す（移行は migrate を呼んだときだけ）
export function loadData() {
  const raw = localStorage.getItem(KEY)
  if (raw === null) return emptyData()
  return JSON.parse(raw)
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export const needsMigration = (data) => data.schemaVersion < SCHEMA_VERSION

// v1（スキルのみ）・v2・v3 → v4。スキルはそのまま引き継ぐ。成功: { data } / 失敗: { error }（渡したデータは変えない）
// v1：初期科目・仕訳なし。v2：key を付ける（欠けたら error）。v3：そのまま。どれも subscriptions は空で足す。
// 組み立てた結果は、返す前に v4 の検証（key込み）にかける。保存は、呼ぶ側が成功のときだけ行う。
export function migrate(data) {
  let accounts = []
  let entries = []
  if (data.schemaVersion === 1) {
    accounts = makeInitialAccounts()
  } else {
    if (data.schemaVersion === 2) {
      const r = addKeys(Array.isArray(data.accounts) ? data.accounts : [])
      if (r.error) return r
      accounts = r.accounts
    } else {
      accounts = data.accounts
    }
    entries = data.entries
  }
  const subscriptions = []
  const error = checkLedger(accounts, entries, { requireKeys: true }) ?? checkSubscriptions(subscriptions, accounts)
  if (error) return { error }
  return { data: { schemaVersion: SCHEMA_VERSION, skills: data.skills, accounts, entries, subscriptions } }
}

// 定期支払いの自動記入（v4 のデータに対して）。今日と now は呼ぶ側から渡す。記入しないときは、同じ data を返す
export function autoRecord(data, today, now) {
  const r = applySubscriptions(data.subscriptions, data.entries, today, now)
  if (r.added === 0) return { data, added: 0 }
  return { data: { ...data, subscriptions: r.subscriptions, entries: r.entries }, added: r.added }
}

// 書き出し：schemaVersion を一番上に、書き出し日時を付ける。残りのデータ（skills, accounts, entries, subscriptions）はそのまま入れる
export function exportJson() {
  const { schemaVersion, ...rest } = loadData()
  return JSON.stringify({ schemaVersion, exportedAt: new Date().toISOString(), ...rest }, null, 2)
}

const isStr = (v) => typeof v === 'string'
const isInt = (v) => Number.isInteger(v)
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

function validSkill(s) {
  return (
    isObj(s) && isStr(s.id) && isStr(s.name) && isInt(s.level) && s.level >= 0 && s.level <= 500 &&
    isStr(s.createdAt) && isStr(s.updatedAt) &&
    isObj(s.descriptions) &&
    Object.entries(s.descriptions).every(([k, v]) => /^\d+$/.test(k) && Number(k) <= 50 && isStr(v)) &&
    Array.isArray(s.levelHistory) &&
    s.levelHistory.every((h) => isObj(h) && isStr(h.changedAt) && isInt(h.from) && isInt(h.to))
  )
}

function validAccount(a) {
  return (
    isObj(a) && isStr(a.id) && isStr(a.name) && a.name.trim() !== '' &&
    TYPES.includes(a.type) &&
    (a.key === undefined || SPECIAL_KEYS.includes(a.key)) &&
    (a.type === 'asset' ? ROLES.includes(a.role) : a.role === undefined) &&
    typeof a.active === 'boolean' && isStr(a.createdAt) && isStr(a.updatedAt)
  )
}

const unique = (list) => new Set(list).size === list.length

function validEntry(e, accountIds) {
  return (
    isObj(e) && isStr(e.id) && isDate(e.date) &&
    accountIds.has(e.debitId) && accountIds.has(e.creditId) && e.debitId !== e.creditId &&
    isInt(e.amount) && e.amount >= 1 && isStr(e.memo) && KINDS.includes(e.kind) &&
    isStr(e.createdAt) && isStr(e.updatedAt)
  )
}

// accounts / entries の検証。エラー文を返す（問題なければ null）。requireKeys: 4つの特別科目の key が揃っていること（v3）
function checkLedger(accounts, entries, { requireKeys = false } = {}) {
  if (!Array.isArray(accounts) || !accounts.every(validAccount)) return '계정과목 데이터의 형식이 올바르지 않습니다'
  if (!unique(accounts.map((a) => a.id))) return '계정과목 id가 중복되었습니다'
  if (!unique(accounts.map((a) => a.name.trim()))) return '계정과목 이름이 중복되었습니다'
  const keys = accounts.filter((a) => a.key !== undefined).map((a) => a.key)
  if (!unique(keys)) return '계정과목 key가 중복되었습니다'
  if (requireKeys && !SPECIAL_KEYS.every((k) => keys.includes(k))) return '특별한 계정과목(시작 잔액・조정이익・조정손실・카드 미결제)이 없습니다'
  if (!Array.isArray(entries)) return '분개 데이터의 형식이 올바르지 않습니다'
  const ids = new Set(accounts.map((a) => a.id))
  if (!entries.every((e) => validEntry(e, ids))) return '분개 데이터가 올바르지 않습니다(금액・날짜・계정과목・종류를 확인해 주세요)'
  if (!unique(entries.map((e) => e.id))) return '분개 id가 중복되었습니다'
  return null
}

function validSubscription(s, accountIds) {
  return (
    isObj(s) && isStr(s.id) && isStr(s.name) && s.name.trim() !== '' && isStr(s.memo) &&
    isInt(s.amount) && s.amount >= 1 && isInt(s.day) && s.day >= 1 && s.day <= 31 &&
    accountIds.has(s.debitId) && accountIds.has(s.creditId) && s.debitId !== s.creditId &&
    typeof s.active === 'boolean' && isStr(s.lastMonth) && /^\d{4}-(0[1-9]|1[0-2])$/.test(s.lastMonth) &&
    isStr(s.createdAt) && isStr(s.updatedAt)
  )
}

// subscriptions の検証。エラー文を返す（問題なければ null）。accounts は検証済みの科目の配列
function checkSubscriptions(subscriptions, accounts) {
  if (!Array.isArray(subscriptions)) return '정기 지출 데이터의 형식이 올바르지 않습니다'
  const ids = new Set(accounts.map((a) => a.id))
  if (!subscriptions.every((s) => validSubscription(s, ids))) return '정기 지출 데이터가 올바르지 않습니다(이름・금액・날・계정과목・마지막으로 기록한 달을 확인해 주세요)'
  if (!unique(subscriptions.map((s) => s.id))) return '정기 지출 id가 중복되었습니다'
  return null
}

// 読み込みファイルの検証のみ。現在のデータには触れない。成功: { data } / 失敗: { error }
export function parseImport(text) {
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return { error: 'JSON으로 읽을 수 없습니다. 깨진 파일입니다' }
  }
  if (!isObj(json) || !isInt(json.schemaVersion)) return { error: '이 앱의 데이터 파일이 아닙니다' }
  if (json.schemaVersion > SCHEMA_VERSION) return { error: '이 앱보다 새로운 버전의 파일입니다. 불러올 수 없습니다' }
  if (json.schemaVersion < 1 || !Array.isArray(json.skills) || !json.skills.every(validSkill))
    return { error: '데이터 형식이 올바르지 않습니다' }
  if (json.schemaVersion === 1) return migrate(json)
  const error = checkLedger(json.accounts, json.entries, { requireKeys: json.schemaVersion >= 3 })
  if (error) return { error }
  if (json.schemaVersion < 4) return migrate(json) // v2・v3 → v4（migrate が v4 の検証をする）
  const subError = checkSubscriptions(json.subscriptions, json.accounts)
  if (subError) return { error: subError }
  return { data: { schemaVersion: 4, skills: json.skills, accounts: json.accounts, entries: json.entries, subscriptions: json.subscriptions } }
}
