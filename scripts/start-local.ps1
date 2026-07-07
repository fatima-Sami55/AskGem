# AskPeri Local Startup (Windows) — delegates to npm run dev
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
npm run dev
