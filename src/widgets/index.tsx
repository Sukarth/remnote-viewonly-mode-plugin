import { declareIndexPlugin, type ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';

const VIEW_ONLY_CSS = `
/* View-only mode styles - Updated with correct RemNote selectors */
.view-only-mode [contenteditable="true"] {
  pointer-events: none !important;
  user-select: text !important;
}

.view-only-mode [contenteditable] {
  pointer-events: none !important;
  user-select: text !important;
}

/* Target RemNote's editor specifically */
.view-only-mode .hierarchy-editor__line {
  pointer-events: none !important;
}

.view-only-mode .rem-text {
  pointer-events: none !important;
}

.view-only-mode .rem-bullet {
  pointer-events: none !important;
}

.view-only-mode .TreeNode {
  pointer-events: none !important;
}

.view-only-mode .rn-editor {
  pointer-events: none !important;
}

.view-only-mode .EditorContainer {
  pointer-events: none !important;
}

/* Broader selectors for any missed elements */
.view-only-mode [data-slate-editor="true"] {
  pointer-events: none !important;
  user-select: text !important;
}

.view-only-mode .slate-editor {
  pointer-events: none !important;
  user-select: text !important;
}

/* Target any input-like elements */
.view-only-mode input, 
.view-only-mode textarea,
.view-only-mode [role="textbox"] {
  pointer-events: none !important;
  user-select: text !important;
}

/* Allow text selection but prevent editing interactions */
.view-only-mode * {
  cursor: default !important;
}

.view-only-mode {
  user-select: text !important;
}

/* View-only indicator */
.view-only-indicator {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  background: rgba(220, 38, 38, 0.95) !important;
  color: white !important;
  padding: 12px 16px !important;
  border-radius: 8px !important;
  font-weight: bold !important;
  font-size: 14px !important;
  z-index: 999999 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  border: 2px solid rgba(220, 38, 38, 0.8) !important;
  animation: viewOnlyPulse 2s infinite !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

@keyframes viewOnlyPulse {
  0%, 100% { opacity: 0.9; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}
`;

let isViewOnlyMode = false;
let styleElement: HTMLStyleElement | null = null;
let indicatorElement: HTMLElement | null = null;
let keydownHandler: ((event: KeyboardEvent) => void) | null = null;

// More comprehensive list of editing selectors
const EDITING_SELECTORS = [
  '[contenteditable="true"]',
  '[contenteditable]',
  '[data-slate-editor="true"]',
  '.slate-editor',
  '.hierarchy-editor__line',
  '.rem-text',
  '.TreeNode',
  '.rn-editor',
  '.EditorContainer',
  'input',
  'textarea',
  '[role="textbox"]'
];

function injectViewOnlyStyles() {
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'view-only-mode-styles';
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
  if (indicatorElement) return;
  
  indicatorElement = document.createElement('div');
  indicatorElement.className = 'view-only-indicator';
  indicatorElement.innerHTML = '🔒 VIEW-ONLY MODE ACTIVE';
  indicatorElement.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: rgba(220, 38, 38, 0.95) !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    font-weight: bold !important;
    font-size: 14px !important;
    z-index: 999999 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    backdrop-filter: blur(8px) !important;
    border: 2px solid rgba(220, 38, 38, 0.8) !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    cursor: default !important;
    user-select: none !important;
    pointer-events: none !important;
  `;
  
  document.body.appendChild(indicatorElement);
}

function removeViewOnlyIndicator() {
  if (indicatorElement) {
    indicatorElement.remove();
    indicatorElement = null;
  }
}

function disableContentEditable() {
  // Find and disable all contenteditable elements
  const editableElements = document.querySelectorAll('[contenteditable="true"]');
  editableElements.forEach(element => {
    element.setAttribute('data-original-contenteditable', 'true');
    element.setAttribute('contenteditable', 'false');
  });
}

function enableContentEditable() {
  // Re-enable contenteditable elements
  const elements = document.querySelectorAll('[data-original-contenteditable="true"]');
  elements.forEach(element => {
    element.setAttribute('contenteditable', 'true');
    element.removeAttribute('data-original-contenteditable');
  });
}

function preventEditingShortcuts(event: KeyboardEvent) {
  // Allow navigation and reading shortcuts
  const allowedShortcuts = [
    event.ctrlKey && event.key === 'c', // Copy
    event.ctrlKey && event.key === 'a', // Select All
    event.ctrlKey && event.key === 'f', // Find
    event.ctrlKey && event.key === 'h', // Find and Replace
    event.key === 'F3', // Find Next
    event.key === 'Escape', // Escape
    event.key.startsWith('Arrow'), // Arrow keys for navigation
    event.key === 'Home' || event.key === 'End', // Home/End
    event.key === 'PageUp' || event.key === 'PageDown', // Page navigation
    event.ctrlKey && (event.key === 'Home' || event.key === 'End'), // Ctrl+Home/End
  ];

  // If it's an allowed shortcut, let it through
  if (allowedShortcuts.some(Boolean)) {
    return;
  }

  // Block all other keyboard input
  const blockingKeys = [
    'Backspace', 'Delete', 'Enter', 'Tab',
    'Insert', 'Space'
  ];

  const blockingShortcuts = [
    event.ctrlKey && (event.key === 'z' || event.key === 'y'), // Undo/Redo
    event.ctrlKey && (event.key === 'x' || event.key === 'v'), // Cut/Paste
    event.ctrlKey && event.shiftKey && event.key === 'Z', // Redo alternative
    event.altKey, // Block Alt combinations
    event.metaKey && event.key !== 'c' && event.key !== 'a' && event.key !== 'f', // Block Cmd combinations except allowed
  ];

  // Block typing (letters, numbers, symbols)
  const isTyping = event.key.length === 1 && !event.ctrlKey && !event.metaKey;
  
  if (isTyping || blockingKeys.includes(event.key) || blockingShortcuts.some(Boolean)) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
}

function enableViewOnlyMode() {
  if (isViewOnlyMode) return;
  
  console.log('Enabling view-only mode...');
  isViewOnlyMode = true;
  
  // Apply styles
  injectViewOnlyStyles();
  document.body.classList.add('view-only-mode');
  
  // Create visual indicator
  createViewOnlyIndicator();
  
  // Disable contenteditable
  disableContentEditable();
  
  // Add keyboard event listener with high priority
  keydownHandler = preventEditingShortcuts;
  document.addEventListener('keydown', keydownHandler, { capture: true, passive: false });
  document.addEventListener('keypress', keydownHandler, { capture: true, passive: false });
  document.addEventListener('input', keydownHandler, { capture: true, passive: false });
  
  // Also block mouse events that could trigger editing
  const blockMouseEvents = (event: Event) => {
    const target = event.target as Element;
    if (target && EDITING_SELECTORS.some(selector => target.matches && target.matches(selector))) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  
  document.addEventListener('mousedown', blockMouseEvents, { capture: true });
  document.addEventListener('mouseup', blockMouseEvents, { capture: true });
  document.addEventListener('click', blockMouseEvents, { capture: true });
  document.addEventListener('dblclick', blockMouseEvents, { capture: true });
  
  console.log('View-only mode enabled successfully');
}

function disableViewOnlyMode() {
  if (!isViewOnlyMode) return;
  
  console.log('Disabling view-only mode...');
  isViewOnlyMode = false;
  
  // Remove styles and classes
  removeViewOnlyStyles();
  removeViewOnlyIndicator();
  document.body.classList.remove('view-only-mode');
  
  // Re-enable contenteditable
  enableContentEditable();
  
  // Remove event listeners
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler, { capture: true } as any);
    document.removeEventListener('keypress', keydownHandler, { capture: true } as any);
    document.removeEventListener('input', keydownHandler, { capture: true } as any);
    keydownHandler = null;
  }
  
  // Remove mouse event blocking (this is trickier, but styles should handle it)
  
  console.log('View-only mode disabled successfully');
}

function toggleViewOnlyMode() {
  console.log('Toggling view-only mode. Current state:', isViewOnlyMode);
  if (isViewOnlyMode) {
    disableViewOnlyMode();
  } else {
    enableViewOnlyMode();
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  console.log('View-Only Mode plugin activating...');
  
  // Register settings
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
  await plugin.app.toast('View-Only Mode plugin loaded! Click the sidebar widget or use Ctrl+Shift+P → "Toggle View-Only Mode"', { 
    type: 'info',
    durationMs: 5000 
  });

  // Restore state if setting is enabled
  const rememberState = await plugin.settings.getSetting('remember-state');
  if (rememberState) {
    const savedState = localStorage.getItem('viewonly-mode-state');
    if (savedState === 'enabled') {
      enableViewOnlyMode();
    }
  }
  
  console.log('View-Only Mode plugin activated successfully');
}

async function onDeactivate(_: ReactRNPlugin) {
  console.log('View-Only Mode plugin deactivating...');
  disableViewOnlyMode();
}

// Export functions for widget use
(window as any).toggleViewOnlyMode = toggleViewOnlyMode;
(window as any).isViewOnlyModeActive = () => isViewOnlyMode;

declareIndexPlugin(onActivate, onDeactivate);