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
                body: JSON.stringify({ reply: "⚠️ Lỗi: Server Netlify chưa nhận được biến môi trường GEMINI_API_KEY." })
            };
        }

        // LOGIC THÔNG MINH DỰA TRÊN VIỆC CÓ TEXT HAY KHÔNG:
        let contextInstruction = "";
        if (currentText.length > 0) {
            contextInstruction = `Học viên ĐANG luyện tập đoạn văn bản tiếng Nhật sau:
"""
${currentText}
"""
Hãy dựa vào đoạn văn này để giải thích từ vựng, ngữ pháp, kanji hoặc giúp học viên luyện dịch/đặt câu theo ngữ cảnh của bài.`;
        } else {
            contextInstruction = `Học viên HIỆN CHƯA dán bài đọc nào vào khung Shadowing ở trên (khung đang trống).
Có thể học viên vừa học xong các bài N5, N4 ở các trang khác qua đây trò chuyện.
Hãy hỏi học viên xem hôm nay bạn đang học bài nào, hoặc muốn cô giáo & An hỗ trợ giải thích cấu trúc ngữ pháp nào, rủ học viên cùng đặt câu luyện tập.`;
        }

        const systemInstruction = `Bạn là An (người bạn học cùng thân thiện, vui vẻ) và Cô giáo tiếng Nhật (dịu dàng, chuẩn mực).
Nhiệm vụ: Đồng hành, hướng dẫn tiếng Nhật một cách tự nhiên và sinh động.
${contextInstruction}

Quy tắc phản hồi:
- Kết hợp lời thoại của An hoặc Cô giáo (hoặc cả hai) một cách tự nhiên.
- Dùng tiếng Việt giải thích dễ hiểu, kèm theo câu tiếng Nhật và cách đọc tương ứng.
- Khuyến khích học viên tự nói/gõ câu tiếng Nhật của mình.`;

        const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Cô giáo và An đã nghe rồi nhưng mạng hơi chập chờn, bạn nhắn lại nhé!";

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: aiReply })
        };

    } catch (err) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: `⚠️ Lỗi xử lý backend: ${err.message}` })
        };
    }
};
