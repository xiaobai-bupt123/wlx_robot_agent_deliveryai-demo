import { DEFAULT_EXCEPTION_SIM, DEFAULT_LLM_CONFIG, MAX_HISTORY, STORAGE_KEYS } from './constants'
import type { ExecutionRecord, ExceptionSim, LlmConfig, OrchestrationConfig } from './types'

/** 安全读取 localStorage JSON，失败时降级 */
function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** 安全写入 localStorage，失败时静默降级 */
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage 不可用或满时静默降级为内存态
  }
}

export function loadConfigs(): OrchestrationConfig[] {
  return readJson<OrchestrationConfig[]>(STORAGE_KEYS.configs, [])
}

export function saveConfigs(configs: OrchestrationConfig[]): void {
  writeJson(STORAGE_KEYS.configs, configs)
}

export function loadLlm(): LlmConfig {
  return readJson<LlmConfig>(STORAGE_KEYS.llm, DEFAULT_LLM_CONFIG)
}

export function saveLlm(llm: LlmConfig): void {
  writeJson(STORAGE_KEYS.llm, llm)
}

export function loadHistory(): ExecutionRecord[] {
  return readJson<ExecutionRecord[]>(STORAGE_KEYS.history, []).slice(0, MAX_HISTORY)
}

export function saveHistory(history: ExecutionRecord[]): void {
  writeJson(STORAGE_KEYS.history, history.slice(0, MAX_HISTORY))
}

export function loadExceptionSim(): ExceptionSim {
  return readJson<ExceptionSim>(STORAGE_KEYS.exceptionSim, DEFAULT_EXCEPTION_SIM)
}

export function saveExceptionSim(sim: ExceptionSim): void {
  writeJson(STORAGE_KEYS.exceptionSim, sim)
}
