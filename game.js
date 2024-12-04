const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const scoreDisplay = document.getElementById('score');
const menuOverlay = document.getElementById('menuOverlay');
const bestScoreDisplay = document.getElementById('bestScore');

// Set fixed game dimensions
canvas.width = Math.min(window.innerWidth - 40, 480); // 20px margin on each side
canvas.height = Math.min(window.innerHeight - 40, 640); // 20px margin on each side

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
        color: 'rgba(0, 255, 255, 0.8)',     // Cyan
        gradient: ['#00ffff', '#00ccff'],     // Cyan to bright blue
        icon: 'fa-shield-halved'
    },
    DOUBLE_SCORE: { 
        type: 'doubleScore', 
        duration: 5000, 
        color: 'rgba(255, 0, 255, 0.8)',     // Magenta
        gradient: ['#ff00ff', '#ff1493'],     // Magenta to deep pink
        icon: 'fa-star'
    },
    SMALL_BIRD: { 
        type: 'smallBird', 
        duration: 4000, 
        color: 'rgba(0, 255, 0, 0.8)',       // Lime
        gradient: ['#00ff00', '#32cd32'],     // Lime to lime green
        icon: 'fa-compress'
    }
};

const POWER_UP_ICONS = {
    shield: '⚡',
    doubleScore: '★',
    smallBird: '◊'
};

// Add this near the top of your file with other constants
const MIN_POWER_UP_DISTANCE = 400; // Minimum distance between power-ups
const POWER_UP_SPAWN_RATE = 0.003; // 0.3% chance per frame
const MAX_POWER_UPS = 2;

// Add this at the top of your file with other game state variables
const powerUpHistory = {
    firstGame: !localStorage.getItem('hasPlayedBefore'),
    seenPowerUps: JSON.parse(localStorage.getItem('seenPowerUps') || '{}')
};

