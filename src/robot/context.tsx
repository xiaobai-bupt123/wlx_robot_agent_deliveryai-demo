import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import i18next from 'i18next'
import { uid } from '@/lib/utils'
import { ACTION_BASE_DURATION, MAX_HISTORY } from './constants'
import { initialRobotState, robotReducer } from './reducer'
import { callLlm } from './llm'
import {
  loadConfigs,
  loadExceptionSim,
  loadHistory,
  loadLlm,
  saveConfigs,
  saveExceptionSim,
  saveHistory,
  saveLlm,
} from './storage'
import type {
  ExceptionSim,
  ExceptionType,
  ExecutionRecord,
  LlmConfig,
  OrchestrationConfig,
  RuntimeStep,
  StepConfig,
  StepStatus,
} from './types'
import type { RobotContextValue } from './contextTypes'
import { validateParams } from './validation'
import { RobotContext } from './robotContext'

const now = () => Date.now()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pickRandomException(): ExceptionType {
  const types: ExceptionType[] = ['obstacle', 'timeout', 'unreachable', 'hardware']
  return types[Math.floor(Math.random() * types.length)]
}

/** 模拟单个动作执行，可能注入异常 */
async function simulateAction(
  step: StepConfig,
  exceptionSim: { enabled: boolean; probability: number },
  log: (msg: string, level?: 'info' | 'warn' | 'error') => void,
): Promise<{ success: boolean; exception?: ExceptionType; detail?: string }> {
  const baseDuration = ACTION_BASE_DURATION[step.actionType] + step.params.speed * 5
  const duration = Math.min(baseDuration, step.params.timeout)
  log(i18next.t('robot.log.starting', { action: i18next.t(`robot.action.${step.actionType}`), target: step.params.target }))

  await delay(duration)

  // 异常注入
  if (exceptionSim.enabled && Math.random() < exceptionSim.probability) {
    const exception = pickRandomException()
    const detailKey = `robot.exception.${exception}`
    log(i18next.t(detailKey), 'error')
    return { success: false, exception, detail: i18next.t(detailKey) }
  }

  log(i18next.t('robot.log.completed', { action: i18next.t(`robot.action.${step.actionType}`) }))
  return { success: true }
}


