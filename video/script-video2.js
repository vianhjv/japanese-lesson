/* --- FILE: script.js --- */

// CẤU HÌNH VAI DIỄN MẶC ĐỊNH (Để tự động chọn nếu chưa setup)
const DEFAULT_ROLES = {
    "An": ["Nanami", "Female"],
    "Tanaka": ["Keita", "Male"],
    "Yamada": ["Ichiro", "Male"],
    "Suzuki": ["Ayumi", "Female"],
    "Sato": ["Ayumi", "Female"],
    "Narrator": ["Male"]
};

// --- 1. CORE LOGIC: QUẢN LÝ GIỌNG (FALLBACK SYSTEM) ---
const voiceManager = {
    jpVoices: [], vnVoices: [], 
    
    init: function() {
        return new Promise((resolve) => {
            const load = () => {
                const all = window.speechSynthesis.getVoices();
                if(all.length > 0) {
                    this.jpVoices = all.filter(v => v.lang.includes('ja'));
                    this.vnVoices = all.filter(v => v.lang.includes('vi'));
                    console.log(`Voices loaded: ${this.jpVoices.length} JP, ${this.vnVoices.length} VN`);
                    resolve();
                }
            };
            window.speechSynthesis.onvoiceschanged = load;
            load();
            // Fallback an toàn nếu trình duyệt không bắn sự kiện
            setTimeout(resolve, 1000); 
        });
    },

    // Hàm quan trọng: Tìm giọng phù hợp nhất
    getBestVoice: function(charName, preferredURI, langType) {
        const availableVoices = langType === 'jp' ? this.jpVoices : this.vnVoices;
        if (!availableVoices || availableVoices.length === 0) return null;

        // Ưu tiên 1: Tìm đúng giọng đã lưu trong config (Dành cho máy của bạn)
        if (preferredURI) {
            const exactMatch = availableVoices.find(v => v.voiceURI === preferredURI);
            if (exactMatch) return exactMatch;
        }

        // Ưu tiên 2: Tìm theo Vai diễn (DEFAULT_ROLES) - MỚI THÊM VÀO
        if (langType === 'jp' && charName && DEFAULT_ROLES[charName]) {
            for (let keyword of DEFAULT_ROLES[charName]) {
                const roleMatch = availableVoices.find(v => v.name.includes(keyword) || v.voiceURI.includes(keyword));
                if (roleMatch) return roleMatch;
            }
        }

        // Ưu tiên 3: Fallback về giọng đầu tiên
        return availableVoices[0]; 
    }
};

