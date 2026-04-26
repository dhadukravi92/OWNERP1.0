# OWNERP Operations Manual
## Module-by-Module Operating Guide

This manual is for day-to-day users, supervisors, and administrators who operate OWNERP after installation.

It explains:
- what each module is used for
- what each major form/screen does
- what information should be entered
- the normal operating flow between modules

---

## Table of Contents

1. Purpose and User Roles
2. Operating Sequence
3. Login
4. Dashboard
5. Product Catalogue
6. Inventory
7. Contacts
8. CRM
9. HR
10. Accounting
11. Bill of Materials
12. Quotations
13. Inward / GRN
14. Orders
15. Reports
16. Alerts and Notifications
17. Settings
18. Backup and Restore
19. Recommended Daily, Weekly, Monthly Routine

---

## 1. Purpose and User Roles

OWNERP is designed to run the operating cycle of a panel manufacturing or electrical business across commercial, stock, accounting, HR, and admin workflows.

Typical roles:
- `Admin`: full access, setup, users, backup, company controls
- `Manager`: operational control across modules
- `Operator`: transaction entry and routine processing

---

## 2. Operating Sequence

A common business flow in OWNERP is:

1. Create products in `Catalogue`
2. Create customers and vendors in `Contacts`
3. Create BOMs in `Bill of Materials`
4. Create quotation in `Quotations`
5. Convert demand into `Orders`
6. Receive material in `Inward / GRN`
7. Manage stock in `Inventory`
8. Raise invoices, receipts, payments, journals in `Accounting`
9. Review KPIs in `Dashboard`, `Reports`, and `Alerts`

---

## 3. Login

### Purpose
Used to authenticate users and open the app with role-based access.

### Main screen
- `Login`

### What the user does
- Enter username
- Enter password
- Sign in

### Notes
- Access to modules depends on role and module permissions configured in Settings
- Admin should change the default password on first use

---

## 4. Dashboard

### Purpose
Gives management a live operating summary.

### Main sections
- `Revenue & Quotation Momentum`
- `Fulfilment Mix`
- `Critical Stock Watchlist`
- `Top Customers by Order Value`
- `Quick Actions`
- `Recent Orders`

### What users should review
- low stock items
- open/pending orders
- quotations pipeline
- customer concentration
- recent order movement

### Typical use
- Start-of-day review by manager or admin
- Quick navigation to modules needing attention

---

## 5. Product Catalogue

### Purpose
Maintains the item master for finished goods, raw materials, components, and saleable items.

### Main screen
- `Product Catalogue`

### Main form
- `Add New Product` / `Edit Product`

### Form sections
- `Identity`
  - product name
  - product code
- `Classification`
  - category
  - HSN code
  - unit
- `Commercials`
  - selling price
  - cost price
  - GST rate
- `Inventory Control`
  - minimum stock
- `Product Details`
  - description
  - specifications

### When to use
- before stock movement
- before quotation/order entry
- before BOM creation

### Good practice
- keep product codes unique
- set realistic GST and minimum stock
- maintain separate items for raw material and finished goods where needed

---

## 6. Inventory

### Purpose
Tracks current stock and manual stock movements.

### Main screen
- `Inventory Management`

### Main forms
- `Stock In`
- `Stock Out`

### Main sections
- stock summary table
- `Stock Transaction History`

### What users enter in Stock In / Stock Out
- product
- quantity
- transaction type
- remarks or reason

### When to use
- manual correction
- material issue
- emergency stock receipt
- non-GRN stock movement

### Important rule
- Use `Inward / GRN` for normal vendor receipts
- Use Inventory manual entry only for adjustments or direct stock movement

---

## 7. Contacts

### Purpose
Maintains customer and vendor master records used by quotations, orders, inward, and accounting.

### Main screen
- `Contacts`

### Main form
- `Add Contact Banking Master` / `Edit Contact Banking Master`

### Form sections
- `Identity and Communication`
  - customer/vendor name
  - phone
  - email
  - address
- `Compliance and Commercial Controls`
  - GST number
  - PAN
  - credit limit
  - payment terms
- `Banking and Settlement Details`
  - account holder name
  - bank name
  - branch
  - account number
  - IFSC / SWIFT / IBAN / UPI
- `Internal Notes`

### When to use
- before quotations
- before sales orders
- before purchase inward
- before accounting entries involving parties

### Good practice
- create one clean master per party
- avoid duplicate party names
- keep banking data verified before payment

---

## 8. CRM

### Purpose
Handles lead and inquiry management before quotation and order creation.

