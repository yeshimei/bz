// UI管理器类
class UIManager {
  constructor() {
    this.HTML_TEMPLATES = {
      // 小橘 UI HTML
      CAT_UI: `
        <style>
          /* 思考状态指示器样式 */
        </style>

        <!-- 语音指示器 -->
        <div class="voice-indicator" id="voice-indicator"></div>
        <div class="voice-feedback" id="voice-feedback"></div>

        <!-- 思考指示器（绿色小圆点） -->
        <div class="thinking-indicator" id="thinking-indicator"></div>

        <!-- 小橘气泡 -->
        <div class="cat-bubbles-container" id="cat-bubbles-container"></div>  
        
        <!-- 小橘本体 -->
        <div class="cat-body" id="cat-body">
            <div class="cat-ear cat-ear-left"></div>
            <div class="cat-ear cat-ear-right"></div>
            <div class="cat-face">
                <div class="cat-eye cat-eye-left"></div>
                <div class="cat-eye cat-eye-right"></div>
                <div class="cat-nose"></div>
            </div>
            <div class="cat-tail"></div>
        </div>
      `,

      // 设置面板 HTML
      SETTINGS_PANEL: `
        <div class="panel-header">
            <div class="panel-title">小橘设置</div>
        </div>
        <div class="panel-content">
            <!-- 外观选择 -->
            <div class="section">
                
                <div class="appearance-grid">
                    <div class="appearance-option selected" data-appearance="orange" style="background: linear-gradient(135deg, #FF6B35, #F7931E);" title="橘猫"></div>
                    <div class="appearance-option" data-appearance="gray" style="background: linear-gradient(135deg, #95A5A6, #7F8C8D);" title="灰猫"></div>
                    <div class="appearance-option" data-appearance="black" style="background: linear-gradient(135deg, #2C3E50, #34495E);" title="黑猫"></div>
                    <div class="appearance-option" data-appearance="white" style="background: linear-gradient(135deg, #ECF0F1, #BDC3C7);" title="白猫"></div>
                    <div class="appearance-option" data-appearance="calico" style="background: linear-gradient(135deg, #E74C3C, #F39C12);" title="三花猫"></div>

                    <!-- 高级皮肤 -->
                    <div class="appearance-option" data-appearance="neon" style="background: linear-gradient(135deg, #00FFFF, #FF00FF);" title="霓虹灯效果"></div>
                    <div class="appearance-option" data-appearance="galaxy" style="background: linear-gradient(135deg, #1a1a2e, #16213e);" title="银河星空"></div>
                    <div class="appearance-option" data-appearance="liquidMetal" style="background: linear-gradient(135deg, #bdc3c7, #95a5a6);" title="液态金属"></div>
                    <div class="appearance-option" data-appearance="fire" style="background: linear-gradient(135deg, #ff6b35, #ff4500);" title="火焰效果"></div>
                    <div class="appearance-option" data-appearance="crystal" style="background: linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1)); border: 1px solid rgba(255,255,255,0.3);" title="水晶透明"></div>
                    <div class="appearance-option" data-appearance="cyberpunk" style="background: linear-gradient(135deg, #00ff88, #0088ff);" title="赛博朋克"></div>
                    <div class="appearance-option" data-appearance="rainbow" style="background: linear-gradient(135deg, #ff6b6b, #ffa726, #ffee58, #4ecdc4, #96ceb4); background-size: 300% 300%;" title="彩虹渐变"></div>
                    <div class="appearance-option" data-appearance="hologram" style="background: linear-gradient(135deg, rgba(0,255,255,0.3), rgba(255,0,255,0.3)); border: 1px solid rgba(255,255,255,0.2);" title="全息投影"></div>
                </div>
            </div>
            
            <!-- 性格选择 -->
            <div class="section">
                
                <div class="personality-list">
                    <div class="personality-option selected" data-personality="lively">
                        <div class="personality-name">活泼型</div>
                        <div class="personality-desc">热情友好，喜欢互动</div>
                    </div>
                    <div class="personality-option" data-personality="quiet">
                        <div class="personality-name">安静型</div>
                        <div class="personality-desc">温和安静，偶尔说话</div>
                    </div>
                    <div class="personality-option" data-personality="wise">
                        <div class="personality-name">智慧型</div>
                        <div class="personality-desc">理性思考，深度分析</div>
                    </div>
                    <div class="personality-option" data-personality="cute">
                        <div class="personality-name">萌系型</div>
                        <div class="personality-desc">可爱卖萌，表情丰富</div>
                    </div>
                    <div class="personality-option" data-personality="mentor">
                        <div class="personality-name">导师型</div>
                        <div class="personality-desc">专业指导，提供建议</div>
                    </div>
                </div>
            </div>
            
            <!-- API设置 -->
            <div class="section">
                
                <input type="password" class="input-field" id="api-key" placeholder="输入DeepSeek API密钥">
                <div style="font-size: 12px; color: #666; margin-top: 8px; line-height: 1.4;">
                    获取API密钥：<a href="https://platform.deepseek.com/api_keys" target="_blank" style="color: #007acc;">DeepSeek平台</a>
                </div>
            </div>
            
            <!-- 行为设置 -->
            <div class="section">
            
                <div class="slider-container">
                    <label style="font-size: 13px; color: #666; display: block; margin-bottom: 8px;">自言自语间隔</label>
                    <input type="range" class="input-field" id="speak-interval" min="1" max="60" value="5" style="width: 100%;">
                    <div class="slider-value" id="interval-value">5分钟</div>
                </div>
                <div class="slider-container">
                    <label style="font-size: 13px; color: #666; display: block; margin-bottom: 8px;">说话概率</label>
                    <input type="range" class="input-field" id="speak-probability" min="0.1" max="1" step="0.1" value="0.3" style="width: 100%;">
                    <div class="slider-value" id="probability-value">30%</div>
                </div>
            </div>

            <div class="section">
            
                
                <div class="slider-container">
                    <label style="font-size: 13px; color: #666; display: block; margin-bottom: 8px;">
                        短期记忆量
                        <span style="font-size: 11px; color: #999; margin-left: 5px;">
                            (保留的对话轮数，范围50-200)
                        </span>
                    </label>
                    <input type="range" class="input-field" id="short-term-memory" min="50" max="200" step="10" value="200" style="width: 100%;">
                    <div class="slider-value" id="short-term-memory-value">50轮对话</div>
                </div>
                
                <div style="font-size: 11px; color: #666; margin-top: 8px; line-height: 1.4; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 6px;">
                    💡💡💡💡 提示：记忆量越大，AI越能记住之前的对话，但也会消耗更多的token。建议根据实际需要调整。
                </div>
            </div>
            
            <div class="section">
              
                
                <div class="slider-container">
                    <label style="font-size: 13px; color: #666; display: block; margin-bottom: 8px;">
                        上下文字数限制
                        <span style="font-size: 11px; color: #999; margin-left: 5px;">
                            (0=仅当前行，500=上下各250字)
                        </span>
                    </label>
                    <input type="range" class="input-field" id="context-length" min="0" max="1000" step="50" value="500" style="width: 100%;">
                    <div class="slider-value" id="context-length-value">500字（上下各250字）</div>
                </div>
                
                <div class="slider-container">
                    <label style="font-size: 13px; color: #666; display: block; margin-bottom: 8px;">
                        上下文分布比例
                        <span style="font-size: 11px; color: #999; margin-left: 5px;">
                            (向上/向下字数比例)
                        </span>
                    </label>
                    <input type="range" class="input-field" id="context-ratio" min="0.1" max="0.9" step="0.1" value="0.5" style="width: 100%;">
                    <div class="slider-value" id="context-ratio-value">50%向上 / 50%向下</div>
                </div>
                
                <div style="font-size: 11px; color: #666; margin-top: 8px; line-height: 1.4; background: rgba(0,0,0,0.03); padding: 8px; border-radius: 6px;">
                    💡💡💡💡 提示：字数越小响应越快，越大上下文越完整。设置为0时仅使用当前行内容。
                </div>
            </div>
            <button class="save-btn" id="save-settings">保存设置</button>
        </div>
      `,

      // 聊天面板 HTML
      CHAT_PANEL: `
        <div class="panel-header">
            <span class="panel-title">与小橘聊天</span>
        </div>
        <div class="chat-messages" id="chat-messages">
            <div class="message cat-message">你好！我是你的笔记陪伴小橘，可以基于你的笔记内容和你聊天~</div>
        </div>
        <div class="chat-input-area">
            <textarea class="chat-input" id="chat-input" placeholder="输入消息..." rows="1"></textarea>
            <button class="send-btn" id="send-button">↵</button>
        </div>
      `
    }

    this.catContainer = null
    this.settingsPanel = null
    this.chatPanel = null
    this.panelMask = null
  }

