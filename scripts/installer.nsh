!include "MUI2.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var DbPathInput
Var CompanyNameInput
Var CompanyEmailInput
Var CompanyPhoneInput
Var CompanyGstInput
Var CompanyAddressInput

Function GetDefaultDbFolder
  ${If} $installMode == "all"
    StrCpy $0 "C:\OWNERP\database"
  ${Else}
    StrCpy $0 "$LOCALAPPDATA\OWNERP\database"
  ${EndIf}
FunctionEnd

Function BrowseForDbFolder
  Call GetDefaultDbFolder
  nsDialogs::SelectFolderDialog "Choose the folder where OWNERP should store its database" "$0"
  Pop $0

  StrCmp $0 "error" done
  ${NSD_SetText} $DbPathInput $0

done:
FunctionEnd

Function DatabaseLocationPageCreate
  !insertmacro MUI_HEADER_TEXT "Database Location" "Choose where OWNERP should store its SQLite database files."

  nsDialogs::Create 1018
  Pop $0
  StrCmp $0 "error" 0 +2
  Abort

  ${If} $installMode == "all"
    ${NSD_CreateLabel} 0 0 100% 18u "Master System mode: this shared folder will store live OWNERP data for all users on this computer."
  ${Else}
    ${NSD_CreateLabel} 0 0 100% 18u "User System mode: this folder will store live OWNERP data for the current Windows user."
  ${EndIf}
  Pop $0

  Call GetDefaultDbFolder
  ${NSD_CreateText} 0 24u 78% 12u "$0"
  Pop $DbPathInput

  ${NSD_CreateBrowseButton} 80% 24u 20% 12u "Browse..."
  Pop $1
  ${NSD_OnClick} $1 BrowseForDbFolder

  ${NSD_CreateLabel} 0 44u 100% 24u "Recommended: choose a database folder that is included in your normal backup routine."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function DatabaseLocationPageLeave
  ${NSD_GetText} $DbPathInput $0
  StrCmp $0 "" 0 +2
  Call GetDefaultDbFolder

  CreateDirectory "$0"
  CreateDirectory "$PROFILE\AppData\Roaming\OWNERP"

  FileOpen $1 "$PROFILE\AppData\Roaming\OWNERP\db-folder.txt" w
  FileWrite $1 "$0"
  FileClose $1
FunctionEnd

Function CompanyDetailsPageCreate
  !insertmacro MUI_HEADER_TEXT "Company Details" "Capture business identity for license activation and audit logs."

  nsDialogs::Create 1018
  Pop $0
  StrCmp $0 "error" 0 +2
  Abort

  ${NSD_CreateLabel} 0 0 100% 12u "Company Name *"
  Pop $0
  ${NSD_CreateText} 0 12u 100% 12u ""
  Pop $CompanyNameInput

  ${NSD_CreateLabel} 0 26u 100% 12u "Company Email"
  Pop $0
  ${NSD_CreateText} 0 38u 100% 12u ""
  Pop $CompanyEmailInput

  ${NSD_CreateLabel} 0 52u 100% 12u "Company Phone"
  Pop $0
  ${NSD_CreateText} 0 64u 100% 12u ""
  Pop $CompanyPhoneInput

  ${NSD_CreateLabel} 0 78u 100% 12u "GST Number"
  Pop $0
  ${NSD_CreateText} 0 90u 100% 12u ""
  Pop $CompanyGstInput

  ${NSD_CreateLabel} 0 104u 100% 12u "Company Address"
  Pop $0
  ${NSD_CreateText} 0 116u 100% 12u ""
  Pop $CompanyAddressInput

  ${NSD_CreateLabel} 0 134u 100% 18u "These details are used for first-time license activation logs and can be edited later inside OWNERP Settings."
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
  ${NSD_GetText} $CompanyAddressInput $4

  CreateDirectory "$PROFILE\AppData\Roaming\OWNERP"

  FileOpen $5 "$PROFILE\AppData\Roaming\OWNERP\company-seed.txt" w
  FileWrite $5 "company_name=$0$\r$\n"
  FileWrite $5 "company_email=$1$\r$\n"
  FileWrite $5 "company_phone=$2$\r$\n"
  FileWrite $5 "company_gst=$3$\r$\n"
  FileWrite $5 "company_address=$4$\r$\n"
  FileClose $5
FunctionEnd

!macro customPageAfterChangeDir
  Page Custom DatabaseLocationPageCreate DatabaseLocationPageLeave
  Page Custom CompanyDetailsPageCreate CompanyDetailsPageLeave
!macroend
!endif
