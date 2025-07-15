# Memory Optimization Guide

## Running with Garbage Collection (Development)

To enable manual garbage collection for better memory management during development:

```bash
# Start the API server with --expose-gc flag
node --expose-gc index.js

# Or with npm start (update package.json script)
npm start -- --expose-gc
```

## Memory Leak Fixes Applied

### 1. Sharp Instance Management
- All Sharp instances are now properly destroyed after use
- Added explicit cleanup in finally blocks
- Limited concurrent image processing to prevent memory spikes

### 2. Image Processing Optimization
- Reduced JPEG quality from 90 to 85 for smaller file sizes
- Added progressive and mozjpeg options for better compression
- Added size limits (10MB max for input images)
- Batch processing limited to 3 concurrent images

### 3. SVG Generation Optimization
- Refactored SVG generation to use arrays instead of string concatenation
- Split large functions into smaller, memory-efficient helpers
- Added proper validation and error handling

### 4. Memory Monitoring
- Added comprehensive memory logging for each request
- Periodic memory usage reporting every 30 seconds
- Automatic garbage collection in development mode
- Warning alerts for high memory usage

### 5. Request-Level Cleanup
- Each board generation request has a unique ID for tracking
- Explicit cleanup of large variables in finally blocks
- Cache headers optimized to prevent client-side caching issues

## Recommended Production Settings

### Environment Variables
```env
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=1024"
```

### Docker Memory Limits
```yaml
services:
  api:
    image: snl-api
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

## Monitoring Commands

### Check Memory Usage
```bash
# View detailed memory info
curl -s http://localhost:3000/api/games/{gameId}/board -w "%{time_total}s\n" > /dev/null

# Monitor server logs for memory warnings
tail -f api.log | grep -E "Memory|MB"
```

### Performance Testing
```bash
# Test multiple rapid requests
for i in {1..10}; do
  curl -s "http://localhost:3000/api/games/{gameId}/board" > "board_$i.png" &
done
wait
```

## Memory Leak Indicators

Watch for these warning signs:
- Memory usage consistently above 256MB
- Increasing memory usage over time without corresponding load
- "High memory usage" or "Critical memory usage" log messages
- Slow response times for board generation

## Troubleshooting

If memory issues persist:

1. **Restart the service** - Quick fix for accumulated memory
2. **Check image sizes** - Large images consume more memory
3. **Limit concurrent requests** - Use a reverse proxy to queue requests
4. **Monitor Sharp instances** - Ensure all instances are being destroyed
5. **Enable garbage collection** - Use `--expose-gc` flag in development

## Additional Optimizations

- Consider implementing Redis caching for frequently requested boards
- Use CDN for static board images
- Implement request queuing for high-traffic scenarios
- Monitor with tools like clinic.js or 0x for detailed profiling
