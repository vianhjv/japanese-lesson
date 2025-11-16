
/* --- SCRIPT CHO CÁC BÀI HỌC KAIWA TIẾNG NHẬT (PHIÊN BẢN SỬA LỖI TOÀN DIỆN) --- */

document.addEventListener('DOMContentLoaded', () => {

    // === PHẦN 0: BỘ QUẢN LÝ GIỌNG ĐỌC (ỔN ĐỊNH HƠN) ===
    const voiceManager = {
        japaneseVoices: [],
        characterMap: {},
        defaultVoice: null,
        voicesLoaded: false,
        preferences: { 'an': 'nanami', 'suzuki': 'haruka', 'yamada': 'ichiro', 'tanaka': 'keita' },

        // Hàm khởi tạo, sẽ được gọi khi trang tải xong
        init: function() {
            // API getVoices() cần một chút thời gian để tải.
            // Sự kiện 'onvoiceschanged' sẽ được kích hoạt khi danh sách giọng đọc sẵn sàng.
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => this.loadVoices();
            }
            // Gọi loadVoices() ngay lập tức phòng trường hợp sự kiện không được kích hoạt
            this.loadVoices(); 
        },

        loadVoices: function() {
            if (this.voicesLoaded) return;
            
            this.japaneseVoices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ja'));
            
            if (this.japaneseVoices.length === 0) {
                console.warn("Không tìm thấy giọng đọc tiếng Nhật nào trên trình duyệt này. Chức năng đọc sẽ không hoạt động.");
                // Hiển thị thông báo cho người dùng
                const displayWindow = document.querySelector('.dialogue-display-window');
                if (displayWindow) {
                    displayWindow.innerHTML = `<p style="color: red; text-align: center;">Lỗi: Không tìm thấy giọng đọc tiếng Nhật trên trình duyệt của bạn. Vui lòng thử trên trình duyệt khác như Chrome hoặc Edge trên máy tính.</p>`;
                }
                return;
            }
            
            console.log("Các giọng đọc tiếng Nhật đã tìm thấy:", this.japaneseVoices);
            this.defaultVoice = this.japaneseVoices[0];

            // Logic tìm và gán giọng đọc cho nhân vật (giữ nguyên)
            const found = {};
            this.japaneseVoices.forEach(v => {
                const name = v.name.toLowerCase();
                for (const [key, kw] of Object.entries(this.preferences)) { if (name.includes(kw)) found[kw] = v; }
            });
            const female = this.japaneseVoices.filter(v => /nanami|haruka|ayumi/i.test(v.name));
            const male = this.japaneseVoices.filter(v => /ichiro|keita|kenji/i.test(v.name));
            const assign = (char, gender, idx) => found[this.preferences[char]] || (gender.length > 0 ? gender[idx % gender.length] : this.defaultVoice);
            this.characterMap = {
                'an': assign('an', female, 0), 'suzuki': assign('suzuki', female, 1),
                'yamada': assign('yamada', male, 0), 'tanaka': assign('tanaka', male, 1)
            };
            
            this.voicesLoaded = true;
            // Kích hoạt lại việc gán sự kiện click cho nút play sau khi đã có giọng đọc
            if (typeof activateSpeechForCurrentLine === 'function') activateSpeechForCurrentLine();
        },

        getVoiceFor: function(charName) {
            // Nếu giọng đọc chưa sẵn sàng, thử tải lại
            if (!this.voicesLoaded) this.loadVoices();
            return this.characterMap[charName] || this.defaultVoice;
        }
    };
    
    // Khởi tạo bộ quản lý giọng đọc ngay khi DOM sẵn sàng
    voiceManager.init();


    // === PHẦN 1: BỘ MÁY ĐỌC (ĐÃ SỬA LỖI TRIỆT ĐỂ) ===

// === PHẦN 1: BỘ MÁY ĐỌC (NÂNG CẤP VỚI HIGHLIGHT) ===
// === PHẦN 1: BỘ MÁY ĐỌC (PHIÊN BẢN SỬA LỖI TẠM DỪNG HOÀN CHỈNH) ===










    // === PHẦN 2: ĐIỀU KHIỂN HỘI THOẠI ĐA CẢNH (CÓ THAY ĐỔI NHỎ) ===
    const displayWindow = document.querySelector('.dialogue-display-window');
    const scenes = document.querySelectorAll('.dialogue-source .scene');
    const sceneNavContainer = document.getElementById('sceneNav');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const counter = document.getElementById('counter');
    const bgImage = document.querySelector('.scene-background-image');
    
    let currentSceneIndex = 0;
    let currentLineIndex = 0;
    let currentLineHandler = null;



// =========================================================================
// == PHẦN 1 & 2: HỆ THỐNG ĐIỀU KHIỂN HỘI THOẠI (PHIÊN BẢN ỔN ĐỊNH) ==
// =========================================================================

// Biến toàn cục duy nhất để quản lý handler của dòng thoại đang hoạt động
let activeDialogueHandler = null;

/**
 * "Bộ não" xử lý việc đọc cho MỘT dòng thoại.
 * Nó tự quản lý trạng thái và giao diện của chính nó.
 */
function createSpeechHandler(targetElement, characterName) {
    const originalHTML = targetElement.innerHTML;
    let charMap = [];
    let plainText = '';
    let utterance = null;
    let status = 'stopped'; // Các trạng thái: 'stopped', 'playing', 'paused'

    const btn = displayWindow.querySelector('.dialogue-play-btn');

    // Chuẩn bị văn bản và các thẻ span để highlight
    function _prepareForSpeech() {
        plainText = '';
        charMap = [];
        targetElement.innerHTML = originalHTML; // Luôn bắt đầu từ HTML sạch

        function wrapCharsInSpans(parentNode) {
            const nodes = Array.from(parentNode.childNodes);
            for (const node of nodes) {
                if (node.nodeType === 3 && node.parentNode.nodeName !== 'RT') {
                    const text = node.textContent;
                    const fragment = document.createDocumentFragment();
                    for (const char of text) {
                        plainText += char;
                        const span = document.createElement('span');
                        span.textContent = char;
                        fragment.appendChild(span);
                        charMap.push(span);
                    }
                    parentNode.replaceChild(fragment, node);
                } else if (node.nodeType === 1) {
                    wrapCharsInSpans(node);
                }
            }
        }
        wrapCharsInSpans(targetElement);
    }

    // Dọn dẹp và khôi phục trạng thái ban đầu
    function _cleanup() {
        targetElement.innerHTML = originalHTML;
        status = 'stopped';
        if (btn) btn.innerHTML = '🔊';
        utterance = null;
    }

    // Bắt đầu đọc từ đầu
    function _play() {
        speechSynthesis.cancel(); // Dừng mọi thứ khác
        _prepareForSpeech();

        if (!plainText.trim()) return;
        const voice = voiceManager.getVoiceFor(characterName);
        if (!voice) return;

        utterance = new SpeechSynthesisUtterance(plainText);
        utterance.lang = 'ja-JP';
        utterance.rate = 1.0;
        utterance.voice = voice;

        utterance.onboundary = (event) => {
            charMap.forEach(span => span.classList.remove('dialogue-word-highlight'));
            if (event.name === 'word') {
                for (let i = 0; i < event.charLength; i++) {
                    if (charMap[event.charIndex + i]) {
                        charMap[event.charIndex + i].classList.add('dialogue-word-highlight');
                    }
                }
            }
        };

        utterance.onend = _cleanup;
        utterance.onerror = (event) => {
            console.error('SpeechSynthesis Error:', event);
            _cleanup();
        };

        speechSynthesis.speak(utterance);
        status = 'playing';
        if (btn) btn.innerHTML = '⏹️';
    }

    function _pause() {
        speechSynthesis.pause();
        status = 'paused';
        if (btn) btn.innerHTML = '▶️';
    }

    function _resume() {
        speechSynthesis.resume();
        status = 'playing';
        if (btn) btn.innerHTML = '⏹️';
    }

    // Hàm công khai để điều khiển từ bên ngoài
    return {
        togglePlayPause: function() {
            switch (status) {
                case 'stopped':
                    _play();
                    break;
                case 'playing':
                    _pause();
                    break;
                case 'paused':
                    _resume();
                    break;
            }
        },
        // Hàm này được gọi khi chuyển sang câu thoại khác
        stopAndCleanup: function() {
            if (status !== 'stopped') {
                speechSynthesis.cancel(); // Dừng đọc
                _cleanup(); // Khôi phục HTML
            }
        }
    };
}

/**
 * Gán handler mới cho dòng thoại hiện tại
 */
window.activateSpeechForCurrentLine = function() {
    const currentPlayBtn = displayWindow.querySelector('.dialogue-play-btn');
    const currentTextElem = displayWindow.querySelector('.japanese-text');
    const currentSpeakerElem = displayWindow.querySelector('.speaker');

    if (currentPlayBtn && currentTextElem && currentSpeakerElem) {
        const charName = currentSpeakerElem.dataset.character;
        // Tạo và gán handler mới vào biến toàn cục
        activeDialogueHandler = createSpeechHandler(currentTextElem, charName);
        
        const newBtn = currentPlayBtn.cloneNode(true);
        currentPlayBtn.parentNode.replaceChild(newBtn, currentPlayBtn);
        
        // Nút bấm giờ sẽ gọi hàm toggle của handler đang hoạt động
        newBtn.addEventListener('click', () => activeDialogueHandler.togglePlayPause());
    }
}

/**
 * Hiển thị một dòng thoại cụ thể
 */
function showLine(sceneIdx, lineIdx) {
    // BƯỚC QUAN TRỌNG: Dừng và dọn dẹp handler của câu thoại TRƯỚC ĐÓ
    if (activeDialogueHandler) {
        activeDialogueHandler.stopAndCleanup();
        activeDialogueHandler = null;
    }

    const scene = scenes[sceneIdx];
    const linesInScene = scene.querySelectorAll('.dialogue-line');
    if (lineIdx >= 0 && lineIdx < linesInScene.length) {
        currentLineIndex = lineIdx;
        
        displayWindow.style.opacity = 0;
        setTimeout(() => {
            // Hiển thị nội dung HTML sạch của câu thoại mới
            displayWindow.innerHTML = linesInScene[lineIdx].innerHTML;
            
            // Kích hoạt handler MỚI cho câu thoại này
            activateSpeechForCurrentLine(); 
            
            counter.textContent = `${lineIdx + 1} / ${linesInScene.length}`;
            updateNavButtons();
            displayWindow.style.opacity = 1;
        }, 150);
    }
}




    function loadScene(sceneIdx) {
        if (sceneIdx >= 0 && sceneIdx < scenes.length) {
            currentSceneIndex = sceneIdx;
            const newBg = scenes[sceneIdx].dataset.backgroundImage;
            if (bgImage.src !== newBg) {
                bgImage.style.opacity = 0;
                setTimeout(() => {
                    bgImage.src = newBg;
                    bgImage.alt = `Bối cảnh cảnh ${sceneIdx + 1}`;
                    bgImage.style.opacity = 1;
                }, 400);
            }
            document.querySelectorAll('.scene-btn').forEach((btn, idx) => {
                btn.classList.toggle('active', idx === sceneIdx);
            });
            showLine(sceneIdx, 0);
        }
    }



// Dán vào file script-talk1029.js để THAY THẾ hàm setupSceneNav cũ

function setupSceneNav() {
    // Xóa các nút cũ đi để đảm bảo sạch sẽ (phòng trường hợp có lỗi)
    sceneNavContainer.innerHTML = '';

    // QUAN TRỌNG: Chỉ hiển thị thanh điều hướng cảnh khi có nhiều hơn 1 cảnh
    if (scenes.length > 1) {
        sceneNavContainer.style.display = 'flex'; // Hiện lại thanh nav nếu nó bị ẩn
        scenes.forEach((scene, index) => {
            const btn = document.createElement('button');
            btn.className = 'scene-btn';
            btn.textContent = scene.dataset.sceneName || `Cảnh ${index + 1}`;
            btn.addEventListener('click', () => loadScene(index));
            sceneNavContainer.appendChild(btn);
        });
    } else {
        // Nếu chỉ có 1 cảnh, ẩn hoàn toàn thanh điều hướng đi
        sceneNavContainer.style.display = 'none';
    }
}




    function updateNavButtons() {
        const linesInScene = scenes[currentSceneIndex].querySelectorAll('.dialogue-line');
        prevBtn.disabled = (currentLineIndex === 0);
        nextBtn.disabled = (currentLineIndex === linesInScene.length - 1);
    }

    nextBtn.addEventListener('click', () => {
        const linesInScene = scenes[currentSceneIndex].querySelectorAll('.dialogue-line');
        if (currentLineIndex < linesInScene.length - 1) {
            showLine(currentSceneIndex, currentLineIndex + 1);
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentLineIndex > 0) {
            showLine(currentSceneIndex, currentLineIndex - 1);
        }
    });

    // Khởi chạy
    if (scenes.length > 0) {
        setupSceneNav();
        loadScene(0);
    }


    // === PHẦN 3: ĐIỀU KHIỂN ĐỌC CHO PHẦN TỪ VỰNG (CẢI TIẾN) ===
    function speakVocab(text, lang = 'ja-JP') {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.voice = voiceManager.getVoiceFor('default'); // Dùng giọng mặc định
        speechSynthesis.speak(utterance);
    }

    document.querySelectorAll('.vocab-play-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const textToSpeak = event.currentTarget.dataset.speakText;
            if (textToSpeak) {
                speakVocab(textToSpeak);
            }
        });
    });

    // === PHẦN 4: LOGIC CỦA PHẦN QUIZ (Không đổi) ===
    document.querySelectorAll('.quiz-card').forEach(quizCard => {
        const options = quizCard.querySelectorAll('.option-btn');
        const explanationBox = quizCard.querySelector('.explanation-box');

        options.forEach(option => {
            option.addEventListener('click', () => {
                if (quizCard.classList.contains('answered')) return;
                quizCard.classList.add('answered');

                const isCorrect = option.getAttribute('data-correct') === 'true';
                if (isCorrect) {
                    option.classList.add('correct');
                } else {
                    option.classList.add('incorrect');
                    const correctOption = quizCard.querySelector('[data-correct="true"]');
                    if (correctOption) correctOption.classList.add('correct');
                }
                options.forEach(btn => btn.disabled = true);
                if (explanationBox) explanationBox.style.display = 'block';
            });
        });
    });