### Typical activities
- track inquiries
- qualify leads
- schedule follow-ups
- monitor CRM quotations
- track CRM alerts

### What users should record
- inquiry source
- customer details
- requirement summary
- follow-up date
- status and probability

### Operational value
- helps sales teams move from inquiry to quotation
- improves follow-up discipline
- gives management visibility into pipeline conversion

---

## 9. HR

### Purpose
Manages workforce records, leave, attendance, documents, and payroll operations.

### Main screen
- `HR`

### Main forms and work areas
- `Add Workforce Profile` / `Edit Workforce Profile`
- `Raise Leave Request`
- `Link Employee Document`
- `Create Payroll Run`
- `Capture Attendance`

### Employee form sections
- `Identity and Assignment`
  - employee code
  - full name
  - department
  - designation
- `Contact and Work Arrangement`
  - phone
  - emails
  - location
  - shift
- `Payroll and Compliance`
  - salary information
  - statutory details
- `Banking and Emergency Contact`

### HR dashboards / lists
- `Workforce Architecture`
- `Attendance Pulse`
- `Recent Workforce Signals`
- `Newest Team Members`
- `Approvals Queue`
- `Employee Document Register`
- `Payroll Control Tower`
- `Payroll Register`
- `Employee Directory`
- `Today's Attendance Board`

### When to use
- onboarding staff
- daily attendance marking
- leave processing
- payroll preparation
- employee document management

---

## 10. Accounting

### Purpose
Runs invoicing, purchase bills, receipts, payments, bank reconciliation, ledger, tax, and accounting masters.

### Main screen
- `Accounting`

### Main work areas
- `General Ledger & Tax Structure`
- `Control Watchlist`
- `Collection Control`
- `Customer Collections Control`
- `Vendor Settlement Control`
- `Statement Matching Workspace`
- `Advisor Suggestions`
- `Ask the Advisor`
- `Accounting Database`
- `Accounting Settings`
- `Recent Dispatch Log`

### Core transaction forms

#### A. `Create Sales Invoice`
Use when billing the customer after supply or service.

Enter:
- customer
- invoice date
- line items
- taxes
- notes

#### B. `Create Purchase Bill`
Use when recording vendor liability and purchase value.

Enter:
- vendor
- bill date
- item/value details
- tax amounts

#### C. `Post Receipt Voucher`
Use when money is received from customer.

Enter:
- customer
- receipt date
- amount
- payment mode
- reference number
- allocation against invoice if applicable

#### D. `Post Payment Voucher`
Use when paying vendor or other dues.

Enter:
- vendor / payee
- payment date
- amount
- payment mode
- reference
- bill allocation if applicable

#### E. `Add Bank Statement Line`
Use during bank reconciliation.

Enter:
- bank account
- statement date
- reference
- description
- amount
- entry type

#### F. `Manual Journal`
Use for non-standard accounting entries, adjustments, and corrections.

Enter:
- voucher date
- debit/credit accounts
- amount
- narration

#### G. `Create Proforma Invoice` / `Edit Proforma Invoice`
Used for non-posting commercial documents before final invoice.

Form sections:
- `Document Setup`
- `Commercial Message`
- `Line Items`
- `Notes`
- `Terms`

### Registers and review screens
- `Sales Invoice Register`
- `Purchase Bill Register`
- `Recent Receipt Vouchers`
- `Recent Payment Vouchers`
- `Proforma Invoice Register`
- `Bank Book Feed`
- `Chart of Accounts`
- `Recent Journals`
- `Party Ledger`
- `Open Documents & Aging`
- `Follow-up Actions`
- `Party Ledger Timeline`
- `Email Document`

### Accounting setup and masters
- tax codes
- chart of accounts
- bank accounts
- treasury settings
- fixed asset settings
- accounting database info
- accounting settings

### Good practice
- keep party master accurate before posting vouchers
- reconcile bank lines regularly
- use manual journals only when standard forms do not apply
- review aging and follow-up actions weekly

---

## 11. Bill of Materials

### Purpose
Defines the component structure of finished products or assemblies.

### Main screen
- `Bill of Materials`

### Main form
- `Create Bill of Materials` / `Edit Bill of Materials`

### Form sections
- `BOM Identity`
  - finished good
  - BOM name
  - revision
- `Materials / Components`
  - component items
  - quantity
  - unit
- `Engineering Notes`

### When to use
- before production planning
- before costing review
- before quoting complex assemblies

### Good practice
- keep revision control disciplined
- review material readiness before production commitment