  /**
   * 创建小橘UI
   */
  createCatUI() {
    this.removeExistingUI()

    this.catContainer = this.createCatContainer()
    document.body.appendChild(this.catContainer)

    return this.catContainer
  }

  /**
   * 创建面板UI
   */
  createPanelUI() {
    this.panelMask = this.createPanelMask()
    document.body.appendChild(this.panelMask)

    this.settingsPanel = this.createSettingsPanel()
    document.body.appendChild(this.settingsPanel)

    this.chatPanel = this.createChatPanel()
    document.body.appendChild(this.chatPanel)

    return {
      panelMask: this.panelMask,
      settingsPanel: this.settingsPanel,
      chatPanel: this.chatPanel
    }
  }

  /**
   * 初始化所有UI组件
   */
  initialize() {
    const catContainer = this.createCatUI()
    const panels = this.createPanelUI()

    return {
      catContainer,
      ...panels
    }
  }

  /**
   * 移除已存在的UI元素
   */
  removeExistingUI() {
    const existingCat = document.getElementById('smart-companion-cat')
    const existingSettings = document.getElementById('settings-panel')
    const existingChat = document.getElementById('chat-panel')
    const existingMask = document.getElementById('panel-mask')

    if (existingCat) existingCat.remove()
    if (existingSettings) existingSettings.remove()
    if (existingChat) existingChat.remove()
    if (existingMask) existingMask.remove()
  }

