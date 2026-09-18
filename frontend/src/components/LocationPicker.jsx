import React, { useEffect, useRef, useState } from "react";
import { MapPin, Crosshair } from "lucide-react";
import { Field } from "./ui";

const KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
let loading = null;

function loadMaps() {
  if (!KEY) return Promise.reject(new Error("no-key"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places`;
    s.async = true;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Location input. With a Google Maps key it gives search + map pin drop.
 * Without a key it stays a plain, fully usable address box.
 */
export default function LocationPicker({ label, value, onChange, latlng, onLatLng, placeholder }) {
  const [ready, setReady] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const inputRef = useRef(null);
  const mapRef = useRef(null);
  const objs = useRef({});

  useEffect(() => {
    if (!KEY) return;
    loadMaps().then(() => setReady(true)).catch(() => setReady(false));
  }, []);

  useEffect(() => {
    if (!ready || !inputRef.current || objs.current.ac) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" },
      fields: ["formatted_address", "name", "geometry"],
    });
    ac.addListener("place_changed", () => {
      const p = ac.getPlace();
      const addr = [p.name, p.formatted_address].filter(Boolean).join(", ");
      onChange(addr);
      if (p.geometry?.location) {
        const ll = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() };
        onLatLng?.(ll);
        if (objs.current.map) {
          objs.current.map.setCenter(ll);
          objs.current.marker.setPosition(ll);
        }
      }
    });
    objs.current.ac = ac;
  }, [ready]); // eslint-disable-line

  useEffect(() => {
    if (!showMap || !ready || !mapRef.current || objs.current.map) return;
    const center = latlng || { lat: 20.5486, lng: 78.9629 };
    const map = new window.google.maps.Map(mapRef.current, {
      center, zoom: latlng ? 14 : 6, mapTypeControl: false, streetViewControl: false,
    });
    const marker = new window.google.maps.Marker({ position: center, map, draggable: true });
    const geocoder = new window.google.maps.Geocoder();
    const set = (ll) => {
      marker.setPosition(ll);
      onLatLng?.(ll);
      geocoder.geocode({ location: ll }, (res, st) => {
        if (st === "OK" && res[0]) onChange(res[0].formatted_address);
      });
    };
    map.addListener("click", (e) => set({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    marker.addListener("dragend", (e) => set({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
    objs.current = { ...objs.current, map, marker };
  }, [showMap, ready]); // eslint-disable-line

  return (
    <div>
      <Field label={label}>
        <div className="relative">
          <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input ref={inputRef} data-testid={`loc-${(label || "loc").toLowerCase().replace(/\s+/g, "-")}`}
            className="fld pl-9" value={value || ""} placeholder={placeholder || "Type address or search place"}
            onChange={(e) => onChange(e.target.value)} />
        </div>
      </Field>
      <div className="mt-1.5 flex items-center gap-3">
        {ready ? (
          <button type="button" onClick={() => setShowMap((s) => !s)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 hover:underline">
            <Crosshair size={14} /> {showMap ? "Hide map" : "Pick on map / drop pin"}
          </button>
        ) : (
          <span className="text-[12px] text-muted">Type the address — it is saved for next time</span>
        )}
        {latlng && <span className="num text-[11.5px] text-muted">{latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)}</span>}
      </div>
      {showMap && <div ref={mapRef} className="mt-2 h-56 w-full rounded-xl border border-line" />}
    </div>
  );
}
