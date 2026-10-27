// 机器人运动控制 Agent 模块类型定义

/** 运动动作类型：抓取 / 移动 / 跳跃 */
export type ActionType = 'grab' | 'move' | 'jump'

/** 动作步骤执行状态生命周期 */
export type StepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'retrying'
  | 'blocked'
  | 'aborted'

/** 异常类型 */
export type ExceptionType = 'obstacle' | 'timeout' | 'param_invalid' | 'unreachable' | 'hardware'

/** 优先级 */
export type Priority = 'high' | 'normal' | 'low'

/** 动作参数 */
export interface StepParams {
  /** 速度 / 力度，> 0 */
  speed: number
  /** 目标位置 / 对象，非空 */
  target: string
  /** 重试次数，>= 0 */
  retries: number
  /** 超时时间（毫秒），> 0 */
  timeout: number
  /** 优先级 */
  priority: Priority
}

/** 条件分支规则：当本步执行结果为 onResult 时，执行 action */
export interface ConditionRule {
  onResult: StepStatus
  action: 'continue' | 'skip_next' | 'abort'
}

/** 编排步骤配置（持久化形态，无运行时状态） */
export interface StepConfig {
  id: string
  actionType: ActionType
  params: StepParams
  condition?: ConditionRule
}

/** 编排配置（可保存多套，持久化） */
export interface OrchestrationConfig {
  id: string
  name: string
  steps: StepConfig[]
  createdAt: number
}

/** LLM 配置（持久化） */
export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/** 异常模拟设置 */
export interface ExceptionSim {
  enabled: boolean
  /** 注入概率 0-1 */
  probability: number
}

/** 执行日志条目 */
export interface LogEntry {
  time: number
  message: string
  level: 'info' | 'warn' | 'error'
}

/** 运行时步骤：StepConfig + 执行状态 */
export interface RuntimeStep extends StepConfig {
  status: StepStatus
  attempts: number
  exception?: ExceptionType
  detail?: string
  startedAt?: number
  finishedAt?: number
  duration?: number
  logs: LogEntry[]
}

/** 执行历史记录 */
export interface ExecutionRecord {
  id: string
  name: string
  source: 'llm' | 'manual'
  steps: RuntimeStep[]
  startedAt: number
  finishedAt: number
  summary: { success: number; failed: number; skipped: number; aborted: boolean }
}

/** Robot 模块状态 */
export interface RobotState {
  // 持久化
  configs: OrchestrationConfig[]
  llm: LlmConfig
  history: ExecutionRecord[]
  exceptionSim: ExceptionSim
  // 运行时（不持久化）
  runtimeSteps: RuntimeStep[]
  isExecuting: boolean
  abortRequested: boolean
  llmLoading: boolean
  llmError: string | null
  llmPreview: { task: string; steps: StepConfig[] } | null
}

/** Robot reducer action */
export type RobotAction =
  | { type: 'ADD_CONFIG'; config: OrchestrationConfig }
  | { type: 'UPDATE_CONFIG'; config: OrchestrationConfig }
  | { type: 'DELETE_CONFIG'; id: string }
  | { type: 'SET_LLM'; llm: LlmConfig }
  | { type: 'SET_EXCEPTION_SIM'; sim: ExceptionSim }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LLM_LOADING'; loading: boolean }
  | { type: 'LLM_ERROR'; error: string | null }
  | { type: 'LLM_PREVIEW'; preview: { task: string; steps: StepConfig[] } | null }
  | { type: 'EXECUTE_START'; steps: StepConfig[]; name: string; source: 'llm' | 'manual' }
  | { type: 'EXECUTE_END'; record: ExecutionRecord }
  | { type: 'STEP_UPDATE'; stepId: string; patch: Partial<RuntimeStep> }
  | { type: 'STEP_LOG'; stepId: string; log: LogEntry }
  | { type: 'ABORT' }
  | { type: 'RESET_RUNTIME' }
  | { type: 'HYDRATE'; state: Pick<RobotState, 'configs' | 'llm' | 'history' | 'exceptionSim'> }
