package enricher_providers

import "math"

// LatLong represents a coordinate point
type LatLong struct {
	Lat  float64
	Long float64
}

// RouteDefinition defines a scenic loop
type RouteDefinition struct {
	Name        string
	TotalDistKm float64
	Points      []LatLong
}

// RoutesLibrary holds available routes
var RoutesLibrary = map[string]RouteDefinition{
	"london": {
		Name: "London Hyde Park (Approx)",
		// A rough rectangle around Hyde Park / Kensington Gardens
		Points: []LatLong{
			{51.5028, -0.1513}, // Hyde Park Corner
			{51.5037, -0.1495},
			{51.5065, -0.1505},
			{51.5118, -0.1656}, // Bayswater Road
			{51.5090, -0.1770},
			{51.5080, -0.1830},
			{51.5040, -0.1848}, // Kensington Palace Gdns
			{51.5020, -0.1865},
			{51.4995, -0.1810}, // Kensington Rd
			{51.5005, -0.1710},
			{51.5015, -0.1605}, // Knightsbridge
			{51.5028, -0.1513}, // Back to start
		},
	},
}

// calculateTotalDistance computes the total distance of the route in meters
func (r *RouteDefinition) Meters() float64 {
	dist := 0.0
	for i := 0; i < len(r.Points)-1; i++ {
		dist += haversine(r.Points[i], r.Points[i+1])
	}
	return dist
}

// haversine calculates distance between two points in meters
func haversine(p1, p2 LatLong) float64 {
	const earthRadius = 6371000 // meters

	lat1 := p1.Lat * math.Pi / 180
	lat2 := p2.Lat * math.Pi / 180
	dLat := (p2.Lat - p1.Lat) * math.Pi / 180
	dLon := (p2.Long - p1.Long) * math.Pi / 180

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1)*math.Cos(lat2)*
			math.Sin(dLon/2)*math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}
