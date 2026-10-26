import { EventEmitter } from 'node:events'
import { Vec3 } from 'vec3'
import { describe, expect, test } from 'vitest'
import { entity as initEntity, server as initServer } from '../../src/lib/modules/communication'

const createHarness = () => {
  const world = {} as Entity['world']
  const createEntity = (id: number, position: Vec3, overrides: Partial<Entity> = {}) => ({
    id,
    position,
    world,
    type: 'player',
    ready: true,
    ...overrides
  } as Entity)
  const source = createEntity(1, new Vec3(50, 64, -20), { viewDistance: 128, nearbyEntities: [] })
  const colocated = createEntity(2, new Vec3(50, 64, -20))
  const near = createEntity(3, new Vec3(53, 68, -20))
  const boundary = createEntity(4, new Vec3(56, 72, -20))
  const far = createEntity(5, new Vec3(150, 64, -20))
  const outsideView = createEntity(6, new Vec3(179, 64, -20))
  const otherWorld = createEntity(7, source.position.clone(), { world: {} as Entity['world'] })
  const notReady = createEntity(8, source.position.clone(), { ready: false })
  const mob = createEntity(9, source.position.clone(), { type: 'mob' })
  const entities = [source, colocated, near, boundary, far, outsideView, otherWorld, notReady, mob]
  const serv = {
    _server: new EventEmitter(),
    entities: Object.fromEntries(entities.map(entity => [entity.id, entity])),
    players: entities.filter(entity => entity.type === 'player')
  } as unknown as Server

  initServer(serv, { version: '1.20.4' } as Options)
  initEntity(source, serv)
  source.nearbyEntities = source.getNearby()
  return { source, near, far }
}

describe.each(['getNearbyPlayers', 'nearbyPlayers'] as const)('%s', method => {
  test('includes players at the radius boundary and excludes farther players', () => {
    const { source } = createHarness()

    expect(source[method](10).map(player => player.id)).toEqual([2, 3, 4])
  })

  test('radius zero includes only other players at the same position', () => {
    const { source } = createHarness()

    expect(source[method](0).map(player => player.id)).toEqual([2])
  })

  test('defaults to view distance and preserves candidate eligibility', () => {
    const { source } = createHarness()

    expect(source[method]().map(player => player.id)).toEqual([2, 3, 4, 5])
    expect(source[method](256).map(player => player.id)).toEqual([2, 3, 4, 5])
  })
})

test('nearbyPlayers preserves the visible entity list', () => {
  const { source, near } = createHarness()
  source.nearbyEntities = source.nearbyEntities.filter(entity => entity !== near)

  expect(source.nearbyPlayers(10).map(player => player.id)).toEqual([2, 4])
  expect(source.getNearbyPlayers(10).map(player => player.id)).toEqual([2, 3, 4])
})

test('nearbyPlayers applies the default radius to cached players that have moved away', () => {
  const { source, far } = createHarness()
  far.position = new Vec3(179, 64, -20)

  expect(source.nearbyPlayers().map(player => player.id)).toEqual([2, 3, 4])
})
