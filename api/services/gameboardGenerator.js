import sharp from 'sharp';
import https from 'https';
import http from 'http';

const BOARD_SIZE = 1400;
const TILE_SIZE = 140;
const GRID_SIZE = 10;

// Helper function to escape XML entities
function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Helper function to convert external image URL to data URL
async function convertImageToDataUrl(imageUrl, maxSize = 140) {
  try {
    // If it's already a data URL, return as is
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    // Skip blob URLs as they should have been converted client-side
    if (imageUrl.startsWith('blob:')) {
      console.warn(`Blob URL detected (should be converted client-side): ${imageUrl}`);
      return null;
    }

    // Only convert external URLs (http/https)
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.warn(`Unsupported URL protocol: ${imageUrl}`);
      return null;
    }

    console.log(`Converting external image to data URL: ${imageUrl}`);
    
    // Fetch the image using native http/https modules
    const imageBuffer = await fetchImageBuffer(imageUrl);
    if (!imageBuffer) {
      return null;
    }

    // Process with Sharp to resize and optimize
    // Convert all images to JPEG to avoid transparency issues and ensure consistency
    const processedBuffer = await sharp(imageBuffer)
      .resize(maxSize, maxSize, {
        fit: 'cover', // Use 'cover' to fill the entire tile while maintaining aspect ratio
        withoutEnlargement: false // Allow enlargement to fill the tile
      })
      .flatten({ background: '#ffffff' }) // Add white background for PNG transparency
      .jpeg({ quality: 90 }) // Convert everything to JPEG for consistency
      .toBuffer();
    
    const mimeType = 'image/jpeg';

    // Convert to base64 data URL
    const base64 = processedBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    
    console.log(`Successfully converted image to JPEG data URL (${Math.round(dataUrl.length / 1024)}KB)`);
    return dataUrl;

  } catch (error) {
    console.warn(`Error converting image URL to data URL: ${error.message}`);
    return null;
  }
}

// Helper function to fetch image buffer using native modules
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const module = urlObj.protocol === 'https:' ? https : http;
    
    const request = module.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SNL-Bot/1.0)',
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

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
    console.error('Game data:', JSON.stringify(game, null, 2));
    console.error('Teams data:', JSON.stringify(teams, null, 2));
    throw error;
  }
}

