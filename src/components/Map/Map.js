import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  CircleMarker,
  Polyline,
  Rectangle,
  LayersControl,
  LayerGroup,
  FeatureGroup,
} from "react-leaflet";
import "./map.css";
import "leaflet/dist/leaflet.css";
import data from "./data";

const Map = () => {
  const center = [27.849339, -97.226642];

  const polyline = [
    [27.849339, -97.226642],

    [27.848697, -97.226512],
    [27.849339, -97.226642],
    [27.848539, -97.226755],
  ];

  const fillBlueOptions = { fillColor: "blue" };
  const blackOptions = { color: "black" };
  const limeOptions = { color: "lime" };
  const greenOptions = { color: "green" };
  const purpleOptions = { color: "purple" };
  const redOptions = { color: "red" };
  const blueOptions = { color: "blue" };

  return (
    <MapContainer
      style={{ height: "1000px", width: "100%" }}
      center={center}
      zoom={16}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <LayersControl position="topright">
        <LayersControl.Overlay name="Marker with popup">
          <Marker position={center}>
            <Popup>
              A pretty CSS3 popup. <br /> Easily customizable.
            </Popup>
          </Marker>
        </LayersControl.Overlay>

        {data.map((info) =>
          info.results.map((result) => (
            <LayersControl.Overlay
              key={result.id}
              checked
              name={result.display}
            >
              <LayerGroup>
                {console.log(result)}

                <CircleMarker
                  key={result.id}
                  center={[
                    `${result.custom_fields.LATITUDE ?? ""}`,
                    `${result.custom_fields.LONGITUDE ?? ""}`,
                  ]}
                  pathOptions={greenOptions}
                  radius={5}
                >
                  <Popup key={result.id}>{result.display}</Popup>
                </CircleMarker>

                <LayerGroup></LayerGroup>
              </LayerGroup>
            </LayersControl.Overlay>
          ))
        )}

        <LayersControl.Overlay name="UPLINK">
          <Polyline pathOptions={blueOptions} positions={polyline} />
        </LayersControl.Overlay>
      </LayersControl>
      {/* <Circle center={center} pathOptions={fillBlueOptions} radius={2000} /> */}

      {/* <Rectangle bounds={rectangle} pathOptions={blackOptions} /> */}
    </MapContainer>
  );
};

export default Map;
