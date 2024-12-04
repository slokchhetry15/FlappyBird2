const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const scoreDisplay = document.getElementById('score');
const menuOverlay = document.getElementById('menuOverlay');
const bestScoreDisplay = document.getElementById('bestScore');

// Set fixed game dimensions
canvas.width = 480;
canvas.height = 640;

// Load bird image
const birdImg = new Image();
birdImg.src = 'bird.png';

const INITIAL_GAP = 200;  // Starting gap size
const MIN_GAP = 160;      // Minimum gap size
const GAP_DECREASE = 2;   // How much to decrease gap per pillar
const PILLAR_START_DISTANCE = 100; // Reduced delay for first pillar1

const bird = {
    x: 120,          // Moved bird more to the right
    y: canvas.height / 2,
    velocity: 0,
    gravity: 0.35,
    jump: -7,
    size: 60,        // Slightly reduced bird size
    initialDelay: true,
    isShielded: false,
    isSmall: false,
    originalSize: 50
};

let bestScore = localStorage.getItem('bestScore') || 0;
bestScoreDisplay.textContent = `Best Score: ${bestScore}`;

const pipes = [];
let score = 0;
let gameStarted = false;
let gameLoop = null;
let distanceTraveled = 0;
let currentGap = INITIAL_GAP;
let pipesPassed = 0;

const powerUps = {
    SHIELD: { 
        type: 'shield', 
        duration: 5000, 
        color: 'rgba(66, 135, 245, 0.8)',
        gradient: ['#4287f5', '#1a56c4'],
        icon: '⚡'
    },
    SLOW_TIME: { 
        type: 'slowTime', 
        duration: 3000, 
        color: 'rgba(245, 66, 242, 0.8)',
        gradient: ['#f542f2', '#b816b5'],
        icon: '★'
    },
    SMALL_BIRD: { 
        type: 'smallBird', 
        duration: 4000, 
        color: 'rgba(66, 245, 84, 0.8)',
        gradient: ['#42f554', '#1cb82b'],
        icon: '◊'
    }
};

const POWER_UP_ICONS = {
    shield: '⚡',
    slowTime: '★',
    smallBird: '◊'
};

function createPowerUp() {
    const types = Object.values(powerUps);
    let validPosition = false;
    let powerUp;

    // Limit attempts to prevent infinite loop
    let attempts = 0;
    const maxAttempts = 100;

    while (!validPosition && attempts < maxAttempts) {
        powerUp = {
            x: canvas.width,
            y: Math.random() * (canvas.height - 100) + 50,
            type: types[Math.floor(Math.random() * types.length)],
            size: 30,
            collected: false
        };

        // Check if power-up overlaps with any pipes
        validPosition = true;
        for (const pipe of pipes) {
            if (powerUp.y < pipe.top + 30 || powerUp.y > pipe.bottom - 30) {
                validPosition = false;
                break;
            }
        }
        attempts++;
    }

    if (attempts >= maxAttempts) {
        console.warn('Failed to place power-up after maximum attempts');
        return null;
    }

    return powerUp;
}

let activePowerUps = [];
let currentPowerUp = null;
let powerUpsEnabled = false;
const POWER_UP_START_SCORE = 5; // Power-ups start appearing after 5 points

// Create pipe pairs
function createPipe() {
    // Calculate gap size based on pipes passed
    let gap = Math.max(MIN_GAP, INITIAL_GAP - (pipesPassed * GAP_DECREASE));
    
    // Ensure reasonable pipe positions
    const minTop = 80;  // Minimum distance from top
    const maxTop = canvas.height - gap - 80;  // Minimum distance from bottom
    const pipeTop = Math.random() * (maxTop - minTop) + minTop;
    
    pipes.push({
        x: canvas.width,
        top: pipeTop,
        bottom: pipeTop + gap,
        counted: false,
        width: 70
    });
}

function startGame() {
    gameStarted = true;
    menuOverlay.style.display = 'none';
    resetGame();
    initControls();
    gameLoop = requestAnimationFrame(update);
}

