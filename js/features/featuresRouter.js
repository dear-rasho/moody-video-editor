// ================================================================
//  js/featuresRouter.js  –  Full Router with Color Wheels Support
// ================================================================

const featureModules = new Map();
let currentView = { level: 0, key: 'root', title: 'Tools', items: [] };
const parentHistory = [];

const state = {
  register(key, module) { featureModules.set(key, module); },
  get(key) { return featureModules.get(key); },
  list() { return [...featureModules.keys()]; }
};

const router = {
  // ─── INIT ──────────────────────────────────────────────────────
  init({ shelf, title, backButton }) {
    this.shelf = shelf;
    this.title = title;
    this.backButton = backButton;
    backButton?.addEventListener('click', () => this.back());
    this.render(currentView);
  },

  // ─── REGISTER ──────────────────────────────────────────────────
  registerFeature(key, module) { state.register(key, module); },

  // ─── NAVIGATION ───────────────────────────────────────────────
  openLevel(key, items = [], options = {}) {
    parentHistory.push(structuredClone(currentView));
    currentView = {
      level: Math.min((currentView.level ?? 0) + 1, options.level ?? 1),
      key,
      title: options.title ?? key,
      items,
      multi: options.multi || false,
      renderMode: options.renderMode || null
    };
    this.render(currentView);
  },

  openLevel2(key, items = [], options = {}) {
    parentHistory.push(structuredClone(currentView));
    currentView = {
      level: 2,
      key,
      title: options.title ?? key,
      items,
      multi: options.multi || false,
      renderMode: options.renderMode || null
    };
    this.render(currentView);
  },

  back() {
    const previous = parentHistory.pop();
    if (!previous) return;
    currentView = previous;
    this.shelf.classList.toggle('circle-shelf', currentView.level === 1);
    this.shelf.style.cssText = '';
    this.render(currentView);
  },

  reset() {
    parentHistory.length = 0;
    currentView = { level: 0, key: 'root', title: 'Tools', items: [] };
    this.render(currentView);
  },

  getState() { return structuredClone(currentView); },

  // ================================================================
  //  RENDER – MAIN DISPATCHER
  // ================================================================
  render(view) {
    if (!this.shelf) return;
    this.title.textContent = view.title;
    this.backButton.hidden = view.level === 0;
    this.shelf.classList.toggle('circle-shelf', view.level === 1);
    this.shelf.style.cssText = '';
    this.shelf.replaceChildren();

 

    // ─── 1. COLOR WHEEL PANEL ──────────────────────────────────
    if (view.renderMode === 'colorwheel') {
      import('./colorWheel.js').then(mod => {
        if (mod.renderTo) mod.renderTo(this.shelf, this.title);
      }).catch((err) => {
        console.error('Color wheel load error:', err);
        this.shelf.textContent = '⚠️ Load failed';
      });
      return;
    }
    // ─── ADJUSTMENTS PANEL ─────────────────────────────────────
    if (view.renderMode === 'adjustmentsPanel') {
      import('./adjustments.js')
        .then(mod => {
          if (mod.renderTo) mod.renderTo(this.shelf, this.title);
        })
        .catch((err) => {
          console.error('Adjustments load error:', err);
          this.shelf.textContent = '⚠️ Load failed';
        });
      return;
    }
    // ─── 2. ADJUSTMENT GRID ────────────────────────────────────
    if (view.level === 2 && view.multi === true && view.renderMode === 'adjustments') {
      this.renderAdjustmentGrid(view);
      return;
    }

    // ─── 3. SINGLE CIRCULAR SLIDER ─────────────────────────────
    if (view.level === 2 && view.items.length >= 1) {
      const control = view.items[0];
      if (control.type === 'circular-slider') {
        this.renderSingleCircularSlider(view, control);
        return;
      }
      if (control.type === 'slider') { this.renderSliderControl(view, control); return; }
      if (control.type === 'color') { this.renderColorControl(view, control); return; }
      if (control.type === 'select') { this.renderSelectControl(view, control); return; }
      if (control.type === 'toggle') { this.renderToggleControl(view, control); return; }
      if (control.type === 'text') { this.renderTextControl(view, control); return; }
    }

    // ─── 4. DEFAULT FEATURE LIST (Level 0 / 1) ─────────────────
    const items = view.items.length ? view.items : state.list().map(key => ({ key, label: key }));
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'feature-item';
      button.dataset.feature = item.key;
      button.innerHTML = `<span class="feature-icon" aria-hidden="true">${item.icon ?? '◆'}</span><span class="feature-label">${item.label ?? item.key}</span>`;
      button.addEventListener('click', () => this.select(item));
      this.shelf.append(button);
    }
  },

  // ================================================================
  //  ADJUSTMENT GRID (multiple circular sliders)
  // ================================================================
  renderAdjustmentGrid(view) {
    const container = document.createElement('div');
    container.className = 'adjustment-grid';
    this.shelf.appendChild(container);

    for (const item of view.items) {
      const def = item._def;
      if (!def) continue;
      const card = this._createKnobCard(def, view.key);
      container.appendChild(card);
    }
  },

  // ================================================================
  //  SINGLE CIRCULAR SLIDER (for level 2)
  // ================================================================
  renderSingleCircularSlider(view, control) {
    const container = this.shelf;
    container.style.cssText = 'display:flex;justify-content:center;align-items:center;padding:20px;';
    const def = {
      key: control.key,
      label: control.label || view.title,
      min: control.min || 0,
      max: control.max || 100,
      default: control.default || 50,
      suffix: control.suffix || '',
      step: control.step || 1
    };
    const card = this._createKnobCard(def, view.key);
    container.appendChild(card);
  },

  // ================================================================
  //  KNOB CARD CREATOR (circular dial)
  // ================================================================
  _createKnobCard(def, viewKey) {
    const key = def.key;
    const min = def.min ?? 0;
    const max = def.max ?? 100;
    const step = def.step ?? 1;
    const defaultVal = def.default ?? 50;
    const suffix = def.suffix ?? '';

    if (!window._filterValues) window._filterValues = {};
    const stored = window._filterValues[key];
    const currentVal = (stored !== undefined && stored !== null) ? stored : defaultVal;

    const card = document.createElement('div');
    card.className = 'adjustment-card';
    card.dataset.adjustmentKey = key;

    // Reset Button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'adjustment-reset';
    resetBtn.type = 'button';
    resetBtn.textContent = '↺';
    resetBtn.setAttribute('aria-label', `Reset ${def.label}`);
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateValue(defaultVal, true);
    });
    card.appendChild(resetBtn);

    // Knob Wrapper
    const knobWrap = document.createElement('div');
    knobWrap.className = 'knob-wrap';
    knobWrap.setAttribute('role', 'slider');
    knobWrap.setAttribute('aria-valuemin', min);
    knobWrap.setAttribute('aria-valuemax', max);
    knobWrap.setAttribute('aria-valuenow', currentVal);
    knobWrap.setAttribute('aria-label', def.label);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.classList.add('knob-svg');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', '50'); bg.setAttribute('cy', '50'); bg.setAttribute('r', '40');
    bg.classList.add('track-bg');

    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fill.setAttribute('cx', '50'); fill.setAttribute('cy', '50'); fill.setAttribute('r', '40');
    fill.classList.add('track-fill');

    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', '50'); center.setAttribute('cy', '50'); center.setAttribute('r', '10');
    center.classList.add('knob-center');

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '50'); dot.setAttribute('cy', '10'); dot.setAttribute('r', '5');
    dot.classList.add('knob-dot');

    svg.append(bg, fill, center, dot);
    knobWrap.appendChild(svg);

    const valDisplay = document.createElement('div');
    valDisplay.className = 'knob-value';
    valDisplay.textContent = Math.round(currentVal) + suffix;
    knobWrap.appendChild(valDisplay);

    // ---- Knob Drag Logic ----
    let isDragging = false;
    const circumference = 2 * Math.PI * 40;

    const valueToAngle = (val) => ((val - min) / (max - min)) * 2 * Math.PI;
    const angleToValue = (angle) => min + (angle / (2 * Math.PI)) * (max - min);

    const getAngle = (e) => {
      const rect = knobWrap.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let angle = Math.atan2(clientY - cy, clientX - cx);
      angle = (angle + Math.PI/2 + 2*Math.PI) % (2*Math.PI);
      return angle;
    };

    const updateKnob = (value, final = false) => {
      const clamped = Math.min(max, Math.max(min, value));
      const rounded = Math.round(clamped / step) * step;
      const finalVal = Math.min(max, Math.max(min, rounded));
      
      knobWrap.setAttribute('aria-valuenow', finalVal);
      const angle = valueToAngle(finalVal);
      const offset = circumference * (1 - angle / (2 * Math.PI));
      fill.style.strokeDasharray = circumference;
      fill.style.strokeDashoffset = offset;
      
      valDisplay.textContent = Math.round(finalVal) + suffix;
      window._filterValues[key] = finalVal;
      
      const numInput = card.querySelector('.adjustment-value-input');
      if (numInput) numInput.value = Math.round(finalVal);
      
      card.classList.toggle('active', finalVal !== defaultVal);
      this.applyAdjustment(key, finalVal, final);
    };

    const handleStart = (e) => {
      e.preventDefault();
      isDragging = true;
      const angle = getAngle(e);
      const val = angleToValue(angle);
      updateKnob(val, false);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    };
    const handleMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const angle = getAngle(e);
      const val = angleToValue(angle);
      updateKnob(val, false);
    };
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const current = window._filterValues[key] ?? defaultVal;
      updateKnob(current, true);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    knobWrap.addEventListener('mousedown', handleStart);
    knobWrap.addEventListener('touchstart', handleStart, { passive: false });
    card.appendChild(knobWrap);

    // ---- Numeric Input ----
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.className = 'adjustment-value-input';
    numInput.value = Math.round(currentVal);
    numInput.min = min; numInput.max = max; numInput.step = step;
    numInput.addEventListener('input', () => {
      let raw = parseFloat(numInput.value);
      if (isNaN(raw)) return;
      const clamped = Math.min(max, Math.max(min, raw));
      const rounded = Math.round(clamped / step) * step;
      const finalVal = Math.min(max, Math.max(min, rounded));
      numInput.value = Math.round(finalVal);
      updateKnob(finalVal, false);
    });
    numInput.addEventListener('change', () => {
      const val = parseFloat(numInput.value);
      if (isNaN(val)) { numInput.value = Math.round(window._filterValues[key] ?? defaultVal); return; }
      const finalVal = Math.min(max, Math.max(min, Math.round(val / step) * step));
      updateKnob(finalVal, true);
    });
    card.appendChild(numInput);

    // ---- Label ----
    const label = document.createElement('div');
    label.className = 'adjustment-label';
    label.textContent = def.label;
    card.appendChild(label);

    // Initial render
    updateKnob(currentVal, false);
    return card;
  },

  // ================================================================
  //  STANDARD CONTROLS (Slider, Color, Select, Toggle, Text)
  //  (Same as original implementation)
  // ================================================================

  renderSliderControl(view, control) {
    if (!window._filterValues) window._filterValues = {};
    const container = this.shelf;
    container.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 4px;overflow-x:auto;';
    const sliderItem = document.createElement('div');
    sliderItem.style.cssText = `display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);flex:0 0 auto;min-width:280px;`;
    const label = document.createElement('span');
    label.textContent = control.label || 'Intensity';
    label.style.cssText = 'font-size:12px;color:var(--muted);min-width:60px;';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = control.min || 0; slider.max = control.max || 100;
    const storedValue = window._filterValues[view.key];
    const initialValue = storedValue !== undefined ? storedValue : (control.default || 50);
    slider.value = initialValue;
    slider.style.cssText = 'flex:1;accent-color:var(--accent);height:4px;min-width:100px;';
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = slider.value + (control.suffix || '');
    valueDisplay.style.cssText = 'font-size:13px;min-width:45px;text-align:right;color:var(--text);';
    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      valueDisplay.textContent = val + (control.suffix || '');
      window._filterValues[view.key] = val;
      this.applyAdjustment(view.key, val);
    });
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✓';
    applyBtn.className = 'action-button primary';
    applyBtn.style.cssText = 'padding:4px 12px;font-size:16px;min-height:32px;';
    applyBtn.addEventListener('click', () => {
      const val = parseInt(slider.value);
      window._filterValues[view.key] = val;
      this.applyAdjustment(view.key, val, true);
    });
    sliderItem.append(label, slider, valueDisplay, applyBtn);
    container.appendChild(sliderItem);
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺ Reset';
    resetBtn.className = 'action-button';
    resetBtn.style.cssText = 'padding:4px 12px;font-size:12px;min-height:32px;flex:0 0 auto;';
    resetBtn.addEventListener('click', () => {
      const defaultVal = control.default || 50;
      slider.value = defaultVal;
      valueDisplay.textContent = defaultVal + (control.suffix || '');
      window._filterValues[view.key] = defaultVal;
      this.applyAdjustment(view.key, defaultVal);
    });
    container.appendChild(resetBtn);
  },

  renderColorControl(view, control) {
    if (!window._filterValues) window._filterValues = {};
    const container = this.shelf;
    container.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 4px;overflow-x:auto;';
    const colorItem = document.createElement('div');
    colorItem.style.cssText = `display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);flex:0 0 auto;min-width:200px;`;
    const label = document.createElement('span');
    label.textContent = control.label || 'Color';
    label.style.cssText = 'font-size:12px;color:var(--muted);min-width:50px;';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    const storedColor = window._filterValues[view.key];
    colorInput.value = storedColor || (control.default || '#ffffff');
    colorInput.style.cssText = 'width:40px;height:40px;border-radius:50%;border:2px solid var(--border);cursor:pointer;background:transparent;';
    const hexDisplay = document.createElement('span');
    hexDisplay.textContent = colorInput.value;
    hexDisplay.style.cssText = 'font-size:12px;color:var(--muted);min-width:70px;';
    colorInput.addEventListener('input', () => {
      hexDisplay.textContent = colorInput.value;
      window._filterValues[view.key] = colorInput.value;
      this.applyTextStyle(view.key, colorInput.value);
    });
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✓';
    applyBtn.className = 'action-button primary';
    applyBtn.style.cssText = 'padding:4px 12px;font-size:16px;min-height:32px;';
    applyBtn.addEventListener('click', () => {
      window._filterValues[view.key] = colorInput.value;
      this.applyTextStyle(view.key, colorInput.value, true);
    });
    colorItem.append(label, colorInput, hexDisplay, applyBtn);
    container.appendChild(colorItem);
  },

  renderSelectControl(view, control) {
    if (!window._filterValues) window._filterValues = {};
    const container = this.shelf;
    container.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 4px;overflow-x:auto;';
    const selectItem = document.createElement('div');
    selectItem.style.cssText = `display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);flex:0 0 auto;min-width:200px;`;
    const label = document.createElement('span');
    label.textContent = control.label || 'Option';
    label.style.cssText = 'font-size:12px;color:var(--muted);min-width:50px;';
    const select = document.createElement('select');
    select.style.cssText = `padding:6px 12px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:13px;cursor:pointer;flex:1;`;
    const storedOption = window._filterValues[view.key];
    const defaultOption = control.default || (control.options ? control.options[0] : '');
    const options = control.options || [];
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt; option.textContent = opt;
      if (opt === (storedOption || defaultOption)) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      window._filterValues[view.key] = select.value;
      this.applyTextStyle(view.key, select.value);
    });
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✓';
    applyBtn.className = 'action-button primary';
    applyBtn.style.cssText = 'padding:4px 12px;font-size:16px;min-height:32px;';
    applyBtn.addEventListener('click', () => {
      window._filterValues[view.key] = select.value;
      this.applyTextStyle(view.key, select.value, true);
    });
    selectItem.append(label, select, applyBtn);
    container.appendChild(selectItem);
  },

  renderToggleControl(view, control) {
    if (!window._filterValues) window._filterValues = {};
    const container = this.shelf;
    container.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 4px;overflow-x:auto;';
    const toggleItem = document.createElement('div');
    toggleItem.style.cssText = `display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);flex:0 0 auto;min-width:160px;`;
    const label = document.createElement('span');
    label.textContent = control.label || 'Toggle';
    label.style.cssText = 'font-size:12px;color:var(--muted);min-width:50px;';
    const toggle = document.createElement('button');
    const storedToggle = window._filterValues[view.key];
    const isOn = storedToggle !== undefined ? storedToggle : (control.default || false);
    toggle.textContent = isOn ? 'ON' : 'OFF';
    toggle.style.cssText = `padding:4px 16px;border-radius:20px;border:2px solid var(--border);background:${isOn ? 'var(--accent)' : 'var(--surface-2)'};color:${isOn ? '#000' : 'var(--muted)'};font-size:13px;font-weight:bold;cursor:pointer;min-width:60px;`;
    toggle.addEventListener('click', () => {
      const current = toggle.textContent === 'ON';
      const newVal = !current;
      toggle.textContent = newVal ? 'ON' : 'OFF';
      toggle.style.background = newVal ? 'var(--accent)' : 'var(--surface-2)';
      toggle.style.color = newVal ? '#000' : 'var(--muted)';
      window._filterValues[view.key] = newVal;
      this.applyTextStyle(view.key, newVal);
    });
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✓';
    applyBtn.className = 'action-button primary';
    applyBtn.style.cssText = 'padding:4px 12px;font-size:16px;min-height:32px;';
    applyBtn.addEventListener('click', () => {
      const val = toggle.textContent === 'ON';
      window._filterValues[view.key] = val;
      this.applyTextStyle(view.key, val, true);
    });
    toggleItem.append(label, toggle, applyBtn);
    container.appendChild(toggleItem);
  },

  renderTextControl(view, control) {
    if (!window._filterValues) window._filterValues = {};
    const container = this.shelf;
    container.style.cssText = 'display:flex;gap:12px;align-items:center;padding:8px 4px;overflow-x:auto;';
    const textItem = document.createElement('div');
    textItem.style.cssText = `display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);flex:0 0 auto;min-width:280px;`;
    const label = document.createElement('span');
    label.textContent = control.label || 'Text';
    label.style.cssText = 'font-size:12px;color:var(--muted);min-width:50px;';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    const storedText = window._filterValues[view.key];
    textInput.value = storedText || (control.default || '');
    textInput.placeholder = control.placeholder || 'Enter text...';
    textInput.style.cssText = `flex:1;padding:6px 12px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:13px;min-width:100px;`;
    textInput.addEventListener('input', () => {
      window._filterValues[view.key] = textInput.value;
      this.applyTextStyle(view.key, textInput.value);
    });
    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✓';
    applyBtn.className = 'action-button primary';
    applyBtn.style.cssText = 'padding:4px 12px;font-size:16px;min-height:32px;';
    applyBtn.addEventListener('click', () => {
      window._filterValues[view.key] = textInput.value;
      this.applyTextStyle(view.key, textInput.value, true);
    });
    textItem.append(label, textInput, applyBtn);
    container.appendChild(textItem);
  },

  // ================================================================
  //  APPLY ADJUSTMENT (Canvas + Pixel-level)
  // ================================================================
  applyAdjustment(key, value, final = false) {
    if (!window._filterValues) window._filterValues = {};
    window._filterValues[key] = value;

    const canvas = document.querySelector('#preview-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = document.querySelector('#preview-video');
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw video frame or existing canvas
    if (video && video.readyState >= 2) {
      tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      tempCtx.drawImage(canvas, 0, 0);
    }

    // CSS Filters (Brightness, Contrast, Saturation)
    const vals = window._filterValues;
    const filterParts = [];
    if (vals.brightness !== undefined) filterParts.push(`brightness(${vals.brightness}%)`);
    if (vals.contrast !== undefined) filterParts.push(`contrast(${vals.contrast}%)`);
    if (vals.saturation !== undefined) filterParts.push(`saturate(${vals.saturation}%)`);

    ctx.filter = filterParts.join(' ') || 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';

    // Pixel Adjustments (Whites, Blacks, Shadows, Clarity, Temp, Colors, Noise)
    this.applyPixelAdjustments(ctx, canvas.width, canvas.height, vals);

    if (final) console.log(`✅ ${key} applied: ${value}`);
  },

  applyPixelAdjustments(ctx, width, height, vals) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const clamp = (v) => Math.max(0, Math.min(255, v));

    const whites = (vals.whites ?? 100) / 100;
    const blacks = (vals.blacks ?? 100) / 100;
    const shadows = (vals.shadows ?? 100) / 100;
    const clarity = (vals.clarity ?? 100) / 100;
    const temp = (vals.temperature ?? 100) / 100;
    const redAdj = (vals.red ?? 100) / 100;
    const yellows = (vals.yellows ?? 100) / 100;
    const greens = (vals.greens ?? 100) / 100;
    const blues = (vals.blues ?? 100) / 100;
    const noise = (vals.noise ?? 0) / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i+1], b = data[i+2];
      const brightness = (r + g + b) / 3;

      // Whites
      if (whites !== 1.0) {
        const f = 1 + (whites - 1) * (brightness / 255);
        r = clamp(r * f); g = clamp(g * f); b = clamp(b * f);
      }
      // Blacks
      if (blacks !== 1.0) {
        const f = 1 + (blacks - 1) * (1 - brightness / 255);
        r = clamp(r * f); g = clamp(g * f); b = clamp(b * f);
      }
      // Shadows
      if (shadows !== 1.0 && brightness < 128) {
        const f = 1 + (shadows - 1) * (1 - brightness / 128);
        r = clamp(r * f); g = clamp(g * f); b = clamp(b * f);
      }
      // Clarity (mid-tone contrast)
      if (clarity !== 1.0) {
        r = clamp(128 + (r - 128) * clarity);
        g = clamp(128 + (g - 128) * clarity);
        b = clamp(128 + (b - 128) * clarity);
      }
      // Temperature
      if (temp !== 1.0) {
        r = clamp(r * (1 + (temp - 1) * 0.3));
        b = clamp(b * (1 - (temp - 1) * 0.3));
      }
      // Reds
      if (redAdj !== 1.0) r = clamp(r * redAdj);
      // Yellows (R+G > B)
      if (yellows !== 1.0 && r > 100 && g > 100 && b < r * 0.7) {
        r = clamp(r * yellows); g = clamp(g * yellows);
      }
      // Greens
      if (greens !== 1.0 && g > 80 && g > r * 0.8 && g > b * 0.8) {
        g = clamp(g * greens);
      }
      // Blues
      if (blues !== 1.0 && b > 80 && b > r * 0.8 && b > g * 0.8) {
        b = clamp(b * blues);
      }
      // Noise
      if (noise > 0) {
        const grain = (Math.random() - 0.5) * noise * 30;
        r = clamp(r + grain); g = clamp(g + grain); b = clamp(b + grain);
      }

      data[i] = r; data[i+1] = g; data[i+2] = b;
    }
    ctx.putImageData(imageData, 0, 0);
  },

  // ================================================================
  //  TEXT STYLE (placeholder)
  // ================================================================
  applyTextStyle(key, value, final = false) {
    console.log(`📝 Text style ${key} set to:`, value);
    if (final) console.log(`✅ Text style ${key} applied:`, value);
  },

  // ================================================================
  //  SELECT ITEM HANDLER
  // ================================================================
  select(item) {
    const module = state.get(item.key);
    if (module?.open) {
      module.open({ router: this, item });
      return;
    }
    if (item.children?.length) {
      if (currentView.level === 1) {
        this.openLevel2(item.key, item.children, { title: item.label || item.key });
      } else {
        this.openLevel(item.key, item.children, { title: item.label || item.key, level: 1 });
      }
    }
  }
};

// ─── EXPORT ─────────────────────────────────────────────────────
export { router as featuresRouter, parentHistory };