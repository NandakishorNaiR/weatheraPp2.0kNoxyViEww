@echo off
REM Batch helper to run the Django WSGI app with Waitress (explicit port 8000)
set PORT=8000
waitress-serve --host=0.0.0.0 --port=%PORT% knoxyview.wsgi:application
