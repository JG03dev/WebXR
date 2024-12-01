import * as THREE from 'three';

class AudioHandler {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyzer = null;
        this.micStream = null;
        this.speechDetected = false;
        this.silenceTimer = null;
        this.recordingTimeout = null;
        
        // Configurable parameters
        this.SILENCE_THRESHOLD = -50; // dB
        this.SILENCE_DURATION = 1000; // ms to wait before stopping
        this.MAX_RECORDING_TIME = 30000; // ms maximum recording time
        
        // Create audio icon mesh
        const geometry = new THREE.CircleGeometry(0.05, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        this.audioIcon = new THREE.Mesh(geometry, material);
        this.audioIcon.position.set(0.2, 0.2, -0.5); // Position relative to camera
        this.audioIcon.visible = false;
        
        // Animation properties
        this.pulseScale = 1;
        this.pulseDirection = 1;
    }

    async initialize() {
        try {
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.micStream = stream;
            
            // Set up analyzer
            this.analyzer = this.audioContext.createAnalyser();
            this.analyzer.fftSize = 2048;
            this.analyzer.smoothingTimeConstant = 0.8;
            
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyzer);
            
            console.log('Audio system initialized');
            return true;
        } catch (error) {
            console.error('Error initializing audio system:', error);
            return false;
        }
    }

    startRecording() {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.audioChunks = [];
        this.audioIcon.visible = true;
        
        // Create MediaRecorder
        this.mediaRecorder = new MediaRecorder(this.micStream);
        
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };
        
        this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            this.processAudioData(audioBlob);
        };
        
        // Start recording
        this.mediaRecorder.start();
        
        // Set maximum recording time
        this.recordingTimeout = setTimeout(() => {
            this.stopRecording();
        }, this.MAX_RECORDING_TIME);
        
        // Start monitoring audio levels
        this.monitorAudioLevels();
    }

    stopRecording() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        this.audioIcon.visible = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        clearTimeout(this.recordingTimeout);
        clearTimeout(this.silenceTimer);
    }

    monitorAudioLevels() {
        if (!this.isRecording) return;
        
        const dataArray = new Float32Array(this.analyzer.frequencyBinCount);
        this.analyzer.getFloatTimeDomainData(dataArray);
        
        // Calculate RMS value
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const db = 20 * Math.log10(rms);
        
        // Check if speech is detected
        if (db > this.SILENCE_THRESHOLD) {
            this.speechDetected = true;
            clearTimeout(this.silenceTimer);
            
            // Reset silence timer
            this.silenceTimer = setTimeout(() => {
                this.stopRecording();
            }, this.SILENCE_DURATION);
        }
        
        // Continue monitoring
        requestAnimationFrame(() => this.monitorAudioLevels());
    }

    updateIconAnimation() {
        if (!this.isRecording) return;
        
        // Pulse animation
        this.pulseScale += 0.05 * this.pulseDirection;
        if (this.pulseScale > 1.2) this.pulseDirection = -1;
        if (this.pulseScale < 0.8) this.pulseDirection = 1;
        
        this.audioIcon.scale.set(this.pulseScale, this.pulseScale, 1);
    }

    async playAudioResponse(audioBuffer) {
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            
            // Visual feedback during playback
            this.audioIcon.material.color.setHex(0x0000ff); // Blue during playback
            
            source.onended = () => {
                this.audioIcon.material.color.setHex(0x00ff00); // Back to green
            };
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }

    // Process the recorded audio data
    async processAudioData(audioBlob) {
        // Here you would typically:
        // 1. Convert the blob to base64 or array buffer
        // 2. Send it to your chatbot service
        // 3. Process the response
        // For now, we'll just log the blob size
        console.log('Audio recording complete, size:', audioBlob.size);
        
        // Emit an event that can be listened to in the main script
        const event = new CustomEvent('audioRecorded', { 
            detail: { audioBlob } 
        });
        window.dispatchEvent(event);
    }

    // Clean up resources
    dispose() {
        this.stopRecording();
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

export { AudioHandler };