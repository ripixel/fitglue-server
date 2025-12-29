package enricher_providers

import (
	"context"
	"fmt"
	"sort"
	"strings"

	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

// MuscleHeatmapProvider generates an emoji-based "heatmap" of muscle volume.
type MuscleHeatmapProvider struct {
	// Coefficient map to skew effort based on muscle size/strength.
	// Smaller muscles (arms, shoulders) have lower max loads, so we multiplier their volume to match legs/back.
	// Baseline: Legs (Squat) = 1.0.
	// Arms: 100kg curl is impossible, 100kg squat is warmup.
	// Ratio: World Record Curl ~115kg. WR Squat ~500kg. Ratio ~4-5x.
	// So Arms volume * 4 = Equivalent Leg Volume?
	// User said: "100kg x 3 Squats (legs) is much easier than 100kg x 3 Bicep Curls"
	// So if weight is constant, Curls should score higher.
	// Score = Volume * Coefficient.
	coefficients map[pb.MuscleGroup]float64
}

func NewMuscleHeatmapProvider() *MuscleHeatmapProvider {
	return &MuscleHeatmapProvider{
		coefficients: map[pb.MuscleGroup]float64{
			pb.MuscleGroup_MUSCLE_GROUP_QUADRICEPS: 1.0,
			pb.MuscleGroup_MUSCLE_GROUP_HAMSTRINGS: 1.0,
			pb.MuscleGroup_MUSCLE_GROUP_GLUTES:     1.0,
			pb.MuscleGroup_MUSCLE_GROUP_CALVES:     1.0,
			pb.MuscleGroup_MUSCLE_GROUP_ADDUCTORS:  1.0,
			pb.MuscleGroup_MUSCLE_GROUP_ABDUCTORS:  1.0,

			pb.MuscleGroup_MUSCLE_GROUP_LATS:       1.2,
			pb.MuscleGroup_MUSCLE_GROUP_UPPER_BACK: 1.2,
			pb.MuscleGroup_MUSCLE_GROUP_LOWER_BACK: 1.2,
			pb.MuscleGroup_MUSCLE_GROUP_NECK:       1.2,
			pb.MuscleGroup_MUSCLE_GROUP_TRAPS:      1.2,

			pb.MuscleGroup_MUSCLE_GROUP_CHEST:     1.5,
			pb.MuscleGroup_MUSCLE_GROUP_SHOULDERS: 2.5,

			pb.MuscleGroup_MUSCLE_GROUP_BICEPS:   4.0,
			pb.MuscleGroup_MUSCLE_GROUP_TRICEPS:  4.0,
			pb.MuscleGroup_MUSCLE_GROUP_FOREARMS: 4.0,

			pb.MuscleGroup_MUSCLE_GROUP_ABDOMINALS: 3.0,
			pb.MuscleGroup_MUSCLE_GROUP_CARDIO:     0.5,
			pb.MuscleGroup_MUSCLE_GROUP_FULL_BODY:  1.0,
		},
	}
}

func (p *MuscleHeatmapProvider) Name() string {
	return "muscle-heatmap"
}

func getMuscleCoefficient(coeffs map[pb.MuscleGroup]float64, muscle pb.MuscleGroup) float64 {
	if v, ok := coeffs[muscle]; ok {
		return v
	}
	// Fallback logic could go here if we had grouped enums (e.g. all legs)
	// For now, if not in map, return 1.0
	return 1.0
}

func (p *MuscleHeatmapProvider) Enrich(ctx context.Context, activity *pb.StandardizedActivity, user *pb.UserRecord, inputConfig map[string]string) (*EnrichmentResult, error) {
	// Aggregate sets
	var allSets []*pb.StrengthSet
	for _, s := range activity.Sessions {
		allSets = append(allSets, s.StrengthSets...)
	}

	if len(allSets) == 0 {
		return &EnrichmentResult{}, nil
	}

	// Calculate Weighted Volume per Muscle Group
	volumeScores := make(map[string]float64)
	maxScore := 0.0

	for _, set := range allSets {
		// Process Primary Muscle
		primary := set.PrimaryMuscleGroup
		load := calculateLoad(set)

		if primary != pb.MuscleGroup_MUSCLE_GROUP_UNSPECIFIED && primary != pb.MuscleGroup_MUSCLE_GROUP_OTHER {
			coeff := getMuscleCoefficient(p.coefficients, primary)
			score := load * coeff

			// Convert to string for display name
			name := formatMuscleName(primary)
			volumeScores[name] += score
			if volumeScores[name] > maxScore {
				maxScore = volumeScores[name]
			}
		}

		// Process Secondary Muscles (0.5x impact)
		for _, sec := range set.SecondaryMuscleGroups {
			if sec != pb.MuscleGroup_MUSCLE_GROUP_UNSPECIFIED && sec != pb.MuscleGroup_MUSCLE_GROUP_OTHER {
				coeff := getMuscleCoefficient(p.coefficients, sec)
				score := load * coeff * 0.5

				name := formatMuscleName(sec)
				volumeScores[name] += score
				if volumeScores[name] > maxScore {
					maxScore = volumeScores[name]
				}
			}
		}
	}

	// Generate Chart
	keys := make([]string, 0, len(volumeScores))
	for k := range volumeScores {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sb strings.Builder

	// Rewrite loop cleaner
	sb.Reset()
	sb.WriteString("Muscle Heatmap:\n")
	for _, k := range keys {
		score := volumeScores[k]
		rating := 0
		if maxScore > 0 {
			rating = int((score / maxScore) * 5.0)
		}
		if rating == 0 && score > 0 {
			rating = 1
		}

		bar := ""
		for i := 0; i < 5; i++ {
			if i < rating {
				bar += "🟪"
			} else {
				bar += "⬜"
			}
		}
		sb.WriteString(fmt.Sprintf("- %s: %s\n", k, bar))
	}

	return &EnrichmentResult{
		Description: sb.String(),
	}, nil
}

func formatMuscleName(m pb.MuscleGroup) string {
	// E.g. MUSCLE_GROUP_UPPER_BACK -> "Upper Back"
	s := m.String()
	s = strings.TrimPrefix(s, "MUSCLE_GROUP_")
	s = strings.ReplaceAll(s, "_", " ")
	return strings.Title(strings.ToLower(s))
}

func calculateLoad(set *pb.StrengthSet) float64 {
	load := set.WeightKg * float64(set.Reps)
	if set.WeightKg == 0 {
		load = float64(set.Reps) * 40.0 // heuristic
	}
	return load
}
