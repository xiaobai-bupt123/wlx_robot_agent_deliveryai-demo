import { test, expect, type Page } from '@playwright/test'

/**
 * 机器人运动控制 Agent 模块 E2E 验收测试
 *
 * 覆盖 Spec 验收标准：导航路由、手动编排执行、五类异常处理、LLM 任务下发、
 * localStorage 持久化、i18n 国际化、边界约束（火锅点单不受影响）。
 *
 * 异常测试通过 page.addInitScript 预置 localStorage exceptionSim + Math.random 覆写，
 * 实现确定性异常注入（simulateAction 中 Math.random < probability 触发注入，
 * pickRandomException 按 Math.floor(random*4) 选择类型）。
 */

// ─── 辅助函数 ──────────────────────────────────────────────

/** 深链接直达 #/robot */
async function goToRobot(page: Page) {
  await page.goto('/#/robot')
  await expect(page).toHaveURL(/#\/robot$/)
}

/** 从首页入口按钮进入机器人视图 */
async function goToRobotFromHome(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '机器人运动控制' }).click()
  await expect(page).toHaveURL(/#\/robot$/)
}

/** 切换到指定标签页 */
async function switchTab(page: Page, tabName: string) {
  await page.getByRole('tab', { name: new RegExp(tabName) }).click()
}

/** 展开已保存方案并加载第一个配置 */
async function loadFirstConfig(page: Page) {
  await page.getByRole('button', { name: /已保存方案/ }).click()
  await page.getByRole('button', { name: '加载' }).click()
}

/** 等待编排执行完成（执行总结出现） */
async function waitForExecutionDone(page: Page) {
  await expect(page.getByText('执行总结')).toBeVisible({ timeout: 20000 })
}

/** 预置 localStorage 编排配置 + 异常模拟 + Math.random 覆写 */
async function presetRobotState(
  page: Page,
  opts: {
    steps: Array<{ actionType: string; params: Record<string, unknown> }>
    exceptionSim?: { enabled: boolean; probability: number }
    randomValue?: number
  },
) {
  const config = {
    id: 'preset-cfg',
    name: '预设配置',
    steps: opts.steps.map((s, i) => ({ id: `s${i}`, actionType: s.actionType, params: s.params })),
    createdAt: Date.now(),
  }
  const lines = [
    `localStorage.setItem('robot-configs', JSON.stringify(${JSON.stringify([config])}));`,
  ]
  if (opts.exceptionSim) {
    lines.push(
      `localStorage.setItem('robot-exception-sim', JSON.stringify(${JSON.stringify(opts.exceptionSim)}));`,
    )
  }
  if (opts.randomValue !== undefined) {
    lines.push(`Math.random = () => ${opts.randomValue};`)
  }
  await page.addInitScript(lines.join('\n'))
}

// ─── 导航与路由 ────────────────────────────────────────────

