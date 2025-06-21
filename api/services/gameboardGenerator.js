import sharp from 'sharp';
import axios from 'axios';

const BOARD_SIZE = 1400;
const TILE_SIZE = 140;
const GRID_SIZE = 10;

export async function generateGameBoard(game, teams) {
  try {
    // Create SVG content
    const svgContent = await createGameBoardSVG(game, teams);
    
    // Convert SVG to PNG buffer
    const pngBuffer = await sharp(Buffer.from(svgContent))
      .png()
      .toBuffer();
    
    return pngBuffer;
  } catch (error) {
    console.error('Error generating game board:', error);
    throw error;
  }
}

async function createGameBoardSVG(game, teams) {
  let svgContent = `
    <svg width="${BOARD_SIZE}" height="${BOARD_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .tile { fill: #f8f8f8; stroke: #444; stroke-width: 3; }
          .tile-alt { fill: #e8e8e8; stroke: #444; stroke-width: 3; }
          .tile-number { font-family: 'Arial Black', Arial; font-size: 20px; font-weight: bold; fill: #222; }
          .task-text { font-family: Arial; font-size: 12px; fill: #555; }
          .team-marker { font-family: 'Arial Black', Arial; font-size: 16px; font-weight: bold; }
          .snake { stroke: #228B22; stroke-width: 8; fill: none; }
          .ladder { stroke: #8B4513; stroke-width: 6; fill: none; }
          .ladder-rung { stroke: #8B4513; stroke-width: 3; fill: none; }
          .task-indicator { fill: #ffaa00; stroke: #ff8800; stroke-width: 2; }
          .board-border { fill: none; stroke: #333; stroke-width: 6; }
        </style>
        <pattern id="woodGrain" patternUnits="userSpaceOnUse" width="20" height="20">
          <rect width="20" height="20" fill="#DEB887"/>
          <path d="M0,10 Q5,5 10,10 T20,10" stroke="#CD853F" stroke-width="1" fill="none"/>
          <path d="M0,15 Q5,12 10,15 T20,15" stroke="#CD853F" stroke-width="0.5" fill="none"/>
        </pattern>
        <pattern id="snakeScale" patternUnits="userSpaceOnUse" width="8" height="8">
          <rect width="8" height="8" fill="#228B22"/>
          <circle cx="4" cy="4" r="2" fill="#32CD32" opacity="0.7"/>
        </pattern>
      </defs>
      
      <!-- Board border -->
      <rect x="2" y="2" width="${BOARD_SIZE - 4}" height="${BOARD_SIZE - 4}" class="board-border"/>
  `;

  // Generate tiles (1-100)
  for (let i = 1; i <= 100; i++) {
    const { x, y } = getTilePosition(i);
    
    // Alternating tile colors for checkerboard effect
    const row = Math.floor((i - 1) / GRID_SIZE);
    const col = (i - 1) % GRID_SIZE;
    const isAlternate = (row + col) % 2 === 1;
    
    // Tile background with rounded corners
    svgContent += `<rect x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" 
                         class="${isAlternate ? 'tile-alt' : 'tile'}" rx="8" ry="8"/>`;
    
    // Tile number with background circle
    svgContent += `<circle cx="${x + 25}" cy="${y + 25}" r="18" fill="white" stroke="#444" stroke-width="2"/>`;
    svgContent += `<text x="${x + 25}" y="${y + 32}" text-anchor="middle" class="tile-number">${i}</text>`;
    
    // Check for task and add task indicator
    const tileTasks = Object.fromEntries(game.tileTasks || new Map());
    if (tileTasks[i]) {
      const taskName = tileTasks[i].name || 'Task';
      svgContent += `<circle cx="${x + TILE_SIZE - 20}" cy="${y + 20}" r="10" class="task-indicator"/>`;
      svgContent += `<text x="${x + TILE_SIZE - 20}" y="${y + 26}" text-anchor="middle" font-size="14" font-weight="bold" fill="white">T</text>`;
      
      // Add task name below tile number
      const words = taskName.split(' ');
      let line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      let line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
      
      if (line1.length > 15) line1 = line1.substring(0, 13) + '...';
      if (line2.length > 15) line2 = line2.substring(0, 13) + '...';
      
      svgContent += `<text x="${x + 8}" y="${y + 55}" class="task-text">${line1}</text>`;
      if (line2) {
        svgContent += `<text x="${x + 8}" y="${y + 70}" class="task-text">${line2}</text>`;
      }
    }
  }

  // Draw snakes
  const snakes = Object.fromEntries(game.snakes || new Map());
  for (const [start, end] of Object.entries(snakes)) {
    const startPos = getTilePosition(parseInt(start));
    const endPos = getTilePosition(parseInt(end));
    svgContent += drawSnake(startPos, endPos);
  }

  // Draw ladders
  const ladders = Object.fromEntries(game.ladders || new Map());
  for (const [start, end] of Object.entries(ladders)) {
    const startPos = getTilePosition(parseInt(start));
    const endPos = getTilePosition(parseInt(end));
    svgContent += drawLadder(startPos, endPos);
  }

  // Draw team positions
  const teamColors = ['#ff0000', '#0000ff', '#00ff00', '#ff00ff', '#ffff00', '#00ffff'];
  teams.forEach((team, index) => {
    const pos = getTilePosition(team.currentPosition);
    const color = teamColors[index % teamColors.length];
    const offset = (index % 4) * 28; // Larger offset for bigger tiles
    
    // Team marker with shadow effect
    svgContent += `<circle cx="${pos.x + 45 + offset + 3}" cy="${pos.y + 95 + 3}" r="18" fill="rgba(0,0,0,0.3)"/>`;
    svgContent += `<circle cx="${pos.x + 45 + offset}" cy="${pos.y + 95}" r="18" fill="${color}" stroke="#000" stroke-width="3"/>`;
    svgContent += `<text x="${pos.x + 45 + offset}" y="${pos.y + 102}" text-anchor="middle" class="team-marker" fill="white">${team.teamName.charAt(team.teamName.length - 1)}</text>`;
  });

  // Add game info with enhanced styling
  svgContent += `
    <rect x="15" y="15" width="280" height="85" fill="rgba(255,255,255,0.95)" stroke="#333" stroke-width="2" rx="10" ry="10"/>
    <text x="25" y="40" font-family="Arial Black" font-size="18" font-weight="bold" fill="#333">${game.name}</text>
    <text x="25" y="60" font-family="Arial" font-size="14" fill="#666">Teams: ${teams.length} | Status: ${game.status.toUpperCase()}</text>
    <text x="25" y="78" font-family="Arial" font-size="12" fill="#888">Snakes: ${Object.keys(game.snakes || {}).length} | Ladders: ${Object.keys(game.ladders || {}).length}</text>
  `;

  svgContent += '</svg>';
  return svgContent;
}

