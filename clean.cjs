const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('index.html')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('.');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/<title>PPC: Delay No More — Commercial Group Flight Tracker<\/title>/g, '<title>PPC: Delay No More</title>');
    content = content.replace(/Universal Time-Based Dynamic Flight Status Resolver/g, 'Returns computed flight status based on current time vs departure/arrival');
    content = content.replace(/Universal Flight Phase Resolver \(Outbound vs Return\)/g, 'Classifies a flight as outbound or return based on trip airports');
    
    content = content.replace(/Precision Crisp Radii/g, 'Radii');
    content = content.replace(/Glassmorphism & Shadows/g, 'Shadows');
    content = content.replace(/Glassmorphism and Shadows/g, 'Shadows');
    content = content.replace(/PPC: Delay No More — Aero Precision SaaS Design System/g, 'Base design tokens');

    content = content.replace(/PPC: Delay No More — (.*)/g, (match, p1) => {
        let text = p1;
        text = text.replace(/Commercial /g, '');
        text = text.replace(/\(iOS SF Pro Style\)/g, '');
        text = text.replace(/\(iOS Native Flighty Style\)/g, '');
        text = text.replace(/Professional Clean /g, '');
        text = text.replace(/Apple Flighty Slate /g, '');
        text = text.replace(/SaaS Design System/g, '');
        text = text.replace(/Aero Precision /g, '');
        text = text.trim();
        if (text === 'Main Entry Point') text = 'Main entry point';
        if (text === 'Animations') text = 'Animations';
        if (text.endsWith(' Screen')) {
            text = text.replace(' Screen', ' screen');
        }
        return text;
    });

    content = content.replace(/[ \t]*Aero Precision Dark Slate Aesthetic.*\n/g, '');
    content = content.replace(/iOS Native Flighty SF Pro Stack/g, 'Stack');
    content = content.replace(/SOTA Fix:/g, 'Fix:');
    content = content.replace(/SOTA Legend Header/g, 'Legend Header');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
    }
});
