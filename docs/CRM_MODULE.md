# CRM Module Documentation

## Overview
The CRM (Customer Relationship Management) module is a comprehensive sales and customer management system integrated into the PanelERP platform. It provides end-to-end customer lifecycle management from initial inquiry to order conversion.

## Features

### 1. Complete Sales Flow
- **Inquiry Management**: Capture leads from multiple sources (IndiaMART, manual entry, website)
- **Lead Qualification**: Convert inquiries to qualified leads with probability tracking
- **Follow-up Scheduling**: Automated and manual follow-up management
- **Quotation Management**: Create, revise, and track quotations with approval workflow
- **Order Conversion**: Seamless conversion from quotations to sales orders

### 2. IndiaMART Integration
- **API Integration**: Connect with IndiaMART platform for automatic inquiry sync
- **Real-time Sync**: Configurable sync intervals (5-1440 minutes)
- **Bulk Import**: Import historical inquiries from IndiaMART
- **Status Mapping**: Automatic status updates between platforms

### 3. Pipeline Management
- **Kanban View**: Visual sales pipeline with drag-and-drop functionality
- **Stage Tracking**: 6-stage pipeline (New → Contacted → Qualified → Proposal → Negotiation → Closed)
- **Probability Scoring**: 0-100% probability tracking for each lead
- **Value Tracking**: Deal value and expected close date management

### 4. Alert System
- **Automated Alerts**: Date-time based reminders for follow-ups and tasks
- **Overdue Notifications**: Highlight overdue activities
- **Priority Levels**: High, medium, low priority alerts
- **Email/SMS Integration**: Future extensibility for notifications

### 5. Quotation Management
- **Revision Tracking**: Full audit trail of quotation changes
- **Approval Workflow**: Multi-level approval process
- **Template System**: Pre-defined quotation templates
- **PDF Generation**: Professional quotation documents

### 6. Role-Based Access Control
- **Admin**: Full access to all CRM features and settings
- **Manager**: Pipeline oversight, reporting, and team management
- **Sales**: Lead management, follow-ups, and quotations
- **Operator**: Limited read-only access

### 7. Dashboard & Analytics
- **Real-time Metrics**: Key performance indicators
- **Pipeline Analytics**: Conversion rates and bottlenecks
- **Revenue Forecasting**: Projected revenue from pipeline
- **Activity Reports**: Team performance and activity logs

## Database Schema

### Core Tables

#### crm_inquiries
```sql
- id (TEXT PRIMARY KEY)
- inquiry_number (TEXT UNIQUE)
- source (TEXT) -- indiamart, manual, website
- customer_name (TEXT)
- company (TEXT)
- email (TEXT)
- phone (TEXT)
- product_interest (TEXT)
- quantity (REAL)
- requirements (TEXT)
- status (TEXT) -- new, contacted, qualified, converted, lost
- priority (TEXT) -- low, medium, high
- assigned_to (TEXT) -- user_id
- created_at (TEXT)
- updated_at (TEXT)
```

#### crm_leads
```sql
- id (TEXT PRIMARY KEY)
- lead_number (TEXT UNIQUE)
- inquiry_id (TEXT)
- customer_id (TEXT)
- status (TEXT) -- new, contacted, qualified, proposal, negotiation, closed_won, closed_lost
- value (REAL)
- probability (INTEGER) -- 0-100
- expected_close_date (TEXT)
- industry (TEXT)
- lead_source (TEXT)
- notes (TEXT)
- assigned_to (TEXT)
- created_by (TEXT)
- created_at (TEXT)
- updated_at (TEXT)
```

#### crm_followups
```sql
- id (TEXT PRIMARY KEY)
- lead_id (TEXT)
- followup_type (TEXT) -- call, email, meeting, demo, site_visit
- scheduled_date (TEXT)
- actual_date (TEXT)
- duration (INTEGER) -- minutes
- notes (TEXT)
- outcome (TEXT)
- next_followup_date (TEXT)
- created_by (TEXT)
- created_at (TEXT)
```

#### crm_quotations
```sql
- id (TEXT PRIMARY KEY)
- quotation_number (TEXT UNIQUE)
- lead_id (TEXT)
- customer_id (TEXT)
- revision_number (INTEGER)
- status (TEXT) -- draft, sent, revised, approved, rejected, expired
- valid_till (TEXT)
- discount_percent (REAL)
- tax_amount (REAL)
- total_amount (REAL)
- notes (TEXT)
- terms (TEXT)
- approved_by (TEXT)
- approved_at (TEXT)
- created_by (TEXT)
- created_at (TEXT)
- updated_at (TEXT)
```

