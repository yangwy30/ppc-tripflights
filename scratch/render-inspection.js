// Simple browser environment mock for Node.js
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.classList = {
      add: (...names) => { this.className = (this.className || '') + ' ' + names.join(' '); },
      remove: () => {},
      contains: () => false
    };
    this._innerHTML = '';
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) { this._innerHTML = val; }

  appendChild(child) { this.children.push(child); }
  querySelector(sel) { return new MockElement('div'); }
  querySelectorAll(sel) { return [new MockElement('div')]; }
  addEventListener(evt, fn) {}
  remove() {}
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
  }
  getElementById(id) { return new MockElement('div'); }
  createElement(tag) { return new MockElement(tag); }
}

global.window = {
  location: { hash: '', href: '' },
  addEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
};
global.document = new MockDocument();
try {
  Object.defineProperty(global, 'navigator', {
    value: { clipboard: { writeText: async () => {} } },
    writable: true,
    configurable: true
  });
} catch (e) {}

// Import app screens
const { renderHome } = await import('../src/screens/home.js');
const { renderFlightCard } = await import('../src/components/flightCard.js');
const { renderTimeline } = await import('../src/components/timeline.js');

console.log('✅ Browser mock initialized successfully!');

// Test Flight Card Render Output
const mockFlight = {
  id: 'f1',
  flightNumber: 'BA215',
  airline: 'British Airways',
  date: '2026-10-12',
  status: 'on-time',
  duration: '8h 10m',
  addedBy: 'Alex',
  departure: { code: 'LHR', city: 'London', time: '14:30', terminal: 'T5' },
  arrival: { code: 'JFK', city: 'New York', time: '17:40', terminal: 'T7' }
};
const mockParticipants = [{ name: 'Alex' }, { name: 'Sarah' }];
const mockTrip = { id: 't1', name: 'London Trip 2026', destinationAirport: 'JFK' };

console.log('\n--- 1. FLIGHT CARD HTML ---');
console.log(renderFlightCard(mockFlight, mockParticipants, 0, mockTrip));

console.log('\n--- 2. HOME SCREEN RENDER ---');
const homeContainer = new MockElement('div');
await renderHome(homeContainer);
console.log(homeContainer.innerHTML);

console.log('\n--- 3. TIMELINE RENDER ---');
const tlContainer = new MockElement('div');
renderTimeline(tlContainer, [mockFlight], mockParticipants);
console.log(tlContainer.innerHTML);
