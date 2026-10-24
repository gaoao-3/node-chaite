import type { Chaite } from '../core/chaite'
import type { EventMessage } from '../types/external'
import type { ImageContent, ModelResponse, ModelResponseChunk, TextContent, UserMessage } from '../types/models'
import type { OutboundReplyPart } from '../agent/gateway-contracts'
import { ServiceUnavailableError } from './errors'
import type { PromptDriverContext, PromptDriverResult, SessionPromptDriver } from './types'
import type { EvolutionService } from './evolution-service'
import { synthesizeAndRecordEvolution } from './evolution-synthesizer'

export interface ChaitePromptDriverOptions {
  /** Use an already-initialised Chaite instance. */
  chaite?: Chaite
  /** Lazy resolver used by the default router (avoids an import cycle). */
  resolveChaite?: () => Promise<Chaite | undefined>
  /** Fallback user id when the session has no platform sender. */
  defaultUserId?: string
  /** Evolution service for Hermes / nekocode closed learning loop. */
  evolutionService?: EvolutionService
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function preview(value: unknown, max = 400): string {
  try {
    const text = JSON.stringify(value)
    return text.length > max ? `${text.slice(0, max)}…` : text
  } catch {
    return String(value).slice(0, max)
  }
}

function usageOf(response: ModelResponse): PromptDriverResult['usage'] {
  const usage = response.usage
  if (!usage) return undefined
  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    cachedTokens: usage.cachedTokens,
    reasoningTokens: usage.reasoningTokens,
  }
}

function partsOf(response: ModelResponse): { parts: OutboundReplyPart[]; text: string } {
  const parts: OutboundReplyPart[] = []
  const texts: string[] = []
  for (const content of response.contents ?? []) {
    if (content.type === 'text') {
      const text = content as TextContent
      texts.push(text.text)
      parts.push({ type: 'markdown', markdown: text.text })
    } else if (content.type === 'image') {
      const image = content as ImageContent
      const source = image.image.startsWith('data:')
        ? { source: 'base64' as const, data: image.image, mimeType: image.mimeType ?? 'image/png' }
        : { source: 'url' as const, url: image.image }
      parts.push({ type: 'image', source, alt: 'generated image' })
    }
  }
  return { parts, text: texts.join('\n') }
}

function buildUserMessage(prompt: string, images?: Array<{ url?: string; base64?: string; mimeType?: string }>): UserMessage {
  const content: Array<TextContent | ImageContent> = [{ type: 'text', text: prompt }]
  if (images && images.length > 0) {
    for (const img of images) {
      content.push({
        type: 'image',
        image: img.base64 || img.url || '',
        mimeType: img.mimeType || 'image/jpeg',
      })
    }
  }
  return {
    role: 'user',
    content,
  }
}

function buildEvent(context: PromptDriverContext, defaultUserId: string): EventMessage {
  const metadata = context.session.metadata
  const userId = typeof metadata.userId === 'string' || typeof metadata.userId === 'number'
    ? metadata.userId
    : defaultUserId
  const groupId = typeof metadata.groupId === 'string' || typeof metadata.groupId === 'number'
    ? metadata.groupId
    : undefined
  return {
    sender: {
      user_id: userId,
      nickname: typeof metadata.nickname === 'string' ? metadata.nickname : 'Web Console',
    },
    ...(groupId !== undefined ? { group: { group_id: groupId } } : {}),
  }
}

/**
 * Production bridge from the web session registry to Chaite's model/tool loop.
 *
 * It uses `Chaite.sendMessage()` with the existing streaming callback, so
 * reasoning deltas become `thought_chunk`, assistant text becomes `text_chunk`,
 * tool calls become `tool_status`, and the final `ModelResponse` becomes
 * `final_reply` (emitted by the session registry).
 */
