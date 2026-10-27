import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Send, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRobot } from '@/robot/useRobot'
import type { ActionType, StepConfig } from '@/robot/types'


export function TaskDispatchTab() {
  const { t } = useTranslation()
  const { state, dispatchTask, confirmLlmPreview, clearLlmPreview } = useRobot()
  const [task, setTask] = useState('')

  const llmReady = !!state.llm.apiKey
  const preview = state.llmPreview

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-charcoal-900/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-chili-500" />
          <h3 className="font-bold text-charcoal-900">{t('robot.task.title')}</h3>
        </div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder={t('robot.task.input_placeholder')}
          rows={3}
          className="w-full resize-none rounded-xl border border-charcoal-900/10 bg-rice-50 p-3 text-sm text-charcoal-900 placeholder:text-charcoal-500/50 focus:border-chili-500/40 focus:outline-none focus:ring-2 focus:ring-chili-500/20"
        />
        <Button
          onClick={() => dispatchTask(task)}
          disabled={!llmReady || state.llmLoading || !task.trim() || state.isExecuting}
          className="mt-3 w-full"
        >
          {state.llmLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {state.llmLoading ? t('robot.task.dispatching') : t('robot.task.dispatch')}
        </Button>
        {!llmReady && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-chili-600">
            <AlertTriangle size={13} /> {t('robot.task.no_llm')}
          </p>
        )}
        {state.llmError && (
          <div className="mt-3 rounded-xl border border-chili-500/20 bg-chili-50 p-3 text-sm text-chili-600">
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {t('robot.task.llm_error')}</p>
            <p className="mt-1 break-words text-xs">{state.llmError}</p>
          </div>
        )}
      </div>

      {preview && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-100/50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 size={18} className="text-amber-500" />
            <h3 className="font-bold text-charcoal-900">{t('robot.task.preview_title')}</h3>
          </div>
          <p className="mb-3 text-sm text-charcoal-500">{t('robot.task.preview_desc')}</p>
          <div className="space-y-2">
            {preview.steps.map((step: StepConfig, idx: number) => (
              <div key={step.id} className="flex items-center gap-3 rounded-xl border border-charcoal-900/5 bg-white/80 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chili-50 text-sm font-bold text-chili-500">{idx + 1}</span>
                <span className="rounded-lg bg-rice-200 px-2 py-0.5 text-xs font-semibold text-charcoal-700">{t(`robot.action.${step.actionType as ActionType}`)}</span>
                <span className="flex-1 truncate text-sm text-charcoal-700">{step.params.target}</span>
                <span className="text-xs text-charcoal-500">{t('robot.param.speed')}: {step.params.speed}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <Button onClick={confirmLlmPreview} disabled={state.isExecuting}>
              {t('robot.task.confirm')}
            </Button>
            <Button variant="outline" onClick={clearLlmPreview}>
              {t('robot.task.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
