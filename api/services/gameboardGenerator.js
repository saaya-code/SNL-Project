import sharp from 'sharp';
import axios from 'axios';

const BOARD_SIZE = 1000;
const TILE_SIZE = 100;
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
          .tile { fill: #f0f0f0; stroke: #333; stroke-width: 2; }
          .tile-number { font-family: Arial; font-size: 14px; font-weight: bold; fill: #333; }
          .task-text { font-family: Arial; font-size: 10px; fill: #666; }
          .team-marker { font-family: Arial; font-size: 12px; font-weight: bold; }
          .snake { stroke: #ff4444; stroke-width: 4; fill: none; }
          .ladder { stroke: #8B4513; stroke-width: 4; fill: none; }
          .ladder-rung { stroke: #8B4513; stroke-width: 2; fill: none; }
          .task-indicator { fill: #ffaa00; stroke: #ff8800; stroke-width: 1; }
        </style>
      </defs>
  `;

  // Generate tiles (1-100)
  for (let i = 1; i <= 100; i++) {
    const { x, y } = getTilePosition(i);
    
    // Tile background
    svgContent += `<rect x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" class="tile"/>`;
    
    // Tile number
    svgContent += `<text x="${x + 5}" y="${y + 18}" class="tile-number">${i}</text>`;
    
    // Check for task and add task name
    const tileTasks = Object.fromEntries(game.tileTasks || new Map());
    if (tileTasks[i]) {
      const taskName = tileTasks[i].name || 'Task';
      svgContent += `<circle cx="${x + TILE_SIZE - 15}" cy="${y + 15}" r="6" class="task-indicator"/>`;
      svgContent += `<text x="${x + TILE_SIZE - 15}" y="${y + 18}" text-anchor="middle" font-size="10" fill="white">T</text>`;
      
      // Add task name below tile number
      const words = taskName.split(' ');
      let line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
      let line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
      
      if (line1.length > 12) line1 = line1.substring(0, 10) + '...';
      if (line2.length > 12) line2 = line2.substring(0, 10) + '...';
      
      svgContent += `<text x="${x + 5}" y="${y + 35}" class="task-text">${line1}</text>`;
      if (line2) {
        svgContent += `<text x="${x + 5}" y="${y + 47}" class="task-text">${line2}</text>`;
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
    const offset = (index % 4) * 20; // Offset multiple teams on same tile
    
    svgContent += `<circle cx="${pos.x + 30 + offset}" cy="${pos.y + 70}" r="12" fill="${color}" stroke="#000" stroke-width="2"/>`;
    svgContent += `<text x="${pos.x + 30 + offset}" y="${pos.y + 75}" text-anchor="middle" class="team-marker" fill="white">${team.teamName.charAt(team.teamName.length - 1)}</text>`;
  });

  // Add game info
  svgContent += `
    <rect x="10" y="10" width="200" height="60" fill="rgba(255,255,255,0.9)" stroke="#333" stroke-width="1"/>
    <text x="20" y="30" font-family="Arial" font-size="14" font-weight="bold" fill="#333">${game.name}</text>
    <text x="20" y="45" font-family="Arial" font-size="10" fill="#666">Teams: ${teams.length}</text>
    <text x="20" y="55" font-family="Arial" font-size="10" fill="#666">Status: ${game.status}</text>
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
  
  // Create a more realistic snake path with multiple curves
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  // Create S-curve for snake body
  const curve1X = startX + (endX - startX) * 0.3 + (startY - endY) * 0.2;
  const curve1Y = startY + (endY - startY) * 0.3 + (endX - startX) * 0.1;
  const curve2X = startX + (endX - startX) * 0.7 - (startY - endY) * 0.2;
  const curve2Y = startY + (endY - startY) * 0.7 - (endX - startX) * 0.1;
  
  return `
    <defs>
      <linearGradient id="snakeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#ff6666;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#cc0000;stop-opacity:1" />
      </linearGradient>
    </defs>
    <path d="M ${startX} ${startY} Q ${curve1X} ${curve1Y} ${midX} ${midY} Q ${curve2X} ${curve2Y} ${endX} ${endY}" 
          stroke="url(#snakeGradient)" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="${startX}" cy="${startY}" r="10" fill="#ff4444" stroke="#cc0000" stroke-width="2"/>
    <circle cx="${endX}" cy="${endY}" r="8" fill="#cc3333" stroke="#990000" stroke-width="2"/>
    <text x="${startX}" y="${startY + 4}" text-anchor="middle" font-size="12" fill="white">🐍</text>
    <text x="${endX}" y="${endY + 4}" text-anchor="middle" font-size="10" fill="white">🔻</text>
  `;
}

function drawLadder(startPos, endPos) {
  const startX = startPos.x + TILE_SIZE / 2;
  const startY = startPos.y + TILE_SIZE / 2;
  const endX = endPos.x + TILE_SIZE / 2;
  const endY = endPos.y + TILE_SIZE / 2;
  
  // Draw ladder sides
  const sideOffset = 8;
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const unitX = dx / length;
  const unitY = dy / length;
  
  // Perpendicular vector for ladder width
  const perpX = -unitY * sideOffset;
  const perpY = unitX * sideOffset;
  
  let ladderSvg = `
    <defs>
      <linearGradient id="ladderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#D2691E;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#8B4513;stop-opacity:1" />
      </linearGradient>
    </defs>
    <line x1="${startX + perpX}" y1="${startY + perpY}" x2="${endX + perpX}" y2="${endY + perpY}" 
          stroke="url(#ladderGradient)" stroke-width="4" stroke-linecap="round"/>
    <line x1="${startX - perpX}" y1="${startY - perpY}" x2="${endX - perpX}" y2="${endY - perpY}" 
          stroke="url(#ladderGradient)" stroke-width="4" stroke-linecap="round"/>
  `;
  
  // Draw ladder rungs
  const rungs = Math.max(3, Math.floor(length / 20));
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs;
    const rungX = startX + (endX - startX) * t;
    const rungY = startY + (endY - startY) * t;
    
    ladderSvg += `<line x1="${rungX + perpX}" y1="${rungY + perpY}" x2="${rungX - perpX}" y2="${rungY - perpY}" 
                       stroke="#8B4513" stroke-width="3" stroke-linecap="round" class="ladder-rung"/>`;
  }
  
  ladderSvg += `
    <circle cx="${startX}" cy="${startY}" r="8" fill="#44aa44" stroke="#338833" stroke-width="2"/>
    <circle cx="${endX}" cy="${endY}" r="8" fill="#66cc66" stroke="#44aa44" stroke-width="2"/>
    <text x="${startX}" y="${startY + 4}" text-anchor="middle" font-size="10" fill="white">🪜</text>
    <text x="${endX}" y="${endY + 4}" text-anchor="middle" font-size="10" fill="white">🔺</text>
  `;
  
  return ladderSvg;
}
