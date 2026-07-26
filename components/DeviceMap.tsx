"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin } from "lucide-react";

interface DeviceMapProps {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  name: string;
}

function createMarkerIcon() {
  const svg = renderToStaticMarkup(
    <MapPin className="h-8 w-8 text-primary" fill="currentColor" />,
  );
  return divIcon({
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    className: "bg-transparent border-0",
  });
}

export default function DeviceMap({ latitude, longitude, accuracy, name }: DeviceMapProps) {
  const markerIcon = createMarkerIcon();

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      className="h-full w-full rounded-xl"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={markerIcon}>
        <Popup>
          <div className="text-sm">
            <strong>{name}</strong>
            <br />
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
            {accuracy && (
              <>
                <br />
                Accuracy: ±{accuracy}m
              </>
            )}
            <br />
            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Open in Google Maps
            </a>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
