import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log('Mapbox GL JS Loaded:', mapboxgl);
let timeFilter = -1;

mapboxgl.accessToken = 'pk.eyJ1IjoiamF6enlqYXNzeSIsImEiOiJjbWFxNDJic2YwNjFnMmlwdHF5d254Z2xqIn0.2jDxJoTpyVgbtLR6qxde_A';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});
const svg = d3.select('#map').select('svg');

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals   = d3.rollup(trips, v => v.length, d => d.end_station_id);
  return stations.map(st => ({
    ...st,
    arrivals:   arrivals.get(st.short_name)   ?? 0,
    departures: departures.get(st.short_name) ?? 0,
    totalTraffic: (arrivals.get(st.short_name) ?? 0) +
                  (departures.get(st.short_name) ?? 0)
  }));
}

function filterTripsByTime(trips, timeFilter) {
  if (timeFilter === -1) return trips;
  return trips.filter(trip => {
    const start = minutesSinceMidnight(trip.started_at);
    const end   = minutesSinceMidnight(trip.ended_at);
    return Math.abs(start - timeFilter) <= 60 || Math.abs(end - timeFilter) <= 60;
  });
}

function getCoords(station) {
  const p = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(p);
  return { cx: x, cy: y };
}

map.on('load', async () => {
  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('time-display');
  const anyTimeLabel = document.getElementById('any-time');
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  map.addLayer({
    id: 'boston-bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
      'line-dasharray': [2, 2]
    }
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });
  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6
    }
  });
  
  let jsonData;
  try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

    // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
        const trafficUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        const trips = await d3.csv(
            'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
            (trip) => {
              trip.started_at = new Date(trip.started_at);
              trip.ended_at = new Date(trip.ended_at);
              return trip;
            }
        );
        console.log('Loaded Trips:', trips.length); 
       
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
        const departures = d3.rollup(
            trips,
            v => v.length,
            d => d.start_station_id
          );
          
          const arrivals = d3.rollup(
            trips,
            v => v.length,
            d => d.end_station_id
          );
        
        const stations = computeStationTraffic(jsonData.data.stations, trips);
        console.log('Stations Array:', stations);
          const radiusScale = d3
          .scaleSqrt()
          .domain([0, d3.max(stations, d => d.totalTraffic)])
          .range([0, 25]);
          const stationFlow = d3
          .scaleQuantize()
          .domain([0, 1])
          .range([0, 0.5, 1]);
        const circles = svg
        .selectAll('circle')
        .data(stations,  d => d.short_name)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))
        .attr('fill', 'steelblue')
        .attr('fill-opacity', 0.6)
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .style('--departure-ratio', (d) =>
            stationFlow(d.departures / d.totalTraffic),
          )
        .each(function (d) {
            d3.select(this)
              .append('title')
              .text(
                `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`
              );
        });
        function updateScatterPlot(timeFilter) {
            const filteredTrips = filterTripsByTime(trips, timeFilter);
            const filteredStations = computeStationTraffic(stations, filteredTrips);
          
            // Adjust size scale depending on whether filter is active
            timeFilter === -1
              ? radiusScale.range([0, 25])
              : radiusScale.range([3, 50]);
          
            // Update circle sizes and tooltips
            svg.selectAll('circle')
              .data(filteredStations, d => d.short_name) // key function
              .join('circle')
              .attr('r', d => radiusScale(d.totalTraffic))
              .attr('fill', 'steelblue')
              .attr('fill-opacity', 0.6)
              .attr('stroke', 'white')
              .attr('stroke-width', 1)
              .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic),
              )
              .append('title')
              .text(d => `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            
            updatePositions();
           
        }
        function updateTimeDisplay() {
            timeFilter = Number(timeSlider.value);
          
            if (timeFilter === -1) {
              selectedTime.textContent = '';
              anyTimeLabel.style.display = 'block';
            } else {
              selectedTime.textContent = formatTime(timeFilter);
              anyTimeLabel.style.display = 'none';
              
            }
            updateScatterPlot(timeFilter);
            // Later: trigger filtering here
        }
    
        function updatePositions() {
        circles
            .attr('cx', (d) => getCoords(d).cx)
            .attr('cy', (d) => getCoords(d).cy);
        }

    
        updatePositions();

  
        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);
    
        timeSlider.addEventListener('input', updateTimeDisplay);
        updateTimeDisplay();
        
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }
   
  });