// Game loop
function update() {
    if (!gameStarted) return;

    try {
        // Bird physics
        if (!bird.initialDelay) {
            bird.velocity += bird.gravity;
            bird.y += bird.velocity;
        } else {
            bird.y = canvas.height / 2 + Math.sin(Date.now() / 300) * 15;
        }

        distanceTraveled += 3;

        // Start game physics on first jump
        if (bird.initialDelay && distanceTraveled > 50) {
            bird.initialDelay = false;
        }

        // Earlier pillar spawning
        if (distanceTraveled > PILLAR_START_DISTANCE) {
            if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 250) {
                createPipe();
            }
        }

        // Update pipes
        for (let i = pipes.length - 1; i >= 0; i--) {
            pipes[i].x -= 3 * gameSpeed;

            if (pipes[i].x < -pipes[i].width) {
                pipes.splice(i, 1);
                continue;
            }

            // Score counting
            if (!pipes[i].counted && pipes[i].x < bird.x) {
                score++;
                pipesPassed++;
                scoreDisplay.textContent = `Score: ${score}`;
                pipes[i].counted = true;
            }

            // Collision detection with adjusted hitbox
            const hitboxMargin = 10;
            const birdCollidesWithPipe = 
                (bird.x + bird.size - hitboxMargin > pipes[i].x && 
                 bird.x + hitboxMargin < pipes[i].x + pipes[i].width &&
                 (bird.y + hitboxMargin < pipes[i].top || 
                  bird.y + bird.size - hitboxMargin > pipes[i].bottom));

            if (!bird.isShielded && (bird.y < 0 || bird.y > canvas.height - bird.size || birdCollidesWithPipe)) {
                gameOver();
                return;
            }
        }

        updateKums();
        updatePowerUps();

        draw();
        gameLoop = requestAnimationFrame(update);
    } catch (error) {
        console.error('Update error:', error);
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
            gameLoop = requestAnimationFrame(update);
        }
    }
}

function drawPipe(x, topHeight, bottomY) {
    const pipeWidth = 70;
    
    // Top pipe
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(x, 0, pipeWidth, topHeight);
    
    // Top pipe cap
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(x - 5, topHeight - 30, pipeWidth + 10, 30);
    
    // Bottom pipe
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(x, bottomY, pipeWidth, canvas.height - bottomY);
    
    // Bottom pipe cap
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(x - 5, bottomY, pipeWidth + 10, 30);
    
    // Pipe highlights
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 10, 0, 5, topHeight);
    ctx.fillRect(x + 10, bottomY, 5, canvas.height - bottomY);
}

function draw() {
    try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw power-ups
        activePowerUps.forEach(powerUp => {
            if (!powerUp.collected) {
                drawPowerUp(powerUp);
            }
        });

        // Draw bird
        drawBird();

        // Update and draw particles safely
        updateParticles();

        // Draw active power-up indicator
        if (currentPowerUp) {
            drawActivePowerUpIndicator();
        }

        // Draw pipes
        pipes.forEach(pipe => {
            drawPipe(pipe.x, pipe.top, pipe.bottom);
        });

        drawKums();

    } catch (error) {
        console.error('Draw error:', error);
        // Prevent game from freezing by continuing the game loop
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
            gameLoop = requestAnimationFrame(update);
        }
    }
}

function resetGame() {
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    bird.initialDelay = true;
    pipes.length = 0;
    score = 0;
    pipesPassed = 0;
    currentGap = INITIAL_GAP;
    distanceTraveled = 0;
    scoreDisplay.textContent = `Score: ${score}`;
    
    // Reset power-up states
    powerUpsEnabled = false;
    bird.isShielded = false;
    bird.isSmall = false;
    bird.size = bird.originalSize;
    gameSpeed = 1;
    currentPowerUp = null;
    activePowerUps = [];
    particles = [];
    kums = [];
    kumsCollected = 0;
    updateKumsDisplay();
}

function gameOver() {
    gameStarted = false;
    cancelAnimationFrame(gameLoop);
    menuOverlay.style.display = 'flex';
    
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
        bestScoreDisplay.textContent = `Best Score: ${bestScore}`;
    }
}

// Touch/click controls
canvas.addEventListener('touchstart', jump);
canvas.addEventListener('click', jump);
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') jump(e);
});

