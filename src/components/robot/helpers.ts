import type { ActionType, Priority, StepStatus } from '@/robot/types'

export const ACTION_TYPES: ActionType[] = ['grab', 'move', 'jump']
export const PRIORITIES: Priority[] = ['high', 'normal', 'low']

export const STATUS_STYLES: Record<StepStatus, string> = {
  pending: 'bg-rice-200 text-charcoal-500',
  running: 'bg-amber-100 text-amber-500',
  success: 'bg-green-100 text-green-600',
  failed: 'bg-chili-100 text-chili-600',
  skipped: 'bg-rice-200 text-charcoal-500',
  retrying: 'bg-amber-100 text-amber-500',
  blocked: 'bg-chili-100 text-chili-600',
  aborted: 'bg-charcoal-500/10 text-charcoal-700',
}
