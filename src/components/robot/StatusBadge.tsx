import { useTranslation } from 'react-i18next'
import type { StepStatus } from '@/robot/types'
import { STATUS_STYLES } from './helpers'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }: { status: StepStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[status])}>
      {t(`robot.status.${status}`)}
    </span>
  )
}