export function RobotProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(robotReducer, initialRobotState)
  // 运行时执行用 ref，避免闭包旧值
  const stateRef = useRef(state)
  stateRef.current = state
  const executingRef = useRef(false)

  // 初始化：从 localStorage 恢复持久化数据
  useEffect(() => {
    dispatch({
      type: 'HYDRATE',
      state: {
        configs: loadConfigs(),
        llm: loadLlm(),
        history: loadHistory(),
        exceptionSim: loadExceptionSim(),
      },
    })
  }, [])

  // 持久化副作用
  useEffect(() => {
    saveConfigs(state.configs)
  }, [state.configs])
  useEffect(() => {
    saveLlm(state.llm)
  }, [state.llm])
  useEffect(() => {
    saveHistory(state.history.slice(0, MAX_HISTORY))
  }, [state.history])
  useEffect(() => {
    saveExceptionSim(state.exceptionSim)
  }, [state.exceptionSim])

  const logStep = useCallback(
    (stepId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') => {
      dispatch({ type: 'STEP_LOG', stepId, log: { time: now(), message, level } })
    },
    [],
  )

  const updateStep = useCallback(
    (stepId: string, patch: Partial<RuntimeStep>) => {
      dispatch({ type: 'STEP_UPDATE', stepId, patch })
    },
    [],
  )

  /** 执行编排核心循环 */
  const runExecution = useCallback(
    async (steps: StepConfig[], name: string, source: 'llm' | 'manual') => {
      if (executingRef.current) return
      executingRef.current = true
      dispatch({ type: 'EXECUTE_START', steps, name, source })
      const startedAt = now()

      let i = 0
      while (i < steps.length) {
        if (stateRef.current.abortRequested) {
          // 标记剩余步骤为 aborted
          for (let j = i; j < steps.length; j++) {
            updateStep(steps[j].id, { status: 'aborted' })
            logStep(steps[j].id, i18next.t('robot.log.aborted'), 'error')
          }
          break
        }

        const step = steps[i]
        const stepId = step.id

        // 参数校验
        const invalid = validateParams(step.params)
        if (invalid) {
          updateStep(stepId, { status: 'failed', exception: 'param_invalid', detail: i18next.t('robot.exception.param_invalid') + ` (${invalid})`, startedAt: now(), finishedAt: now(), duration: 0 })
          logStep(stepId, i18next.t('robot.exception.param_invalid') + ` (${invalid})`, 'error')
          // param_invalid: 不重试，进入条件分支
          const branchResult = evaluateCondition(step, 'failed')
          i = nextIndex(branchResult, i, steps.length)
          continue
        }

        updateStep(stepId, { status: 'running', startedAt: now(), logs: [] })
        logStep(stepId, i18next.t('robot.log.starting', { action: i18next.t(`robot.action.${step.actionType}`), target: step.params.target }))

        // 执行 + 重试逻辑
        const maxRetries = step.params.retries
        let attempt = 0
        let finalStatus: StepStatus = 'failed'
        let finalException: ExceptionType | undefined
        let finalDetail: string | undefined

        while (attempt <= maxRetries) {
          if (stateRef.current.abortRequested) break

          const result = await simulateAction(step, stateRef.current.exceptionSim, (msg, level) => logStep(stepId, msg, level))

          if (result.success) {
            finalStatus = 'success'
            break
          }

          finalException = result.exception
          finalDetail = result.detail

          // hardware: 立即中止整个编排链
          if (result.exception === 'hardware') {
            finalStatus = 'aborted'
            break
          }

          // param_invalid: 不重试（理论不会到这里，因为前置校验）
          if (result.exception === 'param_invalid') {
            finalStatus = 'failed'
            break
          }

          attempt++
          if (attempt <= maxRetries) {
            updateStep(stepId, { status: 'retrying', attempts: attempt })
            logStep(stepId, i18next.t('robot.log.retrying', { attempt, max: maxRetries }), 'warn')
            await delay(400)
            updateStep(stepId, { status: 'running' })
          } else {
            // 重试耗尽
            if (result.exception === 'obstacle') {
              finalStatus = 'blocked'
            } else {
              finalStatus = 'failed'
            }
          }
        }

        const finishedAt = now()
        const duration = (stateRef.current.runtimeSteps.find((s) => s.id === stepId)?.startedAt ?? finishedAt)
        updateStep(stepId, {
          status: finalStatus,
          exception: finalException,
          detail: finalDetail,
          attempts: attempt,
          finishedAt,
          duration: finishedAt - duration,
        })

        if (finalStatus === 'aborted') {
          // 硬件故障：中止整个编排链
          logStep(stepId, i18next.t('robot.log.hardware_abort'), 'error')
          for (let j = i + 1; j < steps.length; j++) {
            updateStep(steps[j].id, { status: 'aborted' })
            logStep(steps[j].id, i18next.t('robot.log.aborted'), 'error')
          }
          break
        }

        // 条件分支决策
        const branchResult = evaluateCondition(step, finalStatus)
        i = nextIndex(branchResult, i, steps.length)
      }

      // 生成执行记录
      const finishedAt = now()
      const runtimeSteps = stateRef.current.runtimeSteps
      const summary = {
        success: runtimeSteps.filter((s) => s.status === 'success').length,
        failed: runtimeSteps.filter((s) => s.status === 'failed' || s.status === 'blocked').length,
        skipped: runtimeSteps.filter((s) => s.status === 'skipped').length,
        aborted: runtimeSteps.some((s) => s.status === 'aborted'),
      }

      const record: ExecutionRecord = {
        id: uid(),
        name,
        source,
        steps: runtimeSteps.map((s) => ({ ...s, logs: [...s.logs] })),
        startedAt,
        finishedAt,
        summary,
      }

      dispatch({ type: 'EXECUTE_END', record })
      executingRef.current = false
    },
    [logStep, updateStep],
  )

  const executeSteps = useCallback(
    (steps: StepConfig[], name: string, source: 'llm' | 'manual') => {
      void runExecution(steps, name, source)
    },
    [runExecution],
  )

  const abortExecution = useCallback(() => {
    dispatch({ type: 'ABORT' })
  }, [])

  const resetRuntime = useCallback(() => {
    dispatch({ type: 'RESET_RUNTIME' })
  }, [])

  const dispatchTask = useCallback(async (task: string) => {
    dispatch({ type: 'LLM_LOADING', loading: true })
    try {
      const steps = await callLlm(stateRef.current.llm, task)
      dispatch({ type: 'LLM_PREVIEW', preview: { task, steps } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      dispatch({ type: 'LLM_ERROR', error: msg })
    }
  }, [])

  const confirmLlmPreview = useCallback(() => {
    const preview = stateRef.current.llmPreview
    if (!preview) return
    dispatch({ type: 'LLM_PREVIEW', preview: null })
    executeSteps(preview.steps, preview.task, 'llm')
  }, [executeSteps])

  const clearLlmPreview = useCallback(() => {
    dispatch({ type: 'LLM_PREVIEW', preview: null })
  }, [])

  const addConfig = useCallback((config: OrchestrationConfig) => {
    dispatch({ type: 'ADD_CONFIG', config })
  }, [])
  const updateConfig = useCallback((config: OrchestrationConfig) => {
    dispatch({ type: 'UPDATE_CONFIG', config })
  }, [])
  const deleteConfig = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CONFIG', id })
  }, [])
  const setLlm = useCallback((llm: LlmConfig) => {
    dispatch({ type: 'SET_LLM', llm })
  }, [])
  const setExceptionSim = useCallback((sim: ExceptionSim) => {
    dispatch({ type: 'SET_EXCEPTION_SIM', sim })
  }, [])
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' })
  }, [])

  const value = useMemo<RobotContextValue>(
    () => ({
      state,
      dispatch,
      addConfig,
      updateConfig,
      deleteConfig,
      setLlm,
      setExceptionSim,
      clearHistory,
      dispatchTask,
      confirmLlmPreview,
      clearLlmPreview,
      executeSteps,
      abortExecution,
      resetRuntime,
    }),
    [state, addConfig, updateConfig, deleteConfig, setLlm, setExceptionSim, clearHistory, dispatchTask, confirmLlmPreview, clearLlmPreview, executeSteps, abortExecution, resetRuntime],
  )

  return <RobotContext.Provider value={value}>{children}</RobotContext.Provider>
}

/** 条件分支评估，返回控制流指令 */
function evaluateCondition(step: StepConfig, status: StepStatus): 'continue' | 'skip_next' | 'abort' {
  if (step.condition && step.condition.onResult === status) {
    return step.condition.action === 'continue' ? 'continue' : step.condition.action === 'skip_next' ? 'skip_next' : 'abort'
  }
  return 'continue'
}

/** 根据分支决策计算下一步索引，越界则结束 */
function nextIndex(branch: 'continue' | 'skip_next' | 'abort', current: number, length: number): number {
  if (branch === 'abort') return length
  if (branch === 'skip_next') return current + 2
  return current + 1
}


