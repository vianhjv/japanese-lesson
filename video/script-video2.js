/* --- FILE: script.js --- */

// 1. CẤU HÌNH GIỌNG MẶC ĐỊNH (Role Mapping)
// Máy sẽ ưu tiên tìm giọng có tên chứa các từ khóa này
const DEFAULT_ROLES = {
    "An": ["Nanami", "Female"],
    "Tanaka": ["Keita", "Male"],
    "Yamada": ["Ichiro", "Male"],
    "Suzuki": ["Ayumi", "Female"],
    "Narrator": ["Male", "Google"]
};

const playerState = {
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    scriptLines: [],
    currentVoiceConfig: {},
    mode: 'jp',
    utterance: null
};

const voiceManager = {
    jpVoices: [], vnVoices: [],
    init: async function() {
        return new Promise(resolve => {
            const load = () => {
                const v = speechSynthesis.getVoices();
                if (v.length > 0) {
                    this.jpVoices = v.filter(x => x.lang.includes('ja'));
                    this.vnVoices = v.filter(x => x.lang.includes('vi'));
                    console.log(`Loaded: ${this.jpVoices.length} JP, ${this.vnVoices.length} VN`);
                    resolve();
                }
            };
            if(speechSynthesis.getVoices().length) load();
            speechSynthesis.onvoiceschanged = load;
            // Fallback nếu trình duyệt load chậm
            setTimeout(resolve, 1000); 
        });
    },
    // Hàm tìm giọng thông minh
    getVoice: function(charName, lang, preferredURI) {
        let list = lang === 'jp' ? this.jpVoices : this.vnVoices;
        if (!list || list.length === 0) return null;
        
        // 1. Ưu tiên cấu hình Admin chọn (trong Maker)
        if(preferredURI) {
            const exact = list.find(v => v.voiceURI === preferredURI);
            if(exact) return exact;
        }
        
        // 2. Ưu tiên theo Vai (Nếu Admin chưa chọn, tự tìm theo tên nhân vật)
        if (lang === 'jp' && charName && DEFAULT_ROLES[charName]) {
            for (let keyword of DEFAULT_ROLES[charName]) {
                const found = list.find(v => v.name.includes(keyword) || v.voiceURI.includes(keyword));
                if (found) return found;
            }
        }
        
        // 3. Mặc định: Lấy giọng đầu tiên
        return list[0]; 
    }
};

// --- HÀM XỬ LÝ TEXT: LẤY FURIGANA ĐỂ ĐỌC CHÍNH XÁC ---
function getPhoneticText(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return "";
    
    // Clone node để xử lý mà không ảnh hưởng giao diện đang hiển thị
    const clone = el.cloneNode(true);
    
    // Tìm tất cả thẻ Ruby
    const rubies = clone.querySelectorAll('ruby');
    rubies.forEach(ruby => {
        const rt = ruby.querySelector('rt');
        if (rt) {
            // Lấy nội dung Furigana
            const furigana = rt.textContent;
            // Thay thế toàn bộ cụm <ruby>Kanji<rt>Furigana</rt></ruby> thành "Furigana"
            const textNode = document.createTextNode(furigana);
            ruby.parentNode.replaceChild(textNode, ruby);
        }
    });
    
    // Trả về text sạch (chỉ còn Hiragana/Katakana chuẩn)
    return clone.textContent.trim();
}

function initPlayer(lines, config) {
    stopPlayer();
    playerState.scriptLines = lines;
    playerState.currentVoiceConfig = config || {};
    playerState.currentIndex = 0;
}

// --- ĐIỀU KHIỂN ---
function playMode(mode) {
    if (playerState.isPaused && playerState.isPlaying) {
        playerState.isPaused = false;
        speechSynthesis.resume();
        return;
    }
    stopPlayer(); 
    playerState.mode = mode; 
    playerState.isPlaying = true;
    speakNext();
}

function togglePause() {
    if (!playerState.isPlaying) return;
    if (playerState.isPaused) {
        speechSynthesis.resume();
        playerState.isPaused = false;
    } else {
        speechSynthesis.pause();
        playerState.isPaused = true;
    }
}

function stopPlayer() {
    playerState.isPlaying = false;
    playerState.isPaused = false;
    speechSynthesis.cancel();
    // Xóa highlight
    document.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
}

// --- CORE: HÀM ĐỌC ---
function speakNext() {
    // Kiểm tra điều kiện dừng
    if (!playerState.isPlaying || playerState.currentIndex >= playerState.scriptLines.length) {
        playerState.isPlaying = false;
        return;
    }

    const line = playerState.scriptLines[playerState.currentIndex];
    
    // 1. HIGHLIGHT NGAY LẬP TỨC (Sửa lỗi mất highlight)
    document.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
    const rowElement = document.getElementById(line.rowId);
    if(rowElement) {
        rowElement.classList.add('active');
        rowElement.scrollIntoView({behavior: "smooth", block: "center"});
    }

    // 2. LẤY NỘI DUNG
    let textToRead = "";
    let langCode = "";

    if (playerState.mode === 'jp') {
        // Dùng hàm getPhoneticText để lấy Furigana
        textToRead = getPhoneticText(line.jpId); 
        langCode = 'jp';
    } else {
        // Tiếng Việt thì lấy textContent bình thường
        const el
