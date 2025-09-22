import React, { useState, useEffect } from 'react';
import { renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';

function ViewOnlyWidget() {
  const plugin = usePlugin();
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [rememberState, setRememberState] = useState(false);

  useEffect(() => {
    // Get initial settings
    const loadSettings = async () => {
      const shortcuts = await plugin.settings.getSetting('show-shortcuts');
      const remember = await plugin.settings.getSetting('remember-state');
      setShowShortcuts(typeof shortcuts === 'boolean' ? shortcuts : true);
      setRememberState(typeof remember === 'boolean' ? remember : false);
    };

    loadSettings();

    // Poll for view-only state changes (since we can't easily listen to the global state)
    const checkState = () => {
      const currentState = (window as any).isViewOnlyModeActive?.() || false;
      setIsViewOnly(currentState);
    };

    checkState();
    const interval = setInterval(checkState, 500);

    return () => clearInterval(interval);
  }, [plugin]);

  const handleToggle = async () => {
    try {
      (window as any).toggleViewOnlyMode?.();
      const newState = (window as any).isViewOnlyModeActive?.() || false;
      setIsViewOnly(newState);

      // Save state if remember setting is enabled
      if (rememberState) {
        localStorage.setItem(
          'viewonly-mode-state',
          newState ? 'enabled' : 'disabled'
        );
      }

      const status = newState ? 'enabled' : 'disabled';
      await plugin.app.toast(`View-only mode ${status}`);
    } catch (error) {
      console.error('Error toggling view-only mode:', error);
      await plugin.app.toast('Error toggling view-only mode');
    }
  };

  const handleSettingChange = async (setting: string, value: boolean) => {
    try {
      (plugin.settings as any).setSetting(setting, value);

      if (setting === 'show-shortcuts') {
        setShowShortcuts(value);
      } else if (setting === 'remember-state') {
        setRememberState(value);
        if (!value) {
          // Clear saved state if remember is disabled
          localStorage.removeItem('viewonly-mode-state');
        }
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: isViewOnly ? '#ef4444' : '#10b981',
    color: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  const containerStyle: React.CSSProperties = {
    padding: '16px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px',
  };

  const checkboxStyle: React.CSSProperties = {
    marginRight: '8px',
  };

  const shortcutStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '8px',
    borderRadius: '4px',
    marginTop: '12px',
  };

  const statusStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '6px 12px',
    borderRadius: '12px',
    marginTop: '12px',
    textAlign: 'center' as const,
    fontWeight: '500',
    backgroundColor: isViewOnly ? '#fef2f2' : '#f0f9ff',
    color: isViewOnly ? '#dc2626' : '#1d4ed8',
    border: `1px solid ${isViewOnly ? '#fca5a5' : '#93c5fd'}`,
  };

  return (
    <div style={containerStyle}>
      <div style={sectionStyle}>
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
          }}
        >
          👁️ View-Only Mode
        </h3>

        <button
          onClick={handleToggle}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          }}
        >
          {isViewOnly ? '✖ Disable View-Only' : '🔒 Enable View-Only'}
        </button>

        <div style={statusStyle}>
          Status: {isViewOnly ? 'Protected' : 'Editable'}
        </div>
      </div>

      <div style={sectionStyle}>
        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={rememberState}
            onChange={(e) =>
              handleSettingChange('remember-state', e.target.checked)
            }
            style={checkboxStyle}
          />
          Remember state between sessions
        </label>

        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={showShortcuts}
            onChange={(e) =>
              handleSettingChange('show-shortcuts', e.target.checked)
            }
            style={checkboxStyle}
          />
          Show keyboard shortcuts
        </label>
      </div>

      {showShortcuts && (
        <div style={shortcutStyle}>
          <strong>Quick Commands:</strong>
          <br />• Press <code>Ctrl+Shift+P</code> → type "view-only"
          <br />• Quick code: Type <code>/vo</code> in editor
          <br />• Use this widget to toggle
        </div>
      )}

      <div
        style={{
          fontSize: '11px',
          color: '#9ca3af',
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#f9fafb',
          borderRadius: '4px',
          border: '1px solid #e5e7eb',
        }}
      >
        <strong>What does view-only mode do?</strong>
        <br />
        • Prevents accidental edits
        <br />
        • Blocks keyboard shortcuts that modify content
        <br />
        • Still allows copying, scrolling, and searching
        <br />• Shows a visual indicator when active
      </div>
    </div>
  );
}

renderWidget(ViewOnlyWidget);

export default ViewOnlyWidget;
