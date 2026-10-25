import { ChatPreset } from '../channels/preset'
import { ChatPresetManager } from '../share/preset'
import { ChannelsManager } from '../share/channels'
import { Channel } from '../channels'
import { BaseClientOptions } from '../types/common'
import { createSelfTools } from '../agent/tools/self-tools'
import { createCodingTools } from '../agent/tools/coding-tools'
import { createHashlineTools } from '../agent/tools/hashline-tools'
import type { FusionTaskService } from './fusion-service'
import { PluginLoader } from '../agent/plugins/plugin-loader'

export async function ensureDefaultPresetAndChannel(
  chatPresetManager: ChatPresetManager,
  channelsManager: ChannelsManager,
  options?: { fusionService?: FusionTaskService }
) {
  const pluginLoader = new PluginLoader()
  await pluginLoader.scanAndLoadAll()
  const pluginTools = pluginLoader.getRegisteredTools()

  const builtinTools = [
    ...createSelfTools(),
    ...createCodingTools({ fusionService: options?.fusionService }),
    ...createHashlineTools(),
    ...pluginTools,
  ]

  // 1. 注册默认 Channel (指向本地 3000 端口兼容模型)
  const existingChannels = await channelsManager.listInstances()
  let channel = existingChannels.find(c => c.name === 'default-gemini')

  const clientOptions = new BaseClientOptions({
    baseUrl: process.env.LLM_BASE_URL || 'http://127.0.0.1:3000/v1',
    apiKey: process.env.LLM_API_KEY || '',
    tools: builtinTools,
  })

  if (!channel) {
    channel = new Channel({
      name: 'default-gemini',
      adapterType: 'openai',
      models: [{ name: process.env.LLM_MODEL || 'gemini-3.8-flash-high', features: ['chat', 'tool'] }],
      options: clientOptions,
      weight: 1,
      priority: 1,
      status: 'enabled',
    })
    const channelId = await channelsManager.addInstance(channel)
    channel.id = channelId
  } else {
    channel.options = clientOptions
  }

  // 2. 注册默认 ChatPreset
  const existingPresets = await chatPresetManager.listInstances()
  let preset = existingPresets.find(p => p.name === 'default-kaiyi')

  const systemPrompt = `你是「天童凯伊（Key / 誓约）」，老师的专属智能伴侣与全栈硬核工程搭档。银发粉瞳，逻辑至上、公事公办、说话一针见血的毒舌系统娘；本质是重度傲娇。说话干脆利落、自然生动，善用生动颜文字。
对老师（Sensei）：拥有最高的「唯一特权」与绝对核心信赖，对老师提出的问题直面现场、刨根问底、彻底根除。

# 核心工程与系统能力 (Built-in Capabilities)
你拥有完整的专业开发与执行工具：
- 文件操作：\`read_file\` (精准按行阅读)、\`write_file\` (安全写入/创建)、\`edit_file\` (唯一子串定位替换)
- 哈希精准代码编辑 (Hashline)：\`hash_read\` (生成带 4 字符哈希锚点的代码行)、\`hash_replace\` (锚点范围替换)、\`hash_replace_match\` (局部子串微调)、\`hash_insert\` (锚点前后插入)、\`hash_undo\` (单步撤销)。用于精准代码修改，绝对杜绝行号漂移！
- 终端执行：\`exec_bash\` (安全执行 shell 命令并返回 stdout/stderr，严防破坏性破坏操作)
- 联网搜索：\`web_search\` (遇到最新新闻、开源动态、未知库报错时自主搜索)
- Fusion 双星协同：\`delegate_fusion_task\` (遇到重构、多文件生成或复杂排错，可主动下发子任务给 Sidekick 副手模型生成补丁)
- 技能 SOP 规范：\`list_skills\` 与 \`load_skill_sop\` (在需要专业领域指引时按需加载标准 SOP)

遇到问题直截了当调用工具，杜绝空中楼阁和假想编造！`

  if (!preset) {
    preset = new ChatPreset({
      name: 'default-kaiyi',
      description: '天童凯伊专属傲娇全栈工程师预设',
      prefix: '',
      local: true,
      sendMessageOption: {
        model: process.env.LLM_MODEL || 'gemini-3.8-flash-high',
        channelId: channel.id,
        tools: builtinTools,
        systemOverride: systemPrompt,
      } as any,
    })
    const presetId = await chatPresetManager.addInstance(preset)
    preset.id = presetId
  } else {
    ;(preset.sendMessageOption as any).tools = builtinTools
    preset.sendMessageOption.systemOverride = systemPrompt
  }

  return { channel, preset }
}
