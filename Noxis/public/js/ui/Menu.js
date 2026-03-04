export class MenuUI {
    constructor() {
        this.screen = document.getElementById('char-creation');
        this.selectClass = document.getElementById('char-class');
        this.preview = document.getElementById('class-preview');
        this.btnStart = document.getElementById('btn-start');
        this.initEvents();
    }

    initEvents() {
        this.selectClass.addEventListener('change', (e) => {
            this.preview.className = e.target.value === 'knight' ? 'preview-knight' : 'preview-shifter';
        });

        this.btnStart.addEventListener('click', () => {
            const name = document.getElementById('char-name').value;
            if (name.length < 3) return alert("Nome muito curto!");
            this.screen.style.display = 'none';
            window.dispatchEvent(new CustomEvent('gameStart', { 
                detail: { name, class: this.selectClass.value } 
            }));
        });
    }
}