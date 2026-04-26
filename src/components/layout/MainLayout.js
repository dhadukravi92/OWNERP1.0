import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { getAppBrandLogoUrl, getErpNameParts } from '../../utils/branding';
import { formatMainMenuShortcut, getAccessibleModules, getMainMenuShortcutMap } from '../../utils/modules';
import { getVisibleHelpArticles, searchHelpArticles } from '../../utils/helpContent';
import {
  Sun, Moon, LogOut, Zap, ChevronLeft, ChevronRight,
  AlertTriangle, HelpCircle, Search, X
} from 'lucide-react';

function getMainMenuHotkeySignature(event) {
  if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return '';
  return `CTRL+ALT+${`${event.key || ''}`.toUpperCase()}`;
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, theme, toggleTheme, notifications, loadNotifications, dashboardStats, loadDashboardStats, settings } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [activeHelpId, setActiveHelpId] = useState('');

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const logoUrl = getAppBrandLogoUrl();
  const erpNameParts = getErpNameParts(settings);
  const navItems = getAccessibleModules(currentUser, settings);
  const shortcutMap = useMemo(() => getMainMenuShortcutMap(settings), [settings]);
  const navItemsWithHotkeys = useMemo(
    () => navItems.map((item, index) => ({
      ...item,
      hotkeyToken: shortcutMap[item.id] || '',
      hotkey: formatMainMenuShortcut(shortcutMap[item.id] || '')
    })),
    [navItems, shortcutMap]
  );
  const navHotkeyMap = useMemo(
    () => Object.fromEntries(
      navItemsWithHotkeys
        .filter((item) => item.hotkeyToken)
        .map((item) => [`CTRL+ALT+${item.hotkeyToken}`, item.path])
    ),
    [navItemsWithHotkeys]
  );
  const visibleHelpArticles = useMemo(
    () => getVisibleHelpArticles(currentUser, settings),
    [currentUser, settings]
  );
  const filteredHelpArticles = useMemo(
    () => searchHelpArticles(helpQuery, visibleHelpArticles),
    [helpQuery, visibleHelpArticles]
  );
  const activeHelpArticle = useMemo(() => {
    return filteredHelpArticles.find((article) => article.id === activeHelpId)
      || filteredHelpArticles[0]
      || visibleHelpArticles[0]
      || null;
  }, [activeHelpId, filteredHelpArticles, visibleHelpArticles]);

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [logoUrl]);

  useEffect(() => {
    if (filteredHelpArticles.length && !filteredHelpArticles.some((article) => article.id === activeHelpId)) {
      setActiveHelpId(filteredHelpArticles[0].id);
    }
  }, [filteredHelpArticles, activeHelpId]);

  useEffect(() => {
    if (!visibleHelpArticles.length) {
      setActiveHelpId('');
      return;
    }

    if (!visibleHelpArticles.some((article) => article.id === activeHelpId)) {
      setActiveHelpId(visibleHelpArticles[0].id);
    }
  }, [activeHelpId, visibleHelpArticles]);

  useEffect(() => {
    loadNotifications();
    loadDashboardStats();
    const interval = setInterval(() => {
      loadNotifications();
      loadDashboardStats();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMainMenuHotkey = (event) => {
      if (event.key === 'F1') {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.defaultPrevented || event.isComposing) return;
      const targetPath = navHotkeyMap[getMainMenuHotkeySignature(event)];
      if (!targetPath) return;
      event.preventDefault();
      event.stopPropagation();
      navigate(targetPath);
    };

    window.addEventListener('keydown', handleMainMenuHotkey);
    return () => window.removeEventListener('keydown', handleMainMenuHotkey);
  }, [navigate, navHotkeyMap]);

  useEffect(() => {
    if (!helpOpen) return;

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setHelpOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [helpOpen]);

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 60 : 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Logo */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 16px' : '0 16px',
          borderBottom: '1px solid var(--border)',
          gap: 10, flexShrink: 0,
          justifyContent: collapsed ? 'center' : 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {logoUrl && !logoLoadFailed ? (
              <img
                src={logoUrl}
                alt="Company logo"
                onError={() => setLogoLoadFailed(true)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  flexShrink: 0,
                  objectFit: 'contain',
                  padding: 3,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)'
                }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, var(--accent), #0050ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Zap size={18} color="#fff" strokeWidth={2.5} />
              </div>
            )}
            {!collapsed && (
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
                {erpNameParts.primary}
                {erpNameParts.accent && <span style={{ color: 'var(--accent)' }}>{erpNameParts.accent}</span>}
              </span>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 4 }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '8px', display: 'flex', justifyContent: 'center',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItemsWithHotkeys.map(item => {
            const active = isActive(item);
            const isAlerts = item.path === '/notifications';
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={collapsed ? `${item.label}${item.hotkey ? ` (${item.hotkey})` : ''}` : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  fontFamily: 'var(--font-main)',
                  transition: 'all 0.15s ease',
                  width: '100%',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  position: 'relative',
                  textAlign: 'left'
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <item.icon size={17} />
                  {isAlerts && unreadCount > 0 && !collapsed && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4,
                      background: 'var(--danger)', color: '#fff',
                      fontSize: 9, fontWeight: 700, minWidth: 14, height: 14,
                      borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 3px'
                    }}>{unreadCount}</span>
                  )}
                </div>
                {!collapsed && (
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ minWidth: 0 }}>{item.label}</span>
                    {item.hotkey ? (
                      <span
                        style={{
                          flexShrink: 0,
                          minWidth: 76,
                          textAlign: 'right',
                          fontSize: 10,
                          color: active ? 'var(--accent)' : 'var(--text-muted)',
                          letterSpacing: 0.4,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.hotkey}
                      </span>
                    ) : null}
                  </div>
                )}
                {!collapsed && isAlerts && unreadCount > 0 && (
                  <span style={{
                    background: 'var(--danger)', color: '#fff',
                    fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                    borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
                  }}>{unreadCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Low stock warning */}
        {dashboardStats.lowStockItems > 0 && !collapsed && (
          <div style={{
            margin: '8px', padding: '10px 12px',
            background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start'
          }}>
            <AlertTriangle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)' }}>Low Stock Alert</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {dashboardStats.lowStockItems} item{dashboardStats.lowStockItems > 1 ? 's' : ''} below minimum
              </div>
            </div>
          </div>
        )}

        {/* User section */}
        <div style={{
          padding: collapsed ? '12px 8px' : '12px',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)', fontWeight: 700, fontSize: 13
              }}>
                {currentUser?.full_name?.[0] || 'A'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, truncate: true, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {currentUser?.full_name || currentUser?.username}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {currentUser?.role}
                </div>
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 4, justifyContent: collapsed ? 'center' : 'flex-end' }}>
            <button
              onClick={() => setHelpOpen(true)}
              className="btn btn-secondary btn-icon btn-sm"
              title="Help"
            >
              <HelpCircle size={14} />
            </button>
            <button onClick={toggleTheme} className="btn btn-secondary btn-icon btn-sm" title="Toggle theme">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={logout} className="btn btn-danger btn-icon btn-sm" title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

      {helpOpen && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 15, 30, 0.34)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: 24
          }}
        >
          <div
            style={{
              width: 'min(1180px, 96vw)',
              height: 'min(780px, 92vh)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 22,
              boxShadow: '0 28px 80px rgba(16, 24, 40, 0.24)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: 'auto 1fr'
            }}
          >
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16
              }}
            >
              <div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Help Center
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  Search OWNERP Help
                </div>
                <div className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
                  Search topics, modules, forms, backup setup, and operating instructions. Press <span className="font-mono">F1</span> anytime.
                </div>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="btn btn-secondary btn-icon"
                title="Close help"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', minHeight: 0 }}>
              <div
                style={{
                  borderRight: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  background: 'linear-gradient(180deg, rgba(41, 98, 255, 0.05), rgba(41, 98, 255, 0.01))'
                }}
              >
                <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: '10px 12px'
                    }}
                  >
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      autoFocus
                      value={helpQuery}
                      onChange={(event) => setHelpQuery(event.target.value)}
                      placeholder="Search modules, forms, setup, backup..."
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        fontFamily: 'var(--font-main)'
                      }}
                    />
                  </div>
                  <div className="text-secondary" style={{ fontSize: 12, marginTop: 10 }}>
                    {filteredHelpArticles.length} topic{filteredHelpArticles.length === 1 ? '' : 's'} found
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredHelpArticles.length ? filteredHelpArticles.map((article) => {
                    const active = article.id === activeHelpArticle?.id;
                    return (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => setActiveHelpId(article.id)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent-dim)' : 'var(--bg-primary)',
                          padding: '14px 14px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {article.section}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {article.title}
                        </div>
                        <div
                          className="text-secondary"
                          style={{
                            fontSize: 12,
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {article.content}
                        </div>
                      </button>
                    );
                  }) : (
                    <div style={{ padding: 18, color: 'var(--text-secondary)', fontSize: 13 }}>
                      No help topics matched your search. Try module names like `Accounting`, `Inventory`, `Backup`, `Google Drive`, or `Users`.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ minHeight: 0, overflowY: 'auto', padding: 24 }}>
                {activeHelpArticle ? (
                  <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 8 }}>
                        {activeHelpArticle.section}
                      </div>
                      <h2 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em' }}>
                        {activeHelpArticle.title}
                      </h2>
                    </div>

                    <div
                      style={{
                        padding: 18,
                        borderRadius: 18,
                        border: '1px solid var(--border)',
                        background: 'linear-gradient(180deg, rgba(41, 98, 255, 0.05), rgba(41, 98, 255, 0.015))',
                        fontSize: 15,
                        lineHeight: 1.75,
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {activeHelpArticle.content}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(activeHelpArticle.tags || []).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setHelpQuery(tag)}
                          className="btn btn-secondary btn-sm"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-secondary" style={{ fontSize: 14 }}>
                    Select a help topic from the left.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
