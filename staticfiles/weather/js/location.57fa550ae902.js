// Get device geolocation and redirect to server with lat/lon
if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            window.location.href = `/weather/?lat=${lat}&lon=${lon}`;
        },
        (err) => {
            console.warn('GPS permission denied or unavailable', err);
        }, { enableHighAccuracy: true, timeout: 10000 }
    );
} else {
    console.warn('Geolocation not supported by this browser');
}