@echo off
rem Temporary sh shim so the "sh" shell config works on Windows. Deleted after review.
rem Invocations arrive as: sh [options] -c "command"
setlocal

if exist "C:\Program Files\Git\bin\sh.exe" goto realsh
if exist "C:\Program Files\Git\usr\bin\sh.exe" goto realsh2
if exist "C:\Program Files (x86)\Git\bin\sh.exe" goto realsh3
goto fake

:realsh
"C:\Program Files\Git\bin\sh.exe" %*
exit /b %errorlevel%

:realsh2
"C:\Program Files\Git\usr\bin\sh.exe" %*
exit /b %errorlevel%

:realsh3
"C:\Program Files (x86)\Git\bin\sh.exe" %*
exit /b %errorlevel%

:fake
if "%~1"=="-c" shift
cmd /c %*
exit /b %errorlevel%