<script setup>
// 背景电路走线 + 流动光点（电子元素动态效果）
// 用 SVG SMIL animateMotion 驱动光点沿走线流动，纯静态代码零 JS 成本
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
      <!-- 流动光点 -->
      <circle class="pulse" r="0.9" fill="#00ff9f">
        <animateMotion dur="9s" repeatCount="indefinite" path="M-2 18 H28 V42 H58 V68 H102" />
      </circle>
      <circle class="pulse cyan" r="0.7" fill="#00e5ff">
        <animateMotion dur="13s" repeatCount="indefinite" path="M-2 30 H16 V56 H44 V84 H102" />
      </circle>
      <circle class="pulse" r="0.8" fill="#00ff9f">
        <animateMotion dur="11s" repeatCount="indefinite" path="M-2 88 H30 V58 H62 V30 H102" />
      </circle>
      <circle class="pulse cyan" r="0.6" fill="#00e5ff">
        <animateMotion dur="15s" repeatCount="indefinite" path="M-2 74 H22 V46 H52 V14 H102" />
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
  z-index: -2;
  pointer-events: none;
  overflow: hidden;
}
.traces {
  width: 100%;
  height: 100%;
}
.trace {
  fill: none;
  stroke: rgba(0, 255, 159, 0.07);
  stroke-width: 0.5;
  stroke-dasharray: 1.6 1.8;
}
.trace.dim {
  stroke: rgba(0, 229, 255, 0.05);
}
.pulse {
  filter: drop-shadow(0 0 1.5px #00ff9f);
}
.pulse.cyan {
  filter: drop-shadow(0 0 1.5px #00e5ff);
}
.node {
  animation: node-blink 2.4s ease-in-out infinite;
}
@keyframes node-blink {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 1; }
}
</style>
