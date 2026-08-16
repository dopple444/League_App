# Source-document import checklist

Create `import/source-docs/` locally and place copies of the current source files there. Keep the folder out of public Git if it contains names, signatures, contact details, or other personal data.

Expected current source documents:

- `Meade_County_Church_Softball_Master_2026.xlsx`
- `Meade_County_Church_Softball_League_Schedules.xlsx`
- `Meade_County_Church_Softball_League_Schedules_Revised.xlsx`
- `Meade_County_Church_Softball_League_Rules_Reorganized_Draft.docx`
- `2026_Meade_County_Church_Softball_All_Team_Packets_Clean_Form.pdf`

Codex should create import adapters and traceability notes rather than treating one spreadsheet layout as the permanent data model.

## Required import outputs

- team and church seed template;
- season/week/field/time-slot availability template;
- schedule import/export mapping, including one team number per cell;
- rule-configuration seed with source section references;
- waiver template/version records with content hashes and rendered comparison tests;
- roster and team-registration field mapping;
- redacted synthetic fixtures for automated tests.

Never commit real signatures, dates of birth, phone numbers, email addresses, or completed waivers to source control.

