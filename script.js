/**
 * ========================================================================
 * FILE: script.js
 * ARCHITECTURE: Enterprise-Grade Module Pattern
 * PURPOSE: This script utilizes Object-Oriented design. It is broken into 
 * distinct "Managers" that handle specific duties (Audio, Physics, Game State).
 * This prevents spaghetti code and makes the application infinitely scalable.
 * ========================================================================
 */

// ------------------------------------------------------------------------
// MODULE 1: THE AUDIO SYNTHESIZER
// Generates waveforms using mathematical frequencies instead of MP3 files.
// ------------------------------------------------------------------------
const AudioManager = {
    audioCtx: null,

    /**
     * Initializes the Web Audio API. Must be called after a user interaction.
     */
    bootup() {
        // Fallback for older browsers
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
        console.log("[AUDIO MANAGER] Context Initialized. State:", this.audioCtx.state);
    },

    /**
     * Master function to generate a specific sound wave.
     * @param {number} freq - Pitch of the sound (Hz)
     * @param {string} waveType - 'sine', 'square', 'sawtooth', 'triangle'
     * @param {number} dur - Duration in seconds
     * @param {number} vol - Volume scale (0.0 to 1.0)
     */
    generateTone(freq, waveType, dur, vol = 1) {
        if (!this.audioCtx) return;

        // Create oscillator (sound generator) and gain (volume control)
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.type = waveType;
        oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        // Amplitude Envelope: Sharp attack, exponential decay for retro sound
        gainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + dur);

        // Connect nodes to hardware speakers
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        // Start and auto-stop
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + dur);
    },

    // Pre-defined Sound Profiles
    playLockIn()  { this.generateTone(880, 'sine', 0.1, 0.5); },
    playClash()   { this.generateTone(200, 'square', 0.15, 0.8); },
    playHit()     { this.generateTone(100, 'sawtooth', 0.4, 1.0); },
    playVictory() { 
        // Simple arpeggio
        this.generateTone(440, 'sine', 0.2, 0.5);
        setTimeout(() => this.generateTone(554, 'sine', 0.2, 0.5), 100);
        setTimeout(() => this.generateTone(659, 'sine', 0.4, 0.5), 200);
    }
};

// ------------------------------------------------------------------------
// MODULE 2: PHYSICS & PARTICLE RENDERER
// Handles high-performance Canvas 2D rendering for visual effects.
// ------------------------------------------------------------------------
const PhysicsEngine = {
    canvas: null,
    ctx: null,
    particles: [],
    screenWidth: 0,
    screenHeight: 0,

    /**
     * Grabs the canvas from DOM and starts the 60FPS render loop.
     */
    bootup() {
        this.canvas = document.getElementById('fx-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.handleResize();
        
        // Listen for phone rotation/resize
        window.addEventListener('resize', () => this.handleResize());
        
        console.log("[PHYSICS ENGINE] Canvas context acquired.");
        this.renderLoop(); // Start recursive loop
    },

    handleResize() {
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        // Fix pixel scaling for high-DPI retina displays
        this.canvas.width = this.screenWidth * window.devicePixelRatio;
        this.canvas.height = this.screenHeight * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    /**
     * Spawns a cluster of physics objects at a specific coordinate.
     * @param {number} originX - X coordinate on screen
     * @param {number} originY - Y coordinate on screen
     * @param {string} hexColor - Color of the particles
     */
    triggerExplosion(originX, originY, hexColor) {
        const particleCount = 50; // Heavy particle load
        
        for (let i = 0; i < particleCount; i++) {
            // Randomize trajectory vectors utilizing Math.cos/sin for circular spread
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 15 + 5;

            this.particles.push({
                x: originX,
                y: originY,
                vx: Math.cos(angle) * velocity, // Vector X
                vy: Math.sin(angle) * velocity, // Vector Y
                radius: Math.random() * 5 + 2,
                color: hexColor,
                alpha: 1.0,
                friction: 0.95, // Slows down over time
                gravity: 0.2  // Pulls downward
            });
        }
    },

    /**
     * The master recursive loop running at 60 FPS via requestAnimationFrame
     */
    renderLoop() {
        // Request next frame immediately
        requestAnimationFrame(() => this.renderLoop());

        // Clear previous frame data
        this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);

        // Iterate backward to safely remove dead particles from array
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];

            // Apply Math physics
            p.vx *= p.friction;
            p.vy *= p.friction;
            p.vy += p.gravity;
            
            // Update position based on velocity
            p.x += p.vx;
            p.y += p.vy;
            
            // Apply decay to opacity
            p.alpha -= 0.015;

            // Garbage Collection: Remove if invisible
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            // Draw to Canvas
            this.ctx.globalAlpha = p.alpha;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        }
    }
};