  /**
   * 创建小橘容器
   */
  createCatContainer() {
    const container = document.createElement('div')
    container.id = 'smart-companion-cat'
    container.style.cssText = `
      position: fixed;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 50px;
      height: 50px;
      z-index: 100000;
      cursor: pointer;
      touch-action: none;
      user-select: none;
      transition: all 0.3s ease;
    `

    container.innerHTML = this.HTML_TEMPLATES.CAT_UI
    return container
  }

  /**
   * 创建面板遮罩层
   */
  createPanelMask() {
    const mask = document.createElement('div')
    mask.id = 'panel-mask'
    mask.className = 'panel-mask'
    return mask
  }

  /**
   * 创建设置面板
   */
  createSettingsPanel() {
    const panel = document.createElement('div')
    panel.id = 'settings-panel'
    panel.className = 'settings-panel'
    panel.innerHTML = this.HTML_TEMPLATES.SETTINGS_PANEL
    return panel
  }

  /**
   * 创建聊天面板
   */
  createChatPanel() {
    const panel = document.createElement('div')
    panel.id = 'chat-panel'
    panel.className = 'chat-panel'
    panel.innerHTML = this.HTML_TEMPLATES.CHAT_PANEL
    return panel
  }

  /**
   * 获取UI元素引用
   */
  getUIElements() {
    return {
      catContainer: this.catContainer,
      settingsPanel: this.settingsPanel,
      chatPanel: this.chatPanel,
      panelMask: this.panelMask
    }
  }

  /**
   * 更新UI模板
   */
  updateTemplate(templateName, newTemplate) {
    if (this.HTML_TEMPLATES[templateName]) {
      this.HTML_TEMPLATES[templateName] = newTemplate
      return true
    }
    return false
  }

  /**
   * 添加自定义模板
   */
  addCustomTemplate(templateName, templateContent) {
    this.HTML_TEMPLATES[templateName] = templateContent
  }

  /**
   * 重新渲染UI
   */
  reRender() {
    this.removeExistingUI()
    return this.initialize()
  }
}

// 导出模块
module.exports = async params => {
  const uiManager = new UIManager()
  const uiElements = uiManager.initialize()

  // 将UI元素挂载到全局变量，保持与第一个文件的兼容性
  if (typeof window !== 'undefined') {
    window.smartCat = window.smartCat || {}
    window.smartCat.uiManager = uiManager
    Object.assign(window.smartCat, uiElements)
  }

  return uiElements
}
