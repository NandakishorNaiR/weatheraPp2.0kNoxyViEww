"""WSGI config placeholder."""
import os
from django.core.wsgi import get_wsgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'knoxyview.settings')
application = get_wsgi_application()
