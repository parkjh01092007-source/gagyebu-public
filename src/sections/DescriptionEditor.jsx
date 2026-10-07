import { useState } from 'react'
import { effectiveStage, stageOf, setDescription } from '../skillLogic.js'

function Row({ stage, text, active, current, onSave }) {
  const [draft, setDraft] = useState(text)
  return (
    <li style={active ? { background: '#fff3b0' } : undefined}>
      <b>{(stage / 10).toFixed(1)}</b>
      {active && ' ◀ 現在有効'}
      {current && ' (現在のレベルの段階)'}
      <br />
      <textarea rows="2" cols="50" value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button onClick={() => onSave(draft)}>保存</button>
      <button onClick={() => { setDraft(''); onSave('') }}>削除</button>
    </li>
  )
}

export default function DescriptionEditor({ skill, onChange }) {
  const active = effectiveStage(skill)
  const current = stageOf(skill.level)
  return (
    <ol start="0" style={{ listStyle: 'none', padding: 0 }}>
      {Array.from({ length: 51 }, (_, i) => (
        <Row
          key={i}
          stage={i}
          text={skill.descriptions[i] ?? ''}
          active={i === active}
          current={i === current}
          onSave={(t) => onChange(setDescription(skill, i, t))}
        />
      ))}
    </ol>
  )
}