function jump(e) {
    if (!gameStarted) return;
    
    e.preventDefault();
    bird.velocity = bird.jump;
    bird.initialDelay = false;
}

// Start button event listener
startBtn.addEventListener('click', startGame);
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !gameStarted) {
        startGame();
    }
});

// Add instructions to the menu
document.querySelector('.game-title').insertAdjacentHTML('afterend', `
    <div style="color: white; text-align: center; margin-bottom: 20px; font-size: 16px;">
        Click, tap, or press SPACE to fly
    </div>
`);

// Ensure controls are properly initialized
function initControls() {
    // Start game with space bar
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            if (!gameStarted) {
                startGame();
            } else {
                jump(e);
            }
        }
    });

    // Mouse controls
    canvas.addEventListener('mousedown', (e) => {
        if (gameStarted) {
            jump(e);
        }
    });
    
    // Touch controls
    canvas.addEventListener('touchstart', (e) => {
        if (gameStarted) {
            jump(e);
        }
    });
}

function activatePowerUp(powerUpType) {
    // Clear existing power-up if any
    if (currentPowerUp) {
        deactivatePowerUp(currentPowerUp.type.type);
    }

    currentPowerUp = {
        type: powerUpType,
        endTime: Date.now() + powerUpType.duration
    };

    // Apply power-up effect
    switch(powerUpType.type) {
        case 'shield':
            bird.isShielded = true;
            break;
        case 'slowTime':
            gameSpeed = 0.5;
            break;
        case 'smallBird':
            bird.isSmall = true;
            bird.size = bird.originalSize * 0.6;
            break;
    }

    // Schedule power-up deactivation
    setTimeout(() => {
        deactivatePowerUp(powerUpType.type);
    }, powerUpType.duration);

    // Add particle effect
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(bird.x + bird.size/2, bird.y + bird.size/2, powerUpType.gradient[0]));
    }
}

function deactivatePowerUp(type) {
    switch(type) {
        case 'shield':
            bird.isShielded = false;
            break;
        case 'slowTime':
            gameSpeed = 1;
            break;
        case 'smallBird':
            bird.isSmall = false;
            bird.size = bird.originalSize;
            break;
    }
    currentPowerUp = null;
}

function updatePowerUps() {
    if (score < POWER_UP_START_SCORE) {
        return;
    }

    if (!powerUpsEnabled) {
        powerUpsEnabled = true;
    }

    // Spawn new power-up with reduced probability
    if (Math.random() < 0.002 && !currentPowerUp && activePowerUps.length < 1) {
        const newPowerUp = createPowerUp();
        // Ensure power-up is in a valid position
        if (newPowerUp) {
            activePowerUps.push(newPowerUp);
        }
    }

    // Update existing power-ups
    for (let i = activePowerUps.length - 1; i >= 0; i--) {
        const powerUp = activePowerUps[i];
        powerUp.x -= 3 * gameSpeed;

        // Remove off-screen power-ups
        if (powerUp.x < -powerUp.size) {
            activePowerUps.splice(i, 1);
            continue;
        }

        // Check collision with bird
        if (!powerUp.collected && 
            bird.x < powerUp.x + powerUp.size &&
            bird.x + bird.size > powerUp.x &&
            bird.y < powerUp.y + powerUp.size &&
            bird.y + bird.size > powerUp.y) {
            
            activatePowerUp(powerUp.type);
            powerUp.collected = true;
            activePowerUps.splice(i, 1);
        }
    }
}

