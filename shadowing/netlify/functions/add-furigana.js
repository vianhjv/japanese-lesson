// File: netlify/functions/add-furigana.js

const Kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

// Khởi tạo Kuroshiro một lần để tái sử dụng, giúp tăng tốc độ
const kuroshiro = new Kuroshiro();
const analyzer = new KuromojiAnalyzer();
let isInitialized = false;

const initialize = async () => {
    if (!isInitialized) {
        await kuroshiro.init(analyzer);
        isInitialized = true;
    }
};

// Hàm xử lý chính của serverless function
exports.handler = async (event) => {
    // Chỉ chấp nhận phương thức POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        await initialize(); // Đảm bảo kuroshiro đã sẵn sàng

        const { text } = JSON.parse(event.body);
        if (!text) {
            return { statusCode: 400, body: 'Missing text parameter' };
        }
        
        const result = await kuroshiro.convert(text, {
            mode: 'furigana',
            to: 'hiragana',
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: result,
        };

    } catch (error) {
        console.error('Error processing furigana:', error);
        return {
            statusCode: 500,
            body: `Đã xảy ra lỗi trên server: ${error.message}`
        };
    }
};