test.describe('机器人运动控制 Agent - E2E 验收测试', () => {
  test('ROBOT-001: 首页入口与 #/robot 深链接直达机器人视图', async ({ page }) => {
    // 从首页入口按钮进入
    await goToRobotFromHome(page)
    await expect(page.getByRole('heading', { name: '机器人运动控制' })).toBeVisible()

    // 深链接直达
    await page.goto('/')
    await page.goto('/#/robot')
    await expect(page).toHaveURL(/#\/robot$/)
    await expect(page.getByRole('heading', { name: '机器人运动控制' })).toBeVisible()
  })

  test('ROBOT-002: 四标签页导航切换', async ({ page }) => {
    await goToRobot(page)
    // 默认任务下发标签
    await expect(page.getByRole('tab', { name: /任务下发/ })).toHaveAttribute('data-state', 'active')

    // 切换到动作编排
    await switchTab(page, '动作编排')
    await expect(page.getByRole('tab', { name: /动作编排/ })).toHaveAttribute('data-state', 'active')
    await expect(page.getByText('添加第一个动作步骤开始编排')).toBeVisible()

    // 切换到执行历史
    await switchTab(page, '执行历史')
    await expect(page.getByText('暂无执行历史')).toBeVisible()

    // 切换到 LLM 设置
    await switchTab(page, 'LLM 设置')
    await expect(page.getByText('LLM API 配置')).toBeVisible()
  })

  // ─── 手动编排执行 ────────────────────────────────────────

  test('ROBOT-003: 手动编排 - 添加步骤并成功执行（状态反馈）', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, '动作编排')

    // 添加三种动作步骤
    await page.getByRole('button', { name: /添加步骤 · 抓取/ }).click()
    await page.getByRole('button', { name: /添加步骤 · 移动/ }).click()
    await page.getByRole('button', { name: /添加步骤 · 跳跃/ }).click()

    // 执行编排
    await page.getByRole('button', { name: '执行编排' }).click()

    // 等待执行完成
    await waitForExecutionDone(page)

    // 验证执行总结显示成功数
    const summary = page.locator('div').filter({ hasText: '执行总结' }).last()
    await expect(summary.getByText(/成功/)).toBeVisible()

    // 验证步骤状态徽章显示成功
    await expect(page.getByText('成功', { exact: true }).first()).toBeVisible()
  })

  // ─── 异常处理 ────────────────────────────────────────────

  test('ROBOT-004: 参数非法 - 速度≤0 阻止执行不重试', async ({ page }) => {
    await presetRobotState(page, {
      steps: [
        {
          actionType: 'grab',
          params: { speed: 0, target: '目标物体', retries: 2, timeout: 3000, priority: 'normal' },
        },
      ],
    })
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await loadFirstConfig(page)

    // 执行编排
    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    // 验证参数非法详情与失败状态
    await expect(page.getByText(/参数非法.*speed/)).toBeVisible()
    await expect(page.getByText('失败', { exact: true })).toBeVisible()
  })

  test('ROBOT-005: 参数非法 - 目标为空阻止执行', async ({ page }) => {
    await presetRobotState(page, {
      steps: [
        {
          actionType: 'move',
          params: { speed: 80, target: '', retries: 1, timeout: 5000, priority: 'normal' },
        },
      ],
    })
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await loadFirstConfig(page)

    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    await expect(page.getByText(/参数非法.*target/)).toBeVisible()
    await expect(page.getByText('失败', { exact: true })).toBeVisible()
  })

  test('ROBOT-006: 障碍物阻挡 - 自动重试后标记被阻挡', async ({ page }) => {
    // Math.random()=0.1 → probability check 0.1<1=true; pickRandomException floor(0.1*4)=0 → obstacle
    await presetRobotState(page, {
      steps: [
        {
          actionType: 'grab',
          params: { speed: 50, target: '目标物体', retries: 1, timeout: 5000, priority: 'normal' },
        },
      ],
      exceptionSim: { enabled: true, probability: 1 },
      randomValue: 0.1,
    })
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await loadFirstConfig(page)

    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    // 障碍物阻挡 → 重试耗尽 → 被阻挡状态
    await expect(page.getByText('被阻挡', { exact: true })).toBeVisible()
    await expect(page.getByText('障碍物阻挡')).toBeVisible()
  })

  test('ROBOT-007: 动作超时 - 重试后标记失败（目标不可达同路径）', async ({ page }) => {
    // Math.random()=0.3 → pickRandomException floor(0.3*4)=1 → timeout
    await presetRobotState(page, {
      steps: [
        {
          actionType: 'grab',
          params: { speed: 50, target: '目标物体', retries: 1, timeout: 5000, priority: 'normal' },
        },
      ],
      exceptionSim: { enabled: true, probability: 1 },
      randomValue: 0.3,
    })
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await loadFirstConfig(page)

    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    // 超时 → 重试耗尽 → 失败状态（非 blocked）
    await expect(page.getByText('失败', { exact: true })).toBeVisible()
    await expect(page.getByText('动作超时')).toBeVisible()
  })

  test('ROBOT-008: 硬件故障 - 立即中止整个编排链', async ({ page }) => {
    // Math.random()=0.9 → pickRandomException floor(0.9*4)=3 → hardware
    await presetRobotState(page, {
      steps: [
        {
          actionType: 'grab',
          params: { speed: 50, target: '目标物体', retries: 2, timeout: 5000, priority: 'normal' },
        },
        {
          actionType: 'move',
          params: { speed: 80, target: '目标位置', retries: 1, timeout: 5000, priority: 'normal' },
        },
      ],
      exceptionSim: { enabled: true, probability: 1 },
      randomValue: 0.9,
    })
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await loadFirstConfig(page)

    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    // 硬件故障 → 第一步 aborted + 后续步骤 aborted + 中止消息
    await expect(page.getByText('已中止', { exact: true })).toHaveCount(2)
    await expect(page.getByText('检测到硬件故障，中止整个编排链')).toBeVisible()
  })

  // ─── LLM 任务下发 ────────────────────────────────────────

  test('ROBOT-009: LLM 未配置 - 任务下发禁用，手动编排可用', async ({ page }) => {
    await goToRobot(page)
    // 默认在任务下发标签
    const dispatchBtn = page.getByRole('button', { name: '下发任务' })
    await expect(dispatchBtn).toBeDisabled()
    await expect(page.getByText('请先在设置中配置 LLM API Key')).toBeVisible()

    // 手动编排不受影响
    await switchTab(page, '动作编排')
    await expect(page.getByRole('button', { name: '执行编排' })).toBeVisible()
    await expect(page.getByRole('button', { name: /添加步骤 · 抓取/ })).toBeVisible()
  })

  test('ROBOT-010: LLM 任务下发 - Mock API 解析预览确认执行', async ({ page }) => {
    // Mock LLM API 响应
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              steps: [
                {
                  actionType: 'grab',
                  params: { speed: 50, target: '红色物体', retries: 1, timeout: 3000, priority: 'normal' },
                },
                {
                  actionType: 'jump',
                  params: { speed: 80, target: '门口', retries: 1, timeout: 4000, priority: 'high' },
                },
              ],
            }),
          },
        },
      ],
    }
    await page.route('**/v1/chat/completions', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockResponse) }),
    )

    await goToRobot(page)
    await switchTab(page, 'LLM 设置')
    // 配置 LLM
    await page.getByPlaceholder('https://api.openai.com').fill('https://fake-llm.example.com')
    await page.getByPlaceholder('sk-...').fill('test-key')
    await page.getByPlaceholder('gpt-4o-mini').fill('test-model')
    await page.getByRole('button', { name: '保存' }).click()

    // 回到任务下发
    await switchTab(page, '任务下发')
    const dispatchBtn = page.getByRole('button', { name: '下发任务' })
    await expect(dispatchBtn).toBeEnabled()

    // 输入任务并下发
    await page.getByPlaceholder(/描述你的任务/).fill('抓取桌上红色物体后跳跃到门口')
    await dispatchBtn.click()

    // 验证预览
    await expect(page.getByText('动作方案预览')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('红色物体')).toBeVisible()
    await expect(page.getByText('门口')).toBeVisible()

    // 确认执行
    await page.getByRole('button', { name: '确认执行' }).click()

    // 切换到动作编排等待执行完成
    await switchTab(page, '动作编排')
    await waitForExecutionDone(page)
    const summary = page.locator('div').filter({ hasText: '执行总结' }).last()
    await expect(summary.getByText(/成功/)).toBeVisible()

    // 切换到执行历史验证 LLM 来源标记
    await switchTab(page, '执行历史')
    await expect(page.getByText('LLM', { exact: true })).toBeVisible()
  })

  test('ROBOT-011: LLM 调用失败 - 错误提示，手动编排不受影响', async ({ page }) => {
    await page.route('**/v1/chat/completions', (route) =>
      route.fulfill({ status: 401, body: 'Unauthorized' }),
    )

    await goToRobot(page)
    await switchTab(page, 'LLM 设置')
    await page.getByPlaceholder('sk-...').fill('bad-key')
    await page.getByPlaceholder('gpt-4o-mini').fill('test-model')
    await page.getByRole('button', { name: '保存' }).click()

    await switchTab(page, '任务下发')
    await page.getByPlaceholder(/描述你的任务/).fill('测试任务')
    await page.getByRole('button', { name: '下发任务' }).click()

    // 验证错误提示
    await expect(page.getByText('LLM 调用失败')).toBeVisible({ timeout: 10000 })

    // 手动编排仍可用
    await switchTab(page, '动作编排')
    await expect(page.getByRole('button', { name: '执行编排' })).toBeVisible()
  })

  // ─── 持久化 ──────────────────────────────────────────────

  test('ROBOT-012: 持久化 - 编排配置保存与刷新恢复', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await page.getByRole('button', { name: /添加步骤 · 抓取/ }).click()
    await page.getByPlaceholder('配置名称').fill('持久化测试配置')
    await page.getByRole('button', { name: '保存' }).click()

    // 刷新恢复
    await page.goto('/#/robot')
    await switchTab(page, '动作编排')
    await page.getByRole('button', { name: /已保存方案/ }).click()
    await expect(page.getByText('持久化测试配置')).toBeVisible()
  })

  test('ROBOT-013: 持久化 - 执行历史刷新恢复', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await page.getByRole('button', { name: /添加步骤 · 抓取/ }).click()
    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    // 刷新恢复
    await page.goto('/#/robot')
    await switchTab(page, '执行历史')
    await expect(page.getByText('手动编排', { exact: true })).toBeVisible()
  })

  test('ROBOT-014: 持久化 - LLM 配置刷新恢复', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, 'LLM 设置')
    await page.getByPlaceholder('https://api.openai.com').fill('https://my-llm.example.com')
    await page.getByPlaceholder('sk-...').fill('persist-key-123')
    await page.getByPlaceholder('gpt-4o-mini').fill('my-model')
    await page.getByRole('button', { name: '保存' }).click()

    // 刷新恢复
    await page.goto('/#/robot')
    await switchTab(page, 'LLM 设置')
    await expect(page.getByPlaceholder('sk-...')).toHaveValue('persist-key-123')
    await expect(page.getByPlaceholder('gpt-4o-mini')).toHaveValue('my-model')
  })

  // ─── 边界约束 ────────────────────────────────────────────

  test('ROBOT-015: 返回首页 - 火锅点单流程不受影响', async ({ page }) => {
    await goToRobotFromHome(page)
    // 返回首页
    await page.getByRole('button', { name: '返回首页' }).click()
    await expect(page).toHaveURL(/#\/home$/)

    // 验证火锅点单主流程正常
    await page.getByRole('button', { name: /A08/ }).first().click()
    await expect(page).toHaveURL(/#\/welcome$/)
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
  })

  test('ROBOT-016: i18n - 英文环境文案正确展示', async ({ page }) => {
    await page.addInitScript(`localStorage.setItem('i18nextLng', 'en')`)
    await page.goto('/#/robot')
    await expect(page.getByRole('heading', { name: 'Robot Motion Control' })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Task Dispatch/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Orchestrate/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /History/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /LLM Settings/ })).toBeVisible()
  })
})