function drawActivePowerUpIndicator() {
    if (currentPowerUp) {
        const timeLeft = Math.ceil((currentPowerUp.endTime - Date.now()) / 1000);
        const width = 150;
        const height = 40;
        const x = 10;
        const y = 40;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.fill();

        // Progress bar
        const progress = (currentPowerUp.endTime - Date.now()) / currentPowerUp.type.duration;
        const barWidth = (width - 20) * progress;
        
        ctx.fillStyle = currentPowerUp.type.gradient[0];
        ctx.beginPath();
        ctx.roundRect(x + 10, y + height - 8, barWidth, 4, 2);
        ctx.fill();

        // Icon and text
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${currentPowerUp.type.icon} ${timeLeft}s`, x + 20, y + height/2);
    }
}

class Environment {
    constructor() {
        this.time = 0;
        this.dayDuration = 30000; // 30 seconds per day cycle
        this.weather = 'clear';
        this.weatherEffects = [];
    }

    update(ctx) {
        this.time = (Date.now() % this.dayDuration) / this.dayDuration;
        this.updateBackground(ctx);
        this.updateWeather();
    }

    updateBackground(ctx) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        
        // Create gradient based on time of day
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        
        if (this.time < 0.25) { // Dawn
            gradient.addColorStop(0, '#1a1a3a');
            gradient.addColorStop(1, '#ff7f50');
        } else if (this.time < 0.75) { // Day
            gradient.addColorStop(0, '#1a1a1a');
            gradient.addColorStop(1, '#2a2a2a');
        } else { // Dusk
            gradient.addColorStop(0, '#1a1a3a');
            gradient.addColorStop(1, '#4a1a1a');
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add stars at night
        if (this.time > 0.75 || this.time < 0.25) {
            this.drawStars(ctx);
        }
    }

    drawStars(ctx) {
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * (ctx.canvas.height / 2);
            const opacity = Math.random() * 0.5 + 0.5;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Updated Particle class with better error handling
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;  // Ensure minimum size
        this.speedX = (Math.random() - 0.5) * 4;
        this.speedY = (Math.random() - 0.5) * 4;
        this.life = 1;
        this.minSize = 0.5;  // Minimum size before removal
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.02;
        this.size = Math.max(this.size - 0.1, this.minSize);  // Prevent negative size
        return this.life > 0;  // Return false when particle should be removed
    }

    draw(ctx) {
        if (this.size <= 0) return;  // Skip drawing if size is invalid
        
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(this.size, 0.1), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Update particle management
function updateParticles() {
    particles = particles.filter(particle => {
        if (particle.update()) {
            particle.draw(ctx);
            return true;
        }
        return false;
    });
}

// Separate power-up drawing function
function drawPowerUp(powerUp) {
    try {
        // Outer glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(
            powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, 0,
            powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, powerUp.size
        );
        gradient.addColorStop(0, powerUp.type.gradient[0]);
        gradient.addColorStop(1, 'transparent');
        
        ctx.arc(powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, 
               powerUp.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Inner circle
        ctx.beginPath();
        ctx.arc(powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, 
               powerUp.size/2, 0, Math.PI * 2);
        ctx.fillStyle = powerUp.type.gradient[1];
        ctx.fill();

        // Icon with improved rendering
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerUp.type.icon, 
                    powerUp.x + powerUp.size/2, 
                    powerUp.y + powerUp.size/2);
    } catch (error) {
        console.error('Power-up draw error:', error);
    }
}

let particles = [];

function drawBird() {
    ctx.save();
    ctx.translate(bird.x + bird.size/2, bird.y + bird.size/2);
    
    // Add rotation based on velocity
    const rotation = Math.min(Math.max(bird.velocity * 0.05, -0.5), 0.5);
    ctx.rotate(rotation);

    // Draw shield effect if active
    if (bird.isShielded) {
        // Shield glow
        const shieldGradient = ctx.createRadialGradient(0, 0, bird.size/2, 0, 0, bird.size);
        shieldGradient.addColorStop(0, 'rgba(66, 135, 245, 0.2)');
        shieldGradient.addColorStop(1, 'rgba(66, 135, 245, 0.1)');
        
        ctx.beginPath();
        ctx.arc(0, 0, bird.size/1.5, 0, Math.PI * 2);
        ctx.fillStyle = shieldGradient;
        ctx.fill();
        
        // Animated shield ring
        ctx.beginPath();
        ctx.arc(0, 0, bird.size/1.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#4287f5';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -Date.now() / 50; // Rotating effect
        ctx.stroke();
    }

    // Draw bird with size effect
    if (bird.isSmall) {
        // Add glow effect for small bird
        ctx.shadowColor = '#42f554';
        ctx.shadowBlur = 10;
    }

    // Draw the bird image
    ctx.drawImage(
        birdImg, 
        -bird.size/2, 
        -bird.size/2, 
        bird.size, 
        bird.size
    );

    // Reset shadow effects
    ctx.shadowBlur = 0;
    
    // Add slow time effect visual
    if (gameSpeed < 1) {
        ctx.strokeStyle = 'rgba(245, 66, 242, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, bird.size/1.2, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

// Add this to ensure the bird image is loaded before drawing
birdImg.onload = () => {
    console.log('Bird image loaded successfully');
};

birdImg.onerror = () => {
    console.error('Error loading bird image');
};

let kumsCollected = 0;
let kums = [];
const kumsDisplay = document.createElement('div');
kumsDisplay.id = 'kumsDisplay';
kumsDisplay.style.position = 'absolute';
kumsDisplay.style.top = '10px';
kumsDisplay.style.right = '10px';
kumsDisplay.style.color = '#4287f5';
kumsDisplay.style.fontSize = '24px';
kumsDisplay.style.fontWeight = 'bold';
kumsDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
document.body.appendChild(kumsDisplay);
updateKumsDisplay();

// Function to draw water droplet
function drawWaterDrop(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    
    // Draw the teardrop shape
    ctx.bezierCurveTo(
        x - size/2, y - size/2,  // Control point 1
        x - size/2, y + size/4,  // Control point 2
        x, y + size/2            // End point
    );
    
    ctx.bezierCurveTo(
        x + size/2, y + size/4,  // Control point 1
        x + size/2, y - size/2,  // Control point 2
        x, y - size/2            // End point
    );
    
    // Add gradient for 3D effect
    const gradient = ctx.createLinearGradient(
        x - size/2, y - size/2,
        x + size/2, y + size/2
    );
    gradient.addColorStop(0, '#87CEFA');    // Light blue
    gradient.addColorStop(1, '#1E90FF');    // Darker blue
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Add shine effect
    ctx.beginPath();
    ctx.arc(x - size/4, y - size/4, size/6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
}

// Update kums display
function updateKumsDisplay() {
    kumsDisplay.innerHTML = `<span style="color: #4287f5;">💧</span> ${kumsCollected}`;
}

// Add function to draw kums
function drawKums() {
    kums.forEach(kum => {
        if (!kum.collected) {
            ctx.save();
            
            // Add glow effect
            ctx.shadowColor = '#4287f5';
            ctx.shadowBlur = 10;
            
            // Draw the water droplet
            drawWaterDrop(
                ctx,
                kum.x + kum.size/2,
                kum.y + kum.size/2 + Math.sin(kum.angle) * kum.wobbleAmount,
                kum.size
            );
            
            ctx.restore();
        }
    });
}

// Rest of the functions remain the same
function createKum() {
    return {
        x: canvas.width,
        y: Math.random() * (canvas.height - 100) + 50,
        size: 25,
        collected: false,
        angle: 0,
        wobbleSpeed: Math.random() * 0.02 + 0.01,
        wobbleAmount: Math.random() * 5 + 3
    };
}

function createKumCollectEffect(x, y) {
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(
            x,
            y,
            'rgba(66, 135, 245, 0.8)'
        ));
    }
}

// Update function remains the same
function updateKums() {
    if (Math.random() < 0.01 && kums.length < 3) {
        const newKum = createKum();
        if (newKum) kums.push(newKum);
    }

    for (let i = kums.length - 1; i >= 0; i--) {
        const kum = kums[i];
        kum.x -= 3 * gameSpeed;
        kum.angle += kum.wobbleSpeed;
        kum.y += Math.sin(kum.angle) * 0.5;

        if (kum.x < -kum.size) {
            kums.splice(i, 1);
            continue;
        }

        if (!kum.collected && 
            bird.x < kum.x + kum.size &&
            bird.x + bird.size > kum.x &&
            bird.y < kum.y + kum.size &&
            bird.y + bird.size > kum.y) {
            
            kum.collected = true;
            kumsCollected++;
            updateKumsDisplay();
            createKumCollectEffect(kum.x, kum.y);
            kums.splice(i, 1);
        }
    }
}
  
