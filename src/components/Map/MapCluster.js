import React from "react";
import "./styles.css";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ImageOverlay,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import data from "./data";
import devicedata from "./devicedata";
import layout from "./kos.png";
import helper from "./helper";

import { Icon, divIcon, point } from "leaflet";

// create custom icon
const customIcon = new Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/447/447031.png",
  iconSize: [38, 38], // size of the icon
});

// custom cluster icon
const createClusterCustomIcon = function (cluster) {
  return new divIcon({
    html: `<span class="cluster-icon">${cluster.getChildCount()}</span>`,
    className: "custom-marker-cluster",
    iconSize: point(33, 33, true),
  });
};

const bounds = [
  [27.85454713385312, -97.23167584604711],
  [27.851997368480525, -97.22852577222167],
];

export default function App() {
  React.useEffect(() => {
    console.log(helper());
  }, []);
  const [opacity, setOpacity] = React.useState("100");
  return (
    <div>
      <MapContainer
        style={{
          height: "100vh",
          width: "100%",
        }}
        center={[27.849339, -97.226642]}
        zoom={13}
      >
        {" "}
        <input
          type="range"
          mon="0"
          max="100"
          value={opacity * 100}
          onChange={(e) => setOpacity(e.target.value / 100)}
        />
        {/* <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      /> */}
        <TileLayer
          attribution="Google Maps Satellite"
          url="https://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}"
        ></TileLayer>
        <ImageOverlay
          url={layout}
          bounds={bounds}
          opacity={opacity}
          zIndex={10}
        />
        <MarkerClusterGroup
          maxClusterRadius={60}
          chunkedLoading
          iconCreateFunction={createClusterCustomIcon}
        >
          {/* Mapping through the markers */}
          {data.map((info) =>
            info.results.map((result) => (
              <Marker
                position={[
                  `${result.custom_fields.LATITUDE ?? ""}`,
                  `${result.custom_fields.LONGITUDE ?? ""}`,
                ]}
                icon={customIcon}
              >
                {/* {devicedata
                .filter((device) => device?.location.id === result.id)
                .map((device) => (
                  <Popup>
                    <div>test</div>
                  </Popup>
                ))} */}

                <Popup>
                  <a
                    rel="noopener noreferrer"
                    target="_blank"
                    href={`https://netbox.kiewit.com/dcim/locations/${result.id}`}
                  >
                    {result.display}
                  </a>
                </Popup>
              </Marker>
            ))
          )}

          {/* Hard coded markers */}
          {/* <Marker position={[51.505, -0.09]} icon={customIcon}>
          <Popup>This is popup 1</Popup>
        </Marker>
        <Marker position={[51.504, -0.1]} icon={customIcon}>
          <Popup>This is popup 2</Popup>
        </Marker>
        <Marker position={[51.5, -0.09]} icon={customIcon}>
          <Popup>This is popup 3</Popup>
        </Marker>
       */}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
