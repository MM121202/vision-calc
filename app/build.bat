@echo off
cd /d C:\Users\Lenovo\WorkBuddy\2026-11-23-10-41-59\vision-calc
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /out:VisionCalc.exe /win32icon:app\icon.ico /res:index.html,VisionCalc.index.html /r:System.Windows.Forms.dll app\Program.cs
if exist VisionCalc.exe (echo BUILD_OK) else (echo BUILD_FAIL)
