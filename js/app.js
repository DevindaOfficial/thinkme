        // --- Core Canvases ---
        const bgCanvas = document.getElementById('bgCanvas');
        const bgCtx = bgCanvas.getContext('2d');
        const fillCanvas = document.getElementById('fillCanvas');
        const fillCtx = fillCanvas.getContext('2d', { willReadFrequently: true });
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const paintCanvas = document.getElementById('paintCanvas');
        const paintCtx = paintCanvas.getContext('2d', { willReadFrequently: true });

        // --- App State ---
        let width, height, centerX, centerY;
        let currentMode = 'silk'; // 'silk' or 'paint'
        
        // --- UI Elements ---
        const silkUiLayer = document.getElementById('ui-layer');
        const paintUiLayer = document.getElementById('paint-ui-layer');
        
        // --- Thinkme Mode Variables ---
        const symRange = document.getElementById('symRange');
        const symValueText = document.getElementById('symValue');
        const flowRange = document.getElementById('flowRange');
        const mirrorToggle = document.getElementById('mirrorToggle');
        const mirrorToggleMobile = document.getElementById('mirrorToggleMobile');
        const mirrorText = document.getElementById('mirrorText');
        const colorOpts = document.querySelectorAll('.color-opt');
        
        let isDrawing = false;
        let symmetry = 6;
        let isMirror = true;
        let flowIntensity = 0.5;
        let currentSilkColor = '#3b82f6';
        let isRainbowMode = false;
        const prismColors = ['#00f2ff', '#a855f7', '#f43f5e', '#facc15']; 
        let prismIndex = 0;
        let targetX = 0, targetY = 0;
        let strands = [];
        const numStrands = 80; 
        let time = 0;
        let stars = [];
        let currentPressure = 0.5;
        let smoothedPressure = 0.5;

        // --- Paint Mode Variables ---
        let isPainting = false;
        let currentPaintTool = 'brush'; // 'brush', 'eraser', or 'fill'
        let currentPaintColor = '#ffffff';
        let currentPaintSize = 8;
        let lastPaintX = 0;
        let lastPaintY = 0;
        
        // Undo System
        let paintHistory = [];
        let paintStep = -1;

        // --- Thinkme Physics Class ---
        class Strand {
            constructor(index) {
                this.index = index;
                this.x = 0;
                this.y = 0;
                this.oldX = 0;
                this.oldY = 0;
                this.oldOldX = 0;
                this.oldOldY = 0;
                this.vx = 0;
                this.vy = 0;
                this.spring = 0; 
                this.friction = 0; 
            }

            update(tX, tY) {
                this.oldOldX = this.oldX;
                this.oldOldY = this.oldY;
                this.oldX = this.x;
                this.oldY = this.y;
                let dx = tX - this.x;
                let dy = tY - this.y;
                this.vx += dx * this.spring;
                this.vy += dy * this.spring;
                this.vx *= this.friction;
                this.vy *= this.friction;
                this.x += this.vx;
                this.y += this.vy;
            }

            reset(tX, tY) {
                this.x = this.oldX = this.oldOldX = tX;
                this.y = this.oldY = this.oldOldY = tY;
                this.vx = 0;
                this.vy = 0;
            }
        }

        function updatePhysics() {
            strands.forEach((strand, i) => {
                let ratio = i / numStrands;
                let baseSpring = 0.02 - (flowIntensity * 0.015);
                let baseFriction = 0.75 + (flowIntensity * 0.20);
                let curve = Math.pow(ratio, 1.2);
                strand.spring = baseSpring + (1 - curve) * 0.06; 
                strand.friction = baseFriction + curve * 0.08;   
            });
        }

        // --- Initialization ---
        function init() {
            width = window.innerWidth;
            height = window.innerHeight;
            centerX = width / 2;
            centerY = height / 2;
            
            bgCanvas.width = width;
            bgCanvas.height = height;
            fillCanvas.width = width;
            fillCanvas.height = height;
            canvas.width = width;
            canvas.height = height;
            paintCanvas.width = width;
            paintCanvas.height = height;
            
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            paintCtx.lineCap = 'round';
            paintCtx.lineJoin = 'round';
            
            strands = [];
            for (let i = 0; i < numStrands; i++) {
                strands.push(new Strand(i));
            }
            updatePhysics();
            
            stars = [];
            for(let i = 0; i < 600; i++) {
                stars.push({
                    x: (Math.random() - 0.5) * width * 2,
                    y: (Math.random() - 0.5) * height * 2,
                    z: Math.random() * width,
                    prevZ: 0
                });
            }

            // Save initial empty paint state
            if(paintHistory.length === 0) {
                savePaintState();
            }
        }

        function hexToRgba(hex) {
            let r = parseInt(hex.slice(1, 3), 16);
            let g = parseInt(hex.slice(3, 5), 16);
            let b = parseInt(hex.slice(5, 7), 16);
            return {r, g, b, a: 255};
        }

        // --- Flood Fill Algorithm ---
        function floodFill(startX, startY, fillColorHex) {
            startX = Math.floor(startX);
            startY = Math.floor(startY);
            
            // 1. Get merged boundary image for collision detection
            const tCanvas = document.createElement('canvas');
            tCanvas.width = width; tCanvas.height = height;
            const tCtx = tCanvas.getContext('2d', { willReadFrequently: true });
            tCtx.drawImage(fillCanvas, 0, 0); 
            tCtx.drawImage(canvas, 0, 0);     
            tCtx.drawImage(paintCanvas, 0, 0);
            
            const imgData = tCtx.getImageData(0, 0, width, height);
            const data = imgData.data;

            // 2. Prepare empty canvas data for our new fill area
            const fillData = fillCtx.createImageData(width, height);
            const fData = fillData.data;
            const visited = new Uint8Array(width * height);

            const startPos = (startY * width + startX) * 4;
            const startR = data[startPos];
            const startG = data[startPos+1];
            const startB = data[startPos+2];
            const startA = data[startPos+3];
            
            const fc = hexToRgba(fillColorHex);

            // Avoid infinite loop if clicking on the exact same color
            if (startA >= 80 && Math.abs(startR - fc.r) < 5 && Math.abs(startG - fc.g) < 5 && Math.abs(startB - fc.b) < 5) {
                return;
            }

            // 3. Color matching logic
            const matchStartColor = (pos) => {
                const a = data[pos+3];
                // If filling empty space, stop at solid borders
                if (startA < 80) return a < 80;
                
                // If filling a solid color, match the color with tolerance
                const r = data[pos];
                const g = data[pos+1];
                const b = data[pos+2];
                return Math.abs(r - startR) < 40 &&
                       Math.abs(g - startG) < 40 &&
                       Math.abs(b - startB) < 40 &&
                       Math.abs(a - startA) < 40;
            };

            if (!matchStartColor(startPos)) return;

            // 4. Span fill algorithm
            const pixelStack = [startX, startY];

            while(pixelStack.length > 0) {
                let y = pixelStack.pop();
                let x = pixelStack.pop();

                let currentPos = (y * width + x) * 4;
                let pixelIndex = y * width + x;

                while(y >= 0 && matchStartColor(currentPos) && !visited[pixelIndex]) {
                    y--;
                    currentPos -= width * 4;
                    pixelIndex -= width;
                }
                y++;
                currentPos += width * 4;
                pixelIndex += width;

                let reachLeft = false;
                let reachRight = false;

                while(y < height && matchStartColor(currentPos) && !visited[pixelIndex]) {
                    fData[currentPos] = fc.r;
                    fData[currentPos+1] = fc.g;
                    fData[currentPos+2] = fc.b;
                    fData[currentPos+3] = fc.a;
                    visited[pixelIndex] = 1;

                    if(x > 0) {
                        if(matchStartColor(currentPos - 4) && !visited[pixelIndex - 1]) {
                            if(!reachLeft) {
                                pixelStack.push(x - 1, y);
                                reachLeft = true;
                            }
                        } else if(reachLeft) {
                            reachLeft = false;
                        }
                    }

                    if(x < width - 1) {
                        if(matchStartColor(currentPos + 4) && !visited[pixelIndex + 1]) {
                            if(!reachRight) {
                                pixelStack.push(x + 1, y);
                                reachRight = true;
                            }
                        } else if(reachRight) {
                            reachRight = false;
                        }
                    }

                    y++;
                    currentPos += width * 4;
                    pixelIndex += width;
                }
            }

            // 5. Draw the filled area
            const tempFillCanvas = document.createElement('canvas');
            tempFillCanvas.width = width;
            tempFillCanvas.height = height;
            tempFillCanvas.getContext('2d').putImageData(fillData, 0, 0);

            fillCtx.drawImage(tempFillCanvas, 0, 0);
            savePaintState();
        }

        function clearSilkCanvas() {
            ctx.clearRect(0, 0, width, height);
        }

        // --- Animated Background ---
        function drawAnimatedBackground() {
            time += 0.0005; 
            bgCtx.fillStyle = '#020202';
            bgCtx.fillRect(0, 0, width, height);

            let bgGrad = bgCtx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, width * 0.8);
            bgGrad.addColorStop(0, '#0a0d14');
            bgGrad.addColorStop(1, '#000000');
            bgCtx.fillStyle = bgGrad;
            bgCtx.fillRect(0, 0, width, height);

            bgCtx.save();
            bgCtx.translate(width / 2, height / 2);
            bgCtx.rotate(time); 

            stars.forEach(star => {
                star.prevZ = star.z;
                star.z -= 0.15; 
                if (star.z <= 1) {
                    star.z = width;
                    star.prevZ = width;
                    star.x = (Math.random() - 0.5) * width * 2;
                    star.y = (Math.random() - 0.5) * height * 2;
                }
                let sx = (star.x / star.z) * (width / 2);
                let sy = (star.y / star.z) * (width / 2);
                let px = (star.x / star.prevZ) * (width / 2);
                let py = (star.y / star.prevZ) * (width / 2);

                let brightness = 1 - (star.z / width); 
                bgCtx.beginPath();
                bgCtx.moveTo(px, py);
                bgCtx.lineTo(sx, sy);
                bgCtx.lineWidth = brightness * 1.5;
                bgCtx.strokeStyle = `rgba(255, 255, 255, ${brightness * 0.6})`;
                bgCtx.stroke();
            });
            bgCtx.restore();
        }

        // --- Mobile-Optimized Input Handling ---
        function getEventPos(e) {
            if(e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY, p: 0.5 };
            }
            return { x: e.clientX, y: e.clientY, p: e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5 };
        }

        function handleInput(e) {
            const pos = getEventPos(e);
            targetX = pos.x - centerX;
            targetY = pos.y - centerY;
            currentPressure = pos.p;
        }

        function startSilkDrawing(e) {
            if (currentMode !== 'silk') return;
            isDrawing = true;
            handleInput(e);

            if (isRainbowMode) {
                currentSilkColor = prismColors[prismIndex % 4];
                prismIndex++;
            }

            strands.forEach(s => s.reset(targetX, targetY));
            if(e.pointerId) canvas.setPointerCapture(e.pointerId);
        }

        function stopSilkDrawing(e) {
            isDrawing = false;
            if (e && e.pointerId && currentMode === 'silk') {
                canvas.releasePointerCapture(e.pointerId);
            }
        }

        // --- Render Loop ---
        function renderSilk() {
            const angleStep = (Math.PI * 2) / symmetry;
            strands.forEach((strand, idx) => {
                strand.update(targetX, targetY);
                ctx.save();
                ctx.translate(centerX, centerY);

                for (let i = 0; i < symmetry; i++) {
                    ctx.rotate(angleStep);
                    drawNeonPath(strand, idx);
                    if (isMirror) {
                        ctx.save();
                        ctx.scale(1, -1);
                        drawNeonPath(strand, idx);
                        ctx.restore();
                    }
                }
                ctx.restore();
            });
        }

        function drawNeonPath(strand, idx) {
            ctx.globalCompositeOperation = 'lighter'; 
            ctx.beginPath();
            const xc = (strand.oldX + strand.x) / 2;
            const yc = (strand.oldY + strand.y) / 2;
            ctx.moveTo(strand.oldOldX, strand.oldOldY);
            ctx.quadraticCurveTo(strand.oldX, strand.oldY, xc, yc);
            ctx.shadowBlur = 0; 
            ctx.strokeStyle = currentSilkColor;
            
            let ratio = idx / numStrands;
            let alphaBase = 0.005 + (1 - ratio) * 0.04; 
            ctx.globalAlpha = alphaBase + (smoothedPressure * 0.02);
            ctx.lineWidth = 0.5 + Math.pow(1 - ratio, 2) * 2.0; 
            ctx.stroke();
        }

        // --- Paint Input Handling ---
        function startPainting(e) {
            if (currentMode !== 'paint') return;
            const pos = getEventPos(e);
            
            if (currentPaintTool === 'fill') {
                floodFill(pos.x, pos.y, currentPaintColor);
                return;
            }

            isPainting = true;
            lastPaintX = pos.x;
            lastPaintY = pos.y;
            
            paintCtx.beginPath();
            paintCtx.moveTo(lastPaintX, lastPaintY);
            paintCtx.lineTo(lastPaintX, lastPaintY);
            paintCtx.lineWidth = currentPaintSize;
            
            if (currentPaintTool === 'eraser') {
                paintCtx.globalCompositeOperation = 'destination-out';
                paintCtx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                paintCtx.globalCompositeOperation = 'source-over';
                paintCtx.strokeStyle = currentPaintColor;
            }
            
            paintCtx.stroke();
            if(e.pointerId) paintCanvas.setPointerCapture(e.pointerId);
        }

        function drawPaint(e) {
            if (!isPainting || currentMode !== 'paint') return;
            const pos = getEventPos(e);
            paintCtx.beginPath();
            paintCtx.moveTo(lastPaintX, lastPaintY);
            paintCtx.lineTo(pos.x, pos.y);
            paintCtx.stroke();
            
            lastPaintX = pos.x;
            lastPaintY = pos.y;
        }

        function stopPainting(e) {
            if (isPainting && currentMode === 'paint') {
                isPainting = false;
                if(e && e.pointerId) paintCanvas.releasePointerCapture(e.pointerId);
                savePaintState();
            }
        }

        // --- Paint Undo System ---
        function savePaintState() {
            if (paintStep < paintHistory.length - 1) {
                paintHistory.length = paintStep + 1;
            }
            paintHistory.push({
                paint: paintCanvas.toDataURL(),
                fill: fillCanvas.toDataURL()
            });
            paintStep++;

            // Memory Management: Keep only the latest 20 steps
            if (paintHistory.length > 20) {
                paintHistory.shift();
                paintStep--;
            }
        }

        function undoPaint() {
            if (paintStep > 0) {
                paintStep--;
                let state = paintHistory[paintStep];
                
                let imgP = new Image();
                imgP.src = state.paint;
                imgP.onload = () => {
                    paintCtx.clearRect(0, 0, width, height);
                    paintCtx.drawImage(imgP, 0, 0);
                };
                
                let imgF = new Image();
                imgF.src = state.fill;
                imgF.onload = () => {
                    fillCtx.clearRect(0, 0, width, height);
                    fillCtx.drawImage(imgF, 0, 0);
                };
            }
        }

        function clearPaintLayer() {
            paintCtx.clearRect(0, 0, width, height);
            fillCtx.clearRect(0, 0, width, height);
            savePaintState();
        }

        // --- Main Animation Loop ---
        function loop() {
            smoothedPressure += (currentPressure - smoothedPressure) * 0.15;
            drawAnimatedBackground();
            
            if (isDrawing && currentMode === 'silk') {
                renderSilk();
            }
            requestAnimationFrame(loop);
        }

        // --- Unified Export Logic ---
        function exportImage() {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tCtx = tempCanvas.getContext('2d');
            
            tCtx.drawImage(bgCanvas, 0, 0);
            
            let gradient = tCtx.createRadialGradient(width/2, height/2, height*0.3, width/2, height/2, width*0.7);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
            tCtx.fillStyle = gradient;
            tCtx.fillRect(0, 0, width, height);

            tCtx.drawImage(fillCanvas, 0, 0);
            tCtx.drawImage(canvas, 0, 0);
            tCtx.drawImage(paintCanvas, 0, 0);

            const link = document.createElement('a');
            link.download = `thinkme-masterpiece-${Date.now()}.png`;
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        }

        // --- Mode Switching ---
        function toggleMode(mode) {
            currentMode = mode;
            if (mode === 'paint') {
                silkUiLayer.classList.add('hidden-ui');
                paintUiLayer.classList.remove('hidden-ui');
                paintCanvas.style.pointerEvents = 'auto';
                canvas.style.pointerEvents = 'none';
            } else {
                paintUiLayer.classList.add('hidden-ui');
                silkUiLayer.classList.remove('hidden-ui');
                paintCanvas.style.pointerEvents = 'none';
                canvas.style.pointerEvents = 'auto';
            }
        }

        // --- Mobile and Mouse Event Listeners ---
        window.addEventListener('resize', init);
        
        // Thinkme (Silk) Events
        canvas.addEventListener('pointerdown', startSilkDrawing);
        canvas.addEventListener('pointermove', (e) => { if (isDrawing) handleInput(e); });
        canvas.addEventListener('pointerup', stopSilkDrawing);
        canvas.addEventListener('pointercancel', stopSilkDrawing);
        // Direct touch listeners for mobile priority
        canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startSilkDrawing(e); }, {passive: false});
        canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (isDrawing) handleInput(e); }, {passive: false});
        canvas.addEventListener('touchend', stopSilkDrawing);

        // Paint Events
        paintCanvas.addEventListener('pointerdown', startPainting);
        paintCanvas.addEventListener('pointermove', drawPaint);
        paintCanvas.addEventListener('pointerup', stopPainting);
        paintCanvas.addEventListener('pointercancel', stopPainting);
        // Direct touch listeners for mobile priority
        paintCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startPainting(e); }, {passive: false});
        paintCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); drawPaint(e); }, {passive: false});
        paintCanvas.addEventListener('touchend', stopPainting);

        // UI Controls
        document.getElementById('makePaintBtn').addEventListener('click', () => toggleMode('paint'));
        document.getElementById('clearBtn').addEventListener('click', clearSilkCanvas);
        document.getElementById('saveBtn').addEventListener('click', exportImage);

        symRange.addEventListener('input', (e) => {
            symmetry = parseInt(e.target.value);
            symValueText.innerText = symmetry;
        });

        flowRange.addEventListener('input', (e) => {
            flowIntensity = parseInt(e.target.value) / 100;
            updatePhysics();
        });

        function toggleMirror() {
            isMirror = !isMirror;
            mirrorText.innerText = `Mirror: ${isMirror ? 'On' : 'Off'}`;
            mirrorToggle.classList.toggle('active-tool', isMirror);
            if (mirrorToggleMobile) mirrorToggleMobile.classList.toggle('active-tool', isMirror);
        }

        mirrorToggle.addEventListener('click', toggleMirror);
        if (mirrorToggleMobile) mirrorToggleMobile.addEventListener('click', toggleMirror);

        colorOpts.forEach(opt => {
            opt.addEventListener('click', () => {
                colorOpts.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                if(opt.dataset.type === 'rainbow') {
                    isRainbowMode = true;
                } else {
                    isRainbowMode = false;
                    currentSilkColor = opt.dataset.color;
                }
            });
        });

        // Paint Controls
        document.getElementById('backToThinkmeBtn').addEventListener('click', () => toggleMode('silk'));
        document.getElementById('undoPaintBtn').addEventListener('click', undoPaint);
        document.getElementById('clearPaintBtn').addEventListener('click', clearPaintLayer);
        document.getElementById('savePaintBtn').addEventListener('click', exportImage);

        const brushToolBtn = document.getElementById('brushToolBtn');
        const eraserToolBtn = document.getElementById('eraserToolBtn');
        const fillToolBtn = document.getElementById('fillToolBtn');

        function setActivePaintTool(tool, activeBtn) {
            currentPaintTool = tool;
            brushToolBtn.classList.remove('active-paint-tool');
            eraserToolBtn.classList.remove('active-paint-tool');
            fillToolBtn.classList.remove('active-paint-tool');
            activeBtn.classList.add('active-paint-tool');
        }

        brushToolBtn.addEventListener('click', () => setActivePaintTool('brush', brushToolBtn));
        eraserToolBtn.addEventListener('click', () => setActivePaintTool('eraser', eraserToolBtn));
        fillToolBtn.addEventListener('click', () => setActivePaintTool('fill', fillToolBtn));

        const paintSizeRange = document.getElementById('paintSizeRange');
        const paintSizeValue = document.getElementById('paintSizeValue');
        paintSizeRange.addEventListener('input', (e) => {
            currentPaintSize = parseInt(e.target.value);
            paintSizeValue.innerText = currentPaintSize;
        });

        const paintColorOpts = document.querySelectorAll('.paint-color-opt');
        paintColorOpts.forEach(opt => {
            opt.addEventListener('click', () => {
                if (currentPaintTool === 'eraser') brushToolBtn.click();
                
                paintColorOpts.forEach(o => {
                    o.classList.remove('active');
                    o.style.boxShadow = 'none';
                });
                opt.classList.add('active');
                opt.style.boxShadow = `0 0 15px rgba(255,255,255,0.4)`;
                currentPaintColor = opt.dataset.color || '#ffffff';
            });
        });

        // Start
        init();
        loop();
