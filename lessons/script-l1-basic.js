document.addEventListener('DOMContentLoaded', () => {
    // === CORE UI & NAVIGATION (Không đổi) ===
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.content-section');
    const progressBar = document.getElementById('lesson-progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');

    function updateProgressBar() {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (scrollTop / scrollHeight) * 100;
        progressBar.style.width = scrolled + '%';
        progressPercentage.textContent = Math.round(scrolled) + '%';
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === entry.target.id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(section => observer.observe(section));
    window.addEventListener('scroll', updateProgressBar);
    updateProgressBar();

    // =================================================================
    // === READING & HIGHLIGHTING ENGINE (VERSION 3.0 - WITH PAUSE/RESUME) ===
    // =================================================================

    let currentSpeechHandler = null; 
    let japaneseVoices = [];

    function populateVoiceList() {
        const voiceSelect = document.getElementById('voice-select');
        if (!voiceSelect || typeof speechSynthesis === 'undefined') return;
        
        try {
            const voices = speechSynthesis.getVoices();
            if (voices.length === 0) {
                setTimeout(populateVoiceList, 100);
                return;
            }
            japaneseVoices = voices.filter(voice => voice.lang === 'ja-JP');
            voiceSelect.innerHTML = '';
            if (japaneseVoices.length > 0) {
                japaneseVoices.forEach(voice => {
                    const option = document.createElement('option');
                    option.textContent = voice.name;
                    voiceSelect.appendChild(option);
                });
            } else {
                voiceSelect.innerHTML = '<option>Không có giọng đọc tiếng Nhật</option>';
            }
        } catch(e) {
            console.error("Error populating voice list:", e);
            voiceSelect.innerHTML = '<option>Lỗi khi tải giọng đọc</option>';
        }
    }
    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    function createSpeechHandler(targetElement, options = {}) {
        let originalHTML = targetElement.innerHTML;
        let charMap = []; 
        let plainText = '';
        let utterance = null;
        let isPlaying = false;
        let isPaused = false;
        // Thêm một thuộc tính để kiểm tra xem handler có đang hoạt động hay không
        this.isActive = () => isPlaying;


        function _walkTheDOM(node, processNode) {
            if (node.nodeType === 3) { 
                processNode(node);
            } else if (node.nodeType === 1 && node.nodeName !== 'RT' && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                for (let i = 0; i < node.childNodes.length; i++) {
                    _walkTheDOM(node.childNodes[i], processNode);
                }
            }
        }

        function _prepareForSpeech() {
            plainText = '';
            charMap = [];
            const fragment = document.createDocumentFragment();

            _walkTheDOM(targetElement.cloneNode(true), (textNode) => {
                const text = textNode.textContent;
                for (const char of text) {
                    plainText += char;
                    const span = document.createElement('span');
                    span.textContent = char;
                    fragment.appendChild(span);
                    charMap.push(span); 
                }
            });

            targetElement.innerHTML = ''; 
            targetElement.appendChild(fragment);
        }

        function _cleanup() {
            targetElement.innerHTML = originalHTML;
            isPlaying = false;
            isPaused = false;
            if (options.onEnd) options.onEnd();
        }

        function play() {
             if (currentSpeechHandler && currentSpeechHandler !== this) {
                currentSpeechHandler.stop();
            }
            currentSpeechHandler = this;

            if (isPlaying && isPaused) {
                speechSynthesis.resume();
                isPaused = false;
                if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: false });
                return;
            }
            
            if (isPlaying && !isPaused) {
                speechSynthesis.pause();
                isPaused = true;
                if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: true });
                return;
            }
            
            isPlaying = true;
            isPaused = false;
            _prepareForSpeech();
            
            utterance = new SpeechSynthesisUtterance(plainText);
            utterance.lang = 'ja-JP';
            utterance.rate = options.speed || 1;

            const selectedVoiceName = options.getVoiceName ? options.getVoiceName() : (document.getElementById('voice-select') ? document.getElementById('voice-select').value : null);
            const selectedVoice = japaneseVoices.find(v => v.name === selectedVoiceName);
            if (selectedVoice) utterance.voice = selectedVoice;

            utterance.onboundary = (event) => {
                if (event.name !== 'word') return;
                charMap.forEach(span => span.classList.remove('highlight-word'));
                for (let i = 0; i < event.charLength; i++) {
                    const charIndex = event.charIndex + i;
                    if (charMap[charIndex]) {
                        charMap[charIndex].classList.add('highlight-word');
                    }
                }
            };

            utterance.onend = () => {
                _cleanup();
                currentSpeechHandler = null;
                if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false });
            };
            
            utterance.onerror = (event) => {
                console.error('SpeechSynthesisUtterance.onerror', event);
                _cleanup();
                currentSpeechHandler = null;
                if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false });
            };
            
            speechSynthesis.speak(utterance);
            if (options.onStateChange) options.onStateChange({ isPlaying: true, isPaused: false });
        }

        function stop() {
            // Chỉ thực hiện nếu đang phát hoặc đang dừng
            if(isPlaying) {
                speechSynthesis.cancel();
                _cleanup();
                currentSpeechHandler = null;
                if (options.onStateChange) options.onStateChange({ isPlaying: false, isPaused: false });
            }
        }
        
        function setSpeed(newSpeed) {
            options.speed = newSpeed;
        }

        // Thêm thuộc tính isPlaying để kiểm tra từ bên ngoài
        return { play, stop, setSpeed, get isPlaying() { return isPlaying; } };
    }

    // === INIT DIALOGUE READING ===
    function initDialogueReading() {
        document.querySelectorAll('.dialogue-play-btn').forEach(btn => {
            const textElement = btn.nextElementSibling;
            // Tạo một handler mới cho mỗi nút, không tái sử dụng
             let handler = null;
            btn.addEventListener('click', () => {
                // Nếu handler chưa tồn tại hoặc đã chạy xong, tạo mới
                if (!handler || !handler.isPlaying) {
                    handler = createSpeechHandler(textElement);
                }
                handler.play();
            });
        });
    }

    // === INIT PASSAGE READING (NÂNG CẤP) ===
    function initPassageReading() {
        const playBtn = document.getElementById('play-pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        const passageEl = document.getElementById('reading-passage');
        if (!playBtn || !passageEl) return;

        const options = {
            speed: 1,
            onStateChange: (state) => {
                if (state.isPlaying && !state.isPaused) {
                    playBtn.innerHTML = '⏸️ Tạm dừng';
                } else if (state.isPlaying && state.isPaused) {
                    playBtn.innerHTML = '▶️ Tiếp tục';
                } else {
                    playBtn.innerHTML = '▶️ Nghe lại';
                }
            }
        };

        const handler = createSpeechHandler(passageEl, options);
        
        playBtn.addEventListener('click', () => handler.play());
        stopBtn.addEventListener('click', () => handler.stop());

        document.querySelectorAll('#section-reading .speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newSpeed = parseFloat(btn.dataset.speed);
                handler.setSpeed(newSpeed);
                document.querySelectorAll('#section-reading .speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
    
    // === INIT READING QUIZ INTERACTION ===
    //xóa function initReadingQuiz() {


    // === INIT TEXT READER APP (NÂNG CẤP) ===
    function initTextReaderApp() {
        const readBtn = document.getElementById('read-text-btn');
        const stopBtn = document.getElementById('stop-text-btn');
        const textInput = document.getElementById('text-to-read-input');
        const readerOutput = document.getElementById('reader-output');
        const voiceSelect = document.getElementById('voice-select');
        if (!readBtn || !stopBtn || !textInput || !readerOutput) return;

        let handler = null;
        const options = {
            speed: 1,
            getVoiceName: () => voiceSelect.value,
            onStateChange: (state) => {
                 if (state.isPlaying && !state.isPaused) {
                    readBtn.innerHTML = '⏸️ Tạm dừng';
                } else if (state.isPlaying && state.isPaused) {
                    readBtn.innerHTML = '▶️ Tiếp tục';
                } else {
                    readBtn.innerHTML = '▶️ Đọc Văn Bản';
                    readerOutput.style.display = 'none';
                    textInput.style.display = 'block';
                    handler = null; // Reset handler khi đã dừng hẳn
                }
            }
        };
        
        readBtn.addEventListener('click', () => {
            // Nếu chưa có handler, hoặc handler đã chạy xong, tạo một cái mới
            if (!handler) {
                const text = textInput.value.trim();
                if (!text) return;
                readerOutput.textContent = text;
                handler = createSpeechHandler(readerOutput, options);
                textInput.style.display = 'none';
                readerOutput.style.display = 'block';
            }
            handler.play();
        });

        stopBtn.addEventListener('click', () => {
            if (handler) {
                handler.stop();
            }
        });

        document.querySelectorAll('#section-tools .app-speed').forEach(btn => {
            btn.addEventListener('click', () => {
                options.speed = parseFloat(btn.dataset.speed);
                document.querySelectorAll('#section-tools .app-speed').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // === INIT VOCABULARY READING (ĐÃ KHÔI PHỤC) ===
    function initVocabularyReading() {
        function speakText(text) {
            // Dừng mọi âm thanh đang phát để tránh chồng chéo
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'ja-JP';

            const voiceSelect = document.getElementById('voice-select');
            const selectedVoiceName = voiceSelect.value;
            const selectedVoice = japaneseVoices.find(v => v.name === selectedVoiceName);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            speechSynthesis.speak(utterance);
        }

        document.querySelectorAll('.play-word-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wordCell = e.target.closest('.vocab-word-cell');
                if (wordCell) {
                    const clonedCell = wordCell.cloneNode(true);
                    clonedCell.querySelector('button').remove();
                    clonedCell.querySelectorAll('rt').forEach(rtElement => rtElement.remove());
                    const textToSpeak = clonedCell.textContent.trim();
                    speakText(textToSpeak);
                }
            });
        });

        document.querySelectorAll('.play-example-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const exampleCell = e.target.closest('.example-sentence-cell');
                const textElement = exampleCell.querySelector('.japanese-text');
                if (textElement) {
                    speakText(textElement.textContent.trim());
                }
            });
        });
    }
    
    // === INIT GRAMMAR EXERCISE INTERACTION (ĐÃ KHÔI PHỤC) ===
  // xóa  function initGrammarExercises() {
// DÁN HÀM MỚI NÀY VÀO
 // Selector này sẽ tìm TẤT CẢ các câu hỏi trên toàn trang
function initAllExercises() {
    // Selector này sẽ tìm TẤT CẢ các câu hỏi trên toàn trang
    const exerciseItems = document.querySelectorAll('.exercise-item');

    exerciseItems.forEach(item => {
        const options = item.querySelectorAll('.exercise-option');
        const explanation = item.querySelector('.explanation');

        options.forEach(option => {
            option.addEventListener('click', () => {
                // Nếu đã trả lời câu này rồi thì không làm gì cả
                if (item.classList.contains('answered')) {
                    return;
                }
                
                // Đánh dấu là đã trả lời
                item.classList.add('answered');

                const isCorrect = option.getAttribute('data-correct') === 'true';

                if (isCorrect) {
                    option.classList.add('correct');
                } else {
                    option.classList.add('incorrect');
                    // Thêm icon và chữ "Chưa đúng"
                    option.innerHTML += `<span class="feedback-text">❌ Chưa đúng</span>`;

                    // Tìm và highlight đáp án đúng
                    const correctOption = item.querySelector('.exercise-option[data-correct="true"]');
                    if (correctOption) {
                        correctOption.classList.add('correct');
                    }
                }

                // Hiển thị giải thích
                if (explanation) {
                    explanation.classList.remove('hidden');
                }
            });
        });
    });
}

    // --- Initialize all modules ---
    initDialogueReading();
    initPassageReading();
    initTextReaderApp();
    initVocabularyReading();
    // THÊM DÒNG NÀY VÀO
      initAllExercises();
});