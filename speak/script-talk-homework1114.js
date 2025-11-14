/* --- SCRIPT UNIVERSAL CHO CÁC BÀI HỌC VÀ BÀI TẬP --- */

document.addEventListener('DOMContentLoaded', () => {

    // === PHẦN 0: BỘ QUẢN LÝ GIỌNG ĐỌC (KHÔNG ĐỔI) ===
    const voiceManager = {
        japaneseVoices: [],
        characterMap: {},
        defaultVoice: null,
        voicesLoaded: false,
        preferences: { 'an': 'nanami', 'suzuki': 'haruka', 'yamada': 'ichiro', 'tanaka': 'keita' },

        init: function() {
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = () => this.loadVoices();
            }
            this.loadVoices(); 
        },

        loadVoices: function() {
            if (this.voicesLoaded) return;
            this.japaneseVoices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ja'));
            if (this.japaneseVoices.length === 0) {
                console.warn("Không tìm thấy giọng đọc tiếng Nhật.");
                const displayWindow = document.querySelector('.dialogue-display-window');
                if (displayWindow) {
                    displayWindow.innerHTML = `<p style="color: red; text-align: center;">Lỗi: Không tìm thấy giọng đọc tiếng Nhật trên trình duyệt của bạn.</p>`;
                }
                return;
            }
            this.defaultVoice = this.japaneseVoices[0];
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
            if (typeof activateSpeechForCurrentLine === 'function') activateSpeechForCurrentLine();
        },

        getVoiceFor: function(charName) {
            if (!this.voicesLoaded) this.loadVoices();
            return this.characterMap[charName] || this.defaultVoice;
        }
    };
    voiceManager.init();


    // === PHẦN 1 & 2: HỆ THỐNG ĐIỀU KHIỂN HỘI THOẠI (ĐÃ NÂNG CẤP) ===
    const dialogueContainer = document.querySelector('.scene-container');

    // **[SỬA LỖI]** CHỈ CHẠY CODE HỘI THOẠI NẾU CÓ PHẦN HỘI THOẠI
    if (dialogueContainer) {
        const displayWindow = document.querySelector('.dialogue-display-window');
        const scenes = document.querySelectorAll('.dialogue-source .scene');
        const sceneNavContainer = document.getElementById('sceneNav');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const counter = document.getElementById('counter');
        const bgImage = document.querySelector('.scene-background-image');
        
        let currentSceneIndex = 0;
        let currentLineIndex = 0;
        let activeDialogueHandler = null;

        function createSpeechHandler(targetElement, characterName) {
            const originalHTML = targetElement.innerHTML;
            let charMap = [], plainText = '', utterance = null, status = 'stopped';
            const btn = displayWindow.querySelector('.dialogue-play-btn');

            function _prepareForSpeech() {
                plainText = ''; charMap = []; targetElement.innerHTML = originalHTML;
                function wrapCharsInSpans(parentNode) {
                    Array.from(parentNode.childNodes).forEach(node => {
                        if (node.nodeType === 3 && node.parentNode.nodeName !== 'RT') {
                            const fragment = document.createDocumentFragment();
                            for (const char of node.textContent) {
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
                    });
                }
                wrapCharsInSpans(targetElement);
            }

            function _cleanup() { targetElement.innerHTML = originalHTML; status = 'stopped'; if (btn) btn.innerHTML = '🔊'; utterance = null; }

            function _play() {
                speechSynthesis.cancel(); _prepareForSpeech();
                if (!plainText.trim()) return;
                const voice = voiceManager.getVoiceFor(characterName);
                if (!voice) return;
                utterance = new SpeechSynthesisUtterance(plainText);
                utterance.lang = 'ja-JP'; utterance.rate = 1.0; utterance.voice = voice;
                utterance.onboundary = (event) => {
                    charMap.forEach(span => span.classList.remove('dialogue-word-highlight'));
                    if (event.name === 'word') {
                        for (let i = 0; i < event.charLength; i++) {
                            if (charMap[event.charIndex + i]) charMap[event.charIndex + i].classList.add('dialogue-word-highlight');
                        }
                    }
                };
                utterance.onend = _cleanup; utterance.onerror = (e) => { console.error(e); _cleanup(); };
                speechSynthesis.speak(utterance); status = 'playing'; if (btn) btn.innerHTML = '⏹️';
            }
            function _pause() { speechSynthesis.pause(); status = 'paused'; if (btn) btn.innerHTML = '▶️'; }
            function _resume() { speechSynthesis.resume(); status = 'playing'; if (btn) btn.innerHTML = '⏹️'; }

            return {
                togglePlayPause: function() {
                    if (status === 'stopped') _play();
                    else if (status === 'playing') _pause();
                    else if (status === 'paused') _resume();
                },
                stopAndCleanup: function() { if (status !== 'stopped') { speechSynthesis.cancel(); _cleanup(); } }
            };
        }

        window.activateSpeechForCurrentLine = function() {
            const currentPlayBtn = displayWindow.querySelector('.dialogue-play-btn');
            const currentTextElem = displayWindow.querySelector('.japanese-text');
            const currentSpeakerElem = displayWindow.querySelector('.speaker');
            if (currentPlayBtn && currentTextElem && currentSpeakerElem) {
                const charName = currentSpeakerElem.dataset.character;
                activeDialogueHandler = createSpeechHandler(currentTextElem, charName);
                const newBtn = currentPlayBtn.cloneNode(true);
                currentPlayBtn.parentNode.replaceChild(newBtn, currentPlayBtn);
                newBtn.addEventListener('click', () => activeDialogueHandler.togglePlayPause());
            }
        }

        function showLine(sceneIdx, lineIdx) {
            if (activeDialogueHandler) { activeDialogueHandler.stopAndCleanup(); activeDialogueHandler = null; }
            const scene = scenes[sceneIdx];
            const linesInScene = scene.querySelectorAll('.dialogue-line');
            if (lineIdx >= 0 && lineIdx < linesInScene.length) {
                currentLineIndex = lineIdx;
                displayWindow.style.opacity = 0;
                setTimeout(() => {
                    displayWindow.innerHTML = linesInScene[lineIdx].innerHTML;
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
                if (bgImage && bgImage.src !== newBg) {
                    bgImage.style.opacity = 0;
                    setTimeout(() => { bgImage.src = newBg; bgImage.style.opacity = 1; }, 400);
                }
                document.querySelectorAll('.scene-btn').forEach((btn, idx) => btn.classList.toggle('active', idx === sceneIdx));
                showLine(sceneIdx, 0);
            }
        }

        function setupSceneNav() {
            if (!sceneNavContainer) return;
            sceneNavContainer.innerHTML = '';
            if (scenes.length > 1) {
                sceneNavContainer.style.display = 'flex';
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

        if (scenes.length > 0) {
            setupSceneNav();
            loadScene(0);
        }
    }


    // === PHẦN 3: ĐIỀU KHIỂN ĐỌC CHO PHẦN TỪ VỰNG (KHÔNG ĐỔI) ===
    function speakVocab(text, lang = 'ja-JP') {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        utterance.voice = voiceManager.getVoiceFor('default');
        speechSynthesis.speak(utterance);
    }

    document.querySelectorAll('.vocab-play-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const textToSpeak = event.currentTarget.dataset.speakText;
            if (textToSpeak) speakVocab(textToSpeak);
        });
    });

    // === PHẦN 4: LOGIC CỦA PHẦN QUIZ (KHÔNG ĐỔI, GIỜ SẼ CHẠY ĐƯỢC) ===
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

    
    // === PHẦN 5: BỘ MÁY ĐỌC HIỂU (ĐÃ NÂNG CẤP) ===
    // **[SỬA LỖI]** CHỈ CHẠY CODE ĐỌC HIỂU NẾU CÓ PHẦN ĐỌC HIỂU
    const passageComponents = document.querySelectorAll('.readable-passage-component');
    if (passageComponents.length > 0) {
        let currentSpeechHandler = null; 

        function createSpeechHandlerForPassage(targetElement, options = {}) {
            const originalHTML = targetElement.innerHTML;
            let charMap = [], plainText = '', utterance = null, isPlaying = false, isPaused = false;

            function _prepareForSpeech() {
                plainText = ''; charMap = [];
                function wrapCharsInSpans(parentNode) {
                    Array.from(parentNode.childNodes).forEach(node => {
                        if (node.nodeType === 3 && node.parentNode.nodeName !== 'RT') {
                            const fragment = document.createDocumentFragment();
                            for (const char of node.textContent) {
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
                    });
                }
                wrapCharsInSpans(targetElement);
            }

            function _cleanup() { targetElement.innerHTML = originalHTML; isPlaying = false; isPaused = false; }

            function play() {
                if (currentSpeechHandler && currentSpeechHandler !== this) currentSpeechHandler.stop();
                currentSpeechHandler = this;
                if (isPlaying && isPaused) { speechSynthesis.resume(); isPaused = false; if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: false }); return; }
                if (isPlaying && !isPaused) { speechSynthesis.pause(); isPaused = true; if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: true }); return; }
                
                isPlaying = true; isPaused = false; _prepareForSpeech();
                utterance = new SpeechSynthesisUtterance(plainText);
                utterance.lang = 'ja-JP'; utterance.rate = options.speed || 1;
                utterance.voice = voiceManager.getVoiceFor('default');

                utterance.onboundary = (event) => {
                    if (event.name !== 'word') return;
                    charMap.forEach(span => span.classList.remove('highlight-word'));
                    for (let i = 0; i < event.charLength; i++) {
                        if (charMap[event.charIndex + i]) charMap[event.charIndex + i].classList.add('highlight-word');
                    }
                };
                utterance.onend = () => { _cleanup(); currentSpeechHandler = null; if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false }); };
                utterance.onerror = (e) => { console.error(e); _cleanup(); currentSpeechHandler = null; if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false }); };
                speechSynthesis.speak(utterance);
                if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: false });
            }

            function stop() {
                if (isPlaying) { speechSynthesis.cancel(); _cleanup(); currentSpeechHandler = null; if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false }); }
            }
            
            function setSpeed(newSpeed) {
                options.speed = newSpeed;
                if (isPlaying && !isPaused) { speechSynthesis.cancel(); setTimeout(() => play(), 100); }
            }
            
            return { play, stop, setSpeed, get isPlaying() { return isPlaying; } };
        }

        passageComponents.forEach((component) => {
            const playBtn = component.querySelector('.play-pause');
            const stopBtn = component.querySelector('.stop');
            const speedBtns = component.querySelectorAll('.speed-btn');
            const textElement = component.querySelector('.text-to-be-read');

            if (!playBtn || !stopBtn || !textElement) return;

            const options = {
                speed: 1.0,
                onStateChange: (state) => {
                    if (state.isPlaying && !state.isPaused) playBtn.innerHTML = '⏸️ Tạm dừng';
                    else if (state.isPlaying && state.isPaused) playBtn.innerHTML = '▶️ Tiếp tục';
                    else playBtn.innerHTML = '▶️ Nghe lại';
                }
            };
            
            const handler = createSpeechHandlerForPassage(textElement, options);
            playBtn.addEventListener('click', () => handler.play());
            stopBtn.addEventListener('click', () => { handler.stop(); playBtn.innerHTML = '▶️ Bắt đầu'; });
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
});