function getTilePosition(tileNumber) {
  // Snake-like pattern: bottom-left is 1, goes right, then up and left, etc.
  const row = Math.floor((tileNumber - 1) / GRID_SIZE);
  const col = (tileNumber - 1) % GRID_SIZE;
  
  // Reverse direction on odd rows (snake pattern)
  const actualCol = row % 2 === 0 ? col : (GRID_SIZE - 1 - col);
  const actualRow = GRID_SIZE - 1 - row; // Start from bottom
  
  return {
    x: actualCol * TILE_SIZE,
    y: actualRow * TILE_SIZE
  };
}

function drawSnake(startPos, endPos) {
  const startX = startPos.x + TILE_SIZE / 2;
  const startY = startPos.y + TILE_SIZE / 2;
  const endX = endPos.x + TILE_SIZE / 2;
  const endY = endPos.y + TILE_SIZE / 2;
  
  // Calculate distance and direction
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  // Create realistic serpentine path
  const segments = Math.max(8, Math.floor(distance / 30));
  let pathData = `M ${startX} ${startY}`;
  
  // Generate smooth S-curve path
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Base position along the line
    const baseX = startX + dx * t;
    const baseY = startY + dy * t;
    
    // Create natural snake curves that taper
    const waveAmplitude = 25 * Math.sin(t * Math.PI) * (1 - t * 0.3); // Amplitude decreases toward tail
    const waveFreq = 3; // Number of S-curves
    const waveOffset = Math.sin(t * Math.PI * waveFreq + Math.PI/4) * waveAmplitude;
    
    // Perpendicular direction for wave
    const perpX = -dy / distance;
    const perpY = dx / distance;
    
    const curveX = baseX + perpX * waveOffset;
    const curveY = baseY + perpY * waveOffset;
    
    points.push({ x: curveX, y: curveY, t: t });
  }
  
  // Create smooth curve through points using quadratic curves
  pathData = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    if (i < points.length - 1) {
      const midX = (points[i].x + points[i + 1].x) / 2;
      const midY = (points[i].y + points[i + 1].y) / 2;
      pathData += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
    } else {
      pathData += ` Q ${points[i].x} ${points[i].y} ${points[i].x} ${points[i].y}`;
    }
  }
  
  const uniqueId = `${Math.floor(startX)}_${Math.floor(startY)}`;
  
  return `
    <defs>
      <linearGradient id="snakeGradient_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#228B22;stop-opacity:1" />
        <stop offset="25%" style="stop-color:#32CD32;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#90EE90;stop-opacity:1" />
        <stop offset="75%" style="stop-color:#32CD32;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#006400;stop-opacity:1" />
      </linearGradient>
      <pattern id="snakeScales_${uniqueId}" patternUnits="userSpaceOnUse" width="12" height="8">
        <rect width="12" height="8" fill="url(#snakeGradient_${uniqueId})"/>
        <ellipse cx="3" cy="4" rx="2" ry="1.5" fill="#006400" opacity="0.4"/>
        <ellipse cx="9" cy="4" rx="2" ry="1.5" fill="#006400" opacity="0.4"/>
      </pattern>
      <radialGradient id="snakeHead_${uniqueId}" cx="30%" cy="30%">
        <stop offset="0%" style="stop-color:#90EE90;stop-opacity:1" />
        <stop offset="60%" style="stop-color:#32CD32;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#228B22;stop-opacity:1" />
      </radialGradient>
    </defs>
    
    <!-- Snake body shadow -->
    <path d="${pathData}" stroke="#000000" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.3" transform="translate(3,3)"/>
    
    <!-- Snake body outline -->
    <path d="${pathData}" stroke="#000000" stroke-width="14" fill="none" stroke-linecap="round"/>
    
    <!-- Snake body base -->
    <path d="${pathData}" stroke="url(#snakeScales_${uniqueId})" stroke-width="12" fill="none" stroke-linecap="round"/>
    
    <!-- Snake body highlight -->
    <path d="${pathData}" stroke="#90EE90" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.7"/>
    
    <!-- Snake head (at start position) -->
    <g>
      <!-- Head shadow -->
      <ellipse cx="${startX + 2}" cy="${startY + 2}" rx="20" ry="16" fill="#000000" opacity="0.3" transform="rotate(${(angle * 180 / Math.PI)} ${startX + 2} ${startY + 2})"/>
      <!-- Head outline -->
      <ellipse cx="${startX}" cy="${startY}" rx="20" ry="16" fill="#000000" transform="rotate(${(angle * 180 / Math.PI)} ${startX} ${startY})"/>
      <!-- Head main -->
      <ellipse cx="${startX}" cy="${startY}" rx="18" ry="14" fill="url(#snakeHead_${uniqueId})" transform="rotate(${(angle * 180 / Math.PI)} ${startX} ${startY})"/>
      <!-- Head highlight -->
      <ellipse cx="${startX}" cy="${startY}" rx="14" ry="10" fill="#90EE90" opacity="0.6" transform="rotate(${(angle * 180 / Math.PI)} ${startX} ${startY})"/>
    </g>
    
    <!-- Snake eyes -->
    <g transform="rotate(${(angle * 180 / Math.PI)} ${startX} ${startY})">
      <!-- Eye sockets -->
      <ellipse cx="${startX + 6}" cy="${startY - 5}" rx="4" ry="3" fill="#000000"/>
      <ellipse cx="${startX + 6}" cy="${startY + 5}" rx="4" ry="3" fill="#000000"/>
      <!-- Eyes -->
      <ellipse cx="${startX + 7}" cy="${startY - 5}" rx="3" ry="2.5" fill="#FFD700"/>
      <ellipse cx="${startX + 7}" cy="${startY + 5}" rx="3" ry="2.5" fill="#FFD700"/>
      <!-- Pupils (vertical slits) -->
      <ellipse cx="${startX + 7}" cy="${startY - 5}" rx="0.5" ry="2" fill="#000000"/>
      <ellipse cx="${startX + 7}" cy="${startY + 5}" rx="0.5" ry="2" fill="#000000"/>
      <!-- Eye shine -->
      <ellipse cx="${startX + 7.5}" cy="${startY - 5.5}" rx="0.8" ry="0.5" fill="#FFFFFF" opacity="0.8"/>
      <ellipse cx="${startX + 7.5}" cy="${startY + 4.5}" rx="0.8" ry="0.5" fill="#FFFFFF" opacity="0.8"/>
    </g>
    
    <!-- Forked tongue -->
    <g transform="rotate(${(angle * 180 / Math.PI)} ${startX} ${startY})">
      <path d="M ${startX + 18} ${startY} L ${startX + 28} ${startY}" stroke="#FF0000" stroke-width="2" fill="none"/>
      <path d="M ${startX + 25} ${startY} L ${startX + 30} ${startY - 4} M ${startX + 25} ${startY} L ${startX + 30} ${startY + 4}" 
            stroke="#FF0000" stroke-width="1.5" fill="none"/>
    </g>
    
    <!-- Snake nostrils -->
    <g transform="rotate(${(angle * 180 / Math.PI)} ${startX} ${startY})">
      <ellipse cx="${startX + 14}" cy="${startY - 2}" rx="1" ry="0.5" fill="#000000"/>
      <ellipse cx="${startX + 14}" cy="${startY + 2}" rx="1" ry="0.5" fill="#000000"/>
    </g>
    
    <!-- Snake tail (at end position) -->
    <ellipse cx="${endX}" cy="${endY}" rx="12" ry="10" fill="#228B22" stroke="#006400" stroke-width="2"/>
    <ellipse cx="${endX}" cy="${endY}" rx="8" ry="6" fill="#32CD32"/>
    <ellipse cx="${endX}" cy="${endY}" rx="4" ry="3" fill="#90EE90"/>
    
    <!-- Snake pattern on body -->
    <g opacity="0.4">
      ${points.map((point, i) => {
        if (i % 3 === 0 && i > 0 && i < points.length - 2) {
          return `<ellipse cx="${point.x}" cy="${point.y}" rx="6" ry="4" fill="#006400" opacity="0.6"/>`;
        }
        return '';
      }).join('')}
    </g>
  `;
}