// ------------------------------------------------------------------------
// MODULE 3: MASTER GAME STATE CONTROLLER
// Contains all logic, health mathematics, and DOM updates.
// ------------------------------------------------------------------------
const GameCore = {
    // 1. Data Store (Source of Truth)
    config: {
        maxHealth: 100,
        baseDamage: 25,
        comboMultiplier: 0.2 // Each combo adds 20% damage
    },
    
    state: {
        p1: { hp: 100, move: null, combo: 0, theme: '#00f3ff' },
        p2: { hp: 100, move: null, combo: 0, theme: '#ff0055' },
        phase: 'AWAITING' // States: AWAITING, RESOLVING, GAMEOVER
    },
    
    dict: { 
        'rock': '✊', 
        'paper': '✋', 
        'scissors': '✌️' 
    },

    /**
     * Initializes event listeners and binds UI
     */
    bootup() {
        document.getElementById('btn-engage').addEventListener('click', () => {
            // Hide boot screen
            document.getElementById('boot-screen').classList.remove('active');
            
            // Boot sub-systems
            AudioManager.bootup();
            PhysicsEngine.bootup();
            
            this.attachInputListeners();
            console.log("[GAME CORE] Main Engine Online.");
        });
    },

    attachInputListeners() {
        // Find all elements with class 'attack-input'
        const buttons = document.querySelectorAll('.attack-input');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', (event) => {
                // Extract data attributes from the clicked HTML button
                const playerID = parseInt(event.currentTarget.getAttribute('data-player'));
                const moveData = event.currentTarget.getAttribute('data-move');
                
                this.registerInput(playerID, moveData, event.currentTarget);
            });
        });
    },

    /**
     * Validates and locks in a player's move.
     */
    registerInput(playerID, move, btnElement) {
        // Prevent action if game is over or resolving
        if (this.state.phase !== 'AWAITING') return;

        let playerRef = playerID === 1 ? this.state.p1 : this.state.p2;

        // Prevent changing move once locked in
        if (playerRef.move !== null) return;

        // Update State
        playerRef.move = move;
        AudioManager.playLockIn();

        // Update UI Visuals
        btnElement.classList.add('locked-in');
        let statusDisplay = document.getElementById(`p${playerID}-status-display`);
        statusDisplay.innerText = "COMMAND LOCKED";
        statusDisplay.style.color = playerRef.theme;

        // Check Phase Transition Condition
        if (this.state.p1.move !== null && this.state.p2.move !== null) {
            this.state.phase = 'RESOLVING';
            // Slight delay for dramatic effect
            setTimeout(() => this.processCombatResolution(), 400); 
        }
    },

    /**
     * The Master Logic Matrix for determining the winner.
     */
    processCombatResolution() {
        const m1 = this.state.p1.move;
        const m2 = this.state.p2.move;
        const announcer = document.getElementById('global-announcer');

        // Reveal Actual Choices on Screen
        document.getElementById('p1-status-display').innerText = this.dict[m1];
        document.getElementById('p2-status-display').innerText = this.dict[m2];

        // LOGIC BRANCH: DRAW
        if (m1 === m2) {
            announcer.innerText = "CLASH DETECTED";
            announcer.style.borderColor = "#ffffff";
            announcer.style.color = "#ffffff";
            
            // Break both combos
            this.state.p1.combo = 0;
            this.state.p2.combo = 0;
            AudioManager.playClash();
        } 
        // LOGIC BRANCH: PLAYER 1 WINS
        else if (
            (m1 === 'rock' && m2 === 'scissors') ||
            (m1 === 'paper' && m2 === 'rock') ||
            (m1 === 'scissors' && m2 === 'paper')
        ) {
            this.executeDamageSequence(1, 2, announcer);
        } 
        // LOGIC BRANCH: PLAYER 2 WINS
        else {
            this.executeDamageSequence(2, 1, announcer);
        }

        // Apply visual HUD updates to health and combo meters
        this.renderHUDUpdates();

        // Phase Check: Did someone die?
        if (this.state.p1.hp <= 0 || this.state.p2.hp <= 0) {
            this.state.phase = 'GAMEOVER';
            setTimeout(() => this.triggerSystemFailure(), 1500);
        } else {
            // Reset for next turn
            setTimeout(() => this.resetTurnCycle(), 2000);
        }
    },

    /**
     * Handles mathematics, DOM shaking, and FX triggers for a successful hit.
     */
    executeDamageSequence(attackerID, defenderID, announcerEl) {
        let attacker = attackerID === 1 ? this.state.p1 : this.state.p2;
        let defender = defenderID === 1 ? this.state.p1 : this.state.p2;

        // Combo Mathematics
        attacker.combo++;
        defender.combo = 0; // Combo breaker
        
        // Damage Formula: Base + (Base * Multiplier * Combo)
        let calcDamage = this.config.baseDamage + (this.config.baseDamage * this.config.comboMultiplier * (attacker.combo - 1));
        defender.hp -= calcDamage;

        // UI Text Updates
        announcerEl.innerText = `P${attackerID} CRITICAL STRIKE`;
        announcerEl.style.borderColor = attacker.theme;
        announcerEl.style.color = attacker.theme;

        // FX Triggers
        AudioManager.playHit();
        
        // Apply CSS class for screen shake to the loser's sector
        const sectorEl = document.getElementById(`sector-p${defenderID}`);
        sectorEl.classList.add('trauma-applied');
        
        // Remove class after animation finishes (0.5s) to allow it to trigger again later
        setTimeout(() => sectorEl.classList.remove('trauma-applied'), 500);

        // Coordinate Mapping for Particle Engine
        // If P1 (bottom) got hit, explode near bottom. If P2, explode near top.
        const originY = defenderID === 1 ? window.innerHeight * 0.75 : window.innerHeight * 0.25;
        const originX = window.innerWidth / 2;
        
        PhysicsEngine.triggerExplosion(originX, originY, attacker.theme);
    },

    /**
     * Syncs the HTML DOM elements to match the internal JS Data State.
     */
    renderHUDUpdates() {
        // Cap health visually at 0 minimum
        const p1VisHP = Math.max(0, this.state.p1.hp);
        const p2VisHP = Math.max(0, this.state.p2.hp);

        // Modify CSS width percentages
        document.getElementById('p1-health-fill').style.width = `${p1VisHP}%`;
        document.getElementById('p2-health-fill').style.width = `${p2VisHP}%`;

        // Update Combo Texts and Dynamic Rage Backgrounds
        [1, 2].forEach(id => {
            let player = id === 1 ? this.state.p1 : this.state.p2;
            let comboEl = document.getElementById(`p${id}-combo-text`);
            let sectorEl = document.getElementById(`sector-p${id}`);

            comboEl.innerText = `COMBO MULTIPLIER: ${player.combo}x`;

            if (player.combo >= 2) {
                comboEl.classList.add('combo-highlight');
                sectorEl.classList.add(`rage-active-p${id}`);
            } else {
                comboEl.classList.remove('combo-highlight');
                sectorEl.classList.remove(`rage-active-p${id}`);
            }
        });
    },

    /**
     * Wipes UI data clean for the next round.
     */
    resetTurnCycle() {
        // Purge State
        this.state.p1.move = null;
        this.state.p2.move = null;
        this.state.phase = 'AWAITING';

        // Purge UI Buttons
        document.querySelectorAll('.attack-input').forEach(btn => {
            btn.classList.remove('locked-in');
        });

        // Purge Status Text
        [1, 2].forEach(id => {
            let display = document.getElementById(`p${id}-status-display`);
            display.innerText = "AWAITING NEURAL LINK";
            display.style.color = "#555";
        });

        // Purge Center Announcer
        let announcer = document.getElementById('global-announcer');
        announcer.innerText = "VS";
        announcer.style.borderColor = "#444";
        announcer.style.color = "#ffffff";
    },

    /**
     * Handles final win/loss state and reboots.
     */
    triggerSystemFailure() {
        AudioManager.playVictory();
        const winner = this.state.p1.hp <= 0 ? "PLAYER 2 DOMINATION" : "PLAYER 1 DOMINATION";
        
        // Native browser alert as final fallback overlay
        alert(`>>> SYSTEM OVERRIDE <<<\n\n${winner}\n\nPress OK to restart engine.`);
        
        // Full page reboot
        window.location.reload();
    }
};

// ========================================================================
// SYSTEM BOOTLOADER
// Fires when the DOM is fully constructed by the browser.
// ========================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded. Booting GameCore Engine...");
    GameCore.bootup();
});