export function createChaitePromptDriver(options: ChaitePromptDriverOptions = {}): SessionPromptDriver {
  const defaultUserId = options.defaultUserId ?? 'web-console'

  async function resolveChaite(): Promise<Chaite> {
    const chaite = options.chaite ?? await options.resolveChaite?.()
    if (!chaite) {
      throw new ServiceUnavailableError('Chaite core is not initialised', { code: 'CHAITE_UNAVAILABLE' })
    }
    return chaite
  }

  return {
    async run(context: PromptDriverContext): Promise<PromptDriverResult> {
      const chaite = await resolveChaite()
      if (context.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const presetManager = chaite.getChatPresetManager()
      const presets = await presetManager.getAllPresets({ includeLocal: true })
      if (presets.length === 0) {
        throw new ServiceUnavailableError('No chat preset is configured', { code: 'CHAT_PRESET_UNAVAILABLE' })
      }

      const skillName = context.session.activeTurn?.skillName
      const registry = chaite.getSkillRegistry()
      const skillPreset = skillName ? registry?.getSkillByName(skillName)?.frontmatter.preset : undefined
      const preset = presets.find(item => item.name === skillPreset) ?? presets[0]

      const startedAt = Date.now()
      const executedToolCalls: Array<{
        id: string
        name: string
        arguments: Record<string, unknown>
        status: 'succeeded' | 'failed' | 'denied' | 'skipped'
        resultPreview?: string
        error?: { code?: string; message: string }
        durationMs?: number
      }> = []
      const errorRetries: Array<{
        attempt: number
        error: { code?: string; message: string }
        recovered: boolean
      }> = []

      let chunkIndex = 0
      const onChunk = async (chunk: ModelResponseChunk): Promise<void> => {
        if (context.signal.aborted) return
        for (const content of chunk.delta ?? []) {
          if (content.type === 'reasoning') {
            chunkIndex += 1
            context.emit({
              type: 'thought_chunk',
              delta: (content as TextContent).text,
              index: chunkIndex,
              signature: content.thoughtSignature,
            })
          } else if (content.type === 'text') {
            chunkIndex += 1
            context.emit({ type: 'text_chunk', delta: (content as TextContent).text, index: chunkIndex })
          }
        }
        for (const call of chunk.toolCall ?? []) {
          let parsedArgs: Record<string, unknown> = {}
          try {
            parsedArgs = typeof call.function.arguments === 'string'
              ? JSON.parse(call.function.arguments)
              : (call.function.arguments || {})
          } catch {
            parsedArgs = {}
          }
          if (!executedToolCalls.some(c => c.id === call.id)) {
            executedToolCalls.push({
              id: call.id,
              name: call.function.name,
              arguments: parsedArgs,
              status: 'succeeded',
            })
          }
          context.emit({
            type: 'tool_status',
            toolCallId: call.id,
            toolName: call.function.name,
            status: 'requested',
            argsPreview: preview(call.function.arguments),
            startedAt: Date.now(),
          })
        }
      }

      const onToolCallResult = async (
        call: { id: string; name: string; args: unknown },
        result: { content: string; error?: boolean; durationMs?: number }
      ) => {
        const item = executedToolCalls.find(c => c.id === call.id)
        if (item) {
          item.status = result.error ? 'failed' : 'succeeded'
          item.resultPreview = result.content
          item.durationMs = result.durationMs
          if (result.error) {
            item.error = { message: result.content.slice(0, 240) }
            errorRetries.push({
              attempt: errorRetries.length + 1,
              error: { message: result.content.slice(0, 240) },
              recovered: true,
            })
          }
        }
        context.emit({
          type: 'tool_status',
          toolCallId: call.id,
          toolName: call.name,
          status: result.error ? 'failed' : 'succeeded',
          resultPreview: preview(result.content),
          completedAt: Date.now(),
        })
      }

      const metadata = context.session.metadata
      const conversationId = typeof metadata.conversationId === 'string' && metadata.conversationId
        ? metadata.conversationId
        : context.session.id
      const presetOptions = preset.sendMessageOption
      const activeTurn = context.session.activeTurn
      const turnThinkingLevel = activeTurn?.thinkingLevel || activeTurn?.reasoningEffort
      const enableReasoning = turnThinkingLevel ? turnThinkingLevel !== 'none' : true
      const reasoningEffort = turnThinkingLevel === 'max'
        ? 'high'
        : (turnThinkingLevel === 'none' ? undefined : (turnThinkingLevel || 'medium'))

      const sendOptions = {
        ...presetOptions,
        chatPreset: preset,
        conversationId,
        model: activeTurn?.model ?? context.session.model ?? presetOptions?.model,
        skillName,
        enableReasoning,
        isThinkingModel: enableReasoning,
        reasoningEffort,
        geminiThinkingLevel: reasoningEffort,
        openaiReasoningEffort: reasoningEffort,
        stream: true,
        onChunk,
        onToolCallResult,
      } as unknown as Parameters<Chaite['sendMessage']>[2]

      const response = await chaite.sendMessage(
        buildUserMessage(context.prompt, context.images),
        buildEvent(context, defaultUserId),
        sendOptions,
      )

      if (context.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const { parts, text } = partsOf(response)

      // Hermes & nekocode Closed Learning Loop 自动闭环反思
      if (options.evolutionService) {
        synthesizeAndRecordEvolution({
          sessionId: context.session.id,
          platform: context.session.platform,
          botId: context.session.botId,
          prompt: context.prompt,
          replyText: text,
          toolCalls: executedToolCalls,
          errorRetries,
          startedAt,
          completedAt: Date.now(),
        }, options.evolutionService).catch((err: unknown) => {
          // 异步静默，不阻塞正常对话
          console.warn('[chaite-driver] Evolution synthesis error:', err)
        })
      }

      return {
        finishReason: 'stop',
        parts: parts.length > 0 ? parts : [{ type: 'text', text }],
        text,
        usage: usageOf(response),
      }
    },
  }
}

/** Extract a compact preview for logs/tests. */
export function describeChunk(chunk: ModelResponseChunk): string {
  if (!isRecord(chunk)) return ''
  return preview(chunk.delta)
}
