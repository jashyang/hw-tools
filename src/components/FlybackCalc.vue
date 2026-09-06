<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { materials } from '../core/data/materials.js'
import { partsData } from '../core/data/parts.js'
import { computeFlyback } from '../core/flyback-engine.js'
import { flybackDerivation } from '../core/derivations.js'
import { useCopy } from '../composables/useCopy.js'
import HwSelect from './HwSelect.vue'

// 公式推导（单一来源：core/derivations.js）
const steps = flybackDerivation

// ── 输入状态 ──
const vinMin = ref('85')
const vinMax = ref('265')
const vo = ref('12')
const io = ref('2')
const fs = ref('65')
const eta = ref('87')
const vorTarget = ref('120')
const coreMaterial = ref('PC40')
const dBmax = ref(0.20)
const showSteps = ref(false)
const dBmaxDefault = computed(() => { const m = materials[coreMaterial.value]; return m ? m.deltaBDyn : 0.20 })
watch(coreMaterial, () => { dBmax.value = dBmaxDefault.value })
const diodeType = ref('schottky')
const preferredMode = ref('auto') // auto | ccm | dcm

// ── 下拉选项（替代原生 <select>）──
const coreOptions = computed(() =>
  Object.entries(materials).map(([key, m]) => ({
    value: key,
    label: `${key}（${m.manufacturer}，ΔB默认 ${m.deltaBDyn}T）`,
  }))
)
const diodeOptions = computed(() =>
  // 整流管下拉只保留真正的整流二极管（有 Vf 的），排除混入的 MOSFET
  Object.entries(partsData)
    .filter(([, p]) => typeof p.Vf === 'number' && p.Vf > 0)
    .map(([key, p]) => ({ value: key, label: p.label }))
)

// ── 计算结果 ──
const result = ref(null)
const error = ref('')

// ── 核心计算（引擎在 core/flyback-engine.js）──
function compute() {
  error.value = ''
  const res = computeFlyback({
    vinMin: vinMin.value, vinMax: vinMax.value,
    vo: vo.value, io: io.value,
    fs: fs.value, eta: eta.value,
    vorTarget: vorTarget.value, coreMaterial: coreMaterial.value,
    dBmax: dBmax.value, diodeType: diodeType.value, preferredMode: preferredMode.value,
  })
  if (res.error) { error.value = res.error; result.value = null; return }
  result.value = res
}

// ── 复制（useCopy composable）──
const { copied, copy } = useCopy()
async function copyResult() {
  if (!result.value) return
  const r = result.value
  const modeName = r.design.mode === 'ccm' ? 'CCM' : 'DCM'
  const lines = [
    `反激变压器设计定案（${modeName}）`,
    `输出: ${r.input.Vo}V/${r.input.Io}A (${r.derived.Pout.toFixed(1)}W)`,
    `磁芯: ${r.derived.coreModel} ${r.derived.materialName}`,
    `Np=${r.winding.Np} Turn / Ns=${r.winding.Ns} Turn (TR=${r.winding.nActual.toFixed(1)})`,
    `VOR=${r.winding.VorActual.toFixed(1)}V / Dmax=${(r.derived.DmaxActual * 100).toFixed(1)}%`,
    `Lp=${r.design.LpLabel} · 气隙≈${r.design.lg}mm`,
    `Ipk=${r.design.Ipk.toFixed(2)}A / Irms=${r.design.Irms.toFixed(2)}A / 次级峰值Ispk=${r.design.IsPk.toFixed(2)}A`,
    ...r.winding.warnings,
  ]
  copy(lines.join('\n'))
}

// ── 响应 SceneView 顶部栏的公式说明点击 ──
onMounted(() => {
  function handleFormulaEvent() { showSteps.value = true }
  window.addEventListener('hwtools:open-formula', handleFormulaEvent)
  onUnmounted(() => { window.removeEventListener('hwtools:open-formula', handleFormulaEvent) })
})
</script>