async function createGameBoardSVG(game, teams) {
  // First, collect all tile tasks and images to create clip paths
  // Handle both game.tileTasks and game.gameParameters.tileTasks structures
  const tileTasks = Object.fromEntries(game.tileTasks || game.gameParameters?.tileTasks || new Map());
  
  // Pre-process images: handle external URLs and validate data URLs
  console.log('Pre-processing images...');
  for (const [tileNumber, task] of Object.entries(tileTasks)) {
    if (task && (task.imageUrl || task.uploadedImageUrl)) {
      const imageUrl = task.uploadedImageUrl || task.imageUrl;
      
      console.log(`Tile ${tileNumber} has image: ${imageUrl.substring(0, 100)}...`);
      
      if (imageUrl.startsWith('data:')) {
        // Check if it's already a JPEG data URL
        if (imageUrl.startsWith('data:image/jpeg')) {
          console.log(`✅ Using client-converted JPEG data URL for tile ${tileNumber}`);
        } else {
          console.log(`⚠️  Non-JPEG data URL for tile ${tileNumber}, will be processed`);
          // Try to convert it to JPEG if it's not already
          try {
            const base64Data = imageUrl.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const processedBuffer = await sharp(imageBuffer)
              .resize(140, 140, {
                fit: 'cover',
                withoutEnlargement: false
              })
              .flatten({ background: '#ffffff' })
              .jpeg({ quality: 90 })
              .toBuffer();
            
            const processedBase64 = processedBuffer.toString('base64');
            const processedDataUrl = `data:image/jpeg;base64,${processedBase64}`;
            
            if (task.uploadedImageUrl) {
              task.uploadedImageUrl = processedDataUrl;
            } else {
              task.imageUrl = processedDataUrl;
            }
            console.log(`✅ Converted to JPEG for tile ${tileNumber}`);
          } catch (error) {
            console.error(`❌ Failed to convert image for tile ${tileNumber}:`, error);
            delete task.imageUrl;
            delete task.uploadedImageUrl;
          }
        }
      } else if (imageUrl.startsWith('blob:')) {
        // This shouldn't happen if client-side conversion is working properly
        console.warn(`❌ Blob URL detected for tile ${tileNumber} - removing image`);
        delete task.imageUrl;
        delete task.uploadedImageUrl;
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // External URL, try to convert it
        const dataUrl = await convertImageToDataUrl(imageUrl);
        if (dataUrl) {
          if (task.uploadedImageUrl) {
            task.uploadedImageUrl = dataUrl;
          } else {
            task.imageUrl = dataUrl;
          }
          console.log(`✅ Converted external URL to data URL for tile ${tileNumber}`);
        } else {
          console.log(`❌ Failed to convert external URL for tile ${tileNumber}, removing image`);
          delete task.imageUrl;
          delete task.uploadedImageUrl;
        }
      } else {
        console.warn(`❌ Unknown image URL format for tile ${tileNumber}: ${imageUrl.substring(0, 50)}...`);
        delete task.imageUrl;
        delete task.uploadedImageUrl;
      }
    }
  }
  
  const clipPaths = [];
  
  for (let i = 1; i <= 100; i++) {
    const task = tileTasks[i];
    if (task && (task.imageUrl || task.uploadedImageUrl)) {
      const { x, y } = getTilePosition(i);
      clipPaths.push(`
        <clipPath id="tileClip${i}">
          <rect x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" rx="8" ry="8"/>
        </clipPath>
      `);
    }
  }

  let svgContent = `
    <svg width="${BOARD_SIZE}" height="${BOARD_SIZE}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <style>
          .tile { fill: #d0d0d0; stroke: #444; stroke-width: 3; }
          .tile-alt { fill: #b8b8b8; stroke: #444; stroke-width: 3; }
          .tile-number { font-family: 'Arial Black', Arial; font-size: 20px; font-weight: bold; fill: #000; text-shadow: 2px 2px 4px rgba(0,0,0,0.8); }
          .task-text { font-family: 'Arial Black', Arial; font-size: 12px; font-weight: bold; fill: #000; }
          .task-text-circle { font-family: 'Arial Black', Arial; font-size: 8px; font-weight: bold; fill: #333; }
          .team-marker { font-family: 'Arial Black', Arial; font-size: 16px; font-weight: bold; }
          .snake { stroke: #228B22; stroke-width: 8; fill: none; }
          .ladder { stroke: #8B4513; stroke-width: 6; fill: none; }
          .ladder-rung { stroke: #8B4513; stroke-width: 3; fill: none; }
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
        ${clipPaths.join('')}
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
    
    // Check for task and get image info
    const tileTasks = Object.fromEntries(game.tileTasks || game.gameParameters?.tileTasks || new Map());
    const task = tileTasks[i];
    const hasImage = task && (task.imageUrl || task.uploadedImageUrl);
    
    // Tile background with rounded corners
    svgContent += `<rect x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" 
                         class="${isAlternate ? 'tile-alt' : 'tile'}" rx="8" ry="8"/>`;
    
    // If tile has an image, display it
    if (hasImage) {
      const imageUrl = escapeXml(task.uploadedImageUrl || task.imageUrl);
      
      // Add debugging for image processing
      console.log(`Processing image for tile ${i}: ${imageUrl.substring(0, 50)}...`);
      
      // Ensure the image URL is valid
      if (imageUrl && imageUrl.length > 0) {
        svgContent += `
          <image x="${x}" y="${y}" width="${TILE_SIZE}" height="${TILE_SIZE}" 
                 href="${imageUrl}" clip-path="url(#tileClip${i})" preserveAspectRatio="xMidYMid slice"/>
        `;
      } else {
        console.warn(`Empty or invalid image URL for tile ${i}`);
      }
    }

    // Tile number with background circle (always rendered in top-left)
    svgContent += `<circle cx="${x + 25}" cy="${y + 25}" r="18" fill="rgba(255,255,255,0.95)" stroke="#333" stroke-width="2"/>`;
    svgContent += `<text x="${x + 25}" y="${y + 32}" text-anchor="middle" class="tile-number">${i}</text>`;

    // If tile has a task name, display it centered in a white box (always on top of image)
    if (task && task.name) {
      const taskName = task.name;
      // Truncate if too long for the box
      let displayText = taskName;
      if (displayText.length > 24) {
        displayText = displayText.substring(0, 21) + '...';
      }
      // White box centered in the tile
      const boxWidth = TILE_SIZE - 18;
      const boxHeight = 32;
      const boxX = x + (TILE_SIZE - boxWidth) / 2;
      const boxY = y + (TILE_SIZE - boxHeight) / 2;
      svgContent += `
        <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="8" ry="8" fill="white" opacity="0.92" stroke="#bbb" stroke-width="1.5"/>
        <text x="${x + TILE_SIZE / 2}" y="${y + TILE_SIZE / 2 + 7}" text-anchor="middle" class="task-text" font-size="14" font-weight="bold">${escapeXml(displayText)}</text>
      `;
    }
  }

  // Draw snakes
  const snakes = Object.fromEntries(game.snakes || game.gameParameters?.snakes || new Map());
  for (const [start, end] of Object.entries(snakes)) {
    const startPos = getTilePosition(parseInt(start));
    const endPos = getTilePosition(parseInt(end));
    svgContent += drawSnake(startPos, endPos);
  }

  // Draw ladders
  const ladders = Object.fromEntries(game.ladders || game.gameParameters?.ladders || new Map());
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
    svgContent += `<text x="${pos.x + 45 + offset}" y="${pos.y + 102}" text-anchor="middle" class="team-marker" fill="white">${escapeXml(team.teamName.charAt(team.teamName.length - 1))}</text>`;
  });

  svgContent += '</svg>';
  
  // Validate SVG content before returning
  try {
    // Basic XML validation - check for unmatched brackets and entities
    const xmlIssues = [];
    
    // Check for unescaped ampersands
    const unescapedAmp = svgContent.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g);
    if (unescapedAmp) {
      xmlIssues.push(`Unescaped ampersands found: ${unescapedAmp.join(', ')}`);
    }
    
    // Check for mismatched quotes
    const quotes = svgContent.match(/"/g);
    if (quotes && quotes.length % 2 !== 0) {
      xmlIssues.push('Mismatched quotes detected');
    }
    
    if (xmlIssues.length > 0) {
      console.error('SVG validation issues:', xmlIssues);
      console.error('Problematic SVG content:', svgContent.substring(0, 1000));
    }
  } catch (validationError) {
    console.error('SVG validation error:', validationError);
  }
  
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
  
  // Ladder width - ensure minimum width for vertical ladders
  const ladderWidth = 16;
  
  // Calculate perpendicular offset for ladder sides
  // Fix for vertical ladders by ensuring minimum perpendicular distance
  let perpX = -Math.sin(angle) * ladderWidth;
  let perpY = Math.cos(angle) * ladderWidth;
  
  // If ladder is nearly vertical or horizontal, adjust perpendicular values
  if (Math.abs(perpX) < 8) {
    perpX = perpX >= 0 ? 8 : -8;
  }
  if (Math.abs(perpY) < 8) {
    perpY = perpY >= 0 ? 8 : -8;
  }
  
  const uniqueId = `${Math.floor(startX)}_${Math.floor(startY)}`;
  
  let ladderSvg = `
    <defs>
      <linearGradient id="woodGradient_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#DEB887;stop-opacity:1" />
        <stop offset="50%" style="stop-color:#D2B48C;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#8B7355;stop-opacity:1" />
      </linearGradient>
      <linearGradient id="ladderSideGradient_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
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
          stroke="url(#ladderSideGradient_${uniqueId})" stroke-width="6" stroke-linecap="round"/>
    <line x1="${startX - perpX}" y1="${startY - perpY}" x2="${endX - perpX}" y2="${endY - perpY}" 
          stroke="url(#ladderSideGradient_${uniqueId})" stroke-width="6" stroke-linecap="round"/>
    
    <!-- Ladder side highlights -->
    <line x1="${startX + perpX}" y1="${startY + perpY}" x2="${endX + perpX}" y2="${endY + perpY}" 
          stroke="#F5DEB3" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    <line x1="${startX - perpX}" y1="${startY - perpY}" x2="${endX - perpX}" y2="${endY - perpY}" 
          stroke="#F5DEB3" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
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
                       stroke="url(#woodGradient_${uniqueId})" stroke-width="4" stroke-linecap="round"/>`;
    
    // Rung highlight
    ladderSvg += `<line x1="${rungX + perpX * 0.8}" y1="${rungY + perpY * 0.8}" x2="${rungX - perpX * 0.8}" y2="${rungY - perpY * 0.8}" 
                       stroke="#F5DEB3" stroke-width="1" stroke-linecap="round" opacity="0.8"/>`;
  }
  
  // Ladder end decorations
  ladderSvg += `
    <!-- Bottom platform -->
    <circle cx="${startX}" cy="${startY}" r="16" fill="url(#woodGradient_${uniqueId})" stroke="#8B4513" stroke-width="3"/>
    <circle cx="${startX}" cy="${startY}" r="10" fill="#228B22" stroke="#006400" stroke-width="2"/>
    
    <!-- Top platform -->
    <circle cx="${endX}" cy="${endY}" r="16" fill="url(#woodGradient_${uniqueId})" stroke="#8B4513" stroke-width="3"/>
    <circle cx="${endX}" cy="${endY}" r="10" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
    
    <!-- Labels -->
    <text x="${startX}" y="${startY + 35}" text-anchor="middle" font-size="14" fill="#000" font-weight="bold">CLIMB UP</text>
    <text x="${endX}" y="${endY - 25}" text-anchor="middle" font-size="16" fill="#000">🪜</text>
  `;
  
  return ladderSvg;
}
