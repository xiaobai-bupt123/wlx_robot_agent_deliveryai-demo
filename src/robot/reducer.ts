import { DEFAULT_EXCEPTION_SIM, DEFAULT_LLM_CONFIG } from './constants'
import type { RobotAction, RobotState } from './types'

export const initialRobotState: RobotState = {
  configs: [],
  llm: DEFAULT_LLM_CONFIG,
  history: [],
  exceptionSim: DEFAULT_EXCEPTION_SIM,
  runtimeSteps: [],
  isExecuting: false,
  abortRequested: false,
  llmLoading: false,
  llmError: null,
  llmPreview: null,
}

export function robotReducer(state: RobotState, action: RobotAction): RobotState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.state }
    case 'ADD_CONFIG':
      return { ...state, configs: [...state.configs, action.config] }
    case 'UPDATE_CONFIG':
      return {
        ...state,
        configs: state.configs.map((c) => (c.id === action.config.id ? action.config : c)),
      }
    case 'DELETE_CONFIG':
      return { ...state, configs: state.configs.filter((c) => c.id !== action.id) }
    case 'SET_LLM':
      return { ...state, llm: action.llm }
    case 'SET_EXCEPTION_SIM':
      return { ...state, exceptionSim: action.sim }
    case 'CLEAR_HISTORY':
      return { ...state, history: [] }
    case 'LLM_LOADING':
      return { ...state, llmLoading: action.loading, llmError: action.loading ? null : state.llmError }
    case 'LLM_ERROR':
      return { ...state, llmError: action.error, llmLoading: false }
    case 'LLM_PREVIEW':
      return { ...state, llmPreview: action.preview, llmLoading: false, llmError: null }
    case 'EXECUTE_START':
      return {
        ...state,
        isExecuting: true,
        abortRequested: false,
        runtimeSteps: action.steps.map((s) => ({ ...s, status: 'pending' as const, attempts: 0, logs: [] })),
      }
    case 'EXECUTE_END':
      return {
        ...state,
        isExecuting: false,
        abortRequested: false,
        history: [action.record, ...state.history].slice(0, 50),
      }
    case 'STEP_UPDATE':
      return {
        ...state,
        runtimeSteps: state.runtimeSteps.map((s) =>
          s.id === action.stepId ? { ...s, ...action.patch } : s,
        ),
      }
    case 'STEP_LOG':
      return {
        ...state,
        runtimeSteps: state.runtimeSteps.map((s) =>
          s.id === action.stepId ? { ...s, logs: [...s.logs, action.log] } : s,
        ),
      }
    case 'ABORT':
      return { ...state, abortRequested: true }
    case 'RESET_RUNTIME':
      return { ...state, runtimeSteps: [], isExecuting: false, abortRequested: false, llmPreview: null }
    default:
      return state
  }
}
