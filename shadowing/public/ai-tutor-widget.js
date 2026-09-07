/**
 * AI Tutor Widget - Dạng khối nội dung liền mạch (Section-based)
 */
(function() {
    // 1. Tự động nạp file CSS
    const linkElem = document.createElement('link');
    linkElem.rel = 'stylesheet';
    linkElem.href = 'ai-tutor-widget.css';
    document.head.appendChild(linkElem);

    // 2. Tạo giao diện khối Chat Section
    const chatSection = document.createElement('div');
    chatSection.className = 'ai-tutor-section';
    chatSection.innerHTML = `
        <div class="ai-tutor-header">
            <h3>👩‍🏫 Cô giáo tiếng Nhật & 🧑‍🎓 An</h3>
            <span style="font-size: 0.85rem; opacity: 0.9;">Gia sư AI đồng hành</span>
        </div>
        <div class="ai-tutor-desc">
            💡 <b>Cùng trao đổi:</b> Bạn vừa nghe & đọc đoạn văn bản trên? Hãy hỏi cô giáo về từ vựng, ngữ pháp khó hoặc nhờ An rủ bạn luyện đặt câu nhé!
        </div>
        <div class="ai-tutor-chat-body" id="ai-tutor-messages">
            <div class="ai-msg">
                Konnichiwa! Mình là An và đây là Cô giáo tiếng Nhật. Bạn đang nhập hoặc nghe văn bản nào ở khung trên thế? Có từ nào hay câu nào chưa hiểu, hãy nhắn cho tụi mình nhé!
            </div>
        </div>
        <div class="ai-tutor-input-bar">
            <input type="text" id="ai-tutor-input" placeholder="Hỏi từ vựng, giải thích câu hoặc trò chuyện..." />
            <button id="ai-tutor-send">Gửi</button>
        </div>
    `;

    // 3. Nhúng khung chat vào ngay bên dưới phần Section-tools (Shadowing Tool)
    function injectWidget() {
        const toolsSection = document.getElementById('section-tools');
        if (toolsSection) {
            toolsSection.parentNode.insertBefore(chatSection, toolsSection.nextSibling);
        } else {
            // Trường hợp không tìm thấy section-tools thì gắn vào cuối thẻ main
            const main = document.querySelector('main') || document.body;
            main.appendChild(chatSection);
        }
        setupEvents();
    }

    // 4. Xử lý sự kiện gửi tin nhắn
    function setupEvents() {
        const sendBtn = document.getElementById('ai-tutor-send');
        const inputField = document.getElementById('ai-tutor-input');
        const messagesArea = document.getElementById('ai-tutor-messages');

        function appendMessage(sender, text) {
            const msgDiv = document.createElement('div');
            msgDiv.className = sender === 'ai' ? 'ai-msg' : 'user-msg';
            msgDiv.textContent = text;
            messagesArea.appendChild(msgDiv);
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }

        async function sendToServer(userText) {
            // Tự động quét lấy đoạn tiếng Nhật người dùng đang nhập ở ô Shadowing
            const shadowingInput = document.getElementById('text-to-read-input');
            const currentText = shadowingInput ? shadowingInput.value.trim() : "";

            // Hiển thị trạng thái đang đợi
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'ai-msg';
            loadingDiv.id = 'ai-loading';
            loadingDiv.textContent = 'Cô giáo & An đang suy nghĩ...';
            messagesArea.appendChild(loadingDiv);
            messagesArea.scrollTop = messagesArea.scrollHeight;

            try {
                const response = await fetch('/.netlify/functions/ai-chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userText, currentText: currentText })
                });

                const data = await response.json();
                const loader = document.getElementById('ai-loading');
                if (loader) loader.remove();

                if (data.reply) {
                    appendMessage('ai', data.reply);
                } else {
                    appendMessage('ai', "Hệ thống chưa phản hồi được, bạn thử lại nhé.");
                }
            } catch (err) {
                const loader = document.getElementById('ai-loading');
                if (loader) loader.remove();
                appendMessage('ai', "Lỗi kết nối tới server: " + err.message);
            }
        }

        sendBtn.onclick = () => {
            const text = inputField.value.trim();
            if (!text) return;
            appendMessage('user', text);
            inputField.value = '';
            sendToServer(text);
        };

        inputField.onkeypress = (e) => {
            if (e.key === 'Enter') sendBtn.click();
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectWidget);
    } else {
        injectWidget();
    }
})();
