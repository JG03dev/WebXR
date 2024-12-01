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
        this.isInitialized = false;
        
        // Configurable parameters
        this.SILENCE_THRESHOLD = -50;
        this.SILENCE_DURATION = 1000;
        this.MAX_RECORDING_TIME = 30000;
        
        // Create a sprite for the audio icon
        const spriteMaterial = new THREE.SpriteMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });
        this.audioIcon = new THREE.Sprite(spriteMaterial);
        this.audioIcon.scale.set(0.05, 0.05, 1);
        
        // Position the sprite relative to the camera
        // These values can be adjusted to change the position in VR view
        this.audioIcon.position.set(0.2, 0.2, -0.5);
        this.audioIcon.visible = false;
        
        // Animation properties
        this.pulseScale = 0.05;
        this.pulseDirection = 1;
        this.minScale = 0.04;
        this.maxScale = 0.06;
    }

    async initialize() {
        // Just create the audio icon and other non-audio setup
        console.log('Basic initialization complete');
        return true;
    }

    async initializeAudioContext() {
        if (this.isInitialized) return true;

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
            
            this.isInitialized = true;
            console.log('Audio system initialized');
            return true;
        } catch (error) {
            console.error('Error initializing audio system:', error);
            return false;
        }
    }

    async startRecording() {
        // Initialize audio context on first recording attempt
        if (!this.isInitialized) {
            const success = await this.initializeAudioContext();
            if (!success) return;
        }

        if (this.isRecording) return;
        
        // Resume AudioContext if it was suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
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
        if (!this.isRecording || !this.audioIcon.visible) return;
        
        // Update pulse animation
        this.pulseScale += 0.001 * this.pulseDirection;
        
        if (this.pulseScale > this.maxScale) {
            this.pulseDirection = -1;
        } else if (this.pulseScale < this.minScale) {
            this.pulseDirection = 1;
        }
        
        // Apply scale uniformly to the sprite
        this.audioIcon.scale.set(this.pulseScale, this.pulseScale, 1);
    }

    setIconColor(color) {
        if (this.audioIcon && this.audioIcon.material) {
            this.audioIcon.material.color.set(color);
        }
    }

    async playAudioResponse(audioBuffer) {
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start(0);
            
            // Visual feedback during playback
            this.setIconColor(0x0000ff); // Blue during playback
            this.audioIcon.visible = true;
            
            source.onended = () => {
                this.setIconColor(0x00ff00); // Back to green
                this.audioIcon.visible = false;
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