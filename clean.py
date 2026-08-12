import os
import re

dir_path = '.'

for root, dirs, files in os.walk(dir_path):
    if 'node_modules' in root or '.git' in root:
        continue
    for file in files:
        if file.endswith('.js') or file.endswith('.css') or file == 'index.html':
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()

            # HTML title
            content = content.replace('<title>PPC: Delay No More — Commercial Group Flight Tracker</title>', '<title>PPC: Delay No More</title>')

            # Function comments
            content = content.replace('Universal Time-Based Dynamic Flight Status Resolver', 'Returns computed flight status based on current time vs departure/arrival')
            content = content.replace('Universal Flight Phase Resolver (Outbound vs Return)', 'Classifies a flight as outbound or return based on trip airports')

            # CSS Comments
            content = content.replace('Precision Crisp Radii', 'Radii')
            content = content.replace('Glassmorphism & Shadows', 'Shadows')
            content = content.replace('Glassmorphism and Shadows', 'Shadows')
            
            # File headers & other modifiers
            content = content.replace('PPC: Delay No More — Aero Precision SaaS Design System', 'Base design tokens')
            
            # General file header cleanups: PPC: Delay No More — <Something>
            def clean_header(match):
                text = match.group(1)
                # Remove fluff
                fluff = [
                    'Commercial ',
                    '(iOS SF Pro Style)',
                    '(iOS Native Flighty Style)',
                    'Professional Clean ',
                    'Apple Flighty Slate ',
                    'SaaS Design System',
                    'Aero Precision '
                ]
                for f in fluff:
                    text = text.replace(f, '')
                text = text.strip()
                if text == 'Main Entry Point': text = 'Main entry point'
                if text == 'Animations': text = 'Animations'
                return text

            content = re.sub(r'PPC: Delay No More — (.*)', clean_header, content)
            
            # More specific fluff removals
            content = re.sub(r'\s*Aero Precision Dark Slate Aesthetic.*', '', content)
            content = re.sub(r'iOS Native Flighty SF Pro Stack', 'Stack', content)
            content = re.sub(r'SOTA Fix:', 'Fix:', content)
            content = re.sub(r'SOTA Legend Header', 'Legend Header', content)

            with open(filepath, 'w') as f:
                f.write(content)
