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
      <!-- 脉冲光点：多个光点错开沿走线流动，模拟电流脉冲传播 -->
      <circle class="pulse" r="0.9" fill="#00ff9f">
        <animateMotion dur="9s" repeatCount="indefinite" path="M-2 18 H28 V42 H58 V68 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse" r="0.7" fill="#00ff9f">
        <animateMotion dur="9s" begin="-1.5s" repeatCount="indefinite" path="M-2 18 H28 V42 H58 V68 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="3s" begin="-1.5s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse cyan" r="0.7" fill="#00e5ff">
        <animateMotion dur="13s" repeatCount="indefinite" path="M-2 30 H16 V56 H44 V84 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="4s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse cyan" r="0.55" fill="#00e5ff">
        <animateMotion dur="13s" begin="-2s" repeatCount="indefinite" path="M-2 30 H16 V56 H44 V84 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="4s" begin="-2s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse" r="0.8" fill="#00ff9f">
        <animateMotion dur="11s" repeatCount="indefinite" path="M-2 88 H30 V58 H62 V30 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="3.5s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse" r="0.6" fill="#00ff9f">
        <animateMotion dur="11s" begin="-1.2s" repeatCount="indefinite" path="M-2 88 H30 V58 H62 V30 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="3.5s" begin="-1.2s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse cyan" r="0.6" fill="#00e5ff">
        <animateMotion dur="15s" repeatCount="indefinite" path="M-2 74 H22 V46 H52 V14 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="4.5s" repeatCount="indefinite" />
      </circle>
      <circle class="pulse cyan" r="0.5" fill="#00e5ff">
        <animateMotion dur="15s" begin="-2.5s" repeatCount="indefinite" path="M-2 74 H22 V46 H52 V14 H102" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.85;1" dur="4.5s" begin="-2.5s" repeatCount="indefinite" />
      </circle>
      <!-- 节点焊盘 -->
      <circle cx="28" cy="42" r="1.6" fill="none" stroke="#00ff9f" stroke-width="0.35" class="node" />
      <circle cx="58" cy="68" r="1.6" fill="none" stroke="#00ff9f" stroke-width="0.35" class="node" />
      <circle cx="30" cy="58" r="1.6" fill="none" stroke="#00e5ff" stroke-width="0.35" class="node" />
      <circle cx="62" cy="30" r="1.6" fill="none" stroke="#00e5ff" stroke-width="0.35" class="node" />
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
  stroke: rgba(0, 255, 159, 0.16);
  stroke-width: 0.7;
  stroke-dasharray: 1.6 1.8;
  animation: trace-flow 2.4s linear infinite;
}
.trace.dim {
  stroke: rgba(0, 229, 255, 0.12);
  animation-duration: 3.2s;
}
/* 虚线流动 = 电流在导线里跑 */
@keyframes trace-flow {
  to { stroke-dashoffset: -3.4; }
}
/* 电流脉冲：短亮线沿走线循环流动 */
.pulse-bar {
  fill: none;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke: rgba(0, 255, 159, 0.85);
  stroke-dasharray: 1.2 150;
  filter: drop-shadow(0 0 3px #00ff9f);
  animation: pulse-travel 6s linear infinite;
}
.pulse-bar.cyan {
  stroke: rgba(0, 229, 255, 0.8);
  filter: drop-shadow(0 0 3px #00e5ff);
  animation-duration: 8s;
  animation-delay: -2s;
}
@keyframes pulse-travel {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -151.2; }
}
/* 光点：脉冲式亮灭（像示波器脉冲波） */
.pulse {
  filter: drop-shadow(0 0 2.5px #00ff9f);
}
.pulse.cyan {
  filter: drop-shadow(0 0 2.5px #00e5ff);
}
.node {
  animation: node-blink 2.4s ease-in-out infinite;
}
@keyframes node-blink {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
</style>
