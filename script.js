const Game = {
    user: localStorage.getItem('nexusUser'),
    peer: null, conn: null, mode: 'OFFLINE',
    p1HP: 100, p2HP: 100, p1Move: null, p2Move: null,
    icons: { 'rock': '✊', 'paper': '✋', 'scissors': '✌️' },

    // --- 1. MENU & AUDIO INITIALIZATION ---
    login() {
        let n = document.getElementById('username').value.trim();
        if(n.length < 2) return;
        this.user = n.replace(/\s/g, '');
        localStorage.setItem('nexusUser', this.user);
        
        // Start background music securely after user clicks "AWAKEN"
        let bgm = document.getElementById('bg-music');
        bgm.volume = 0.4;
        bgm.play().catch(e => console.log("Audio play prevented"));

        this.showMenu();
    },

    showMenu() {
        document.getElementById('user-display').innerText = `FIGHTER: ${this.user.toUpperCase()}`;
        this.switch('scr-menu');
        if(!this.peer) this.setupPeer();
    },

    // --- 2. PEER JS ONLINE NETWORKING ---
    setupPeer() {
        const id = this.user.toLowerCase() + "-" + Math.floor(1000 + Math.random()*9000);
        document.getElementById('my-word-id').innerText = id.toUpperCase();
        this.peer = new Peer(id);
        this.peer.on('connection', c => { this.conn = c; this.handleConn(); });
    },
    
    showOnline() { this.switch('scr-online'); },
    
    connect() {
        let tid = document.getElementById('target-id').value.toLowerCase().trim();
        if (!tid) return;
        this.conn = this.peer.connect(tid);
        this.handleConn();
    },
    
    handleConn() {
        this.conn.on('open', () => this.startMode('ONLINE'));
        this.conn.on('data', data => {
            if(data.type === 'move') { this.p2Move = data.move; this.checkCombat(); }
            if(data.type === 'syncHP') { this.p2HP = data.hp; this.updateUI(); }
        });
    },

    // --- 3. COMBAT ARENA LOGIC ---
    startMode(m) {
        this.mode = m; 
        this.p1HP = 100; 
        this.p2HP = 100;
        
        // Hide P2 buttons if playing Online or vs CPU
        document.getElementById('p2-btns').style.visibility = (m === 'LOCAL') ? 'visible' : 'hidden';
        
        this.updateUI(); 
        this.switch('scr-game');
    },

    input(player, move) {
        // Log Player 1's Move
        if (player === 1 && !this.p1Move) {
            this.p1Move = move;
            // HIDDEN STATE: Only show text, do NOT highlight the button
            let stat = document.getElementById('p1-status');
            stat.innerText = "READY";
            stat.style.color = "#00f3ff";
            
            // Send move if playing online
            if(this.mode === 'ONLINE') this.conn.send({type: 'move', move: move});
        } 
        // Log Player 2's Move (Local Mode Only)
        else if (player === 2 && this.mode === 'LOCAL' && !this.p2Move) {
            this.p2Move = move;
            // HIDDEN STATE
            let stat = document.getElementById('p2-status');
            stat.innerText = "READY";
            stat.style.color = "#ff00f7";
        }

        // CPU Logic
        if (this.mode === 'OFFLINE') {
            this.p2Move = ['rock','paper','scissors'][Math.floor(Math.random()*3)];
        }

        this.checkCombat();
    },

    checkCombat() {
        // Only resolve if BOTH players have chosen
        if (this.p1Move && this.p2Move) {
            
            // Reveal the choices on screen
            document.getElementById('p1-status').innerText = this.icons[this.p1Move];
            document.getElementById('p2-status').innerText = this.icons[this.p2Move];

            let msg = document.getElementById('result-msg');
            let sfx = document.getElementById('hit-sound');

            // Draw
            if (this.p1Move === this.p2Move) {
                msg.innerText = "CLASH!";
                msg.style.borderColor = "white";
            } 
            // Player 1 Wins
            else if (
                (this.p1Move === 'rock' && this.p2Move === 'scissors') ||
                (this.p1Move === 'paper' && this.p2Move === 'rock') ||
                (this.p1Move === 'scissors' && this.p2Move === 'paper')
            ) {
                msg.innerText = "P1 STRIKES!";
                msg.style.borderColor = "#00f3ff";
                this.p2HP -= 20;
                sfx.play();
                document.getElementById('p2-zone').classList.add('shake');
            } 
            // Player 2 Wins
            else {
                msg.innerText = "P2 STRIKES!";
                msg.style.borderColor = "#ff00f7";
                this.p1HP -= 20;
                sfx.play();
                document.getElementById('p1-zone').classList.add('shake');
            }

            // Sync Health for Online Mode
            if(this.mode === 'ONLINE') this.conn.send({type: 'syncHP', hp: this.p1HP});
            
            this.updateUI();

            // Clear choices for next round
            this.p1Move = null; 
            this.p2Move = null;

            // Remove shake animation class
            setTimeout(() => {
                document.getElementById('p1-zone').classList.remove('shake');
                document.getElementById('p2-zone').classList.remove('shake');
            }, 500);

            // Hide choices again after 2 seconds
            setTimeout(() => {
                if (this.p1HP > 0 && this.p2HP > 0) {
                    document.getElementById('p1-status').innerText = "WAITING...";
                    document.getElementById('p2-status').innerText = "WAITING...";
                    document.getElementById('p1-status').style.color = "white";
                    document.getElementById('p2-status').style.color = "white";
                    msg.innerText = "VS";
                    msg.style.borderColor = "white";
                }
            }, 2000);
        }
    },

    updateUI() {
        document.getElementById('p1-hp').style.width = this.p1HP + "%";
        document.getElementById('p2-hp').style.width = this.p2HP + "%";
        
        if (this.p1HP <= 0 || this.p2HP <= 0) {
            setTimeout(() => { 
                alert(this.p1HP <= 0 ? "PLAYER 2 DOMINATES" : "PLAYER 1 DOMINATES"); 
                location.reload(); 
            }, 500);
        }
    },

    switch(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }
};

// Start app if user is already logged in
if (Game.user) Game.login();
