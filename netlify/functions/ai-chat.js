// netlify/functions/ai-chat.js
exports.handler = async function(event, context) {
    // Chỉ chấp nhận method POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const userMessage = body.message || '';
        const currentText = body.currentText || '';

        // 1. Kiểm tra API Key từ biến môi trường của Netlify
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply: "⚠️ Lỗi: Server Netlify chưa nhận được biến môi trường GEMINI_API_KEY. Bạn hãy kiểm tra lại mục Environment Variables trên Netlify nhé!" })
            };
        }

        // 2. Kịch bản nhập vai Cô giáo & An
        const systemInstruction = `Bạn là An (một người bạn học thân thiện, vui vẻ) và Cô giáo tiếng Nhật (kiên nhẫn, chuẩn mực).
Nhiệm vụ của bạn là đồng hành, giải đáp từ vựng, ngữ pháp tiếng Nhật cho học viên.
Ngữ cảnh hiện tại: Học viên đang xem/luyện tập đoạn văn bản tiếng Nhật sau:
"${currentText}"

Yêu cầu phản hồi:
- Kết hợp lời nói của An hoặc Cô giáo (hoặc cả hai) một cách tự nhiên.
- Dùng tiếng Việt giải thích kèm câu tiếng Nhật tương ứng.
- Động viên học viên tự đặt câu dựa trên cấu trúc vừa học.`;

        // 3. Gọi trực tiếp Google Gemini API (model 1.5-flash)
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

        // Kiểm tra nếu Google trả về lỗi (ví dụ sai API key hoặc vượt quota)
        if (data.error) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply: `⚠️ Google API báo lỗi: ${data.error.message}` })
            };
        }

        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Cô giáo và An đã nghe thấy rồi nhưng chưa hiểu ý em lắm, em nói rõ hơn nhé!";

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
