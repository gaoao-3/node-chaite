import { createApp } from '../controllers'
import { resetAgentWebApi } from './default-web-api'

describe('createApp integration', () => {
  let warn: jest.SpyInstance
  let log: jest.SpyInstance

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    log = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
    log.mockRestore()
    resetAgentWebApi()
  })

  it('mounts the modern agent API without an initialised Chaite core', () => {
    const app = createApp(undefined, { frontendDir: '/definitely-not-a-frontend' })
    expect(app).toBeDefined()
  })
})
