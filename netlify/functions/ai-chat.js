exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, currentText } = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY; // Lấy khóa bí mật từ két sắt Netlify
        
        if (!apiKey) {
            return { statusCode: 500, body: JSON.stringify({ error: "Missing API Key on server" }) };
        }

        const systemInstruction = `Bạn là An (bạn đồng hành thân thiện) và Cô giáo tiếng Nhật (dịu dàng, chuyên nghiệp). 
        Đoạn văn bản học viên đang xem trên trang web là: "${currentText}". 
        Hãy trả lời thân thiện, hỗ trợ học tiếng Nhật, có giải thích và ví dụ nếu cần.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemInstruction + "\n\nCâu hỏi: " + message }] }]
            })
        });

        const data = await response.json();
        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Tụi mình chưa rõ lắm, bạn hỏi lại nhé!";

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: aiReply })
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
