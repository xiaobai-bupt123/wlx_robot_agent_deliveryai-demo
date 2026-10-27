import type { StepParams } from './types'

/** 校验单步参数合法性，返回非法字段名或 null */
export function validateParams(params: StepParams): string | null {
  if (typeof params.speed !== 'number' || params.speed <= 0) return 'speed'
  if (!params.target || !params.target.trim()) return 'target'
  if (typeof params.retries !== 'number' || params.retries < 0) return 'retries'
  if (typeof params.timeout !== 'number' || params.timeout <= 0) return 'timeout'
  if (!['high', 'normal', 'low'].includes(params.priority)) return 'priority'
  return null
}