// === PHẦN 5: LOGIC CHO PHẦN ĐỌC HIỂU ỨNG DỤNG (BỔ SUNG) ===
// === PHẦN 5: LOGIC CHO PHẦN ĐỌC HIỂU ỨNG DỤNG (NÂNG CẤP VỚI HIGHLIGHT) ===



// =======================================================================
    // === PHẦN 5: BỘ MÁY ĐỌC HIỂU (HỌC TỪ TEMPLATE MỚI) ===
    // =======================================================================

  
// =======================================================================
    // === PHẦN 5: BỘ MÁY ĐỌC HIỂU (PHIÊN BẢN SỬA LỖI - BẢO TOÀN FURIGANA) ===
    // =======================================================================

    // BIẾN TOÀN CỤC ĐỂ QUẢN LÝ VIỆC ĐỌC TRÁNH XUNG ĐỘT
    let currentSpeechHandler = null; 

    /**
     * "Bộ não" xử lý việc đọc và highlight.
     * Nó sẽ tự động bọc từng ký tự trong thẻ <span> để tô màu MÀ KHÔNG LÀM MẤT FURIGANA.
     * @param {HTMLElement} targetElement - Thẻ HTML chứa văn bản cần đọc.
     * @param {object} options - Các tùy chọn như tốc độ, callback...
     * @returns {object} - Một đối tượng điều khiển có các phương thức play, stop, setSpeed.
     */
    function createSpeechHandlerForPassage(targetElement, options = {}) {
        const originalHTML = targetElement.innerHTML;
        let charMap = [];
        let plainText = '';
        let utterance = null;
        let isPlaying = false;
        let isPaused = false;

        /**
         * [ĐÃ SỬA LỖI] Hàm này sẽ duyệt qua DOM và bọc các ký tự text
         * vào thẻ <span> mà không phá vỡ cấu trúc của thẻ <ruby>.
         */
        function _prepareForSpeech() {
            plainText = '';
            charMap = [];

            function wrapCharsInSpans(parentNode) {
                // Tạo bản sao của danh sách node con để duyệt, vì chúng ta sẽ thay đổi DOM trực tiếp
                const nodes = Array.from(parentNode.childNodes);

                for (const node of nodes) {
                    // Nếu là node TEXT và không nằm trong thẻ <RT> (Furigana)
                    if (node.nodeType === 3 && node.parentNode.nodeName !== 'RT') {
                        const text = node.textContent;
                        const fragment = document.createDocumentFragment();

                        for (const char of text) {
                            plainText += char; // Thêm ký tự vào chuỗi để đọc
                            const span = document.createElement('span');
                            span.textContent = char;
                            fragment.appendChild(span);
                            charMap.push(span); // Thêm thẻ span vào map để highlight
                        }
                        // Thay thế node text cũ bằng các thẻ span mới
                        parentNode.replaceChild(fragment, node);
                    } 
                    // Nếu là node ELEMENT, tiếp tục duyệt vào trong
                    else if (node.nodeType === 1) {
                        wrapCharsInSpans(node);
                    }
                }
            }

            // Bắt đầu quá trình từ thẻ cha
            wrapCharsInSpans(targetElement);
        }

        // Dọn dẹp, trả lại HTML gốc sau khi đọc xong
        function _cleanup() {
            targetElement.innerHTML = originalHTML;
            isPlaying = false;
            isPaused = false;
        }

        function play() {
            // Dừng bất kỳ trình đọc nào khác đang chạy
            if (currentSpeechHandler && currentSpeechHandler !== this) {
                currentSpeechHandler.stop();
            }
            currentSpeechHandler = this;

            if (isPlaying && isPaused) { // Nếu đang tạm dừng -> tiếp tục
                speechSynthesis.resume();
                isPaused = false;
                if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: false });
                return;
            }
            
            if (isPlaying && !isPaused) { // Nếu đang chạy -> tạm dừng
                speechSynthesis.pause();
                isPaused = true;
                if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: true });
                return;
            }
            
            // Bắt đầu đọc từ đầu
            isPlaying = true;
            isPaused = false;
            _prepareForSpeech();
            
            utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'ja-JP';
            utterance.rate = options.speed || 1;
            
            // TÍCH HỢP: Sử dụng voiceManager có sẵn của bạn
            utterance.voice = voiceManager.getVoiceFor('default');

            // Sự kiện then chốt để highlight
            utterance.onboundary = (event) => {
                if (event.name !== 'word') return;
                charMap.forEach(span => span.classList.remove('highlight-word')); // Xóa highlight cũ
                for (let i = 0; i < event.charLength; i++) {
                    const charIndex = event.charIndex + i;
                    if (charMap[charIndex]) {
                        charMap[charIndex].classList.add('highlight-word'); // Highlight từ mới
                    }
                }
            };

            // Khi đọc xong
            utterance.onend = () => {
                _cleanup();
                currentSpeechHandler = null;
                if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false });
            };
            
            // Khi có lỗi
            utterance.onerror = (event) => {
                console.error('Lỗi SpeechSynthesis:', event);
                _cleanup();
                currentSpeechHandler = null;
                if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false });
            };
            
            speechSynthesis.speak(utterance);
            if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: false });
        }

        function stop() {
            if (isPlaying) {
                speechSynthesis.cancel();
                _cleanup();
                currentSpeechHandler = null;
                if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false });
            }
        }
        
        // Cập nhật tốc độ
        function setSpeed(newSpeed) {
            options.speed = newSpeed;
            // Nếu đang đọc, dừng và đọc lại với tốc độ mới
            if (isPlaying && !isPaused) {
                speechSynthesis.cancel();
                // Chờ một chút để đảm bảo đã hủy rồi mới đọc lại
                setTimeout(() => play(), 100);
            }
        }
        
        // Trả về bộ điều khiển
        return { play, stop, setSpeed, get isPlaying() { return isPlaying; } };
    }

    /**
     * "Bộ điều khiển" - Tìm các thành phần đọc hiểu trên trang và gắn sự kiện cho chúng.
     */
    function initPassageReading() {
        const passageComponents = document.querySelectorAll('.readable-passage-component');

        passageComponents.forEach((component) => {
            const playBtn = component.querySelector('.play-pause');
            const stopBtn = component.querySelector('.stop');
            const speedBtns = component.querySelectorAll('.speed-btn');
            const textElement = component.querySelector('.text-to-be-read');

            if (!playBtn || !stopBtn || !textElement) return;

            // Cấu hình cho bộ não
            const options = {
                speed: 1.0,
                onStateChange: (state) => {
                    if (state.isPlaying && !state.isPaused) {
                        playBtn.innerHTML = '⏸️ Tạm dừng';
                    } else if (state.isPlaying && state.isPaused) {
                        playBtn.innerHTML = '▶️ Tiếp tục';
                    } else {
                        // Trả về trạng thái "Nghe lại" khi đọc xong hoặc dừng hẳn
                        playBtn.innerHTML = '▶️ Nghe lại';
                    }
                }
            };
            
            // Tạo một trình xử lý riêng cho component này
            const handler = createSpeechHandlerForPassage(textElement, options);
            
            playBtn.addEventListener('click', () => handler.play());
            
            stopBtn.addEventListener('click', () => {
                handler.stop();
                // Reset nút play về trạng thái ban đầu
                playBtn.innerHTML = '▶️ Bắt đầu';
            });

            speedBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const newSpeed = parseFloat(btn.dataset.speed);
                    handler.setSpeed(newSpeed); // Gửi tốc độ mới cho trình xử lý
                    speedBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    }

    // CUỐI CÙNG: Gọi hàm khởi tạo này
    initPassageReading();



///////////////////
});
