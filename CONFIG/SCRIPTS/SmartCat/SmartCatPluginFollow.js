// 简洁版小橘动画脚本
let isMoving = false;
let originalPosition = { x: 50, y: 100 }; // 使用百分比定位
let lastPetTime = Date.now();
let idleCheckInterval;

// 获取小橘容器和消息函数
const catContainer = document.getElementById('smart-companion-cat');
const getSmartCatMessage = window.smartCat?.getSmartCatMessage || (() => "小橘回来了！");
const showBubble = window.smartCat?.showBubble || ((msg) => console.log(msg));

// 初始化函数
function initSmartCat() {
    // 设置初始位置（屏幕底部中央）
    setCatPosition(50, 100);
    
    // 开始空闲检测
    startIdleCheck();
    
    // 绑定点击事件
    catContainer.addEventListener('click', handleCatClick);
}

// 设置猫咪位置（百分比）
function setCatPosition(xPercent, yPercent) {
    catContainer.style.left = xPercent + '%';
    catContainer.style.top = yPercent + '%';
    catContainer.style.transform = 'translate(-50%, -50%)'; // 居中定位
}

// 处理点击事件
function handleCatClick(e) {
    lastPetTime = Date.now();
    if (isMoving) stopMoving();
}

// 开始空闲检测
function startIdleCheck() {
    // 记录初始位置
    originalPosition = { x: 50, y: 100 };
    
    // 每30秒检查一次空闲状态
    idleCheckInterval = setInterval(() => {
        const now = Date.now();
        const idleTime = 30 * 60 * 1000; // 30分钟
        
        if (now - lastPetTime >= idleTime && !isMoving) {
            triggerCatMovement();
        }
    }, 30000);
}

// 停止移动
function stopMoving() {
    isMoving = false;
    catContainer.style.transition = 'none';
    removeMoveAnimation();
}

// 移除移动动画
function removeMoveAnimation() {
    catContainer.classList.remove('cat-running', 'cat-walking');
}

// 触发猫咪移动
function triggerCatMovement() {
    if (isMoving) return;
    
    isMoving = true;
    
    // 获取鼠标位置（转换为百分比）
    const mouseX = (window.mousePosition?.x || window.innerWidth / 2) / window.innerWidth * 100;
    const mouseY = (window.mousePosition?.y || window.innerHeight / 2) / window.innerHeight * 100;
    
    // 在鼠标位置附近随机偏移
    const offset = 5 + Math.random() * 10;
    const randomAngle = Math.random() * Math.PI * 2;
    const targetX = mouseX + Math.cos(randomAngle) * offset;
    const targetY = mouseY + Math.sin(randomAngle) * offset;
    
    // 确保位置在屏幕内
    const safeX = Math.max(5, Math.min(95, targetX));
    const safeY = Math.max(5, Math.min(95, targetY));
    
    moveCatTo(safeX, safeY);
}

// 移动到目标位置
function moveCatTo(targetX, targetY) {
    const currentX = parseFloat(catContainer.style.left);
    const currentY = parseFloat(catContainer.style.top);
    
    const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
    const duration = Math.max(2000, Math.min(5000, distance * 50));
    
    // 根据距离选择动画类型
    const moveType = distance > 10 ? 'run' : 'walk';
    catContainer.classList.add('cat-' + moveType);
    
    // 使用平滑过渡
    catContainer.style.transition = `left ${duration}ms ease-out, top ${duration}ms ease-out`;
    setCatPosition(targetX, targetY);
    
    // 移动完成后
    setTimeout(() => {
        removeMoveAnimation();
        showBubble(getSmartCatMessage('LITTLE_ORANGE_COMPLAINTS'));
        lastPetTime = Date.now();
        isMoving = false;
        
        // 3秒后返回原位置
        setTimeout(() => {
            if (!isMoving) returnToOriginalPosition();
        }, 3000);
    }, duration);
}

// 返回原始位置
function returnToOriginalPosition() {
    if (isMoving) return;
    
    isMoving = true;
    catContainer.classList.add('cat-walking');
    
    const returnDuration = 4000; // 4秒返回时间
    catContainer.style.transition = `left ${returnDuration}ms ease-in-out, top ${returnDuration}ms ease-in-out`;
    setCatPosition(originalPosition.x, originalPosition.y);
    
    setTimeout(() => {
        removeMoveAnimation();
        isMoving = false;
        
        // 最终位置修正
        setTimeout(() => {
            setCatPosition(originalPosition.x, originalPosition.y);
        }, 100);
    }, returnDuration);
}

// 鼠标位置追踪（简化版）
window.mousePosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
document.addEventListener('mousemove', function(e) {
    window.mousePosition.x = e.clientX;
    window.mousePosition.y = e.clientY;
});

module.exports = () => {
  
}