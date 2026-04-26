import { create } from 'zustand';
import db from '../utils/database';
import { getNextSequence, sanitizeCurrencySymbol } from '../utils/database';

export const useAppStore = create((set, get) => ({
  // Auth
  currentUser: null,
  isAuthenticated: false,
  
  login: async (username, password) => {
    try {
      const user = await db.get(
        'SELECT * FROM users WHERE username = ? AND password = ? AND is_active = 1',
        [username, password]
      );
      if (user) {
        await db.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);
        set({ currentUser: user, isAuthenticated: true });
        return { success: true, user };
      }
      return { success: false, error: 'Invalid credentials' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  resetPasswordWithEmail: async (username, email, nextPassword) => {
    try {
      const normalizedUsername = `${username || ''}`.trim();
      const normalizedEmail = `${email || ''}`.trim().toLowerCase();
      const normalizedPassword = `${nextPassword || ''}`;

      if (!normalizedUsername || !normalizedEmail || !normalizedPassword) {
        return { success: false, error: 'Username, email, and new password are required.' };
      }

      const user = await db.get(
        `SELECT id
         FROM users
         WHERE username = ?
           AND LOWER(COALESCE(NULLIF(password_reset_email, ''), email, '')) = ?
           AND is_active = 1`,
        [normalizedUsername, normalizedEmail]
      );

      if (!user?.id) {
        return { success: false, error: 'No active account matched that username and email.' };
      }

      await db.run(
        "UPDATE users SET password = ? WHERE id = ?",
        [normalizedPassword, user.id]
      );

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
  
  logout: () => set({ currentUser: null, isAuthenticated: false }),

  // Settings
  settings: {},
  loadSettings: async () => {
    const rows = await db.all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = r.key === 'currency_symbol' ? sanitizeCurrencySymbol(r.value) : r.value;
    });
    set({ settings });
  },
  
  updateSetting: async (key, value) => {
    const nextValue = key === 'currency_symbol' ? sanitizeCurrencySymbol(value) : value;
    await db.run("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))", [key, nextValue]);
    set((state) => ({ settings: { ...state.settings, [key]: nextValue } }));
  },
  
  // Notifications
  notifications: [],
  loadNotifications: async () => {
    const currentUserId = get().currentUser?.id || null;
    const notifs = await db.all(
      `SELECT *
       FROM notifications
       WHERE assigned_to IS NULL OR assigned_to = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [currentUserId]
    );
    set({ notifications: notifs });
  },
  
  addNotification: async (type, title, message, refId = null, refType = null, assignedTo = null) => {
    const id = 'notif_' + Date.now();
    await db.run(
      `INSERT INTO notifications (id, type, title, message, reference_id, reference_type, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, type, title, message, refId, refType, assignedTo]
    );
    await get().loadNotifications();
  },
  
  markNotificationRead: async (id) => {
    await db.run(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND (assigned_to IS NULL OR assigned_to = ?)',
      [id, get().currentUser?.id || null]
    );
    await get().loadNotifications();
  },
  
  // Theme
  theme: localStorage.getItem('theme') || 'dark',
  toggleTheme: () => {
    set(state => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      return { theme: newTheme };
    });
  },
  
  // Active module
  activeModule: 'dashboard',
  setActiveModule: (module) => set({ activeModule: module }),
  
  // Dashboard stats
  dashboardStats: {
    totalProducts: 0,
    lowStockItems: 0,
    pendingOrders: 0,
    pendingQuotations: 0,
    totalCustomers: 0,
    totalVendors: 0,
    monthlyRevenue: 0,
  },
  
  loadDashboardStats: async () => {
    try {
      const [products, lowStock, orders, quotations, customers, vendors] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM products WHERE is_active = 1'),
        db.get('SELECT COUNT(*) as count FROM inventory i JOIN products p ON i.product_id = p.id WHERE i.quantity <= p.min_stock'),
        db.get("SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'in_production')"),
        db.get("SELECT COUNT(*) as count FROM quotations WHERE status IN ('draft', 'sent')"),
        db.get("SELECT COUNT(*) as count FROM contacts WHERE type = 'customer' AND is_active = 1"),
        db.get("SELECT COUNT(*) as count FROM contacts WHERE type = 'vendor' AND is_active = 1"),
      ]);
      
      set({
        dashboardStats: {
          totalProducts: products?.count || 0,
          lowStockItems: lowStock?.count || 0,
          pendingOrders: orders?.count || 0,
          pendingQuotations: quotations?.count || 0,
          totalCustomers: customers?.count || 0,
          totalVendors: vendors?.count || 0,
        }
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  },

  // CRM Module State
  crmStats: {
    totalInquiries: 0,
    newLeads: 0,
    activeLeads: 0,
    pendingFollowups: 0,
    pendingQuotations: 0,
    wonDeals: 0,
    monthlyRevenue: 0,
  },

  loadCrmStats: async () => {
    try {
      const [inquiries, newLeads, activeLeads, followups, quotations, wonDeals] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM crm_inquiries WHERE status = "new"'),
        db.get('SELECT COUNT(*) as count FROM crm_leads WHERE status = "new"'),
        db.get("SELECT COUNT(*) as count FROM crm_leads WHERE status IN ('contacted', 'qualified', 'proposal', 'negotiation')"),
        db.get("SELECT COUNT(*) as count FROM crm_followups WHERE actual_date IS NULL AND scheduled_date <= datetime('now')"),
        db.get("SELECT COUNT(*) as count FROM crm_quotations WHERE status IN ('draft', 'sent')"),
        db.get("SELECT COUNT(*) as count FROM crm_leads WHERE status = 'closed_won'"),
      ]);

      set({
        crmStats: {
          totalInquiries: inquiries?.count || 0,
          newLeads: newLeads?.count || 0,
          activeLeads: activeLeads?.count || 0,
          pendingFollowups: followups?.count || 0,
          pendingQuotations: quotations?.count || 0,
          wonDeals: wonDeals?.count || 0,
        }
      });
    } catch (err) {
      console.error('Error loading CRM stats:', err);
    }
  },

  // CRM Inquiries
  createInquiry: async (inquiryData) => {
    try {
      const id = 'inq_' + Date.now();
      const inquiryNumber = await getNextSequence('crm_inquiries', 'inquiry_number', 'INQ');
      await db.run(`
        INSERT INTO crm_inquiries (id, inquiry_number, source, customer_name, company, email, phone, 
          product_interest, quantity, requirements, priority, assigned_to, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [id, inquiryNumber, inquiryData.source, inquiryData.customer_name, inquiryData.company,
          inquiryData.email, inquiryData.phone, inquiryData.product_interest, inquiryData.quantity,
          inquiryData.requirements, inquiryData.priority, inquiryData.assigned_to]);

      await get().addNotification('info', 'New Inquiry', `Inquiry ${inquiryNumber} created`, id, 'inquiry');
      return { success: true, id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CRM Leads
  createLead: async (leadData) => {
    try {
      const id = 'lead_' + Date.now();
      const leadNumber = await getNextSequence('crm_leads', 'lead_number', 'LEAD');
      await db.run(`
        INSERT INTO crm_leads (id, lead_number, inquiry_id, customer_id, status, value, probability,
          expected_close_date, industry, lead_source, notes, assigned_to, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [id, leadNumber, leadData.inquiry_id, leadData.customer_id, leadData.status, leadData.value,
          leadData.probability, leadData.expected_close_date, leadData.industry, leadData.lead_source,
          leadData.notes, leadData.assigned_to, get().currentUser?.id]);

      // Log activity
      await db.run(`
        INSERT INTO crm_activities (id, lead_id, activity_type, description, created_by)
        VALUES (?, ?, ?, ?, ?)
      `, ['act_' + Date.now(), id, 'created', 'Lead created', get().currentUser?.id]);

      await get().addNotification('info', 'New Lead', `Lead ${leadNumber} created`, id, 'lead');
      return { success: true, id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CRM Followups
  scheduleFollowup: async (followupData) => {
    try {
      const id = 'follow_' + Date.now();
      await db.run(`
        INSERT INTO crm_followups (id, lead_id, followup_type, scheduled_date, notes, next_followup_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, followupData.lead_id, followupData.followup_type, followupData.scheduled_date,
          followupData.notes, followupData.next_followup_date, get().currentUser?.id]);

      // Create alert for followup
      await db.run(`
        INSERT INTO crm_alerts (id, type, title, message, scheduled_date, lead_id, followup_id, assigned_to, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['alert_' + Date.now(), 'followup', 'Follow-up Reminder', `Follow-up scheduled for ${followupData.scheduled_date}`,
          followupData.scheduled_date, followupData.lead_id, id, followupData.assigned_to || get().currentUser?.id, get().currentUser?.id]);

      return { success: true, id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CRM Quotations
  createCrmQuotation: async (quotationData) => {
    try {
      const id = 'crm_quote_' + Date.now();
      const quotationNumber = await getNextSequence('crm_quotations', 'quotation_number', 'CRM-Q');
      await db.run(`
        INSERT INTO crm_quotations (id, quotation_number, lead_id, customer_id, status, valid_till,
          discount_percent, tax_amount, total_amount, notes, terms, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [id, quotationNumber, quotationData.lead_id, quotationData.customer_id, quotationData.status,
          quotationData.valid_till, quotationData.discount_percent, quotationData.tax_amount,
          quotationData.total_amount, quotationData.notes, quotationData.terms, get().currentUser?.id]);

      // Add quotation items
      for (const item of quotationData.items || []) {
        await db.run(`
          INSERT INTO crm_quotation_items (id, quotation_id, product_id, description, quantity,
            unit_price, discount_percent, tax_rate, total, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['item_' + Date.now(), id, item.product_id, item.description, item.quantity,
            item.unit_price, item.discount_percent, item.tax_rate, item.total, item.sort_order]);
      }

      // Log activity
      await db.run(`
        INSERT INTO crm_activities (id, lead_id, activity_type, description, created_by)
        VALUES (?, ?, ?, ?, ?)
      `, ['act_' + Date.now(), quotationData.lead_id, 'quotation_created', `Quotation ${quotationNumber} created`, get().currentUser?.id]);

      return { success: true, id, quotationNumber };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // CRM Alerts
  loadCrmAlerts: async () => {
    try {
      const alerts = await db.all(`
        SELECT a.*, l.lead_number, f.scheduled_date as followup_date
        FROM crm_alerts a
        LEFT JOIN crm_leads l ON a.lead_id = l.id
        LEFT JOIN crm_followups f ON a.followup_id = f.id
        WHERE a.is_active = 1 AND a.is_completed = 0
        ORDER BY a.scheduled_date ASC
      `);
      return alerts;
    } catch (err) {
      console.error('Error loading CRM alerts:', err);
      return [];
    }
  },

  completeAlert: async (alertId) => {
    try {
      await db.run(`
        UPDATE crm_alerts 
        SET is_completed = 1, completed_at = datetime('now')
        WHERE id = ?
      `, [alertId]);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // IndiaMART Integration
  indiamartSettings: {},
  loadIndiamartSettings: async () => {
    try {
      const settings = await db.get('SELECT * FROM crm_indiamart_settings WHERE id = "default"');
      set({ indiamartSettings: settings || {} });
    } catch (err) {
      console.error('Error loading IndiaMART settings:', err);
    }
  },

  updateIndiamartSettings: async (settings) => {
    try {
      await db.run(`
        INSERT OR REPLACE INTO crm_indiamart_settings (id, api_key, api_secret, is_active, sync_interval, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, ['default', settings.api_key, settings.api_secret, settings.is_active ? 1 : 0, settings.sync_interval]);
      
      await get().loadIndiamartSettings();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  syncIndiamartInquiries: async () => {
    // This would integrate with IndiaMART API
    // For now, return mock data
    try {
      // Mock IndiaMART API call
      const mockInquiries = [
        {
          customer_name: 'Rajesh Kumar',
          company: 'ABC Industries',
          email: 'rajesh@abc.com',
          phone: '+91-9876543210',
          product_interest: 'Control Panels',
          quantity: 5,
          requirements: 'Custom control panels for automation'
        }
      ];

      for (const inquiry of mockInquiries) {
        await get().createInquiry({
          ...inquiry,
          source: 'indiamart'
        });
      }

      return { success: true, synced: mockInquiries.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}));
