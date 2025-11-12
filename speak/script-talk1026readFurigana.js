/* --- SCRIPT CHO CÁC BÀI HỌC KAIWA TIẾNG NHẬT --- */
/* Bạn không cần chỉnh sửa file này. Nó sẽ tự động đọc nội dung từ file index.html */

document.addEventListener('DOMContentLoaded', () => {

    // === PHẦN 0: BỘ QUẢN LÝ GIỌNG ĐỌC (Không thay đổi) ===
    const voiceManager = {
        characterMap: {}, defaultVoice: null, voicesLoaded: false,
        preferences: { 'an': 'nanami', 'suzuki': 'ayumi', 'yamada': 'ichiro', 'tanaka': 'keita' },
        init: function() {
            const load = () => this.loadVoices(); load();
            if (speechSynthesis.onvoiceschanged !== undefined) { speechSynthesis.onvoiceschanged = load; }
        },
        loadVoices: function() {
            if (this.voicesLoaded) return;
            const japaneseVoices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ja'));
            if (japaneseVoices.length === 0) return;
            this.defaultVoice = japaneseVoices[0];
            const found = {};
            japaneseVoices.forEach(v => {
                const name = v.name.toLowerCase();
                for (const [key, kw] of Object.entries(this.preferences)) { if (name.includes(kw)) found[kw] = v; }
            });
            const female = japaneseVoices.filter(v => /nanami|haruka|ayumi/i.test(v.name));
            const male = japaneseVoices.filter(v => /ichiro|keita|kenji/i.test(v.name));
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

    // === PHẦN 1: BỘ MÁY ĐỌC VÀ HIGHLIGHT ===
    let currentSpeechHandler = null;

    function createSpeechHandler(targetElement, characterName) {
        let originalHTML = targetElement.innerHTML;
        let charMap = []; 
        let plainText = '';
        let utterance = null;
        let isPlaying = false;
        let isPaused = false;

    function _prepareForSpeech() {
            plainText = '';
            charMap = [];
            const newContent = document.createDocumentFragment();

            function processNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    plainText += text;
                    for (const char of text) {
                        const span = document.createElement('span');
                        span.textContent = char;
                        newContent.appendChild(span);
                        charMap.push(span);
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'RUBY') {
                        const furiganaNode = node.querySelector('rt');
                        const baseTextNodes = Array.from(node.childNodes).filter(n => n.nodeType === Node.TEXT_NODE || n.tagName === 'RB');
                        
                        if (furiganaNode && baseTextNodes.length > 0) {
                            const furiganaText = furiganaNode.textContent;
                            plainText += furiganaText;

                            const baseTextContent = baseTextNodes.map(n => n.textContent).join('');
                            const baseSpan = document.createElement('span');
                            baseSpan.textContent = baseTextContent;
                            
                            // Tái tạo lại thẻ ruby để hiển thị đúng
                            const rubyClone = node.cloneNode(true);
                            // Gán toàn bộ ruby vào trong span để dễ quản lý
                            baseSpan.innerHTML = '';
                            baseSpan.appendChild(rubyClone);
                            newContent.appendChild(baseSpan);
                            
                            // Map mỗi ký tự furigana vào cùng một span của kanji
                            for (let i = 0; i < furiganaText.length; i++) {
                                charMap.push(baseSpan);
                            }
                        }
                    } else if (node.tagName !== 'RT') {
                         // Xử lý các thẻ khác như span, div, v.v.
                        const elementClone = document.createElement(node.tagName);
                        Array.from(node.attributes).forEach(attr => {
                           elementClone.setAttribute(attr.name, attr.value);
                        });
                        newContent.appendChild(elementClone);

                        Array.from(node.childNodes).forEach(child => {
                            // Cần một cách để thêm các node con đã xử lý vào elementClone
                            // Cách tiếp cận đơn giản hơn là không clone từng element
                            // mà xử lý trực tiếp trên tempDiv
                        });
                        // Đệ quy cho các node con
                        Array.from(node.childNodes).forEach(processNode);
                    }
                }
            }
            
            // Cách tiếp cận đơn giản và hiệu quả hơn
            plainText = '';
            charMap = [];
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = originalHTML;

            function buildMapAndText(node, parentElement) {
                if (node.nodeType === Node.TEXT_NODE) {
                    plainText += node.textContent;
                    for(const char of node.textContent) {
                        const span = document.createElement('span');
                        span.textContent = char;
                        parentElement.appendChild(span);
                        charMap.push(span);
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'RT') return; // Bỏ qua thẻ furigana

                    if (node.tagName === 'RUBY') {
                        const rt = node.querySelector('rt');
                        const rbText = Array.from(node.childNodes)
                                        .filter(n => n.nodeType === Node.TEXT_NODE)
                                        .map(n => n.textContent).join('');

                        if (rt && rt.textContent && rbText) {
                            plainText += rt.textContent;

                            const rubyWrapperSpan = document.createElement('span');
                            rubyWrapperSpan.appendChild(node.cloneNode(true));
                            parentElement.appendChild(rubyWrapperSpan);

                            for(let i = 0; i < rt.textContent.length; i++) {
                                charMap.push(rubyWrapperSpan);
                            }
                        }
                    } else {
                        // Giữ nguyên các thẻ khác như <p>, <span> highlight, v.v.
                        const clonedNode = node.cloneNode(false);
                        parentElement.appendChild(clonedNode);
                        Array.from(node.childNodes).forEach(child => buildMapAndText(child, clonedNode));
                    }
                }
            }

            const fragment = document.createDocumentFragment();
            Array.from(tempDiv.childNodes).forEach(child => buildMapAndText(child, fragment));

            targetElement.innerHTML = '';
            targetElement.appendChild(fragment);
        }






        function _cleanup() {
            targetElement.innerHTML = originalHTML;
            isPlaying = false;
            isPaused = false;
            const btn = displayWindow.querySelector('.dialogue-play-btn');
            if(btn) btn.innerHTML = '🔊';
        }

        function play() {
            if (currentSpeechHandler && currentSpeechHandler !== this) {
                currentSpeechHandler.stop();
            }
            currentSpeechHandler = this;
            const btn = displayWindow.querySelector('.dialogue-play-btn');

            if (isPlaying && isPaused) {
                speechSynthesis.resume();
                isPaused = false;
                if(btn) btn.innerHTML = '⏸';
                return;
            }
            
            if (isPlaying && !isPaused) {
                speechSynthesis.pause();
                isPaused = true;
                if(btn) btn.innerHTML = '▶';
                return;
            }
            
            speechSynthesis.cancel();
            _prepareForSpeech();
            isPlaying = true;
            isPaused = false;
            if(btn) btn.innerHTML = '⏸';
            
            utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'ja-JP';
            utterance.rate = 1; 
            utterance.voice = voiceManager.getVoiceFor(characterName);

            utterance.onboundary = (event) => {
                if (event.name !== 'word') return;
                targetElement.querySelectorAll('.highlight-word').forEach(el => el.classList.remove('highlight-word'));
                for (let i = 0; i < event.charLength; i++) {
                    const charIndex = event.charIndex + i;
                    if (charMap[charIndex]) { charMap[charIndex].classList.add('highlight-word'); }
                }
            };
            utterance.onend = () => { _cleanup(); currentSpeechHandler = null; };
            utterance.onerror = (event) => { console.error('Lỗi đọc:', event); _cleanup(); currentSpeechHandler = null; };
            speechSynthesis.speak(utterance);
        }

        function stop() {
            if(isPlaying || isPaused) {
                speechSynthesis.cancel();
                _cleanup();
                currentSpeechHandler = null;
            }
        }
        return { play, stop };
    }

    // === PHẦN 2: ĐIỀU KHIỂN HỘI THOẠI ĐA CẢNH ===
    const displayWindow = document.querySelector('.dialogue-display-window');
    const scenes = document.querySelectorAll('.dialogue-source .scene');
    const sceneNavContainer = document.getElementById('sceneNav');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const counter = document.getElementById('counter');
    const bgImage = document.querySelector('.scene-background-image');
    
    let currentSceneIndex = 0;
    let currentLineIndex = 0;

    window.activateSpeechForCurrentLine = function() {
        if (currentSpeechHandler) currentSpeechHandler.stop();
        const currentPlayBtn = displayWindow.querySelector('.dialogue-play-btn');
        const currentTextElem = displayWindow.querySelector('.japanese-text');
        const currentSpeakerElem = displayWindow.querySelector('.speaker');

        if (currentPlayBtn && currentTextElem && currentSpeakerElem) {
            const charName = currentSpeakerElem.dataset.character;
            currentLineHandler = createSpeechHandler(currentTextElem, charName);
            const newBtn = currentPlayBtn.cloneNode(true);
            currentPlayBtn.parentNode.replaceChild(newBtn, currentPlayBtn);
            newBtn.addEventListener('click', () => currentLineHandler.play());
        }
    }

    function showLine(sceneIdx, lineIdx) {
        const scene = scenes[sceneIdx];
        const linesInScene = scene.querySelectorAll('.dialogue-line');
        if (lineIdx >= 0 && lineIdx < linesInScene.length) {
            currentLineIndex = lineIdx;
            
            displayWindow.style.opacity = 0;
            setTimeout(() => {
                if (currentSpeechHandler) currentSpeechHandler.stop();
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

    function setupSceneNav() {
        scenes.forEach((scene, index) => {
            const btn = document.createElement('button');
            btn.className = 'scene-btn';
            btn.textContent = scene.dataset.sceneName || `Cảnh ${index + 1}`;
            btn.addEventListener('click', () => loadScene(index));
            sceneNavContainer.appendChild(btn);
        });
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


// === PHẦN 3: ĐIỀU KHIỂN ĐỌC CHO PHẦN TỪ VỰNG ===
    const vocabButtons = document.querySelectorAll('.vocab-play-btn');

    // Hàm đọc đơn giản
    function speak(text, lang = 'ja-JP') {
        // Dừng bất kỳ âm thanh nào đang phát
        speechSynthesis.cancel(); 
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9; // Đọc chậm hơn một chút cho rõ
        utterance.voice = voiceManager.getVoiceFor('default'); // Dùng giọng mặc định
        speechSynthesis.speak(utterance);
    }

    if (vocabButtons.length > 0) {
        vocabButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const textToSpeak = event.currentTarget.dataset.speakText;
                if (textToSpeak) {
                    speak(textToSpeak);
                }
            });
        });
    }



    const allQuizCards = document.querySelectorAll('.quiz-card');

    allQuizCards.forEach(quizCard => {
        const options = quizCard.querySelectorAll('.option-btn');
        const explanationBox = quizCard.querySelector('.explanation-box');

        options.forEach(option => {
            option.addEventListener('click', () => {
                // Ngăn người dùng trả lời lại câu hỏi đã trả lời rồi
                if (quizCard.classList.contains('answered')) {
                    return;
                }
                quizCard.classList.add('answered');

                const isCorrect = option.getAttribute('data-correct') === 'true';
                const correctOption = quizCard.querySelector('[data-correct="true"]');

                if (isCorrect) {
                    // Nếu chọn đúng, chỉ cần tô xanh đáp án đó
                    option.classList.add('correct');
                } else {
                    // Nếu chọn sai, tô đỏ đáp án đã chọn và tô xanh đáp án đúng
                    option.classList.add('incorrect');
                    correctOption.classList.add('correct');
                }

                // Vô hiệu hóa tất cả các nút trong câu hỏi này
                options.forEach(btn => btn.disabled = true);

                // Hiển thị hộp giải thích
                if (explanationBox) {
                    explanationBox.style.display = 'block';
                }
            });
        });
    });


});

