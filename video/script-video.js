/* --- FILE: script.js --- */

// --- 1. CORE LOGIC: QUẢN LÝ GIỌNG (FALLBACK SYSTEM) ---
const voiceManager = {
    jpVoices: [], vnVoices: [], 
    // Cache map: Lưu trữ giọng đã gán cho từng nhân vật trong phiên làm việc này
    runtimeAssignments: {}, 

    init: function() {
        return new Promise((resolve) => {
            const load = () => {
                const all = window.speechSynthesis.getVoices();
                this.jpVoices = all.filter(v => v.lang.includes('ja'));
                this.vnVoices = all.filter(v => v.lang.includes('vi'));
                resolve();
            };
            window.speechSynthesis.onvoiceschanged = load;
            load();
        });
    },

    // Hàm quan trọng: Tìm giọng phù hợp nhất cho môi trường hiện tại
    getBestVoice: function(charName, preferredURI, langType) {
        const availableVoices = langType === 'jp' ? this.jpVoices : this.vnVoices;
        if (availableVoices.length === 0) return null;

        // Ưu tiên 1: Tìm đúng giọng đã lưu trong config (Dành cho máy của bạn)
        if (preferredURI) {
            const exactMatch = availableVoices.find(v => v.voiceURI === preferredURI);
            if (exactMatch) return exactMatch;
        }

        // Ưu tiên 2: Nếu không tìm thấy giọng lưu, thử tìm giọng cùng đặc tính (Nếu có logic nâng cao)
        // Hiện tại ta sẽ fallback về giọng đầu tiên của danh sách (Default của trình duyệt)
        return availableVoices[0]; 
    }
};

// --- 2. CORE LOGIC: KARAOKE HIGHLIGHT ---
function buildSpeechMap(parentNode) {
    let speakableText = '';
    const domMap = [];
    const HIGHLIGHT_CLASS = 'current-word-highlight';
    const wrapperSpans = [];

    function traverse(node) {
        if (node.nodeType === 3) { // Text node
            if(node.parentNode.nodeName !== 'RUBY' && node.parentNode.nodeName !== 'RT') {
                const txt = node.textContent;
                speakableText += txt;
                for(let i=0; i<txt.length; i++) domMap.push(node);
            }
        } else if (node.nodeType === 1) { // Element node
            if (node.nodeName === 'RUBY') {
                let reading = node.querySelector('rt')?.textContent || node.innerText;
                speakableText += reading;
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
            // Reset cũ
            wrapperSpans.forEach(s => s.parentNode?.replaceChild(s.firstChild, s)); 
            wrapperSpans.length = 0;
            parentNode.querySelectorAll('.'+HIGHLIGHT_CLASS).forEach(e => e.classList.remove(HIGHLIGHT_CLASS));
            
            // Highlight mới
            const nodes = new Set();
            for (let i = start; i < start + len; i++) if (domMap[i]) nodes.add(domMap[i]);
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

// --- 3. PLAYER CONTROLLER ---
let playerState = {
    currentIndex: 0,
    isPlaying: false,
    isPaused: false,
    langMode: 'jp',
    scriptLines: [],
    activeSpeechMap: null,
    currentLessonConfig: {} // Cấu hình giọng của bài học hiện tại
};

function initPlayer(lines, lessonConfig) {
    playerState.scriptLines = lines;
    playerState.currentLessonConfig = lessonConfig || {};
    stopPlayer();
}

function playAll(lang) {
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
        speakNext(); 
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
    const btn = document.getElementById('btnPause');
    if(!btn) return;
    btn.innerHTML = playerState.isPaused ? '▶ Continue' : '⏸ Pause';
    btn.style.background = playerState.isPaused ? '#fff9c4' : '#e0f2f1';
}

function speakNext() {
    if(!playerState.isPlaying || playerState.currentIndex >= playerState.scriptLines.length) {
        playerState.isPlaying = false;
        return;
    }
    if(playerState.isPaused) return;

    const lineData = playerState.scriptLines[playerState.currentIndex];
    const rowEl = document.getElementById(lineData.rowId);
    
    // UI Actions
    document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
    rowEl.classList.add('active');
    rowEl.scrollIntoView({behavior: "smooth", block: "center"});

    // Prepare Text
    let textToSpeak = "";
    if (playerState.langMode === 'jp') {
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
    utter.rate = 0.9;

    // --- ASSIGN VOICE (LOGIC QUAN TRỌNG) ---
    // Tìm cấu hình giọng đã lưu cho nhân vật này trong data.js
    const savedVoiceConfig = playerState.currentLessonConfig[lineData.char]; // { jp: 'URI...', vn: 'URI...' }
    const preferredURI = savedVoiceConfig ? savedVoiceConfig[playerState.langMode] : null;
    
    // Nhờ voiceManager tìm giọng tốt nhất (Có thì dùng, không có thì fallback)
    const bestVoice = voiceManager.getBestVoice(lineData.char, preferredURI, playerState.langMode);
    
    if(bestVoice) utter.voice = bestVoice;
    else utter.lang = playerState.langMode === 'jp' ? 'ja-JP' : 'vi-VN';

    // Events
    if(playerState.langMode === 'jp') {
        utter.onboundary = (event) => {
            if(playerState.isPaused) return; 
            if(event.name === 'word' && playerState.activeSpeechMap) {
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
    
    utter.onerror = (e) => { if(!playerState.isPaused) console.log("Audio Err", e); };

    window.speechSynthesis.speak(utter);
}