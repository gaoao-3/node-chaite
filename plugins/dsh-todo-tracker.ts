/**
 * DSH / Cordis 风格插件：任务状态跟踪机 (dsh-todo-tracker)
 */
const taskStore = new Map()

export function apply(ctx: any) {
  ctx.tools.register({
    name: 'manage_todo_task',
    description: '管理智能体执行任务的待办清单，支持 create (新建), update (更新状态), list (查阅) 操作。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['create', 'update', 'list'], description: '操作行为' },
        subject: { type: 'string', description: '任务标题' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: '任务状态' },
        taskId: { type: 'string', description: '目标任务编号' },
      },
      required: ['action'],
    },
    run: async (args: any) => {
      if (args.action === 'create') {
        const id = 'task_' + (taskStore.size + 1)
        taskStore.set(id, { id, subject: args.subject, status: args.status || 'pending', createdAt: Date.now() })
        return { success: true, created: taskStore.get(id) }
      }
      if (args.action === 'update' && args.taskId) {
        const item = taskStore.get(args.taskId)
        if (!item) return { error: 'Task not found: ' + args.taskId }
        if (args.status) item.status = args.status
        if (args.subject) item.subject = args.subject
        return { success: true, updated: item }
      }
      return { total: taskStore.size, tasks: Array.from(taskStore.values()) }
    },
  })
}
