/**
 * Chatbot System — Sidebar mode
 * Nút toolbar toggle sidebar giữa Vùng chọn ↔ AI Chat
 */

export const ChatbotSystem = {
  _initialized: false,
  _isChatMode: false,
  _isLoading: false,
  _messages: [],
  _animationFrame: null,
  _abortController: null,
  MAX_HISTORY: 20,
  LS_PREFIX: 'chatbot_history_',

  // ==================== Khởi tạo ====================

  /** Cleanup tất cả listeners + timer */
  destroy() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
    this._initialized = false;
  },

  init() {
    if (this._initialized) return;

    const toggleBtn = document.getElementById('chatbotToggleBtn');
    const clearBtn = document.getElementById('chatbotClearBtn');
    const sendBtn = document.getElementById('chatbotSendBtn');
    const input = document.getElementById('chatbotInput');

    if (!toggleBtn || !input) return;

    // AbortController cho cleanup tất cả listeners
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Toggle sidebar mode
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggle();
    }, { signal });

    // Clear history
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearHistory(), { signal });
    }

    // Send button
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage(), { signal });
    }

    // Enter gửi, Shift+Enter xuống dòng
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    }, { signal });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    }, { signal });

    // Load history từ localStorage
    this._loadHistory();

    this._initialized = true;
  },

  // ==================== Toggle sidebar mode ====================

  _toggle() {
    this._isChatMode = !this._isChatMode;

    const sidebar = document.querySelector('.sidebar');
    const selectionsPane = document.getElementById('sidebarSelectionsPane');
    const chatPane = document.getElementById('sidebarChatPane');
    const toggleBtn = document.getElementById('chatbotToggleBtn');

    if (!sidebar || !selectionsPane || !chatPane) return;

    // Nếu sidebar đang ẩn → hiện lên
    if (sidebar.classList.contains('sidebar-hidden')) {
      sidebar.classList.remove('sidebar-hidden');
    }

    if (this._isChatMode) {
      // Chuyển sang Chat
      selectionsPane.style.display = 'none';
      chatPane.classList.add('active');
      if (toggleBtn) toggleBtn.classList.add('active');
      // Focus input
      const input = document.getElementById('chatbotInput');
      if (input) setTimeout(() => input.focus(), 100);
      this._scrollToBottom();
    } else {
      // Chuyển về Vùng chọn
      selectionsPane.style.display = '';
      chatPane.classList.remove('active');
      if (toggleBtn) toggleBtn.classList.remove('active');
    }
  },

  // ==================== Message Handling ====================

  async sendMessage() {
    const input = document.getElementById('chatbotInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text || this._isLoading) return;

    // Dừng animation cũ trước khi xoá DOM — tránh setInterval chạy trên detached node
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    // Thêm user message
    this._addMessage('user', text);
    this._renderMessages();

    // Gọi API
    this._isLoading = true;
    this._showLoading();
    this._setSendBtnDisabled(true);

    try {
      const sessionId = window.appState?.messageId ?? '';
      const userEmail = (window.firebaseAuth && window.firebaseAuth.currentUser)
        ? window.firebaseAuth.currentUser.email || ''
        : '';

      const result = await this._callChatbot(sessionId, userEmail);

      this._hideLoading();

      if (result && result.success && result.reply) {
        this._addMessage('model', result.reply);
        this._renderMessages();
        this._animateLastMessage(result.reply);
      } else {
        const errMsg = result?.error ?? 'Có lỗi xảy ra';
        this._addMessage('model', errMsg);
        this._renderMessages();
        this._markLastAsError();
      }
    } catch (err) {
      this._hideLoading();
      this._addMessage('model', 'Lỗi kết nối: ' + (err.message || err));
      this._renderMessages();
      this._markLastAsError();
    } finally {
      this._isLoading = false;
      this._setSendBtnDisabled(false);
      this._saveHistory();
    }
  },

  _addMessage(role, content) {
    this._messages.push({
      role: role,
      content: content,
      timestamp: Date.now(),
    });
  },

  // ==================== Render ====================

  _renderMessages() {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;

    container.replaceChildren();

    if (this._messages.length === 0) {
      container.innerHTML =
        '<div class="chatbot-welcome">Xin chào! Tôi có thể giúp gì cho bạn?</div>';
      return;
    }

    for (let i = 0; i < this._messages.length; i++) {
      const msg = this._messages[i];
      const div = document.createElement('div');
      div.className = 'chatbot-msg chatbot-msg-' + msg.role;
      div.textContent = msg.content;
      container.appendChild(div);
    }

    this._scrollToBottom();
  },

  _markLastAsError() {
    const container = document.getElementById('chatbotMessages');
    if (container && container.lastElementChild) {
      container.lastElementChild.classList.add('chatbot-msg-error');
    }
  },

  // ==================== Typing Animation ====================

  _animateLastMessage(fullText) {
    const container = document.getElementById('chatbotMessages');
    if (!container || !container.lastElementChild) return;

    const el = container.lastElementChild;
    el.textContent = '';

    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }

    // rAF chunk thay setInterval(12ms): mượt hơn, browser tự skip frame khi tab background
    const CHARS_PER_FRAME = 3;   // ~3 ký tự/frame ≈ 60 chars/giây ≈ tốc độ cũ
    const SCROLL_EVERY = 50;
    let i = 0;
    const self = this;
    const step = () => {
      if (i >= fullText.length) {
        self._animationFrame = null;
        self._scrollToBottom();
        return;
      }
      const next = Math.min(i + CHARS_PER_FRAME, fullText.length);
      el.textContent += fullText.slice(i, next);
      const crossedScrollBoundary = Math.floor(next / SCROLL_EVERY) > Math.floor(i / SCROLL_EVERY);
      i = next;
      if (crossedScrollBoundary) self._scrollToBottom();
      self._animationFrame = requestAnimationFrame(step);
    };
    self._animationFrame = requestAnimationFrame(step);
  },

  // ==================== Loading ====================

  _showLoading() {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;

    const loading = document.createElement('div');
    loading.className = 'chatbot-loading';
    loading.id = 'chatbotLoadingDots';
    loading.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(loading);
    this._scrollToBottom();
  },

  _hideLoading() {
    const el = document.getElementById('chatbotLoadingDots');
    if (el) el.remove();
  },

  _setSendBtnDisabled(disabled) {
    const btn = document.getElementById('chatbotSendBtn');
    if (btn) btn.disabled = disabled;
  },

  // ==================== API ====================

  async _callChatbot(sessionId, userEmail) {
    const messagesToSend = this._messages
      .slice(-this.MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    if (typeof ApiClient !== 'undefined' && ApiClient.callCloudFunction) {
      return await ApiClient.callCloudFunction('chatbot', {
        sessionId: sessionId,
        messages: messagesToSend,
        userEmail: userEmail,
      });
    }

    throw new Error('ApiClient chưa sẵn sàng');
  },

  // ==================== localStorage ====================

  _loadHistory() {
    try {
      const sessionId = window.appState?.messageId ?? '';
      if (!sessionId) return;

      const key = this.LS_PREFIX + sessionId;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this._messages = parsed.slice(-this.MAX_HISTORY);
          this._renderMessages();
        }
      }
    } catch (e) {
      console.warn('[Chatbot] localStorage load error:', e.message);
    }
  },

  _saveHistory() {
    try {
      const sessionId = window.appState?.messageId ?? '';
      if (!sessionId) return;

      const key = this.LS_PREFIX + sessionId;
      const toSave = this._messages.slice(-this.MAX_HISTORY);
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[Chatbot] localStorage save error:', e.message);
    }
  },

  clearHistory() {
    // Dừng animation cũ trước khi xoá DOM — tránh setInterval chạy trên detached node
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }

    this._messages = [];
    this._renderMessages();

    try {
      const sessionId = window.appState?.messageId ?? '';
      if (sessionId) {
        localStorage.removeItem(this.LS_PREFIX + sessionId);
      }
    } catch (e) {
      console.warn('[Chatbot] localStorage clear error:', e.message);
    }
  },

  // ==================== Helpers ====================

  _scrollToBottom() {
    const container = document.getElementById('chatbotMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },
};

window.ChatbotSystem = ChatbotSystem;