---

## 12. Quotations

### Purpose
Creates commercial offers for customers.

### Main screen
- `Quotations`

### Main form
- `New Quotation` / `Edit Quotation`

### Form sections
- customer details
- quotation header
- `Line Items`
- discount and tax
- validity / notes / terms

### Typical workflow
1. Choose customer from Contacts
2. Add products from Catalogue
3. Review price and tax
4. Save as draft or send
5. Move through status:
   - Draft
   - Sent
   - Approved
   - Rejected

### Good practice
- verify GST and product rate before sending
- keep version and follow-up discipline through CRM or sales process

---

## 13. Inward / GRN

### Purpose
Records incoming material from vendors and updates stock.

### Main screen
- `Inward / GRN`

### Main form
- `New Goods Receipt Note`

### Form sections
- `Receipt Header`
  - vendor
  - GRN date
  - reference
- `Received Items`
  - item
  - quantity received
  - unit/cost details

### Result of saving
- inventory increases
- latest purchase/cost data can be updated
- inward history is preserved

### When to use
- every normal vendor receipt
- material inward against PO or direct receipt

---

## 14. Orders

### Purpose
Maintains customer sales orders and their fulfillment status.

### Main screen
- `Orders`

### Main form
- `Create Sales Order` / `Edit Sales Order`

### Form sections
- `Commercial Header`
  - customer
  - order date
  - commitment details
- `Order Lines`
  - item
  - quantity
  - rate
  - value

### Status progression
- Pending
- Confirmed
- In Production
- Shipped
- Delivered

### Good practice
- confirm customer and price details before order confirmation
- update status promptly for accurate dashboard and reports

---

## 15. Reports

### Purpose
Provides analysis and exportable operational reports.

### Main report groups
- `Stock Value by Category`
- `Top Value Items`
- `Detailed Stock Report`
- `Monthly Order Revenue`
- `Order Throughput`
- `Status Split`
- `Vendor Purchase Report`
- `Category-wise Stock Analysis`
- `Category Detail`

### Typical use
- management review
- stock valuation review
- procurement analysis
- sales trend review
- export to CSV/Excel for external reporting

---

## 16. Alerts and Notifications

### Purpose
Shows system-generated reminders and control points.

### Main screen
- `Alerts & Notifications`

### Typical alerts
- low stock
- pending work
- follow-up reminders
- operational exceptions

### Good practice
- review alerts daily
- clear items only after action is taken

---

## 17. Settings

### Purpose
Controls company setup, module access, users, shortcuts, backup, and data locations.

### Main tabs
- `Company Profile`
- `Module Access`
- `Users`
- `Backup & Data`

### A. Company Profile
Use to maintain:
- company name
- GST
- address
- phone
- email
- currency symbol
- stock threshold

### B. Module Access
Use to control:
- enabled modules
- main menu shortcuts
- user visibility by module

Main areas:
- `System Module Switchboard`
- `Access Matrix`

### C. Users
Use to create and maintain users.

Main form:
- `Create User` / `Edit User Access`

Enter:
- full name
- username
- password
- role
- module access

### D. Backup & Data
Use to manage:
- cloud backup
- local backup
- restore
- database location
- accounting database location

Main cards:
- `Google Drive / Cloud Backup`
- `Database Backup`
- `Accounting Database`
- `About OWNERP`

---

## 18. Backup and Restore

### Backup modes
- local backup folder
- Google Drive API upload
- local synced cloud folder

### What gets backed up
- ERP master database
- accounting database

### Main actions
- `Save Auto Backup Settings`
- `Run Backup Now`
- `Restore Database`
- `Change Location`
- `Change Accounting Location`

### Restore note
- restoring replaces the live ERP database with the selected backup file
- restore should be done by admin only
- take a fresh backup before restore if possible

---

## 19. Recommended Daily, Weekly, Monthly Routine

### Daily
- review Dashboard
- process quotations and orders
- enter GRNs
- update inventory adjustments if needed
- post receipts and payments
- review alerts

### Weekly
- review low stock and reorder exposure
- reconcile bank statement lines
- review receivables and payables aging
- review pending approvals in HR
- verify backup status

### Monthly
- review order revenue reports
- verify stock valuation
- close payroll
- review tax and ledger control in Accounting
- verify backup files for both master and accounting databases

---

## Document Notes

This operations manual is intended as a functional user guide. If the product grows, the next recommended expansion is:
- a field-by-field form dictionary
- role-wise SOPs
- process flow diagrams for sales, purchase, stock, HR, and finance

