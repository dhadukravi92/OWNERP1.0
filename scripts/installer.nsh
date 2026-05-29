!include "MUI2.nsh"
!include "nsDialogs.nsh"

!macro customHeader
  BrandingText "OwnERP 1.0.0 - Business ERP for catalogue, inventory, CRM, HR, accounting, and reports"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to OwnERP Setup"
  !define MUI_WELCOMEPAGE_TEXT "OwnERP installs a complete desktop ERP workspace for product catalogue, inventory, CRM, HR, accounting, orders, inward/GRN, reports, and alerts.$\r$\n$\r$\nThis setup will guide you through installation scope, application location, database storage, and company identity so the first launch is ready for business use."
  !insertmacro MUI_PAGE_WELCOME
  !undef MUI_WELCOMEPAGE_TITLE
  !undef MUI_WELCOMEPAGE_TEXT
!macroend

!macro customFinishPage
  Function OwnERPStartApp
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" ""
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "OwnERP is ready"
  !define MUI_FINISHPAGE_TEXT "Setup has finished installing OwnERP.$\r$\n$\r$\nYou can now launch your ERP workspace and continue with company settings, catalogue import, stock, CRM, HR, accounting, and reports."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Launch OwnERP now"
  !define MUI_FINISHPAGE_RUN_FUNCTION "OwnERPStartApp"
  !insertmacro MUI_PAGE_FINISH
  !undef MUI_FINISHPAGE_TITLE
  !undef MUI_FINISHPAGE_TEXT
  !undef MUI_FINISHPAGE_RUN
  !undef MUI_FINISHPAGE_RUN_TEXT
  !undef MUI_FINISHPAGE_RUN_FUNCTION
!macroend

!ifndef BUILD_UNINSTALLER
Var DbPathInput
Var CompanyNameInput
Var CompanyEmailInput
Var CompanyPhoneInput
Var CompanyGstInput
Var CompanyIndustryInput
Var CompanyAddressInput

Function GetDefaultDbFolder
  ${If} $installMode == "all"
    StrCpy $0 "$COMMONAPPDATA\OwnERP\database"
  ${Else}
    StrCpy $0 "$LOCALAPPDATA\OwnERP\database"
  ${EndIf}
FunctionEnd

Function BrowseForDbFolder
  Call GetDefaultDbFolder
  nsDialogs::SelectFolderDialog "Choose the folder where OwnERP should store its database" "$0"
  Pop $0

  StrCmp $0 "error" done
  ${NSD_SetText} $DbPathInput $0

done:
FunctionEnd

Function DatabaseLocationPageCreate
  !insertmacro MUI_HEADER_TEXT "OwnERP Data Location" "Choose where OwnERP should store live SQLite business data."

  nsDialogs::Create 1018
  Pop $0
  StrCmp $0 "error" 0 +2
  Abort

  ${NSD_CreateLabel} 0 0 100% 20u "OwnERP separates the application files from your business database. Keep this folder in a reliable drive and include it in your normal backup routine."
  Pop $0

  ${If} $installMode == "all"
    ${NSD_CreateLabel} 0 25u 100% 14u "Mode: Master System - shared data for all Windows users on this computer."
  ${Else}
    ${NSD_CreateLabel} 0 25u 100% 14u "Mode: User System - private data for the current Windows user."
  ${EndIf}
  Pop $0

  Call GetDefaultDbFolder
  ${NSD_CreateLabel} 0 48u 100% 10u "Database Folder"
  Pop $0
  ${NSD_CreateText} 0 60u 78% 12u "$0"
  Pop $DbPathInput

  ${NSD_CreateBrowseButton} 80% 60u 20% 12u "Browse..."
  Pop $1
  ${NSD_OnClick} $1 BrowseForDbFolder

  ${NSD_CreateLabel} 0 83u 100% 36u "This folder will contain ownerp.db and ownerp-accounting.db. For production use, choose a location protected by your regular backup process."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function DatabaseLocationPageLeave
  ${NSD_GetText} $DbPathInput $0
  StrCmp $0 "" 0 +2
  Call GetDefaultDbFolder

  CreateDirectory "$0"
  CreateDirectory "$APPDATA\OwnERP"

  FileOpen $1 "$APPDATA\OwnERP\db-folder.txt" w
  FileWrite $1 "$0"
  FileClose $1
FunctionEnd

Function CompanyDetailsPageCreate
  !insertmacro MUI_HEADER_TEXT "Company Profile" "Capture business identity for documents, audit logs, and first launch."

  nsDialogs::Create 1018
  Pop $0
  StrCmp $0 "error" 0 +2
  Abort

  ${NSD_CreateLabel} 0 0 100% 14u "These details appear in OwnERP Settings and can be edited later."
  Pop $0

  ${NSD_CreateLabel} 0 22u 100% 10u "Company Name *"
  Pop $0
  ${NSD_CreateText} 0 34u 100% 12u ""
  Pop $CompanyNameInput

  ${NSD_CreateLabel} 0 51u 48% 10u "Company Email"
  Pop $0
  ${NSD_CreateText} 0 63u 48% 12u ""
  Pop $CompanyEmailInput

  ${NSD_CreateLabel} 52% 51u 48% 10u "Company Phone"
  Pop $0
  ${NSD_CreateText} 52% 63u 48% 12u ""
  Pop $CompanyPhoneInput

  ${NSD_CreateLabel} 0 80u 48% 10u "GST Number"
  Pop $0
  ${NSD_CreateText} 0 92u 48% 12u ""
  Pop $CompanyGstInput

  ${NSD_CreateLabel} 52% 80u 48% 10u "Primary Industry"
  Pop $0
  ${NSD_CreateText} 52% 92u 48% 12u "Electrical Control Panels"
  Pop $CompanyIndustryInput

  ${NSD_CreateLabel} 0 109u 100% 10u "Company Address"
  Pop $0
  ${NSD_CreateText} 0 121u 100% 12u ""
  Pop $CompanyAddressInput

  ${NSD_CreateLabel} 0 142u 100% 18u "OwnERP uses this profile on invoices, reports, license logs, catalog imports, and audit trails."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function CompanyDetailsPageLeave
  ${NSD_GetText} $CompanyNameInput $0
  StrCmp $0 "" 0 +3
  MessageBox MB_ICONEXCLAMATION "Company Name is required."
  Abort

  ${NSD_GetText} $CompanyEmailInput $1
  ${NSD_GetText} $CompanyPhoneInput $2
  ${NSD_GetText} $CompanyGstInput $3
  ${NSD_GetText} $CompanyIndustryInput $4
  ${NSD_GetText} $CompanyAddressInput $6

  CreateDirectory "$APPDATA\OwnERP"

  FileOpen $5 "$APPDATA\OwnERP\company-seed.txt" w
  FileWrite $5 "company_name=$0$\r$\n"
  FileWrite $5 "company_email=$1$\r$\n"
  FileWrite $5 "company_phone=$2$\r$\n"
  FileWrite $5 "company_gst=$3$\r$\n"
  FileWrite $5 "company_industry_type=$4$\r$\n"
  FileWrite $5 "company_address=$6$\r$\n"
  FileClose $5
FunctionEnd

!macro customPageAfterChangeDir
  Page Custom DatabaseLocationPageCreate DatabaseLocationPageLeave
  Page Custom CompanyDetailsPageCreate CompanyDetailsPageLeave
!macroend
!endif
