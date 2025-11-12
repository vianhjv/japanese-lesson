/* --- SCRIPT CHO CÁC BÀI HỌC KAIWA TIẾNG NHẬT --- */
/* Bạn không cần chỉnh sửa file này. Nó sẽ tự động đọc nội dung từ file index.html */

document.addEventListener('DOMContentLoaded', () => {

    // === PHẦN 0: BỘ QUẢN LÝ GIỌNG ĐỌC (Không thay đổi) ===
    const voiceManager = {
        characterMap: {}, defaultVoice: null, voicesLoaded: false,
        preferences: { 'an': 'nanami', 'suzuki': 'ayumi', 'yamada': 'kenji', 'tanaka': 'keita' },
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
            plainText = ''; charMap = [];
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = originalHTML;
            function processNode(node) {
                if (node.nodeType === Node.TEXT_NODE) { plainText += node.textContent; } 
                else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'RT') return;
                    Array.from(node.childNodes).forEach(processNode);
                }
            }
            processNode(tempDiv);
            
            const tempDivForHighlight = document.createElement('div');
            tempDivForHighlight.innerHTML = originalHTML;
            function wrapCharacters(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const fragment = document.createDocumentFragment();
                    for (const char of node.textContent) {
                        const span = document.createElement('span'); span.textContent = char;
                        fragment.appendChild(span);
                    }
                    node.parentNode.replaceChild(fragment, node);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'RT') return;
                    Array.from(node.childNodes).forEach(wrapCharacters);
                }
            }
            wrapCharacters(tempDivForHighlight);
            targetElement.innerHTML = tempDivForHighlight.innerHTML;
            charMap = Array.from(targetElement.querySelectorAll('span:not([class])')).filter(span => !span.closest('rt'));
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
});
