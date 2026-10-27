import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Loader2, Play, Plus, Save, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRobot } from '@/robot/useRobot'
import { validateParams } from '@/robot/validation'
import { DEFAULT_PARAMS } from '@/robot/constants'
import { uid } from '@/lib/utils'
import type { ActionType, ConditionRule, Priority, StepConfig, StepParams } from '@/robot/types'
import { ACTION_TYPES, PRIORITIES, STATUS_STYLES } from './helpers'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'

function newStep(actionType: ActionType): StepConfig {
  return {
    id: uid(),
    actionType,
    params: { ...DEFAULT_PARAMS[actionType], target: actionType === 'grab' ? '目标物体' : actionType === 'move' ? '目标位置' : '障碍物前方' },
  }
}

export function OrchestrateTab() {
  const { t } = useTranslation()
  const { state, executeSteps, abortExecution, addConfig, deleteConfig } = useRobot()
  const [steps, setSteps] = useState<StepConfig[]>([])
  const [configName, setConfigName] = useState('')
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [showConfigs, setShowConfigs] = useState(false)

  const updateParams = (id: string, patch: Partial<StepParams>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, params: { ...s.params, ...patch } } : s)))
  }

  const updateCondition = (id: string, patch: Partial<ConditionRule>) => {
    setSteps((prev) => prev.map((s) => {
      if (s.id !== id) return s
      const condition = { onResult: patch.onResult ?? s.condition?.onResult ?? 'failed', action: patch.action ?? s.condition?.action ?? 'continue' }
      return { ...s, condition }
    }))
  }

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleExecute = () => {
    if (!steps.length || state.isExecuting) return
    executeSteps(steps, t('robot.orchestrate.runtime_name'), 'manual')
  }

  const handleSaveConfig = () => {
    if (!steps.length) return
    const name = configName.trim() || `${t('robot.orchestrate.config_default')} ${state.configs.length + 1}`
    const config = { id: uid(), name, steps: steps.map((s) => ({ ...s, params: { ...s.params } })), createdAt: Date.now() }
    addConfig(config)
    setConfigName('')
  }

  const handleLoadConfig = (config: typeof state.configs[number]) => {
    setSteps(config.steps.map((s) => ({ ...s, id: uid(), params: { ...s.params } })))
    setShowConfigs(false)
  }

  return (
    <div className="space-y-4">
      {/* 执行控制栏 */}
      <div className="flex items-center gap-3 rounded-2xl border border-charcoal-900/5 bg-white p-4 shadow-sm">
        <Button onClick={handleExecute} disabled={!steps.length || state.isExecuting}>
          {state.isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {t('robot.orchestrate.execute')}
        </Button>
        {state.isExecuting && (
          <Button variant="outline" onClick={abortExecution}>
            <Square size={15} /> {t('robot.abort')}
          </Button>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder={t('robot.orchestrate.config_name')}
            className="h-9 w-32 rounded-lg border border-charcoal-900/10 bg-rice-50 px-3 text-sm focus:border-chili-500/40 focus:outline-none focus:ring-2 focus:ring-chili-500/20"
          />
          <Button variant="secondary" onClick={handleSaveConfig} disabled={!steps.length}>
            <Save size={15} /> {t('robot.orchestrate.save_config')}
          </Button>
        </div>
      </div>

      {/* 已保存配置 */}
      <div className="rounded-2xl border border-charcoal-900/5 bg-white p-4">
        <button onClick={() => setShowConfigs((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold text-charcoal-900">
          <span>{t('robot.orchestrate.saved_configs')} ({state.configs.length})</span>
          {showConfigs ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {showConfigs && (
          <div className="mt-3 space-y-2">
            {state.configs.length === 0 ? (
              <p className="text-sm text-charcoal-500">{t('robot.orchestrate.no_configs')}</p>
            ) : (
              state.configs.map((config) => (
                <div key={config.id} className="flex items-center gap-2 rounded-xl border border-charcoal-900/5 bg-rice-50 p-3">
                  <span className="flex-1 truncate text-sm font-semibold text-charcoal-900">{config.name}</span>
                  <span className="text-xs text-charcoal-500">{config.steps.length} {t('robot.orchestrate.step_unit')}</span>
                  <Button size="sm" variant="outline" onClick={() => handleLoadConfig(config)}>{t('robot.orchestrate.load_config')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteConfig(config.id)} aria-label={t('robot.orchestrate.delete_config')}><Trash2 size={14} className="text-chili-500" /></Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 步骤列表 */}
      <div className="space-y-3">
        {steps.length === 0 && !state.isExecuting && (
          <div className="rounded-2xl border border-dashed border-charcoal-900/10 bg-white/60 py-12 text-center">
            <p className="text-sm text-charcoal-500">{t('robot.orchestrate.empty')}</p>
          </div>
        )}

        {/* 添加步骤按钮 */}
        {!state.isExecuting && (
          <div className="flex gap-2">
            {ACTION_TYPES.map((actionType) => (
              <Button key={actionType} variant="outline" onClick={() => setSteps((prev) => [...prev, newStep(actionType)])}>
                <Plus size={15} /> {t('robot.orchestrate.add_step')} · {t(`robot.action.${actionType}`)}
              </Button>
            ))}
          </div>
        )}

        {/* 步骤编辑卡片 */}
        {steps.map((step, idx) => {
          const rtStep = state.runtimeSteps[idx]
          const isExpanded = expandedStep === step.id
          const paramError = validateParams(step.params)
          return (
            <div key={step.id} className={cn('rounded-2xl border bg-white p-4 shadow-sm transition', rtStep ? `border-l-4 ${STATUS_STYLES[rtStep.status].split(' ')[0]}` : 'border-charcoal-900/5')}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chili-50 text-sm font-bold text-chili-500">{idx + 1}</span>
                <span className="rounded-lg bg-rice-200 px-2.5 py-1 text-xs font-bold text-charcoal-700">{t(`robot.action.${step.actionType}`)}</span>
                <span className="flex-1 truncate text-sm text-charcoal-700">{step.params.target || <span className="text-chili-500">{t('robot.orchestrate.target_empty')}</span>}</span>
                {rtStep && <StatusBadge status={rtStep.status} />}
                {paramError && !rtStep && <span className="text-xs text-chili-500">{t('robot.orchestrate.param_error')}: {paramError}</span>}
                {state.isExecuting ? (
                  <button onClick={() => setExpandedStep(isExpanded ? null : step.id)} className="text-charcoal-500">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="rounded p-1 text-charcoal-500 disabled:opacity-30"><ArrowUp size={15} /></button>
                    <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="rounded p-1 text-charcoal-500 disabled:opacity-30"><ArrowDown size={15} /></button>
                    <button onClick={() => setExpandedStep(isExpanded ? null : step.id)} className="rounded p-1 text-charcoal-500">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
                    <button onClick={() => removeStep(step.id)} className="rounded p-1 text-chili-500"><Trash2 size={15} /></button>
                  </div>
                )}
              </div>

              {isExpanded && !state.isExecuting && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-charcoal-900/5 pt-4 sm:grid-cols-3">
                  <Field label={t('robot.param.speed')}>
                    <input type="number" min={1} value={step.params.speed} onChange={(e) => updateParams(step.id, { speed: Number(e.target.value) })} className={inputCls} />
                  </Field>
                  <Field label={t('robot.param.target')}>
                    <input value={step.params.target} onChange={(e) => updateParams(step.id, { target: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label={t('robot.param.retries')}>
                    <input type="number" min={0} value={step.params.retries} onChange={(e) => updateParams(step.id, { retries: Number(e.target.value) })} className={inputCls} />
                  </Field>
                  <Field label={t('robot.param.timeout')}>
                    <input type="number" min={100} value={step.params.timeout} onChange={(e) => updateParams(step.id, { timeout: Number(e.target.value) })} className={inputCls} />
                  </Field>
                  <Field label={t('robot.param.priority')}>
                    <select value={step.params.priority} onChange={(e) => updateParams(step.id, { priority: e.target.value as Priority })} className={inputCls}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{t(`robot.priority.${p}`)}</option>)}
                    </select>
                  </Field>
                  <Field label={t('robot.orchestrate.condition_title')}>
                    <div className="flex items-center gap-2">
                      <select value={step.condition?.onResult ?? ''} onChange={(e) => updateCondition(step.id, { onResult: e.target.value as ConditionRule['onResult'] })} className={inputCls}>
                        <option value="">{t('robot.orchestrate.no_condition')}</option>
                        <option value="success">{t('robot.status.success')}</option>
                        <option value="failed">{t('robot.status.failed')}</option>
                        <option value="skipped">{t('robot.status.skipped')}</option>
                      </select>
                      {step.condition && (
                        <select value={step.condition.action} onChange={(e) => updateCondition(step.id, { action: e.target.value as ConditionRule['action'] })} className={inputCls}>
                          <option value="continue">{t('robot.orchestrate.action_continue')}</option>
                          <option value="skip_next">{t('robot.orchestrate.action_skip')}</option>
                          <option value="abort">{t('robot.orchestrate.action_abort')}</option>
                        </select>
                      )}
                    </div>
                  </Field>
                </div>
              )}

              {/* 执行中的日志 */}
              {rtStep && (rtStep.logs.length > 0 || rtStep.detail) && (
                <div className="mt-3 rounded-xl bg-rice-50 p-3 text-xs">
                  {rtStep.detail && <p className="mb-1 font-semibold text-chili-600">{rtStep.detail}</p>}
                  {rtStep.logs.map((log, i) => (
                    <p key={i} className={cn('font-mono leading-5', log.level === 'error' ? 'text-chili-600' : log.level === 'warn' ? 'text-amber-500' : 'text-charcoal-500')}>
                      [{new Date(log.time).toLocaleTimeString()}] {log.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 执行总结 */}
      {!state.isExecuting && state.runtimeSteps.length > 0 && (
        <ExecutionSummary />
      )}
    </div>
  )
}

const inputCls = 'h-9 w-full rounded-lg border border-charcoal-900/10 bg-rice-50 px-3 text-sm focus:border-chili-500/40 focus:outline-none focus:ring-2 focus:ring-chili-500/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-charcoal-500">{label}</label>
      {children}
    </div>
  )
}

function ExecutionSummary() {
  const { t } = useTranslation()
  const { state } = useRobot()
  const steps = state.runtimeSteps
  const success = steps.filter((s) => s.status === 'success').length
  const failed = steps.filter((s) => s.status === 'failed' || s.status === 'blocked').length
  const skipped = steps.filter((s) => s.status === 'skipped').length
  const aborted = steps.filter((s) => s.status === 'aborted').length
  return (
    <div className="rounded-2xl border border-charcoal-900/5 bg-white p-4 shadow-sm">
      <h4 className="mb-3 font-bold text-charcoal-900">{t('robot.execution_summary')}</h4>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-green-100 px-3 py-1 font-semibold text-green-600">{t('robot.status.success')}: {success}</span>
        <span className="rounded-lg bg-chili-100 px-3 py-1 font-semibold text-chili-600">{t('robot.status.failed')}: {failed}</span>
        <span className="rounded-lg bg-rice-200 px-3 py-1 font-semibold text-charcoal-500">{t('robot.status.skipped')}: {skipped}</span>
        {aborted > 0 && <span className="rounded-lg bg-charcoal-500/10 px-3 py-1 font-semibold text-charcoal-700">{t('robot.status.aborted')}: {aborted}</span>}
      </div>
    </div>
  )
}
