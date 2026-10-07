import { useState } from 'react'
import { sections } from './sections.js'
import { loadData, saveData, exportJson, parseImport, needsMigration, migrate, autoRecord } from './storage.js'
import { today } from './today.js'

// アプリを開いたとき：データを読み、移行が要らなければ、定期支払いの自動記入を行って保存する。
// 最後に記入した月（lastMonth）が保存されるので、何回走っても（StrictMode の2回呼びでも）二重にならない。
function startup() {
  const data = loadData()
  if (needsMigration(data)) return data // 移行のあと（doMigrate）で記入する
  const r = autoRecord(data, today())
  if (r.added) saveData(r.data)
  return r.data
}

export default function App() {
  const [data, setData] = useState(startup)
  const [current, setCurrent] = useState(sections[0].id)
  const { Component } = sections.find((s) => s.id === current)

  const [error, setError] = useState('')
  const [generation, setGeneration] = useState(0) // 読み込みのたびに増やし、画面の入力状態を作り直す

  const doExport = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }))
    a.download = `gagyebu-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}.backup.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const doImport = async (e) => {
    const file = e.target.files[0]
    e.target.value = '' // 同じファイルを続けて選べるように
    if (!file) return
    if (!window.confirm('지금 데이터는 덮어써집니다. 먼저 내보내셨나요?')) return
    const r = parseImport(await file.text())
    if (r.error) return setError(r.error)
    setError('')
    update(autoRecord(r.data, today()).data) // 読み込み直後にも、定期支払いの自動記入を1回行う
    setGeneration((g) => g + 1)
  }

  const doMigrate = () => {
    const r = migrate(data)
    if (r.error) return setError(r.error) // 移行画面は残し、データは変えない
    setError('')
    update(autoRecord(r.data, today()).data) // 移行直後にも、定期支払いの自動記入を1回行う
    setGeneration((g) => g + 1)
  }

  const update = (next) => {
    saveData(next)
    setData(next)
  }

  return (
    <>
      <header>
        <nav>
          {sections.map((s) => (
            <button key={s.id} disabled={s.id === current} onClick={() => setCurrent(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>
        <div>
          <button onClick={doExport}>내보내기</button>
          <label>
            <input type="file" accept=".json" onChange={doImport} hidden />
            <span role="button" style={{ border: '1px solid #767676', borderRadius: 3, padding: '1px 6px', cursor: 'pointer' }}>불러오기</span>
          </label>
        </div>
      </header>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {needsMigration(data) ? (
        <div className="migration">
          <p>데이터 형식을 새 버전으로 옮깁니다. 옮기기 전에 내보내 두시기를 권합니다.</p>
          <button onClick={doExport}>내보내기</button>
          <button onClick={doMigrate}>옮기기</button>
        </div>
      ) : (
        <main key={generation}>
          <Component data={data} update={update} />
        </main>
      )}
    </>
  )
}
