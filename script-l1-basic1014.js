document.addEventListener('DOMContentLoaded', () => {
    // === CORE UI & NAVIGATION ===
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.content-section');

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

    // =================================================================
    // === [THÊM MỚI] SLIDESHOW ENGINE ===
    // =================================================================
    function initSlideshow() {
        const slideshows = document.querySelectorAll('.slideshow-container');
        slideshows.forEach(slideshow => {
            let slideIndex = 1;
            const slides = slideshow.querySelectorAll('.slide-item');
            const prevBtn = slideshow.querySelector('.prev');
            const nextBtn = slideshow.querySelector('.next');
            
            // Ẩn nút nếu chỉ có 1 ảnh
            if (slides.length <= 1) {
                if(prevBtn) prevBtn.style.display = 'none';
                if(nextBtn) nextBtn.style.display = 'none';
                 // Hiện ảnh duy nhất đó lên
                if(slides[0]) slides[0].style.display = "block";
                return; // Dừng lại không cần thêm sự kiện
            }

            function plusSlides(n) {
                showSlides(slideIndex += n);
            }

            function showSlides(n) {
                if (n > slides.length) { slideIndex = 1 }
                if (n < 1) { slideIndex = slides.length }
                
                slides.forEach(slide => slide.style.display = "none");
                slides[slideIndex - 1].style.display = "block";
            }

            prevBtn.addEventListener('click', () => plusSlides(-1));
            nextBtn.addEventListener('click', () => plusSlides(1));
            
            showSlides(slideIndex);
        });
    }

    // =================================================================
    // === READING & HIGHLIGHTING ENGINE (VERSION 3.1) ===
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
        this.isActive = () => isPlaying;

        function _prepareForSpeech() {
            plainText = '';
            charMap = [];

            function _rebuildDOM(sourceNode) {
                const fragment = document.createDocumentFragment();
                for (const node of sourceNode.childNodes) {
                    if (node.nodeType === 3) {
                        const text = node.textContent;
                        for (const char of text) {
                            plainText += char;
                            const span = document.createElement('span');
                            span.textContent = char;
                            fragment.appendChild(span);
                            charMap.push(span);
                        }
                    } 
                    else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                        if (node.nodeName === 'RT') {
                            fragment.appendChild(node.cloneNode(true));
                        } else {
                            const clonedElement = node.cloneNode(false);
                            clonedElement.appendChild(_rebuildDOM(node));
                            fragment.appendChild(clonedElement);
                        }
                    }
                }
                return fragment;
            }

            const newContent = _rebuildDOM(targetElement);
            targetElement.innerHTML = '';
            targetElement.appendChild(newContent);
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

        return { play, stop, setSpeed, get isPlaying() { return isPlaying; } };
    }

    // === INIT DIALOGUE READING ===
    function initDialogueReading() {
        document.querySelectorAll('.dialogue-play-btn').forEach(btn => {
            const textElement = btn.closest('.dialogue-text-content').querySelector('.japanese-text');
            if (!textElement) {
                console.error("Không tìm thấy phần tử .japanese-text cho nút:", btn);
                return;
            }
            let handler = null;
            btn.addEventListener('click', () => {
                if (!handler || !handler.isPlaying) {
                    handler = createSpeechHandler(textElement);
                }
                handler.play();
            });
        });
    }

    // === INIT PASSAGE READING ===
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
    
    // === INIT TEXT READER APP ===
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
                    handler = null;
                }
            }
        };
        
        readBtn.addEventListener('click', () => {
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

    // === INIT VOCABULARY READING ===
    function initVocabularyReading() {
        function speakText(text) {
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
                e.stopPropagation(); // Ngăn sự kiện click của cả hàng
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
                e.stopPropagation();
                const exampleCell = e.target.closest('.example-sentence-cell');
                const textElement = exampleCell.querySelector('.japanese-text');
                if (textElement) {
                    speakText(textElement.textContent.trim());
                }
            });
        });
    }
    
	// === INIT ALL EXERCISES ===
	function initAllExercises() {
		const exerciseItems = document.querySelectorAll('.exercise-item');

		exerciseItems.forEach(item => {
			const options = item.querySelectorAll('.exercise-option');
			const explanation = item.querySelector('.explanation');

			options.forEach(option => {
				option.addEventListener('click', () => {
					if (item.classList.contains('answered')) {
						return;
					}
					
					item.classList.add('answered');

					const isCorrect = option.getAttribute('data-correct') === 'true';

					if (isCorrect) {
						option.classList.add('correct');
					} else {
						option.classList.add('incorrect');
						option.innerHTML += `<span class="feedback-text">❌ Chưa đúng</span>`;

						const correctOption = item.querySelector('.exercise-option[data-correct="true"]');
						if (correctOption) {
							correctOption.classList.add('correct');
						}
					}

					if (explanation) {
						explanation.classList.remove('hidden');
					}
				});
			});
		});
	}

    // --- Initialize all modules ---
    initSlideshow();
    initDialogueReading();
    initPassageReading();
    initTextReaderApp();
    initVocabularyReading();
    initAllExercises();
});