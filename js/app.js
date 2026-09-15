// ================================================================
//  js/app.js — Master bootstrap
//  Wires: preview, playback, timeline, effects, keyframes,
//         transitions, audio FX, magnet, ratio control.
// ================================================================

import { initTextRenderer } from './workspace/textRenderer.js';
import { featuresRouter } from './features/featuresRouter.js';
import { initHomeController, initCodebaseShelf, initAiPromptHelper } from './home/homeController.js';
import { initRecentProjects } from './home/recentProjects.js';
import { initTemplatesShelf } from './home/templatesShelf.js';
import { initHeaderBar } from './workspace/headerBar.js';
import { initPreviewCanvas } from './workspace/previewCanvas.js';
import { initPreviewHud } from './workspace/previewHud.js';
import { initMediaLibrary } from './workspace/mediaLibrary.js';
import { initPlaybackControls } from './workspace/playbackControls.js';
import { initTimelineEngine } from './workspace/timelineEngine.js';
import { initTimelinePlayhead } from './workspace/timelinePlayhead.js';
import { initPlaybackEngine } from './workspace/playbackEngine.js';
import { injectQuickLayerButtons } from './layers/layersManager.js';
import { initKeyframeEngine } from './features/keyframeEngine.js';
import { initHistory } from './workspace/historyManager.js';
import { openExportPanel } from './features/export.js';
import { initEffectRenderer } from './workspace/effectRenderer.js';
import { initAudioFxRenderer } from './workspace/audioFxRenderer.js';
import { initLayerDrag } from './workspace/layerDrag.js';
import { initRatioControl } from './workspace/ratioControl.js';
import { initKeyframeUI, clearKeyframeSelection, getSelectedKeyframe } from './workspace/keyframeUI.js';
import { initMagnetTool } from './workspace/magnetTool.js';
import { initTransitionMarkers } from './workspace/transitionMarkers.js';
import * as keyframeStore from './workspace/keyframeStore.js';
import * as featureModules from './features/index.js';
import { initPromptUI } from './codebase/promptUI.js';

// ═══════════════════════════════════════════════════════════════
//  APP STATE
// ═══════════════════════════════════════════════════════════════
const appState = {
  page: 'dashboard',
  project: null,
  history: [],
  media: [],
  timeline: {
    visual: [],       // Array of tracks. Each track is array of clips.
    audio: [],        // Same shape.
    hiddenVisualTracks: new Set(),
    mutedAudioTracks: new Set()
  },
  configurations: {}
};

window.__appState = appState;

// ═══════════════════════════════════════════════════════════════
//  DOM REFERENCES
// ═══════════════════════════════════════════════════════════════
const elements = {
  dashboard: document.querySelector('#dashboard-page'),
  workspace: document.querySelector('#workspace-page'),
  newProject: document.querySelector('#new-project-btn'),
  workspaceBack: document.querySelector('#workspace-back'),
  featureShelf: document.querySelector('#feature-shelf'),
  featureTitle: document.querySelector('#feature-level-title'),
  featureBack: document.querySelector('#feature-back-btn')
};

let preview = null;
let previewHud = null;
let timeline = null;
let timelinePlayhead = null;
let playbackEngine = null;

// ═══════════════════════════════════════════════════════════════
//  PAGE NAVIGATION
// ═══════════════════════════════════════════════════════════════
function showPage(page) {
  appState.page = page;
  elements.dashboard.classList.toggle('is-current', page === 'dashboard');
  elements.workspace.classList.toggle('is-current', page === 'workspace');
}

// ═══════════════════════════════════════════════════════════════
//  🆕 CODE BASE EDITOR
//  Phase 1: sirf console log + toast
//  (Phase 2 mein prompt panel open hoga)
// ═══════════════════════════════════════════════════════════════
function openCodeEditor(mode) {
  console.log('[Code Editor] Opening with mode:', mode || 'new');

  // Create project in code mode
  createProject('code');

  // 🆕 If 'examples' mode, pre-fill input (future)
  // For now, both modes open the same editor
}
// ═══════════════════════════════════════════════════════════════
//  CREATE NEW PROJECT
// ═══════════════════════════════════════════════════════════════
function createProject(mode) {
  appState.project = {
    id: crypto.randomUUID(),
    name: mode === 'code' ? 'Code Project' : 'Untitled Project',
    createdAt: Date.now()
  };
  appState.media = [];
  appState.timeline.visual = [];
  appState.timeline.audio = [];
  appState.timeline.hiddenVisualTracks = new Set();
  appState.timeline.mutedAudioTracks = new Set();

  if (preview) preview.clear();
  const previewAudio = document.querySelector('#preview-audio');
  previewAudio.pause();
  previewAudio.removeAttribute('src');
  previewAudio.load();

  if (timeline) timeline.render();
  if (playbackEngine) playbackEngine.seek(0);
  if (previewHud) previewHud.refresh();

  // 🆕 Set editor mode
  setEditorMode(mode || 'feature');

  document.dispatchEvent(new CustomEvent('editor:timeline-changed'));
  showPage('workspace');
}

