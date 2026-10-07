import { useState } from 'react'
import DescriptionEditor from './DescriptionEditor.jsx'
import { parseLevel, formatLevel, effectiveDescription, validateName, newSkill, changeLevel } from '../skillLogic.js'

function SkillRow({ skill, skills, onChange, onDelete }) {
  const [name, setName] = useState(skill.name)
  const [level, setLevel] = useState(formatLevel(skill.level))
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const saveName = () => {
    const r = validateName(name, skills, skill.id)
    if (r.error) return setError(r.error)
    setError('')
    if (r.name !== skill.name) onChange({ ...skill, name: r.name, updatedAt: new Date().toISOString() })
    setName(r.name)
  }

  const saveLevel = () => {
    const r = parseLevel(level)
    if (r.error) return setError(r.error)
    setError('')
    onChange(changeLevel(skill, r.level))
    setLevel(formatLevel(r.level))
  }

  const remove = () => {
    if (window.confirm(`「${skill.name}」を削除します。元に戻せません。先に書き出しておくことをおすすめします。`)) onDelete()
  }

  return (
    <li>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={saveName}>名前を変更</button>
      {' '}レベル <input size="5" value={level} onChange={(e) => setLevel(e.target.value)} />
      <button onClick={saveLevel}>レベルを変更</button>
      <button onClick={remove}>削除</button>
      <div>現在のレベル：{formatLevel(skill.level)}</div>
      <div>説明：{effectiveDescription(skill)}</div>
      <button onClick={() => setEditing(!editing)}>{editing ? '説明の編集を閉じる' : '説明を編集'}</button>
      {editing && <DescriptionEditor skill={skill} onChange={onChange} />}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </li>
  )
}

export default function Skills({ data, update }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const setSkills = (skills) => update({ ...data, skills })

  const add = (e) => {
    e.preventDefault()
    const r = validateName(name, data.skills)
    if (r.error) return setError(r.error)
    setError('')
    setSkills([...data.skills, newSkill(r.name)])
    setName('')
  }

  return (
    <>
      <form onSubmit={add}>
        <input placeholder="スキル名" value={name} onChange={(e) => setName(e.target.value)} />
        <button>追加</button>
        {error && <span style={{ color: 'red' }}> {error}</span>}
      </form>
      <ul>
        {data.skills.map((s) => (
          <SkillRow
            key={s.id}
            skill={s}
            skills={data.skills}
            onChange={(next) => setSkills(data.skills.map((x) => (x.id === s.id ? next : x)))}
            onDelete={() => setSkills(data.skills.filter((x) => x.id !== s.id))}
          />
        ))}
      </ul>
    </>
  )
}
