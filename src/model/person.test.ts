import { describe, expect, it } from 'vitest'
import { cardName, emptyPerson, formatLifeEvent, fullName, lifeSpan } from './person.ts'

const person = (over: Partial<ReturnType<typeof emptyPerson>>) => ({ ...emptyPerson(), ...over })

describe('names', () => {
  it('joins name parts and falls back when empty', () => {
    expect(fullName(person({ firstName: 'Mary', middleName: 'Ann', lastName: 'Lee' }))).toBe('Mary Ann Lee')
    expect(fullName(person({}))).toBe('Unnamed person')
    expect(cardName(person({ firstName: 'Robert', nickname: 'Bob', lastName: 'Lee' }))).toBe('Robert "Bob" Lee')
  })
})

describe('lifeSpan', () => {
  it('describes living and deceased people', () => {
    expect(lifeSpan(person({ birth: { date: '1/1/1990', place: '' } }))).toBe('b. 1990')
    expect(lifeSpan(person({ living: false, birth: { date: '1890', place: '' }, death: { date: '1960', place: '' } }))).toBe('1890 – 1960')
    expect(lifeSpan(person({ living: false, birth: { date: 'abt 1890', place: '' } }))).toBe('c. 1890 – ?')
    expect(lifeSpan(person({ living: false }))).toBe('Deceased')
    expect(lifeSpan(person({}))).toBe('')
  })
})

describe('formatLifeEvent', () => {
  it('uses the Wikipedia style', () => {
    expect(formatLifeEvent({ date: '01/01/2000', place: 'Manhattan, NY, USA' })).toBe('1/1/2000 (Manhattan, NY, USA)')
    expect(formatLifeEvent({ date: '', place: 'Boston' })).toBe('Boston')
    expect(formatLifeEvent({ date: '1890', place: '' })).toBe('1890')
  })
})
