# PowerShell helper to run the Django WSGI app with Waitress (explicit port 8000)
$port = 8000
waitress-serve --host=0.0.0.0 --port=$port knoxyview.wsgi:application
