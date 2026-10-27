import { test, expect, type Page, type Locator } from '@playwright/test'

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

/** 在 LLM 设置标签页配置并保存 LLM */
async function configureLlm(page: Page, baseUrl: string, apiKey: string, model: string) {
  await page.getByPlaceholder('https://api.openai.com').fill(baseUrl)
  await page.getByPlaceholder('sk-...').fill(apiKey)
  await page.getByPlaceholder('gpt-4o-mini').fill(model)
  // 设置页有两个"保存"按钮（LLM 配置 + 异常模拟），LLM 的在前
  await page.getByRole('button', { name: '保存' }).first().click()
}

/** 预置 localStorage 编排配置 + 异常模拟 + Math.random 覆写（函数式 addInitScript 保证序列化正确） */
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
  await page.addInitScript(
    (init: { configs: string; exceptionSim: string | null; randomValue: number | null }) => {
      localStorage.setItem('robot-configs', init.configs)
      if (init.exceptionSim) localStorage.setItem('robot-exception-sim', init.exceptionSim)
      if (init.randomValue !== null) Math.random = () => init.randomValue
    },
    {
      configs: JSON.stringify([config]),
      exceptionSim: opts.exceptionSim ? JSON.stringify(opts.exceptionSim) : null,
      randomValue: opts.randomValue ?? null,
    },
  )
}

// ─── 测试用例 ──────────────────────────────────────────────

test.describe('机器人运动控制 Agent - E2E 验收测试', () => {
  test('ROBOT-001: 首页入口与 #/robot 深链接直达机器人视图', async ({ page }) => {
    await goToRobotFromHome(page)
    await expect(page.getByRole('heading', { name: '机器人运动控制' })).toBeVisible()

    await page.goto('/')
    await page.goto('/#/robot')
    await expect(page).toHaveURL(/#\/robot$/)
    await expect(page.getByRole('heading', { name: '机器人运动控制' })).toBeVisible()
  })

  test('ROBOT-002: 四标签页导航切换', async ({ page }) => {
    await goToRobot(page)
    await expect(page.getByRole('tab', { name: /任务下发/ })).toHaveAttribute('data-state', 'active')

    await switchTab(page, '动作编排')
    await expect(page.getByRole('tab', { name: /动作编排/ })).toHaveAttribute('data-state', 'active')
    await expect(page.getByText('添加第一个动作步骤开始编排')).toBeVisible()

    await switchTab(page, '执行历史')
    await expect(page.getByText('暂无执行历史')).toBeVisible()

    await switchTab(page, 'LLM 设置')
    await expect(page.getByText('LLM API 配置')).toBeVisible()
  })

  test('ROBOT-003: 手动编排 - 添加步骤并成功执行（状态反馈）', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, '动作编排')

    await page.getByRole('button', { name: /添加步骤 · 抓取/ }).click()
    await page.getByRole('button', { name: /添加步骤 · 移动/ }).click()
    await page.getByRole('button', { name: /添加步骤 · 跳跃/ }).click()

    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

    const summary: Locator = page.locator('div').filter({ hasText: '执行总结' }).last()
    await expect(summary.getByText(/成功/)).toBeVisible()
    await expect(page.getByText('成功', { exact: true }).first()).toBeVisible()
  })

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

    await page.getByRole('button', { name: '执行编排' }).click()
    await waitForExecutionDone(page)

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

    await expect(page.getByText('已中止', { exact: true })).toHaveCount(2)
    await expect(page.getByText('检测到硬件故障，中止整个编排链')).toBeVisible()
  })

  test('ROBOT-009: LLM 未配置 - 任务下发禁用，手动编排可用', async ({ page }) => {
    await goToRobot(page)
    const dispatchBtn = page.getByRole('button', { name: '下发任务' })
    await expect(dispatchBtn).toBeDisabled()
    await expect(page.getByText('请先在设置中配置 LLM API Key')).toBeVisible()

    await switchTab(page, '动作编排')
    await expect(page.getByRole('button', { name: '执行编排' })).toBeVisible()
    await expect(page.getByRole('button', { name: /添加步骤 · 抓取/ })).toBeVisible()
  })

  test('ROBOT-010: LLM 任务下发 - Mock API 解析预览确认执行', async ({ page }) => {
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
    await configureLlm(page, 'https://fake-llm.example.com', 'test-key', 'test-model')

    await switchTab(page, '任务下发')
    const dispatchBtn = page.getByRole('button', { name: '下发任务' })
    await expect(dispatchBtn).toBeEnabled()

    await page.getByPlaceholder(/描述你的任务/).fill('抓取桌上红色物体后跳跃到门口')
    await dispatchBtn.click()

    await expect(page.getByText('动作方案预览')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('红色物体')).toBeVisible()
    await expect(page.getByText('门口')).toBeVisible()

    await page.getByRole('button', { name: '确认执行' }).click()

    await switchTab(page, '动作编排')
    await waitForExecutionDone(page)
    const summary: Locator = page.locator('div').filter({ hasText: '执行总结' }).last()
    await expect(summary.getByText(/成功/)).toBeVisible()

    await switchTab(page, '执行历史')
    await expect(page.getByText('LLM', { exact: true })).toBeVisible()
  })

  test('ROBOT-011: LLM 调用失败 - 错误提示，手动编排不受影响', async ({ page }) => {
    await page.route('**/v1/chat/completions', (route) =>
      route.fulfill({ status: 401, body: 'Unauthorized' }),
    )

    await goToRobot(page)
    await switchTab(page, 'LLM 设置')
    await configureLlm(page, 'https://fake-llm.example.com', 'bad-key', 'test-model')

    await switchTab(page, '任务下发')
    await page.getByPlaceholder(/描述你的任务/).fill('测试任务')
    await page.getByRole('button', { name: '下发任务' }).click()

    await expect(page.getByText('LLM 调用失败')).toBeVisible({ timeout: 10000 })

    await switchTab(page, '动作编排')
    await expect(page.getByRole('button', { name: '执行编排' })).toBeVisible()
  })

  test('ROBOT-012: 持久化 - 编排配置保存与刷新恢复', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, '动作编排')
    await page.getByRole('button', { name: /添加步骤 · 抓取/ }).click()
    await page.getByPlaceholder('配置名称').fill('持久化测试配置')
    // 编排页"保存"按钮与"已保存方案"按钮名称含"保存"子串，用 exact 精确匹配
    await page.getByRole('button', { name: '保存', exact: true }).click()

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

    await page.goto('/#/robot')
    await switchTab(page, '执行历史')
    await expect(page.getByText('手动编排', { exact: true })).toBeVisible()
  })

  test('ROBOT-014: 持久化 - LLM 配置刷新恢复', async ({ page }) => {
    await goToRobot(page)
    await switchTab(page, 'LLM 设置')
    await configureLlm(page, 'https://my-llm.example.com', 'persist-key-123', 'my-model')

    await page.goto('/#/robot')
    await switchTab(page, 'LLM 设置')
    await expect(page.getByPlaceholder('sk-...')).toHaveValue('persist-key-123')
    await expect(page.getByPlaceholder('gpt-4o-mini')).toHaveValue('my-model')
  })

  test('ROBOT-015: 返回首页 - 火锅点单流程不受影响', async ({ page }) => {
    await goToRobotFromHome(page)
    await page.getByRole('button', { name: '返回首页' }).click()
    await expect(page).toHaveURL(/#\/home$/)

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
