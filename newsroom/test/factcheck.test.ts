import assert from 'node:assert/strict'
import {test} from 'node:test'
import {factCheck, numbersIn, type RecordInput} from '../../studio/lib/factcheck'
import {toPortableText} from '../effects/draft-story'

const pawns = [
  {_id: 'pawn-snake', aliases: ['Snake', 'Rato', 'Snake Rato']},
  {_id: 'pawn-grasshopper', aliases: ['Reiraborvas', 'Grasshopper', 'Canga', 'Rato', "Reiraborvas 'Grasshopper' Rato"]},
  {_id: 'pawn-roca', aliases: ['Rocaniraalbo', 'Ambmea']},
]
const records = new Map<string, RecordInput>(
  [
    {_id: 'r-marriage', colonyDay: 132, text: "Snake Rato married Reiraborvas 'Grasshopper' Rato.", pawns: [{_ref: 'pawn-snake'}, {_ref: 'pawn-grasshopper'}]},
    {_id: 'r-inspired', colonyDay: 268, text: 'The inspiration will end after 8 days.', pawns: [{_ref: 'pawn-snake'}]},
    {_id: 'r-fight', colonyDay: 265, text: 'Snake Rato got into a fist fight with Rocaniraalbo Ambmea.', pawns: [{_ref: 'pawn-snake'}, {_ref: 'pawn-roca'}]},
  ].map((r) => [r._id, r]),
)

function check(paragraphs: Parameters<typeof toPortableText>[0], headline = 'Wedding bells', dek = '') {
  return factCheck({headline, dek, body: toPortableText(paragraphs)}, records, pawns)
}

test('a story built from receipts passes', () => {
  const v = check([[{text: 'Snake married Grasshopper on Day 132.', records: ['r-marriage']}, {text: 'Nobody saw it coming.', aside: true}]])
  assert.deepEqual(v.problems, [])
  assert.equal(v.claims, 1)
  assert.equal(v.asides, 1)
})

test('naming someone the receipts never mention fails', () => {
  const v = check([[{text: 'Snake taught Rocaniraalbo to hunt.', records: ['r-marriage']}]])
  assert.match(v.problems[0].reason, /names Rocaniraalbo/)
})

test('a shared surname counts for whoever the receipts do mention', () => {
  const v = check([[{text: 'Rato was inspired on Day 268.', records: ['r-inspired']}]])
  assert.deepEqual(v.problems, [])
})

test('numbers need a receipt, in digits or words', () => {
  assert.deepEqual(numbersIn('after eight days, twenty-one hours and 1,200 silver'), [1200, 8, 21])
  assert.deepEqual(check([[{text: 'The inspiration lasted eight days.', records: ['r-inspired']}]]).problems, [])
  const v = check([[{text: 'The inspiration lasted nine days.', records: ['r-inspired']}]])
  assert.match(v.problems[0].reason, /says 9/)
})

test('asides may not name anyone or count anything', () => {
  const v = check([[{text: 'Snake married Grasshopper.', records: ['r-marriage']}, {text: 'Rocaniraalbo was not invited to all 3 parties.', aside: true}]])
  assert.deepEqual(v.problems.map((p) => p.reason), ['is an aside that names Rocaniraalbo', 'is an aside with a number in it'])
})

test('a sentence with no receipt and no aside mark fails', () => {
  const body = toPortableText([[{text: 'Snake married Grasshopper.', records: ['r-marriage']}]])
  body[0].children!.push({_type: 'span', text: 'Unmarked gossip.', marks: []})
  const v = factCheck({headline: 'x', body}, records, pawns)
  assert.match(v.problems[0].reason, /no receipt/)
})

test('the headline can only use what the body proved', () => {
  const para = [{text: 'Snake married Grasshopper.', records: ['r-marriage']}]
  assert.deepEqual(check([para], 'Day 132: Snake says yes').problems, [])
  assert.match(check([para], 'Snake fights Rocaniraalbo').problems[0].reason, /names Rocaniraalbo/)
})

test('citing a record that does not exist fails', () => {
  const v = check([[{text: 'Snake married Grasshopper.', records: ['r-invented']}]])
  assert.deepEqual(v.problems.map((p) => p.reason), ["cites r-invented, which isn't a record", 'is a claim with no receipts'])
})
