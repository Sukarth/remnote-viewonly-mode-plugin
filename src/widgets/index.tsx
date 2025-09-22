import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

const VIEW_ONLY_CSS = `
/* View-only mode styles */
.view-only-mode .rn-editor {
  pointer-events: none;
  user-select: text;
}

.view-only-mode .rn-editor [contenteditable] {
  pointer-events: none;
}

.view-only-mode .hierarchy-editor__line {
  pointer-events: none;
}

.view-only-mode .EditorContainer {
  pointer-events: none;
}

.view-only-mode .rem-text {
  pointer-events: none;
}

.view-only-mode .rem-bullet {
  pointer-events: none;
}

.view-only-mode .TreeNode {
  pointer-events: none;
}

.view-only-mode .TreeNode .TreeNode__bullet {
  pointer-events: none;
}

.view-only-mode .TreeNode .TreeNode__content {
  pointer-events: none;
}

/* Allow scrolling and selection */
.view-only-mode {
  user-select: text;
}

.view-only-mode * {
  cursor: default !important;
}

/* View-only indicator */
.view-only-indicator {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(255, 0, 0, 0.1);
  border: 2px solid #ff4444;
  color: #ff4444;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 14px;
  z-index: 10000;
  backdrop-filter: blur(4px);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
`;

let isViewOnlyMode = false;
let styleElement: HTMLStyleElement | null = null;
let indicatorElement: HTMLElement | null = null;

function injectViewOnlyStyles() {
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.textContent = VIEW_ONLY_CSS;
    document.head.appendChild(styleElement);
  }
}

function removeViewOnlyStyles() {
  if (styleElement) {
    styleElement.remove();
    styleElement = null;
  }
}

function createViewOnlyIndicator() {
  indicatorElement = document.createElement('div');
  indicatorElement.className = 'view-only-indicator';
  indicatorElement.textContent = '👁️ VIEW-ONLY MODE';
  document.body.appendChild(indicatorElement);
}

function removeViewOnlyIndicator() {
  if (indicatorElement) {
    indicatorElement.remove();
    indicatorElement = null;
  }
}

function enableViewOnlyMode() {
  if (isViewOnlyMode) return;
  
  isViewOnlyMode = true;
  injectViewOnlyStyles();
  createViewOnlyIndicator();
  document.body.classList.add('view-only-mode');
  
  // Disable keyboard shortcuts that could modify content
  document.addEventListener('keydown', preventEditingShortcuts, true);
}

function disableViewOnlyMode() {
  if (!isViewOnlyMode) return;
  
  isViewOnlyMode = false;
  removeViewOnlyStyles();
  removeViewOnlyIndicator();
  document.body.classList.remove('view-only-mode');
  
  document.removeEventListener('keydown', preventEditingShortcuts, true);
}

function preventEditingShortcuts(event: KeyboardEvent) {
  // Block common editing shortcuts
  const editingKeys = [
    'Backspace', 'Delete', 'Enter', 'Tab',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
  ];
  
  const editingShortcuts = [
    event.ctrlKey && (event.key === 'z' || event.key === 'y'), // Undo/Redo
    event.ctrlKey && (event.key === 'x' || event.key === 'v'), // Cut/Paste
    event.ctrlKey && event.key === 'a', // Select All (allow this)
    event.ctrlKey && event.key === 'c', // Copy (allow this)
    event.ctrlKey && event.key === 'f', // Find (allow this)
  ];
  
  // Allow copy, select all, and find
  if (event.ctrlKey && (event.key === 'a' || event.key === 'c' || event.key === 'f')) {
    return;
  }
  
  // Block other editing keys and shortcuts
  if (editingKeys.includes(event.key) || editingShortcuts.some(Boolean)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function toggleViewOnlyMode() {
  if (isViewOnlyMode) {
    disableViewOnlyMode();
  } else {
    enableViewOnlyMode();
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  // Register setting to remember view-only state
  await plugin.settings.registerBooleanSetting({
    id: 'remember-state',
    title: 'Remember view-only state between sessions',
    defaultValue: false,
  });

  await plugin.settings.registerBooleanSetting({
    id: 'show-shortcuts',
    title: 'Show keyboard shortcuts in widget',
    defaultValue: true,
  });

  // Register commands
  await plugin.app.registerCommand({
    id: 'toggle-view-only',
    name: 'Toggle View-Only Mode',
    quickCode: 'vo',
    description: 'Enable or disable view-only mode to prevent accidental edits',
    action: async () => {
      toggleViewOnlyMode();
      const status = isViewOnlyMode ? 'enabled' : 'disabled';
      await plugin.app.toast(`View-only mode ${status}`, { type: 'success' });
    },
  });

  await plugin.app.registerCommand({
    id: 'enable-view-only',
    name: 'Enable View-Only Mode',
    description: 'Enable view-only mode to prevent edits',
    action: async () => {
      if (!isViewOnlyMode) {
        enableViewOnlyMode();
        await plugin.app.toast('View-only mode enabled', { type: 'success' });
      }
    },
  });

  await plugin.app.registerCommand({
    id: 'disable-view-only',
    name: 'Disable View-Only Mode',
    description: 'Disable view-only mode to allow edits',
    action: async () => {
      if (isViewOnlyMode) {
        disableViewOnlyMode();
        await plugin.app.toast('View-only mode disabled', { type: 'success' });
      }
    },
  });

  // Register sidebar widget
  await plugin.app.registerWidget('view_only_widget', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
  });

  // Show activation message
  await plugin.app.toast('View-Only Mode plugin loaded! Use Ctrl+Shift+P and search "view-only" or check the sidebar.', { 
    type: 'info',
    durationMs: 4000 
  });

  // Restore state if setting is enabled
  const rememberState = await plugin.settings.getSetting('remember-state');
  if (rememberState) {
    const savedState = localStorage.getItem('viewonly-mode-state');
    if (savedState === 'enabled') {
      enableViewOnlyMode();
    }
  }
}

async function onDeactivate(_: ReactRNPlugin) {
  // Clean up when plugin is deactivated
  disableViewOnlyMode();
}

// Export the toggle function for use in the widget
window.toggleViewOnlyMode = toggleViewOnlyMode;
window.isViewOnlyModeActive = () => isViewOnlyMode;

declareIndexPlugin(onActivate, onDeactivate);