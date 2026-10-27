import { createContext } from 'react'
import type { RobotContextValue } from './contextTypes'

export const RobotContext = createContext<RobotContextValue | null>(null)
