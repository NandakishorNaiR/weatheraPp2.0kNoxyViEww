@echo off
rem Activate or create a virtual environment located at .venv
set "VENV_DIR=%~dp0.venv"

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo Creating virtual environment at %VENV_DIR%...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo Failed to create virtual environment.
        exit /b 1
    )
)

echo Activating virtual environment at %VENV_DIR%
call "%VENV_DIR%\Scripts\activate.bat"