function drawLadder(startPos, endPos) {
  const startX = startPos.x + TILE_SIZE / 2;
  const startY = startPos.y + TILE_SIZE / 2;
  const endX = endPos.x + TILE_SIZE / 2;
  const endY = endPos.y + TILE_SIZE / 2;
  
  // Calculate ladder angle and dimensions
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  
  // Ladder width
  const ladderWidth = 16;
  
  // Calculate perpendicular offset for ladder sides
  const perpX = -Math.sin(angle) * ladderWidth;
  const perpY = Math.cos(angle) * ladderWidth;
  
  let ladderSvg = `
    <defs>
      <linearGradient id="woodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#DEB887;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#D2B48C;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#8B7355;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="ladderSideGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#CD853F;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#A0522D;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#8B4513;stop-opacity:1" />
      </linearGradient>
    </defs>
    
    <!-- Ladder shadow -->
    <line x1="${startX + perpX + 3}" y1="${startY + perpY + 3}" x2="${endX + perpX + 3}" y2="${endY + perpY + 3}" 
          stroke="rgba(0,0,0,0.3)" stroke-width="8" stroke-linecap="round"/>
    <line x1="${startX - perpX + 3}" y1="${startY - perpY + 3}" x2="${endX - perpX + 3}" y2="${endY - perpY + 3}" 
          stroke="rgba(0,0,0,0.3)" stroke-width="8" stroke-linecap="round"/>
    
    <!-- Ladder sides with wood texture -->
    <line x1="${startX + perpX}" y1="${startY + perpY}" x2="${endX + perpX}" y2="${endY + perpY}" 
          stroke="url(#ladderSideGradient)" stroke-width="6" stroke-linecap="round"/>
    <line x1="${startX - perpX}" y1="${startY - perpY}" x2="${endX - perpX}" y2="${endY - perpY}" 
          stroke="url(#ladderSideGradient)" stroke-width="6" stroke-linecap="round"/>
  `;
  
  // Draw ladder rungs with realistic spacing
  const rungSpacing = 35;
  const numRungs = Math.max(3, Math.floor(length / rungSpacing));
  
  for (let i = 1; i < numRungs; i++) {
    const t = i / numRungs;
    const rungX = startX + dx * t;
    const rungY = startY + dy * t;
    
    // Rung shadow
    ladderSvg += `<line x1="${rungX + perpX + 2}" y1="${rungY + perpY + 2}" x2="${rungX - perpX + 2}" y2="${rungY - perpY + 2}" 
                       stroke="rgba(0,0,0,0.3)" stroke-width="6" stroke-linecap="round"/>`;
    
    // Main rung with wood gradient
    ladderSvg += `<line x1="${rungX + perpX}" y1="${rungY + perpY}" x2="${rungX - perpX}" y2="${rungY - perpY}" 
                       stroke="url(#woodGradient)" stroke-width="4" stroke-linecap="round"/>`;
    
    // Rung highlight
    ladderSvg += `<line x1="${rungX + perpX * 0.8}" y1="${rungY + perpY * 0.8}" x2="${rungX - perpX * 0.8}" y2="${rungY - perpY * 0.8}" 
                       stroke="#F5DEB3" stroke-width="1" stroke-linecap="round" opacity="0.8"/>`;
  }
  
  // Ladder end decorations
  ladderSvg += `
    <!-- Bottom platform -->
    <circle cx="${startX}" cy="${startY}" r="16" fill="url(#woodGradient)" stroke="#8B4513" stroke-width="3"/>
    <circle cx="${startX}" cy="${startY}" r="10" fill="#228B22" stroke="#006400" stroke-width="2"/>
    
    <!-- Top platform -->
    <circle cx="${endX}" cy="${endY}" r="16" fill="url(#woodGradient)" stroke="#8B4513" stroke-width="3"/>
    <circle cx="${endX}" cy="${endY}" r="10" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
    
    <!-- Labels -->
    <text x="${startX}" y="${startY + 35}" text-anchor="middle" font-size="14" fill="#000" font-weight="bold">CLIMB UP</text>
    <text x="${endX}" y="${endY - 25}" text-anchor="middle" font-size="16" fill="#000">🪜</text>
  `;
  
  return ladderSvg;
}
