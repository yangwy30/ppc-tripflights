import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const TRIP_ID = 't_jfc2bvogfmspl3efu';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg2NTA4NjAzLCJleHAiOjE3ODcxMTM0MDMsInRyaXBfaWQiOiJ0X2pmYzJidm9nZm1zcGwzZWZ1In0.S54G2eZpPD0V4d65r5cyp-Xjr2bEKZhWGD9VwnKgprw';

const CHROME_PATH = '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"';
const DOCS_DIR = path.join(process.cwd(), 'docs');

const views = [
    { name: 'demo_live_timeline.png', hash: `#trip/${TRIP_ID}` },
];

console.log('Capturing real Chrome screenshots...');
// ...
