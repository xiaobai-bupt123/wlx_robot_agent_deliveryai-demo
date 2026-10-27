import { useContext } from 'react'
import { RobotContext } from './robotContext'
import type { RobotContextValue } from './contextTypes'

/** 获取 Robot 模块上下文 */
export function useRobot(): RobotContextValue {
  const ctx = useContext(RobotContext)
  if (!ctx) throw new Error('useRobot must be used within RobotProvider')
  return ctx
}
