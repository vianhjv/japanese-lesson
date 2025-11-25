/* --- FILE: script.js --- */

// --- 1. BẢNG PHÂN VAI (Dữ liệu từ Maker của bạn) ---
const ROLE_MAPPING = {
    "An":       { jp: ["Nanami", "Female"], vn: ["HoaiMy", "Female"] },
    "Tanaka":   { jp: ["Keita", "Male"],    vn: ["NamMinh", "Male"] },
    "Suzuki":   { jp: ["Ayumi", "Female"],  vn: ["HoaiMy", "Female"] },
    "Yamada":   { jp: ["Ichiro", "Male"],   vn: ["NamMinh", "Male"] },
    "Sato":     { jp: ["Ayumi", "Female"],  vn: ["HoaiMy", "Female"] },
    "Narrator": { jp: ["Sayaka", "Google"], vn: ["HoaiMy", "Google"] }
};

// --- 2. QUẢN LÝ GIỌNG (Đã thêm logic tự tìm theo Role) ---
const voiceManager = {
    jpVoices: [], vnVoices: [], 
    
    init: function() {
        return new Promise((resolve) => {
            const load = () => {
                const all = window.speechSynthesis.getVoices();
                if (all.length > 0) {
                    this.jpVoices = all.filter(v => v.lang.includes('ja'));
                    this.vnVoices = all.filter(v => v.lang.includes('vi'));
                    console.log(`Voices: ${this.jpVoices.length} JP, ${this.vnVoices.length} VN`);
                    resolve();
                }
            };
            window.speechSynthesis.onvoiceschanged = load;
            load();
            setTimeout(resolve, 1000); // Fallback
        });
    },

    // Hàm tìm giọng (Kết hợp Config đã lưu và Tự động phân vai)
    getBestVoice: function(charName, preferredURI, langType) {
        const availableVoices = langType === 'jp' ? this.jpVoices : this.vnVoices;
        if (!availableVoices || availableVoices.length === 0) return null;

        // Ưu tiên 1: Config (Admin đã chọn)
        if (preferredURI) {
            const exactMatch = availableVoices.find(v => v.voiceURI === preferredURI);
            if (exactMatch) return exactMatch;
        }

        // Ưu tiên 2: Role Mapping (Tự động)
        if (charName && ROLE_MAPPING[charName]) {
            const keywords = ROLE_MAPPING[charName][langType];
            if (keywords) {
                for (let key of keywords) {
                    const found = availableVoices.find(v => 
                        v.name.toLowerCase().includes(key.toLowerCase()) || 
                        v.voiceURI.toLowerCase().includes(key.toLowerCase())
                    );
                    if (found) return found;
                }
            }
        }

        // Ưu tiên 3: Mặc định
        return availableVoices[0]; 
    }
};

// --- 3. CORE LOGIC: KARAOKE HIGHLIGHT ---
// (GIỮ NGUYÊN 100% TỪ FILE GỐC CỦA BẠN ĐỂ ĐẢM BẢO KHÔNG LỖI)
function buildSpeechMap(parentNode) {
    if(!parentNode) return { speakableText: "", applyHighlight: ()=>{}, clearHighlights: ()=>{} };

    let speakableText = '';
    const domMap = []; // Map từng ký tự trong speakableText về node gốc
    const HIGHLIGHT_CLASS = 'current-word-highlight';
    const wrapperSpans = [];

    function traverse(node) {
        if (node.nodeType === 3) { // Text node
            // Chỉ lấy text nếu không nằm trong RUBY (để tránh lặp Kanji)
            if(node.parentNode.nodeName !== 'RUBY' && node.parentNode.nodeName !== 'RT') {
                const txt = node.textContent;
                speakableText += txt;
                for(let i=0; i<txt.length; i++) domMap.push(node);
            }
        } else if (node.nodeType === 1) { // Element node
            if (node.nodeName === 'RUBY') {
                // Lấy phần Furigana (<rt>) để đọc
                let reading = node.querySelector('rt')?.textContent || node.innerText;
                speakableText += reading;
                // Gán cả cụm Ruby này cho các ký tự phiên âm (để highlight cả cụm)
                for(let i=0; i<reading.length; i++) domMap.push(node);
            } else if (node.nodeName !== 'RT' && node.nodeName !== 'RP') {
                node.childNodes.forEach(traverse);
            }
        }
    }
    parentNode.childNodes.forEach(traverse);

    return { 
        speakableText, 
        applyHighlight: (start, len) => {
            // Xóa highlight cũ
            wrapperSpans.forEach(s => s.parentNode?.replaceChild(s.firstChild, s)); 
            wrapperSpans.length = 0;
            parentNode.querySelectorAll('.'+HIGHLIGHT_CLASS).forEach(e => e.classList.remove(HIGHLIGHT_CLASS));
            
            // Highlight mới
            const nodes = new Set();
            for (let i = start; i < start + len; i++) {
                if (domMap[i]) nodes.add(domMap[i]);
            }
            nodes.forEach(n => {
                if(n.nodeType === 1) {
                    n.classList.add(HIGHLIGHT_CLASS);
                } else {
                    const s = document.createElement('span'); s.className = HIGHLIGHT_CLASS;
                    n.parentNode?.insertBefore(s, n); s.appendChild(n); wrapperSpans.push(s);
                }
            });
        },
        clearHighlights: () => {
            wrapperSpans.forEach(s => s.parentNode?.replaceChild(s.firstChild, s)); wrapperSpans.length = 0;
            parentNode.querySelectorAll('.'+HIGHLIGHT_CLASS).forEach(e => e.classList.remove(HIGHLIGHT_CLASS));
        }
    };
}

