const app = {
    user: localStorage.getItem('nexusUser'),
    peer: null, conn: null, mode: 'OFFLINE',
    p1HP: 100, p2HP: 100, p1M: null, p2M: null,

    login() {
        let n = document.getElementById('username').value.trim();
        if(n.length < 2) return;
        this.user = n.replace(/\s/g, '');
        localStorage.setItem('nexusUser', this.user);
        this.showMenu();
    },
    showMenu() {
        document.getElementById('user-display').innerText = this.user.toUpperCase();
        this.switch('scr-menu');
        if(!this.peer) this.setupPeer();
    },
    setupPeer() {
        const id = this.user.toLowerCase() + "-" + Math.floor(1000 + Math.random()*9000);
        document.getElementById('my-word-id').innerText = id.toUpperCase();
        this.peer = new Peer(id);
        this.peer.on('connection', c => { this.conn = c; this.handleConn(); });
    },
    showOnline() { this.switch('scr-online'); },
    connect() {
        let tid = document.getElementById('target-id').value.toLowerCase().trim();
        this.conn = this.peer.connect(tid);
        this.handleConn();
    },
    handleConn() {
        this.conn.on('open', () => this.startMode('ONLINE'));
        this.conn.on('data', data => {
            if(data.type === 'move') { this.p2M = data.move; this.check(); }
            if(data.type === 'syncHP') { this.p2HP = data.hp; this.updateUI(); }
        });
    },
    startMode(m) {
        this.mode = m; this.p1HP = 100; this.p2HP = 100;
        document.getElementById('p2-btns').style.visibility = (m === 'LOCAL') ? 'visible' : 'hidden';
        this.updateUI(); this.switch('scr-game');
    },
    input(p, m) {
        if(p === 1) {
            if(this.p1M) return;
            this.p1M = m;
            if(this.mode === 'ONLINE') this.conn.send({type: 'move', move: m});
        } else if(p === 2 && this.mode === 'LOCAL') {
            this.p2M = m;
        }
        if(this.mode === 'OFFLINE') this.p2M = ['stone','paper','scissors'][Math.floor(Math.random()*3)];
        document.getElementById('status-msg').innerText = "LIMIT BREAKER...";
        this.check();
    },
    check() {
        if(this.p1M && this.p2M) {
            const win = {stone:'scissors', paper:'stone', scissors:'paper'};
            let txt = (this.p1M === this.p2M) ? "CLASH!" : (win[this.p1M] === this.p2M ? (this.p2HP -= 20, "GOKU STRIKES!") : (this.p1HP -= 20, "COUNTERED!"));
            if(this.mode === 'ONLINE') this.conn.send({type: 'syncHP', hp: this.p1HP});
            document.getElementById('status-msg').innerText = txt;
            this.updateUI();
            this.p1M = null; this.p2M = null;
        }
    },
    updateUI() {
        document.getElementById('p1-fill').style.width = this.p1HP + "%";
        document.getElementById('p2-fill').style.width = this.p2HP + "%";
        if(this.p1HP <= 0 || this.p2HP <= 0) {
            setTimeout(() => { alert(this.p1HP <= 0 ? "K.O." : "ULTIMATE VICTORY"); location.reload(); }, 500);
        }
    },
    switch(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }
};

// Start app if user is already logged in from previous session
if(app.user) app.showMenu();
