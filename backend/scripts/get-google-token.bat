@echo off
cd /d %~dp0\..
ts-node scripts/get-google-refresh-token.ts
pause

