import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRobot } from '@/robot/useRobot'
import { StatusBadge } from './StatusBadge'
import { cn } from '@/lib/utils'
import type { ExecutionRecord } from '@/robot/types'

export function HistoryTab() {
  const { t } = useTranslation()
  const { state, clearHistory } = useRobot()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (state.history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-900/10 bg-white/60 py-12 text-center">
        <p className="text-sm text-charcoal-500">{t('robot.history.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-charcoal-900">{t('robot.history.title')} ({state.history.length})</h3>
        <Button size="sm" variant="ghost" onClick={clearHistory}>
          <Trash2 size={14} className="text-chili-500" /> {t('robot.history.clear')}
        </Button>
      </div>

      {state.history.map((record: ExecutionRecord) => {
        const isOpen = expanded === record.id
        return (
          <div key={record.id} className="rounded-2xl border border-charcoal-900/5 bg-white p-4 shadow-sm">
            <button onClick={() => setExpanded(isOpen ? null : record.id)} className="flex w-full items-center gap-3">
              <Clock size={16} className="text-charcoal-500" />
              <span className="flex-1 truncate text-left text-sm font-semibold text-charcoal-900">{record.name}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', record.source === 'llm' ? 'bg-amber-100 text-amber-500' : 'bg-rice-200 text-charcoal-500')}>
                {t(record.source === 'llm' ? 'robot.history.source_llm' : 'robot.history.source_manual')}
              </span>
              <span className="text-xs text-charcoal-500">{new Date(record.startedAt).toLocaleString()}</span>
              {isOpen ? <ChevronDown size={16} className="text-charcoal-500" /> : <ChevronRight size={16} className="text-charcoal-500" />}
            </button>

            {isOpen && (
              <div className="mt-4 space-y-2 border-t border-charcoal-900/5 pt-4">
                {/* 汇总 */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-green-100 px-2 py-0.5 font-semibold text-green-600">{t('robot.status.success')}: {record.summary.success}</span>
                  <span className="rounded-lg bg-chili-100 px-2 py-0.5 font-semibold text-chili-600">{t('robot.status.failed')}: {record.summary.failed}</span>
                  <span className="rounded-lg bg-rice-200 px-2 py-0.5 font-semibold text-charcoal-500">{t('robot.status.skipped')}: {record.summary.skipped}</span>
                  {record.summary.aborted && <span className="rounded-lg bg-charcoal-500/10 px-2 py-0.5 font-semibold text-charcoal-700">{t('robot.status.aborted')}</span>}
                </div>
                {/* 步骤明细 */}
                {record.steps.map((step, idx) => (
                  <div key={step.id} className="rounded-xl border border-charcoal-900/5 bg-rice-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-charcoal-500">{idx + 1}</span>
                      <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-charcoal-700">{t(`robot.action.${step.actionType}`)}</span>
                      <span className="flex-1 truncate text-sm text-charcoal-700">{step.params.target}</span>
                      <StatusBadge status={step.status} />
                    </div>
                    {(step.detail || step.logs.length > 0) && (
                      <div className="mt-2 ml-8 text-xs">
                        {step.detail && <p className="mb-1 font-semibold text-chili-600">{step.detail}</p>}
                        {step.logs.map((log, i) => (
                          <p key={i} className={cn('font-mono leading-5', log.level === 'error' ? 'text-chili-600' : log.level === 'warn' ? 'text-amber-500' : 'text-charcoal-500')}>
                            [{new Date(log.time).toLocaleTimeString()}] {log.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