// --- 2. CORE LOGIC: KARAOKE HIGHLIGHT (GIỮ NGUYÊN TỪ FILE GỐC CỦA BẠN) ---
function buildSpeechMap(parentNode) {
    if(!parentNode) return { speakableText: "", applyHighlight: ()=>{}, clearHighlights: ()=>{} };

    let speakableText = '';
    const domMap = [];
    const HIGHLIGHT_CLASS = 'current-word-highlight';
    const wrapperSpans = [];

    function traverse(node) {
        if (node.nodeType === 3) { // Text node
            // Chỉ lấy text nếu không nằm trong RUBY (để tránh lặp) hoặc RT (đã xử lý ở dưới)
            if(node.parentNode.nodeName !== 'RUBY' && node.parentNode.nodeName !== 'RT') {
                const txt = node.textContent;
                speakableText += txt;
                for(let i=0; i<txt.length; i++) domMap.push(node);
            }
        } else if (node.nodeType === 1) { // Element node
            if (node.nodeName === 'RUBY') {
                // Lấy nội dung trong thẻ RT (Furigana) để đọc
                let reading = node.querySelector('rt')?.textContent || node.innerText;
                speakableText += reading;
                // Map toàn bộ thẻ RUBY vào các ký tự của Furigana để khi đọc đến thì tô màu cả cục Ruby
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
                    // Nếu là text node thì bọc trong span để tô màu
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

// --- 3. PLAYER CONTROLLER ---
let playerState = {
    currentIndex: 0,
    isPlaying: false,
    isPaused: false,
    langMode: 'jp',
    scriptLines: [],
    activeSpeechMap: null,
    currentLessonConfig: {} 
};

function initPlayer(lines, lessonConfig) {
    playerState.scriptLines = lines;
    playerState.currentLessonConfig = lessonConfig || {};
    stopPlayer();
}

// Hàm được gọi từ các nút bấm ở index.html (playMode('jp'), playMode('vn'))
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

function togglePause() {
    if(!playerState.isPlaying) return;
    
    if(playerState.isPaused) { // Resume
        playerState.isPaused = false;
        window.speechSynthesis.resume();
    } else { // Pause
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
    // Chỉ cập nhật nếu nút tồn tại (để tránh lỗi ở trang Maker)
    const btn = document.querySelector('.btn-pause');
    if(!btn) return;
    
    // Cập nhật text nút Pause cho trực quan
    if (playerState.isPaused) {
        btn.innerHTML = '▶ Tiếp tục';
        btn.style.background = '#fff9c4'; 
    } else {
        btn.innerHTML = '⏸ Tạm dừng';
        btn.style.background = '#fff3e0';
    }
}

function speakNext() {
    if(!playerState.isPlaying || playerState.currentIndex >= playerState.scriptLines.length) {
        playerState.isPlaying = false;
        return;
    }
    if(playerState.isPaused) return;

    const lineData = playerState.scriptLines[playerState.currentIndex];
    
    // 1. Highlight dòng hội thoại (Row Active)
    const rowEl = document.getElementById(lineData.rowId);
    if (rowEl) {
        document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
        rowEl.classList.add('active');
        rowEl.scrollIntoView({behavior: "smooth", block: "center"});
    }

    // 2. Chuẩn bị Text để đọc
    let textToSpeak = "";
    if (playerState.langMode === 'jp') {
        // Dùng logic cũ để lấy text Furigana và chuẩn bị Highlight từng từ
        playerState.activeSpeechMap = buildSpeechMap(document.getElementById(lineData.jpId));
        textToSpeak = playerState.activeSpeechMap.speakableText;
    } else {
        // Tiếng Việt thì đơn giản hơn
        if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
        const vnEl = document.getElementById(lineData.vnId);
        textToSpeak = vnEl ? vnEl.textContent : "";
        if(!textToSpeak) {
            // Nếu không có tiếng Việt, bỏ qua câu này
            playerState.currentIndex++;
            speakNext(); 
            return;
        }
    }

    const utter = new SpeechSynthesisUtterance(textToSpeak);
    utter.rate = 1.0; 

    // 3. Gán giọng nói (Assign Voice)
    const savedVoiceConfig = playerState.currentLessonConfig[lineData.char];
    const preferredURI = savedVoiceConfig ? savedVoiceConfig[playerState.langMode] : null;
    
    // Tìm giọng tốt nhất (Config -> Role -> Default)
    const bestVoice = voiceManager.getBestVoice(lineData.char, preferredURI, playerState.langMode);
    
    if(bestVoice) utter.voice = bestVoice;
    // else: Để trình duyệt tự chọn giọng mặc định theo ngôn ngữ

    // 4. Sự kiện (Karaoke Highlight)
    if(playerState.langMode === 'jp') {
        utter.onboundary = (event) => {
            if(playerState.isPaused) return; 
            if(event.name === 'word' && playerState.activeSpeechMap) {
                // Highlight chữ đang đọc
                playerState.activeSpeechMap.applyHighlight(event.charIndex, event.charLength);
            }
        };
    }

    utter.onend = () => {
        if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
        if(playerState.isPaused) return; 
        
        if(playerState.isPlaying) {
            playerState.currentIndex++;
            // Nghỉ 600ms rồi đọc câu tiếp
            setTimeout(speakNext, 600);
        }
    };
    
    utter.onerror = (e) => { 
        if(!playerState.isPaused && playerState.isPlaying) {
            console.log("Audio Err (Skip):", e);
            playerState.currentIndex++;
            speakNext();
        } 
    };

    window.speechSynthesis.speak(utter);
}
