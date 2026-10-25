import assert from 'node:assert/strict'
import express from 'express'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  inferProvider,
  inferContextWindow,
  inferThinkingCapability,
  inferVisionCapability,
  formatContextWindow,
  ModelDiscoveryService,
} from '../agent/models/model-service'
import { createAgentWebApiRouter } from './web-api'
import { SessionRegistry } from './session-registry'

describe('model metadata inference', () => {
  it('correctly infers provider, context windows and capabilities', () => {
    // 1. Google Gemini
    assert.equal(inferProvider('gemini-3.8-flash-high'), 'google')
    assert.equal(inferContextWindow('gemini-3.8-flash-high'), 1_048_576)
    assert.equal(formatContextWindow(1_048_576), '1M')
    assert.equal(inferThinkingCapability('gemini-3.8-flash-high').supportsThinking, true)
    assert.equal(inferThinkingCapability('gemini-3.8-flash-high').thinkingType, 'gemini_level')
    assert.equal(inferVisionCapability('gemini-3.8-flash-high'), true)

    // 2. Anthropic Claude 3.7
    assert.equal(inferProvider('claude-3.7-sonnet'), 'anthropic')
    assert.equal(inferContextWindow('claude-3.7-sonnet'), 200_000)
    assert.equal(formatContextWindow(200_000), '200K')
    assert.equal(inferThinkingCapability('claude-3.7-sonnet').supportsThinking, true)
    assert.equal(inferThinkingCapability('claude-3.7-sonnet').thinkingType, 'budget_tokens')
    assert.equal(inferVisionCapability('claude-3.7-sonnet'), true)

    // 3. DeepSeek R1 vs V3
    assert.equal(inferProvider('deepseek-r1'), 'deepseek')
    assert.equal(inferThinkingCapability('deepseek-r1').supportsThinking, true)
    assert.equal(inferThinkingCapability('deepseek-r1').thinkingType, 'reasoning_effort')

    assert.equal(inferProvider('deepseek-chat'), 'deepseek')
    assert.equal(inferThinkingCapability('deepseek-chat').supportsThinking, false)
    assert.equal(inferContextWindow('deepseek-chat'), 64_000)

    // 4. OpenAI
    assert.equal(inferProvider('gpt-4o'), 'openai')
    assert.equal(inferContextWindow('gpt-4o'), 128_000)
    assert.equal(inferThinkingCapability('gpt-4o').supportsThinking, false)
    assert.equal(inferThinkingCapability('o3-mini').supportsThinking, true)
  })
})

describe('GET /api/agent/models endpoint', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    const app = express()
    app.use(express.json())

    const mockModelService = {
      getAvailableModels: async () => [
        {
          id: 'gemini-3.8-flash-high',
          label: 'Gemini 3.8 Flash',
          provider: 'google',
          channelName: 'default-gemini',
          contextWindow: 1_048_576,
          contextWindowFormatted: '1M',
          supportsThinking: true,
          thinkingType: 'gemini_level',
          supportsVision: true,
          supportsTools: true,
          isRecommended: true,
        },
        {
          id: 'claude-3.7-sonnet',
          label: 'Claude 3.7 Sonnet',
          provider: 'anthropic',
          channelName: 'default-gemini',
          contextWindow: 200_000,
          contextWindowFormatted: '200K',
          supportsThinking: true,
          thinkingType: 'budget_tokens',
          supportsVision: true,
          supportsTools: true,
          isRecommended: true,
        },
        {
          id: 'gpt-4o',
          label: 'GPT-4o',
          provider: 'openai',
          channelName: 'default-gemini',
          contextWindow: 128_000,
          contextWindowFormatted: '128K',
          supportsThinking: false,
          supportsVision: true,
          supportsTools: true,
          isRecommended: true,
        },
      ],
    }

    const sessions = new SessionRegistry()
    const router = createAgentWebApiRouter({
      sessions,
      modelDiscovery: mockModelService as unknown as ModelDiscoveryService,
    })
    app.use('/api/agent', router)

    server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', () => resolve()))
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}/api/agent`
  })

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()))
      })
    }
  })

  it('returns models list and supports filtering', async () => {
    // 1. Fetch all models
    const resAll = await (await fetch(`${baseUrl}/models`)).json()
    assert.equal(resAll.success, true)
    assert.equal(resAll.data.total, 3)
    assert.equal(resAll.data.items.length, 3)

    // 2. Query filter
    const resQuery = await (await fetch(`${baseUrl}/models?query=claude`)).json()
    assert.equal(resQuery.data.total, 1)
    assert.equal(resQuery.data.items[0].id, 'claude-3.7-sonnet')

    // 3. Provider filter
    const resProvider = await (await fetch(`${baseUrl}/models?provider=google`)).json()
    assert.equal(resProvider.data.total, 1)
    assert.equal(resProvider.data.items[0].id, 'gemini-3.8-flash-high')
  })
})
