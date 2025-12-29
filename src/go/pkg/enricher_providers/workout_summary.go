package enricher_providers

import (
	"context"
	"fmt"
	"strings"

	pb "github.com/ripixel/fitglue-server/src/go/pkg/types/pb"
)

// WorkoutSummaryProvider generates a text summary of a strength workout.
type WorkoutSummaryProvider struct{}

func NewWorkoutSummaryProvider() *WorkoutSummaryProvider {
	return &WorkoutSummaryProvider{}
}

func (p *WorkoutSummaryProvider) Name() string {
	return "workout-summary"
}

func (p *WorkoutSummaryProvider) Enrich(ctx context.Context, activity *pb.StandardizedActivity, user *pb.UserRecord, inputConfig map[string]string) (*EnrichmentResult, error) {
	// Aggregate all sets from all sessions
	var allSets []*pb.StrengthSet
	for _, s := range activity.Sessions {
		allSets = append(allSets, s.StrengthSets...)
	}

	if len(allSets) == 0 {
		return &EnrichmentResult{}, nil
	}

	// Group by Exercise Name
	// We want to preserve order of exercises as they appear, so we'll maintain a list of keys
	type ExerciseBlock struct {
		Name         string
		Sets         []*pb.StrengthSet
		MuscleGroups []pb.MuscleGroup
	}

	var blocks []*ExerciseBlock
	exerciseMap := make(map[string]*ExerciseBlock)

	for _, set := range allSets {
		key := set.ExerciseName
		if key == "" {
			key = "Unknown Exercise"
		}

		if _, exists := exerciseMap[key]; !exists {
			blo := &ExerciseBlock{
				Name:         key,
				Sets:         []*pb.StrengthSet{},
				MuscleGroups: []pb.MuscleGroup{set.PrimaryMuscleGroup}, // simplified
			}
			blocks = append(blocks, blo)
			exerciseMap[key] = blo
		}
		exerciseMap[key].Sets = append(exerciseMap[key].Sets, set)
	}

	var sb strings.Builder
	sb.WriteString("Workout Summary:\n")

	for _, b := range blocks {
		sb.WriteString(fmt.Sprintf("- %s: ", b.Name))

		// Summarize sets: "3 Sets" or detail?
		// Let's try to group: "3x10 @ 100kg"
		// If weight changes, maybe list them out?
		// Simple v1 approach: List sets: "10@100, 10@100, 10@100"

		var setStrs []string
		for _, s := range b.Sets {
			if s.WeightKg > 0 {
				// Format: 10 x 100kg
				setStrs = append(setStrs, fmt.Sprintf("%d × %.1fkg", s.Reps, s.WeightKg))
			} else {
				setStrs = append(setStrs, fmt.Sprintf("%d reps", s.Reps))
			}
		}

		// Optimization: Collapse identical sets? "3x 10@100kg"
		// Let's implement simple collapsing since we are touching this.
		// If all text representations are identical, condense.
		allSame := true
		if len(setStrs) > 1 {
			first := setStrs[0]
			for _, str := range setStrs[1:] {
				if str != first {
					allSame = false
					break
				}
			}
			if allSame {
				// Format: 3 Sets of 10 x 100kg -> "3 x 10 × 100kg"
				sb.WriteString(fmt.Sprintf("%d x %s", len(setStrs), setStrs[0]))
			} else {
				sb.WriteString(strings.Join(setStrs, ", "))
			}
		} else if len(setStrs) == 1 {
			sb.WriteString(setStrs[0])
		}
		sb.WriteString("\n")
	}

	return &EnrichmentResult{
		Description: sb.String(),
	}, nil
}
