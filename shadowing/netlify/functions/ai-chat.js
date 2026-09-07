// shadowing/netlify/functions/ai-chat.js
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const userMessage = body.message || '';
        const currentText = (body.currentText || '').trim();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply: "⚠️ Lỗi: Chưa có GEMINI_API_KEY trên Netlify." })
            };
        }

        // Tự động nhận diện xem ô Shadowing có bài đọc không
        let contextInstruction = "";
        if (currentText.length > 0) {
            contextInstruction = `Học viên ĐANG luyện tập đoạn văn bản tiếng Nhật sau:
"""
${currentText}
"""
Hãy dựa vào đoạn văn này để giải thích từ vựng, ngữ pháp, kanji hoặc giúp học viên luyện đặt câu.`;
        } else {
            contextInstruction = `Học viên hiện CHƯA dán bài đọc nào vào ô phía trên (ô đang trống).
Hãy hỏi học viên xem hôm nay bạn đang học bài nào bên N4 hay N5, muốn ôn cấu trúc ngữ pháp nào để cùng luyện tập.`;
        }

        const systemInstruction = `Bạn là An (người bạn đồng hành thân thiện) và Cô giáo tiếng Nhật (dịu dàng, chuẩn mực).
Nhiệm vụ: Đồng hành, hướng dẫn tiếng Nhật tự nhiên, sinh động.
${contextInstruction}
Hãy giải thích bằng tiếng Việt dễ hiểu kèm câu tiếng Nhật tương ứng, khuyến khích học viên tự nói hoặc đặt câu.`;

        // DÙNG CHUẨN MODEL TRÊN MÀN HÌNH CỦA BẠN: gemini-3.5-flash-lite
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: systemInstruction + "\n\nHọc viên nói: " + userMessage }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();

        if (data.error) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply: `⚠️ Google API báo lỗi: ${data.error.message}` })
            };
        }

        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Cô giáo và An đã nghe thấy rồi nhưng chưa phản hồi được, bạn nhắn lại nhé!";

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: aiReply })
        };

    } catch (err) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: `⚠️ Lỗi server: ${err.message}` })
        };
    }
};
