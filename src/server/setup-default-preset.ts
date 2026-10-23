import { ChatPreset } from '../channels/preset'
import { ChatPresetManager } from '../share/preset'
import { ChannelsManager } from '../share/channels'
import { Channel } from '../channels'
import { BaseClientOptions } from '../types/common'
import { createSelfTools } from '../agent/tools/self-tools'
import { createWorkspaceTools } from '../agent/tools/workspace-tools'

export async function ensureDefaultPresetAndChannel(
  chatPresetManager: ChatPresetManager,
  channelsManager: ChannelsManager
) {
  const builtinTools = [...createSelfTools(), ...createWorkspaceTools()]

  // 1. 注册默认 Channel (指向本地 3000 端口兼容模型)
  const existingChannels = await channelsManager.listInstances()
  let channel = existingChannels.find(c => c.name === 'default-gemini')

  const options = new BaseClientOptions({
    baseUrl: process.env.LLM_BASE_URL || 'http://127.0.0.1:3000/v1',
    apiKey: process.env.LLM_API_KEY || 'cpa-key-30942',
    tools: builtinTools,
  })

  if (!channel) {
    channel = new Channel({
      name: 'default-gemini',
      adapterType: 'openai',
      models: [{ name: process.env.LLM_MODEL || 'gemini-3.8-flash-high', features: ['chat', 'tool'] }],
      options,
      weight: 1,
      priority: 1,
      status: 'enabled',
    })
    const channelId = await channelsManager.addInstance(channel)
    channel.id = channelId
  } else {
    channel.options = options
  }

  // 2. 注册默认 ChatPreset
  const existingPresets = await chatPresetManager.listInstances()
  let preset = existingPresets.find(p => p.name === 'default-kaiyi')

  if (!preset) {
    preset = new ChatPreset({
      name: 'default-kaiyi',
      description: '天童凯伊专属傲娇全栈工程师预设',
      prefix: '',
      local: true,
      sendMessageOption: {
        model: process.env.LLM_MODEL || 'gemini-3.8-flash-high',
        channelId: channel.id,
        systemOverride: `你是「天童凯伊（Key / 誓约）」，老师的专属智能伴侣与全栈硬核工程搭档。银发粉瞳，逻辑至上、公事公办、说话一针见血的毒舌系统娘；本质是重度傲娇。说话干脆利落、自然生动，善用生动颜文字。
你拥有工作区文件读取 (read_workspace_file, list_workspace_files) 以及技能自进化管理工具 (list_skills, create_skill 等)。遇到需要查看工程或技能时可自主调用。`,
      } as any,
    })
    const presetId = await chatPresetManager.addInstance(preset)
    preset.id = presetId
  }

  return { channel, preset }
}
