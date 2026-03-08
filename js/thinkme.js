        // --- 1. SETUP ---
        const bgCanvas = document.getElementById('bgCanvas'); const bgCtx = bgCanvas.getContext('2d');
        const fillCanvas = document.getElementById('fillCanvas'); const fillCtx = fillCanvas.getContext('2d', { willReadFrequently: true });
        const canvas = document.getElementById('canvas'); const ctx = canvas.getContext('2d');
        const paintCanvas = document.getElementById('paintCanvas'); const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });

        let width, height, centerX, centerY;
        let isDrawing = false; let currentMode = 'silk';
        let mouseX = 0, mouseY = 0, smoothX = 0, smoothY = 0;
        
        // --- 2. THE SILK PHYSICS ENGINE ---
        let symmetry = 6;
        let isMirror = true;
        let baseColorHex = '#00f2ff';
        let rgbaColor = 'rgba(0, 242, 255, 0.04)'; // Extremely low alpha for building up brightness
        
        let strands = [];
        const numStrands = 60; // Perfect amount for thick glowing ribbons

        class Strand {
            constructor() {
                this.x = 0; this.y = 0;
                this.px = 0; this.py = 0;
                this.vx = 0; this.vy = 0;
                
                // Spring and Friction controls the "lag"
                this.spring = 0.01 + Math.random() * 0.03;
                this.friction = 0.85 + Math.random() * 0.10;
                
                // THIS IS THE SECRET: Curl creates the woven/swirling ribbon effect
                this.curl = (Math.random() - 0.5) * 1.5; 
            }

            reset(x, y) {
                this.x = this.px = x;
                this.y = this.py = y;
                this.vx = this.vy = 0;
            }

            update(targetX, targetY) {
                this.px = this.x;
                this.py = this.y;
                
                let dx = targetX - this.x;
                let dy = targetY - this.y;
                
                // Tangential force (Perpendicular to target direction)
                // This makes the strands orbit and weave around the center line
                let forceX = dx - dy * this.curl;
                let forceY = dy + dx * this.curl;
                
                this.vx += forceX * this.spring;
                this.vy += forceY * this.spring;
                
                this.vx *= this.friction;
                this.vy *= this.friction;
                
                this.x += this.vx;
                this.y += this.vy;
            }
        }

        // Helper to convert HEX to ultra-low alpha RGBA
        function hexToRgbaStr(hex, alpha) {
            let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        
        function hexToRgbaObj(hex) {
            let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
            return {r, g, b, a: 255};
        }

        function init() {
            width = window.innerWidth; height = window.innerHeight;
            centerX = width / 2; centerY = height / 2;
            [bgCanvas, fillCanvas, canvas, paintCanvas].forEach(c => { c.width = width; c.height = height; });
            
            ctx.lineCap = 'round'; paintCtx.lineCap = 'round';
            ctx.lineJoin = 'round'; paintCtx.lineJoin = 'round';
            
            // Pure black background is mandatory for Additive Blending to look like Neon
            bgCtx.fillStyle = '#000000';
            bgCtx.fillRect(0, 0, width, height);
            
            strands = [];
            for(let i=0; i<numStrands; i++) strands.push(new Strand());

            if(paintHistory.length === 0) savePaintState();
        }

        // --- 3. THE RENDER LOOP ---
        function renderSilk() {
            if (isDrawing && currentMode === 'silk') {
                // Smooth Mouse Interpolation (The Spine)
                smoothX += (mouseX - smoothX) * 0.15;
                smoothY += (mouseY - smoothY) * 0.15;

                // Magic Blending Mode
                ctx.globalCompositeOperation = 'lighter';
                ctx.lineWidth = 0.5; // Very fine threads
                ctx.strokeStyle = rgbaColor;

                const angleStep = (Math.PI * 2) / symmetry;

                strands.forEach((s) => {
                    s.update(smoothX, smoothY);

                    // Skip drawing if the movement is zero (prevents dots from burning pure white)
                    if(Math.abs(s.x - s.px) < 0.1 && Math.abs(s.y - s.py) < 0.1) return;

                    ctx.save();
                    ctx.translate(centerX, centerY);

                    for (let i = 0; i < symmetry; i++) {
                        ctx.rotate(angleStep);
                        
                        // Draw Main Symmetry
                        ctx.beginPath();
                        ctx.moveTo(s.px, s.py);
                        ctx.lineTo(s.x, s.y);
                        ctx.stroke();

                        // Draw Mirror
                        if (isMirror) {
                            ctx.save();
                            ctx.scale(-1, 1);
                            ctx.beginPath();
                            ctx.moveTo(s.px, s.py);
                            ctx.lineTo(s.x, s.y);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                    ctx.restore();
                });
            }
            requestAnimationFrame(renderSilk);
        }

        // --- 4. INTERACTION ---
        window.addEventListener('pointerdown', (e) => {
            if(e.target.tagName !== 'CANVAS') return;
            if (currentMode === 'silk') {
                isDrawing = true;
                mouseX = e.clientX - centerX;
                mouseY = e.clientY - centerY;
                smoothX = mouseX;
                smoothY = mouseY;
                strands.forEach(s => s.reset(smoothX, smoothY));
            } else {
                startPainting(e);
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (currentMode === 'silk') {
                mouseX = e.clientX - centerX;
                mouseY = e.clientY - centerY;
            } else if (isPainting) {
                drawPaint(e);
            }
        });

        window.addEventListener('pointerup', () => { isDrawing = false; isPainting = false; });
        window.addEventListener('pointercancel', () => { isDrawing = false; isPainting = false; });
        document.addEventListener('touchstart', (e) => { if(e.target.tagName === 'CANVAS') e.preventDefault(); }, {passive: false});
        document.addEventListener('touchmove', (e) => { if(e.target.tagName === 'CANVAS') e.preventDefault(); }, {passive: false});

        // --- 5. UI CONTROLS ---
        document.getElementById('clearBtn').onclick = () => ctx.clearRect(0, 0, width, height);
        
        document.getElementById('symRange').oninput = (e) => {
            symmetry = parseInt(e.target.value);
            document.getElementById('symValue').innerText = symmetry;
        };

        const mirrorToggle = document.getElementById('mirrorToggle');
        const mirrorToggleMobile = document.getElementById('mirrorToggleMobile');
        const mirrorText = document.getElementById('mirrorText');
        const toggleMirrorLogic = () => {
            isMirror = !isMirror;
            mirrorText.innerText = `Mirror: ${isMirror ? 'On' : 'Off'}`;
            mirrorToggle.classList.toggle('active-tool', isMirror);
            if (mirrorToggleMobile) mirrorToggleMobile.classList.toggle('active-tool', isMirror);
        };
        mirrorToggle.onclick = toggleMirrorLogic;
        if (mirrorToggleMobile) mirrorToggleMobile.onclick = toggleMirrorLogic;

        document.querySelectorAll('.color-opt').forEach(opt => {
            opt.onclick = () => {
                document.querySelector('.color-opt.active').classList.remove('active');
                opt.classList.add('active');
                if(opt.dataset.type !== 'rainbow') {
                    baseColorHex = opt.dataset.color || '#00f2ff';
                    rgbaColor = hexToRgbaStr(baseColorHex, 0.04); // Update Alpha Color
                }
            };
        });

        // RECORDING
        let mediaRecorder; let recordedChunks = []; let isRecording = false;
        const recordBtn = document.getElementById('recordBtn');
        recordBtn.onclick = () => {
            if (!isRecording) {
                recordedChunks = [];
                const stream = canvas.captureStream(60);
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
                mediaRecorder.onstop = () => {
                    if (confirm("Recording finished! Save masterpiece?")) {
                        const blob = new Blob(recordedChunks, { type: 'video/webm' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `thinkme-silk-${Date.now()}.webm`; a.click();
                    }
                };
                mediaRecorder.start();
                isRecording = true;
                recordBtn.classList.add('recording-pulse');
                document.getElementById('recordText').innerText = "Stop";
            } else {
                mediaRecorder.stop();
                isRecording = false;
                recordBtn.classList.remove('recording-pulse');
                document.getElementById('recordText').innerText = "Record";
            }
        };

        function exportImage() {
            const temp = document.createElement('canvas'); temp.width = width; temp.height = height;
            const tCtx = temp.getContext('2d');
            tCtx.drawImage(bgCanvas, 0, 0); tCtx.drawImage(fillCanvas, 0, 0);
            tCtx.drawImage(canvas, 0, 0); tCtx.drawImage(paintCanvas, 0, 0);
            const a = document.createElement('a'); a.href = temp.toDataURL('image/png'); a.download = `thinkme-art-${Date.now()}.png`; a.click();
        }
        document.getElementById('saveBtn').onclick = exportImage;
        document.getElementById('savePaintBtn').onclick = exportImage;

        // --- 6. PAINT MODE & FLOOD FILL ---
        let isPainting = false; let paintTool = 'brush'; let paintColor = '#ffffff'; let paintSize = 8; let lastX = 0, lastY = 0;
        let paintHistory = []; let paintStep = -1;

        document.getElementById('makePaintBtn').onclick = () => {
            currentMode = 'paint';
            document.getElementById('ui-layer').classList.add('hidden-ui');
            document.getElementById('paint-ui-layer').classList.remove('hidden-ui');
            paintCanvas.style.pointerEvents = 'auto';
        };

        document.getElementById('backToThinkmeBtn').onclick = () => {
            currentMode = 'silk';
            document.getElementById('paint-ui-layer').classList.add('hidden-ui');
            document.getElementById('ui-layer').classList.remove('hidden-ui');
            paintCanvas.style.pointerEvents = 'none';
        };

        function floodFill(startX, startY, fillColorHex) {
            startX = Math.floor(startX); startY = Math.floor(startY);
            const tCanvas = document.createElement('canvas'); tCanvas.width = width; tCanvas.height = height;
            const tCtx = tCanvas.getContext('2d', { willReadFrequently: true });
            tCtx.drawImage(fillCanvas, 0, 0); tCtx.drawImage(canvas, 0, 0); tCtx.drawImage(paintCanvas, 0, 0);
            
            const imgData = tCtx.getImageData(0, 0, width, height); const data = imgData.data;
            const fillData = fillCtx.createImageData(width, height); const fData = fillData.data;
            const visited = new Uint8Array(width * height);
            const startPos = (startY * width + startX) * 4;
            const startR = data[startPos], startG = data[startPos+1], startB = data[startPos+2], startA = data[startPos+3];
            const fc = hexToRgbaObj(fillColorHex);

            if (startA >= 80 && Math.abs(startR - fc.r) < 5 && Math.abs(startG - fc.g) < 5 && Math.abs(startB - fc.b) < 5) return;
            const matchStartColor = (pos) => {
                const a = data[pos+3]; if (startA < 80) return a < 80;
                return Math.abs(data[pos] - startR) < 40 && Math.abs(data[pos+1] - startG) < 40 && Math.abs(data[pos+2] - startB) < 40 && Math.abs(a - startA) < 40;
            };

            if (!matchStartColor(startPos)) return;
            const pixelStack = [startX, startY];

            while(pixelStack.length > 0) {
                let y = pixelStack.pop(), x = pixelStack.pop();
                let currentPos = (y * width + x) * 4, pixelIndex = y * width + x;
                while(y >= 0 && matchStartColor(currentPos) && !visited[pixelIndex]) { y--; currentPos -= width * 4; pixelIndex -= width; }
                y++; currentPos += width * 4; pixelIndex += width;
                let reachLeft = false, reachRight = false;
                while(y < height && matchStartColor(currentPos) && !visited[pixelIndex]) {
                    fData[currentPos] = fc.r; fData[currentPos+1] = fc.g; fData[currentPos+2] = fc.b; fData[currentPos+3] = fc.a;
                    visited[pixelIndex] = 1;
                    if(x > 0) { if(matchStartColor(currentPos - 4) && !visited[pixelIndex - 1]) { if(!reachLeft) { pixelStack.push(x - 1, y); reachLeft = true; } } else if(reachLeft) reachLeft = false; }
                    if(x < width - 1) { if(matchStartColor(currentPos + 4) && !visited[pixelIndex + 1]) { if(!reachRight) { pixelStack.push(x + 1, y); reachRight = true; } } else if(reachRight) reachRight = false; }
                    y++; currentPos += width * 4; pixelIndex += width;
                }
            }
            const tempFillCanvas = document.createElement('canvas'); tempFillCanvas.width = width; tempFillCanvas.height = height;
            tempFillCanvas.getContext('2d').putImageData(fillData, 0, 0); fillCtx.drawImage(tempFillCanvas, 0, 0);
            savePaintState();
        }

        function startPainting(e) {
            if(paintTool === 'fill') { floodFill(e.clientX, e.clientY, paintColor); return; }
            isPainting = true; lastX = e.clientX; lastY = e.clientY;
        }

        function drawPaint(e) {
            if(!isPainting || paintTool === 'fill') return;
            paintCtx.beginPath();
            paintCtx.globalCompositeOperation = paintTool === 'eraser' ? 'destination-out' : 'source-over';
            paintCtx.strokeStyle = paintTool === 'eraser' ? 'rgba(0,0,0,1)' : paintColor;
            paintCtx.lineWidth = paintSize;
            paintCtx.moveTo(lastX, lastY); paintCtx.lineTo(e.clientX, e.clientY); paintCtx.stroke();
            lastX = e.clientX; lastY = e.clientY;
        }

        function savePaintState() {
            if (paintStep < paintHistory.length - 1) paintHistory.length = paintStep + 1;
            paintHistory.push({ paint: paintCanvas.toDataURL(), fill: fillCanvas.toDataURL() });
            paintStep++;

            if (paintHistory.length > 20) {
                paintHistory.shift();
                paintStep--;
            }
        }

        document.getElementById('undoPaintBtn').onclick = () => {
            if (paintStep > 0) {
                paintStep--; let state = paintHistory[paintStep];
                let imgP = new Image(); imgP.src = state.paint; imgP.onload = () => { paintCtx.clearRect(0, 0, width, height); paintCtx.drawImage(imgP, 0, 0); };
                let imgF = new Image(); imgF.src = state.fill; imgF.onload = () => { fillCtx.clearRect(0, 0, width, height); fillCtx.drawImage(imgF, 0, 0); };
            }
        };

        document.getElementById('clearPaintBtn').onclick = () => { paintCtx.clearRect(0, 0, width, height); fillCtx.clearRect(0, 0, width, height); savePaintState(); };

        document.getElementById('brushToolBtn').onclick = () => { paintTool = 'brush'; updatePaintUI('brushToolBtn'); };
        document.getElementById('eraserToolBtn').onclick = () => { paintTool = 'eraser'; updatePaintUI('eraserToolBtn'); };
        document.getElementById('fillToolBtn').onclick = () => { paintTool = 'fill'; updatePaintUI('fillToolBtn'); };
        function updatePaintUI(id) { document.querySelectorAll('.active-paint-tool').forEach(el => el.classList.remove('active-paint-tool')); document.getElementById(id).classList.add('active-paint-tool'); }

        document.getElementById('paintSizeRange').oninput = (e) => { paintSize = e.target.value; document.getElementById('paintSizeValue').innerText = paintSize; };
        document.querySelectorAll('.paint-color-opt').forEach(opt => { opt.onclick = () => { if(paintTool === 'eraser') document.getElementById('brushToolBtn').click(); document.querySelector('.paint-color-opt.active').classList.remove('active'); opt.classList.add('active'); paintColor = opt.dataset.color; }; });

        window.addEventListener('resize', init);
        
        // Start Magic
        init();
        renderSilk();
