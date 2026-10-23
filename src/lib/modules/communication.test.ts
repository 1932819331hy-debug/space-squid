import { expect, test } from 'vitest'
import { EventEmitter } from 'events'
import { Vec3 } from 'vec3'
import { entity as entityModule, server as serverModule } from './communication'

const createHarness = () => {
  const world = {}
  const source = {
    id: 1,
    type: 'player',
    ready: true,
    world,
    position: new Vec3(10, 20, 30),
    viewDistance: 150,
    nearbyEntities: []
  } as any
  const serv = {
    _server: new EventEmitter(),
    players: [source],
    entities: { 1: source }
  } as any
  serverModule(serv, { version: '1.20.4' } as any)
  entityModule(source, serv)
  const add = (id: number, position: Vec3, overrides = {}) => {
    const candidate = { id, type: 'player', ready: true, world, position, ...overrides }
    serv.entities[id] = candidate
    if (candidate.type === 'player') serv.players.push(candidate)
    return candidate
  }
  const cacheNearby = () => { source.nearbyEntities = source.getNearby() }
  return { source, add, cacheNearby }
}

const ids = (players: Player[]) => players.map(player => player.id)

for (const method of ['getNearbyPlayers', 'nearbyPlayers'] as const) {
  test(`${method} excludes far players already in its candidate list`, () => {
    const { source, add, cacheNearby } = createHarness()
    add(2, new Vec3(13, 20, 30))
    add(3, new Vec3(110, 20, 30))
    cacheNearby()

    expect(ids(source[method](10))).toEqual([2])
  })

  test(`${method} includes the exact three-dimensional radius boundary`, () => {
    const { source, add, cacheNearby } = createHarness()
    add(2, new Vec3(13, 24, 42)) // distance 13 from a non-origin source
    add(3, new Vec3(13, 24, 42.01))
    add(4, new Vec3(10, 20, 42))
    cacheNearby()

    expect(ids(source[method](13))).toEqual([2, 4])
  })

  test(`${method} includes colocated players but not self at radius zero`, () => {
    const { source, add, cacheNearby } = createHarness()
    add(2, new Vec3(10, 20, 30))
    add(3, new Vec3(10.01, 20, 30))
    cacheNearby()

    expect(ids(source[method](0))).toEqual([2])
  })

  test(`${method} excludes non-player entities`, () => {
    const { source, add, cacheNearby } = createHarness()
    add(2, new Vec3(11, 20, 30), { type: 'mob' })
    add(3, new Vec3(12, 20, 30))
    cacheNearby()

    expect(ids(source[method](10))).toEqual([3])
  })

  test(`${method} defaults to viewDistance and uses current positions`, () => {
    const { source, add, cacheNearby } = createHarness()
    source.viewDistance = 10
    add(2, new Vec3(20, 20, 30))
    const moved = add(3, new Vec3(19, 20, 30))
    cacheNearby()
    moved.position = new Vec3(21, 20, 30)

    expect(ids(source[method]())).toEqual([2])
  })
}

test('getNearbyPlayers preserves world, ready-state and view-distance filtering', () => {
  const { source, add } = createHarness()
  source.viewDistance = 10
  add(2, new Vec3(20, 20, 30))
  add(3, new Vec3(11, 20, 30), { world: {} })
  add(4, new Vec3(11, 20, 30), { ready: false })
  add(5, new Vec3(21, 20, 30))

  expect(ids(source.getNearbyPlayers(100))).toEqual([2])
})

test('nearbyPlayers preserves the visible candidate list instead of querying all entities', () => {
  const { source, add } = createHarness()
  const visible = add(2, new Vec3(11, 20, 30))
  add(3, new Vec3(12, 20, 30))
  source.nearbyEntities = [visible]

  expect(ids(source.nearbyPlayers(10))).toEqual([2])
  expect(ids(source.getNearbyPlayers(10))).toEqual([2, 3])
})
