<script setup>
import { ref, watch, onMounted, computed } from 'vue'
import PinLock from './components/PinLock.vue'
import CircuitBg from './components/CircuitBg.vue'
import SceneView from './views/SceneView.vue'
import { CATEGORIES, sceneById } from './core/scenes.js'

const UNLOCK_KEY = 'hw-tools-unlock-until'
const UNLOCK_TTL = 24 * 3600 * 1000 // 24 小时

const unlocked = ref(false)
const currentId = ref(CATEGORIES[0].items[0]) // 默认选中第一个场景
const navOpen = ref(false) // 移动端侧栏展开

// ── 全局公式弹窗状态 ──
const formulaModalOpen = ref(false)

// 初始化：读取 localStorage 解锁时间戳
const saved = Number(localStorage.getItem(UNLOCK_KEY) || 0)
if (saved > Date.now()) unlocked.value = true

function onUnlock() {
  unlocked.value = true
  localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_TTL))
}

// 退出登录：清除解锁状态，回到 PIN 门禁页
function logout() {
  localStorage.removeItem(UNLOCK_KEY)
  unlocked.value = false
}

function selectScene(id) {
  currentId.value = id
  navOpen.value = false
}

// 监听全局公式弹窗事件
function handleFormulaEvent(e) {
  if (e.detail && e.detail.sceneId === 'flyback') {
    formulaModalOpen.value = true
  }
}

onMounted(() => {
  document.addEventListener('hwtools:open-formula', handleFormulaEvent)
})

const currentCatName = computed(() => {
  const cat = CATEGORIES.find((c) => c.items.includes(currentId.value))
  return cat ? cat.name : ''
})
</script>

<template>
  <CircuitBg />
  <PinLock v-if="!unlocked" @unlock="onUnlock" />

  <template v-else>
    <div class="layout">
    <!-- 移动端遮罩 -->
    <div v-if="navOpen" class="nav-mask" @click="navOpen = false"></div>

    <!-- 左侧分类导航 -->
    <aside class="sidebar" :class="{ open: navOpen }">
      <div class="side-logo" @click="currentId = CATEGORIES[0].items[0]">
        <span class="chip"></span>HW-TOOLS
      </div>
      <nav class="side-nav">
        <div v-for="cat in CATEGORIES" :key="cat.id" class="cat-group">
          <div class="cat-name">{{ cat.icon }} {{ cat.name }}</div>
          <button
            v-for="id in cat.items"
            :key="id"
            class="nav-item"
            :class="{ active: currentId === id }"
            @click="selectScene(id)"
          >
            {{ sceneById[id].name }}
          </button>
        </div>
      </nav>
      <div class="side-foot">HW-TOOLS v0.2 · CIRCUIT CALC</div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="main">
      <header class="term-bar">
        <button class="hamburger" @click="navOpen = !navOpen">☰</button>
        <span class="term-path">~/{{ currentCatName }}/{{ sceneById[currentId].name }}</span>
        <span class="term-status"><i class="dot"></i> AUTH OK</span>
        <button class="logout-btn" title="退出登录" @click="logout">⏻ 退出</button>
      </header>
      <SceneView :key="currentId" :scene="sceneById[currentId]" />
    </main>
    </div>

    <!-- 全局公式弹窗（仅 flyback 场景有效） -->
    <Transition name="fade">
      <div v-if="formulaModalOpen" class="modal-overlay" @click.self="formulaModalOpen = false">
        <div class="modal-content">
          <div class="modal-header">
            <span>📐 公式推导（为什么这个公式成立）</span>
            <button class="modal-close" @click="formulaModalOpen = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="step-block">
              <h4>① 能量守恒：输入功率</h4>
              <pre class="step-lines">反激变换器本质是一个隔离型 BUCK-BOOST，
开关管 ON 时储能于变压器漏感+原边电感，OFF 时释放到副边。

根据能量守恒：
  Ppri = Pout / η
其中 η 包含开关损耗、铜损、铁损、二极管压降损耗等。
最低输入电压时最恶劣——此时 D 最大、电流峰值最高。</pre>
            </div>
            <div class="step-block">
              <h4>② 匝比 n = VOR / Vsec —— 为什么这么定？</h4>
              <pre class="step-lines">反射电压 VOR 是开关管 OFF 时折算到原边的副边电压。
由变压器同名端关系：
  VOR / Vo' = Np / Ns = n   （Vo' = Vo + Vf，含二极管压降）
所以 n = VOR / (Vo + Vf)。

