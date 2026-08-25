<script setup>
// 背景电路走线 + 电流脉冲效果（电子元素动态背景）
// 走线虚线用 stroke-dashoffset 动画模拟电流流动；光点沿走线脉冲式传播
</script>

<template>
  <div class="circuit-bg" aria-hidden="true">
    <svg class="traces" viewBox="0 0 100 100" preserveAspectRatio="none">
      <!-- 走线 1（左上→右下） -->
      <path class="trace" d="M-2 18 H28 V42 H58 V68 H102" />
      <path class="trace dim" d="M-2 30 H16 V56 H44 V84 H102" />
      <!-- 走线 2（左下→右上） -->
      <path class="trace" d="M-2 88 H30 V58 H62 V30 H102" />
      <path class="trace dim" d="M-2 74 H22 V46 H52 V14 H102" />
      <!-- 电流脉冲：沿走线流动的发光短线（dash 动画模拟电流跑动） -->
      <path class="pulse-bar" d="M-2 18 H28 V42 H58 V68 H102" />
      <path class="pulse-bar cyan" d="M-2 30 H16 V56 H44 V84 H102" />
      <path class="pulse-bar" d="M-2 88 H30 V58 H62 V30 H102" />
      <path class="pulse-bar cyan" d="M-2 74 H22 V46 H52 V14 H102" />
    </svg>
  </div>
</template>

<style scoped>
.circuit-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
}
.traces {
  width: 100%;
  height: 100%;
}
.trace {
  fill: none;
  stroke: rgba(0, 255, 159, 0.1);
  stroke-width: 0.22;
  stroke-dasharray: 1.6 1.8;
  animation: trace-flow 2.4s linear infinite;
}
.trace.dim {
  stroke: rgba(0, 229, 255, 0.06);
  animation-duration: 3.2s;
}
/* 虚线流动 = 电流在导线里跑 */
@keyframes trace-flow {
  to { stroke-dashoffset: -3.4; }
}
/* 电流脉冲：短亮线沿走线循环流动 */
.pulse-bar {
  fill: none;
  stroke-width: 0.35;
  stroke-linecap: round;
  stroke: rgba(0, 255, 159, 0.4);
  stroke-dasharray: 1.2 150;
  filter: drop-shadow(0 0 1px #00ff9f);
  animation: pulse-travel 6s linear infinite;
}
.pulse-bar.cyan {
  stroke: rgba(0, 229, 255, 0.35);
  filter: drop-shadow(0 0 1px #00e5ff);
  animation-duration: 8s;
  animation-delay: -2s;
}
@keyframes pulse-travel {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -151.2; }
}
</style>
