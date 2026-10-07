// 実行: node src/skillLogic.check.js
import assert from 'node:assert/strict'
import { parseLevel, formatLevel, validateName, newSkill, changeLevel } from './skillLogic.js'

assert.equal(parseLevel('1.22').level, 122)
assert.equal(parseLevel('1.5').level, 150)
assert.equal(parseLevel('0').level, 0)
assert.equal(parseLevel('5').level, 500)
assert.equal(parseLevel('5.00').level, 500)
for (const bad of ['1.225', '5.01', '-0.01', '', ' ', '1e0', 'abc', '.5']) assert.ok(parseLevel(bad).error, bad)
assert.equal(formatLevel(122), '1.22')
assert.equal(formatLevel(0), '0.00')

const a = newSkill('英語')
assert.ok(validateName('  ', [a]).error)
assert.ok(validateName('英語', [a]).error)
assert.equal(validateName('英語', [a], a.id).name, '英語')

let s = newSkill('簿記')
for (const v of [122, 122, 200]) s = changeLevel(s, v)
assert.deepEqual(s.levelHistory.map((h) => [h.from, h.to]), [[0, 122], [122, 200]])
console.log('ok')

import { effectiveDescription, setDescription, stageOf } from './skillLogic.js'
let d = newSkill('x')
assert.equal(stageOf(145), 14)
assert.equal(stageOf(150), 15)
assert.equal(effectiveDescription(d), '説明未設定')
d = setDescription(setDescription(d, 10, 'A'), 15, 'B')
assert.equal(effectiveDescription({ ...d, level: 149 }), 'A')
assert.equal(effectiveDescription({ ...d, level: 150 }), 'B')
assert.equal(effectiveDescription({ ...d, level: 99 }), '説明未設定')
d = setDescription(d, 0, 'Z')
assert.equal(effectiveDescription({ ...d, level: 99 }), 'Z')
assert.equal(effectiveDescription({ ...d, level: 0 }), 'Z')
assert.ok(!('0' in setDescription(d, 0, '').descriptions))
console.log('ok2')
