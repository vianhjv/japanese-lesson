/* --- SCRIPT UNIVERSAL CHO CÁC BÀI HỌC VÀ BÀI TẬP (PHIÊN BẢN 2.3 - FIX DIALOGUE & VOCAB) --- */
/*
    Cập nhật chính:
    - [FIX] Sửa lỗi khởi tạo dứt điểm bằng cách thêm cơ chế "Polling" (chủ động kiểm tra) 
      để đảm bảo tìm thấy giọng đọc ngay cả khi sự kiện `onvoiceschanged` không đáng tin cậy.
    - [FIX] Sửa lỗi logic không hiển thị hội thoại do sai thứ tự tham số trong vòng lặp forEach.
    - [IMPROVE] Nâng cấp chức năng đọc từ vựng để tự động dùng phiên âm Furigana, đảm bảo đọc đúng.
*/

document.addEventListener('DOMContentLoaded', () => {

    // === PHẦN 0: BỘ QUẢN LÝ GIỌNG ĐỌC (ĐÃ NÂNG CẤP TRIỆT ĐỂ) ===
    const voiceManager = {
        japaneseVoices: [],
        characterMap: {},
        defaultVoice: null,
        voicesLoaded: false,
        modulesInitialized: false,
        preferences: { 'an': 'nanami', 'suzuki': 'haruka', 'yamada': 'ichiro', 'tanaka': 'keita' },
        init: function() {
            // Sự kiện lý tưởng nhất
            speechSynthesis.onvoiceschanged = () => this.loadVoices();

            // Cơ chế kiểm tra chủ động (Polling Fallback)
            let maxAttempts = 30; // Chờ tối đa 3 giây
            const voiceCheckInterval = setInterval(() => {
                this.loadVoices();
                maxAttempts--;
                if (this.voicesLoaded || maxAttempts <= 0) {
                    clearInterval(voiceCheckInterval);
                    // Sau 3 giây, nếu vẫn không có giọng đọc, hiển thị lỗi
                    if (!this.voicesLoaded && !this.modulesInitialized) {
                        this.showVoiceError();
                    }
                }
            }, 100);
        },
        loadVoices: function() {
            if (this.voicesLoaded) return;
            
            const voices = speechSynthesis.getVoices();
            if (voices.length === 0) return; // Nếu danh sách còn rỗng, chờ lần kiểm tra tiếp theo

            this.japaneseVoices = voices.filter(v => v.lang.startsWith('ja'));
            if (this.japaneseVoices.length === 0) return; // Nếu có giọng đọc nhưng không có tiếng Nhật, chờ
            
            this.voicesLoaded = true;
            this.defaultVoice = this.japaneseVoices[0];
            
            const found = {};
            this.japaneseVoices.forEach(v => {
                const name = v.name.toLowerCase();
                for (const [key, kw] of Object.entries(this.preferences)) { if (name.includes(kw)) found[kw] = v; }
            });
            const female = this.japaneseVoices.filter(v => /nanami|haruka|ayumi/i.test(v.name));
            const male = this.japaneseVoices.filter(v => /ichiro|keita|kenji/i.test(v.name));
            const assign = (char, gender, idx) => found[this.preferences[char]] || (gender.length > 0 ? gender[idx % gender.length] : this.defaultVoice);
            this.characterMap = { 'an': assign('an', female, 0), 'suzuki': assign('suzuki', female, 1), 'yamada': assign('yamada', male, 0), 'tanaka': assign('tanaka', male, 1) };
            
            if (!this.modulesInitialized) {
                initializeSpeechModules();
                this.modulesInitialized = true;
            }
        },
        getVoiceFor: function(charName) {
            return this.characterMap[charName] || this.defaultVoice;
        },
        showVoiceError: function() {
             const displayWindow = document.querySelector('.dialogue-display-window');
             if (displayWindow && !displayWindow.innerHTML) { // Chỉ hiển thị nếu đang trống
                displayWindow.innerHTML = `<p style="color: red; text-align: center;">Lỗi: Không tìm thấy giọng đọc tiếng Nhật trên trình duyệt của bạn.</p>`;
             }
        }
    };
    
    // === PHẦN 1: BỘ NÃO ĐỌC UNIVERSAL (GIỮ NGUYÊN) ===
    function buildSpeechMap(parentNode) {
        let speakableText = '';
        const domMap = [];
        const HIGHLIGHT_CLASS = 'current-word-highlight';
        const wrapperSpans = [];

        function traverse(node) {
            if (node.nodeType === 3) {
                const text = node.textContent;
                speakableText += text;
                for (let i = 0; i < text.length; i++) domMap.push(node);
            } else if (node.nodeType === 1) {
                if (node.nodeName.toUpperCase() === 'RUBY') {
                    const furigana = node.querySelector('rt')?.textContent || node.querySelector('rp')?.textContent || '';
                    const baseText = furigana || node.textContent;
                    speakableText += baseText;
                    for (let i = 0; i < baseText.length; i++) domMap.push(node);
                } else if (node.nodeName.toUpperCase() !== 'RT' && node.nodeName.toUpperCase() !== 'RP') {
                    node.childNodes.forEach(traverse);
                }
            }
        }
        parentNode.childNodes.forEach(traverse);

        function clearHighlights() {
            wrapperSpans.forEach(span => {
                const parent = span.parentNode;
                if (parent) { parent.replaceChild(span.firstChild, span); parent.normalize(); }
            });
            wrapperSpans.length = 0;
            parentNode.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => el.classList.remove(HIGHLIGHT_CLASS));
        }

        function applyHighlight(startIndex, length) {
            clearHighlights();
            if (startIndex === undefined) return;
            const nodesToHighlight = new Set();
            for (let i = startIndex; i < startIndex + length; i++) {
                if (domMap[i]) nodesToHighlight.add(domMap[i]);
            }
            nodesToHighlight.forEach(node => {
                if (node.nodeType === 1) {
                    node.classList.add(HIGHLIGHT_CLASS);
                } else if (node.nodeType === 3) {
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

    function createUniversalSpeechHandler(targetElement, options = {}) {
        let utterance = null;
        let status = 'stopped';
        const speechMap = buildSpeechMap(targetElement);

        function _cleanup() {
            status = 'stopped'; utterance = null;
            speechMap.clearHighlights();
            if (options.onStateChange) options.onStateChange({ status: 'stopped' });
        }

        function _speak() {
            speechSynthesis.cancel();
            if (!speechMap.speakableText.trim()) return _cleanup();
            const voice = voiceManager.getVoiceFor(options.characterName || 'default');
            if (!voice) { console.error("Lỗi: Không có giọng đọc khi tạo handler."); return; }
            
            utterance = new SpeechSynthesisUtterance(speechMap.speakableText);
            utterance.lang = 'ja-JP'; utterance.rate = options.speed || 1.0; utterance.voice = voice;
            utterance.onboundary = (event) => {
                if (event.name === 'word') speechMap.applyHighlight(event.charIndex, event.charLength);
            };
            utterance.onend = _cleanup;
            utterance.onerror = (e) => { console.error("Lỗi SpeechSynthesis:", e); _cleanup(); };
            speechSynthesis.speak(utterance);
            status = 'playing';
            if (options.onStateChange) options.onStateChange({ status: 'playing' });
        }
        
        function _pause() { speechSynthesis.pause(); status = 'paused'; if (options.onStateChange) options.onStateChange({ status: 'paused' }); }
        function _resume() { speechSynthesis.resume(); status = 'playing'; if (options.onStateChange) options.onStateChange({ status: 'playing' }); }

        return {
            togglePlayPause: () => {
                if (status === 'stopped') _speak();
                else if (status === 'playing') _pause();
                else if (status === 'paused') _resume();
            },
            stopAndCleanup: () => { if (status !== 'stopped') { speechSynthesis.cancel(); _cleanup(); } },
            setSpeed: (newSpeed) => {
                options.speed = newSpeed;
                if (status === 'playing') { speechSynthesis.cancel(); setTimeout(_speak, 100); }
            }
        };
    }
    
    // === PHẦN 2: CÁC MODULE CHỨC NĂNG (ĐÃ SỬA LỖI) ===
    function initDialogueController() {
        const dialogueContainer = document.querySelector('.scene-container');
        if (!dialogueContainer) return;
        const displayWindow = dialogueContainer.querySelector('.dialogue-display-window');

       // === const scenes = dialogueContainer.querySelectorAll('.dialogue-source .scene');

        const scenes = document.querySelectorAll('.dialogue-source .scene');


        if (scenes.length === 0) return;
        const sceneNavContainer = dialogueContainer.querySelector('#sceneNav');
        const prevBtn = dialogueContainer.querySelector('#prevBtn');
        const nextBtn = dialogueContainer.querySelector('#nextBtn');
        const counter = dialogueContainer.querySelector('#counter');
        const bgImage = dialogueContainer.querySelector('.scene-background-image');
        let currentSceneIndex = 0, currentLineIndex = 0, activeDialogueHandler = null;
        function showLine(sceneIdx, lineIdx) {
            if (activeDialogueHandler) activeDialogueHandler.stopAndCleanup(); activeDialogueHandler = null;
            const linesInScene = scenes[sceneIdx].querySelectorAll('.dialogue-line');
            if (lineIdx < 0 || lineIdx >= linesInScene.length) return;
            currentLineIndex = lineIdx;
            displayWindow.style.opacity = 0;
            setTimeout(() => {
                displayWindow.innerHTML = linesInScene[lineIdx].innerHTML;
                const textElem = displayWindow.querySelector('.japanese-text');
                const speakerElem = displayWindow.querySelector('.speaker');
                const playBtn = displayWindow.querySelector('.dialogue-play-btn');
                if (textElem && speakerElem && playBtn) {
                    activeDialogueHandler = createUniversalSpeechHandler(textElem, {
                        characterName: speakerElem.dataset.character,
                        onStateChange: ({ status }) => {
                            if (status === 'playing') playBtn.innerHTML = '⏹️';
                            else if (status === 'paused') playBtn.innerHTML = '▶️';
                            else playBtn.innerHTML = '🔊';
                        }
                    });
                    const newBtn = playBtn.cloneNode(true);
                    playBtn.parentNode.replaceChild(newBtn, playBtn);
                    newBtn.addEventListener('click', () => activeDialogueHandler.togglePlayPause());
                }
                counter.textContent = `${lineIdx + 1} / ${linesInScene.length}`;
                updateNavButtons();
                displayWindow.style.opacity = 1;
            }, 150);
        }
        function loadScene(sceneIdx) {
            if (sceneIdx >= 0 && sceneIdx < scenes.length) {
                currentSceneIndex = sceneIdx;
                const newBg = scenes[sceneIdx].dataset.backgroundImage;
                if (bgImage && bgImage.src !== newBg) {
                    bgImage.style.opacity = 0;
                    setTimeout(() => { bgImage.src = newBg; bgImage.style.opacity = 1; }, 400);
                }
                dialogueContainer.querySelectorAll('.scene-btn').forEach((btn, idx) => btn.classList.toggle('active', idx === sceneIdx));
                showLine(sceneIdx, 0);
            }
        }
        function setupSceneNav() {
            if (!sceneNavContainer) return;
            sceneNavContainer.innerHTML = '';
            if (scenes.length > 1) {
                sceneNavContainer.style.display = 'flex';
                // *** FIX: Đảo ngược (index, scene) thành (scene, index) ***
                scenes.forEach((scene, index) => {
                    const btn = document.createElement('button');
                    btn.className = 'scene-btn';
                    btn.textContent = scene.dataset.sceneName || `Cảnh ${index + 1}`;
                    btn.addEventListener('click', () => loadScene(index));
                    sceneNavContainer.appendChild(btn);
                });
            } else {
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
            if (currentLineIndex < linesInScene.length - 1) showLine(currentSceneIndex, currentLineIndex + 1);
        });
        prevBtn.addEventListener('click', () => {
            if (currentLineIndex > 0) showLine(currentSceneIndex, currentLineIndex - 1);
        });
        if (scenes.length > 0) { setupSceneNav(); loadScene(0); }
    }
    
    function initPassageReading() {
        const passageComponents = document.querySelectorAll('.readable-passage-component');
        if (passageComponents.length === 0) return;
        passageComponents.forEach((component) => {
            const playBtn = component.querySelector('.play-pause');
            const stopBtn = component.querySelector('.stop');
            const speedBtns = component.querySelectorAll('.speed-btn');
            const textElement = component.querySelector('.text-to-be-read');
            if (!playBtn || !stopBtn || !textElement) return;
            const handler = createUniversalSpeechHandler(textElement, {
                speed: 1.0,
                onStateChange: ({ status }) => {
                    if (status === 'playing') playBtn.innerHTML = '⏸️ Tạm dừng';
                    else if (status === 'paused') playBtn.innerHTML = '▶️ Tiếp tục';
                    else playBtn.innerHTML = '▶️ Nghe lại';
                }
            });
            playBtn.addEventListener('click', () => handler.togglePlayPause());
            stopBtn.addEventListener('click', () => { handler.stopAndCleanup(); playBtn.innerHTML = '▶️ Bắt đầu'; });
            speedBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const newSpeed = parseFloat(btn.dataset.speed);
                    handler.setSpeed(newSpeed);
                    speedBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    }

    // === PHẦN 3: CÁC MODULE KHÔNG PHỤ THUỘC (ĐÃ SỬA LỖI) ===
    document.querySelectorAll('.vocab-play-btn').forEach(button => {
        // *** IMPROVEMENT: Thay thế logic cũ để dùng buildSpeechMap, đọc đúng furigana ***
        button.addEventListener('click', (event) => {
            const header = event.currentTarget.closest('.vocab-word-header, .example-jp');
            if (!header) return;

            const termElement = header.querySelector('.vocab-term, .jp-sentence');
            if (!termElement) return;

            const speechMap = buildSpeechMap(termElement);
            const textToSpeak = speechMap.speakableText;

            if (textToSpeak) {
                speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                utterance.lang = 'ja-JP';
                utterance.rate = 0.9;
                utterance.voice = voiceManager.getVoiceFor('default');
                speechSynthesis.speak(utterance);
            }
        });
    });
    
    document.querySelectorAll('.quiz-card').forEach(quizCard => {
        const options = quizCard.querySelectorAll('.option-btn');
        const explanationBox = quizCard.querySelector('.explanation-box');
        options.forEach(option => {
            option.addEventListener('click', () => {
                if (quizCard.classList.contains('answered')) return;
                quizCard.classList.add('answered');
                const isCorrect = option.getAttribute('data-correct') === 'true';
                if (isCorrect) option.classList.add('correct');
                else {
                    option.classList.add('incorrect');
                    const correctOption = quizCard.querySelector('[data-correct="true"]');
                    if (correctOption) correctOption.classList.add('correct');
                }
                options.forEach(btn => btn.disabled = true);
                if (explanationBox) explanationBox.style.display = 'block';
            });
        });
    });
    
    const style = document.createElement('style');
    style.innerHTML = `.current-word-highlight { background-color: #a0e7e5; border-radius: 3px; }`;
    document.head.appendChild(style);

    // === PHẦN 4: HÀM KHỞI TẠO TRUNG TÂM (KHÔNG ĐỔI) ===
    function initializeSpeechModules() {
        initDialogueController();
        initPassageReading();
    }
    
    // BẮT ĐẦU QUÁ TRÌNH
    voiceManager.init();
});
