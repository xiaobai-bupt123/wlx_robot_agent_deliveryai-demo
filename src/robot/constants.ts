import type { ActionType, ExceptionType, LlmConfig, Priority, StepParams } from './types'

/** 默认 LLM 配置 */
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini',
}

/** 默认异常模拟设置 */
export const DEFAULT_EXCEPTION_SIM = {
  enabled: false,
  probability: 0.3,
}

/** localStorage key 前缀 */
export const STORAGE_KEYS = {
  configs: 'robot-configs',
  llm: 'robot-llm',
  history: 'robot-history',
  exceptionSim: 'robot-exception-sim',
} as const

/** 历史记录最大保存条数 */
export const MAX_HISTORY = 50

/** 各动作类型的默认参数模板 */
export const DEFAULT_PARAMS: Record<ActionType, StepParams> = {
  grab: { speed: 50, target: '', retries: 2, timeout: 3000, priority: 'normal' },
  move: { speed: 80, target: '', retries: 1, timeout: 5000, priority: 'normal' },
  jump: { speed: 90, target: '', retries: 1, timeout: 4000, priority: 'high' },
}

/** 异常类型列表（用于随机注入） */
export const RANDOM_EXCEPTIONS: ExceptionType[] = ['obstacle', 'timeout', 'unreachable', 'hardware']

/** 优先级选项 */
export const PRIORITY_OPTIONS: Priority[] = ['high', 'normal', 'low']

/** 动作模拟基础耗时（毫秒） */
export const ACTION_BASE_DURATION: Record<ActionType, number> = {
  grab: 800,
  move: 1200,
  jump: 600,
}

/** LLM system prompt：指导模型返回结构化动作方案 */
export const LLM_SYSTEM_PROMPT = `You are a robot motion planning assistant. Given a natural language task, decompose it into a sequence of robot motion actions.

Supported action types: "grab" (抓取), "move" (移动), "jump" (跳跃).

Each step has params:
- speed: number > 0 (speed/force, 1-100)
- target: non-empty string (target position or object)
- retries: integer >= 0
- timeout: integer > 0 (milliseconds)
- priority: "high" | "normal" | "low"

Each step may have an optional condition:
- onResult: "success" | "failed" | "skipped"
- action: "continue" | "skip_next" | "abort"

Return ONLY a JSON object with this exact shape:
{
  "steps": [
    {
      "actionType": "grab" | "move" | "jump",
      "params": { "speed": number, "target": "string", "retries": number, "timeout": number, "priority": "high" | "normal" | "low" },
      "condition": { "onResult": "success" | "failed" | "skipped", "action": "continue" | "skip_next" | "abort" }
    }
  ]
}

Do not include any text outside the JSON object. Respond in the user's language for target values.`
