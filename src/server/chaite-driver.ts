import type { Chaite } from '../core/chaite'
import type { EventMessage } from '../types/external'
import type { ImageContent, ModelResponse, ModelResponseChunk, TextContent, UserMessage } from '../types/models'
import type { OutboundReplyPart } from '../agent/gateway-contracts'
import { ServiceUnavailableError } from './errors'
import type { PromptDriverContext, PromptDriverResult, SessionPromptDriver } from './types'

export interface ChaitePromptDriverOptions {
  /** Use an already-initialised Chaite instance. */
  chaite?: Chaite
  /** Lazy resolver used by the default router (avoids an import cycle). */
  resolveChaite?: () => Promise<Chaite | undefined>
  /** Fallback user id when the session has no platform sender. */
  defaultUserId?: string
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

function buildUserMessage(prompt: string): UserMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text: prompt }],
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

      const metadata = context.session.metadata
      const conversationId = typeof metadata.conversationId === 'string' && metadata.conversationId
        ? metadata.conversationId
        : context.session.id
      const presetOptions = preset.sendMessageOption
      const sendOptions = {
        ...presetOptions,
        chatPreset: preset,
        conversationId,
        model: context.session.activeTurn?.model ?? context.session.model ?? presetOptions?.model,
        skillName,
        stream: true,
        onChunk,
      } as unknown as Parameters<Chaite['sendMessage']>[2]

      const response = await chaite.sendMessage(
        buildUserMessage(context.prompt),
        buildEvent(context, defaultUserId),
        sendOptions,
      )

      if (context.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const { parts, text } = partsOf(response)
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
