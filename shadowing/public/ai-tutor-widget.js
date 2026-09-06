/**
 * AI Tutor Widget - Giao diện chat an toàn qua Netlify Function
 */
(function() {
    // 1. Nhúng file CSS
    const linkElem = document.createElement('link');
    linkElem.rel = 'stylesheet';
    linkElem.href = 'ai-tutor-widget.css';
    document.head.appendChild(linkElem);

    // 2. Tạo HTML khung chat
    const container = document.createElement('div');
    container.innerHTML = `
        <div id="ai-tutor-bubble" title="Trò chuyện với Cô giáo & An">💬</div>
        <div id="ai-tutor-box">
            <div id="ai-tutor-header">
                <span>👩‍🏫 Cô giáo & 🧑‍🎓 An (AI Tutor)</span>
                <button id="ai-tutor-close">✕</button>
            </div>
            <div id="ai-tutor-messages">
                <div class="ai-msg">Konnichiwa! Mình là An và đây là Cô giáo tiếng Nhật. Bạn đang luyện tập hoặc đọc văn bản nào thế? Cứ hỏi tụi mình nhé!</div>
            </div>
            <div id="ai-tutor-input-area">
                <input type="text" id="ai-tutor-input" placeholder="Nhập câu hỏi hoặc trò chuyện..." />
                <button id="ai-tutor-send">Gửi</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // 3. Logic tương tác
    const bubble = document.getElementById('ai-tutor-bubble');
    const box = document.getElementById('ai-tutor-box');
    const closeBtn = document.getElementById('ai-tutor-close');
    const sendBtn = document.getElementById('ai-tutor-send');
    const inputField = document.getElementById('ai-tutor-input');
    const messagesArea = document.getElementById('ai-tutor-messages');

    bubble.onclick = () => box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
    closeBtn.onclick = () => box.style.display = 'none';

    function appendMessage(sender, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = sender === 'ai' ? 'ai-msg' : 'user-msg';
        msgDiv.textContent = text;
        messagesArea.appendChild(msgDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
    }

    async function sendToServer(userMessage) {
        const shadowingInput = document.getElementById('text-to-read-input');
        const currentText = shadowingInput ? shadowingInput.value.trim() : "";

        try {
            // Gọi thông qua Netlify Serverless Function (Bảo mật tuyệt đối API Key)
            const response = await fetch('/.netlify/functions/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, currentText: currentText })
            });

            const data = await response.json();
            if (data.reply) {
                appendMessage('ai', data.reply);
            } else {
                appendMessage('ai', "Có lỗi phản hồi từ hệ thống.");
            }
        } catch (error) {
            console.error("Error:", error);
            appendMessage('ai', "Lỗi kết nối tới máy chủ.");
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
})();
