// Scratch test for routeMap rendering logic
import { renderRouteMap } from '../src/components/routeMap.js';

console.log('Testing routeMap module import...');
if (typeof renderRouteMap === 'function') {
  console.log('✅ renderRouteMap is exported correctly as a function!');
} else {
  console.error('❌ renderRouteMap export failed!');
}
