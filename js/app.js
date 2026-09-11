import { featuresRouter } from './features/featuresRouter.js';
import { initHomeController } from './home/homeController.js';
import { initRecentProjects } from './home/recentProjects.js';
import { initTemplatesShelf } from './home/templatesShelf.js';
import { initHeaderBar } from './workspace/headerBar.js';
import { initPreviewCanvas } from './workspace/previewCanvas.js';
import { initPreviewHud } from './workspace/previewHud.js';
import { initMediaLibrary } from './workspace/mediaLibrary.js';
import { initPlaybackControls } from './workspace/playbackControls.js';
import { initTimelineEngine } from './workspace/timelineEngine.js';
import { initTimelinePlayhead } from './workspace/timelinePlayhead.js';
import { injectQuickLayerButtons } from './layers/layersManager.js';
import { initKeyframeEngine } from './features/keyframeEngine.js';

import * as featureModules from './features/index.js';

const appState = {
  page: 'dashboard',
  project: null,
  history: [],
  media: [],
  timeline: { visual: [], audio: [] },
  configurations: {}
};

const elements = {
  dashboard: document.querySelector('#dashboard-page'),
  workspace: document.querySelector('#workspace-page'),
  newProject: document.querySelector('#new-project-btn'),
  workspaceBack: document.querySelector('#workspace-back'),
  featureShelf: document.querySelector('#feature-shelf'),
  featureTitle: document.querySelector('#feature-level-title'),
  featureBack: document.querySelector('#feature-back-btn')
};

let preview;
let previewHud;
let timeline;
let timelinePlayhead;

function showPage(page) {
  appState.page = page;
  elements.dashboard.classList.toggle('is-current', page === 'dashboard');
  elements.workspace.classList.toggle('is-current', page === 'workspace');
}

function createProject() {
  appState.project = { id: crypto.randomUUID(), name: 'Untitled Project', createdAt: Date.now() };
  appState.media = [];
  appState.timeline.visual = [];
  appState.timeline.audio = [];
  if (preview) preview.clear();
  const previewAudio = document.querySelector('#preview-audio');
  previewAudio.pause();
  previewAudio.removeAttribute('src');
  previewAudio.load();
  if (timeline) timeline.render();
  if (timelinePlayhead) timelinePlayhead.setProgress(0, 0);
  if (previewHud) previewHud.refresh();
  showPage('workspace');
}

function registerFeatures() {
  for (const [key, module] of Object.entries(featureModules)) {
    if (module && module.featureKey) {
      featuresRouter.registerFeature(module.featureKey, module);
    }
  }
}

async function bootstrap() {
  initHomeController({ onNewProject: createProject });
  initRecentProjects(document.querySelector('#recent-projects-grid'));
  initTemplatesShelf(document.querySelector('#templates-shelf'));
  initHeaderBar({ exportButton: document.querySelector('#export-btn') });

  preview = initPreviewCanvas({
    canvas: document.querySelector('#preview-canvas'),
    video: document.querySelector('#preview-video'),
    empty: document.querySelector('#preview-empty')
  });

  // 🆕 Global keyframe engine — runs during any playback
  initKeyframeEngine({
    video: document.querySelector('#preview-video')
  });

  previewHud = initPreviewHud({
    wrap: document.querySelector('#preview-canvas-wrap'),
    video: document.querySelector('#preview-video')
  });

  const previewVideo = document.querySelector('#preview-video');
  const previewAudio = document.querySelector('#preview-audio');

  initMediaLibrary({
    button: document.querySelector('#media-picker-btn'),
    input: document.querySelector('#media-file-input'),
    onMedia: function (items) {
      appState.media.push.apply(appState.media, items);
      let visual = null;
      let audio = null;
      for (let i = 0; i < items.length; i++) {
        if (!visual && (items[i].type.indexOf('video/') === 0 || items[i].type.indexOf('image/') === 0)) {
          visual = items[i];
        }
        if (!audio && items[i].type.indexOf('audio/') === 0) {
          audio = items[i];
        }
      }
      if (visual) preview.setMedia(visual);
      if (audio) {
        previewAudio.src = audio.url;
        previewAudio.load();
      }
      timeline.addMedia(items);
      if (previewHud) previewHud.refresh();
    }
  });

  timeline = initTimelineEngine({
    viewport: document.querySelector('#timeline-viewport'),
    visual: document.querySelector('#visual-tracks'),
    audio: document.querySelector('#audio-tracks'),
    state: appState.timeline,
    onVisualVisibility: function (label, visible) {
      if (label === 'V1') preview.setVisible(visible);
    },
    onAudioMute: function (label, muted) {
      if (label === 'A1') previewAudio.muted = muted;
    },
    onDeleteSelected: function (clip) {
      appState.media = appState.media.filter(function (item) { return item.url !== clip.url; });
      if (clip.type && clip.type.indexOf('audio/') === 0) {
        previewAudio.pause();
        previewAudio.removeAttribute('src');
        previewAudio.load();
      } else {
        preview.clear();
      }
      if (previewHud) previewHud.refresh();
    },
    getPlayheadTime: function () {
      const v = document.querySelector('#preview-video');
      return v && Number.isFinite(v.currentTime) ? v.currentTime : 0;
    },
    zoomSlider: document.querySelector('#zoom-slider')
  });

  injectQuickLayerButtons(
    document.querySelector('#control-bar'),
    {
      onAddVisual: function () { timeline.addVisualLayer(); },
      onAddAudio:  function () { timeline.addAudioLayer();  }
    }
  );

  timelinePlayhead = initTimelinePlayhead({
    element: document.querySelector('#timeline-playhead'),
    matrix: document.querySelector('#timeline-matrix'),
    viewport: document.querySelector('#timeline-viewport'),
    video: previewVideo,
    timeDisplay: document.querySelector('#timeline-time'),
    getZoomFactor: function () { return timeline && timeline.zoomFactor ? timeline.zoomFactor : 1; },
    getRulerContainer: function () { return document.querySelector('.timeline-ruler'); }
  });

  initPlaybackControls({
    play: document.querySelector('#play-btn'),
    deleteButton: document.querySelector('#delete-btn'),
    undo: document.querySelector('#undo-btn'),
    redo: document.querySelector('#redo-btn'),
    video: previewVideo,
    audio: previewAudio,
    onTimeUpdate: function (time, duration) {
      if (timelinePlayhead) timelinePlayhead.setProgress(time, duration);
    }
  });

  registerFeatures();
  featuresRouter.init({
    shelf: elements.featureShelf,
    title: elements.featureTitle,
    backButton: elements.featureBack
  });

  elements.workspaceBack.addEventListener('click', function () {
    showPage('dashboard');
  });
  showPage('dashboard');
}

bootstrap();
export { appState, showPage, createProject };