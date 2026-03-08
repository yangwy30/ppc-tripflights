import { searchAirports } from '../data/airports.js';

export function setupAirportAutocomplete(container, placeholder, initialValue = '') {
    container.style.position = 'relative';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        position: relative;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        background: var(--color-surface);
        border: 2px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 8px;
        transition: border-color var(--transition-fast);
        min-height: 48px;
        cursor: text;
    `;

    const chipsContainer = document.createElement('div');
    chipsContainer.style.cssText = `display: flex; flex-wrap: wrap; gap: 6px;`;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.style.cssText = `
        flex: 1;
        min-width: 140px;
        border: none;
        background: transparent;
        outline: none;
        font-size: var(--font-size-md);
        color: var(--color-text);
        padding: 0;
    `;

    const dropdown = document.createElement('ul');
    dropdown.className = 'card';
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        list-style: none;
        padding: 0;
        display: none;
        max-height: 300px;
        overflow-y: auto;
        z-index: 100;
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--color-border-light);
    `;

    wrapper.appendChild(chipsContainer);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    container.appendChild(dropdown);

    wrapper.addEventListener('click', () => input.focus());

    let selectedAirports = new Set();

    if (initialValue) {
        initialValue.split(',').forEach(c => {
            const code = c.trim().toUpperCase();
            if (code) selectedAirports.add(code);
        });
    }

    function renderChips() {
        chipsContainer.innerHTML = '';
        selectedAirports.forEach(code => {
            const chip = document.createElement('div');
            chip.style.cssText = `
                background: var(--color-accent-light);
                color: var(--color-accent);
                font-weight: var(--font-weight-bold);
                padding: 4px 8px;
                border-radius: var(--radius-sm);
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: var(--font-size-sm);
                user-select: none;
            `;
            chip.innerHTML = `✈️ ${code} <span tabindex="0" style="cursor:pointer; opacity:0.6; padding: 0 2px;">&times;</span>`;

            const removeBtn = chip.querySelector('span');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedAirports.delete(code);
                renderChips();
            });
            chipsContainer.appendChild(chip);
        });

        input.placeholder = selectedAirports.size > 0 ? '' : placeholder;
    }

    function addAirports(codes) {
        codes.forEach(c => selectedAirports.add(c));
        renderChips();
        input.value = '';
        dropdown.style.display = 'none';
        input.focus();
    }

    input.addEventListener('input', () => {
        const query = input.value;
        if (query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        const results = searchAirports(query);
        dropdown.innerHTML = '';

        if (results.length === 0) {
            dropdown.innerHTML = `<li style="padding: 12px; color: var(--color-text-secondary); text-align: center;">No airports found for "${query}"</li>`;
            dropdown.style.display = 'block';
            return;
        }

        results.forEach(item => {
            if (item.airports.length > 1) {
                const li = document.createElement('li');
                li.style.cssText = `
                    padding: 12px;
                    border-bottom: 1px solid var(--color-border-light);
                    cursor: pointer;
                    transition: background var(--transition-fast);
                `;
                li.onmouseover = () => li.style.background = 'var(--color-surface-hover)';
                li.onmouseout = () => li.style.background = 'transparent';

                const airportCodes = item.airports.map(a => a.code).join(', ');
                li.innerHTML = `
                    <div style="font-weight: var(--font-weight-bold); color: var(--color-accent);">📍 ${item.city} Area</div>
                    <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Select all airports: ${airportCodes}</div>
                `;
                li.addEventListener('click', () => addAirports(item.airports.map(a => a.code)));
                dropdown.appendChild(li);
            }

            item.airports.forEach(airport => {
                const li = document.createElement('li');
                li.style.cssText = `
                    padding: 12px;
                    border-bottom: 1px solid var(--color-border-light);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background var(--transition-fast);
                `;
                li.onmouseover = () => li.style.background = 'var(--color-surface-hover)';
                li.onmouseout = () => li.style.background = 'transparent';

                li.innerHTML = `
                    <div>
                        <span style="font-weight: var(--font-weight-bold); margin-right: 8px;">✈️ ${airport.code}</span>
                        <span>${airport.name}</span>
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${item.city}</div>
                `;
                li.addEventListener('click', () => addAirports([airport.code]));
                dropdown.appendChild(li);
            });
        });

        dropdown.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && selectedAirports.size > 0) {
            const lastCode = Array.from(selectedAirports).pop();
            selectedAirports.delete(lastCode);
            renderChips();
        }
    });

    renderChips();

    return {
        getValues: () => Array.from(selectedAirports)
    };
}