// Update the createPowerUp function
function createPowerUp() {
    const types = Object.values(powerUps);
    let validPosition = false;
    let powerUp;
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

        // Check distance from other power-ups
        for (const existingPowerUp of activePowerUps) {
            if (Math.abs(existingPowerUp.x - powerUp.x) < MIN_POWER_UP_DISTANCE) {
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
const POWER_UP_START_SCORE = 0; // Power-ups available from the start

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

// Add these variables at the top with other game variables
let lastScoreUpdate = Date.now();
let scoreMultiplier = 1;

// Update the update function to use time-based scoring
function update() {
    if (!gameStarted) return;

    try {
        // Update score based on time (50 points per second)
        const currentTime = Date.now();
        const timeDiff = currentTime - lastScoreUpdate;
        if (timeDiff >= 1000) { // Every second
            score += 50 * scoreMultiplier;
            scoreDisplay.textContent = `Score: ${Math.floor(score)}`;
            lastScoreUpdate = currentTime;
        }

        // Rest of your update function...
        // Remove any score updates based on pipes

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
    
    // Create neon gradient for pipes
    const pipeGradient = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
    pipeGradient.addColorStop(0, 'rgba(255, 0, 255, 0.8)');    // Magenta
    pipeGradient.addColorStop(0.5, 'rgba(255, 105, 180, 0.7)'); // Hot pink
    pipeGradient.addColorStop(1, 'rgba(255, 20, 147, 0.8)');    // Deep pink

    // Create neon gradient for pipe caps
    const capGradient = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
    capGradient.addColorStop(0, 'rgba(0, 255, 255, 0.9)');     // Cyan
    capGradient.addColorStop(1, 'rgba(0, 191, 255, 0.9)');     // Deep sky blue
    
    // Add glow effect
    ctx.shadowColor = 'rgba(255, 0, 255, 0.8)';
    ctx.shadowBlur = 15;
    
    // Draw pipes with gradients
    ctx.fillStyle = pipeGradient;
    ctx.fillRect(x, 0, pipeWidth, topHeight);
    ctx.fillRect(x, bottomY, pipeWidth, canvas.height - bottomY);
    
    // Draw caps with different gradient
    ctx.fillStyle = capGradient;
    ctx.fillRect(x - 5, topHeight - 30, pipeWidth + 10, 30);
    ctx.fillRect(x - 5, bottomY, pipeWidth + 10, 30);
    
    // Add shine effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(x + 10, 0, 5, topHeight);
    ctx.fillRect(x + 10, bottomY, 5, canvas.height - bottomY);
    
    // Reset shadow
    ctx.shadowBlur = 0;
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
    lastScoreUpdate = Date.now();
    scoreMultiplier = 1;

    // Reset power-up states
    activePowerUps = [];
    currentPowerUp = null;
    powerUpsEnabled = true;  // Enable power-ups from the start
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
        case 'doubleScore':
            scoreMultiplier = 2;
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
        case 'doubleScore':
            scoreMultiplier = 1;
            break;
        case 'smallBird':
            bird.isSmall = false;
            bird.size = bird.originalSize;
            break;
    }
    currentPowerUp = null;
    
    // Add this: Remove the power-up indicator when deactivated
    const indicator = document.getElementById('powerUpIndicator');
    if (indicator) {
        indicator.remove();
    }
}

function updatePowerUps() {
    try {
        // Spawn new power-up
        if (Math.random() < POWER_UP_SPAWN_RATE && activePowerUps.length < MAX_POWER_UPS) {
            // Check if there's enough distance from existing power-ups
            const canSpawn = activePowerUps.every(powerUp => 
                powerUp.x < canvas.width - MIN_POWER_UP_DISTANCE
            );
            
            if (canSpawn) {
                const newPowerUp = createPowerUp();
                if (newPowerUp) {
                    activePowerUps.push(newPowerUp);
                }
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
                
                showPowerUpMessage(powerUp.type.type);
                activatePowerUp(powerUp.type);
                powerUp.collected = true;
                activePowerUps.splice(i, 1);
            }
        }
    } catch (error) {
        console.error('Error updating power-ups:', error);
    }
}

function drawActivePowerUpIndicator() {
    if (currentPowerUp) {
        const timeLeft = Math.ceil((currentPowerUp.endTime - Date.now()) / 1000);
        const indicator = document.getElementById('powerUpIndicator') || createPowerUpIndicator();
        
        indicator.innerHTML = `
            <div class="power-up-content">
                <i class="fas ${currentPowerUp.type.icon}"></i>
                <span>${timeLeft}s</span>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width: ${(timeLeft / (currentPowerUp.type.duration/1000)) * 100}%"></div>
            </div>
        `;
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
        
        // Create a neon gradient for the background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');       // Dark background
        gradient.addColorStop(0.5, 'rgba(75, 0, 130, 0.6)');  // Indigo
        gradient.addColorStop(1, 'rgba(148, 0, 211, 0.5)');   // Dark violet
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Add a grid pattern for a cyberpunk effect
        const gridSize = 40;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)'; // Light cyan grid lines
        ctx.lineWidth = 1;
        
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
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

// Function to draw power-up icons
function drawPowerUpIcon(ctx, type, x, y, size) {
    ctx.save();
    switch(type) {
        case 'shield':
            // Draw shield icon
            ctx.beginPath();
            ctx.moveTo(x, y - size/2);
            ctx.lineTo(x + size/2, y - size/4);
            ctx.lineTo(x + size/2, y + size/4);
            ctx.lineTo(x, y + size/2);
            ctx.lineTo(x - size/2, y + size/4);
            ctx.lineTo(x - size/2, y - size/4);
            ctx.closePath();
            ctx.fillStyle = '#4287f5';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;

        case 'doubleScore':
            // Draw star icon
            ctx.beginPath();
            ctx.arc(x, y, size/2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd700';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw star rays
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - size/3);
            ctx.moveTo(x, y);
            ctx.lineTo(x + size/3, y);
            ctx.stroke();
            break;

        case 'smallBird':
            // Draw diamond icon
            ctx.beginPath();
            ctx.moveTo(x, y - size/2);
            ctx.lineTo(x + size/2, y);
            ctx.lineTo(x, y + size/2);
            ctx.lineTo(x - size/2, y);
            ctx.closePath();
            ctx.fillStyle = '#42f554';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;
    }
    ctx.restore();
}

let particles = [];

function drawBird() {
    ctx.save();
    ctx.translate(bird.x + bird.size/2, bird.y + bird.size/2);
    
    const rotation = Math.min(Math.max(bird.velocity * 0.05, -0.5), 0.5);
    ctx.rotate(rotation);

    if (bird.isShielded) {
        // Neon shield effect
        const shieldGradient = ctx.createRadialGradient(0, 0, bird.size/2, 0, 0, bird.size);
        shieldGradient.addColorStop(0, 'rgba(0, 255, 255, 0.2)');   // Cyan
        shieldGradient.addColorStop(0.5, 'rgba(0, 191, 255, 0.15)'); // Deep sky blue
        shieldGradient.addColorStop(1, 'rgba(30, 144, 255, 0.1)');   // Dodger blue
        
        ctx.beginPath();
        ctx.arc(0, 0, bird.size/1.5, 0, Math.PI * 2);
        ctx.fillStyle = shieldGradient;
        ctx.fill();
        
        // Animated neon ring
        ctx.beginPath();
        ctx.arc(0, 0, bird.size/1.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -Date.now() / 50;
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
    ctx.save();
    
    // Add glow effect
    ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
    ctx.shadowBlur = 15;
    
    // Create gradient for water drop
    const gradient = ctx.createLinearGradient(
        x - size/2, y - size/2,
        x + size/2, y + size/2
    );
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.9)');    // Cyan
    gradient.addColorStop(0.5, 'rgba(0, 191, 255, 0.8)');  // Deep sky blue
    gradient.addColorStop(1, 'rgba(30, 144, 255, 0.9)');   // Dodger blue
    
    // Draw the teardrop shape
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.bezierCurveTo(
        x - size/2, y - size/2,
        x - size/2, y + size/4,
        x, y + size/2
    );
    ctx.bezierCurveTo(
        x + size/2, y + size/4,
        x + size/2, y - size/2,
        x, y - size/2
    );
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Add shine effect
    ctx.beginPath();
    ctx.arc(x - size/4, y - size/4, size/6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    
    ctx.restore();
}

// Update kums display with Font Awesome water icon
function updateKumsDisplay() {
    kumsDisplay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 5px;">
            <i class="fas fa-tint" style="color: #4287f5;"></i>
            <span>${kumsCollected}</span>
        </div>
    `;
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

// Adjust these constants at the top of your file
const MAX_KUMS = 2;  // Maximum number of kums on screen
const KUM_SPAWN_RATE = 0.003;  // Reduced spawn rate (was 0.01)
const MIN_KUM_DISTANCE = 300;  // Minimum distance between kums

// Update the updateKums function
function updateKums() {
    // Only spawn if we have less than maximum kums
    if (Math.random() < KUM_SPAWN_RATE && kums.length < MAX_KUMS) {
        // Check if there's enough distance from the last kum
        const canSpawn = kums.every(kum => 
            kum.x < canvas.width - MIN_KUM_DISTANCE
        );
        
        if (canSpawn) {
            const newKum = createKum();
            if (newKum) kums.push(newKum);
        }
    }

    // Rest of the function remains the same
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

// Create power-up indicator element
function createPowerUpIndicator() {
    const existingIndicator = document.getElementById('powerUpIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }

    const indicator = document.createElement('div');
    indicator.id = 'powerUpIndicator';
    indicator.style.cssText = `
        position: absolute;
        top: 60px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        padding: 15px;
        border-radius: 10px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 16px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        border: 2px solid rgba(255,255,255,0.2);
    `;
    document.body.appendChild(indicator);
    return indicator;
}

// Add CSS styles
const styles = `
    .power-up-content {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 5px;
    }
    .progress-bar {
        width: 100px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
    }
    .progress {
        height: 100%;
        background: white;
        transition: width 0.1s linear;
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Update power-up drawing in main draw function
function drawPowerUp(powerUp) {
    if (!powerUp.collected) {
        ctx.save();
        
        // Draw glow effect
        ctx.shadowColor = powerUp.type.color;
        ctx.shadowBlur = 10;
        
        // Draw background circle
        ctx.beginPath();
        ctx.arc(powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, 
                powerUp.size/2, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
            powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, 0,
            powerUp.x + powerUp.size/2, powerUp.y + powerUp.size/2, powerUp.size/2
        );
        gradient.addColorStop(0, powerUp.type.gradient[0]);
        gradient.addColorStop(1, powerUp.type.gradient[1]);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw icon using HTML element
        const iconElement = document.createElement('i');
        iconElement.className = `fas ${powerUp.type.icon}`;
        iconElement.style.color = 'white';
        iconElement.style.fontSize = `${powerUp.size * 0.6}px`;
        
        // Convert icon to image and draw on canvas
        const svg = new XMLSerializer().serializeToString(iconElement);
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(svg);
        img.onload = () => {
            ctx.drawImage(img, 
                powerUp.x + powerUp.size/2 - powerUp.size * 0.3, 
                powerUp.y + powerUp.size/2 - powerUp.size * 0.3, 
                powerUp.size * 0.6, 
                powerUp.size * 0.6);
        };
        
        ctx.restore();
    }
}

// Simplified power-up message function without toast notifications
function showPowerUpMessage(type) {
    // Only update the power-up history
    if (!powerUpHistory.firstGame && powerUpHistory.seenPowerUps[type]) {
        return;
    }

    // Mark this power-up as seen
    powerUpHistory.seenPowerUps[type] = true;
    localStorage.setItem('seenPowerUps', JSON.stringify(powerUpHistory.seenPowerUps));
}

// Add enhanced CSS animations
const powerUpStyles = `
    .power-up-message {
        pointer-events: none;
    }
`;

// Add the styles to the document
const powerUpStyleSheet = document.createElement('style');
powerUpStyleSheet.textContent = powerUpStyles;
document.head.appendChild(powerUpStyleSheet);
  
