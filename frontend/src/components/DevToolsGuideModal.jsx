import React, { useState } from 'react'
import { X, Chrome, Compass, Globe, Server, Copy, Check, ExternalLink, HelpCircle, ShieldAlert, Key } from 'lucide-react'

export default function DevToolsGuideModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('chrome')
  const [copiedKey, setCopiedKey] = useState(null)

  if (!isOpen) return null

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          width: '94%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(96, 165, 250, 0.15)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Key size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                How to Extract <code style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>sessionid</code> Cookie
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Step-by-step developer tools extraction for all browsers & remote environments
              </p>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Why HttpOnly notice */}
        <div
          style={{
            margin: '16px 24px 0 24px',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.8rem',
            color: '#fbbf24'
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Why DevTools?</strong> Instagram tags the <code style={{ color: '#fff' }}>sessionid</code> cookie as <code>HttpOnly</code>. Browser extensions and regular webpage scripts cannot read it automatically, so DevTools or our automated browser window is used.
          </span>
        </div>

        {/* Browser Selector Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '12px 24px 0 24px',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto'
          }}
        >
          <button
            className={`btn ${activeTab === 'chrome' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('chrome')}
          >
            <Chrome size={15} /> Chrome / Brave / Edge
          </button>
          <button
            className={`btn ${activeTab === 'firefox' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('firefox')}
          >
            <Globe size={15} /> Firefox
          </button>
          <button
            className={`btn ${activeTab === 'safari' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('safari')}
          >
            <Compass size={15} /> Safari
          </button>
          <button
            className={`btn ${activeTab === 'remote' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setActiveTab('remote')}
          >
            <Server size={15} /> LXC / Remote VPS
          </button>
        </div>

        {/* Tab Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'chrome' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="guide-step">
                <div className="guide-step-num">1</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Open Instagram & Log In</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Open <a href="https://www.instagram.com" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>instagram.com</a> in your Chrome, Brave, Chromium, or Microsoft Edge browser and make sure you are logged into your account.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">2</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Open Developer Tools</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Press <kbd className="guide-kbd">F12</kbd> (or <kbd className="guide-kbd">Ctrl</kbd> + <kbd className="guide-kbd">Shift</kbd> + <kbd className="guide-kbd">I</kbd> on Windows/Linux, <kbd className="guide-kbd">Cmd</kbd> + <kbd className="guide-kbd">Option</kbd> + <kbd className="guide-kbd">I</kbd> on macOS).
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">3</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Navigate to Cookies Storage</h4>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    In the DevTools top navigation bar, select the <strong>Application</strong> tab (if hidden, click the <code style={{ color: '#60a5fa' }}>&gt;&gt;</code> overflow button).
                  </p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    In the left sidebar under <strong>Storage</strong> ➔ expand <strong>Cookies</strong> ➔ click <code style={{ color: '#60a5fa' }}>https://www.instagram.com</code>.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">4</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Copy the <code style={{ color: '#60a5fa' }}>sessionid</code> Value</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Find <strong>sessionid</strong> in the Cookie name column. Double-click the <strong>Value</strong> column and copy the full alphanumeric string.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'firefox' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="guide-step">
                <div className="guide-step-num">1</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Open Instagram & Log In</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Open <a href="https://www.instagram.com" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>instagram.com</a> in Firefox.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">2</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Open Storage Inspector</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Press <kbd className="guide-kbd">F12</kbd> (or <kbd className="guide-kbd">Shift</kbd> + <kbd className="guide-kbd">F9</kbd>). Click the <strong>Storage</strong> tab in the inspector panel.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">3</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Locate & Copy Cookie</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Expand <strong>Cookies</strong> ➔ <code style={{ color: '#60a5fa' }}>https://www.instagram.com</code>. Click on <strong>sessionid</strong> and copy its value.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'safari' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="guide-step">
                <div className="guide-step-num">1</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Enable Developer Menu</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Go to <strong>Safari</strong> ➔ <strong>Settings...</strong> ➔ <strong>Advanced</strong> ➔ check <strong>"Show Develop menu in menu bar"</strong>.
                  </p>
                </div>
              </div>

              <div className="guide-step">
                <div className="guide-step-num">2</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)' }}>Inspect Storage</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    On instagram.com, press <kbd className="guide-kbd">Cmd</kbd> + <kbd className="guide-kbd">Option</kbd> + <kbd className="guide-kbd">I</kbd>, navigate to the <strong>Storage</strong> tab ➔ <strong>Cookies</strong> ➔ <strong>sessionid</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'remote' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#60a5fa', fontWeight: 600 }}>
                  <Server size={16} /> Proxmox LXC & Headless Server Best Practice
                </div>
                When ZenGram is installed inside an LXC or remote VPS without a local desktop display:
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Open your regular desktop web browser (on your Mac, Windows PC, or laptop).</li>
                  <li>Log into Instagram and extract your <code style={{ color: '#60a5fa' }}>sessionid</code> using the Chrome or Firefox steps above.</li>
                  <li>Open your ZenGram web interface (e.g. <code style={{ color: '#60a5fa' }}>http://&lt;lxc-ip&gt;:8484</code>).</li>
                  <li>Paste the cookie into the <strong>Instagram Session Cookie</strong> field and click <strong>Save Session Cookie</strong>.</li>
                  <li>ZenGram on the remote server will immediately begin using that session for all downloads!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end'
          }}
        >
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '8px 20px' }}>
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  )
}
