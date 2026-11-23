/**
 * LifeOS – voice.js
 * NOVA / LifeOS Voice Assistant with Web Speech Recognition & Speech Synthesis.
 */

class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis || null;
        this.isListening = false;
        this.isMuted = false;
        this.supported = false;

        this.initRecognition();
    }

    initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.supported = true;

            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateUI('listening', '🎤 Listening...');
            };

            this.recognition.onresult = (e) => {
                let transcript = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                this.updateUI('processing', `"${transcript}"`);

                if (e.results[e.results.length - 1].isFinal) {
                    this.handleCommand(transcript.trim());
                }
            };

            this.recognition.onerror = (e) => {
                console.warn('[Voice Assistant] Error:', e.error);
                this.isListening = false;
                if (e.error === 'not-allowed') {
                    this.updateUI('idle', '⚠️ Mic access denied');
                    this.speak("Microphone permission was denied.");
                } else if (e.error !== 'no-speech') {
                    this.updateUI('idle', '⚠️ Voice recognition error');
                } else {
                    this.updateUI('idle', 'Tap mic to speak');
                }
            };

            this.recognition.onend = () => {
                this.isListening = false;
                const status = document.getElementById('voice-status-text');
                if (status && !status.textContent.startsWith('Done') && !status.textContent.startsWith('⚠️')) {
                    this.updateUI('idle', 'Tap mic to speak');
                }
            };
        } else {
            console.warn('[Voice Assistant] Speech Recognition not supported in this browser.');
            this.supported = false;
        }
    }

    startListening() {
        if (!this.supported) {
            this.updateUI('idle', 'Browser unsupported');
            if (typeof showToast === 'function') showToast('Voice Recognition is not supported in this browser. Use Chrome/Edge.', 'warning');
            return;
        }
        if (this.isListening) {
            this.stopListening();
            return;
        }
        try {
            this.recognition.start();
        } catch (e) {
            console.warn('[Voice Assistant] Start error:', e);
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            this.updateUI('idle', 'Tap mic to speak');
        }
    }

    speak(text) {
        if (this.isMuted || !this.synthesis) return;
        this.synthesis.cancel(); // Stop ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        this.synthesis.speak(utterance);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        const btn = document.getElementById('voice-mute-btn');
        if (btn) btn.textContent = this.isMuted ? '🔇' : '🔊';
        if (typeof showToast === 'function') showToast(`Voice response ${this.isMuted ? 'muted' : 'unmuted'}`, 'info');
    }

    updateUI(state, text) {
        const statusEl = document.getElementById('voice-status-text');
        const transcriptEl = document.getElementById('voice-transcript');
        const micBtn = document.getElementById('voice-mic-btn');
        const widget = document.getElementById('voice-widget');

        if (statusEl) statusEl.textContent = text;
        if (micBtn) {
            micBtn.classList.toggle('listening', state === 'listening');
            micBtn.classList.toggle('processing', state === 'processing');
        }
        if (widget) {
            widget.classList.toggle('active', state === 'listening' || state === 'processing');
        }
    }

    async handleCommand(rawCmd) {
        const cmd = rawCmd.toLowerCase();
        console.info('[Voice Assistant] Processing command:', cmd);

        // 1. ADD TASK
        if (cmd.startsWith('add task') || cmd.startsWith('create task') || cmd.includes('add a task called')) {
            let title = rawCmd
                .replace(/^add task /i, '')
                .replace(/^create task /i, '')
                .replace(/add a task called /i, '')
                .trim();
            if (title.toLowerCase().startsWith('called ')) {
                title = title.substring(7).trim();
            }

            if (!title) {
                this.updateUI('idle', '⚠️ Specify task title');
                this.speak("Please specify a task title.");
                return;
            }

            this.updateUI('processing', `Adding task "${title}"...`);
            try {
                if (typeof addTask === 'function') {
                    await addTask(title, 'medium', '', 'Added via Voice Assistant');
                } else if (typeof API !== 'undefined') {
                    await API.createTask({ title, priority: 'medium', notes: 'Added via Voice Assistant' });
                }
                this.updateUI('idle', `Task created: ${title}`);
                this.speak(`Task "${title}" created successfully.`);
                if (typeof showToast === 'function') showToast(`Voice: Task "${title}" created!`, 'success');
            } catch (err) {
                this.updateUI('idle', '⚠️ Failed to create task');
                this.speak("Sorry, I could not create the task.");
            }
            return;
        }

        // 2. SHOW TASKS
        if (cmd.includes('show tasks') || cmd.includes('open tasks') || cmd.includes('my tasks')) {
            if (typeof navigateTo === 'function') navigateTo('tasks-goals');
            this.updateUI('idle', 'Showing tasks');
            this.speak("Showing your tasks.");
            return;
        }

        // 3. SHOW GOALS
        if (cmd.includes('show goals') || cmd.includes('open goals') || cmd.includes('create goal')) {
            if (typeof navigateTo === 'function') navigateTo('tasks-goals');
            this.updateUI('idle', 'Showing goals');
            this.speak("Showing your goals.");
            return;
        }

        // 4. SHOW CALENDAR
        if (cmd.includes('show calendar') || cmd.includes('open calendar') || cmd.includes('upcoming events')) {
            if (typeof navigateTo === 'function') navigateTo('dashboard');
            const calSection = document.getElementById('dashboard-calendar-widget');
            if (calSection) calSection.scrollIntoView({ behavior: 'smooth' });
            this.updateUI('idle', 'Showing calendar');
            this.speak("Showing your upcoming calendar events.");
            return;
        }

        // 5. PRODUCTIVITY SCORE / ANALYTICS
        if (cmd.includes('productivity') || cmd.includes('my score') || cmd.includes('analytics')) {
            const score = typeof calcProductivity === 'function' ? calcProductivity() : 82;
            if (typeof navigateTo === 'function') navigateTo('analytics');
            this.updateUI('idle', `Score: ${score}%`);
            this.speak(`Your productivity score is ${score} percent.`);
            return;
        }

        // 6. WEATHER
        if (cmd.includes('weather') || cmd.includes("what's the weather") || cmd.includes('temperature')) {
            try {
                const res = await API.getWeather();
                const w = res.weather;
                const msg = `Today's weather in ${w.location} is ${w.temp}, ${w.condition}.`;
                this.updateUI('idle', `${w.location}: ${w.temp}`);
                this.speak(msg);
                if (typeof showToast === 'function') showToast(`Voice: ${msg}`, 'info');
            } catch (_) {
                this.speak("Weather information is currently unavailable.");
            }
            return;
        }

        // 7. SEARCH
        if (cmd.startsWith('search for') || cmd.startsWith('search')) {
            const q = rawCmd.replace(/^search for /i, '').replace(/^search /i, '').trim();
            if (q) {
                if (typeof navigateTo === 'function') navigateTo('search');
                const mainSearch = document.getElementById('search-input-main');
                if (mainSearch) mainSearch.value = q;
                if (typeof handleSearch === 'function') handleSearch(q, 'search-results');
                this.updateUI('idle', `Searching: "${q}"`);
                this.speak(`Searching for ${q}.`);
                return;
            }
        }

        // 8. RECENT ACTIVITY
        if (cmd.includes('activity') || cmd.includes('recent activity') || cmd.includes('history')) {
            if (typeof navigateTo === 'function') navigateTo('activity');
            this.updateUI('idle', 'Showing activity history');
            this.speak("Showing your recent activity history.");
            return;
        }

        // UNRECOGNIZED
        this.updateUI('idle', "Command not recognized");
        this.speak("I didn't understand that command.");
    }
}

// Global instance
window.voiceAssistant = new VoiceAssistant();