// ═══════════════════════════════════════════════════════════════
//  🆕 EDITOR MODE TOGGLE (feature ⇄ code)
// ═══════════════════════════════════════════════════════════════
function setEditorMode(mode) {
  appState.mode = mode;
  if (!elements.workspace) return;
  elements.workspace.classList.toggle('mode-code', mode === 'code');
  elements.workspace.classList.toggle('mode-feature', mode !== 'code');
}

// ═══════════════════════════════════════════════════════════════
//  REGISTER FEATURES
// ═══════════════════════════════════════════════════════════════
function registerFeatures() {
  for (const [key, module] of Object.entries(featureModules)) {
    if (module && module.featureKey) {
      featuresRouter.registerFeature(module.featureKey, module);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════
async function bootstrap() {

  initHomeController({
    onNewProject: createProject,
    onCodeEditor: openCodeEditor  // 🆕
  });
  initRecentProjects(document.querySelector('#recent-projects-grid'));
  initTemplatesShelf(document.querySelector('#templates-shelf'));
  initCodebaseShelf(
    document.querySelector('#codebase-shelf'),
    { onOpen: (mode) => openCodeEditor(mode) }  // 🆕
  );
  initAiPromptHelper(); 
  initHeaderBar({ exportButton: document.querySelector('#export-btn') });

  const previewVideo = document.querySelector('#preview-video');
  const previewAudio = document.querySelector('#preview-audio');
  const previewCanvas = document.querySelector('#preview-canvas');

  // ─── Preview canvas ────────────────────────────────────────
  preview = initPreviewCanvas({
    canvas: previewCanvas,
    video: previewVideo,
    empty: document.querySelector('#preview-empty')
  });
  window.__previewCanvasInstance = preview;

  // ─── Keyframe engine (speed + sticker) ─────────────────────
  initKeyframeEngine({ video: previewVideo });

  // ─── HUD (elapsed / total) ─────────────────────────────────
  previewHud = initPreviewHud({
    wrap: document.querySelector('#preview-canvas-wrap'),
    video: previewVideo
  });

  // ─── Playback engine (master clock) ────────────────────────
  playbackEngine = initPlaybackEngine({
    canvas: previewCanvas,
    video: previewVideo,
    audio: previewAudio,
    preview: preview,
    onTick: function (time, duration) {
      if (timelinePlayhead) timelinePlayhead.setProgress(time, duration);
      if (previewHud) previewHud.refresh();
    }
  });
  window.__playbackEngine = playbackEngine;

  // ─── Effect renderer (visual effects, live) ────────────────
  initEffectRenderer();

  // ─── Audio FX renderer (real-time audio routing) ───────────
  initAudioFxRenderer();

  // ─── Media library (import + duration probe) ───────────────
  initMediaLibrary({
    button: document.querySelector('#media-picker-btn'),
    input: document.querySelector('#media-file-input'),
    onMedia: function (items) {
      appState.media.push.apply(appState.media, items);
      let visual = null;
      let audio = null;
      for (let i = 0; i < items.length; i++) {
        if (!visual && (items[i].type.indexOf('video/') === 0 || items[i].type.indexOf('image/') === 0)) visual = items[i];
        if (!audio && items[i].type.indexOf('audio/') === 0) audio = items[i];
      }
      if (visual) preview.setMedia(visual);
      if (audio) {
        previewAudio.src = audio.url;
        previewAudio.load();
      }
      timeline.addMedia(items);
      if (playbackEngine) playbackEngine.redraw();
      if (previewHud) previewHud.refresh();
    }
  });

  // ─── Timeline engine ───────────────────────────────────────
  timeline = initTimelineEngine({
    viewport: document.querySelector('#timeline-viewport'),
    visual: document.querySelector('#visual-tracks'),
    audio: document.querySelector('#audio-tracks'),
    state: appState.timeline,

    onVisualVisibility: function (label, visible) {
      const trackIdx = Number(label.slice(1)) - 1;
      if (!Number.isFinite(trackIdx)) return;
      if (visible) appState.timeline.hiddenVisualTracks.delete(trackIdx);
      else appState.timeline.hiddenVisualTracks.add(trackIdx);
      if (playbackEngine) playbackEngine.redraw();
      document.dispatchEvent(new CustomEvent('effects:refresh'));
    },

    onAudioMute: function (label, muted) {
      const trackIdx = Number(label.slice(1)) - 1;
      if (!Number.isFinite(trackIdx)) return;
      if (muted) appState.timeline.mutedAudioTracks.add(trackIdx);
      else appState.timeline.mutedAudioTracks.delete(trackIdx);
    },

    onDeleteSelected: function (clip, type) {
      if (type === 'audio' || (clip.type && clip.type.indexOf('audio/') === 0)) {
        const curSrc = previewAudio.currentSrc || previewAudio.src || '';
        if (curSrc && clip.url && curSrc.indexOf(clip.url.split('/').pop()) >= 0) {
          previewAudio.pause();
          previewAudio.removeAttribute('src');
          previewAudio.load();
        }
      }
      if (clip.file) {
        appState.media = appState.media.filter(function (item) {
          return item.url !== clip.url;
        });
      }
      if (playbackEngine) playbackEngine.redraw();
      if (previewHud) previewHud.refresh();
    },

    getPlayheadTime: function () {
      return playbackEngine ? playbackEngine.getTime() : 0;
    },
    zoomSlider: document.querySelector('#zoom-slider')
  });

  // ─── Quick layer buttons (V+ / A+) ─────────────────────────
  injectQuickLayerButtons(
    document.querySelector('#control-bar'),
    {
      onAddVisual: function () { timeline.addVisualLayer(); },
      onAddAudio:  function () { timeline.addAudioLayer();  }
    }
  );

  // ─── History (undo/redo) ───────────────────────────────────
  initHistory({
    timeline: appState.timeline,
    undoButton: document.querySelector('#undo-btn'),
    redoButton: document.querySelector('#redo-btn')
  });

  // ─── Playhead (visual) ─────────────────────────────────────
  timelinePlayhead = initTimelinePlayhead({
    element: document.querySelector('#timeline-playhead'),
    matrix: document.querySelector('#timeline-matrix'),
    viewport: document.querySelector('#timeline-viewport'),
    engine: playbackEngine,
    timeDisplay: document.querySelector('#timeline-time'),
    getRulerContainer: function () { return document.querySelector('.timeline-ruler'); }
  });

  // ─── Layer drag (up/down/left/right) ───────────────────────
  initLayerDrag();

  // ─── Playback controls (play/pause/delete) ─────────────────
  initPlaybackControls({
    play: document.querySelector('#play-btn'),
    deleteButton: document.querySelector('#delete-btn'),
    undo: document.querySelector('#undo-btn'),
    redo: document.querySelector('#redo-btn'),
    engine: playbackEngine
  });

  // ─── Ratio control ─────────────────────────────────────────
  initRatioControl(document.querySelector('#ratio-select'));

  // ─── Keyframe store exposed globally ───────────────────────
  window.__keyframeStore = keyframeStore;

  // ─── Keyframe UI (◆ button + markers) ──────────────────────
  initKeyframeUI(document.querySelector('#keyframe-btn'));

  window.__keyframeUI = {
    getSelectedKeyframe: getSelectedKeyframe,
    clearKeyframeSelection: clearKeyframeSelection
  };

  document.addEventListener('keyframe:selected', function (e) {
    window.__selectedKeyframe = e.detail || null;
  });

  // ─── Magnet tool ───────────────────────────────────────────
  initMagnetTool(document.querySelector('#magnet-btn'));

  // ─── Transition markers ────────────────────────────────────
  initTransitionMarkers();

  // ─── Text renderer (multi-layer with keyframe sampling) ────
  initTextRenderer();

  // ─── Register feature modules ──────────────────────────────
  registerFeatures();
  featuresRouter.init({
    shelf: elements.featureShelf,
    title: elements.featureTitle,
    backButton: elements.featureBack
  });

  // 🆕 Prompt UI (Code Mode)
  initPromptUI();
  
    elements.workspaceBack.addEventListener('click', function () {
    // 🆕 Reset mode so next feature project opens normally
    setEditorMode('feature');
    showPage('dashboard');
  });

  const exportBtn = document.querySelector('#export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openExportPanel();
    });
  }

  // ─── Start on dashboard ────────────────────────────────────
  showPage('dashboard');
}

bootstrap();
export { appState, showPage, createProject };