#### crm_alerts
```sql
- id (TEXT PRIMARY KEY)
- type (TEXT) -- followup, quotation_expiry, lead_review, custom
- title (TEXT)
- message (TEXT)
- scheduled_date (TEXT)
- is_active (INTEGER)
- is_completed (INTEGER)
- lead_id (TEXT)
- followup_id (TEXT)
- quotation_id (TEXT)
- priority (TEXT) -- low, medium, high
- assigned_to (TEXT)
- created_by (TEXT)
- completed_at (TEXT)
- created_at (TEXT)
```

### Integration Tables

#### crm_indiamart_settings
```sql
- id (TEXT PRIMARY KEY) -- 'default'
- api_key (TEXT)
- api_secret (TEXT)
- is_active (INTEGER)
- last_sync (TEXT)
- sync_interval (INTEGER)
- created_at (TEXT)
- updated_at (TEXT)
```

#### crm_activities
```sql
- id (TEXT PRIMARY KEY)
- lead_id (TEXT)
- inquiry_id (TEXT)
- activity_type (TEXT)
- description (TEXT)
- created_by (TEXT)
- created_at (TEXT)
```

## API Integration

### IndiaMART API
- **Endpoint**: Configurable API endpoint
- **Authentication**: API Key + Secret
- **Data Mapping**:
  - IndiaMART inquiry → crm_inquiries
  - Automatic lead creation for qualified inquiries
  - Status synchronization

### ERP Integration Points
- **Contacts**: Customer data synchronization
- **Products**: Product catalog for quotations
- **Orders**: Quotation to order conversion
- **BOM**: Technical specifications in quotations
- **Inventory**: Stock availability in quotations

## Automation Features

### Auto Follow-up
- Scheduled follow-ups based on lead stage
- Escalation rules for overdue activities
- Automated email reminders

### Auto Alerts
- Quotation expiry notifications
- Lead review reminders
- Follow-up scheduling alerts

### Auto Order Conversion
- Rules-based conversion triggers
- Approval workflow integration
- Automatic order creation

## Security & Compliance

### Data Protection
- Encrypted storage of API credentials
- Role-based data access
- Audit trails for all activities

### GDPR Compliance
- Data retention policies
- Right to erasure
- Consent management for communications

## Implementation Status

### Completed ✅
- Database schema design
- Basic UI framework
- Role-based access control
- IndiaMART integration setup
- Pipeline visualization
- Alert system foundation

### In Development 🚧
- Full CRUD operations for all entities
- Advanced reporting and analytics
- Email/SMS integration
- Mobile-responsive design
- API documentation

### Planned 📋
- Advanced automation rules
- AI-powered lead scoring
- Integration with popular CRMs
- Advanced analytics dashboard
- Mobile app companion

## Usage Guide

### For Sales Team
1. **Access CRM**: Navigate to CRM module from main menu
2. **View Pipeline**: Monitor leads in pipeline view
3. **Manage Leads**: Update lead status and add activities
4. **Schedule Follow-ups**: Create and track follow-up tasks
5. **Create Quotations**: Generate professional quotations
6. **Track Alerts**: Monitor pending tasks and reminders

### For Managers
1. **Monitor Performance**: View team metrics and pipeline health
2. **Configure IndiaMART**: Set up API integration
3. **Manage Approvals**: Review and approve quotations
4. **Generate Reports**: Access detailed analytics
5. **Team Management**: Assign leads and monitor activities

### For Admins
1. **System Configuration**: Set up CRM settings and integrations
2. **User Management**: Configure roles and permissions
3. **Data Management**: Import/export CRM data
4. **Audit & Compliance**: Monitor system usage and security

## Future Enhancements

### Phase 2
- Advanced lead scoring algorithms
- Predictive analytics for conversion rates
- Integration with email marketing platforms
- Customer portal for self-service

### Phase 3
- AI-powered conversation insights
- Voice call integration
- Advanced reporting with custom dashboards
- Mobile app with offline capabilities

This CRM module transforms PanelERP into a comprehensive business management solution, bridging the gap between sales activities and operational execution.