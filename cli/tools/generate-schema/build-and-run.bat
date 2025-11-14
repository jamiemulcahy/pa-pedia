@echo off
REM Build and run schema generator for Windows
echo Building schema generator...
cd /d "%~dp0"
go build -o generate-schema.exe .
if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

echo Running schema generator...
generate-schema.exe --output ../../schema %*
