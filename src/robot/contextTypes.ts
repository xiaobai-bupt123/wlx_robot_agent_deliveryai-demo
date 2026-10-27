import type { RobotAction, RobotState, ExceptionSim, ExecutionRecord, LlmConfig, OrchestrationConfig, StepConfig } from './types'

export interface RobotContextValue {
  state: RobotState
  dispatch: React.Dispatch<RobotAction>
  addConfig: (config: OrchestrationConfig) => void
  updateConfig: (config: OrchestrationConfig) => void
  deleteConfig: (id: string) => void
  setLlm: (llm: LlmConfig) => void
  setExceptionSim: (sim: ExceptionSim) => void
  clearHistory: () => void
  dispatchTask: (task: string) => Promise<void>
  confirmLlmPreview: () => void
  clearLlmPreview: () => void
  executeSteps: (steps: StepConfig[], name: string, source: 'llm' | 'manual') => void
  abortExecution: () => void
  resetRuntime: () => void
}

export type { ExecutionRecord }
