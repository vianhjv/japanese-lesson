/* --- FILE: script.js --- */

// --- 1. BẢNG PHÂN VAI (Logic từ Maker) ---
const ROLE_MAPPING = {
    "An":       { jp: ["Nanami", "Female"], vn: ["HoaiMy", "Female"] },
    "Tanaka":   { jp: ["Keita", "Male"],    vn: ["NamMinh", "Male"] },
    "Suzuki":   { jp: ["Ayumi", "Female"],  vn: ["HoaiMy", "Female"] },
    "Yamada":   { jp: ["Ichiro", "Male"],   vn: ["NamMinh", "Male"] },
    "Sato":     { jp: ["Ayumi", "Female"],  vn: ["HoaiMy", "Female"] },
    "Narrator": { jp: ["Sayaka", "Google"], vn: ["HoaiMy", "Google"] }
};

// --- 2. QUẢN LÝ GIỌNG ---
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
            setTimeout(resolve, 1000); 
        });
    },

    getBestVoice: function(charName, preferredURI, langType) {
        const availableVoices = langType === 'jp' ? this.jpVoices : this.vnVoices;
        if (!availableVoices || availableVoices.length === 0) return null;

        if (preferredURI) {
            const exactMatch = availableVoices.find(v => v.voiceURI === preferredURI);
            if (exactMatch) return exactMatch;
        }

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
        return availableVoices[0]; 
    }
};

// --- 3. CORE LOGIC: KARAOKE HIGHLIGHT (Giữ nguyên logic gốc) ---
function buildSpeechMap(parentNode) {
    if(!parentNode) return { speakableText: "", applyHighlight: ()=>{}, clearHighlights: ()=>{} };

    let speakableText = '';
    const domMap = []; 
    const HIGHLIGHT_CLASS = 'current-word-highlight';
    const wrapperSpans = [];

    function traverse(node) {
        if (node.nodeType === 3) { 
            if(node.parentNode.nodeName !== 'RUBY' && node.parentNode.nodeName !== 'RT') {
                const txt = node.textContent;
                speakableText += txt;
                for(let i=0; i<txt.length; i++) domMap.push(node);
            }
        } else if (node.nodeType === 1) { 
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
            wrapperSpans.forEach(s => s.parentNode?.replaceChild(s.firstChild, s)); 
            wrapperSpans.length = 0;
            parentNode.querySelectorAll('.'+HIGHLIGHT_CLASS).forEach(e => e.classList.remove(HIGHLIGHT_CLASS));
            
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
    activeSpeechMap: null, 
    currentLessonConfig: {} 
};

function initPlayer(lines, lessonConfig) {
    playerState.scriptLines = lines;
    playerState.currentLessonConfig = lessonConfig || {};
    stopPlayer();
}

function playMode(lang) {
    // Nếu đang Pause mà bấm lại nút Nghe -> Resume
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

// Tương thích ngược Maker
function playAll(lang) { playMode(lang); }

// --- HÀM TOGGLE PAUSE (ĐÃ SỬA LỖI) ---
function togglePause() {
    if(!playerState.isPlaying) return;
    
    if(playerState.isPaused) { 
        // Đang dừng -> Bấm để chạy tiếp
        playerState.isPaused = false;
        window.speechSynthesis.resume(); // Dùng RESUME thay vì speakNext
    } else { 
        // Đang chạy -> Bấm để dừng
        playerState.isPaused = true;
        window.speechSynthesis.pause(); // Dùng PAUSE thay vì CANCEL
    }
    updatePauseBtnUI();
}

function stopPlayer() {
    window.speechSynthesis.cancel(); // Stop hẳn thì dùng Cancel
    playerState.isPlaying = false;
    playerState.isPaused = false;
    if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
    document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
    updatePauseBtnUI();
}

function updatePauseBtnUI() {
    // Tìm nút Pause ở cả 2 giao diện
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
    
    // Highlight
    const rowEl = document.getElementById(lineData.rowId);
    if (rowEl) {
        document.querySelectorAll('.row').forEach(r => r.classList.remove('active'));
        rowEl.classList.add('active');
        rowEl.scrollIntoView({behavior: "smooth", block: "center"});
    }

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
    utter.rate = 1.0; 

    // Voice
    const savedVoiceConfig = playerState.currentLessonConfig[lineData.char];
    const preferredURI = savedVoiceConfig ? savedVoiceConfig[playerState.langMode] : null;
    const bestVoice = voiceManager.getBestVoice(lineData.char, preferredURI, playerState.langMode);
    
    if(bestVoice) utter.voice = bestVoice;

    // Events
    if(playerState.langMode === 'jp') {
        utter.onboundary = (event) => {
            // Quan trọng: Nếu đang Pause thì không highlight nữa
            if(playerState.isPaused) return; 
            if(event.name === 'word' && playerState.activeSpeechMap) {
                playerState.activeSpeechMap.applyHighlight(event.charIndex, event.charLength);
            }
        };
    }

    utter.onend = () => {
        if(playerState.activeSpeechMap) playerState.activeSpeechMap.clearHighlights();
        
        // Nếu bị pause giữa chừng thì không tự nhảy câu tiếp
        if(playerState.isPaused) return; 
        
        if(playerState.isPlaying) {
            playerState.currentIndex++;
            setTimeout(speakNext, 600);
        }
    };
    
    utter.onerror = (e) => { 
        // Lỗi cũng bỏ qua nếu đang pause
        if(!playerState.isPaused && playerState.isPlaying) {
            console.log("Skip error:", e);
            playerState.currentIndex++;
            speakNext();
        } 
    };

    window.speechSynthesis.speak(utter);
}
