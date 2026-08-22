const smartCatCSS = `
/* 介绍区域样式 */
/* 详细说明展开区域样式 */
.expand-section {
    margin-top: 20px;
    border-top: 1px solid rgba(0,0,0,0.1);
    padding-top: 15px;
}

.expand-btn {
    width: 100%;
    padding: 12px 15px;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border: 1px solid #dee2e6;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    color: #495057;
    transition: all 0.3s ease;
}

.expand-btn:hover {
    background: linear-gradient(135deg, #e9ecef, #dee2e6);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.expand-icon {
    font-size: 16px;
    margin-right: 8px;
}

.expand-arrow {
    transition: transform 0.3s ease;
}

.expand-btn.expanded .expand-arrow {
    transform: rotate(180deg);
}

.detailed-explanation {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.5s ease;
    margin-top: 0;
}

.detailed-explanation.expanded {
    max-height: 600px;
    margin-top: 15px;
}

/* 详细内容样式 */
.detailed-content {
    background: white;
    border-radius: 8px;
    border: 1px solid #dee2e6;
    overflow: hidden;
}

.explanation-nav {
    display: flex;
    background: #f8f9fa;
    border-bottom: 1px solid #dee2e6;
}

.nav-btn {
    flex: 1;
    padding: 12px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: #6c757d;
    transition: all 0.3s ease;
    border-bottom: 2px solid transparent;
}

.nav-btn:hover {
    background: #e9ecef;
    color: #495057;
}

.nav-btn.active {
    color: #007bff;
    border-bottom-color: #007bff;
    background: white;
}

.explanation-content {
    padding: 20px;
    max-height: 500px;
    overflow-y: auto;
    font-size: 14px;
    line-height: 1.6;
    color: #495057;
}

.explanation-content h3 {
    color: #343a40;
    margin-top: 0;
    border-bottom: 1px solid #e9ecef;
    padding-bottom: 10px;
}

.explanation-content h4 {
    color: #495057;
    margin-top: 20px;
}

.explanation-content h5 {
    color: #6c757d;
    margin-top: 15px;
}

.explanation-content ul {
    padding-left: 20px;
    margin: 10px 0;
}

.explanation-content li {
    margin-bottom: 5px;
}

/* 心情维度样式 */
.mood-dimensions {
    display: grid;
    gap: 15px;
    margin: 15px 0;
}

.mood-dimension {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 4px solid #007bff;
}

.mood-example {
    margin-top: 10px;
    padding: 10px;
    background: #e9ecef;
    border-radius: 4px;
    font-size: 13px;
}

/* 记忆系统样式 */
.memory-levels {
    display: grid;
    gap: 15px;
    margin: 15px 0;
}

.memory-level {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
}

.memory-capacity, .memory-example {
    margin-top: 10px;
    padding: 8px;
    background: #e9ecef;
    border-radius: 4px;
    font-size: 13px;
}

/* 个性特质样式 */
.personality-traits, .personality-types {
    display: grid;
    gap: 15px;
    margin: 15px 0;
}

.trait-item, .personality-type {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
}

.trait-influence, .type-tip {
    margin-top: 10px;
    padding: 8px;
    background: #e9ecef;
    border-radius: 4px;
    font-size: 13px;
}

/* 互动方式样式 */
.interaction-methods, .interaction-tips, .usage-scenarios {
    display: grid;
    gap: 15px;
    margin: 15px 0;
}

.method-item, .tip-item, .scenario {
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
}

/* 响应式调整 */
@media (max-width: 768px) {
    .explanation-nav {
        flex-direction: column;
    }
    
    .nav-btn {
        text-align: left;
        padding: 10px 15px;
    }
    
    .mood-dimensions, .memory-levels, .personality-traits, 
    .personality-types, .interaction-methods, .interaction-tips, 
    .usage-scenarios {
        grid-template-columns: 1fr;
    }
}



.introduction-section {
    background: linear-gradient(135deg, rgba(255, 167, 38, 0.05), rgba(255, 167, 38, 0.02));
    border: 1px solid rgba(255, 167, 38, 0.1);
    border-radius: 12px;
    margin-bottom: 20px;
    padding: 16px;
}

.introduction-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.introduction-icon {
    font-size: 24px;
    flex-shrink: 0;
}

.introduction-text h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
}

.introduction-text p {
    margin: 0 0 8px 0;
    font-size: 13px;
    line-height: 1.5;
    color: #666;
}

.introduction-detail {
    font-size: 12px !important;
    color: #888 !important;
    font-style: italic;
}




/* 增强版小橘移动动画 - 更复杂的跑步和走路动画 */

/* 复杂跑步动画 - 8个关键帧模拟真实猫跑 */
@keyframes complexCatRunning {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  12.5% {
    transform: translateY(-12px) rotate(-8deg) scale(1.05);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  25% {
    transform: translateY(-5px) rotate(-5deg) scale(1.08);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  37.5% {
    transform: translateY(-15px) rotate(3deg) scale(1.06);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  50% {
    transform: translateY(-2px) rotate(5deg) scale(1.04);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  62.5% {
    transform: translateY(-10px) rotate(-3deg) scale(1.07);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  75% {
    transform: translateY(-7px) rotate(-2deg) scale(1.05);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  87.5% {
    transform: translateY(-13px) rotate(6deg) scale(1.09);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 复杂走路动画 - 模拟猫的优雅步态 */
@keyframes complexCatWalking {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  15% {
    transform: translateY(-4px) rotate(-3deg) scale(1.02);
    animation-timing-function: cubic-bezier(0.6, 0, 0.4, 1);
  }
  30% {
    transform: translateY(-2px) rotate(-1deg) scale(1.01);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  45% {
    transform: translateY(-5px) rotate(2deg) scale(1.03);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  60% {
    transform: translateY(-1px) rotate(1deg) scale(1.005);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  75% {
    transform: translateY(-3px) rotate(-2deg) scale(1.025);
    animation-timing-function: cubic-bezier(0.6, 0, 0.4, 1);
  }
  90% {
    transform: translateY(-2px) rotate(0deg) scale(1.015);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 复杂尾巴跑步动画 */
@keyframes complexTailRunning {
  0% {
    transform: rotate(0deg) scaleX(1) skewX(0deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  20% {
    transform: rotate(25deg) scaleX(1.2) skewX(5deg);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  40% {
    transform: rotate(-15deg) scaleX(0.9) skewX(-3deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  60% {
    transform: rotate(30deg) scaleX(1.3) skewX(8deg);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  80% {
    transform: rotate(-10deg) scaleX(0.95) skewX(-2deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  100% {
    transform: rotate(0deg) scaleX(1) skewX(0deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 复杂尾巴走路动画 */
@keyframes complexTailWalking {
  0% {
    transform: rotate(0deg) scaleX(1) skewX(0deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  25% {
    transform: rotate(12deg) scaleX(1.1) skewX(2deg);
    animation-timing-function: cubic-bezier(0.6, 0, 0.4, 1);
  }
  50% {
    transform: rotate(-8deg) scaleX(0.95) skewX(-1deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  75% {
    transform: rotate(15deg) scaleX(1.05) skewX(3deg);
    animation-timing-function: cubic-bezier(0.6, 0, 0.4, 1);
  }
  100% {
    transform: rotate(0deg) scaleX(1) skewX(0deg);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 复杂耳朵跑步动画 */
@keyframes complexEarRunning {
  0% {
    transform: rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  15% {
    transform: rotate(-10deg) scale(1.1);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  30% {
    transform: rotate(8deg) scale(1.05);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  45% {
    transform: rotate(-12deg) scale(1.15);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  60% {
    transform: rotate(5deg) scale(1.02);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  75% {
    transform: rotate(-8deg) scale(1.08);
    animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
  }
  90% {
    transform: rotate(3deg) scale(1.03);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  100% {
    transform: rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 复杂耳朵走路动画 */
@keyframes complexEarWalking {
  0% {
    transform: rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  33% {
    transform: rotate(-5deg) scale(1.05);
    animation-timing-function: cubic-bezier(0.6, 0, 0.4, 1);
  }
  66% {
    transform: rotate(4deg) scale(1.03);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
  100% {
    transform: rotate(0deg) scale(1);
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 眼睛跑步动画 - 模拟专注表情 */
@keyframes complexEyeRunning {
  0%, 100% {
    transform: scaleY(1);
    opacity: 1;
  }
  25% {
    transform: scaleY(0.8);
    opacity: 0.9;
  }
  50% {
    transform: scaleY(1.1);
    opacity: 1;
  }
  75% {
    transform: scaleY(0.9);
    opacity: 0.95;
  }
}

/* 眼睛走路动画 - 模拟悠闲表情 */
@keyframes complexEyeWalking {
  0%, 100% {
    transform: scaleY(1);
    opacity: 1;
  }
  50% {
    transform: scaleY(0.7);
    opacity: 0.8;
  }
}

/* 面部表情跑步动画 */
@keyframes complexFaceRunning {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-1px) scale(1.02);
  }
  50% {
    transform: translateY(1px) scale(0.98);
  }
  75% {
    transform: translateY(-2px) scale(1.03);
  }
}

/* 面部表情走路动画 */
@keyframes complexFaceWalking {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-1px) scale(1.01);
  }
}

/* 增强的灰尘特效 */
@keyframes enhancedRunningDust {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.5) rotate(0deg);
  }
  20% {
    opacity: 0.8;
    transform: translateX(-48%) scale(1.1) rotate(10deg);
  }
  40% {
    opacity: 0.6;
    transform: translateX(-52%) scale(1.2) rotate(-5deg);
  }
  60% {
    opacity: 0.4;
    transform: translateX(-49%) scale(1.05) rotate(15deg);
  }
  80% {
    opacity: 0.2;
    transform: translateX(-51%) scale(0.9) rotate(-10deg);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.5) rotate(0deg);
  }
}

@keyframes enhancedWalkingDust {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.3) rotate(0deg);
  }
  50% {
    opacity: 0.4;
    transform: translateX(-50%) scale(0.8) rotate(5deg);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.3) rotate(0deg);
  }
}

/* 移动时的光影效果 */
@keyframes runningLightEffect {
  0%, 100% {
    filter: brightness(1) contrast(1) saturate(1);
    box-shadow: 0 0 0 rgba(255, 255, 255, 0);
  }
  25% {
    filter: brightness(1.2) contrast(1.1) saturate(1.3);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }
  50% {
    filter: brightness(1.1) contrast(1.05) saturate(1.2);
    box-shadow: 0 0 5px rgba(255, 255, 255, 0.2);
  }
  75% {
    filter: brightness(1.3) contrast(1.15) saturate(1.4);
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
  }
}

@keyframes walkingLightEffect {
  0%, 100% {
    filter: brightness(1) contrast(1) saturate(1);
    box-shadow: 0 0 0 rgba(255, 255, 255, 0);
  }
  50% {
    filter: brightness(1.1) contrast(1.05) saturate(1.1);
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }
}

/* 应用增强动画 */
.cat-running .cat-body {
  animation: complexCatRunning 0.6s infinite, runningLightEffect 1.2s infinite !important;
}

.cat-walking .cat-body {
  animation: complexCatWalking 1.2s infinite, walkingLightEffect 2.4s infinite !important;
}

.cat-running .cat-tail {
  animation: complexTailRunning 0.8s infinite !important;
}

.cat-walking .cat-tail {
  animation: complexTailWalking 1.6s infinite !important;
}

.cat-running .cat-ear {
  animation: complexEarRunning 0.7s infinite !important;
}

.cat-walking .cat-ear {
  animation: complexEarWalking 1.4s infinite !important;
}

.cat-running .cat-eye {
  animation: complexEyeRunning 0.9s infinite !important;
}

.cat-walking .cat-eye {
  animation: complexEyeWalking 1.8s infinite !important;
}

.cat-running .cat-face {
  animation: complexFaceRunning 0.5s infinite !important;
}

.cat-walking .cat-face {
  animation: complexFaceWalking 1.3s infinite !important;
}

/* 增强灰尘特效 */
.cat-running::before {
  animation: enhancedRunningDust 0.6s infinite !important;
  width: 40px;
  height: 8px;
  background: radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 80%);
}

.cat-walking::before {
  animation: enhancedWalkingDust 1.2s infinite !important;
  width: 25px;
  height: 4px;
  background: radial-gradient(ellipse, rgba(255,255,255,0.4) 0%, transparent 80%);
}

/* 添加移动轨迹效果 */
.cat-running::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 35px;
  height: 6px;
  background: radial-gradient(ellipse, rgba(255,165,0,0.3) 0%, transparent 70%);
  animation: runningTrail 0.6s infinite;
  border-radius: 50%;
  filter: blur(2px);
}

.cat-walking::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: radial-gradient(ellipse, rgba(255,165,0,0.2) 0%, transparent 70%);
  animation: walkingTrail 1.2s infinite;
  border-radius: 50%;
  filter: blur(1px);
}

@keyframes runningTrail {
  0% { opacity: 0; transform: translateX(-50%) scale(0.8); }
  50% { opacity: 0.7; transform: translateX(-50%) scale(1.1); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.8); }
}

@keyframes walkingTrail {
  0% { opacity: 0; transform: translateX(-50%) scale(0.6); }
  50% { opacity: 0.4; transform: translateX(-50%) scale(0.9); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.6); }
}
  
@keyframes voiceIndicatorPulse {
    0% { 
        transform: translateX(-50%) scale(1);
        box-shadow: 
            0 0 0 2px rgba(255, 107, 107, 0.3),
            0 0 10px 4px rgba(255, 107, 107, 0.2);
    }
    50% { 
        transform: translateX(-50%) scale(1.2);
        box-shadow: 
            0 0 0 3px rgba(255, 107, 107, 0.4),
            0 0 15px 6px rgba(255, 107, 107, 0.3);
    }
    100% { 
        transform: translateX(-50%) scale(1);
        box-shadow: 
            0 0 0 2px rgba(255, 107, 107, 0.3),
            0 0 10px 4px rgba(255, 107, 107, 0.2);
  }
}

@keyframes voiceIndicatorAppear {
    0% { 
        opacity: 0;
        transform: translateX(-50%) scale(0.8);
    }
    100% { 
        opacity: 1;
        transform: translateX(-50%) scale(1);
    }
}

@keyframes voiceIndicatorDisappear {
    0% { 
        opacity: 1;
        transform: translateX(-50%) scale(1);
    }
    100% { 
        opacity: 0;
        transform: translateX(-50%) scale(0.8);
    }
}

#voice-recognition-indicator.active {
    animation: 
        voiceIndicatorAppear 0.3s ease forwards,
        voiceIndicatorPulse 1.5s ease-in-out infinite 0.3s;
}

#voice-recognition-indicator:not(.active) {
    animation: voiceIndicatorDisappear 0.3s ease forwards;
}


/* 心跳动画 */
@keyframes heartbeat {
  0% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(1); }
  75% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.cat-body {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.thinking-indicator {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4caf50;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 100001;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3), 0 0 10px 4px rgba(76, 175, 80, 0.2);
}

.thinking-indicator.active {
  opacity: 1;
  animation: thinkingPulse 1.5s ease-in-out infinite;
}

@keyframes thinkingPulse {
  0% {
    transform: translateX(-50%) scale(1);
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3), 0 0 10px 4px rgba(76, 175, 80, 0.2);
  }
  50% {
    transform: translateX(-50%) scale(1.2);
    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.4), 0 0 15px 6px rgba(76, 175, 80, 0.3);
  }
  100% {
    transform: translateX(-50%) scale(1);
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3), 0 0 10px 4px rgba(76, 175, 80, 0.2);
  }
}

@keyframes thinkingIndicatorAppear {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.8);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

@keyframes thinkingIndicatorDisappear {
  0% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.8);
  }
}

.thinking-indicator.active {
  animation: thinkingIndicatorAppear 0.3s ease forwards, thinkingPulse 1.5s ease-in-out infinite 0.3s;
}

.thinking-indicator:not(.active) {
  animation: thinkingIndicatorDisappear 0.3s ease forwards;
}

.panel-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  z-index: 10001;
  display: none;
}
/* 基础动作动画 */
@keyframes breathing {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

@keyframes gentleSway {
  0%,
  100% {
    transform: translateX(0) rotate(0deg);
  }
  25% {
    transform: translateX(2px) rotate(1deg);
  }
  75% {
    transform: translateX(-2px) rotate(-1deg);
  }
}

@keyframes curiousLook {
  0%,
  100% {
    transform: translateX(0) scale(1);
  }
  50% {
    transform: translateX(3px) scale(1.03);
  }
}

@keyframes playfulHop {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  30% {
    transform: translateY(-12px) scale(0.95);
  }
  60% {
    transform: translateY(-4px) scale(1.02);
  }
}

@keyframes contentStretch {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.05) rotate(2deg);
  }
  75% {
    transform: scale(1.03) rotate(-1deg);
  }
}

@keyframes excitedWiggle {
  0%,
  100% {
    transform: translateX(0) rotate(0deg);
  }
  20% {
    transform: translateX(-3px) rotate(-3deg);
  }
  40% {
    transform: translateX(2px) rotate(2deg);
  }
  60% {
    transform: translateX(-2px) rotate(-2deg);
  }
  80% {
    transform: translateX(1px) rotate(1deg);
  }
}

/* 耳朵动画 */
@keyframes earFlickLeft {
  0%,
  100% {
    transform: rotate(-15deg) scale(1);
  }
  50% {
    transform: rotate(-25deg) scale(1.1);
  }
}

@keyframes earFlickRight {
  0%,
  100% {
    transform: rotate(15deg) scale(1);
  }
  50% {
    transform: rotate(25deg) scale(1.1);
  }
}

@keyframes earsTwitch {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-1px) rotate(-2deg);
  }
  75% {
    transform: translateY(1px) rotate(2deg);
  }
}

/* 尾巴动画 */
@keyframes tailFlick {
  0%,
  100% {
    transform: rotate(0deg) scaleX(1);
  }
  25% {
    transform: rotate(15deg) scaleX(1.1);
  }
  75% {
    transform: rotate(-10deg) scaleX(0.9);
  }
}

@keyframes tailSwish {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(25deg);
  }
  50% {
    transform: rotate(-15deg);
  }
  75% {
    transform: rotate(10deg);
  }
}

@keyframes tailWagHappy {
  0%,
  100% {
    transform: rotate(0deg);
  }
  33% {
    transform: rotate(20deg);
  }
  66% {
    transform: rotate(-15deg);
  }
}

/* 眼睛动画 */
@keyframes blinkSlow {
  0%,
  90% {
    transform: scaleY(1);
    opacity: 1;
  }
  95% {
    transform: scaleY(0.1);
    opacity: 0.3;
  }
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
}

@keyframes blinkQuick {
  0%,
  85% {
    transform: scaleY(1);
  }
  87%,
  93% {
    transform: scaleY(0.05);
  }
  95%,
  100% {
    transform: scaleY(1);
  }
}

@keyframes eyesSparkle {
  0%,
  100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.8;
    filter: brightness(1.5);
  }
}

@keyframes eyesWiden {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}

/* 整体动作动画 */
@keyframes happyBounce {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-8px) scale(1.05);
  }
  50% {
    transform: translateY(-4px) scale(1.02);
  }
  75% {
    transform: translateY(-6px) scale(1.03);
  }
}

@keyframes curiousTilt {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }
  25% {
    transform: rotate(5deg) scale(1.02);
  }
  75% {
    transform: rotate(-3deg) scale(1.01);
  }
}

@keyframes sleepySway {
  0%,
  100% {
    transform: translateX(0) rotate(0deg);
  }
  50% {
    transform: translateX(3px) rotate(2deg);
  }
}

@keyframes excitedVibrate {
  0%,
  100% {
    transform: translateX(0);
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-1px);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(1px);
  }
}

@keyframes attentionPulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(255, 215, 0, 0.1);
  }
}

/* 高级特效动画 */
@keyframes glowEffect {
  0%,
  100% {
    filter: brightness(1) drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
  }
  50% {
    filter: brightness(1.2) drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
  }
}

@keyframes floatGracefully {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-10px) rotate(2deg) scale(1.02);
  }
  50% {
    transform: translateY(-5px) rotate(-1deg) scale(1.01);
  }
  75% {
    transform: translateY(-8px) rotate(1deg) scale(1.015);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

/* 特殊场合动画 */
@keyframes celebrationDance {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  20% {
    transform: translateY(-15px) rotate(-10deg) scale(1.1);
  }
  40% {
    transform: translateY(-5px) rotate(10deg) scale(1.05);
  }
  60% {
    transform: translateY(-10px) rotate(-5deg) scale(1.08);
  }
  80% {
    transform: translateY(-3px) rotate(5deg) scale(1.03);
  }
}

@keyframes greetingBow {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(5px) scale(0.95);
  }
}

@keyframes surpriseJump {
  0%,
  60%,
  100% {
    transform: translateY(0) scale(1);
  }
  30% {
    transform: translateY(-25px) scale(1.1);
  }
}

.slider-container {
  margin: 15px 0;
}

.slider-value {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 5px;
}

.input-field[type='range'] {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
}

.input-field[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007acc;
  cursor: pointer;
}

.input-field[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #007acc;
  cursor: pointer;
  border: none;
}
/* 语音状态指示器 */
.voice-status {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  transition: all 0.3s ease;
  z-index: 100001;
}

.voice-status.active {
  background: #4caf50;
  animation: gentlePulse 1.5s infinite;
}

@keyframes gentlePulse {
  0%,
  100% {
    opacity: 0.7;
    transform: translateX(-50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateX(-50%) scale(1.2);
  }
}
/* 语音识别指示器 */
.voice-indicator {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ff4444;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 100001;
}

.voice-indicator.listening {
  opacity: 1;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    transform: translateX(-50%) scale(1);
  }
  50% {
    transform: translateX(-50%) scale(1.2);
  }
  100% {
    transform: translateX(-50%) scale(1);
  }
}

.voice-indicator.recognizing {
  background: #44ff44;
  animation: pulse 0.5s infinite;
}

/* 语音反馈气泡 */
.voice-feedback {
  position: absolute;
  bottom: 65px;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  color: #2c3e50;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  max-width: 200px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 10001;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
  pointer-events: none;
}

.voice-feedback.show {
  opacity: 1;
  transform: translateY(0);
}
.appearance-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr); /* 改为5列以适应更多皮肤 */
  gap: 10px; /* 稍微减小间隙 */
  margin-bottom: 20px;
}

.appearance-option {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px; /* 稍微减小圆角 */
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

/* 小橘基础样式 - 极简风格 */
.cat-body {
  width: 50px;
  height: 40px;
  border-radius: 25px 25px 15px 15px;
  position: relative;
  animation: catFloat 4s ease-in-out infinite;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

@keyframes catFloat {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-5px) scale(1.02);
  }
}

.cat-ear {
  position: absolute;
  top: -6px;
  width: 10px;
  height: 12px;
  border-radius: 50%;
}

.cat-ear-left {
  left: 10px;
  transform: rotate(-15deg);
}
.cat-ear-right {
  right: 10px;
  transform: rotate(15deg);
}

.cat-face {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
}

.cat-eye {
  position: absolute;
  width: 5px;
  height: 7px;
  background: #2c3e50;
  border-radius: 50%;
  top: 4px;
}

.cat-eye-left {
  left: 12px;
}
.cat-eye-right {
  right: 12px;
}

.cat-nose {
  position: absolute;
  width: 3px;
  height: 2px;
  background: #e84393;
  border-radius: 50%;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
}

.cat-tail {
  position: absolute;
  right: -12px;
  bottom: 8px;
  width: 15px;
  height: 4px;
  border-radius: 2px;
  transform-origin: left center;
  animation: tailSway 3s ease-in-out infinite;
}

@keyframes tailSway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

/* 气泡样式 - 极简毛玻璃效果 */
.cat-bubble {
  position: absolute;
  bottom: 65px;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  color: #2c3e50;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 13px;
  max-width: 300px;
  min-width: 175px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  z-index: 10001;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
  opacity: 0;
  transform: translateY(10px) scale(0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  line-height: 1.4;
  word-wrap: break-word;
}

.cat-bubble.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.cat-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  right: 12px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid rgba(255, 255, 255, 0.95);
}

/* 设置面板样式 - 极简毛玻璃 */
.settings-panel,
.chat-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 85vw !important;
  max-width: 320px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(40px);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  z-index: 10002;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
  display: none;
  overflow: hidden;
}

.chat-panel {
  max-width: 350px;
  height: 60vh;
  max-height: 500px;
  display: none;
  flex-direction: column;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
}

.panel-title {
  font-weight: 600;
  font-size: 16px;
  color: #2f3f4fff;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.panel-content {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.section {
  margin-bottom: 25px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 12px;
}

/* 外观选择网格 */
.appearance-option.selected {
  border-color: #007acc;
  transform: scale(1.05);
}

.appearance-option::after {
  content: '✓';
  position: absolute;
  top: -5px;
  right: -5px;
  background: #007acc;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.appearance-option.selected::after {
  opacity: 1;
}

/* 性格选择列表 */
.personality-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.personality-option {
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
}

.personality-option.selected {
  border-color: #007acc;
  background: rgba(0, 122, 204, 0.05);
}

.personality-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.personality-desc {
  font-size: 12px;
  color: #666;
}

/* 输入和滑块 */
.input-field {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 13px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

.input-field:focus {
  outline: none;
  border-color: #007acc;
}

.slider-container {
  margin: 15px 0;
}

.slider-value {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 5px;
}

.save-btn {
  width: 100%;
  padding: 14px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  backdrop-filter: blur(10px);
}

.save-btn:hover {
  background: #005a9e;
}

/* 聊天界面样式 */
.chat-messages {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  backdrop-filter: blur(10px);
}

.user-message {
  background: rgba(0, 122, 204, 0.9);
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.cat-message {
  background: rgba(0, 0, 0, 0.05);
  color: #2c3e50;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.chat-input-area {
  padding: 15px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 10px;
  background: rgba(255, 255, 255, 0.8);
}

.chat-input {
  flex: 1;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 20px;
  font-size: 13px;
  outline: none;
  resize: none;
  max-height: 80px;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
}

.send-btn {
  background: #007acc;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: background 0.2s;
  backdrop-filter: blur(10px);
}

.send-btn:hover {
  background: #005a9e;
}

/* 移动端优化 */
@media (max-width: 768px) {
  #smart-companion-cat {
    width: 70px;
    height: 70px;
  }

  .cat-body {
    width: 60px;
    height: 48px;
  }

  .cat-bubble {
    max-width: 280px;
    font-size: 12px;
  }

  .settings-panel,
  .chat-panel {
    width: 95vw;
    max-width: none;
  }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .cat-bubble,
  .settings-panel,
  .chat-panel {
    background: rgba(30, 30, 30, 0.95);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .panel-header {
    background: rgba(30, 30, 30, 0.8);
  }

  .input-field,
  .chat-input {
    background: rgba(50, 50, 50, 0.8);
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .cat-message {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  .close-btn {
    color: #cccccc;
  }

  /* 多气泡容器样式 */
  .cat-bubbles-container {
    position: absolute;
    bottom: 65px;
    right: 0;
    z-index: 10001;
    display: flex;
    flex-direction: column-reverse; /* 新气泡在底部，旧气泡往上推 */
    align-items: flex-end;
    gap: 8px; /* 气泡间距 */
    pointer-events: none;
    max-height: 200px; /* 限制最大高度，避免无限向上 */
    overflow: hidden;
  }

  /* 单个气泡样式 - 修改为相对定位 */
  .cat-bubble {
    position: relative; /* 改为相对定位，由容器控制布局 */
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    color: #2c3e50;
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 13px;
    max-width: 300px;
    min-width: 175px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    line-height: 1.4;
    word-wrap: break-word;
    /* 移除之前的绝对定位属性 */
    right: auto;
    bottom: auto;
  }

  .cat-bubble.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .cat-bubble.hide {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 气泡箭头调整到右下角 */
  .cat-bubble::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 12px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid rgba(255, 255, 255, 0.95);
  }

  /* 气泡进入动画 */
  @keyframes bubbleSlideUp {
    0% {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .cat-bubble.show {
    animation: bubbleSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
  /* 多气泡容器样式 - 修改为从下往上排列 */
  .cat-bubbles-container {
    position: absolute;
    bottom: 65px; /* 从底部开始 */
    right: 0;
    z-index: 10001;
    display: flex;
    flex-direction: column; /* 改为正常列布局 */
    align-items: flex-end;
    justify-content: flex-end; /* 从底部开始对齐 */
    gap: 8px;
    pointer-events: none;
    max-height: 300px; /* 增加最大高度 */
    overflow: visible; /* 改为visible，让气泡可以显示在容器外 */
    padding-bottom: 0;
  }

  /* 单个气泡样式 - 添加底部间距动画 */
  .cat-bubble {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    color: #2c3e50;
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 13px;
    max-width: 300px;
    min-width: 175px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui;
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    line-height: 1.4;
    word-wrap: break-word;
    position: relative; /* 相对定位 */
    margin-bottom: 0; /* 初始无间距 */
    transition: all 0.3s ease; /* 添加过渡效果 */
  }

  .cat-bubble.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .cat-bubble.hide {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 气泡箭头 */
  .cat-bubble::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 12px;
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid rgba(255, 255, 255, 0.95);
  }

  /* 气泡进入动画 - 从下方滑入 */
  @keyframes bubbleSlideIn {
    0% {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .cat-bubble.show {
    animation: bubbleSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  /* 气泡向上推动动画 */
  @keyframes bubblePushUp {
    0% {
      margin-bottom: 0;
    }
    100% {
      margin-bottom: 60px; /* 气泡高度 + 间距 */
    }
  }

  /* 当有新气泡时，为旧气泡添加上推动画 */
  .cat-bubble.push-up {
    animation: bubblePushUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }
}

/* 霓虹灯动画 */
@keyframes neonPulse {
  0% {
    box-shadow: 0 0 20px #00ffff, 0 0 40px #ff00ff, 0 0 60px #00ffff;
    filter: brightness(1);
  }
  100% {
    box-shadow: 0 0 30px #00ffff, 0 0 60px #ff00ff, 0 0 90px #00ffff;
    filter: brightness(1.2);
  }
}

@keyframes neonTail {
  0%,
  100% {
    transform: rotate(0deg) scaleX(1);
  }
  50% {
    transform: rotate(20deg) scaleX(1.1);
  }
}

/* 银河星空动画 */
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@keyframes galaxyTail {
  0%,
  100% {
    background: linear-gradient(90deg, #533483, #e94560);
    transform: rotate(0deg);
  }
  50% {
    background: linear-gradient(90deg, #e94560, #533483);
    transform: rotate(15deg);
  }
}

/* 液态金属动画 */
@keyframes liquidFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes shine {
  0% {
    transform: translateX(-100%) rotate(45deg);
  }
  100% {
    transform: translateX(200%) rotate(45deg);
  }
}

@keyframes metalTail {
  0%,
  100% {
    transform: rotate(0deg) scaleY(1);
  }
  50% {
    transform: rotate(10deg) scaleY(1.2);
  }
}

/* 火焰动画 */
@keyframes fireBurn {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes emberFloat {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-5px) scale(1.1);
  }
}

@keyframes fireTail {
  0%,
  100% {
    background: linear-gradient(90deg, #ff6b35, #ff4500);
    transform: rotate(0deg);
  }
  50% {
    background: linear-gradient(90deg, #ff4500, #ff6b35);
    transform: rotate(20deg);
  }
}

/* 水晶效果动画 */
@keyframes crystalShine {
  0% {
    transform: translateX(-100%) skewX(-15deg);
  }
  100% {
    transform: translateX(200%) skewX(-15deg);
  }
}

@keyframes crystalTail {
  0%,
  100% {
    opacity: 0.7;
    transform: rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: rotate(10deg);
  }
}

/* 赛博朋克动画 */
@keyframes cyberGlitch {
  0%,
  100% {
    background-position: 0% 50%;
    filter: hue-rotate(0deg);
  }
  50% {
    background-position: 100% 50%;
    filter: hue-rotate(180deg);
  }
}

@keyframes gridScan {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(100%);
  }
}

@keyframes cyberTail {
  0%,
  100% {
    background: linear-gradient(90deg, #00ff88, #0088ff);
    transform: rotate(0deg);
  }
  50% {
    background: linear-gradient(90deg, #0088ff, #00ff88);
    transform: rotate(15deg);
  }
}

/* 彩虹动画 */
@keyframes rainbowFlow {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes rainbowTail {
  0%,
  100% {
    background: linear-gradient(90deg, #ff6b6b, #4ecdc4);
    transform: rotate(0deg);
  }
  50% {
    background: linear-gradient(90deg, #4ecdc4, #ff6b6b);
    transform: rotate(20deg);
  }
}

/* 全息投影动画 */
@keyframes hologramScan {
  0% {
    left: -100%;
  }
  50% {
    left: 100%;
  }
  100% {
    left: 100%;
  }
}

@keyframes hologramTail {
  0%,
  100% {
    opacity: 0.7;
    transform: rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: rotate(10deg);
  }
}

/* 高级皮肤的特殊样式 */
.skin-neon .cat-body {
  animation: neonPulse 2s ease-in-out infinite alternate;
}

.skin-galaxy .cat-body::after {
  animation: twinkle 8s linear infinite;
}

.skin-liquidMetal .cat-body {
  animation: liquidFlow 6s ease-in-out infinite;
}

.skin-fire .cat-body {
  animation: fireBurn 4s ease-in-out infinite;
}

.skin-crystal .cat-body::before {
  animation: crystalShine 6s ease-in-out infinite;
}

.skin-cyberpunk .cat-body {
  animation: cyberGlitch 5s ease-in-out infinite;
}

.skin-rainbow .cat-body {
  animation: rainbowFlow 8s ease-in-out infinite;
}

.skin-hologram .cat-body::after {
  animation: hologramScan 3s ease-in-out infinite;
}

/* ========== 基础动作关键帧 ========== */
@keyframes gentleNod {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-2px) rotate(1deg);
  }
}

@keyframes quickBlink {
  0%,
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
  50% {
    transform: scaleY(0.1);
    opacity: 0.3;
  }
}

@keyframes earTwitch {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(5deg);
  }
}

@keyframes tailFlick {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(10deg);
  }
}

@keyframes bodyShiver {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-1px);
  }
  75% {
    transform: translateX(1px);
  }
}

@keyframes headTilt {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(8deg);
  }
}

@keyframes bodyStretch {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

@keyframes pawLift {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes squintSmile {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.7);
  }
}

@keyframes earsBack {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-10deg);
  }
}

@keyframes tailCurl {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(15deg);
  }
}

@keyframes bodySway {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(3px);
  }
}

/* ========== 卖萌动作关键帧 ========== */
@keyframes cuteHeadTilt {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(12deg) scale(1.02);
  }
}

@keyframes cuteBlink {
  0%,
  100% {
    transform: scaleY(1);
    opacity: 1;
  }
  30%,
  70% {
    transform: scaleY(0.05);
    opacity: 0.2;
  }
}

@keyframes earFlutter {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-5deg);
  }
  75% {
    transform: rotate(5deg);
  }
}

@keyframes tailCircle {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes bodyWiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-3deg);
  }
  75% {
    transform: rotate(3deg);
  }
}

@keyframes faceWash {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(2px) rotate(2deg);
  }
}

@keyframes cuteRoll {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(10deg);
  }
}

@keyframes cuteEarTwitch {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(8deg) scale(1.1);
  }
}

@keyframes cuteTailWag {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(12deg);
  }
  75% {
    transform: rotate(-8deg);
  }
}

@keyframes cuteSquint {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.5);
  }
}

@keyframes bodyCurling {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.95);
  }
}

@keyframes pawPat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

/* ========== 活泼动作关键帧 ========== */
@keyframes excitedJump {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes fastTailWag {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(15deg);
  }
  75% {
    transform: rotate(-12deg);
  }
}

@keyframes earsPerk {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-8deg) scale(1.1);
  }
}

@keyframes bodyBounce {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@keyframes tailSwish {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(20deg);
  }
  75% {
    transform: rotate(-15deg);
  }
}

@keyframes fastEarTwitch {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

@keyframes bodyHop {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}

@keyframes excitedTailWag {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(18deg);
  }
  75% {
    transform: rotate(-15deg);
  }
}

@keyframes excitedEarTwitch {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(10deg) scale(1.2);
  }
}

@keyframes fastBodyWiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-4deg);
  }
  75% {
    transform: rotate(4deg);
  }
}

@keyframes fastTailCurl {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

@keyframes excitedShiver {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
}

/* ========== 优雅动作关键帧 ========== */
@keyframes elegantTurn {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(15deg);
  }
}

@keyframes elegantTailSway {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(12deg);
  }
}

@keyframes elegantEarTwitch {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

@keyframes elegantStretch {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

@keyframes elegantTailCurl {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(18deg);
  }
}

@keyframes elegantEarsBack {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-12deg);
  }
}

@keyframes elegantBodySway {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

@keyframes elegantTailFlick {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(10deg);
  }
}

@keyframes elegantEarsPerk {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-10deg);
  }
}

@keyframes elegantSpin {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(20deg);
  }
}

@keyframes elegantTailWave {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(15deg);
  }
  75% {
    transform: rotate(-12deg);
  }
}

@keyframes elegantBow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(5px) scale(0.98);
  }
}

/* ========== 搞笑动作关键帧 ========== */
@keyframes funnyFall {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(25deg);
  }
}

@keyframes tailTangle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(30deg);
  }
}

@keyframes earCramp {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(15deg);
  }
  75% {
    transform: rotate(-10deg);
  }
}

@keyframes funnyWiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-8deg);
  }
  75% {
    transform: rotate(8deg);
  }
}

@keyframes funnyTailWag {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(25deg);
  }
  75% {
    transform: rotate(-20deg);
  }
}

@keyframes funnyEarTwitch {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(12deg) scale(1.3);
  }
}

@keyframes funnyJump {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes funnyTailCurl {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(25deg);
  }
}

@keyframes funnyEarsPerk {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(-15deg);
  }
}

@keyframes funnySpin {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(30deg);
  }
}

@keyframes funnyTailWave {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(20deg);
  }
  75% {
    transform: rotate(-18deg);
  }
}

@keyframes funnyBow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(8px) scale(0.95);
  }
}

/* ========== 特殊效果关键帧 ========== */
@keyframes starTwinkle {
  0%,
  100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.7;
    filter: brightness(1.5);
  }
}

@keyframes rainbowHalo {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.3);
  }
  25% {
    box-shadow: 0 0 0 10px rgba(255, 165, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 0 20px rgba(255, 255, 0, 0.3);
  }
  75% {
    box-shadow: 0 0 0 30px rgba(0, 255, 0, 0.3);
  }
}

@keyframes bubbleFloat {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-5px) scale(1.05);
  }
}

@keyframes heartFloat {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

@keyframes snowFall {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(3px) rotate(180deg);
  }
}

@keyframes petalShower {
  0%,
  100% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(10deg) scale(1.1);
  }
}

@keyframes flashEffect {
  0%,
  100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(2);
  }
}

@keyframes colorShift {
  0%,
  100% {
    filter: hue-rotate(0deg);
  }
  50% {
    filter: hue-rotate(180deg);
  }
}

@keyframes shadowClone {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(0, 0, 0, 0.2);
  }
}

@keyframes transparentEffect {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes scalePulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

@keyframes spinEffect {
  0%,
  100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(15deg);
  }
}

/* ========== 增强的动画效果 ========== */
.smart-cat-animated {
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
  animation-fill-mode: both !important;
}

/* 为不同心情状态添加特殊效果 */
.mood-happy .cat-body {
  animation-duration: 4s !important;
}

.mood-excited .cat-body {
  animation-duration: 2s !important;
}

.mood-playful .cat-body {
  animation-duration: 3s !important;
}

.mood-curious .cat-body {
  animation-duration: 5s !important;
}

.mood-sleepy .cat-body {
  animation-duration: 8s !important;
}

/* 小橘移动动画 */
@keyframes catWalking {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-3px) rotate(-2deg) scale(1.02);
  }
  50% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  75% {
    transform: translateY(-3px) rotate(2deg) scale(1.02);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
}

@keyframes catRunning {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  25% {
    transform: translateY(-8px) rotate(-5deg) scale(1.05);
  }
  50% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  75% {
    transform: translateY(-8px) rotate(5deg) scale(1.05);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
}

@keyframes tailWalking {
  0% {
    transform: rotate(0deg) scaleX(1);
  }
  50% {
    transform: rotate(15deg) scaleX(1.1);
  }
  100% {
    transform: rotate(0deg) scaleX(1);
  }
}

@keyframes tailRunning {
  0% {
    transform: rotate(0deg) scaleX(1);
  }
  25% {
    transform: rotate(25deg) scaleX(1.2);
  }
  50% {
    transform: rotate(0deg) scaleX(1);
  }
  75% {
    transform: rotate(-20deg) scaleX(1.15);
  }
  100% {
    transform: rotate(0deg) scaleX(1);
  }
}

/* 移动状态样式 */
.cat-running .cat-body {
  filter: brightness(1.1);
}

.cat-walking .cat-body {
  filter: brightness(1.05);
}

/* 移动时的特效 */
.cat-running::before {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 5px;
  background: radial-gradient(ellipse, rgba(255,255,255,0.3) 0%, transparent 70%);
  animation: runningDust 0.3s infinite;
}

.cat-walking::before {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: radial-gradient(ellipse, rgba(255,255,255,0.2) 0%, transparent 70%);
  animation: walkingDust 0.8s infinite;
}

@keyframes runningDust {
  0%, 100% { opacity: 0; transform: translateX(-50%) scale(0.8); }
  50% { opacity: 1; transform: translateX(-50%) scale(1); }
}

@keyframes walkingDust {
  0%, 100% { opacity: 0; transform: translateX(-50%) scale(0.8); }
  50% { opacity: 0.5; transform: translateX(-50%) scale(1); }
}

/* 移动时的耳朵动画 */
.cat-running .cat-ear {
  animation: runningEars 0.3s infinite alternate;
}

.cat-walking .cat-ear {
  animation: walkingEars 0.8s infinite alternate;
}

@keyframes runningEars {
  0% { transform: rotate(0deg) scale(1); }
  100% { transform: rotate(5deg) scale(1.1); }
}

@keyframes walkingEars {
  0% { transform: rotate(0deg) scale(1); }
  100% { transform: rotate(3deg) scale(1.05); }
}

`

function setupSmartCatCSS() {
  if (document.getElementById('smart-cat-styles')) return

  const style = document.createElement('style')
  style.id = 'smart-cat-styles'
  style.textContent = smartCatCSS
  document.head.appendChild(style)
}

module.exports = async params => {
  setupSmartCatCSS()
}
