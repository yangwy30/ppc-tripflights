/* Mount the exact react-simple-maps module used by the reference Vercel app. */

let activeMapRoot = null;
let renderGeneration = 0;
let mapModulePromise = null;

function loadMapModule() {
  if (!mapModulePromise) {
    mapModulePromise = Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./referenceFlightMap.jsx')
    ]);
  }
  return mapModulePromise;
}

export function destroyRouteMap() {
  renderGeneration += 1;
  if (!activeMapRoot) return;
  activeMapRoot.unmount();
  activeMapRoot = null;
}

export async function renderRouteMap(container, flights = [], participants = [], trip = {}, activePersonFilter = 'all', phaseName = 'outbound') {
  destroyRouteMap();
  const generation = renderGeneration;
  container.innerHTML = '<div class="reference-map-loading">Loading route map…</div>';

  const [reactModule, reactDomModule, mapModule] = await loadMapModule();
  if (generation !== renderGeneration || !container.isConnected) return;

  container.innerHTML = '';
  activeMapRoot = reactDomModule.createRoot(container);
  activeMapRoot.render(
    reactModule.default.createElement(mapModule.ReferenceFlightMap, {
      flights,
      participants,
      trip,
      activePersonFilter,
      phaseName
    })
  );
}
