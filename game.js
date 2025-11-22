// Wait for the DOM to load before we run our game
window.addEventListener('load', function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // --- 2. GAME CONSTANTS ---
    const CELL_SIZE = 100;
    const NUM_ROWS = 5;
    const NUM_COLS = 9;
    const GRID_LINE_WIDTH = 2;
    const GRID_LINE_COLOR = 'rgba(0, 0, 0, 0.2)';
    
    // Plant/Zombie Visuals
    const PLANT_SIZE = 80; // Slightly smaller than cell
    const ZOMBIE_SIZE = 90;
    const PROJECTILE_SIZE = 20;

    // Game logic constants
    const PLANT_COSTS = {
        sunflower: 50,
        peashooter: 100
    };
    const PLANT_HEALTH = {
        sunflower: 100,
        peashooter: 150
    };
    const ZOMBIE_HEALTH = 100;
    const ZOMBIE_SPEED = 0.5;
    const PEA_SPEED = 5;
    const PEA_DAMAGE = 25;

    canvas.width = NUM_COLS * CELL_SIZE;
    canvas.height = NUM_ROWS * CELL_SIZE;

    // --- 3. GAME STATE ---
    // Using a single 'game' object to hold all state
    const game = {
        sun: 100,
        plants: [],
        zombies: [],
        projectiles: [],
        sunParticles: [],
        timer: 0,
        selectedPlant: 'sunflower', // Default
        gameOver: false
    };

    // The 'grid' will store references to plants for easy lookup
    // This is crucial for zombies to know what they are eating
    const grid = [];
    for (let r = 0; r < NUM_ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < NUM_COLS; c++) {
            grid[r][c] = null; // null means empty
        }
    }

    // --- 4. MOUSE & KEYBOARD INPUT ---
    const mouse = {
        x: 0,
        y: 0,
        width: 1, // 1x1 pixel for collision checks
        height: 1,
        isClicked: false
    };

    // Get mouse position relative to the canvas
    function getCanvasPosition(e) {
        let rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    }

    canvas.addEventListener('mousemove', getCanvasPosition);
    canvas.addEventListener('mousedown', function() { mouse.isClicked = true; });
    canvas.addEventListener('mouseup', function() { mouse.isClicked = false; });
    
    // Listen for '1' and '2' keys
    window.addEventListener('keydown', function(e) {
        if (e.key === '1') {
            game.selectedPlant = 'sunflower';
        } else if (e.key === '2') {
            game.selectedPlant = 'peashooter';
        }
    });

    // We also listen for 'click' for atomic actions
    canvas.addEventListener('click', function() {
        // 1. Try to collect sun
        // Loop backwards so we can remove items without skipping
        for (let i = game.sunParticles.length - 1; i >= 0; i--) {
            let sun = game.sunParticles[i];
            if (collision(mouse, sun)) {
                game.sun += sun.value;
                game.sunParticles.splice(i, 1);
                return; // Stop after collecting one sun
            }
        }

        // 2. If no sun collected, try to plant
        const gridCol = Math.floor(mouse.x / CELL_SIZE);
        const gridRow = Math.floor(mouse.y / CELL_SIZE);
        
        // Check bounds and if cell is empty
        if (gridRow < NUM_ROWS && gridCol < NUM_COLS && !grid[gridRow][gridCol]) {
            let cost = PLANT_COSTS[game.selectedPlant];
            if (game.sun >= cost) {
                game.sun -= cost;
                let newPlant;
                if (game.selectedPlant === 'sunflower') {
                    newPlant = new Sunflower(gridRow, gridCol);
                } else if (game.selectedPlant === 'peashooter') {
                    newPlant = new Peashooter(gridRow, gridCol);
                }
                game.plants.push(newPlant);
                grid[gridRow][gridCol] = newPlant;
            }
        }
    });

    // --- 5. UTILITY FUNCTION ---
    // Simple Axis-Aligned Bounding Box (AABB) collision
    function collision(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

    // --- 6. GAME OBJECT CLASSES ---

    // Base class for all plants
    class Plant {
        constructor(row, col) {
            this.row = row;
            this.col = col;
            this.x = col * CELL_SIZE + (CELL_SIZE - PLANT_SIZE) / 2; // Centered
            this.y = row * CELL_SIZE + (CELL_SIZE - PLANT_SIZE) / 2; // Centered
            this.width = PLANT_SIZE;
            this.height = PLANT_SIZE;
            this.health = 100;
        }
    }

    class Sunflower extends Plant {
        constructor(row, col) {
            super(row, col); // Call parent constructor
            this.health = PLANT_HEALTH.sunflower;
            this.sunTimer = 0;
            this.sunInterval = 600; // 10 seconds (600 frames)
        }
        
        update() {
            this.sunTimer++;
            if (this.sunTimer % this.sunInterval === 0) {
                // Spawn sun near the sunflower
                let sunX = this.x + Math.random() * 20 - 10;
                let sunY = this.y + Math.random() * 20 - 10;
                game.sunParticles.push(new Sun(sunX, sunY, this.y + 70));
            }
        }
        
        draw() {
            ctx.fillStyle = 'orange';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class Peashooter extends Plant {
        constructor(row, col) {
            super(row, col);
            this.health = PLANT_HEALTH.peashooter;
            this.shootTimer = 0;
            this.shootInterval = 120; // 2 seconds
        }

        update() {
            this.shootTimer++;
            // Check if a zombie is in this row
            let zombieInRow = false;
            for(let zombie of game.zombies) {
                if (zombie.row === this.row) {
                    zombieInRow = true;
                    break;
                }
            }

            if (zombieInRow && this.shootTimer % this.shootInterval === 0) {
                // Spawn a pea
                game.projectiles.push(new Pea(this.x + 70, this.y + 25, this.row));
            }
        }
        
        draw() {
            ctx.fillStyle = 'green';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'darkgreen';
            ctx.beginPath();
            ctx.arc(this.x + 60, this.y + this.height / 2 - 10, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    class Pea {
        constructor(x, y, row) {
            this.x = x;
            this.y = y;
            this.row = row;
            this.width = PROJECTILE_SIZE;
            this.height = PROJECTILE_SIZE;
            this.speed = PEA_SPEED;
            this.damage = PEA_DAMAGE;
        }
        
        update() {
            this.x += this.speed;
        }
        
        draw() {
            ctx.fillStyle = 'lightgreen';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    class Zombie {
        constructor(row) {
            this.row = row;
            this.x = canvas.width; // Start off-screen
            this.y = row * CELL_SIZE + (CELL_SIZE - ZOMBIE_SIZE) / 2; // Centered
            this.width = ZOMBIE_SIZE;
            this.height = ZOMBIE_SIZE;
            this.health = ZOMBIE_HEALTH;
            this.speed = ZOMBIE_SPEED;
            this.isEating = false;
        }
        
        update() {
            this.isEating = false;
            
            // Check for plant in front of zombie
            let gridCol = Math.floor(this.x / CELL_SIZE);
            if (gridCol < NUM_COLS && gridCol >= 0) {
                let plant = grid[this.row][gridCol];
                if (plant && collision(this, plant)) {
                    this.isEating = true;
                    plant.health -= this.speed; // Damage plant
                    if (plant.health <= 0) {
                        // Remove plant
                        grid[this.row][gridCol] = null;
                        let plantIndex = game.plants.indexOf(plant);
                        game.plants.splice(plantIndex, 1);
                    }
                }
            }
            
            if (!this.isEating) {
                this.x -= this.speed;
            }
            
            // Check for game over
            if (this.x < -this.width) {
                game.gameOver = true;
            }
        }
        
        draw() {
            ctx.fillStyle = 'brown';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = 'tan';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + 20, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Health bar
            ctx.fillStyle = 'red';
            ctx.fillRect(this.x, this.y - 10, this.width, 5);
            ctx.fillStyle = 'lightgreen';
            ctx.fillRect(this.x, this.y - 10, (this.width * this.health) / ZOMBIE_HEALTH, 5);
        }
    }

    class Sun {
        constructor(x, y, targetY) {
            this.x = x;
            this.y = y;
            this.targetY = targetY; // Where it lands (if from sunflower)
            this.width = 40;
            this.height = 40;
            this.speed = 1;
            this.value = 25;
            this.timer = 0;
            this.lifespan = 480; // 8 seconds
        }
        
        update() {
            // Fall to target spot
            if (this.y < this.targetY) {
                this.y += this.speed;
            }
            this.timer++;
        }
        
        draw() {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'orange';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }


    // --- 7. GAME LOGIC HANDLERS ---
    // These functions are called from the main update()
    
    function handlePlants() {
        for (let i = game.plants.length - 1; i >= 0; i--) {
            game.plants[i].update();
        }
    }
    
    function handleProjectiles() {
        for (let i = game.projectiles.length - 1; i >= 0; i--) {
            let pea = game.projectiles[i];
            pea.update();
            
            // Check for collision with zombies
            for (let j = game.zombies.length - 1; j >= 0; j--) {
                let zombie = game.zombies[j];
                if (zombie.row === pea.row && collision(pea, zombie)) {
                    zombie.health -= pea.damage;
                    game.projectiles.splice(i, 1); // Remove pea
                    break; // Pea can only hit one zombie
                }
            }
            
            // Remove pea if off-screen
            if (pea.x > canvas.width) {
                game.projectiles.splice(i, 1);
            }
        }
    }

    function handleZombies() {
        for (let i = game.zombies.length - 1; i >= 0; i--) {
            let zombie = game.zombies[i];
            zombie.update();
            
            if (zombie.health <= 0) {
                game.zombies.splice(i, 1); // Remove dead zombie
            }
        }
        
        // Spawn a new zombie every 10 seconds (600 frames)
        if (game.timer % 600 === 0 && game.timer > 0) {
            let randomRow = Math.floor(Math.random() * NUM_ROWS);
            game.zombies.push(new Zombie(randomRow));
        }
    }
    
    function handleSun() {
        // Spawn sun from the sky
        if (game.timer % 300 === 0) { // Every 5 seconds
            let randomX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
            let targetY = Math.random() * canvas.height * 0.8 + canvas.height * 0.1;
            game.sunParticles.push(new Sun(randomX, -50, targetY));
        }
        
        // Update and remove old sun
        for (let i = game.sunParticles.length - 1; i >= 0; i--) {
            game.sunParticles[i].update();
            if (game.sunParticles[i].timer > game.sunParticles[i].lifespan) {
                game.sunParticles.splice(i, 1);
            }
        }
    }
    
    function handleUI() {
        // Draw Sun counter
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 180, 80);
        ctx.fillStyle = 'white';
        ctx.font = '30px sans-serif';
        ctx.fillText('SUN: ' + game.sun, 20, 55);
        
        // Draw selected plant indicator
        ctx.font = '20px sans-serif';
        ctx.fillText('SELECTED:', 10, 120);
        
        let highlightX = 10;
        let highlightY = 130;
        if (game.selectedPlant === 'peashooter') {
            highlightY = 190;
        }
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3;
        ctx.strokeRect(highlightX, highlightY, 60, 50);

        ctx.fillStyle = 'orange';
        ctx.fillRect(20, 140, 40, 30); // Placeholder sunflower
        ctx.fillText('1', 80, 165);
        
        ctx.fillStyle = 'green';
        ctx.fillRect(20, 200, 40, 30); // Placeholder peashooter
        ctx.fillText('2', 80, 225);
    }

    // --- 8. THE GAME LOOP ---
    function update() {
        game.timer++;
        handlePlants();
        handleProjectiles();
        handleZombies();
        handleSun();
    }

    function draw() {
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the grid
        drawGrid();
        
        // Draw all game objects
        game.plants.forEach(plant => plant.draw());
        game.zombies.forEach(zombie => zombie.draw());
        game.projectiles.forEach(pea => pea.draw());
        game.sunParticles.forEach(sun => sun.draw());
        
        // Draw UI on top
        handleUI();
    }

    function gameLoop() {
        if (game.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'red';
            ctx.font = '80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('THE ZOMBIES ATE', canvas.width / 2, canvas.height / 2 - 40);
            ctx.fillText('YOUR BRAINS!', canvas.width / 2, canvas.height / 2 + 40);
            return; // Stop the loop
        }
        
        update();
        draw();
        
        // Request the next frame
        requestAnimationFrame(gameLoop);
    }
    
    // Helper function to draw the lawn grid
    function drawGrid() {
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = GRID_LINE_WIDTH;
        for (let row = 0; row < NUM_ROWS; row++) {
            for (let col = 0; col < NUM_COLS; col++) {
                let x = col * CELL_SIZE;
                let y = row * CELL_SIZE;
                ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    // --- 9. START THE GAME ---
    console.log("Game starting... Press '1' for Sunflower, '2' for Peashooter.");
    gameLoop();
});
