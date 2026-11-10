import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

const map = L.map('map').setView([43.6532, -79.3832], 10);

L.tileLayer(
  'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png',
  {
    maxZoom: 20,
    attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors'
  }
).addTo(map);