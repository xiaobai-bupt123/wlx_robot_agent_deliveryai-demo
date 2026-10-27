import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bot, History, ListChecks, Settings, Sparkles } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import { Button } from '@/components/ui/button'
import { TaskDispatchTab } from '@/components/robot/TaskDispatchTab'
import { OrchestrateTab } from '@/components/robot/OrchestrateTab'
import { HistoryTab } from '@/components/robot/HistoryTab'
import { SettingsTab } from '@/components/robot/SettingsTab'

interface RobotViewProps {
  onBack: () => void
}

const TABS = [
  { value: 'task', icon: Sparkles },
  { value: 'orchestrate', icon: ListChecks },
  { value: 'history', icon: History },
  { value: 'settings', icon: Settings },
] as const

export function RobotView({ onBack }: RobotViewProps) {
  const { t } = useTranslation()
  return (
    <main className="min-h-screen bg-rice-100 paper-noise">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 border-b border-charcoal-900/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label={t('robot.back_home')}>
            <ArrowLeft size={18} />
          </Button>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili-50 text-chili-500">
            <Bot size={20} />
          </span>
          <div>
            <h1 className="text-base font-bold text-charcoal-900">{t('robot.title')}</h1>
            <p className="text-xs text-charcoal-500">{t('robot.subtitle')}</p>
          </div>
        </div>
      </header>

      {/* Tab 内容 */}
      <div className="mx-auto max-w-4xl px-4 py-5 pb-20">
        <Tabs.Root defaultValue="task">
          {/* Tab 触发器 */}
          <Tabs.List className="mb-5 flex gap-1 rounded-2xl border border-charcoal-900/5 bg-white p-1.5 shadow-sm">
            {TABS.map(({ value, icon: Icon }) => (
              <Tabs.Trigger
                key={value}
                value={value}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-charcoal-500 transition data-[state=active]:bg-chili-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{t(`robot.tab.${value}`)}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="task">
            <TaskDispatchTab />
          </Tabs.Content>
          <Tabs.Content value="orchestrate">
            <OrchestrateTab />
          </Tabs.Content>
          <Tabs.Content value="history">
            <HistoryTab />
          </Tabs.Content>
          <Tabs.Content value="settings">
            <SettingsTab />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </main>
  )
}
