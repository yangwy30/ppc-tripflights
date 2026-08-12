import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const TRIP_ID = 't_jfc2bvogfmspl3efu';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg2NTA4NjAzLCJleHAiOjE3ODcxMTM0MDMsInRyaXBfaWQiOiJ0X2pmYzJidm9nZm1zcGwzZWZ1In0.S54G2eZpPD0V4d65r5cyp-Xjr2bEKZhWGD9VwnKgprw';

const TOKENS_JSON = JSON.stringify({ [TRIP_ID]: TOKEN });
const NICKNAMES_JSON = JSON.stringify({ [TRIP_ID]: 'Yang' });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;

console.log('Starting Headless Chrome for UI verification...');
const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--remote-debugging-port=' + PORT,
    '--window-size=1280,950',
    'http://localhost:5173'
]);

await new Promise(r => setTimeout(r, 2000));

async function cdpRequest(targetId, method, params = {}) {
    const wsUrl = `http://127.0.0.1:${PORT}/json`;
    const targetsRes = await fetch(wsUrl);
    const targets = await targetsRes.json();
    const target = targets.find(t => t.id === targetId) || targets[0];

    if (!target || !target.webSocketDebuggerUrl) {
        throw new Error('No CDP target found');
    }

    const { WebSocket } = await import('ws');
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const id = Math.floor(Math.random() * 100000);

        ws.on('open', () => {
            ws.send(JSON.stringify({ id, method, params }));
        });

        ws.on('message', (raw) => {
            const msg = JSON.parse(raw.toString());
            if (msg.id === id) {
                ws.close();
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        });

        ws.on('error', reject);
    });
}

async function capture() {
    const targetsRes = await fetch(`http://127.0.0.1:${PORT}/json`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');

    console.log('Injecting localStorage tokens into live browser session...');
    const injectCode = `
        localStorage.setItem('ppc-trip-tracker_tokens', ${JSON.stringify(TOKENS_JSON)});
        localStorage.setItem('ppc-trip-tracker_nicknames', ${JSON.stringify(NICKNAMES_JSON)});
        window.location.hash = '#trip/${TRIP_ID}';
    `;

    await cdpRequest(pageTarget.id, 'Runtime.evaluate', { expression: injectCode });
    await new Promise(r => setTimeout(r, 3000));

    // 1. Dashboard + Hero Route Map
    console.log('1. Capturing Dashboard Screenshot...');
    const shot1 = await cdpRequest(pageTarget.id, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/demo_dashboard.png', Buffer.from(shot1.data, 'base64'));

    // 2. Flight Cards View
    console.log('2. Capturing Flight Cards Screenshot...');
    await cdpRequest(pageTarget.id, 'Runtime.evaluate', {
        expression: `
            const btnCards = document.querySelector('#btn-view-expanded');
            if (btnCards) btnCards.click();
            window.scrollTo(0, 350);
        `
    });
    await new Promise(r => setTimeout(r, 1500));
    const shotCards = await cdpRequest(pageTarget.id, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/demo_cards.png', Buffer.from(shotCards.data, 'base64'));

    // 3. Timeline View
    console.log('3. Capturing Timeline Screenshot...');
    await cdpRequest(pageTarget.id, 'Runtime.evaluate', {
        expression: `
            window.scrollTo(0, 0);
            const btnTime = document.querySelector('[data-tab="timeline"]');
            if (btnTime) btnTime.click();
        `
    });
    await new Promise(r => setTimeout(r, 1500));
    const shot2 = await cdpRequest(pageTarget.id, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('docs/demo_timeline.png', Buffer.from(shot2.data, 'base64'));

    chromeProcess.kill();
    console.log('🎉 All Real Screenshots Re-Captured Successfully!');
}

capture().catch(err => {
    console.error('Capture error:', err);
    chromeProcess.kill();
});