// --- 4. PLAYER CONTROLLER ---
let playerState = {
    currentIndex: 0,
    isPlaying: false,
    isPaused: false,
    langMode: 'jp',
    scriptLines: [],
    activeSpeechMap: null, // Cái này quản lý highlight
    currentLessonConfig: {} 
};

function initPlayer(lines, lessonConfig) {
    playerState.scriptLines = lines;
    playerState.currentLessonConfig = lessonConfig || {};
    stopPlayer();
}

// Xử lý nút bấm (Hỗ trợ cả 2 giao diện)
function playMode(lang) {
    if (playerState.isPaused && playerState.isPlaying) {
        playerState.isPaused = false;
        window.speechSynthesis.resume();
        updatePauseBtnUI();
        return;
    }
    stopPlayer();
    playerState.langMode = lang;
    playerState.currentIndex = 0;
    playerState.isPlaying = true;
    playerState.isPaused = false;
    updatePauseBtnUI();
    speakNext();
}

// Hàm tương thích ngược cho Maker cũ
function playAll(lang) { playMode(lang); }

function togglePause() {
    if(!playerState.isPlaying) return;
    if(playerState.isPaused) { 
        playerState.isPaused = false;
        window.speechSynthesis.resume();
    } else { 
        playerState.isPaused = true;
        window.speechSynthesis.cancel();
    }
    updatePauseBtnUI();
}

function stopPlayer() {
    window.speechSynthesis.cancel();
    playerState.isPlaying = false;
    playerState.isPaused = false;
    if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
    document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
    updatePauseBtnUI();
}

function updatePauseBtnUI() {
    const btn = document.querySelector('.btn-pause') || document.getElementById('btnPause');
    if(!btn) return;
    if (playerState.isPaused) {
        btn.innerHTML = '▶ Tiếp tục';
        btn.style.background = '#fff9c4'; 
    } else {
        btn.innerHTML = '⏸ Tạm dừng';
        btn.style.background = '';
    }
}

function speakNext() {
    if(!playerState.isPlaying || playerState.currentIndex >= playerState.scriptLines.length) {
        playerState.isPlaying = false;
        return;
    }
    if(playerState.isPaused) return;

    const lineData = playerState.scriptLines[playerState.currentIndex];
    
    // 1. Highlight dòng (Row)
    const rowEl = document.getElementById(lineData.rowId);
    if (rowEl) {
        document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
        rowEl.classList.add('active');
        rowEl.scrollIntoView({behavior: "smooth", block: "center"});
    }

    // 2. Lấy nội dung & Chuẩn bị Map Highlight
    let textToSpeak = "";
    if (playerState.langMode === 'jp') {
        // Dùng hàm buildSpeechMap gốc -> Đảm bảo đọc Furigana và Highlight đúng
        playerState.activeSpeechMap = buildSpeechMap(document.getElementById(lineData.jpId));
        textToSpeak = playerState.activeSpeechMap.speakableText;
    } else {
        if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
        const vnEl = document.getElementById(lineData.vnId);
        textToSpeak = vnEl ? vnEl.textContent : "";
        if(!textToSpeak) {
            playerState.currentIndex++;
            speakNext(); 
            return;
        }
    }

    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.rate = 1.0; 

    // 3. Chọn giọng (Logic mới)
    const savedVoiceConfig = playerState.currentLessonConfig[lineData.char];
    const preferredURI = savedVoiceConfig ? savedVoiceConfig[playerState.langMode] : null;
    const bestVoice = voiceManager.getBestVoice(lineData.char, preferredURI, playerState.langMode);
    
    if(bestVoice) utter.voice = bestVoice;

    // 4. Highlight Karaoke (Chỉ chạy khi có speechMap)
    if(playerState.langMode === 'jp') {
        utter.onboundary = (event) => {
            if(playerState.isPaused) return; 
            if(event.name === 'word' && playerState.activeSpeechMap) {
                // Mapping highlight chính xác theo file gốc
                playerState.activeSpeechMap.applyHighlight(event.charIndex, event.charLength);
            }
        };
    }

    utter.onend = () => {
        if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
        if(playerState.isPaused) return; 
        if(playerState.isPlaying) {
            playerState.currentIndex++;
            setTimeout(speakNext, 600);
        }
    };
    
    utter.onerror = (e) => { 
        if(!playerState.isPaused && playerState.isPlaying) {
            console.log("Skip error:", e);
            playerState.currentIndex++;
            speakNext();
        } 
    };

    window.speechSynthesis.speak(utter);
}
