import { LLM_SYSTEM_PROMPT } from './constants'
import type { ActionType, ConditionRule, Priority, StepConfig, StepParams } from './types'
import { uid } from '@/lib/utils'

/** LLM 返回的结构化动作方案 */
interface LlmResponse {
  steps: Array<{
    actionType: string
    params?: Partial<StepParams>
    condition?: { onResult: string; action: string }
  }>
}

const VALID_ACTIONS: ActionType[] = ['grab', 'move', 'jump']
const VALID_PRIORITIES: Priority[] = ['high', 'normal', 'low']
const VALID_RESULTS = ['success', 'failed', 'skipped']
const VALID_CONDITION_ACTIONS = ['continue', 'skip_next', 'abort']

function isActionType(v: unknown): v is ActionType {
  return typeof v === 'string' && VALID_ACTIONS.includes(v as ActionType)
}

/** 校验并规范化 LLM 返回的单步方案，非法时返回 null */
function normalizeStep(raw: LlmResponse['steps'][number]): StepConfig | null {
  if (!raw || !isActionType(raw.actionType)) return null
  const p = raw.params ?? {}
  const params: StepParams = {
    speed: typeof p.speed === 'number' && p.speed > 0 ? p.speed : 50,
    target: typeof p.target === 'string' && p.target.trim() ? p.target.trim() : '',
    retries: typeof p.retries === 'number' && p.retries >= 0 ? Math.floor(p.retries) : 1,
    timeout: typeof p.timeout === 'number' && p.timeout > 0 ? Math.floor(p.timeout) : 5000,
    priority: typeof p.priority === 'string' && VALID_PRIORITIES.includes(p.priority as Priority)
      ? (p.priority as Priority)
      : 'normal',
  }
  if (!params.target) return null

  let condition: ConditionRule | undefined
  if (raw.condition && typeof raw.condition === 'object') {
    const { onResult, action } = raw.condition
    if (
      typeof onResult === 'string' && VALID_RESULTS.includes(onResult) &&
      typeof action === 'string' && VALID_CONDITION_ACTIONS.includes(action)
    ) {
      condition = { onResult: onResult as ConditionRule['onResult'], action: action as ConditionRule['action'] }
    }
  }

  return { id: uid(), actionType: raw.actionType, params, condition }
}

/** 校验 LLM 返回的完整方案，返回合法步骤或抛出校验错误 */
export function validateLlmResponse(data: unknown): StepConfig[] {
  if (!data || typeof data !== 'object') throw new Error('Invalid response: not an object')
  const resp = data as LlmResponse
  if (!Array.isArray(resp.steps) || resp.steps.length === 0) {
    throw new Error('Invalid response: missing or empty steps array')
  }
  const steps: StepConfig[] = []
  for (let i = 0; i < resp.steps.length; i++) {
    const step = normalizeStep(resp.steps[i])
    if (!step) throw new Error(`Invalid step at index ${i}: missing actionType or target`)
    steps.push(step)
  }
  return steps
}

/** 调用 OpenAI 兼容的 Chat Completions API，返回解析后的动作步骤 */
export async function callLlm(
  config: { baseUrl: string; apiKey: string; model: string },
  task: string,
): Promise<StepConfig[]> {
  if (!config.apiKey) throw new Error('LLM API Key is not configured')
  const url = `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: LLM_SYSTEM_PROMPT },
          { role: 'user', content: task },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LLM API error ${res.status}: ${text.slice(0, 200)}`)
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('LLM response missing message content')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      // 尝试从 markdown code block 中提取 JSON
      const match = content.match(/\{[\s\S]*\}/)
      if (match) {
        parsed = JSON.parse(match[0])
      } else {
        throw new Error('Failed to parse LLM response as JSON')
      }
    }

    return validateLlmResponse(parsed)
  } finally {
    clearTimeout(timeoutId)
  }
}
