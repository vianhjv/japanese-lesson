/* --- FILE: script.js --- */

// 1. CẤU HÌNH GIỌNG MẶC ĐỊNH CHO NHÂN VẬT (Ưu tiên)
// Nếu máy có các giọng này sẽ tự động gán, không cần cấu hình thủ công từng bài.
const DEFAULT_ROLES = {
    "An": ["Nanami", "Female"],      // Ưu tiên tìm giọng có tên Nanami
    "Tanaka": ["Keita", "Male"],     // Ưu tiên Keita
    "Yamada": ["Ichiro", "Male"],    // Ưu tiên Ichiro
    "Suzuki": ["Ayumi", "Female"],   // Ưu tiên Ayumi
    "Narrator": ["Male", "Google"]   // Người dẫn chuyện
};

const playerState = {
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    scriptLines: [],
    currentVoiceConfig: {}, // Cấu hình riêng của bài học (nếu có)
    mode: 'jp', // 'jp' hoặc 'vn'
    utterance: null
};

const voiceManager = {
    jpVoices: [], 
    vnVoices: [],
    
    init: async function() {
        return new Promise(resolve => {
            const load = () => {
                const v = speechSynthesis.getVoices();
                if (v.length > 0) {
                    this.jpVoices = v.filter(x => x.lang.includes('ja'));
                    this.vnVoices = v.filter(x => x.lang.includes('vi'));
                    console.log(`Đã tìm thấy ${this.jpVoices.length} giọng Nhật.`);
                    resolve();
                }
            };
            // Thử load ngay
            if(speechSynthesis.getVoices().length) load();
            // Nếu chưa có thì đợi sự kiện
            speechSynthesis.onvoiceschanged = load;
            // Fallback: Nếu đợi quá lâu mà không thấy giọng (đề phòng lỗi trình duyệt)
            setTimeout(resolve, 2000); 
        });
    },

    // Hàm tìm giọng thông minh (Logic mới)
    getVoice: function(charName, lang, preferredURI) {
        let list = lang === 'jp' ? this.jpVoices : this.vnVoices;
        if (!list || list.length === 0) return null;

        // ƯU TIÊN 1: Giọng đã chọn thủ công trong Maker (Lưu trong data.js)
        if(preferredURI) {
            const exact = list.find(v => v.voiceURI === preferredURI);
            if(exact) return exact;
        }

        // ƯU TIÊN 2: Giọng theo vai mặc định (Nanami, Keita...) - CHỈ ÁP DỤNG CHO TIẾNG NHẬT
        if (lang === 'jp' && charName && DEFAULT_ROLES[charName]) {
            const keywords = DEFAULT_ROLES[charName]; // Ví dụ ["Keita", "Male"]
            
            // Tìm giọng nào tên có chứa từ khóa (Ví dụ tìm giọng có chữ "Keita")
            for (let keyword of keywords) {
                const found = list.find(v => v.name.includes(keyword) || v.voiceURI.includes(keyword));
                if (found) return found;
            }
        }

        // ƯU TIÊN 3: Nếu không tìm thấy giọng riêng, dùng giọng mặc định của trình duyệt
        return list[0]; 
    }
};

// Khởi tạo trình chơi
function initPlayer(lines, config) {
    stopPlayer(); // Reset trạng thái cũ
    playerState.scriptLines = lines;
    playerState.currentVoiceConfig = config || {};
    playerState.currentIndex = 0;
}

// --- XỬ LÝ CÁC NÚT BẤM (FIX LỖI KHÔNG CHẠY) ---

function playMode(mode) {
    // Nếu đang tạm dừng (Pause), bấm lại nút thì chạy tiếp
    if (playerState.isPaused) {
        playerState.isPaused = false;
        speechSynthesis.resume();
        return;
    }

    // Nếu đang chạy mode khác, hoặc đang dừng hẳn
    stopPlayer(); 
    playerState.mode = mode; // Gán chế độ 'jp' hoặc 'vn'
    playerState.isPlaying = true;
    
    // Bắt đầu đọc
    speakNext();
}

function togglePause() {
    if (!playerState.isPlaying) return; // Chưa chạy thì không pause được

    if (playerState.isPaused) {
        // Đang pause -> Chạy tiếp
        speechSynthesis.resume();
        playerState.isPaused = false;
    } else {
        // Đang chạy -> Pause
        speechSynthesis.pause();
        playerState.isPaused = true;
    }
}

function stopPlayer() {
    playerState.isPlaying = false;
    playerState.isPaused = false;
    speechSynthesis.cancel(); // Dừng đọc ngay lập tức
    if (playerState.utterance) playerState.utterance = null;
    
    // Xóa highlight màu vàng trên giao diện
    document.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
}

// --- HÀM ĐỌC (CORE) ---
function speakNext() {
    // Điều kiện dừng: Người dùng bấm Stop hoặc đã đọc hết bài
    if (!playerState.isPlaying || playerState.currentIndex >= playerState.scriptLines.length) {
        playerState.isPlaying = false;
        return;
    }

    const line = playerState.scriptLines[playerState.currentIndex];
    
    // 1. Highlight dòng đang đọc
    document.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
    const rowElement = document.getElementById(line.rowId);
    if(rowElement) {
        rowElement.classList.add('active');
        // Tự động cuộn màn hình đến dòng đó
        rowElement.scrollIntoView({behavior: "smooth", block: "center"});
    }

    // 2. Xác định nội dung cần đọc
    let textToRead = "";
    let langCode = "";

    if (playerState.mode === 'jp') {
        const el = document.getElementById(line.jpId);
        textToRead = el ? el.textContent : "";
        langCode = 'jp';
    } else {
        const el = document.getElementById(line.vnId);
        textToRead = el ? el.textContent : "";
        langCode = 'vn';
    }

    // Nếu dòng này không có nội dung (ví dụ chỉ có tiếng Nhật mà ko có tiếng Việt), bỏ qua
    if (!textToRead.trim()) {
        playerState.currentIndex++;
        speakNext();
        return;
    }

    // 3. Tạo đối tượng đọc
    const u = new SpeechSynthesisUtterance(textToRead);
    
    // --- CHỌN GIỌNG (LOGIC QUAN TRỌNG) ---
    if (langCode === 'jp') {
        // Lấy config nếu có
        const configURI = playerState.currentVoiceConfig[line.char] ? playerState.currentVoiceConfig[line.char].jp : null;
        // Gọi hàm tìm giọng thông minh
        const voice = voiceManager.getVoice(line.char, 'jp', configURI);
        if(voice) u.voice = voice;
        u.rate = 1.0; // Tốc độ đọc tiếng Nhật
    } else {
        // Tiếng Việt
        const voice = voiceManager.getVoice(null, 'vn', null);
        if(voice) u.voice = voice;
        u.rate = 1.1; // Tiếng Việt đọc nhanh hơn xíu cho tự nhiên
    }

    // 4. Sự kiện khi đọc xong dòng này
    u.onend = () => {
        if(playerState.isPlaying && !playerState.isPaused) {
            // Nghỉ 600ms rồi đọc câu tiếp theo
            setTimeout(() => {
                if(playerState.isPlaying && !playerState.isPaused) {
                    playerState.currentIndex++;
                    speakNext();
                }
            }, 600);
        }
    };

    u.onerror = (e) => {
        console.error("Lỗi đọc:", e);
        // Nếu lỗi thì bỏ qua đọc tiếp câu sau, tránh bị treo
        if(playerState.isPlaying) {
            playerState.currentIndex++;
            speakNext();
        }
    };

    playerState.utterance = u;
    speechSynthesis.speak(u);
}