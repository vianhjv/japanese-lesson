/* =========================================================
   SCRIPT N5 ULTIMATE - TEMPLATE CHUẨN CHO 30 BÀI HỌC
   (Hỗ trợ Kế thừa ảnh, Highlight từng chữ, Lọc Emoji, Đổi giọng)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

    // Biến toàn cục để theo dõi và dọn dẹp hiệu ứng cũ khi bấm nút loa mới
    let activeSpeechMap = null;
    let activeHighlightContainer = null;
    let activePlayBtn = null;
  // THÊM DÒNG NÀY: Bộ nhận diện thiết bị iOS (iPhone / iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);



    function stopAllActiveSpeech() {
        speechSynthesis.cancel();
        
        // Dọn dẹp highlight chữ màu xanh ngọc
        if (activeSpeechMap) {
            activeSpeechMap.clearHighlights();
            activeSpeechMap = null;
        }
        // Dọn dẹp nền vàng của ô Từ vựng/Chat
        if (activeHighlightContainer) {
            activeHighlightContainer.classList.remove('is-playing');
            activeHighlightContainer = null;
        }
        // Trả lại icon loa mặc định
        if (activePlayBtn) {
            activePlayBtn.classList.remove('speaking-icon');
            if (activePlayBtn.classList.contains('dialogue-play-btn')) {
                activePlayBtn.innerHTML = '🔊';
            }
            activePlayBtn = null;
        }
    }


    // === PHẦN 0: BỘ QUẢN LÝ GIỌNG ĐỌC (Tự động luân phiên Nam/Nữ) ===
    const voiceManager = {
        japaneseVoices:[],
        characterMap: {},
        defaultVoice: null,
        voicesLoaded: false,
        // Cài đặt giọng cho từng nhân vật (Sửa tên nhân vật ở đây cho các bài khác)
        preferences: { 'an': 'nanami', 'kim': 'haruka', 'suzuki': 'ayumi', 'tanaka': 'keita', 'sato': 'ichiro' },
        
        init: function() {
            const loadVoices = () => {
                const voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                    this.japaneseVoices = voices.filter(v => v.lang.startsWith('ja'));
                    if (this.japaneseVoices.length > 0) {
                        this.voicesLoaded = true;
                        this.defaultVoice = this.japaneseVoices[0]; // Giọng mặc định an toàn
                        this.japaneseVoices.forEach(v => {
                            const name = v.name.toLowerCase();
                            for (const [key, kw] of Object.entries(this.preferences)) { 
                                if (name.includes(kw)) this.characterMap[key] = v; 
                            }
                        });
                    }
                }
            };
            speechSynthesis.onvoiceschanged = loadVoices;
            loadVoices();
            // Fallback (Bảo hiểm): Lặp lại kiểm tra nếu trình duyệt tải giọng chậm
            let attempts = 0;
            const interval = setInterval(() => {
                loadVoices();
                if (this.voicesLoaded || attempts++ > 10) clearInterval(interval);
            }, 500);
        },

        getVoiceFor: function(charName) {
            // 1. Ưu tiên 1: Tìm đúng giọng nhân vật đã cấu hình
            let voice = this.characterMap[charName];
            if (voice) return voice;

            // 2. Ưu tiên 2: Nếu máy học viên không có giọng đó, tự động lấy giọng nữ phổ biến (Kyoko của iOS hoặc Google của Android/Win)
            let fallbackVoice = this.japaneseVoices.find(v => v.name.includes('Kyoko') || v.name.includes('Google'));
            
            // 3. Ưu tiên 3: Nếu vẫn không có, lấy giọng tiếng Nhật ĐẦU TIÊN mà máy tính của họ có
            return fallbackVoice || this.defaultVoice;} 
    

    };


    // === PHẦN 1: BỘ NÃO ĐỌC & TẠO BẢN ĐỒ HIGHLIGHT (TRÁI TIM HỆ THỐNG) ===
    function buildSpeechMap(parentNode) {
        let speakableText = '';
        const domMap =[];
        const HIGHLIGHT_CLASS = 'current-word-highlight';
        const wrapperSpans =[];

        // Lọc Emoji để không bị đọc tiếng "tích" và không làm lệch vị trí highlight
        const isEmoji = (char) => {
            return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✨🎉💼😊]/gu.test(char);
        };

        function traverse(node) {
            if (node.nodeType === 3) { // Nếu là văn bản thường
                const chars = Array.from(node.textContent);
                for (let char of chars) {
                    if (!isEmoji(char)) { // Bỏ qua Emoji
                        speakableText += char;
                        domMap.push(node); // Lưu thẻ HTML tương ứng với từng chữ cái
                    }
                }
            } else if (node.nodeType === 1) { // Nếu là thẻ HTML
                if (node.nodeName === 'RUBY') {
                    // Ưu tiên đọc Furigana (thẻ rt)
                    const rt = node.querySelector('rt');
                    const textToRead = rt ? rt.textContent : node.textContent;
                    const chars = Array.from(textToRead);
                    for (let char of chars) {
                        if (!isEmoji(char)) {
                            speakableText += char;
                            domMap.push(node); // Map toàn bộ thẻ Ruby cho chữ này
                        }
                    }
                } else if (!['RT', 'RP'].includes(node.nodeName)) {
                    // Đệ quy chui vào các thẻ con (trừ thẻ Furigana đã xử lý ở trên)
                    node.childNodes.forEach(traverse);
                }
            }
        }
        traverse(parentNode);

        // Hàm Xóa Highlight
        function clearHighlights() {
            wrapperSpans.forEach(span => {
                const parent = span.parentNode;
                if (parent) { 
                    parent.replaceChild(span.firstChild, span); 
                    parent.normalize(); 
                }
            });
            wrapperSpans.length = 0;
            parentNode.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
        }

        // Hàm Thêm Highlight khi máy đang đọc
        function applyHighlight(startIndex, length) {
            clearHighlights();
            if (startIndex === undefined) return;
            const nodesToHighlight = new Set();
            for (let i = startIndex; i < startIndex + length; i++) {
                if (domMap[i]) nodesToHighlight.add(domMap[i]);
            }
            
            nodesToHighlight.forEach(node => {
                if (node.nodeType === 1) { // Nếu là thẻ HTML (ví dụ: Ruby)
                    node.classList.add(HIGHLIGHT_CLASS);
                } else if (node.nodeType === 3) { // Nếu là text thuần túy
                    const span = document.createElement('span');
                    span.className = HIGHLIGHT_CLASS;
                    const parent = node.parentNode;
                    parent.insertBefore(span, node);
                    span.appendChild(node);
                    wrapperSpans.push(span);
                }
            });
        }

        return { speakableText, applyHighlight, clearHighlights };
    }


    // === PHẦN 2: ĐIỀU KHIỂN HỘI THOẠI (AN'S STORY) ===
    function initStoryController() {
        const container = document.querySelector('.scene-container');
        if (!container) return;

        const displayWindow = container.querySelector('.dialogue-display-window');
        const scenes = document.querySelectorAll('.dialogue-source .scene');
        const bgImage = container.querySelector('.scene-background-image');
        const prevBtn = container.querySelector('#prevBtn');
        const nextBtn = container.querySelector('#nextBtn');
        const counter = container.querySelector('#counter');

        let currentSceneIdx = 0, currentLineIdx = 0;

        function showLine(sIdx, lIdx) {
            stopAllActiveSpeech(); // Dừng đọc và xóa màu câu cũ khi chuyển câu mới

            const lines = scenes[sIdx].querySelectorAll('.dialogue-line');
            if (!lines[lIdx]) return;
            const line = lines[lIdx];
            currentLineIdx = lIdx;

            // Xử lý ảnh nền kế thừa thông minh
            let bgUrl = line.getAttribute('data-line-bg');
            let tempIdx = lIdx;
            while ((bgUrl === "." || !bgUrl) && tempIdx > 0) {
                tempIdx--;
                bgUrl = lines[tempIdx].getAttribute('data-line-bg');
            }
            if (bgUrl && bgUrl !== "." && bgImage && !bgImage.src.includes(bgUrl)) {
                bgImage.style.opacity = 0;
                setTimeout(() => { bgImage.src = bgUrl; bgImage.style.opacity = 1; }, 300);
            }

            // Hiển thị text và gán sự kiện loa
            displayWindow.style.opacity = 0;
            setTimeout(() => {
                displayWindow.innerHTML = line.innerHTML;
                const textTarget = displayWindow.querySelector('.japanese-text');
                const speaker = displayWindow.querySelector('.speaker');
                const btn = displayWindow.querySelector('.dialogue-play-btn');

                if (btn && textTarget) {
                    btn.onclick = () => {
                        stopAllActiveSpeech(); // Dọn dẹp trước khi đọc

                        const speechMap = buildSpeechMap(textTarget);
                        activeSpeechMap = speechMap; // Gán toàn cục để theo dõi
                        activePlayBtn = btn;

                        const utterance = new SpeechSynthesisUtterance(speechMap.speakableText);
                        utterance.lang = 'ja-JP';
                        utterance.voice = voiceManager.getVoiceFor(speaker?.dataset.character);

// SỬA ĐOẠN NÀY ĐỂ CHỐNG LỖI CÂM TIẾNG TRÊN IPHONE
                        utterance.onstart = () => {
                            btn.innerHTML = '⏹️';
                            // Nếu là iPhone: Highlight sáng cả câu luôn từ đầu
                            if (isIOS) speechMap.applyHighlight(0, speechMap.speakableText.length);
                        };
                        
                        // Nếu KHÔNG PHẢI iPhone: Chạy highlight từng chữ mượt mà
                        if (!isIOS) {
                            utterance.onboundary = (e) => {
                                if (e.name === 'word') speechMap.applyHighlight(e.charIndex, e.charLength);
                            };
                        };


                        utterance.onend = () => stopAllActiveSpeech();
                        utterance.onerror = () => stopAllActiveSpeech();

                        speechSynthesis.speak(utterance);
                    };
                }
                if (counter) counter.textContent = `${lIdx + 1} / ${lines.length}`;
                if (prevBtn) prevBtn.disabled = (lIdx === 0);
                if (nextBtn) nextBtn.disabled = (lIdx === lines.length - 1);
                displayWindow.style.opacity = 1;
            }, 150);
        }

        if (nextBtn) nextBtn.onclick = () => showLine(currentSceneIdx, currentLineIdx + 1);
        if (prevBtn) prevBtn.onclick = () => showLine(currentSceneIdx, currentLineIdx - 1);
        loadScene(0);

        function loadScene(idx) {
            currentSceneIdx = idx;
            showLine(idx, 0);
        }
    }


    // === PHẦN 3: ĐIỀU KHIỂN CHAT, TỪ VỰNG, NGỮ PHÁP (NỀN VÀNG & HIGHLIGHT) ===
    function initGlobalSpeech() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.vocab-play-btn');
            if (!btn) return;

            // 1. Tìm khu vực chứa Text
            const header = btn.closest('.vocab-word-header, .example-jp');
            if (!header) return;
            const textTarget = header.querySelector('.vocab-term, .jp-sentence');
            if (!textTarget) return;

            // 2. Tìm khu vực để tô nền vàng
           // const wrapper = btn.closest('.vocab-card, .msg-bubble, .grammar-card');
            // 2. Tìm khu vực để tô nền vàng (Đã tối ưu dùng 1 class chung)
             const wrapper = btn.closest('.play-highlight-box');
            // 3. Chuẩn bị
            stopAllActiveSpeech(); // Dừng mọi thứ cũ
            const speechMap = buildSpeechMap(textTarget);
            activeSpeechMap = speechMap;
            activeHighlightContainer = wrapper;
            activePlayBtn = btn;

            // 4. Phát âm thanh
            if (speechMap.speakableText) {
                const utterance = new SpeechSynthesisUtterance(speechMap.speakableText);
                utterance.lang = 'ja-JP';
                utterance.rate = 0.9; // Đọc chậm lại một chút cho dễ nghe
                utterance.voice = voiceManager.getVoiceFor(btn.dataset.character || 'default');

                // Bắt đầu đọc: Tô nền vàng + Icon rung


// SỬA ĐOẠN NÀY ĐỂ CHỐNG LỖI CÂM TIẾNG TRÊN IPHONE
                utterance.onstart = () => {
                    if (wrapper) wrapper.classList.add('is-playing');
                    btn.classList.add('speaking-icon');
                    // Nếu là iPhone: Highlight xanh ngọc cả câu luôn từ đầu
                    if (isIOS) speechMap.applyHighlight(0, speechMap.speakableText.length);
                };
                
                // Đọc từng chữ: Highlight xanh ngọc (Chỉ chạy trên Windows/Android/Mac)
                if (!isIOS) {
                    utterance.onboundary = (event) => {
                        if (event.name === 'word') speechMap.applyHighlight(event.charIndex, event.charLength);
                    };
                };

                // Kết thúc: Dọn dẹp
                utterance.onend = () => stopAllActiveSpeech();
                utterance.onerror = () => stopAllActiveSpeech();

                speechSynthesis.speak(utterance);
            }
        });
    }


    // === PHẦN 4: BÀI TẬP TRẮC NGHIỆM (QUIZ) ===
    function initQuiz() {
        document.querySelectorAll('.quiz-card').forEach(card => {
            card.querySelectorAll('.option-btn').forEach(btn => {
                btn.onclick = () => {
                    if (card.classList.contains('answered')) return;
                    card.classList.add('answered');
                    
                    const isCorrect = btn.getAttribute('data-correct') === 'true';
                    btn.classList.add(isCorrect ? 'correct' : 'incorrect');
                    
                    if (!isCorrect) {
                        const correct = card.querySelector('[data-correct="true"]');
                        if (correct) correct.classList.add('correct');
                    }
                    
                    // Hiện hộp giải thích
                    const exp = card.querySelector('.explanation-box');
                    if (exp) exp.style.display = 'block';

                    // Khóa tất cả các nút lại
                    card.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
                };
            });
        });
    }



// === PHẦN 5: CHỨC NĂNG BẬT/TẮT FURIGANA (CÓ LƯU TRẠNG THÁI) ===
    function initFuriganaToggle() {
        const toggleBtn = document.getElementById('furiganaToggle');
        const body = document.body;
        
        if (!toggleBtn) return;

        // 1. Kiểm tra xem máy học viên đã lưu trạng thái tắt từ lần trước chưa
        const isFuriganaHidden = localStorage.getItem('hideN5Furigana') === 'true';
        
        // Hàm cập nhật Giao diện (Đổi chữ, đổi màu nút, ẩn/hiện chữ)
        const updateUI = (isHidden) => {
            if (isHidden) {
                body.classList.add('hide-furigana');
                toggleBtn.classList.add('is-hidden');
                toggleBtn.querySelector('.text').textContent = 'Bật Furigana';
            } else {
                body.classList.remove('hide-furigana');
                toggleBtn.classList.remove('is-hidden');
                toggleBtn.querySelector('.text').textContent = 'Tắt Furigana';
            }
        };

        // 2. Thiết lập trạng thái ngay khi vừa load web
        updateUI(isFuriganaHidden);

        // 3. Xử lý khi người dùng bấm nút
        toggleBtn.addEventListener('click', () => {
            // Xem trạng thái hiện tại đang là gì
            const currentlyHidden = body.classList.contains('hide-furigana');
            // Đảo ngược trạng thái
            const willHide = !currentlyHidden;
            
            // Cập nhật giao diện
            updateUI(willHide);
            // Lưu vào bộ nhớ trình duyệt để dùng cho các bài học khác
            localStorage.setItem('hideN5Furigana', willHide);
        });
    }



    // KHỞI CHẠY TẤT CẢ CÁC MODULE
    voiceManager.init();
    initStoryController();
    initGlobalSpeech();
    initQuiz();

    initFuriganaToggle(); // <--- BẠN THÊM DÒNG NÀY VÀO ĐÂY NHÉ
});