<template>
  <div class="flyback-calc">
    <!-- 标题行 + 计算按钮（与电阻计算一致：按钮在标题行右侧） -->
    <div class="section-title calc-title">
      <span>变压器设计参数</span>
      <button class="btn cyan compute-btn title-btn" @click="compute">⚡ 计算</button>
    </div>

    <!-- 输入表单 -->
    <div class="input-grid">
      <div class="group-label">输入 / 输出规格</div>
      <div class="field">
        <label class="field-label"><span class="fname">交流输入 AC（有效值）</span></label>
        <div class="inline-pair">
          <input v-model="vinMin" type="text" inputmode="decimal" class="field-input sm" placeholder="下限 (V)" />
          <span class="dash">~</span>
          <input v-model="vinMax" type="text" inputmode="decimal" class="field-input sm" placeholder="上限 (V)" />
        </div>
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">输出 Vo / Io</span></label>
        <div class="inline-pair">
          <input v-model="vo" type="text" inputmode="decimal" class="field-input sm" placeholder="Vo (V)" />
          <span class="slash">/</span>
          <input v-model="io" type="text" inputmode="decimal" class="field-input sm" placeholder="Io (A)" />
        </div>
      </div>

      <div class="group-label">工作参数</div>
      <div class="field">
        <label class="field-label"><span class="fname">开关频率 fs（kHz）</span></label>
        <input v-model="fs" type="text" inputmode="decimal" class="field-input sm" placeholder="如 65" />
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">预期效率 η（%）</span></label>
        <input v-model="eta" type="text" inputmode="decimal" class="field-input sm" placeholder="如 87" />
      </div>

      <div class="group-label">设计目标</div>
      <div class="field">
        <label class="field-label"><span class="fname">目标反射电压 VOR（V）</span></label>
        <input v-model="vorTarget" type="text" inputmode="decimal" class="field-input sm" placeholder="如 120" />
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">工作模式偏好</span></label>
        <div class="seg-group">
          <button :class="{ on: preferredMode==='auto' }" @click="preferredMode='auto'" class="seg-btn">自动</button>
          <button :class="{ on: preferredMode==='ccm' }" @click="preferredMode='ccm'" class="seg-btn">CCM</button>
          <button :class="{ on: preferredMode==='dcm' }" @click="preferredMode='dcm'" class="seg-btn">DCM</button>
        </div>
      </div>

      <div class="group-label">磁芯 / 材料 / 器件</div>
      <div class="field">
        <label class="field-label"><span class="fname">磁芯材质</span></label>
        <HwSelect v-model="coreMaterial" :options="coreOptions" placeholder="选择磁芯材质" size="sm" />
      </div>
      <div class="field">
        <label class="field-label"><span class="fname">输出整流管</span></label>
        <HwSelect v-model="diodeType" :options="diodeOptions" placeholder="选择整流管" size="sm" />
      </div>
    </div>

    <!-- 公式说明弹窗（必须在 v-if="result" 外，否则未计算时也能弹出） -->
    <Transition name="fade">
      <div v-if="showSteps" class="modal-overlay" @click.self="showSteps = false">
        <div class="modal-content">
          <div class="modal-header">
            <span>📐 公式推导（为什么这个公式成立）</span>
            <button class="modal-close" @click="showSteps = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-for="(step, idx) in steps" :key="idx" class="step-block">
              <h4>{{ step.title }}</h4>
              <pre class="step-lines">{{ step.lines.join('\n') }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 错误提示 -->
    <div v-if="error" class="result-error">⚠ {{ error }}</div>

    <!-- 结果区域 -->
    <div v-if="result">
      <!-- 警告信息 -->
      <div v-if="result.winding.warnings.length" class="warning-box">
        <div v-for="(w,i) in result.winding.warnings" :key="i" class="warn-item">{{ w }}</div>
      </div>

      <!-- 当前方案 + 推荐说明（按功率档位，不按峰值比） -->
      <div class="mode-note">
        <span class="mode-tag" :class="result.design.mode">{{ result.design.mode === 'ccm' ? 'CCM · 连续导通' : 'DCM · 断续导通' }}</span>
        <span class="mode-why">{{ result.conclusion }}</span>
      </div>

      <!-- 表一：两种模式后果对比（信息参考，不自动选模式） -->
      <div class="table-section">
        <h3 class="table-title">📊 两种工作模式后果对比</h3>
        <table class="data-table compare">
          <thead>
            <tr>
              <th style="width:150px">对比维度</th>
              <th>CCM</th>
              <th>DCM</th>
            </tr>
          </thead>
          <tbody>
            <tr><td class="dim">原边电感 Lp</td><td>{{ result.ccm.LpLabel }}</td><td>{{ result.dcm.LpLabel }}</td></tr>
            <tr><td class="dim">初级峰值 Ipk</td><td>{{ result.ccm.Ipk.toFixed(2) }} A</td><td>{{ result.dcm.Ipk.toFixed(2) }} A</td></tr>
            <tr><td class="dim">初级有效值 Irms</td><td>{{ result.ccm.Irms.toFixed(2) }} A</td><td>{{ result.dcm.Irms.toFixed(2) }} A</td></tr>
            <tr><td class="dim">次级峰值 Ispk</td><td>{{ result.ccm.secPeak.toFixed(2) }} A</td><td>{{ result.dcm.secPeak.toFixed(2) }} A</td></tr>
            <tr><td class="dim">适用功率</td><td>15～65W</td><td>&lt;15W</td></tr>
            <tr><td class="dim">控制复杂度</td><td>需 RCD 钳位 + RHP 零点补偿</td><td>简单，无 RHP 零点</td></tr>
            <tr><td class="dim">EMI / 开关应力</td><td>峰值低，EMI 较好</td><td>峰值高，EMI 偏大</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 表二：核心设计定案（跟随所选模式） -->
      <div class="table-section">
        <h3 class="table-title">🔧 核心设计定案（{{ result.design.mode === 'ccm' ? 'CCM' : 'DCM' }}）</h3>
        <table class="data-table specs">
          <tbody>
            <tr><td class="dim">输出功率</td><td>{{ result.derived.Pout.toFixed(1) }} W</td></tr>
            <tr><td class="dim">直流母线 Vin(min)→Vdc(min)</td><td>{{ result.input.VinMin }}VAC → {{ result.derived.VdcMin.toFixed(1) }} VDC</td></tr>
            <tr><td class="dim">磁芯型号</td><td>{{ result.derived.coreModel }} <span class="note">({{ result.derived.source }})</span> （Ae={{ result.derived.Ae }}mm², Le={{ result.derived.Le }}mm, Aw={{ result.derived.Aw }}mm²）</td></tr>
            <tr><td class="dim">材质等级</td><td>{{ result.derived.materialName }}（ΔBmax={{ dBmax }}T）</td></tr>
            <tr><td class="dim">初级匝数 Np</td><td><b>{{ result.winding.Np }} Turn</b> <span class="note">(理论最小≈{{ result.winding.NpMin }}Turn)</span></td></tr>
            <tr><td class="dim">次级匝数 Ns</td><td><b>{{ result.winding.Ns }} Turn</b></td></tr>
            <tr><td class="dim">实际匝比 TR</td><td>{{ result.winding.nActual.toFixed(1) }} : 1 （等效 {{ result.winding.Np }}:{{ result.winding.Ns }}）</td></tr>
            <tr><td class="dim">实际反射电压 VOR'</td><td>{{ result.winding.VorActual.toFixed(1) }} V</td></tr>
            <tr><td class="dim">占空比 Dmax</td><td>{{ (result.derived.DmaxActual * 100).toFixed(1) }} %</td></tr>
            <tr><td class="dim">工作磁密 ΔB</td><td>{{ result.derived.dBact.toFixed(3) }} T <span class="note">(材料 Bs={{ result.derived.Bsat }}T, 100℃ 安全上限≈{{ result.derived.BsEff.toFixed(2) }}T)</span></td></tr>
            <tr><td class="dim">边界电感 Lcrit</td><td>{{ result.derived.LcritLabel }}（{{ result.design.mode === 'ccm' ? '所选 Lp＞此值→CCM' : '所选 Lp＜此值→DCM' }}）</td></tr>
            <tr><td class="dim">原边电感 Lp</td><td><b>{{ result.design.LpLabel }}</b></td></tr>
            <tr><td class="dim">气隙长度 lg</td><td>{{ result.design.lg }} mm <span class="note">(骨架限 ≤{{ result.derived.maxGap }}mm)</span></td></tr>
            <tr><td class="dim">窗口填充率</td><td>{{ result.winding.fillPct }}% <span class="note">(需 ≤100%，线径已按 RMS+4.5A/mm² 选)</span></td></tr>
            <tr><td class="dim">初级峰值 Ipk</td><td>{{ result.design.Ipk.toFixed(2) }} A</td></tr>
            <tr><td class="dim">初级有效值 Irms</td><td>{{ result.design.Irms.toFixed(2) }} A</td></tr>
            <tr><td class="dim">次级有效值 Irms</td><td>{{ result.design.IsecRms.toFixed(2) }} A</td></tr>
            <tr><td class="dim">次级峰值 Ispk</td><td>{{ result.design.IsPk.toFixed(2) }} A</td></tr>
            <tr><td class="dim">初级线径建议</td><td>{{ result.design.priAWG }}</td></tr>
            <tr><td class="dim">次级线径建议</td><td>{{ result.design.secAWG }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 表三：损耗 / 温升（估算） -->
      <div class="table-section">
        <h3 class="table-title">🔥 损耗 / 温升（估算）</h3>
        <table class="data-table specs">
          <tbody>
            <tr><td class="dim">漏感 Lleak</td><td>{{ (result.loss.Lleak * 1000).toFixed(1) }} µH <span class="note">(≈2% Lp，P-S-P 三明治)</span></td></tr>
            <tr><td class="dim">初级铜损</td><td>{{ result.loss.Pcu.toFixed(2) }} W</td></tr>
            <tr><td class="dim">磁芯铁损</td><td>{{ result.loss.Pcore.toFixed(2) }} W</td></tr>
            <tr><td class="dim">总损耗</td><td>{{ result.loss.Ptot.toFixed(2) }} W</td></tr>
            <tr><td class="dim">估算效率</td><td>{{ result.loss.eff.toFixed(1) }} %</td></tr>
            <tr><td class="dim">估算温升 ΔT</td><td>≈ {{ result.loss.dT.toFixed(1) }} ℃ <span class="note">(参考热阻估算，需实测)</span></td></tr>
          </tbody>
        </table>
      </div>

      <!-- 表四：器件应力与选型 -->
      <div class="table-section">
        <h3 class="table-title">⚡ 器件应力与选型</h3>
        <table class="data-table specs">
          <tbody>
            <tr><td class="dim">MOSFET 关断压 Vsw</td><td>{{ result.stress.Vsw.toFixed(0) }} V <span class="note">(VdcMax+VOR+尖峰 {{ result.stress.Vspike.toFixed(1) }}V)</span></td></tr>
            <tr><td class="dim">MOSFET 耐压建议</td><td><b>{{ result.stress.mosfet }}</b> <span class="note">(需 ≥{{ result.stress.vdsReq.toFixed(0) }}V)</span></td></tr>
            <tr><td class="dim">次级二极管反压 Vr</td><td>{{ result.stress.VrDiode.toFixed(0) }} V <span class="note">(需 ≥{{ result.stress.vrReq.toFixed(0) }}V)</span></td></tr>
            <tr><td class="dim">次级整流管建议</td><td><b>{{ result.stress.diode }}</b></td></tr>
          </tbody>
        </table>
      </div>

      <!-- 复制按钮 -->
      <button class="btn cyan copy-btn" @click="copyResult">{{ copied ? '✓ 已复制' : '⧉ 复制定案数据' }}</button>
    </div>
  </div>
</template>

<style scoped>
.flyback-calc { display: flex; flex-direction: column; gap: 14px; }

/* ── 输入网格 ── */
.input-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.inline-pair { display: flex; align-items: center; gap: 6px; }
.inline-pair .dash, .inline-pair .slash { color: var(--dim); font-size: 14px; }
.seg-group { display: flex; gap: 4px; background: rgba(6,9,15,0.45); border: 1px solid var(--border); border-radius: 6px; padding: 3px; }
.seg-btn { flex:1; font-size: 11px; color: var(--dim); background: transparent; border: none; border-radius: 4px; padding: 4px 8px; cursor:pointer; }
.seg-btn.on { color: var(--cyan); background: rgba(79,138,168,0.14); }
.sm { font-size: 16px !important; padding: 8px 10px !important; }

/* ── 标题行 + 计算按钮（与电阻计算一致：按钮在右侧） ── */
.calc-title { justify-content: space-between; }
.title-btn { margin-left: auto; flex-shrink: 0; align-self: center; }

/* ── 错误/警告 ── */
.result-error { font-family: var(--mono); font-size: 12px; color: var(--red); padding: 8px; background: rgba(194,91,91,0.08); border-radius: 6px; }
.warning-box { font-family: var(--mono); font-size: 12px; color: var(--amber); background: rgba(185,141,82,0.08); border-radius: 6px; padding: 8px 10px; }

/* ── 表格区 ── */
.table-section { margin-top: 8px; }
.table-title { font-size: 13px; color: var(--cyan); margin: 0 0 6px 0; letter-spacing: 1px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--mono); background: rgba(15,21,31,0.3); border-radius: 8px; overflow: hidden; }
.data-table th { text-align: left; padding: 8px 10px; background: rgba(6,9,15,0.6); color: var(--dim); font-weight: normal; font-size: 11px; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
.data-table td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
.data-table tr:last-child td { border-bottom: none; }
.dim { color: var(--dim); font-size: 11px; white-space: nowrap; }
.note { color: var(--dim); font-size: 11px; }

.copy-btn { margin-top: 12px; }

/* ── 当前方案说明条（按功率推荐，非自动锁定） ── */
.mode-note {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--mono);
  font-size: 12px;
  background: rgba(79, 138, 168, 0.08);
  border: 1px solid var(--cyan-dim);
  border-radius: 8px;
  padding: 8px 12px;
}
.mode-tag {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 5px;
  letter-spacing: 1px;
  font-weight: 700;
  color: var(--neon);
  background: rgba(88, 166, 143, 0.14);
  border: 1px solid var(--neon-dim);
}
.mode-tag.dcm { color: var(--amber); background: rgba(185,141,82,0.14); border-color: var(--amber-dim); }
.mode-why { color: var(--dim); line-height: 1.5; }

/* ── 分组标题（输入区整理布局） ── */
.group-label {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--dim);
  text-transform: uppercase;
  margin-top: 10px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255,255,255,0.07);
}
.group-label::before {
  content: '▸';
  color: var(--neon);
}
.group-label:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

@media(max-width:700px) {
  .compare { font-size: 11px; }
  .compare td, .compare th { padding: 4px 6px; }
  .specs td:first-child { width: 140px; }
}
</style>