VOR 的选择权衡：
  • 太高 → D 越大 → 占空比更接近上限，MOSFET 与输出二极管耐压更高
  • 太低 → D 越小 → 低压输入时原边峰值电流升高 → 铜损/MOSFET Rds(on) 损耗↑
  • 同时 VOR 也决定 MOSFET 耐压：Vsw = Vin(max)√2 + VOR
    例：265VAC → 375V + 120V = 495V → 选 600V MOSFET</pre>
            </div>
            <div class="step-block">
              <h4>③ 最大占空比 Dmax —— 从伏秒平衡推导</h4>
              <pre class="step-lines">稳态时变压器原边在一个周期内的净伏秒积为零（否则磁芯饱和）。
ON 期间：V_Lp = Vdc，持续时间为 DTs
OFF 期间：V_Lp = -VOR，持续时间为 (1-D)Ts

伏秒平衡：
  Vdc · DTs = VOR · (1-D)Ts
  Vdc · D = VOR · (1-D)
  Vdc · D + VOR · D = VOR
  D(Vdc + VOR) = VOR

  Dmax = VOR / (Vdc + VOR)
最低 Vin 时 D 最大——这是最恶劣工况。

◆ 占空比控制（&lt;50%）：
  Dmax ≤ 50% ⟺ VOR ≤ Vdc（因为 VOR/(Vdc+VOR) ≤ 0.5）
  本工具上限设 48%（留裕量），对应 VOR ≤ 0.48·Vdc/(1-0.48) ≈ 0.92·Vdc。
  若你填的目标 VOR 超过该值，工具自动降到上限，保证占空比≤48%。

◆ 为什么压到 &lt;50%：
  VOR 越高 → Vsw = VdcMax + VOR + 漏感尖峰 越高 → MOSFET 耐压要求越高；
  且 CCM 下 D>50% 易亚谐波振荡，需加斜坡补偿。
  例：265VAC→375V + VOR=120V ≈ 495V → 选 600V/650V MOSFET。</pre>
            </div>
            <div class="step-block">
              <h4>④ 法拉第定律 → Np 最小值</h4>
              <pre class="step-lines">法拉第电磁感应定律：
  V = N · dΦ/dt = N · Ae · dB/dt
对恒定电压 V 作用时间 t：
  V · t = N · Ae · ΔB

在 PWM 中，ON 时间 t_on = D/f = D·Ts，施加电压为 Vdc：
  Vdc · (D/fs) = Np · Ae · ΔB

  Np_min = Vdc · Dmax / (ΔB · Ae · fs)

物理意义：Np 不足时，同样 V·t 下 ΔB 超标 → 磁芯进入饱和区 → 
μ 骤降 → 励磁电感崩塌 → 初级电流指数飙升 → MOSFET 炸机。

工程中取 Np_real = ceil(Km × Np_min)，Km ≈ 1.5~1.8 留裕量。</pre>
            </div>
            <div class="step-block">
              <h4>⑤ 次级匝数 Ns 与取整效应</h4>
              <pre class="step-lines">理想匝比 n = Np/Ns，取整后实际匝比为有理数而非无理数：
  Ns = round(Np / n)，n_actual = Np_real / Ns

取整会引入误差——VOR 和 D 都要重新计算：
  VOR_actual = (Vo + Vf) · n_actual
  Dmax_actual = VOR_actual / (Vdc + VOR_actual)
这就是为什么取整后要"回代"校验。</pre>
            </div>
            <div class="step-block">
              <h4>⑥ 临界电感 Lcrit —— CCM/DCM 的分界线</h4>
              <pre class="step-lines">当开关管再次导通瞬间，次级电流恰好降到零——这就是临界状态。

次级电流下降斜率（OFF 期间）：
  di/dt = Vo' / Lp_sec = (Vo + Vf) / (Lp/n²) = n²(Vo+Vf) / Lp
下降时间 = (1-D)/fs，所以下降量：
  ΔI_sec = n²(Vo+Vf)(1-D) / (Lp · fs)

平均次级电流（忽略纹波）：
  Isec_avg = Io / (1-D)

临界条件：峰值 = 2 × 平均值（三角波）：
  ΔI_sec/2 = Io / (1-D)

整理得临界电感：
  Lcrit = n²·(Vo+Vf)·(1-D)² / (2·Io·fs)
用 Pout = Vo·Io 替换 Io = Pout/Vo：
  Lcrit = n²·Vo·(Vo+Vf)·(1-D)² / (2·Pout·fs)
由于 Vo ≈ Vo+Vf（Vf 较小），常近似为：
  Lcrit ≈ n²·Vo²·(1-D)² / (2·Pout·fs)

Lp > Lcrit → CCM（连续，电流不降到零）
Lp < Lcrit → DCM（断续，每个周期电流归零再充）
Lp = Lcrit →临界 DCM（边界刚好归零）</pre>
            </div>
            <div class="step-block">
              <h4>⑦ CCM 模式：峰值/有效值电流推导</h4>
              <pre class="step-lines">CCM 下原边电流为三角波叠加直流偏置：

