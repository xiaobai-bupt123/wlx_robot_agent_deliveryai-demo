import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRobot } from '@/robot/useRobot'
import type { LlmConfig } from '@/robot/types'

export function SettingsTab() {
  const { t } = useTranslation()
  const { state, setLlm, setExceptionSim } = useRobot()
  const [form, setForm] = useState<LlmConfig>(state.llm)
  const [simEnabled, setSimEnabled] = useState(state.exceptionSim.enabled)
  const [simProb, setSimProb] = useState(state.exceptionSim.probability)
  const [saved, setSaved] = useState(false)

  const handleSaveLlm = () => {
    setLlm(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveSim = () => {
    setExceptionSim({ enabled: simEnabled, probability: simProb })
  }

  return (
    <div className="space-y-5">
      {/* LLM 配置 */}
      <div className="rounded-2xl border border-charcoal-900/5 bg-white p-5 shadow-sm">
        <h3 className="mb-1 font-bold text-charcoal-900">{t('robot.settings.llm_title')}</h3>
        <p className="mb-4 text-sm text-charcoal-500">{t('robot.settings.llm_desc')}</p>

        <div className="space-y-3">
          <Field label={t('robot.settings.base_url')}>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com"
              className={inputCls}
            />
          </Field>
          <Field label={t('robot.settings.api_key')}>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder="sk-..."
              className={inputCls}
            />
          </Field>
          <Field label={t('robot.settings.model')}>
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o-mini"
              className={inputCls}
            />
          </Field>
        </div>

        <Button onClick={handleSaveLlm} className="mt-4">
          <Save size={15} /> {t('robot.settings.save')}
        </Button>
        {saved && <span className="ml-3 text-sm text-green-600">{t('robot.settings.saved')}</span>}

        {/* 安全风险提示 */}
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-100/60 p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs leading-5 text-charcoal-700">{t('robot.settings.security_warning')}</p>
        </div>
      </div>

      {/* 异常模拟设置 */}
      <div className="rounded-2xl border border-charcoal-900/5 bg-white p-5 shadow-sm">
        <h3 className="mb-1 font-bold text-charcoal-900">{t('robot.settings.simulation')}</h3>
        <p className="mb-4 text-sm text-charcoal-500">{t('robot.settings.simulation_desc')}</p>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={simEnabled}
            onChange={(e) => setSimEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-charcoal-900/20 text-chili-500 focus:ring-chili-500/30"
          />
          <span className="text-sm font-semibold text-charcoal-900">{t('robot.settings.exception_sim_enable')}</span>
        </label>

        <div className="mt-4">
          <Field label={`${t('robot.settings.exception_sim_prob')} (${Math.round(simProb * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={simProb}
              onChange={(e) => setSimProb(Number(e.target.value))}
              className="w-full accent-chili-500"
            />
          </Field>
        </div>

        <Button onClick={handleSaveSim} variant="secondary" className="mt-4">
          <Save size={15} /> {t('robot.settings.save')}
        </Button>
      </div>
    </div>
  )
}

const inputCls = 'h-10 w-full rounded-lg border border-charcoal-900/10 bg-rice-50 px-3 text-sm focus:border-chili-500/40 focus:outline-none focus:ring-2 focus:ring-chili-500/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-charcoal-500">{label}</label>
      {children}
    </div>
  )
}
