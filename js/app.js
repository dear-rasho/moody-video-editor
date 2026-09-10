import { featuresRouter } from './features/featuresRouter.js';
import { initHomeController } from './home/homeController.js';
import { initRecentProjects } from './home/recentProjects.js';
import { initTemplatesShelf } from './home/templatesShelf.js';
import { initHeaderBar } from './workspace/headerBar.js';
import { initPreviewCanvas } from './workspace/previewCanvas.js';
import { initMediaLibrary } from './workspace/mediaLibrary.js';
import { initPlaybackControls } from './workspace/playbackControls.js';
import { initTimelineEngine } from './workspace/timelineEngine.js';
import { initTimelinePlayhead } from './workspace/timelinePlayhead.js';

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
  preview?.clear();
  const previewAudio = document.querySelector('#preview-audio');
  previewAudio.pause();
  previewAudio.removeAttribute('src');
  previewAudio.load();
  timeline?.render();
  timelinePlayhead?.setProgress(0, 0);
  showPage('workspace');
}

function registerFeatures() {
  for (const [key, module] of Object.entries(featureModules)) {
    if (module?.featureKey) featuresRouter.registerFeature(module.featureKey, module);
  }
}

async function bootstrap() {
  initHomeController({ onNewProject: createProject });
  initRecentProjects(document.querySelector('#recent-projects-grid'));
  initTemplatesShelf(document.querySelector('#templates-shelf'));
  initHeaderBar({ exportButton: document.querySelector('#export-btn') });
  preview = initPreviewCanvas({ canvas: document.querySelector('#preview-canvas'), video: document.querySelector('#preview-video'), empty: document.querySelector('#preview-empty') });
  initMediaLibrary({
    button: document.querySelector('#media-picker-btn'),
    input: document.querySelector('#media-file-input'),
    onMedia: items => {
      appState.media.push(...items);
      const visual = items.find(item => item.type.startsWith('video/') || item.type.startsWith('image/'));
      const audio = items.find(item => item.type.startsWith('audio/'));
      if (visual) preview.setMedia(visual);
      if (audio) {
        previewAudio.src = audio.url;
        previewAudio.load();
      }
      timeline.addMedia(items);
    }
  });
  const previewVideo = document.querySelector('#preview-video');
  const previewAudio = document.querySelector('#preview-audio');
  timeline = initTimelineEngine({
    viewport: document.querySelector('#timeline-viewport'),
    visual: document.querySelector('#visual-tracks'),
    audio: document.querySelector('#audio-tracks'),
    state: appState.timeline,
    onVisualVisibility: (label, visible) => { if (label === 'V1') preview.setVisible(visible); },
    onAudioMute: (label, muted) => { if (label === 'A1') previewAudio.muted = muted; },
    onDeleteSelected: clip => {
      appState.media = appState.media.filter(item => item.url !== clip.url);
      if (clip.type?.startsWith('audio/')) {
        previewAudio.pause();
        previewAudio.removeAttribute('src');
        previewAudio.load();
      } else {
        preview.clear();
      }
    }
  });
 timelinePlayhead = initTimelinePlayhead({
  element: document.querySelector('#timeline-playhead'),
  matrix: document.querySelector('#timeline-matrix'),
  viewport: document.querySelector('#timeline-viewport'),
  video: previewVideo,
  timeDisplay: document.querySelector('#timeline-time'),
  getZoomFactor: () => timeline?.zoomFactor || 1,  // 🆕 zoom factor
  getRulerContainer: () => document.querySelector('.timeline-ruler') // 🆕 ruler
});
  initPlaybackControls({ play: document.querySelector('#play-btn'), deleteButton: document.querySelector('#delete-btn'), undo: document.querySelector('#undo-btn'), redo: document.querySelector('#redo-btn'), video: previewVideo, audio: previewAudio, onTimeUpdate: (time, duration) => timelinePlayhead.setProgress(time, duration) });

  registerFeatures();
  featuresRouter.init({ shelf: elements.featureShelf, title: elements.featureTitle, backButton: elements.featureBack });

  elements.workspaceBack.addEventListener('click', () => showPage('dashboard'));
  showPage('dashboard');
}

bootstrap();
export { appState, showPage, createProject };