平均原边电流（ON 期间导通）：
  Ilp_avg = Ppri / (Vdc · D)    ← P = VI 的时域平均

峰峰值纹波（三角波幅度）：
  ΔIpp = Vdc · D / (Lp · fs)   ← V = L·di/dt 的微分形式
定义纹波比 r = ΔIpp / Ilp_avg（通常取 0.3~0.4）：
  ΔIpp = r · Ilp_avg

峰值电流（波形最高点）：
  Ipk = Ilp_avg + ΔIpp/2 = Ilp_avg · (1 + r/2)

有效值（RMS，一个周期内发热等效）：
  Irms = Ipk · √(D · (1 + r²/3))
该式来自三角波 RMS 积分（on 期间有三角波，off 期间为零）。

选择 Lp = (1.5~2) × Lcrit 的理由：
  • 太接近 Lcrit → 对负载变化敏感，稍加重载就进 DCM
  • 太大 → 开关频率固定但 ΔI↓ → 需要更大的 Np→ΔB↑ 或更大磁芯
  • 1.5x 是兼顾动态响应和体积的折衷。</pre>
            </div>
            <div class="step-block">
              <h4>⑧ DCM 模式：峰值电流的平方根关系</h4>
              <pre class="step-lines">DCM 的能量传输是"批量"式的：每个周期充入固定能量然后释放完毕。

一个周期的能量：
  E_cycle = ½ · Lp · Ipk²

功率 = 能量 × 频率：
  Ppri = E_cycle · fs = ½ · Lp · Ipk² · fs

反解峰值电流：
  Ipk = √(2 · Ppri / (Lp · fs))

DCM 的特性：
  • 峰值电流与 Lp 成反比——电感越小，脉冲越尖
  • 传导 EMI 更大（高频谐波丰富）
  • 但控制环路更简单（右半平面零点问题不存在）
  • 轻载效率高（没有 CCM 的续流损耗）

所以小功率 (&lt; 15W) 常见 DCM，大功率倾向 CCM。</pre>
            </div>
            <div class="step-block">
              <h4>⑨ 气隙长度 lg —— 为什么必须加气隙？</h4>
              <pre class="step-lines">无气隙铁氧体：μr ~ 2000，L 极大但极易饱和（ΔB 很小就饱和）。

等效磁路：
  ℜtotal = ℜcore + ℜgap = Le/(μ·μ₀·Ae) + lg/(μ₀·Ae)
气隙 μr ≈ 1，远大于铁氧体 μr ~ 2000 的贡献，所以：
  ℜtotal ≈ lg / (μ₀ · Ae)

电感：
  Lp = Np² / ℜtotal ≈ Np² · μ₀ · Ae / lg

反解气隙：
  lg = Np² · μ₀ · Ae / Lp

物理意义：
  • 气隙增加磁阻 → 降低有效电感 → 增大储能容量 (½LI²)
  • 防止 ΔB 超限 → 避免饱和
  • 但同时增大了漏感和边缘磁通 → 靠近气隙的线圈铜损显著上升（proximity effect）

因此绕线时要注意：靠近气隙一侧用 P-S-P 三明治绕法
（初级-绝缘-次级-绝缘-初级）以抵消漏磁场。</pre>
            </div>
            <div class="step-block">
              <h4>⑩ 导线截面积选择——电流密度经验法则</h4>
              <pre class="step-lines">导线选型原则：单位截面积的电流（电流密度 J）控制在合理范围。

典型取值：
  • 自然对流冷却：J = 3~4 A/mm²
  • 强制风冷：J = 5~6 A/mm²
  • PCB 走线：J = 10~20 A/mm²（散热好）

所需截面积：
  S = Irms / J
查 AWG 表找 S ≤ 可用规格的最小 AWG 编号。

如果线径太粗放不下，采用多股细线并绕：
  N_strand = ceil(S_required / S_single)
总截面积不变，但交流损耗略高（集肤效应减弱）。</pre>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </template>
</template>

<style>
/* ── 全局公式弹窗样式 ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  font-weight: bold;
  color: var(--neon);
}

.modal-close {
  background: none;
  border: none;
  color: var(--dim);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.modal-close:hover { color: var(--red); }

.modal-body {
  overflow-y: auto;
  padding: 16px 20px;
  flex: 1;
}

.step-block { margin-bottom: 18px; }
.step-block:last-child { margin-bottom: 0; }

.step-block h4 {
  color: var(--cyan);
  font-size: 13px;
  margin: 0 0 6px 0;
  letter-spacing: 0.5px;
}

.step-lines {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.6;
  color: var(--text);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
